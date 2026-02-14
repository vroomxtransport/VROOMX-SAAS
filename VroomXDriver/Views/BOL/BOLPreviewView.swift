import SwiftUI
import PDFKit
import Supabase

// MARK: - BOL Preview View

/// Full-screen PDF preview for the generated Bill of Lading.
/// Allows the driver to view, email, share, or save the BOL after inspection completion.
struct BOLPreviewView: View {
    let inspectionId: String
    let order: VroomXOrder
    let inspection: VehicleInspection
    let damages: [InspectionDamage]
    let driverSignatureImage: UIImage?
    let customerSignatureImage: UIImage?
    let driverName: String

    @Environment(\.dismiss) private var dismiss

    // MARK: - State

    @State private var pdfData: Data?
    @State private var isGenerating = true
    @State private var errorMessage: String?

    // Email sheet
    @State private var showEmailSheet = false
    @State private var emailAddress: String = ""
    @State private var isSendingEmail = false
    @State private var emailSent = false
    @State private var emailError: String?

    // Share sheet
    @State private var showShareSheet = false

    // Save confirmation
    @State private var showSaveSuccess = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if isGenerating {
                    generatingView
                } else if let pdfData, let document = PDFDocument(data: pdfData) {
                    VStack(spacing: 0) {
                        PDFKitView(document: document)
                            .ignoresSafeArea(edges: .bottom)

                        actionBar
                    }
                } else {
                    errorView
                }
            }
            .navigationTitle("Bill of Lading")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.brandPrimary)
                }
            }
            .sheet(isPresented: $showEmailSheet) {
                emailSheet
            }
            .sheet(isPresented: $showShareSheet) {
                if let pdfData {
                    ShareSheet(items: [pdfData])
                }
            }
            .overlay {
                if showSaveSuccess {
                    successToast
                }
            }
            .task {
                await generateBOL()
            }
        }
    }

    // MARK: - Generating View

    private var generatingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Generating BOL...")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
        }
    }

    // MARK: - Error View

    private var errorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(.brandWarning)
            Text("Failed to generate BOL")
                .font(.vroomxTitleMedium)
                .foregroundColor(.textPrimary)
            if let errorMessage {
                Text(errorMessage)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Button("Try Again") {
                Task { await generateBOL() }
            }
            .font(.vroomxBodyBold)
            .foregroundColor(.brandPrimary)
        }
        .padding()
    }

    // MARK: - Action Bar

    private var actionBar: some View {
        HStack(spacing: 12) {
            // Email BOL
            Button {
                // Pre-fill email from delivery or pickup contact
                if emailAddress.isEmpty {
                    emailAddress = ""
                }
                showEmailSheet = true
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 20))
                    Text("Email")
                        .font(.vroomxCaptionSmall)
                }
                .foregroundColor(.brandPrimary)
                .frame(maxWidth: .infinity)
            }

            // Share
            Button {
                showShareSheet = true
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 20))
                    Text("Share")
                        .font(.vroomxCaptionSmall)
                }
                .foregroundColor(.brandPrimary)
                .frame(maxWidth: .infinity)
            }

            // Save to Files
            Button {
                savePDFToFiles()
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 20))
                    Text("Save")
                        .font(.vroomxCaptionSmall)
                }
                .foregroundColor(.brandPrimary)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.cardBackground)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    // MARK: - Email Sheet

    private var emailSheet: some View {
        NavigationStack {
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Send BOL via Email")
                        .font(.vroomxTitleMedium)
                        .foregroundColor(.textPrimary)

                    Text("Order #\(order.orderNumber ?? "N/A") - \(order.vehicleDescription)")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Email input
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recipient Email")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)

                    TextField("email@example.com", text: $emailAddress)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding(12)
                        .background(Color.cardBackground)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.textSecondary.opacity(0.3), lineWidth: 1)
                        )
                }

                if let emailError {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.brandDanger)
                        Text(emailError)
                            .font(.vroomxCaption)
                            .foregroundColor(.brandDanger)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if emailSent {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.brandSuccess)
                        Text("BOL sent successfully!")
                            .font(.vroomxBodyBold)
                            .foregroundColor(.brandSuccess)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Send button
                Button {
                    Task { await sendEmail() }
                } label: {
                    HStack(spacing: 8) {
                        if isSendingEmail {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "paperplane.fill")
                        }
                        Text(isSendingEmail ? "Sending..." : "Send BOL")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(!emailAddress.isEmpty && !isSendingEmail ? Color.brandPrimary : Color.textSecondary.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(emailAddress.isEmpty || isSendingEmail)

                Spacer()
            }
            .padding(20)
            .background(Color.appBackground)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        showEmailSheet = false
                    }
                    .foregroundColor(.textSecondary)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Success Toast

    private var successToast: some View {
        VStack {
            Spacer()
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.brandSuccess)
                Text("BOL saved to Files")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(Color.cardBackground)
            .cornerRadius(12)
            .shadow(radius: 8)
            .padding(.bottom, 100)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                withAnimation { showSaveSuccess = false }
            }
        }
    }

    // MARK: - Generate BOL

    private func generateBOL() async {
        isGenerating = true
        errorMessage = nil

        // Generate PDF on background thread
        let data = await Task.detached { () -> Data? in
            BOLGenerator.generateBOL(
                order: order,
                pickupInspection: inspection.inspectionType == .pickup ? inspection : nil,
                deliveryInspection: inspection.inspectionType == .delivery ? inspection : nil,
                pickupDamages: inspection.inspectionType == .pickup ? damages : [],
                deliveryDamages: inspection.inspectionType == .delivery ? damages : [],
                driverSignatureImage: driverSignatureImage,
                customerSignatureImage: customerSignatureImage,
                driverName: driverName,
                truckNumber: nil
            )
        }.value

        if let data {
            self.pdfData = data
            print("[BOLPreview] PDF generated: \(data.count) bytes")
        } else {
            errorMessage = "Failed to render PDF. Please try again."
        }

        isGenerating = false
    }

    // MARK: - Send Email

    private func sendEmail() async {
        guard let pdfData, !emailAddress.isEmpty else { return }

        isSendingEmail = true
        emailError = nil
        emailSent = false

        do {
            // 1. Upload PDF to Supabase Storage
            let storagePath = "\(order.id)/BOL-\(order.orderNumber ?? "unknown").pdf"

            try await SupabaseManager.shared.client.storage
                .from(Config.bolDocumentsBucket)
                .upload(
                    storagePath,
                    data: pdfData,
                    options: FileOptions(contentType: "application/pdf", upsert: true)
                )

            print("[BOLPreview] PDF uploaded to storage: \(storagePath)")

            // 2. Create order_attachments record
            let attachmentId = UUID().uuidString
            let now = ISO8601DateFormatter().string(from: Date())

            struct AttachmentInsert: Encodable {
                let id: String
                let tenant_id: String
                let order_id: String
                let file_type: String
                let storage_path: String
                let file_name: String
                let created_at: String
            }

            let attachment = AttachmentInsert(
                id: attachmentId,
                tenant_id: order.tenantId,
                order_id: order.id,
                file_type: "bol_pdf",
                storage_path: storagePath,
                file_name: "BOL-\(order.orderNumber ?? "unknown").pdf",
                created_at: now
            )

            try await SupabaseManager.shared.client
                .from("order_attachments")
                .upsert(attachment)
                .execute()

            print("[BOLPreview] Attachment record created")

            // 3. Invoke Edge Function to send email
            try await SupabaseManager.shared.client.functions.invoke(
                "send-bol-email",
                options: .init(body: [
                    "to": emailAddress,
                    "orderNumber": order.orderNumber ?? "",
                    "pdfStoragePath": storagePath,
                    "tenantName": "VroomX Transport"
                ] as [String: String])
            )

            print("[BOLPreview] Email sent to \(emailAddress)")
            emailSent = true

        } catch {
            print("[BOLPreview] Email send failed: \(error)")
            emailError = "Failed to send email: \(error.localizedDescription)"
        }

        isSendingEmail = false
    }

    // MARK: - Save to Files

    private func savePDFToFiles() {
        guard let pdfData else { return }

        let fileName = "BOL-\(order.orderNumber ?? "unknown").pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try pdfData.write(to: tempURL)

            // Use share sheet with the file URL for save-to-files
            let items: [Any] = [tempURL]
            let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)

            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = scene.windows.first,
               let rootVC = window.rootViewController {
                // Find topmost presented controller
                var topVC = rootVC
                while let presented = topVC.presentedViewController {
                    topVC = presented
                }
                activityVC.popoverPresentationController?.sourceView = topVC.view
                topVC.present(activityVC, animated: true)
            }
        } catch {
            print("[BOLPreview] Failed to save PDF: \(error)")
        }
    }
}

// MARK: - PDFKit View (UIViewRepresentable)

/// Wraps PDFKit's PDFView for SwiftUI display with pinch-to-zoom and scroll.
struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.document = document
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = UIColor.systemGroupedBackground
        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        pdfView.document = document
    }
}

// MARK: - Share Sheet (UIActivityViewController)

/// Wraps UIActivityViewController for SwiftUI.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
