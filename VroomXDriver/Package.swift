// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VroomXDriver",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.41.0"),
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.2"),
    ],
    targets: [
        .executableTarget(
            name: "VroomXDriver",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
            ],
            path: ".",
            exclude: ["Info.plist", "Package.resolved"],
            sources: ["Config.swift", "VroomXDriverApp.swift", "Core", "Models", "Views", "Theme"]
        ),
    ]
)
