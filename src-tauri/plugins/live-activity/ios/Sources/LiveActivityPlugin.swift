// Plugin live-activity de Spartiate (SPA-007, H-4). Rust seul l'appelle ; la WebView n'a aucune commande de plugin.
//
// Trois méthodes :
// - status : disponibilité (ActivityAuthorizationInfo().areActivitiesEnabled), avec le motif quand la réponse est non, et la dernière erreur
//   native (domaine, code, description : aucune donnée de santé ni de tâche) ;
// - start({ endDateMs, label, finishedLabel }) : démarre la Live Activity du compteur ; une activité déjà là pour la même échéance est gardée (reprise sans
//   doublon), toute autre est fermée sans délai (aucune activité orpheline) ;
// - end : ferme toutes les activités du compteur, dismissalPolicy .immediate.
//
// I1-02 : si l'app tourne encore à l'échéance (premier plan, ou pas encore suspendue), l'activité est terminée avec son contenu final :
// ActivityKit redessine alors la vue, qui rend « Terminé » (finishedLabel), gardée quelques minutes sur l'écran verrouillé. App suspendue ou
// fermée, rien ne tourne : le widget s'appuie sur staleDate et sur l'heure de fin affichée en permanence, et endExpired ferme l'activité à la
// reprise. Aucun `end` au démarrage : une activité terminée quitte la Dynamic Island.
//
// Aucun push (pushType nil), aucun App Group, aucun mode d'arrière-plan : le décompte avance seul dans l'extension (Text(timerInterval:)).
// Les erreurs d'ActivityKit sont rendues en clair (résolues, pas rejetées) pour le « Détail technique » de l'écran.
//
// SHELL-0294b (C-156, C-146) : start, end et la fermeture des activités échues passent par une seule file de tâches (fil principal) : deux
// démarrages rapprochés s'exécutent l'un après l'autre, jamais deux activités. Une activité gardée pour la même échéance reçoit le nouveau
// libellé. Le texte d'état final est obligatoire (aucun texte en dur ici). La dernière erreur est lue et écrite sous verrou. La date de fin
// est bornée : pas déjà passée (une seconde de marge pour le trajet de l'appel), au plus 8 h devant (durée maximale d'une Live Activity).

import ActivityKit
import Foundation
import Tauri
import UIKit
import WebKit

private enum LiveActivityCode: String {
  case badArgs = "liveactivity-bad-args"
  case disabled = "liveactivity-disabled"
}

private struct StartArgs: Decodable {
  let endDateMs: Double
  let label: String
  let finishedLabel: String
}

/// Durée pendant laquelle l'état final reste sur l'écran verrouillé quand l'app a pu terminer l'activité à l'échéance.
private let finishedVisibleSeconds: TimeInterval = 5 * 60

/// Écart maximal entre maintenant et la date de fin acceptée (s) : une Live Activity ne vit pas plus de 8 h.
private let maxEndAheadSeconds: TimeInterval = 8 * 3600

/// Retard toléré d'une date de fin (s) : le trajet de l'appel depuis le JS.
private let maxEndBehindSeconds: TimeInterval = 1

class LiveActivityPlugin: Plugin {
  private var observer: NSObjectProtocol?
  /// Fin programmée de l'activité en cours (I1-02) ; annulée par un nouveau départ ou un arrêt. Lue et écrite sur le fil principal.
  private var finishTask: Task<Void, Never>?
  /// Dernière tâche de la file (fil principal) : chaque opération sur les activités attend la fin de la précédente.
  private var tail: Task<Void, Never>?
  /// Dernière erreur native d'ActivityKit (domaine, code, description tronquée à 200), sous `errorLock`.
  private let errorLock = NSLock()
  private var lastErrorStore: [String: Any]?

  /// À chaque ouverture de l'app, toute activité échue est fermée sans délai (clôture I0) : aucune activité orpheline, même si l'échéance est
  /// passée app fermée (le widget a alors rendu l'état final seul).
  override func load(webview: WKWebView) {
    endExpired()
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
      self?.endExpired()
    }
  }

  /// Ajoute `work` à la file : il ne commence qu'à la fin de l'opération précédente (jamais deux `start` entrelacés).
  private func enqueue(_ work: @escaping @MainActor () async -> Void) {
    DispatchQueue.main.async {
      let previous = self.tail
      self.tail = Task { @MainActor in
        await previous?.value
        await work()
      }
    }
  }

  private func readLastError() -> [String: Any]? {
    errorLock.lock()
    defer { errorLock.unlock() }
    return lastErrorStore
  }

  private func writeLastError(_ value: [String: Any]?) {
    errorLock.lock()
    lastErrorStore = value
    errorLock.unlock()
  }

  func endExpired() {
    enqueue {
      for activity in Activity<SpartiateTimerAttributes>.activities where activity.content.state.endDate <= Date() {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }

  /// Programme la fin de l'activité `id` à `endDate`. Ne s'exécute que si l'app n'est pas suspendue d'ici là.
  @MainActor
  private func scheduleFinish(id: String, endDate: Date) {
    finishTask?.cancel()
    finishTask = Task { [weak self] in
      let delay = endDate.timeIntervalSinceNow
      if delay > 0 {
        try? await Task.sleep(for: .seconds(delay))
      }
      if Task.isCancelled {
        return
      }
      await self?.finish(id: id)
    }
  }

  @MainActor
  private func cancelFinish() {
    finishTask?.cancel()
    finishTask = nil
  }

  /// Termine l'activité échue avec son contenu final, sans date de péremption : la vue redessinée rend finishedLabel.
  func finish(id: String) async {
    for activity in Activity<SpartiateTimerAttributes>.activities where activity.id == id && activity.content.state.endDate <= Date() {
      await activity.end(ActivityContent(state: activity.content.state, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(finishedVisibleSeconds)))
    }
  }

  private func reject(_ invoke: Invoke, _ code: LiveActivityCode) {
    invoke.reject(code.rawValue, code: code.rawValue)
  }

  private func detail(of error: Error) -> [String: Any] {
    let native = error as NSError
    return ["domain": native.domain, "code": native.code, "description": String(native.localizedDescription.prefix(200))]
  }

  @objc public func status(_ invoke: Invoke) {
    let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
    var payload: [String: Any] = ["available": enabled]
    if !enabled {
      // Live Activities coupées dans Réglages, ou clé NSSupportsLiveActivities / extension absente.
      payload["reason"] = "disabled"
    }
    if let lastError = readLastError() {
      payload["lastError"] = lastError
    }
    invoke.resolve(payload)
  }

  @objc public func start(_ invoke: Invoke) {
    guard let args = try? invoke.parseArgs(StartArgs.self), args.endDateMs.isFinite, args.endDateMs > 0, !args.label.isEmpty,
      !args.finishedLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
      reject(invoke, .badArgs)
      return
    }
    let endDate = Date(timeIntervalSince1970: args.endDateMs / 1000)
    if endDate.timeIntervalSinceNow < -maxEndBehindSeconds || endDate.timeIntervalSinceNow > maxEndAheadSeconds {
      reject(invoke, .badArgs)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject(invoke, .disabled)
      return
    }
    let state = SpartiateTimerAttributes.ContentState(
      endDate: endDate, label: String(args.label.prefix(80)), finishedLabel: String(args.finishedLabel.prefix(40)))
    enqueue {
      self.cancelFinish()
      var keptActivity: Activity<SpartiateTimerAttributes>?
      for activity in Activity<SpartiateTimerAttributes>.activities {
        if keptActivity == nil && abs(activity.content.state.endDate.timeIntervalSince(endDate)) < 1 {
          keptActivity = activity
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if let kept = keptActivity {
        // Reprise ou nouveau libellé pour la même échéance : le contenu affiché suit (jamais un libellé ancien).
        if kept.content.state != state {
          await kept.update(ActivityContent(state: state, staleDate: endDate))
        }
        self.scheduleFinish(id: kept.id, endDate: endDate)
        invoke.resolve(["started": true])
        return
      }
      do {
        let content = ActivityContent(state: state, staleDate: endDate)
        let activity = try Activity<SpartiateTimerAttributes>.request(attributes: SpartiateTimerAttributes(), content: content, pushType: nil)
        self.writeLastError(nil)
        self.scheduleFinish(id: activity.id, endDate: endDate)
        invoke.resolve(["started": true])
      } catch {
        let native = self.detail(of: error)
        self.writeLastError(native)
        invoke.resolve(["started": false, "error": native])
      }
    }
  }

  @objc public func end(_ invoke: Invoke) {
    enqueue {
      self.cancelFinish()
      let running = Activity<SpartiateTimerAttributes>.activities
      for activity in running {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      invoke.resolve(["ended": true, "count": running.count])
    }
  }
}

@_cdecl("init_plugin_live_activity")
func initPlugin() -> Plugin {
  return LiveActivityPlugin()
}
