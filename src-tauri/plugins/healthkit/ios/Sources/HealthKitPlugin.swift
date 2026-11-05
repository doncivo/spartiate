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

  @objc public func status(_ invoke: Invoke) {
    invoke.resolve(["available": HKHealthStore.isHealthDataAvailable()])
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
      if error != nil {
        self.reject(invoke, .authorizationFailed)
        return
      }
      guard success else {
        self.reject(invoke, .authorizationFailed)
        return
      }
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
      let sources = (statistics.sources() ?? []).map { source in
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
