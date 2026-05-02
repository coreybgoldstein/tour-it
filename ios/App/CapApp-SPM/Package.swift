// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapApp-SPM", targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", branch: "8.3.0"),
        .package(url: "https://github.com/ionic-team/capacitor-plugins.git", branch: "@capacitor/camera@8.0.2")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCamera", package: "capacitor-plugins"),
                .product(name: "CapacitorGeolocation", package: "capacitor-plugins"),
                .product(name: "CapacitorPushNotifications", package: "capacitor-plugins"),
                .product(name: "CapacitorSplashScreen", package: "capacitor-plugins"),
                .product(name: "CapacitorStatusBar", package: "capacitor-plugins")
            ]
        )
    ]
)