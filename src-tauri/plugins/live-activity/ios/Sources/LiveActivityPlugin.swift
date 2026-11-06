// Plugin live-activity de Spartiate (SPA-007, H-4). Rust seul l'appelle ; la WebView n'a aucune commande de plugin.
//
// Trois méthodes :
// - status : disponibilité (ActivityAuthorizationInfo().areActivitiesEnabled), avec le motif quand la réponse est non, et la dernière erreur
//   native (domaine, code, description : aucune donnée de santé ni de tâche) ;
// - start({ endDateMs, label }) : démarre la Live Activity du compteur ; une activité déjà là pour la même échéance est gardée (reprise sans
//   doublon), toute autre est fermée sans délai (aucune activité orpheline) ;
// - end : ferme toutes les activités du compteur, dismissalPolicy .immediate.
//
// Aucun push (pushType nil), aucun App Group, aucun mode d'arrière-plan : le décompte avance seul dans l'extension (Text(timerInterval:)).
// Les erreurs d'ActivityKit sont rendues en clair (résolues, pas rejetées) pour le « Détail technique » de l'écran.

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
  let finishedLabel: String?
}

class LiveActivityPlugin: Plugin {
  private var observer: NSObjectProtocol?

  /// À chaque ouverture de l'app, toute activité échue est fermée sans délai (clôture I0) : aucune activité orpheline, même si l'échéance est
  /// passée app fermée (le widget a alors rendu l'état final seul).
  override func load(webview: WKWebView) {
    endExpired()
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
      self?.endExpired()
    }
  }

  func endExpired() {
    Task {
      for activity in Activity<SpartiateTimerAttributes>.activities where activity.content.state.endDate <= Date() {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }

  /// Dernière erreur native d'ActivityKit (domaine, code, description tronquée à 200).
  private var lastError: [String: Any]?

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
    if let lastError {
      payload["lastError"] = lastError
    }
    invoke.resolve(payload)
  }

  @objc public func start(_ invoke: Invoke) {
    guard let args = try? invoke.parseArgs(StartArgs.self), args.endDateMs.isFinite, args.endDateMs > 0, !args.label.isEmpty else {
      reject(invoke, .badArgs)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject(invoke, .disabled)
      return
    }
    let endDate = Date(timeIntervalSince1970: args.endDateMs / 1000)
    let label = String(args.label.prefix(80))
    let finishedLabel = String((args.finishedLabel ?? "Terminé").prefix(40))
    Task {
      var kept = false
      for activity in Activity<SpartiateTimerAttributes>.activities {
        if !kept && abs(activity.content.state.endDate.timeIntervalSince(endDate)) < 1 {
          kept = true
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if kept {
        invoke.resolve(["started": true])
        return
      }
      do {
        let state = SpartiateTimerAttributes.ContentState(endDate: endDate, label: label, finishedLabel: finishedLabel)
        let content = ActivityContent(state: state, staleDate: endDate)
        _ = try Activity<SpartiateTimerAttributes>.request(attributes: SpartiateTimerAttributes(), content: content, pushType: nil)
        self.lastError = nil
        invoke.resolve(["started": true])
      } catch {
        let native = self.detail(of: error)
        self.lastError = native
        invoke.resolve(["started": false, "error": native])
      }
    }
  }

  @objc public func end(_ invoke: Invoke) {
    Task {
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
