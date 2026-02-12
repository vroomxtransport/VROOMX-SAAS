import SwiftUI

/// Manages app-wide theme state (dark/light mode).
/// Inject as `@EnvironmentObject` in the app entry point.
final class ThemeManager: ObservableObject {
    /// Persisted dark mode preference. Dark mode is the default.
    @AppStorage("appTheme") var isDarkMode: Bool = true

    /// Returns the current SwiftUI `ColorScheme` based on user preference.
    var colorScheme: ColorScheme {
        isDarkMode ? .dark : .light
    }

    /// Toggles between dark and light mode.
    func toggle() {
        isDarkMode.toggle()
    }
}
