// Plugin vision de Spartiate (CAP-IOS-01, ADR 0015 section 1.2) : lecture de texte d'une photo de liste avec Vision.
//
// Contrat : tests/fixtures/capture/vision-contract.json (noms, champs, codes), relu par un contrôle statique contre ce fichier et
// src-tauri/src/ocr/vision.rs. Seul Rust appelle ces commandes (aucune permission pour la WebView).
//
// Règles :
// - aucune chaîne d'interface ni libellé ici ; rejet = un code du contrat (`invoke.reject(code.rawValue, code: code.rawValue)`),
//   jamais le texte d'une erreur système, ni un texte reconnu ;
// - chaque méthode résout ou rejette sur tous ses chemins, une seule fois (`Settle`) ;
// - le travail tourne sur `visionQueue` (série, dédiée), jamais sur la file IPC partagée de Tauri ni sur le fil principal ;
// - l'image reste en mémoire : rien n'est écrit, rien n'est envoyé (ni fichier, ni réseau) ; seule `cleanTemporaryUploads` supprime les
//   copies temporaires du sélecteur de photos.
// - SHELL-0294b (C-159) : l'état « occupé » ne dure jamais plus que la garde de temps et sa marge. Chaque lecture a un jeton ; la garde de
//   temps libère l'état dès qu'elle répond `timeout` ; une lecture restée bloquée dans `perform` au-delà est abandonnée (nouvelle file
//   série), et seule la lecture en cours peut libérer l'état (une lecture abandonnée qui finit enfin ne libère pas la suivante).

import CoreGraphics
import Foundation
import ImageIO
import Tauri
import Vision
import WebKit

// MARK: - Codes et arguments

private enum Code: String {
  case invalidArgument = "invalid-argument"
  case unsupportedFormat = "unsupported-format"
  case dimensions = "dimensions"
  case languageMissing = "language-missing"
  case busy = "busy"
  case timeout = "timeout"
  case failed = "failed"
}

private struct Failure: Error {
  let code: Code
}

struct RecognizeArgs: Decodable {
  let image: String
  let languages: [String]
  let maxSide: Int
  let maxLines: Int
}

/// Un seul résultat par appel : le premier qui passe (lecture terminée ou garde de temps) répond, l'autre se tait.
private final class Settle {
  private let lock = NSLock()
  private var done = false

  func first() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if done {
      return false
    }
    done = true
    return true
  }
}

// MARK: - Plugin

class VisionPlugin: Plugin {
  /// File des lectures (série, dédiée) : `perform` est synchrone et ne doit jamais tourner sur le fil principal. Remplacée (sous `stateLock`)
  /// quand une lecture bloquée est abandonnée ; lue par `currentQueue()`.
  private var visionQueue = DispatchQueue(label: "fr.spartiate.vision.read", qos: .userInitiated)
  /// File des gardes de temps (distincte : la file de lecture est occupée pendant `perform`).
  private let guardQueue = DispatchQueue(label: "fr.spartiate.vision.guard", qos: .userInitiated)
  /// Garde de temps d'une lecture (s) : au-delà, la requête est annulée et `timeout` rendu.
  private let readTimeoutSeconds: Double = 15
  /// Marge au-delà de la garde de temps avant d'abandonner une lecture bloquée (s).
  private let staleGraceSeconds: Double = 5
  private let stateLock = NSLock()
  /// Jeton de la lecture en cours (nil : aucune) et date de son début.
  private var readingToken: UInt64?
  private var readingSince: Date?
  private var nextToken: UInt64 = 0

  // MARK: Outils communs

  private func reject(_ invoke: Invoke, _ code: Code) {
    invoke.reject(code.rawValue, code: code.rawValue)
  }

  /// Arguments décodés, sinon `invalid-argument` (jamais le texte du décodeur).
  private func args<T: Decodable>(_ invoke: Invoke, _ type: T.Type) -> T? {
    do {
      return try invoke.parseArgs(type)
    } catch {
      reject(invoke, .invalidArgument)
      return nil
    }
  }

  /// File des lectures du moment (sous `stateLock`).
  private func currentQueue() -> DispatchQueue {
    stateLock.lock()
    defer { stateLock.unlock() }
    return visionQueue
  }

  /// Jeton de la nouvelle lecture, ou nil si une lecture récente est en cours (`busy`). Une lecture plus vieille que la garde de temps et sa
  /// marge est abandonnée : elle garde sa file, bloquée, et les suivantes partent sur une file neuve.
  private func beginReading() -> UInt64? {
    stateLock.lock()
    defer { stateLock.unlock() }
    if readingToken != nil {
      let age = Date().timeIntervalSince(readingSince ?? Date.distantPast)
      if age < readTimeoutSeconds + staleGraceSeconds {
        return nil
      }
      visionQueue = DispatchQueue(label: "fr.spartiate.vision.read", qos: .userInitiated)
    }
    nextToken &+= 1
    readingToken = nextToken
    readingSince = Date()
    return nextToken
  }

  /// Garde de temps échue pour la lecture `token` : les lectures suivantes partent sur une file neuve.
  private func retireQueue(_ token: UInt64) {
    stateLock.lock()
    if readingToken == token {
      visionQueue = DispatchQueue(label: "fr.spartiate.vision.read", qos: .userInitiated)
    }
    stateLock.unlock()
  }

  /// Libère l'état si `token` est la lecture en cours (sans effet sinon : lecture abandonnée, ou déjà libérée par la garde de temps).
  private func endReading(_ token: UInt64) {
    stateLock.lock()
    if readingToken == token {
      readingToken = nil
      readingSince = nil
    }
    stateLock.unlock()
  }

  private func supportedLanguages(_ request: VNRecognizeTextRequest) throws -> [String] {
    do {
      return try request.supportedRecognitionLanguages()
    } catch {
      throw Failure(code: .failed)
    }
  }

  // MARK: Commandes

  /// Langues que Vision sait lire (niveau précis, révision 3).
  @objc public func status(_ invoke: Invoke) {
    let visionQueue = currentQueue()
    visionQueue.async {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.revision = VNRecognizeTextRequestRevision3
      do {
        let languages = try self.supportedLanguages(request)
        invoke.resolve(["languages": languages])
      } catch {
        self.reject(invoke, .failed)
      }
    }
  }

  /// Supprime les copies temporaires des photos choisies dans le sélecteur du système (préfixe WKFileUpload du dossier temporaire de l'app) :
  /// la photo d'une liste ne reste pas sur l'appareil après sa lecture. Appelée par Rust après chaque lecture et au lancement ; seul endroit
  /// du plugin qui touche au système de fichiers (jamais d'écriture), sur la file des lectures (donc après la lecture en cours).
  @objc public func cleanTemporaryUploads(_ invoke: Invoke) {
    let visionQueue = currentQueue()
    visionQueue.async {
      let manager = FileManager.default
      let directory = NSTemporaryDirectory()
      guard let names = try? manager.contentsOfDirectory(atPath: directory) else {
        self.reject(invoke, .failed)
        return
      }
      var removed = 0
      var failed = false
      for name in names where name.hasPrefix("WKFileUpload") {
        do {
          try manager.removeItem(atPath: (directory as NSString).appendingPathComponent(name))
          removed += 1
        } catch {
          failed = true
        }
      }
      if failed {
        self.reject(invoke, .failed)
      } else {
        invoke.resolve(["removed": removed])
      }
    }
  }

  /// Lit l'image et rend les lignes (texte, confiance de 0 à 1, position normalisée).
  @objc public func recognize(_ invoke: Invoke) {
    guard let input = args(invoke, RecognizeArgs.self) else {
      return
    }
    if input.maxSide <= 0 || input.maxLines <= 0 || input.languages.isEmpty {
      reject(invoke, .invalidArgument)
      return
    }
    guard let token = beginReading() else {
      reject(invoke, .busy)
      return
    }
    let visionQueue = currentQueue()
    visionQueue.async {
      defer { self.endReading(token) }
      let settle = Settle()
      do {
        let lines = try self.read(input, settle: settle, invoke: invoke, token: token)
        if settle.first() {
          invoke.resolve(["lines": lines])
        }
      } catch let failure as Failure {
        if settle.first() {
          self.reject(invoke, failure.code)
        }
      } catch {
        if settle.first() {
          self.reject(invoke, .failed)
        }
      }
    }
  }

  // MARK: Lecture

  private func read(_ input: RecognizeArgs, settle: Settle, invoke: Invoke, token: UInt64) throws -> [[String: Any]] {
    guard let data = Data(base64Encoded: input.image), !data.isEmpty else {
      throw Failure(code: .invalidArgument)
    }
    // Propriétés lues AVANT tout décodage : une image qui déclare des dimensions démesurées n'est jamais décodée.
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions), CGImageSourceGetCount(source) > 0 else {
      throw Failure(code: .unsupportedFormat)
    }
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, sourceOptions) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      width > 0, height > 0
    else {
      throw Failure(code: .unsupportedFormat)
    }
    if width > input.maxSide || height > input.maxSide {
      throw Failure(code: .dimensions)
    }
    let rawOrientation = (properties[kCGImagePropertyOrientation] as? UInt32) ?? 1
    let orientation = CGImagePropertyOrientation(rawValue: rawOrientation) ?? .up
    guard let image = CGImageSourceCreateImageAtIndex(source, 0, sourceOptions) else {
      throw Failure(code: .unsupportedFormat)
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.revision = VNRecognizeTextRequestRevision3
    request.automaticallyDetectsLanguage = false
    let supported = try supportedLanguages(request)
    // Le français doit être lisible ; les autres langues demandées (anglais) ne servent que si Vision les connaît.
    let wanted = input.languages.filter { tag in supported.contains { $0.caseInsensitiveCompare(tag) == .orderedSame } }
    guard let first = input.languages.first, wanted.contains(where: { $0.caseInsensitiveCompare(first) == .orderedSame }) else {
      throw Failure(code: .languageMissing)
    }
    request.recognitionLanguages = wanted

    // Garde de temps : annule la requête et répond `timeout` si la lecture dépasse la butée.
    let guardItem = DispatchWorkItem { [weak self] in
      if settle.first() {
        request.cancel()
        self?.reject(invoke, .timeout)
        // La réponse est partie : la lecture suivante part sur une file neuve (jamais derrière un `perform` qui ne rend pas la main), puis
        // l'état « occupé » est libéré.
        self?.retireQueue(token)
        self?.endReading(token)
      }
    }
    guardQueue.asyncAfter(deadline: .now() + readTimeoutSeconds, execute: guardItem)
    defer { guardItem.cancel() }

    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw Failure(code: .failed)
    }
    let observations = request.results ?? []
    var lines: [[String: Any]] = []
    for observation in observations.prefix(input.maxLines) {
      guard let best = observation.topCandidates(1).first else {
        continue
      }
      let box = observation.boundingBox
      lines.append([
        "text": best.string,
        "confidence": Double(best.confidence),
        "x": Double(box.minX),
        "y": Double(box.maxY),
      ])
    }
    return lines
  }
}

@_cdecl("init_plugin_vision")
func initPlugin() -> Plugin {
  return VisionPlugin()
}
