import SwiftUI
import Supabase

// MARK: - Customer Sign Off View

/// Step 6 substep 2: Customer captures signature and completes the inspection.
/// On "Sign & Complete":
/// 1. Uploads customer signature to Supabase Storage
/// 2. Saves ALL inspection data to the database (vehicle_inspections, inspection_photos,
///    inspection_damages, inspection_videos)
/// 3. Sets inspection status to 'completed' with completed_at timestamp
/// 4. Triggers BOL navigation (Plan 10 wiring)
struct CustomerSignOffView: View {
    // MARK: - Properties

    let order: VroomXOrder
    let inspectionId: String
    let inspectionType: InspectionType

    // All inspection data from previous steps
    let capturedPhotos: [PhotoType: CapturedPhoto]
    let videoRecorded: Bool
    let videoLocalPath: String?
    let videoDuration: TimeInterval
    let damages: [LocalDamage]
    let odometerReading: String
    let interiorCondition: InteriorCondition
    let notes: String
    let gpsLatitude: Double?
    let gpsLongitude: Double?
    let gpsAddress: String?
    let driverSignatureImage: UIImage?
    let customerName: String
    let customerNotes: String

    @Binding var customerSignatureImage: UIImage?

    /// Callback when inspection is fully completed. Passes the completed inspection ID.
    let onComplete: (String) -> Void

    // MARK: - State

    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var saveProgress: String = ""

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header
                headerSection

                // Certification text
                certificationSection

                // Signature pad
                signatureSection

                // Save status
                if isSaving {
                    saveProgressSection
                }

                // Error message
                if let errorMessage {
                    errorSection(errorMessage)
                }

                // Sign & Complete button
                completeButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: "signature")
                    .font(.system(size: 20))
                    .foregroundColor(.brandAccent)
                Text("Customer Signature")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)
                Spacer()
            }
            HStack {
                Text("Step 6 of 6 - Sign to complete inspection")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                Spacer()
            }
        }
    }

    // MARK: - Certification

    private var certificationSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Customer Acknowledgment", systemImage: "doc.plaintext.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Text("I, \(customerName), acknowledge the vehicle condition as described in this inspection report.")
                .font(.vroomxBody)
                .foregroundColor(.textPrimary)
                .italic()
                .padding(12)
                .background(Color.brandAccent.opacity(0.05))
                .cornerRadius(8)

            // Vehicle summary line
            HStack(spacing: 8) {
                Image(systemName: "car.fill")
                    .foregroundColor(.textSecondary)
                Text(order.vehicleDescription)
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)
            }
            .padding(.top, 4)
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Signature

    private var signatureSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Customer Signature", systemImage: "hand.draw.fill")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            SignaturePadView(signatureImage: $customerSignatureImage)
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Save Progress

    private var saveProgressSection: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text(saveProgress)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandPrimary.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Error Section

    private func errorSection(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.brandWarning)
            Text(message)
                .font(.vroomxCaption)
                .foregroundColor(.brandWarning)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandWarning.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Complete Button

    private var completeButton: some View {
        Button {
            Task {
                await signAndComplete()
            }
        } label: {
            HStack(spacing: 8) {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "checkmark.seal.fill")
                }
                Text("Sign & Complete")
            }
            .font(.vroomxBodyBold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(customerSignatureImage != nil && !isSaving ? Color.brandSuccess : Color.textSecondary.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(customerSignatureImage == nil || isSaving)
        .padding(.bottom, 8)
    }

    // MARK: - Save All Inspection Data

    /// Saves ALL inspection data to Supabase:
    /// 1. Upload customer signature
    /// 2. Update vehicle_inspections record
    /// 3. Insert inspection_photos records
    /// 4. Insert inspection_damages records
    /// 5. Insert inspection_videos record
    /// 6. Set status='completed'
    private func signAndComplete() async {
        guard let signatureImage = customerSignatureImage else { return }
        guard !inspectionId.isEmpty else {
            errorMessage = "Inspection not initialized."
            return
        }

        isSaving = true
        errorMessage = nil

        let supabase = SupabaseManager.shared.client
        let formatter = ISO8601DateFormatter()
        let now = formatter.string(from: Date())

        do {
            // 1. Upload customer signature
            saveProgress = "Uploading customer signature..."
            var customerSignatureUrl: String?

            if let imageData = signatureImage.pngData() {
                let storagePath = "\(inspectionId)/customer_signature.png"

                try await supabase.storage
                    .from(Config.inspectionMediaBucket)
                    .upload(
                        storagePath,
                        data: imageData,
                        options: FileOptions(contentType: "image/png", upsert: true)
                    )

                customerSignatureUrl = storagePath
                print("[CustomerSignOff] Customer signature uploaded: \(storagePath)")
            }

            // 2. Re-upload driver signature if it wasn't uploaded in step 5
            saveProgress = "Verifying driver signature..."
            var driverSignatureUrl: String?

            if let driverSig = driverSignatureImage, let driverData = driverSig.pngData() {
                let driverPath = "\(inspectionId)/driver_signature.png"
                try await supabase.storage
                    .from(Config.inspectionMediaBucket)
                    .upload(
                        driverPath,
                        data: driverData,
                        options: FileOptions(contentType: "image/png", upsert: true)
                    )
                driverSignatureUrl = driverPath
            }

            // 3. Insert inspection_photos records
            saveProgress = "Saving photo records..."
            for (photoType, photo) in capturedPhotos {
                let photoRecord = InspectionPhotoInsert(
                    id: photo.id,
                    tenant_id: order.tenantId,
                    inspection_id: inspectionId,
                    photo_type: photoType.rawValue,
                    storage_path: photo.localPath, // Will be updated by InspectionUploadQueue
                    thumbnail_path: nil,
                    upload_status: "pending",
                    created_at: now
                )

                try await supabase
                    .from("inspection_photos")
                    .upsert(photoRecord)
                    .execute()
            }
            print("[CustomerSignOff] \(capturedPhotos.count) photo records saved")

            // 4. Insert inspection_damages records
            saveProgress = "Saving damage records..."
            for damage in damages {
                let damageRecord = InspectionDamageInsert(
                    id: damage.id,
                    tenant_id: order.tenantId,
                    inspection_id: inspectionId,
                    damage_type: damage.damageType.rawValue,
                    view: damage.view,
                    x_position: damage.xPosition,
                    y_position: damage.yPosition,
                    description: damage.description,
                    created_at: now
                )

                try await supabase
                    .from("inspection_damages")
                    .upsert(damageRecord)
                    .execute()
            }
            print("[CustomerSignOff] \(damages.count) damage records saved")

            // 5. Insert inspection_videos record (if video was captured)
            if videoRecorded, let videoPath = videoLocalPath {
                saveProgress = "Saving video record..."
                let videoId = UUID().uuidString
                let videoRecord = InspectionVideoInsert(
                    id: videoId,
                    tenant_id: order.tenantId,
                    inspection_id: inspectionId,
                    storage_path: videoPath, // Will be updated by InspectionUploadQueue
                    duration_seconds: Int(videoDuration),
                    upload_status: "pending",
                    created_at: now
                )

                try await supabase
                    .from("inspection_videos")
                    .upsert(videoRecord)
                    .execute()

                print("[CustomerSignOff] Video record saved")
            }

            // 6. Update vehicle_inspections with all data and mark completed
            saveProgress = "Completing inspection..."

            var updates: [String: AnyJSON] = [
                "status": .string(InspectionStatus.completed.rawValue),
                "completed_at": .string(now),
                "updated_at": .string(now),
                "interior_condition": .string(interiorCondition.rawValue),
                "notes": .string(notes),
                "customer_name": .string(customerName),
            ]

            // Odometer reading (integer)
            if let odometer = Int(odometerReading) {
                updates["odometer_reading"] = .integer(odometer)
            }

            // GPS coordinates
            if let lat = gpsLatitude {
                updates["gps_latitude"] = .double(lat)
            }
            if let lng = gpsLongitude {
                updates["gps_longitude"] = .double(lng)
            }
            if let address = gpsAddress {
                updates["gps_address"] = .string(address)
            }

            // Signature URLs
            if let driverUrl = driverSignatureUrl {
                updates["driver_signature_url"] = .string(driverUrl)
            }
            if let customerUrl = customerSignatureUrl {
                updates["customer_signature_url"] = .string(customerUrl)
            }

            // Customer notes (optional)
            if !customerNotes.isEmpty {
                updates["customer_notes"] = .string(customerNotes)
            }

            try await supabase
                .from("vehicle_inspections")
                .update(updates)
                .eq("id", value: inspectionId)
                .execute()

            print("[CustomerSignOff] Inspection \(inspectionId) marked as completed")

            isSaving = false
            onComplete(inspectionId)

        } catch {
            print("[CustomerSignOff] Save failed: \(error)")

            // Offline handling: queue the save for later
            if !NetworkMonitor.shared.isConnected {
                await queueOfflineSave()
                errorMessage = "Inspection saved locally. It will sync when you're back online."
                isSaving = false
                // Still complete the flow
                onComplete(inspectionId)
            } else {
                errorMessage = "Failed to save inspection: \(error.localizedDescription). Please try again."
                isSaving = false
            }
        }
    }

    // MARK: - Offline Queueing

    /// Queues the inspection completion for offline processing.
    private func queueOfflineSave() async {
        let payload = InspectionCompletePayload(
            inspectionId: inspectionId,
            orderId: order.id,
            tenantId: order.tenantId,
            odometerReading: Int(odometerReading),
            interiorCondition: interiorCondition.rawValue,
            notes: notes,
            gpsLatitude: gpsLatitude,
            gpsLongitude: gpsLongitude,
            gpsAddress: gpsAddress,
            customerName: customerName,
            customerNotes: customerNotes.isEmpty ? nil : customerNotes,
            photoCount: capturedPhotos.count,
            damageCount: damages.count,
            videoRecorded: videoRecorded
        )

        do {
            let data = try JSONEncoder().encode(payload)
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "completeInspection",
                    payload: data,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
            print("[CustomerSignOff] Inspection completion queued for offline sync")
        } catch {
            print("[CustomerSignOff] Failed to queue offline save: \(error)")
        }
    }
}

// MARK: - Insert Payloads

/// Payload for inserting a photo record into inspection_photos table.
private struct InspectionPhotoInsert: Encodable {
    let id: String
    let tenant_id: String
    let inspection_id: String
    let photo_type: String
    let storage_path: String
    let thumbnail_path: String?
    let upload_status: String
    let created_at: String
}

/// Payload for inserting a damage record into inspection_damages table.
private struct InspectionDamageInsert: Encodable {
    let id: String
    let tenant_id: String
    let inspection_id: String
    let damage_type: String
    let view: String
    let x_position: Double
    let y_position: Double
    let description: String?
    let created_at: String
}

/// Payload for inserting a video record into inspection_videos table.
private struct InspectionVideoInsert: Encodable {
    let id: String
    let tenant_id: String
    let inspection_id: String
    let storage_path: String
    let duration_seconds: Int?
    let upload_status: String
    let created_at: String
}

/// Payload for queueing inspection completion offline.
struct InspectionCompletePayload: Codable {
    let inspectionId: String
    let orderId: String
    let tenantId: String
    let odometerReading: Int?
    let interiorCondition: String
    let notes: String
    let gpsLatitude: Double?
    let gpsLongitude: Double?
    let gpsAddress: String?
    let customerName: String
    let customerNotes: String?
    let photoCount: Int
    let damageCount: Int
    let videoRecorded: Bool
}

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var signatureImage: UIImage?

        var body: some View {
            NavigationStack {
                CustomerSignOffView(
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
                        pickupLocation: nil,
                        pickupCity: nil,
                        pickupState: nil,
                        pickupZip: nil,
                        pickupContactName: nil,
                        pickupContactPhone: nil,
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
                    inspectionId: "test-inspection",
                    inspectionType: .pickup,
                    capturedPhotos: [:],
                    videoRecorded: false,
                    videoLocalPath: nil,
                    videoDuration: 0,
                    damages: [],
                    odometerReading: "45230",
                    interiorCondition: .good,
                    notes: "Vehicle in good condition.",
                    gpsLatitude: 32.7767,
                    gpsLongitude: -96.7970,
                    gpsAddress: "123 Main St Dallas TX 75201",
                    driverSignatureImage: nil,
                    customerName: "Jane Smith",
                    customerNotes: "",
                    customerSignatureImage: $signatureImage,
                    onComplete: { _ in }
                )
            }
        }
    }

    return PreviewWrapper()
}
