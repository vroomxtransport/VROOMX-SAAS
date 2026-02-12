import SwiftUI

/// Button that displays the current ETA or allows setting a new one.
/// Tap to open a DatePicker sheet for selecting date and time.
/// On confirm, calls DataManager.submitETA.
struct ETAButton: View {
    let orderId: String
    let etaType: ETAType
    let currentETA: String?

    @State private var showingDatePicker = false
    @State private var selectedDate = Date()
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        Button {
            if let currentETA, let parsed = parseISO(currentETA) {
                selectedDate = parsed
            } else {
                // Default to 2 hours from now for new ETAs
                selectedDate = Date().addingTimeInterval(7200)
            }
            showingDatePicker = true
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 12, weight: .medium))

                if let currentETA, let parsed = parseISO(currentETA) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(etaType.label) ETA")
                            .font(.vroomxCaptionSmall)
                            .foregroundColor(.textSecondary)
                        Text(Self.displayFormatter.string(from: parsed))
                            .font(.vroomxCaption)
                            .foregroundColor(.brandPrimary)
                    }
                } else {
                    Text("Set \(etaType.label) ETA")
                        .font(.vroomxCaption)
                        .foregroundColor(.brandPrimary)
                }

                if currentETA != nil {
                    Image(systemName: "pencil")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.textSecondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.brandPrimary.opacity(0.1))
            .cornerRadius(8)
        }
        .disabled(isSubmitting)
        .opacity(isSubmitting ? 0.6 : 1)
        .sheet(isPresented: $showingDatePicker) {
            ETADatePickerSheet(
                etaType: etaType,
                selectedDate: $selectedDate,
                isSubmitting: isSubmitting,
                onConfirm: submitETA,
                onCancel: { showingDatePicker = false }
            )
            .presentationDetents([.medium])
        }
    }

    // MARK: - Submit

    private func submitETA() {
        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                let pickupETA: Date? = etaType == .pickup ? selectedDate : nil
                let deliveryETA: Date? = etaType == .delivery ? selectedDate : nil

                try await DataManager.shared.submitETA(
                    orderId: orderId,
                    pickupETA: pickupETA,
                    deliveryETA: deliveryETA
                )

                await MainActor.run {
                    isSubmitting = false
                    showingDatePicker = false
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    // MARK: - Date Parsing

    private func parseISO(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: string) {
            return date
        }

        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - ETA Type

/// Distinguishes pickup vs delivery ETA.
enum ETAType {
    case pickup
    case delivery

    var label: String {
        switch self {
        case .pickup: return "Pickup"
        case .delivery: return "Delivery"
        }
    }
}

// MARK: - ETA Date Picker Sheet

/// Modal sheet with a DatePicker for selecting ETA date and time.
private struct ETADatePickerSheet: View {
    let etaType: ETAType
    @Binding var selectedDate: Date
    let isSubmitting: Bool
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Set \(etaType.label) ETA")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                DatePicker(
                    "ETA",
                    selection: $selectedDate,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)
                .tint(.brandPrimary)

                Spacer()

                Button {
                    onConfirm()
                } label: {
                    HStack {
                        if isSubmitting {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                                .scaleEffect(0.8)
                        }
                        Text(isSubmitting ? "Submitting..." : "Confirm ETA")
                            .font(.vroomxBodyBold)
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.brandPrimary)
                    .cornerRadius(12)
                }
                .disabled(isSubmitting)
            }
            .padding(20)
            .background(Color.appBackground)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onCancel()
                    }
                    .foregroundColor(.textSecondary)
                }
            }
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        ETAButton(
            orderId: "order-1",
            etaType: .pickup,
            currentETA: nil
        )

        ETAButton(
            orderId: "order-1",
            etaType: .delivery,
            currentETA: "2024-03-17T14:30:00Z"
        )
    }
    .padding()
}
