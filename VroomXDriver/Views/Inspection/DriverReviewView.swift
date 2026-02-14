import SwiftUI
import Supabase

// MARK: - Driver Review View

/// Step 5 of the inspection flow.
/// Presents a read-only summary of all inspection data captured in steps 1-4,
/// then captures the driver's digital signature. On "Sign & Continue",
/// uploads the driver signature to Supabase Storage and advances to step 6.
struct DriverReviewView: View {
    // MARK: - Properties (all read-only except signature)

    let order: VroomXOrder
    let inspectionType: InspectionType
    let inspectionId: String
    let capturedPhotos: [PhotoType: CapturedPhoto]
    let videoRecorded: Bool
    let damages: [LocalDamage]
    let odometerReading: String
    let interiorCondition: InteriorCondition
    let notes: String
    let gpsLatitude: Double?
    let gpsLongitude: Double?
    let gpsAddress: String?

    @Binding var driverSignatureImage: UIImage?

    /// Callback when driver taps "Sign & Continue".
    let onSignAndContinue: () -> Void

    // MARK: - State

    @EnvironmentObject private var authManager: AuthManager
    @State private var isUploading = false
    @State private var errorMessage: String?

    // MARK: - Computed

    /// The current driver's full name, from AuthManager.
    private var driverName: String {
        authManager.currentDriver?.fullName ?? "Driver"
    }

    /// Count of unique views that have damages.
    private var damagedViewCount: Int {
        Set(damages.map(\.view)).count
    }

    /// Grouped damage counts by type.
    private var damageTypeCounts: [(DamageType, Int)] {
        var counts: [DamageType: Int] = [:]
        for damage in damages {
            counts[damage.damageType, default: 0] += 1
        }
        return counts.sorted { $0.key.rawValue < $1.key.rawValue }
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header
                stepHeader

                // Summary sections
                photoSummarySection
                videoSummarySection
                damageSummarySection
                notesSummarySection
                locationSummarySection

                // Driver certification
                certificationSection

                // Signature pad
                signatureSection

                // Sign & Continue button
                signButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .alert("Upload Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            if let errorMessage {
                Text(errorMessage)
            }
        }
    }

    // MARK: - Header

    private var stepHeader: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.brandPrimary)
                Text("Driver Review")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)
                Spacer()
            }
            HStack {
                Text("Step 5 of 6 - Review and sign")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                Spacer()
            }
        }
    }

    // MARK: - Photo Summary

    private var photoSummarySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("\(capturedPhotos.count) photos captured", systemImage: "camera.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            // Thumbnail strip
            if !capturedPhotos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(capturedPhotos.values).sorted(by: { $0.photoType.rawValue < $1.photoType.rawValue })) { photo in
                            VStack(spacing: 4) {
                                Image(uiImage: photo.thumbnail)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 60, height: 60)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))

                                Text(photo.photoType.displayName)
                                    .font(.vroomxCaptionSmall)
                                    .foregroundColor(.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Video Summary

    private var videoSummarySection: some View {
        HStack(spacing: 10) {
            Image(systemName: videoRecorded ? "video.fill" : "video.slash.fill")
                .foregroundColor(videoRecorded ? .brandSuccess : .textSecondary)
            Text(videoRecorded ? "Walkthrough video recorded" : "No video recorded")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)
            Spacer()
            if videoRecorded {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.brandSuccess)
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Damage Summary

    private var damageSummarySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if damages.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(.brandSuccess)
                    Text("No damages marked")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)
                    Spacer()
                }
            } else {
                Label("\(damages.count) damages marked across \(damagedViewCount) view\(damagedViewCount == 1 ? "" : "s")", systemImage: "exclamationmark.triangle.fill")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandWarning)

                // Damage type breakdown
                ForEach(damageTypeCounts, id: \.0) { type, count in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(type.color)
                            .frame(width: 8, height: 8)
                        Text("\(type.displayName): \(count)")
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Notes Summary

    private var notesSummarySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Condition Notes", systemImage: "doc.text.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Odometer")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                    Text(odometerReading.isEmpty ? "Not entered" : "\(odometerReading) mi")
                        .font(.vroomxMono)
                        .foregroundColor(.textPrimary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Interior")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                    HStack(spacing: 4) {
                        Image(systemName: interiorCondition.icon)
                            .foregroundColor(interiorCondition.color)
                            .font(.vroomxCaption)
                        Text(interiorCondition.rawValue)
                            .font(.vroomxBodyBold)
                            .foregroundColor(interiorCondition.color)
                    }
                }
            }

            if !notes.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Notes")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                    Text(notes)
                        .font(.vroomxBody)
                        .foregroundColor(.textPrimary)
                        .lineLimit(4)
                }
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Location Summary

    private var locationSummarySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("GPS Location", systemImage: "location.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            if let lat = gpsLatitude, let lng = gpsLongitude {
                if let address = gpsAddress {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundColor(.brandPrimary)
                        Text(address)
                            .font(.vroomxBody)
                            .foregroundColor(.textPrimary)
                            .lineLimit(2)
                    }
                }
                HStack(spacing: 16) {
                    Text(String(format: "%.6f, %.6f", lat, lng))
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }
            } else {
                Text("No GPS coordinates captured")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Certification

    private var certificationSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Driver Certification", systemImage: "shield.checkered")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Text("I, \(driverName), certify that the above inspection accurately reflects the condition of the vehicle at the time of \(inspectionType.displayName.lowercased()).")
                .font(.vroomxBody)
                .foregroundColor(.textPrimary)
                .italic()
                .padding(12)
                .background(Color.brandPrimary.opacity(0.05))
                .cornerRadius(8)
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Signature

    private var signatureSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Driver Signature", systemImage: "signature")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            SignaturePadView(signatureImage: $driverSignatureImage)
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Sign Button

    private var signButton: some View {
        Button {
            Task {
                await signAndContinue()
            }
        } label: {
            HStack(spacing: 8) {
                if isUploading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "signature")
                }
                Text("Sign & Continue")
            }
            .font(.vroomxBodyBold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(driverSignatureImage != nil && !isUploading ? Color.brandPrimary : Color.textSecondary.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(driverSignatureImage == nil || isUploading)
        .padding(.bottom, 8)
    }

    // MARK: - Actions

    /// Uploads driver signature to Supabase Storage and advances to step 6.
    private func signAndContinue() async {
        guard let signatureImage = driverSignatureImage else { return }
        guard !inspectionId.isEmpty else {
            errorMessage = "Inspection not initialized."
            return
        }

        isUploading = true
        defer { isUploading = false }

        // Upload driver signature to Supabase Storage
        do {
            guard let imageData = signatureImage.pngData() else {
                errorMessage = "Failed to encode signature image."
                return
            }

            let storagePath = "\(inspectionId)/driver_signature.png"

            try await SupabaseManager.shared.client.storage
                .from(Config.inspectionMediaBucket)
                .upload(
                    storagePath,
                    data: imageData,
                    options: FileOptions(contentType: "image/png", upsert: true)
                )

            // Update the inspection record with driver signature URL
            try await SupabaseManager.shared.client
                .from("vehicle_inspections")
                .update([
                    "driver_signature_url": AnyJSON.string(storagePath),
                    "updated_at": AnyJSON.string(ISO8601DateFormatter().string(from: Date()))
                ])
                .eq("id", value: inspectionId)
                .execute()

            print("[DriverReview] Driver signature uploaded: \(storagePath)")
            onSignAndContinue()
        } catch {
            print("[DriverReview] Signature upload failed: \(error)")
            // Still allow advancement even if upload fails (offline resilience)
            // Signature will be uploaded during final save in CustomerSignOffView
            errorMessage = nil
            onSignAndContinue()
        }
    }
}

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var signatureImage: UIImage?

        var body: some View {
            NavigationStack {
                DriverReviewView(
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
                        deliveryLocation: "456 Oak Ave",
                        deliveryCity: "Houston",
                        deliveryState: "TX",
                        deliveryZip: "77001",
                        deliveryContactName: "Jane",
                        deliveryContactPhone: "555-0200",
                        deliveryDate: nil,
                        actualPickupDate: nil,
                        actualDeliveryDate: nil,
                        pickupEta: nil,
                        deliveryEta: nil,
                        revenue: 1500,
                        carrierPay: 1200,
                        brokerFee: nil,
                        paymentType: .COD,
                        paymentStatus: nil,
                        invoiceDate: nil,
                        amountPaid: nil,
                        notes: nil,
                        createdAt: "",
                        updatedAt: ""
                    ),
                    inspectionType: .pickup,
                    inspectionId: "test-inspection",
                    capturedPhotos: [:],
                    videoRecorded: true,
                    damages: [],
                    odometerReading: "45230",
                    interiorCondition: .good,
                    notes: "Vehicle in good condition. Minor scratch on rear bumper.",
                    gpsLatitude: 32.7767,
                    gpsLongitude: -96.7970,
                    gpsAddress: "123 Main St Dallas TX 75201",
                    driverSignatureImage: $signatureImage,
                    onSignAndContinue: {}
                )
            }
        }
    }

    return PreviewWrapper()
}
