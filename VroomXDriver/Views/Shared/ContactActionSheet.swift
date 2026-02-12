import SwiftUI
import UIKit

/// Contact display with action buttons for call, SMS, and copy to clipboard.
/// Shows name and phone, with three horizontal action buttons.
/// Gracefully hides entirely if phone is nil.
struct ContactActionSheet: View {
    let name: String?
    let phone: String?

    @State private var showCopiedFeedback = false

    var body: some View {
        if let phone, !phone.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                // Contact name
                if let name, !name.isEmpty {
                    Text(name)
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)
                }

                // Phone number
                Text(phone)
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)

                // Action buttons
                HStack(spacing: 12) {
                    // Call
                    ContactButton(
                        icon: "phone.fill",
                        label: "Call",
                        color: .brandSuccess
                    ) {
                        callPhone(phone)
                    }

                    // SMS
                    ContactButton(
                        icon: "message.fill",
                        label: "SMS",
                        color: .brandPrimary
                    ) {
                        sendSMS(phone)
                    }

                    // Copy
                    ContactButton(
                        icon: showCopiedFeedback ? "checkmark" : "doc.on.doc",
                        label: showCopiedFeedback ? "Copied" : "Copy",
                        color: showCopiedFeedback ? .brandSuccess : .textSecondary
                    ) {
                        copyToClipboard(phone)
                    }
                }
            }
            .padding(12)
            .background(Color.appBackground.opacity(0.5))
            .cornerRadius(10)
        }
    }

    // MARK: - Actions

    private func callPhone(_ number: String) {
        let cleaned = number.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")

        if let url = URL(string: "tel:\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }

    private func sendSMS(_ number: String) {
        let cleaned = number.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")

        if let url = URL(string: "sms:\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }

    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        // Show feedback briefly
        withAnimation(.easeInOut(duration: 0.2)) {
            showCopiedFeedback = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeInOut(duration: 0.2)) {
                showCopiedFeedback = false
            }
        }
    }
}

// MARK: - Contact Button

/// Small icon button for contact actions (call, SMS, copy).
private struct ContactButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(color)

                Text(label)
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.textSecondary)
            }
            .frame(width: 56, height: 48)
            .background(color.opacity(0.1))
            .cornerRadius(8)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        ContactActionSheet(name: "John Doe", phone: "555-123-4567")
        ContactActionSheet(name: nil, phone: "555-987-6543")
        ContactActionSheet(name: "No Phone", phone: nil)
    }
    .padding()
    .background(Color.cardBackground)
}
