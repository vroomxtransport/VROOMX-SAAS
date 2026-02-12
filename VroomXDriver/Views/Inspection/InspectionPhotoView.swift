import SwiftUI
import UIKit

// MARK: - Inspection Photo View

/// Step 1 of the inspection flow: capture 7 required + 5 optional vehicle photos.
/// Uses UIImagePickerController for camera capture, saves locally and queues
/// upload via InspectionUploadQueue.
struct InspectionPhotoView: View {
    @Binding var capturedPhotos: [PhotoType: CapturedPhoto]
    let inspectionId: String

    @State private var activePhotoType: PhotoType?
    @State private var showCamera = false
    @State private var showFullImage = false
    @State private var fullImageType: PhotoType?

    // MARK: - Photo Slots

    /// Required photo slots that must be captured before advancing.
    private let requiredPhotos: [PhotoType] = [
        .odometer, .front, .left, .right, .rear, .top, .key_vin
    ]

    /// Optional photo slots for additional documentation.
    private let optionalPhotos: [PhotoType] = [
        .custom_1, .custom_2, .custom_3, .custom_4, .custom_5
    ]

    /// Count of required photos captured.
    private var requiredCapturedCount: Int {
        requiredPhotos.filter { capturedPhotos[$0] != nil }.count
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Vehicle Photos")
                        .font(.vroomxTitleMedium)
                        .foregroundColor(.textPrimary)

                    Text("Capture all required photos to continue. Tap a slot to take a photo.")
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                }
                .padding(.horizontal, 16)

                // Required photos progress
                HStack(spacing: 8) {
                    Image(systemName: requiredCapturedCount == requiredPhotos.count ? "checkmark.circle.fill" : "camera.fill")
                        .foregroundColor(requiredCapturedCount == requiredPhotos.count ? .brandSuccess : .brandPrimary)

                    Text("\(requiredCapturedCount)/\(requiredPhotos.count) required photos")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)

                    Spacer()

                    if requiredCapturedCount == requiredPhotos.count {
                        Text("Complete")
                            .font(.vroomxCaptionSmall)
                            .foregroundColor(.brandSuccess)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.brandSuccess.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)

                // Required photos grid
                VStack(alignment: .leading, spacing: 8) {
                    Text("REQUIRED")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                        .padding(.horizontal, 16)

                    LazyVGrid(columns: [
                        GridItem(.flexible(), spacing: 12),
                        GridItem(.flexible(), spacing: 12),
                        GridItem(.flexible(), spacing: 12)
                    ], spacing: 12) {
                        ForEach(requiredPhotos) { photoType in
                            photoSlot(for: photoType, required: true)
                        }
                    }
                    .padding(.horizontal, 16)
                }

                // Optional photos grid
                VStack(alignment: .leading, spacing: 8) {
                    Text("OPTIONAL")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                        .padding(.horizontal, 16)

                    LazyVGrid(columns: [
                        GridItem(.flexible(), spacing: 12),
                        GridItem(.flexible(), spacing: 12),
                        GridItem(.flexible(), spacing: 12)
                    ], spacing: 12) {
                        ForEach(optionalPhotos) { photoType in
                            photoSlot(for: photoType, required: false)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.vertical, 16)
        }
        .fullScreenCover(isPresented: $showCamera) {
            if let photoType = activePhotoType {
                CameraPickerView { image in
                    if let image {
                        savePhoto(image: image, for: photoType)
                    }
                    showCamera = false
                    activePhotoType = nil
                }
                .ignoresSafeArea()
            }
        }
        .fullScreenCover(isPresented: $showFullImage) {
            if let photoType = fullImageType, let photo = capturedPhotos[photoType] {
                PhotoPreviewView(
                    image: photo.thumbnail,
                    photoType: photoType,
                    onRetake: {
                        showFullImage = false
                        fullImageType = nil
                        // Trigger camera after dismissal
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            activePhotoType = photoType
                            showCamera = true
                        }
                    },
                    onDismiss: {
                        showFullImage = false
                        fullImageType = nil
                    }
                )
            }
        }
    }

    // MARK: - Photo Slot

    @ViewBuilder
    private func photoSlot(for photoType: PhotoType, required: Bool) -> some View {
        Button {
            if capturedPhotos[photoType] != nil {
                // Show preview with retake option
                fullImageType = photoType
                showFullImage = true
            } else {
                // Open camera
                activePhotoType = photoType
                showCamera = true
            }
        } label: {
            VStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.cardBackground)
                        .aspectRatio(4/3, contentMode: .fit)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(
                                    capturedPhotos[photoType] != nil
                                        ? Color.brandSuccess
                                        : (required ? Color.brandPrimary.opacity(0.4) : Color.textSecondary.opacity(0.2)),
                                    style: capturedPhotos[photoType] != nil
                                        ? StrokeStyle(lineWidth: 2)
                                        : StrokeStyle(lineWidth: 1.5, dash: [6, 3])
                                )
                        )

                    if let photo = capturedPhotos[photoType] {
                        // Captured - show thumbnail
                        Image(uiImage: photo.thumbnail)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(maxWidth: .infinity)
                            .aspectRatio(4/3, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(alignment: .topTrailing) {
                                uploadStatusBadge(for: photo.uploadStatus)
                                    .padding(4)
                            }
                    } else {
                        // Empty - camera icon
                        VStack(spacing: 4) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 20))
                                .foregroundColor(required ? .brandPrimary : .textSecondary.opacity(0.5))

                            if required {
                                Text("Required")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.brandDanger)
                            }
                        }
                    }
                }

                // Label
                Text(photoSlotLabel(for: photoType))
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.textSecondary)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }

    private func photoSlotLabel(for photoType: PhotoType) -> String {
        switch photoType {
        case .custom_1: return "Additional 1"
        case .custom_2: return "Additional 2"
        case .custom_3: return "Additional 3"
        case .custom_4: return "Additional 4"
        case .custom_5: return "Additional 5"
        default: return photoType.displayName
        }
    }

    // MARK: - Upload Status Badge

    @ViewBuilder
    private func uploadStatusBadge(for status: PhotoUploadStatus) -> some View {
        switch status {
        case .uploaded:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(.brandSuccess)
                .background(Circle().fill(Color.white).frame(width: 14, height: 14))

        case .uploading:
            ProgressView()
                .scaleEffect(0.6)
                .frame(width: 16, height: 16)
                .background(Circle().fill(Color.cardBackground).frame(width: 18, height: 18))

        case .failed:
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(.brandDanger)
                .background(Circle().fill(Color.white).frame(width: 14, height: 14))

        case .pending:
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(.brandWarning)
                .background(Circle().fill(Color.white).frame(width: 14, height: 14))
        }
    }

    // MARK: - Photo Save + Queue Upload

    private func savePhoto(image: UIImage, for photoType: PhotoType) {
        // Compress to 80% JPEG quality
        guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
            print("[InspectionPhoto] Failed to compress image for \(photoType.rawValue)")
            return
        }

        // Save to Documents directory
        let fileName = "\(inspectionId)_\(photoType.rawValue)_\(UUID().uuidString).jpg"
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fileURL = documentsDir.appendingPathComponent(fileName)

        do {
            try jpegData.write(to: fileURL)
        } catch {
            print("[InspectionPhoto] Failed to save photo: \(error)")
            return
        }

        // Generate thumbnail (200px width)
        let thumbnailSize = CGSize(width: 200, height: 200 * image.size.height / image.size.width)
        let thumbnail = UIGraphicsImageRenderer(size: thumbnailSize).image { _ in
            image.draw(in: CGRect(origin: .zero, size: thumbnailSize))
        }

        // Store in local state
        let captured = CapturedPhoto(
            photoType: photoType,
            localPath: fileURL.path,
            thumbnail: thumbnail
        )
        capturedPhotos[photoType] = captured

        // Queue upload via InspectionUploadQueue
        let uploadItem = UploadItem(
            id: captured.id,
            inspectionId: inspectionId,
            mediaKind: .photo,
            slotKey: photoType.rawValue,
            localPath: fileURL.path,
            mimeType: "image/jpeg",
            byteSize: jpegData.count,
            attempts: 0,
            status: .pending,
            lastError: nil,
            nextRetryAt: nil
        )

        Task {
            await InspectionUploadQueue.shared.enqueue(uploadItem)
        }

        print("[InspectionPhoto] Saved \(photoType.rawValue) to \(fileURL.path) (\(jpegData.count) bytes)")
    }
}

// MARK: - Camera Picker (UIImagePickerController Wrapper)

/// UIViewControllerRepresentable wrapper for UIImagePickerController with .camera source.
struct CameraPickerView: UIViewControllerRepresentable {
    let onComplete: (UIImage?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onComplete: onComplete)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator

        // Use camera if available, otherwise fall back to photo library
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
            picker.cameraCaptureMode = .photo
        } else {
            picker.sourceType = .photoLibrary
        }

        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onComplete: (UIImage?) -> Void

        init(onComplete: @escaping (UIImage?) -> Void) {
            self.onComplete = onComplete
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            onComplete(image)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onComplete(nil)
        }
    }
}

// MARK: - Photo Preview View

/// Full-screen photo preview with retake option.
struct PhotoPreviewView: View {
    let image: UIImage
    let photoType: PhotoType
    let onRetake: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black)

                HStack(spacing: 24) {
                    Button {
                        onRetake()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "camera.fill")
                            Text("Retake")
                        }
                        .font(.vroomxBodyBold)
                        .foregroundColor(.brandPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.brandPrimary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button {
                        onDismiss()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark")
                            Text("Keep")
                        }
                        .font(.vroomxBodyBold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.brandSuccess)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.appBackground)
            }
            .navigationTitle(photoType.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        onDismiss()
                    }
                }
            }
        }
    }
}
