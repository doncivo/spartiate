// swift-tools-version:5.3
// Plugin HealthKit de Spartiate (SPA-006) : compilé par build-ios.yml seulement.

import PackageDescription

let package = Package(
  name: "tauri-plugin-healthkit",
  platforms: [
    .iOS("17.0")
  ],
  products: [
    .library(
      name: "tauri-plugin-healthkit",
      type: .static,
      targets: ["tauri-plugin-healthkit"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-healthkit",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
