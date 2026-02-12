import SwiftUI
import PhotosUI
import Supabase

/// Full trip detail view showing route, status workflow, financial summary,
/// orders list, expenses with CRUD, and receipt photo upload.
struct TripDetailView: View {
    let trip: VroomXTrip

    @ObservedObject private var dataManager = DataManager.shared
    @State private var tripOrders: [VroomXOrder] = []
    @State private var tripExpenses: [VroomXExpense] = []
    @State private var isLoadingDetail = true
    @State private var showAddExpense = false
    @State private var receiptPreviewURL: String?
    @State private var showReceiptPreview = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                OfflineBanner()

                // Header
                headerSection

                // Route
                routeSection

                // Status workflow
                statusWorkflowSection

                // Financial summary
                financialSummaryCard

                // Orders
                ordersSection

                // Expenses
                expensesSection

                // Notes
                if let notes = trip.notes, !notes.isEmpty {
                    notesSection(notes: notes)
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color.appBackground)
        .navigationTitle(trip.tripNumber ?? "Trip Detail")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadTripDetails()
        }
        .refreshable {
            await loadTripDetails()
        }
        .sheet(isPresented: $showAddExpense) {
            AddExpenseSheet(
                trip: trip,
                onSave: {
                    Task { await loadTripDetails() }
                }
            )
        }
        .sheet(isPresented: $showReceiptPreview) {
            if let url = receiptPreviewURL {
                ReceiptPreviewSheet(storagePath: url)
            }
        }
    }

    // MARK: - Load Data

    private func loadTripDetails() async {
        isLoadingDetail = true
        async let orders = dataManager.fetchOrdersForTrip(tripId: trip.id)
        async let expenses = dataManager.fetchExpenses(tripId: trip.id)
        tripOrders = await orders
        tripExpenses = await expenses
        isLoadingDetail = false
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(trip.tripNumber ?? "Trip")
                    .font(.vroomxTitleLarge)
                    .foregroundColor(.textPrimary)

                Spacer()

                TripStatusBadge(status: trip.status)
            }

            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 13))
                    .foregroundColor(.textSecondary)

                Text(trip.dateRange)
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Route

    private var routeSection: some View {
        HStack(spacing: 12) {
            Image(systemName: "map.fill")
                .font(.system(size: 20))
                .foregroundColor(.brandPrimary)

            VStack(alignment: .leading, spacing: 4) {
                if let origin = trip.originSummary {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.brandSuccess)
                            .frame(width: 8, height: 8)
                        Text(origin)
                            .font(.vroomxBody)
                            .foregroundColor(.textPrimary)
                    }
                }
                if let destination = trip.destinationSummary {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.brandDanger)
                            .frame(width: 8, height: 8)
                        Text(destination)
                            .font(.vroomxBody)
                            .foregroundColor(.textPrimary)
                    }
                }
            }

            Spacer()
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Status Workflow

    private var statusWorkflowSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Status")
                .font(.vroomxBodyBold)
                .foregroundColor(.textSecondary)

            StatusProgressBar(currentStatus: trip.status)
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Financial Summary

    private var financialSummaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Financial Summary")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                FinancialMetricRow(
                    label: "Total Revenue",
                    value: formatCurrency(trip.totalRevenue),
                    color: .textPrimary
                )
                FinancialMetricRow(
                    label: "Carrier Pay",
                    value: formatCurrency(trip.carrierPay),
                    color: .textPrimary
                )
                FinancialMetricRow(
                    label: "Broker Fees",
                    value: formatCurrency(trip.totalBrokerFees),
                    color: .textSecondary
                )
                // Driver Pay - emphasized
                FinancialMetricRow(
                    label: "Driver Pay",
                    value: formatCurrency(trip.driverPay),
                    color: .brandPrimary,
                    isEmphasized: true
                )
                FinancialMetricRow(
                    label: "Total Expenses",
                    value: formatCurrency(trip.totalExpenses),
                    color: .brandWarning
                )
                FinancialMetricRow(
                    label: "Net Profit",
                    value: formatCurrency(trip.netProfit),
                    color: (trip.netProfit ?? 0) >= 0 ? .brandSuccess : .brandDanger
                )
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.brandPrimary.opacity(0.2), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Orders Section

    private var ordersSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Orders (\(tripOrders.count))")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .padding(.horizontal, 16)

            if isLoadingDetail && tripOrders.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(.brandPrimary)
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if tripOrders.isEmpty {
                HStack {
                    Spacer()
                    Text("No orders assigned to this trip")
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                    Spacer()
                }
                .padding(.vertical, 20)
            } else {
                ForEach(tripOrders) { order in
                    TripOrderCard(order: order)
                        .padding(.horizontal, 16)
                }
            }
        }
    }

    // MARK: - Expenses Section

    private var expensesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Expenses (\(tripExpenses.count))")
                    .font(.vroomxTitle)
                    .foregroundColor(.textPrimary)

                Spacer()

                Button {
                    showAddExpense = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 14))
                        Text("Add Expense")
                            .font(.vroomxCaption)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.brandPrimary)
                }
            }
            .padding(.horizontal, 16)

            if tripExpenses.isEmpty {
                HStack {
                    Spacer()
                    Text("No expenses recorded")
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                    Spacer()
                }
                .padding(.vertical, 16)
            } else {
                ForEach(tripExpenses) { expense in
                    ExpenseRow(
                        expense: expense,
                        onTapReceipt: { url in
                            receiptPreviewURL = url
                            showReceiptPreview = true
                        },
                        onDelete: {
                            Task {
                                try? await dataManager.deleteExpense(id: expense.id)
                                await loadTripDetails()
                            }
                        }
                    )
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    // MARK: - Notes Section

    private func notesSection(notes: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notes")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            Text(notes)
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }
}

// MARK: - Status Progress Bar

/// Visual progress bar showing the trip status workflow: planned -> in_progress -> at_terminal -> completed
struct StatusProgressBar: View {
    let currentStatus: TripStatus

    private let steps: [TripStatus] = [.planned, .in_progress, .at_terminal, .completed]

    private var currentIndex: Int {
        steps.firstIndex(of: currentStatus) ?? 0
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element) { index, step in
                VStack(spacing: 6) {
                    // Circle indicator
                    ZStack {
                        Circle()
                            .fill(index <= currentIndex ? step.color : Color.textSecondary.opacity(0.2))
                            .frame(width: 28, height: 28)

                        if index < currentIndex {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else if index == currentIndex {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 10, height: 10)
                        }
                    }

                    Text(step.displayName)
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(index <= currentIndex ? .textPrimary : .textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)

                // Connector line
                if index < steps.count - 1 {
                    Rectangle()
                        .fill(index < currentIndex ? step.color : Color.textSecondary.opacity(0.2))
                        .frame(height: 2)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 20) // Align with circles
                }
            }
        }
    }
}

// MARK: - Financial Metric Row

/// A single financial metric label + value pair in the 2-column grid.
private struct FinancialMetricRow: View {
    let label: String
    let value: String
    let color: Color
    var isEmphasized: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)

            Text(value)
                .font(isEmphasized ? .vroomxTitleMedium : .vroomxMono)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            isEmphasized
                ? Color.brandPrimary.opacity(0.08)
                : Color.clear
        )
        .cornerRadius(8)
    }
}

// MARK: - Trip Order Card (inline)

/// Inline order card for trip detail. Shows vehicle, route, status.
/// Used because OrderCardView may not exist from parallel agent yet.
struct TripOrderCard: View {
    let order: VroomXOrder

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: order number + status
            HStack {
                Text(order.orderNumber ?? "Order")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)

                Spacer()

                Text(order.status.displayName)
                    .font(.vroomxCaptionSmall)
                    .fontWeight(.bold)
                    .foregroundColor(order.status.color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(order.status.color.opacity(0.15))
                    .clipShape(Capsule())
            }

            // Vehicle
            HStack(spacing: 6) {
                Image(systemName: "car.fill")
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                Text(order.vehicleDescription)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }

            // Route: pickup -> delivery
            HStack(spacing: 6) {
                Image(systemName: "arrow.triangle.swap")
                    .font(.system(size: 11))
                    .foregroundColor(.textSecondary)

                Text(orderRoute)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                    .lineLimit(1)
            }

            // Revenue
            if let revenue = order.revenue {
                HStack {
                    Spacer()
                    Text(formatCurrency(revenue))
                        .font(.vroomxMono)
                        .foregroundColor(.brandSuccess)
                }
            }
        }
        .padding(12)
        .background(Color.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
    }

    private var orderRoute: String {
        let pickup = [order.pickupCity, order.pickupState]
            .compactMap { $0 }
            .joined(separator: ", ")
        let delivery = [order.deliveryCity, order.deliveryState]
            .compactMap { $0 }
            .joined(separator: ", ")
        if pickup.isEmpty && delivery.isEmpty {
            return "Route not set"
        }
        return "\(pickup.isEmpty ? "TBD" : pickup) \u{2192} \(delivery.isEmpty ? "TBD" : delivery)"
    }
}

// MARK: - Expense Row

/// A row displaying an expense with category icon, label, amount, date, and receipt indicator.
/// Supports swipe-to-delete.
struct ExpenseRow: View {
    let expense: VroomXExpense
    let onTapReceipt: (String) -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Category icon
            Image(systemName: expense.category.icon)
                .font(.system(size: 18))
                .foregroundColor(.brandPrimary)
                .frame(width: 36, height: 36)
                .background(Color.brandPrimary.opacity(0.1))
                .clipShape(Circle())

            // Details
            VStack(alignment: .leading, spacing: 3) {
                Text(expense.customLabel ?? expense.category.displayName)
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)

                if let date = expense.expenseDate {
                    Text(formatExpenseDate(date))
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.textSecondary)
                }

                if let notes = expense.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Receipt indicator
            if let receiptUrl = expense.receiptUrl, !receiptUrl.isEmpty {
                Button {
                    onTapReceipt(receiptUrl)
                } label: {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.brandAccent)
                }
            }

            // Amount
            Text(formatCurrency(expense.amount))
                .font(.vroomxMono)
                .foregroundColor(.textPrimary)
        }
        .padding(12)
        .background(Color.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .contextMenu {
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete Expense", systemImage: "trash")
            }
        }
    }

    private func formatExpenseDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateString) else {
            return dateString
        }
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"
        return displayFormatter.string(from: date)
    }
}

// MARK: - Add Expense Sheet

/// Sheet for creating a new expense with category, amount, notes, date, and optional receipt photo.
struct AddExpenseSheet: View {
    let trip: VroomXTrip
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var category: ExpenseCategory = .fuel
    @State private var amount: String = ""
    @State private var notes: String = ""
    @State private var expenseDate: Date = Date()
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var receiptImage: UIImage?
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showCamera = false

    var body: some View {
        NavigationStack {
            Form {
                // Category picker
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(ExpenseCategory.allCases) { cat in
                            HStack {
                                Image(systemName: cat.icon)
                                Text(cat.displayName)
                            }
                            .tag(cat)
                        }
                    }
                    .pickerStyle(.menu)
                }

                // Amount
                Section("Amount") {
                    TextField("0.00", text: $amount)
                        .keyboardType(.decimalPad)
                        .font(.vroomxMono)
                }

                // Date
                Section("Date") {
                    DatePicker("Expense Date", selection: $expenseDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                }

                // Notes
                Section("Notes") {
                    TextField("Optional notes...", text: $notes)
                        .font(.vroomxBody)
                }

                // Receipt photo
                Section("Receipt Photo") {
                    if let receiptImage {
                        Image(uiImage: receiptImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 200)
                            .cornerRadius(8)
                            .onTapGesture {
                                self.receiptImage = nil
                                self.selectedPhoto = nil
                            }

                        Text("Tap to remove")
                            .font(.vroomxCaptionSmall)
                            .foregroundColor(.textSecondary)
                    } else {
                        HStack(spacing: 16) {
                            // Camera
                            Button {
                                showCamera = true
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 20))
                                    Text("Camera")
                                        .font(.vroomxCaptionSmall)
                                }
                                .foregroundColor(.brandPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.brandPrimary.opacity(0.08))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)

                            // Photo library
                            PhotosPicker(
                                selection: $selectedPhoto,
                                matching: .images,
                                photoLibrary: .shared()
                            ) {
                                VStack(spacing: 6) {
                                    Image(systemName: "photo.on.rectangle")
                                        .font(.system(size: 20))
                                    Text("Library")
                                        .font(.vroomxCaptionSmall)
                                }
                                .foregroundColor(.brandPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.brandPrimary.opacity(0.08))
                                .cornerRadius(10)
                            }
                        }
                    }
                }

                // Error
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.vroomxCaption)
                            .foregroundColor(.brandDanger)
                    }
                }
            }
            .navigationTitle("Add Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await saveExpense() }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(.brandPrimary)
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving || amount.isEmpty)
                }
            }
            .onChange(of: selectedPhoto) { _, newValue in
                Task {
                    if let newValue,
                       let data = try? await newValue.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        receiptImage = image
                    }
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView(image: $receiptImage)
                    .ignoresSafeArea()
            }
        }
    }

    // MARK: - Save Expense

    private func saveExpense() async {
        guard let amountValue = Double(amount), amountValue > 0 else {
            errorMessage = "Please enter a valid amount"
            return
        }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: expenseDate)

        var receiptPath: String?

        // Upload receipt photo if present
        if let receiptImage {
            do {
                receiptPath = try await uploadReceipt(image: receiptImage)
            } catch {
                // If offline, save locally and queue upload
                if !NetworkMonitor.shared.isConnected {
                    receiptPath = saveReceiptLocally(image: receiptImage)
                } else {
                    errorMessage = "Failed to upload receipt: \(error.localizedDescription)"
                    return
                }
            }
        }

        let expense = ExpenseCreate(
            tenantId: trip.tenantId,
            tripId: trip.id,
            category: category,
            customLabel: nil,
            amount: amountValue,
            notes: notes.isEmpty ? nil : notes,
            expenseDate: dateString,
            receiptUrl: receiptPath
        )

        do {
            try await DataManager.shared.createExpense(expense)
            onSave()
            dismiss()
        } catch {
            errorMessage = "Failed to save expense: \(error.localizedDescription)"
        }
    }

    // MARK: - Receipt Upload

    /// Uploads a receipt image to Supabase Storage `receipts` bucket.
    /// Path: {tenantId}/{tripId}/{uuid}.jpg
    /// Returns the storage path on success.
    private func uploadReceipt(image: UIImage) async throws -> String {
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw ReceiptUploadError.compressionFailed
        }

        let fileName = UUID().uuidString
        let storagePath = "\(trip.tenantId)/\(trip.id)/\(fileName).jpg"

        try await SupabaseManager.shared.client.storage
            .from(Config.receiptsBucket)
            .upload(
                storagePath,
                data: imageData,
                options: FileOptions(contentType: "image/jpeg", upsert: true)
            )

        return storagePath
    }

    /// Saves receipt image locally when offline. Returns the local file path.
    private func saveReceiptLocally(image: UIImage) -> String {
        let fileName = UUID().uuidString + ".jpg"
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let receiptDir = documentsDir.appendingPathComponent("receipts", isDirectory: true)

        try? FileManager.default.createDirectory(at: receiptDir, withIntermediateDirectories: true)

        let filePath = receiptDir.appendingPathComponent(fileName)

        if let data = image.jpegData(compressionQuality: 0.8) {
            try? data.write(to: filePath)
        }

        return filePath.path
    }
}

/// Errors specific to receipt upload.
enum ReceiptUploadError: LocalizedError {
    case compressionFailed

    var errorDescription: String? {
        switch self {
        case .compressionFailed:
            return "Failed to compress receipt image"
        }
    }
}

// MARK: - Camera View (UIImagePickerController wrapper)

/// UIKit camera wrapper for SwiftUI. Allows taking a photo with the device camera.
struct CameraView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let uiImage = info[.originalImage] as? UIImage {
                parent.image = uiImage
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - Receipt Preview Sheet

/// Full-screen preview for a receipt photo loaded from Supabase Storage or local cache.
struct ReceiptPreviewSheet: View {
    let storagePath: String
    @Environment(\.dismiss) private var dismiss
    @State private var receiptImage: UIImage?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else if let receiptImage {
                    Image(uiImage: receiptImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } else if let errorMessage {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 36))
                            .foregroundColor(.brandWarning)
                        Text(errorMessage)
                            .font(.vroomxBody)
                            .foregroundColor(.white)
                    }
                }
            }
            .navigationTitle("Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .task {
            await loadReceipt()
        }
    }

    private func loadReceipt() async {
        isLoading = true
        defer { isLoading = false }

        // Check if it's a local file path
        if storagePath.hasPrefix("/") {
            let fileURL = URL(fileURLWithPath: storagePath)
            if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
                receiptImage = image
                return
            }
        }

        // Load from Supabase Storage
        do {
            let data = try await SupabaseManager.shared.client.storage
                .from(Config.receiptsBucket)
                .download(path: storagePath)

            if let image = UIImage(data: data) {
                receiptImage = image
            } else {
                errorMessage = "Could not decode receipt image"
            }
        } catch {
            errorMessage = "Failed to load receipt: \(error.localizedDescription)"
        }
    }
}

#Preview {
    NavigationStack {
        TripDetailView(trip: VroomXTrip(
            id: "1",
            tenantId: "t1",
            tripNumber: "TRP-2024-001",
            driverId: "d1",
            truckId: "tr1",
            status: .in_progress,
            startDate: "2024-01-15",
            endDate: "2024-01-20",
            carrierPay: 3500.0,
            totalRevenue: 4200.0,
            totalBrokerFees: 420.0,
            driverPay: 2800.0,
            totalExpenses: 350.0,
            netProfit: 1030.0,
            orderCount: 3,
            originSummary: "Dallas, TX",
            destinationSummary: "Houston, TX",
            notes: "Handle with care - classic vehicles",
            createdAt: "2024-01-14T10:00:00Z",
            updatedAt: "2024-01-15T14:30:00Z"
        ))
    }
}
