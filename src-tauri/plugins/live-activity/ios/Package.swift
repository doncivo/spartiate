// swift-tools-version:5.3
// Plugin Live Activity de Spartiate (SPA-007) : compilé par build-ios.yml seulement.

import PackageDescription

let package = Package(
  name: "tauri-plugin-live-activity",
  platforms: [
    .iOS("17.0")
  ],
  products: [
    .library(
      name: "tauri-plugin-live-activity",
      type: .static,
      targets: ["tauri-plugin-live-activity"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-live-activity",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
