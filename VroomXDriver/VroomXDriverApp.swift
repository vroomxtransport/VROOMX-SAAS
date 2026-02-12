import SwiftUI

@main
struct VroomXDriverApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var authManager = AuthManager()
    @StateObject private var networkMonitor = NetworkMonitor()
    @StateObject private var notificationManager = NotificationManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .environmentObject(authManager)
                .environmentObject(networkMonitor)
                .environmentObject(notificationManager)
                .preferredColorScheme(themeManager.colorScheme)
                .onAppear {
                    notificationManager.requestPermission()
                }
        }
    }
}
