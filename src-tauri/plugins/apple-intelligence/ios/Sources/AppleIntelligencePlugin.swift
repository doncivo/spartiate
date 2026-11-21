// Plugin apple-intelligence de Spartiate (IOS-029b, essai sans engagement, H-41 proposée). Rust seul l'appelle ; la WebView n'a aucune
// commande de plugin.
//
// Une méthode, probe (sans argument) : interroge le modèle local d'Apple (Foundation Models, iOS 26 : SystemLanguageModel,
// LanguageModelSession) avec un texte SYNTHÉTIQUE fixe, écrit ci-dessous ; aucune donnée de l'app (encore moins corporelle) ne peut y
// entrer. Le résultat est toujours résolu, jamais rejeté :
// - { status: "answered", prompt, response, elapsedMs } : réponse du modèle (tronquée à 2 000 caractères) ;
// - { status: "unavailable", reason, detail?, prompt } : "sdk-absent" (app compilée avec un SDK sans Foundation Models), "os-too-old"
//   (iOS < 26), "model-unavailable" (detail : motif du système tel quel, ex. deviceNotEligible, appleIntelligenceNotEnabled, modelNotReady) ;
// - { status: "error", prompt, error: { domain, code, description } } : erreur de génération rendue telle quelle (description tronquée à 300).
// Rien n'est enregistré ni journalisé ici ; aucun réseau, aucun entitlement, aucune clé Info.plist.
//
// Compilation conditionnelle : #if canImport(FoundationModels) et @available(iOS 26.0, *) gardent le build vert avec un SDK plus ancien
// (le motif est alors "sdk-absent") et l'app lançable sous iOS 17 à 25 (références faibles au framework).

import Foundation
import Tauri
import UIKit
import WebKit
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Texte d'essai fixe et synthétique (aucune donnée de l'app) ; rendu avec le résultat pour que l'écran l'affiche tel qu'envoyé.
private let syntheticPrompt = "Réponds en une seule phrase, en français : pourquoi s’échauffer avant une séance de sport ?"

private let responseMax = 2000
private let descriptionMax = 300

class AppleIntelligencePlugin: Plugin {
  @objc public func probe(_ invoke: Invoke) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      Task {
        let payload = await self.ask()
        invoke.resolve(payload)
      }
      return
    }
    invoke.resolve(["status": "unavailable", "reason": "os-too-old", "prompt": syntheticPrompt])
    #else
    invoke.resolve(["status": "unavailable", "reason": "sdk-absent", "prompt": syntheticPrompt])
    #endif
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private func ask() async -> [String: Any] {
    let model = SystemLanguageModel.default
    if case .unavailable(let reason) = model.availability {
      return [
        "status": "unavailable",
        "reason": "model-unavailable",
        "detail": String(String(describing: reason).prefix(descriptionMax)),
        "prompt": syntheticPrompt,
      ]
    }
    let started = Date()
    do {
      let session = LanguageModelSession()
      let response = try await session.respond(to: syntheticPrompt)
      let elapsedMs = Int(Date().timeIntervalSince(started) * 1000)
      return [
        "status": "answered",
        "prompt": syntheticPrompt,
        "response": String(response.content.prefix(responseMax)),
        "elapsedMs": elapsedMs,
      ]
    } catch {
      let native = error as NSError
      return [
        "status": "error",
        "prompt": syntheticPrompt,
        "error": [
          "domain": native.domain,
          "code": native.code,
          "description": String(String(describing: error).prefix(descriptionMax)),
        ] as [String: Any],
      ]
    }
  }
  #endif
}

@_cdecl("init_plugin_apple_intelligence")
func initPlugin() -> Plugin {
  return AppleIntelligencePlugin()
}
