import SwiftUI

// MARK: - Hex Color Initializer

extension Color {
    /// Creates a `Color` from a hex string (e.g. "#3B82F6" or "3B82F6").
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b, a: UInt64
        switch hex.count {
        case 6: // RGB (e.g. "3B82F6")
            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)
        case 8: // ARGB (e.g. "FF3B82F6")
            (r, g, b, a) = (int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF, int >> 24)
        default:
            (r, g, b, a) = (0, 0, 0, 255)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - VroomX Brand Colors

extension Color {
    // MARK: Primary / Accent

    /// Deep blue primary - dark: #3B82F6, light: #2563EB
    static let brandPrimary = Color(
        light: Color(hex: "2563EB"),
        dark: Color(hex: "3B82F6")
    )

    /// Violet accent - dark: #8B5CF6, light: #7C3AED
    static let brandAccent = Color(
        light: Color(hex: "7C3AED"),
        dark: Color(hex: "8B5CF6")
    )

    // MARK: Semantic

    /// Green success - dark: #22C55E, light: #16A34A
    static let brandSuccess = Color(
        light: Color(hex: "16A34A"),
        dark: Color(hex: "22C55E")
    )

    /// Amber warning - dark: #F59E0B, light: #D97706
    static let brandWarning = Color(
        light: Color(hex: "D97706"),
        dark: Color(hex: "F59E0B")
    )

    /// Red danger - dark: #EF4444, light: #DC2626
    static let brandDanger = Color(
        light: Color(hex: "DC2626"),
        dark: Color(hex: "EF4444")
    )

    // MARK: Backgrounds

    /// App background - dark: #09090B, light: #F8FAFC
    static let appBackground = Color(
        light: Color(hex: "F8FAFC"),
        dark: Color(hex: "09090B")
    )

    /// Card/surface background - dark: #18181B, light: #FFFFFF
    static let cardBackground = Color(
        light: Color(hex: "FFFFFF"),
        dark: Color(hex: "18181B")
    )

    // MARK: Text

    /// Primary text - dark: #FAFAFA, light: #0F172A
    static let textPrimary = Color(
        light: Color(hex: "0F172A"),
        dark: Color(hex: "FAFAFA")
    )

    /// Secondary text - dark: #A1A1AA, light: #64748B
    static let textSecondary = Color(
        light: Color(hex: "64748B"),
        dark: Color(hex: "A1A1AA")
    )
}

// MARK: - Adaptive Color Helper

extension Color {
    /// Creates an adaptive color that switches between light and dark variants
    /// based on the current color scheme.
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(dark)
                : UIColor(light)
        })
    }
}
