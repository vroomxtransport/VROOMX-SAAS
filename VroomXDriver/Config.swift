import Foundation

enum Config {
    static let supabaseURL = "YOUR_SUPABASE_URL"
    static let supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY"

    static let appName = "VroomX Driver"
    static let appVersion = "1.0.0"

    static let inspectionMediaBucket = "inspection-media"
    static let receiptsBucket = "receipts"
    static let bolDocumentsBucket = "bol-documents"

    static let keychainService = "com.vroomx.driver"
    static let keychainSessionKey = "supabase_session"
    static let keychainPINKey = "driver_pin"

    static let cachedTripsKey = "cached_trips"
    static let cachedOrdersKey = "cached_orders"
    static let cachedExpensesKey = "cached_expenses"
    static let cachedDriverKey = "cached_driver"
}
