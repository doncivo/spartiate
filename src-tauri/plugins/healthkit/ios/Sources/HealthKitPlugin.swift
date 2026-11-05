import HealthKit
import Tauri
import WebKit

private enum HealthKitCode: String {
  case unavailable = "healthkit-unavailable"
  case authorizationFailed = "healthkit-authorization-failed"
  case readFailed = "healthkit-read-failed"
  case denied = "healthkit-denied"
}

class HealthKitPlugin: Plugin {
  private let store = HKHealthStore()
  /// Dernière erreur native de requestAuthorization (domaine, code, description : aucune donnée de santé). Le statut la rend à l'écran
  /// « Apple Santé », qui l'affiche sous « Détail technique » et l'écrit dans le journal technique (diagnostic 0.1.3).
  private var lastError: [String: Any]?

  private func reject(_ invoke: Invoke, _ code: HealthKitCode) {
    invoke.reject(code.rawValue, code: code.rawValue)
  }

  private func dayInterval() -> DateInterval? {
    Calendar.current.dateInterval(of: .day, for: Date())
  }

  private func formatter() -> ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }

  private func rejectRead(_ invoke: Invoke, _ error: Error) {
    let nativeError = error as NSError
    if nativeError.domain == HKErrorDomain && nativeError.code == HKError.Code.errorAuthorizationDenied.rawValue {
      reject(invoke, .denied)
    } else {
      reject(invoke, .readFailed)
    }
  }

  private func recordAuthorizationError(_ invoke: Invoke, domain: String, code: Int, description: String) {
    let detail: [String: Any] = ["domain": domain, "code": code, "description": String(description.prefix(200))]
    lastError = detail
    // Résolu (et non rejeté) : le détail natif voyage jusqu'à l'écran au lieu de se perdre dans un code générique.
    invoke.resolve(["permission": "error", "error": detail])
  }

  @objc public func status(_ invoke: Invoke) {
    let usage = Bundle.main.object(forInfoDictionaryKey: "NSHealthShareUsageDescription") as? String
    var payload: [String: Any] = [
      "available": HKHealthStore.isHealthDataAvailable(),
      "usageDescription": !(usage ?? "").isEmpty,
    ]
    if let lastError {
      payload["lastError"] = lastError
    }
    invoke.resolve(payload)
  }

  @objc public func authorize(_ invoke: Invoke) {
    guard HKHealthStore.isHealthDataAvailable(),
          let bodyMass = HKObjectType.quantityType(forIdentifier: .bodyMass),
          let stepCount = HKObjectType.quantityType(forIdentifier: .stepCount)
    else {
      reject(invoke, .unavailable)
      return
    }

    store.requestAuthorization(toShare: [], read: [bodyMass, stepCount]) { success, error in
      if let error {
        let native = error as NSError
        self.recordAuthorizationError(invoke, domain: native.domain, code: native.code, description: native.localizedDescription)
        return
      }
      guard success else {
        self.recordAuthorizationError(invoke, domain: "spartiate", code: 0, description: "requestAuthorization a renvoyé success = false sans erreur")
        return
      }
      self.lastError = nil
      // HealthKit does not disclose read permission in this callback.
      invoke.resolve(["permission": "unknown"])
    }
  }

  @objc public func bodyMassToday(_ invoke: Invoke) {
    guard HKHealthStore.isHealthDataAvailable(),
          let interval = dayInterval(),
          let type = HKObjectType.quantityType(forIdentifier: .bodyMass)
    else {
      reject(invoke, .unavailable)
      return
    }

    let predicate = HKQuery.predicateForSamples(
      withStart: interval.start,
      end: interval.end,
      options: .strictStartDate
    )
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
    let query = HKSampleQuery(
      sampleType: type,
      predicate: predicate,
      limit: 1,
      sortDescriptors: [sort]
    ) { _, samples, error in
      if let error {
        self.rejectRead(invoke, error)
        return
      }
      guard let sample = samples?.first as? HKQuantitySample else {
        invoke.resolve(["state": "empty"])
        return
      }
      invoke.resolve([
        "state": "granted",
        "value": [
          "kg": sample.quantity.doubleValue(for: HKUnit.gramUnit(with: .kilo)),
          "measuredAt": self.formatter().string(from: sample.endDate),
          "timezone": TimeZone.current.identifier,
          "uuid": sample.uuid.uuidString,
          "source": [
            "name": sample.sourceRevision.source.name,
            "bundleIdentifier": sample.sourceRevision.source.bundleIdentifier,
          ],
        ],
      ])
    }
    store.execute(query)
  }

  @objc public func stepCountToday(_ invoke: Invoke) {
    guard HKHealthStore.isHealthDataAvailable(),
          let interval = dayInterval(),
          let type = HKObjectType.quantityType(forIdentifier: .stepCount)
    else {
      reject(invoke, .unavailable)
      return
    }

    let predicate = HKQuery.predicateForSamples(
      withStart: interval.start,
      end: interval.end,
      options: .strictStartDate
    )
    let query = HKStatisticsQuery(
      quantityType: type,
      quantitySamplePredicate: predicate,
      options: [.cumulativeSum, .separateBySource]
    ) { _, statistics, error in
      if let error {
        self.rejectRead(invoke, error)
        return
      }
      guard let statistics, let sum = statistics.sumQuantity() else {
        invoke.resolve(["state": "empty"])
        return
      }
      let sources = (statistics.sources ?? []).map { source in
        [
          "name": source.name,
          "bundleIdentifier": source.bundleIdentifier,
          "count": statistics.sumQuantity(for: source)?.doubleValue(for: .count()) ?? 0,
        ] as [String: Any]
      }.sorted { ($0["bundleIdentifier"] as? String ?? "") < ($1["bundleIdentifier"] as? String ?? "") }
      invoke.resolve([
        "state": "granted",
        "value": [
          "count": sum.doubleValue(for: .count()),
          "unit": "count",
          "start": self.formatter().string(from: interval.start),
          "end": self.formatter().string(from: interval.end),
          "timezone": TimeZone.current.identifier,
          "sources": sources,
        ],
      ])
    }
    store.execute(query)
  }
}

@_cdecl("init_plugin_healthkit")
func initPlugin() -> Plugin {
  return HealthKitPlugin()
}
