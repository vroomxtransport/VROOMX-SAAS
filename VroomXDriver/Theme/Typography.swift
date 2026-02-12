import SwiftUI

// MARK: - VroomX Type Scale

extension Font {
    /// Title large: 28pt heavy - used for screen titles, hero numbers
    static let vroomxTitleLarge: Font = .system(size: 28, weight: .heavy)

    /// Title medium: 20pt heavy - used for section headers
    static let vroomxTitleMedium: Font = .system(size: 20, weight: .heavy)

    /// Title: 17pt bold - used for card titles, nav bar
    static let vroomxTitle: Font = .system(size: 17, weight: .bold)

    /// Body: 14pt regular - default body text
    static let vroomxBody: Font = .system(size: 14, weight: .regular)

    /// Body bold: 14pt semibold - emphasized body text, labels
    static let vroomxBodyBold: Font = .system(size: 14, weight: .semibold)

    /// Caption: 12pt medium - secondary labels, metadata
    static let vroomxCaption: Font = .system(size: 12, weight: .medium)

    /// Caption small: 10pt semibold - badges, timestamps
    static let vroomxCaptionSmall: Font = .system(size: 10, weight: .semibold)

    /// Mono: 14pt bold monospaced digits - financial numbers, VINs
    static let vroomxMono: Font = .system(size: 14, weight: .bold).monospacedDigit()
}
