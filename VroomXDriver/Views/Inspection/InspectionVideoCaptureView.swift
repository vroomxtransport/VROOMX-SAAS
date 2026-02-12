import SwiftUI
import AVFoundation
import UIKit

// MARK: - Inspection Video Capture View

/// Step 2 of the inspection flow: record a vehicle walkthrough video.
/// REQUIRED step - driver must record a video before advancing to step 3.
/// Uses AVFoundation camera preview with record/stop controls.
/// Minimum 5 seconds, maximum 5 minutes.
struct InspectionVideoCaptureView: View {
    @Binding var videoRecorded: Bool
    @Binding var videoLocalPath: String?
    @Binding var videoDuration: TimeInterval
    let inspectionId: String

    @StateObject private var cameraModel = VideoCameraModel()
    @State private var showRerecordAlert = false

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if videoRecorded, let path = videoLocalPath {
                // Video recorded - show preview
                videoPreview(path: path)
            } else {
                // Camera capture interface
                cameraInterface
            }
        }
        .onDisappear {
            cameraModel.stopSession()
        }
        .alert("Re-record Video?", isPresented: $showRerecordAlert) {
            Button("Re-record", role: .destructive) {
                deleteCurrentVideo()
                videoRecorded = false
                videoLocalPath = nil
                videoDuration = 0
                cameraModel.startSession()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will delete the current video and start a new recording.")
        }
    }

    // MARK: - Camera Interface

    private var cameraInterface: some View {
        VStack(spacing: 0) {
            // Instructions
            VStack(spacing: 4) {
                Text("Vehicle Walkthrough Video")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                Text("Record a slow walk around the vehicle showing its current condition. Minimum 5 seconds required.")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Camera preview
            ZStack {
                CameraPreviewView(cameraModel: cameraModel)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 16)

                // Recording indicator overlay
                if cameraModel.isRecording {
                    VStack {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 10, height: 10)

                            Text(formatDuration(cameraModel.recordingDuration))
                                .font(.vroomxMono)
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.black.opacity(0.6))
                        .clipShape(Capsule())
                        .padding(.top, 24)

                        Spacer()

                        // Min duration warning
                        if cameraModel.recordingDuration < 5 {
                            Text("Record at least 5 seconds")
                                .font(.vroomxCaption)
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.brandWarning.opacity(0.8))
                                .clipShape(Capsule())
                                .padding(.bottom, 24)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .frame(maxHeight: .infinity)

            // Controls
            VStack(spacing: 12) {
                // Duration limits info
                if !cameraModel.isRecording {
                    Text("Min 5s / Max 5min")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                }

                // Record button
                Button {
                    if cameraModel.isRecording {
                        stopRecording()
                    } else {
                        startRecording()
                    }
                } label: {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 72, height: 72)

                        if cameraModel.isRecording {
                            // Stop icon (rounded square)
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.red)
                                .frame(width: 28, height: 28)
                        } else {
                            // Record icon (red circle)
                            Circle()
                                .fill(Color.red)
                                .frame(width: 60, height: 60)
                        }
                    }
                }

                if cameraModel.isRecording {
                    Text("Tap to stop recording")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                } else {
                    Text("Tap to start recording")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }
            }
            .padding(.vertical, 16)
        }
    }

    // MARK: - Video Preview

    private func videoPreview(path: String) -> some View {
        VStack(spacing: 20) {
            Spacer()

            // Thumbnail with play overlay
            ZStack {
                // Video thumbnail
                if let thumbnail = generateThumbnail(from: path) {
                    Image(uiImage: thumbnail)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.cardBackground)
                        .aspectRatio(16/9, contentMode: .fit)
                        .overlay {
                            Image(systemName: "video.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.textSecondary)
                        }
                }

                // Duration badge
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: "video.fill")
                                .font(.system(size: 10))
                            Text(formatDuration(videoDuration))
                                .font(.vroomxCaptionSmall)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.7))
                        .clipShape(Capsule())
                        .padding(8)
                    }
                }
            }
            .padding(.horizontal, 32)

            // Status
            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.brandSuccess)
                    Text("Video recorded")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.brandSuccess)
                }

                Text(formatDuration(videoDuration) + " walkthrough recorded")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }

            // Re-record button
            Button {
                showRerecordAlert = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Re-record Video")
                }
                .font(.vroomxBodyBold)
                .foregroundColor(.brandPrimary)
                .frame(height: 44)
                .frame(maxWidth: .infinity)
                .background(Color.brandPrimary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal, 32)

            Spacer()
        }
    }

    // MARK: - Recording Actions

    private func startRecording() {
        cameraModel.startRecording(inspectionId: inspectionId)
    }

    private func stopRecording() {
        let duration = cameraModel.recordingDuration

        // Enforce minimum 5-second duration
        guard duration >= 5 else {
            // Keep recording, show warning is already handled in UI
            return
        }

        cameraModel.stopRecording { outputPath in
            guard let outputPath else { return }

            videoLocalPath = outputPath
            videoDuration = duration
            videoRecorded = true

            // Queue upload via InspectionUploadQueue
            let fileURL = URL(fileURLWithPath: outputPath)
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: outputPath)[.size] as? Int) ?? 0

            let uploadItem = UploadItem(
                id: UUID().uuidString,
                inspectionId: inspectionId,
                mediaKind: .video,
                slotKey: "walkthrough",
                localPath: outputPath,
                mimeType: "video/mp4",
                byteSize: fileSize,
                attempts: 0,
                status: .pending,
                lastError: nil,
                nextRetryAt: nil
            )

            Task {
                await InspectionUploadQueue.shared.enqueue(uploadItem)
            }

            print("[InspectionVideo] Saved video to \(outputPath) (\(Int(duration))s, \(fileSize) bytes)")
        }
    }

    private func deleteCurrentVideo() {
        if let path = videoLocalPath {
            try? FileManager.default.removeItem(atPath: path)
        }
    }

    // MARK: - Helpers

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }

    private func generateThumbnail(from path: String) -> UIImage? {
        let url = URL(fileURLWithPath: path)
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 400, height: 400)

        do {
            let cgImage = try generator.copyCGImage(at: .zero, actualTime: nil)
            return UIImage(cgImage: cgImage)
        } catch {
            print("[InspectionVideo] Failed to generate thumbnail: \(error)")
            return nil
        }
    }
}

// MARK: - Video Camera Model

/// ObservableObject managing AVCaptureSession for video recording.
@MainActor
class VideoCameraModel: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var recordingDuration: TimeInterval = 0

    let captureSession = AVCaptureSession()
    private var movieOutput = AVCaptureMovieFileOutput()
    private var recordingTimer: Timer?
    private var recordingStartTime: Date?
    private var outputPath: String?
    private var completionHandler: ((String?) -> Void)?
    private var isSessionRunning = false
    private let maxDuration: TimeInterval = 300 // 5 minutes

    override init() {
        super.init()
        setupSession()
    }

    // MARK: - Session Setup

    private func setupSession() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .high

        // Video input
        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let videoInput = try? AVCaptureDeviceInput(device: videoDevice),
              captureSession.canAddInput(videoInput) else {
            captureSession.commitConfiguration()
            return
        }
        captureSession.addInput(videoInput)

        // Audio input
        if let audioDevice = AVCaptureDevice.default(for: .audio),
           let audioInput = try? AVCaptureDeviceInput(device: audioDevice),
           captureSession.canAddInput(audioInput) {
            captureSession.addInput(audioInput)
        }

        // Movie output
        if captureSession.canAddOutput(movieOutput) {
            captureSession.addOutput(movieOutput)
            movieOutput.maxRecordedDuration = CMTime(seconds: maxDuration, preferredTimescale: 600)
        }

        captureSession.commitConfiguration()
    }

    // MARK: - Session Lifecycle

    func startSession() {
        guard !isSessionRunning else { return }
        Task.detached { [weak self] in
            self?.captureSession.startRunning()
        }
        isSessionRunning = true
    }

    func stopSession() {
        if isRecording {
            movieOutput.stopRecording()
        }
        recordingTimer?.invalidate()
        recordingTimer = nil
        Task.detached { [weak self] in
            self?.captureSession.stopRunning()
        }
        isSessionRunning = false
    }

    // MARK: - Recording

    func startRecording(inspectionId: String) {
        guard !isRecording else { return }

        if !isSessionRunning {
            startSession()
            // Small delay to let session start
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.beginRecording(inspectionId: inspectionId)
            }
        } else {
            beginRecording(inspectionId: inspectionId)
        }
    }

    private func beginRecording(inspectionId: String) {
        let fileName = "\(inspectionId)_walkthrough_\(UUID().uuidString).mp4"
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fileURL = documentsDir.appendingPathComponent(fileName)
        outputPath = fileURL.path

        // Start recording with a non-isolated delegate wrapper
        let delegate = RecordingDelegate { [weak self] url, error in
            Task { @MainActor in
                self?.didFinishRecording(url: url, error: error)
            }
        }
        // Store delegate to prevent deallocation
        self.recordingDelegate = delegate
        movieOutput.startRecording(to: fileURL, recordingDelegate: delegate)

        isRecording = true
        recordingStartTime = Date()
        recordingDuration = 0

        // Timer for duration display
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, let startTime = self.recordingStartTime else { return }
                self.recordingDuration = Date().timeIntervalSince(startTime)

                // Auto-stop at max duration
                if self.recordingDuration >= self.maxDuration {
                    self.movieOutput.stopRecording()
                }
            }
        }
    }

    private var recordingDelegate: RecordingDelegate?

    func stopRecording(completion: @escaping (String?) -> Void) {
        guard isRecording else {
            completion(nil)
            return
        }

        completionHandler = completion
        movieOutput.stopRecording()
    }

    private func didFinishRecording(url: URL?, error: Error?) {
        isRecording = false
        recordingTimer?.invalidate()
        recordingTimer = nil

        if let error {
            print("[VideoCameraModel] Recording failed: \(error)")
            completionHandler?(nil)
        } else {
            completionHandler?(outputPath)
        }
        completionHandler = nil
        recordingDelegate = nil
    }
}

// MARK: - Recording Delegate (non-isolated wrapper)

/// Non-isolated delegate for AVCaptureFileOutputRecordingDelegate conformance.
private class RecordingDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    let onFinish: (URL?, Error?) -> Void

    init(onFinish: @escaping (URL?, Error?) -> Void) {
        self.onFinish = onFinish
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        onFinish(error == nil ? outputFileURL : nil, error)
    }
}

// MARK: - Camera Preview (UIViewRepresentable)

/// UIViewRepresentable wrapping AVCaptureVideoPreviewLayer for live camera preview.
struct CameraPreviewView: UIViewRepresentable {
    @ObservedObject var cameraModel: VideoCameraModel

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.previewLayer.session = cameraModel.captureSession
        view.previewLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black

        // Start the session
        cameraModel.startSession()

        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {}
}

/// UIView subclass that hosts AVCaptureVideoPreviewLayer.
class CameraPreviewUIView: UIView {
    let previewLayer = AVCaptureVideoPreviewLayer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        layer.addSublayer(previewLayer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer.frame = bounds
    }
}
