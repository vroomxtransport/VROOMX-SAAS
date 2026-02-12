import SwiftUI

// MARK: - Customer Review View

/// Step 6 substep 1: Customer reviews the vehicle condition before signing.
/// Displays a simplified summary of inspection data, captures customer name
/// and optional notes, then provides "Proceed to Sign" button.
struct CustomerReviewView: View {
    // MARK: - Properties

    let order: VroomXOrder
    let capturedPhotos: [PhotoType: CapturedPhoto]
    let damages: [LocalDamage]
    let odometerReading: String

    @Binding var customerName: String
    @Binding var customerNotes: String

    /// Callback when customer taps "Proceed to Sign".
    let onProceedToSign: () -> Void

    // MARK: - Computed

    /// Whether the customer can proceed (name is required).
    private var canProceed: Bool {
        !customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Count of unique views that have damages.
    private var damagedViewCount: Int {
        Set(damages.map(\.view)).count
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Hand device instruction
                handDeviceCard

                // Vehicle description
                vehicleInfoSection

                // Photo thumbnails
                photoThumbnailSection

                // Damage summary
                damageSummarySection

                // Odometer
                odometerSection

                // Customer info
                customerInfoSection

                // Proceed button
                proceedButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    // MARK: - Hand Device Card

    private var handDeviceCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "iphone.and.arrow.right.outward")
                .font(.system(size: 24))
                .foregroundColor(.brandAccent)

            VStack(alignment: .leading, spacing: 2) {
                Text("Hand Device to Customer")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)
                Text("The customer should review the vehicle condition and sign below.")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandAccent.opacity(0.08))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.brandAccent.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Vehicle Info

    private var vehicleInfoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Vehicle", systemImage: "car.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Text(order.vehicleDescription)
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            if let vin = order.vehicleVin, !vin.isEmpty {
                HStack(spacing: 4) {
                    Text("VIN:")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                    Text(vin)
                        .font(.vroomxMono)
                        .foregroundColor(.textPrimary)
                }
            }

            if let color = order.vehicleColor, !color.isEmpty {
                HStack(spacing: 4) {
                    Text("Color:")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                    Text(color)
                        .font(.vroomxBody)
                        .foregroundColor(.textPrimary)
                }
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Photo Thumbnails

    private var photoThumbnailSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("\(capturedPhotos.count) Inspection Photos", systemImage: "photo.stack.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            if !capturedPhotos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(capturedPhotos.values).sorted(by: { $0.photoType.rawValue < $1.photoType.rawValue })) { photo in
                            Image(uiImage: photo.thumbnail)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 72, height: 72)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.vertical, 4)
                }
            } else {
                Text("No photos available")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Damage Summary

    private var damageSummarySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if damages.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.brandSuccess)
                    Text("No pre-existing damages noted")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)
                    Spacer()
                }
            } else {
                Label("Pre-existing Damages", systemImage: "exclamationmark.triangle.fill")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandWarning)

                Text("\(damages.count) damage\(damages.count == 1 ? "" : "s") marked across \(damagedViewCount) view\(damagedViewCount == 1 ? "" : "s")")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)

                // Damage list
                ForEach(damages) { damage in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(damage.damageType.color)
                            .frame(width: 8, height: 8)
                        Text("\(damage.damageType.displayName) - \(damage.view)")
                            .font(.vroomxCaption)
                            .foregroundColor(.textPrimary)
                        if let desc = damage.description, !desc.isEmpty {
                            Text("(\(desc))")
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Odometer

    private var odometerSection: some View {
        HStack(spacing: 10) {
            Image(systemName: "gauge.with.dots.needle.33percent")
                .foregroundColor(.brandPrimary)
            Text("Odometer:")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)
            Text(odometerReading.isEmpty ? "Not recorded" : "\(odometerReading) mi")
                .font(.vroomxMono)
                .foregroundColor(.textPrimary)
            Spacer()
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Customer Info

    private var customerInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Customer Information", systemImage: "person.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            // Customer name (required)
            VStack(alignment: .leading, spacing: 4) {
                Text("Name *")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)

                TextField("Enter customer name", text: $customerName)
                    .font(.vroomxBody)
                    .padding(12)
                    .background(Color.appBackground)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(
                                customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? Color.brandDanger.opacity(0.3)
                                    : Color.textSecondary.opacity(0.2),
                                lineWidth: 1
                            )
                    )

                if customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Customer name is required before signing")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.brandDanger)
                }
            }

            // Customer notes (optional)
            VStack(alignment: .leading, spacing: 4) {
                Text("Notes (optional)")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)

                TextField("Any additional notes or comments", text: $customerNotes)
                    .font(.vroomxBody)
                    .padding(12)
                    .background(Color.appBackground)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1)
                    )
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Proceed Button

    private var proceedButton: some View {
        Button {
            onProceedToSign()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "signature")
                Text("Proceed to Sign")
            }
            .font(.vroomxBodyBold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(canProceed ? Color.brandAccent : Color.textSecondary.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(!canProceed)
        .padding(.bottom, 8)
    }
}

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var name = ""
        @State private var notes = ""

        var body: some View {
            NavigationStack {
                CustomerReviewView(
                    order: VroomXOrder(
                        id: "test-order",
                        tenantId: "test-tenant",
                        orderNumber: "ORD-001",
                        brokerId: nil,
                        driverId: nil,
                        tripId: nil,
                        vehicleVin: "1HGBH41JXMN109186",
                        vehicleYear: 2024,
                        vehicleMake: "Toyota",
                        vehicleModel: "Camry",
                        vehicleType: "sedan",
                        vehicleColor: "Silver",
                        status: .picked_up,
                        cancelledReason: nil,
                        pickupLocation: "123 Main St",
                        pickupCity: "Dallas",
                        pickupState: "TX",
                        pickupZip: "75201",
                        pickupContactName: "John",
                        pickupContactPhone: "555-0100",
                        pickupDate: nil,
                        deliveryLocation: nil,
                        deliveryCity: nil,
                        deliveryState: nil,
                        deliveryZip: nil,
                        deliveryContactName: nil,
                        deliveryContactPhone: nil,
                        deliveryDate: nil,
                        actualPickupDate: nil,
                        actualDeliveryDate: nil,
                        pickupEta: nil,
                        deliveryEta: nil,
                        revenue: nil,
                        carrierPay: nil,
                        brokerFee: nil,
                        paymentType: nil,
                        paymentStatus: nil,
                        invoiceDate: nil,
                        amountPaid: nil,
                        notes: nil,
                        createdAt: "",
                        updatedAt: ""
                    ),
                    capturedPhotos: [:],
                    damages: [],
                    odometerReading: "45230",
                    customerName: $name,
                    customerNotes: $notes,
                    onProceedToSign: {}
                )
            }
        }
    }

    return PreviewWrapper()
}
