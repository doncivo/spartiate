// swift-tools-version:5.3
// Plugin apple-intelligence de Spartiate (IOS-029b, essai Foundation Models) : compilé par build-ios.yml seulement.

import PackageDescription

let package = Package(
  name: "tauri-plugin-apple-intelligence",
  platforms: [
    .iOS("17.0")
  ],
  products: [
    .library(
      name: "tauri-plugin-apple-intelligence",
      type: .static,
      targets: ["tauri-plugin-apple-intelligence"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-apple-intelligence",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
