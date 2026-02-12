import SwiftUI

@main
struct VroomXDriverApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var authManager = AuthManager()
    @StateObject private var networkMonitor = NetworkMonitor()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .environmentObject(authManager)
                .environmentObject(networkMonitor)
                .preferredColorScheme(themeManager.colorScheme)
        }
    }
}
