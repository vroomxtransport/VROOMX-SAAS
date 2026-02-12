import Foundation

/// Matches VroomX `trip_expenses` table (migration 00003 + 00006 receipt_url).
struct VroomXExpense: Codable, Identifiable {
    let id: String
    let tenantId: String
    let tripId: String
    let category: ExpenseCategory
    let customLabel: String?
    let amount: Double
    let notes: String?
    let expenseDate: String?
    let receiptUrl: String?
    let createdAt: String
    let updatedAt: String

    // MARK: - CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case tripId = "trip_id"
        case category
        case customLabel = "custom_label"
        case amount
        case notes
        case expenseDate = "expense_date"
        case receiptUrl = "receipt_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Expense Create

/// Payload for creating a new expense (excludes server-generated fields).
struct ExpenseCreate: Codable {
    let tenantId: String
    let tripId: String
    let category: ExpenseCategory
    let customLabel: String?
    let amount: Double
    let notes: String?
    let expenseDate: String?

    enum CodingKeys: String, CodingKey {
        case tenantId = "tenant_id"
        case tripId = "trip_id"
        case category
        case customLabel = "custom_label"
        case amount
        case notes
        case expenseDate = "expense_date"
    }
}
