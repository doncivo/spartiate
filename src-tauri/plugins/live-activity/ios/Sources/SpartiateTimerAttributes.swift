// SPA-007 : attributs de la Live Activity du compteur. Ce fichier est compilé À LA FOIS dans l'app (plugin live-activity, copie identique
// vérifiée par un test) et dans l'extension SpartiateLiveActivity : même nom de type des deux côtés, c'est ainsi qu'ActivityKit les relie.
// Aucune donnée de santé, aucun identifiant : une date de fin et un libellé.

import ActivityKit
import Foundation

public struct SpartiateTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Fin du compteur. Le décompte à l'écran est calculé depuis cette date par le système (Text(timerInterval:)), sans mise à jour.
    public var endDate: Date
    public var label: String
    /// Texte de l'état final, rendu par le widget lui-même quand l'activité est périmée (staleDate = endDate), app fermée comprise.
    public var finishedLabel: String

    public init(endDate: Date, label: String, finishedLabel: String) {
      self.endDate = endDate
      self.label = label
      self.finishedLabel = finishedLabel
    }
  }

  public init() {}
}
