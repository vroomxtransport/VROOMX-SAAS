import Foundation
import Supabase
import Realtime
import Combine

/// Centralized data layer for the VroomX Driver app.
/// Handles Supabase fetching, local caching, Realtime subscriptions,
/// and offline-aware mutations.
@MainActor
final class DataManager: ObservableObject {
    /// Shared singleton instance.
    static let shared = DataManager()

    // MARK: - Published State

    @Published var trips: [VroomXTrip] = []
    @Published var orders: [VroomXOrder] = []
    @Published var expenses: [VroomXExpense] = []
    @Published var notifications: [DriverNotification] = []
    @Published var isLoading: Bool = false

    // MARK: - Private State

    private var driverId: String?
    private var realtimeChannel: RealtimeChannelV2?
    private var networkCancellable: AnyCancellable?

    private let supabase = SupabaseManager.shared.client
    private let cache = CacheManager.shared

    private init() {}

    // MARK: - Configuration

    /// Configure the data manager for the authenticated driver.
    /// Stores the driver ID, loads cached data, fetches fresh data, and starts Realtime.
    func configure(driverId: String) {
        self.driverId = driverId

        // Load cached data immediately for instant UI
        loadCachedData()

        // Fetch fresh data from server
        Task {
            await fetchAll()
        }

        // Start Realtime subscriptions
        Task {
            await startRealtime()
        }

        // Listen for network reconnection to process pending queue
        networkCancellable = NetworkMonitor.shared.$isConnected
            .removeDuplicates()
            .filter { $0 == true }
            .sink { [weak self] _ in
                Task {
                    await PendingActionsQueue.shared.processQueue()
                    await self?.fetchAll()
                }
            }
    }

    /// Tear down subscriptions and clear state. Call on logout.
    func teardown() {
        driverId = nil
        networkCancellable?.cancel()
        networkCancellable = nil

        Task {
            await stopRealtime()
        }

        trips = []
        orders = []
        expenses = []
        notifications = []
        isLoading = false
    }

    // MARK: - Fetch All

    /// Fetch all data sets in parallel.
    func fetchAll() async {
        isLoading = true
        defer { isLoading = false }

        async let tripsTask: () = fetchTrips()
        async let ordersTask: () = fetchOrders()
        async let notificationsTask: () = fetchNotifications()

        _ = await (tripsTask, ordersTask, notificationsTask)
    }

    // MARK: - Fetch Methods

    /// Fetch trips for the current driver, ordered by start_date desc.
    /// RLS handles tenant isolation automatically.
    func fetchTrips() async {
        guard let driverId else { return }

        do {
            let result: [VroomXTrip] = try await supabase
                .from("trips")
                .select()
                .eq("driver_id", value: driverId)
                .order("start_date", ascending: false)
                .execute()
                .value

            trips = result
            cache.save(result, forKey: Config.cachedTripsKey)
        } catch {
            print("[DataManager] fetchTrips failed: \(error)")
            // Fallback to cache
            if trips.isEmpty, let cached = cache.load(forKey: Config.cachedTripsKey, as: [VroomXTrip].self) {
                trips = cached
            }
        }
    }

    /// Fetch orders for the current driver, ordered by created_at desc.
    func fetchOrders() async {
        guard let driverId else { return }

        do {
            let result: [VroomXOrder] = try await supabase
                .from("orders")
                .select()
                .eq("driver_id", value: driverId)
                .order("created_at", ascending: false)
                .execute()
                .value

            orders = result
            cache.save(result, forKey: Config.cachedOrdersKey)
        } catch {
            print("[DataManager] fetchOrders failed: \(error)")
            if orders.isEmpty, let cached = cache.load(forKey: Config.cachedOrdersKey, as: [VroomXOrder].self) {
                orders = cached
            }
        }
    }

    /// Fetch orders belonging to a specific trip.
    func fetchOrdersForTrip(tripId: String) async -> [VroomXOrder] {
        do {
            let result: [VroomXOrder] = try await supabase
                .from("orders")
                .select()
                .eq("trip_id", value: tripId)
                .order("created_at", ascending: false)
                .execute()
                .value

            return result
        } catch {
            print("[DataManager] fetchOrdersForTrip failed: \(error)")
            return []
        }
    }

    /// Fetch expenses for a specific trip.
    func fetchExpenses(tripId: String) async -> [VroomXExpense] {
        do {
            let result: [VroomXExpense] = try await supabase
                .from("trip_expenses")
                .select()
                .eq("trip_id", value: tripId)
                .order("expense_date", ascending: false)
                .execute()
                .value

            expenses = result
            cache.save(result, forKey: Config.cachedExpensesKey)
            return result
        } catch {
            print("[DataManager] fetchExpenses failed: \(error)")
            if let cached = cache.load(forKey: Config.cachedExpensesKey, as: [VroomXExpense].self) {
                expenses = cached
                return cached
            }
            return []
        }
    }

    /// Fetch notifications for the current driver, ordered by created_at desc.
    func fetchNotifications() async {
        guard let driverId else { return }

        do {
            let result: [DriverNotification] = try await supabase
                .from("driver_notifications")
                .select()
                .eq("driver_id", value: driverId)
                .order("created_at", ascending: false)
                .execute()
                .value

            notifications = result
        } catch {
            print("[DataManager] fetchNotifications failed: \(error)")
        }
    }

    // MARK: - Mutation Methods

    /// Update order status. Sets actual_pickup_date or actual_delivery_date timestamps as appropriate.
    func updateOrderStatus(orderId: String, status: OrderStatus) async throws {
        var updates: [String: AnyJSON] = [
            "status": .string(status.rawValue),
            "updated_at": .string(ISO8601DateFormatter().string(from: Date()))
        ]

        // Set timestamps based on status transition
        switch status {
        case .picked_up:
            updates["actual_pickup_date"] = .string(ISO8601DateFormatter().string(from: Date()))
        case .delivered:
            updates["actual_delivery_date"] = .string(ISO8601DateFormatter().string(from: Date()))
        default:
            break
        }

        if NetworkMonitor.shared.isConnected {
            try await supabase
                .from("orders")
                .update(updates)
                .eq("id", value: orderId)
                .execute()

            await fetchOrders()
        } else {
            let payload = try JSONEncoder().encode(OrderStatusPayload(orderId: orderId, status: status))
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "updateOrderStatus",
                    payload: payload,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
            // Optimistic update
            if let index = orders.firstIndex(where: { $0.id == orderId }) {
                await fetchOrders() // Will show cached data if offline
            }
        }
    }

    /// Submit ETA for an order (pickup and/or delivery).
    func submitETA(orderId: String, pickupETA: Date?, deliveryETA: Date?) async throws {
        let formatter = ISO8601DateFormatter()
        var updates: [String: AnyJSON] = [
            "updated_at": .string(formatter.string(from: Date()))
        ]

        if let pickupETA {
            updates["pickup_eta"] = .string(formatter.string(from: pickupETA))
        }
        if let deliveryETA {
            updates["delivery_eta"] = .string(formatter.string(from: deliveryETA))
        }

        if NetworkMonitor.shared.isConnected {
            try await supabase
                .from("orders")
                .update(updates)
                .eq("id", value: orderId)
                .execute()

            await fetchOrders()
        } else {
            let payload = try JSONEncoder().encode(ETAPayload(orderId: orderId, pickupETA: pickupETA, deliveryETA: deliveryETA))
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "submitETA",
                    payload: payload,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
        }
    }

    /// Create a new trip expense.
    func createExpense(_ expense: ExpenseCreate) async throws {
        if NetworkMonitor.shared.isConnected {
            try await supabase
                .from("trip_expenses")
                .insert(expense)
                .execute()

            _ = await fetchExpenses(tripId: expense.tripId)
        } else {
            let payload = try JSONEncoder().encode(expense)
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "createExpense",
                    payload: payload,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
        }
    }

    /// Delete a trip expense by ID.
    func deleteExpense(id: String) async throws {
        if NetworkMonitor.shared.isConnected {
            try await supabase
                .from("trip_expenses")
                .delete()
                .eq("id", value: id)
                .execute()

            // Refresh expenses for the trip if we have one loaded
            if let expense = expenses.first(where: { $0.id == id }) {
                _ = await fetchExpenses(tripId: expense.tripId)
            }
        } else {
            let payload = try JSONEncoder().encode(["id": id])
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "deleteExpense",
                    payload: payload,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
            // Optimistic removal
            expenses.removeAll { $0.id == id }
        }
    }

    /// Mark a notification as read by setting read_at to now.
    func markNotificationRead(id: String) async throws {
        let updates: [String: AnyJSON] = [
            "read_at": .string(ISO8601DateFormatter().string(from: Date()))
        ]

        if NetworkMonitor.shared.isConnected {
            try await supabase
                .from("driver_notifications")
                .update(updates)
                .eq("id", value: id)
                .execute()

            await fetchNotifications()
        } else {
            let payload = try JSONEncoder().encode(["id": id])
            await PendingActionsQueue.shared.enqueue(
                PendingAction(
                    id: UUID(),
                    actionType: "markNotificationRead",
                    payload: payload,
                    createdAt: Date(),
                    attempts: 0,
                    lastError: nil
                )
            )
        }
    }

    // MARK: - Realtime

    /// Subscribe to Realtime changes for orders, trips, and notifications.
    private func startRealtime() async {
        guard let driverId else { return }

        let channel = supabase.realtimeV2.channel("driver-updates")

        // Listen for order changes for this driver
        let orderChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "orders",
            filter: "driver_id=eq.\(driverId)"
        )

        // Listen for trip changes for this driver
        let tripChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "trips",
            filter: "driver_id=eq.\(driverId)"
        )

        // Listen for notification changes for this driver
        let notificationChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "driver_notifications",
            filter: "driver_id=eq.\(driverId)"
        )

        realtimeChannel = channel

        await channel.subscribe()

        // Process order changes
        Task { [weak self] in
            for await _ in orderChanges {
                await self?.fetchOrders()
            }
        }

        // Process trip changes
        Task { [weak self] in
            for await _ in tripChanges {
                await self?.fetchTrips()
            }
        }

        // Process notification changes
        Task { [weak self] in
            for await _ in notificationChanges {
                await self?.fetchNotifications()
            }
        }
    }

    /// Unsubscribe from Realtime channel.
    private func stopRealtime() async {
        if let channel = realtimeChannel {
            await supabase.realtimeV2.removeChannel(channel)
        }
        realtimeChannel = nil
    }

    // MARK: - Cache

    /// Load cached data for instant display on launch.
    private func loadCachedData() {
        if let cachedTrips = cache.load(forKey: Config.cachedTripsKey, as: [VroomXTrip].self) {
            trips = cachedTrips
        }
        if let cachedOrders = cache.load(forKey: Config.cachedOrdersKey, as: [VroomXOrder].self) {
            orders = cachedOrders
        }
        if let cachedExpenses = cache.load(forKey: Config.cachedExpensesKey, as: [VroomXExpense].self) {
            expenses = cachedExpenses
        }
    }
}

// MARK: - Mutation Payloads

/// Payload for queued order status mutations.
struct OrderStatusPayload: Codable {
    let orderId: String
    let status: OrderStatus
}

/// Payload for queued ETA mutations.
struct ETAPayload: Codable {
    let orderId: String
    let pickupETA: Date?
    let deliveryETA: Date?
}
