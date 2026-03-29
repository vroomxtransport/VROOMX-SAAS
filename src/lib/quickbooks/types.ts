// ============================================================================
// QuickBooks Online API Response Types
// ============================================================================

// ----------------------------------------------------------------------------
// Common / Shared
// ----------------------------------------------------------------------------

export interface QBRef {
  value: string
  name?: string
}

export interface QBAddress {
  Id?: string
  Line1?: string
  Line2?: string
  City?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  Country?: string
}

export interface QBEmailAddress {
  Address: string
}

export interface QBPhoneNumber {
  FreeFormNumber: string
}

// ----------------------------------------------------------------------------
// Customer
// ----------------------------------------------------------------------------

export interface QBCustomer {
  Id: string
  SyncToken: string
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  Balance?: number
  Active?: boolean
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Invoice
// ----------------------------------------------------------------------------

export interface QBInvoiceLine {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail'
  SalesItemLineDetail?: {
    ItemRef?: QBRef
    Qty?: number
    UnitPrice?: number
    TaxCodeRef?: QBRef
  }
  SubTotalLineDetail?: Record<string, unknown>
}

export interface QBInvoice {
  Id: string
  SyncToken: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  CustomerRef: QBRef
  Line: QBInvoiceLine[]
  TotalAmt: number
  Balance: number
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent'
  BillEmail?: QBEmailAddress
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  CustomerMemo?: { value: string }
  PrivateNote?: string
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Payment
// ----------------------------------------------------------------------------

export interface QBPaymentLine {
  Amount: number
  LinkedTxn: Array<{
    TxnId: string
    TxnType: 'Invoice' | 'CreditMemo' | 'JournalEntry'
  }>
}

export interface QBPayment {
  Id: string
  SyncToken: string
  TotalAmt: number
  CustomerRef: QBRef
  TxnDate?: string
  Line: QBPaymentLine[]
  DepositToAccountRef?: QBRef
  PaymentMethodRef?: QBRef
  PrivateNote?: string
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Purchase (Expense)
// ----------------------------------------------------------------------------

export interface QBPurchaseLine {
  Id?: string
  Amount: number
  DetailType: 'AccountBasedExpenseLineDetail' | 'ItemBasedExpenseLineDetail'
  Description?: string
  AccountBasedExpenseLineDetail?: {
    AccountRef: QBRef
    TaxCodeRef?: QBRef
    CustomerRef?: QBRef
  }
}

export interface QBPurchase {
  Id: string
  SyncToken: string
  AccountRef: QBRef
  Line: QBPurchaseLine[]
  TotalAmt: number
  PaymentType: 'Cash' | 'Check' | 'CreditCard'
  TxnDate?: string
  EntityRef?: QBRef
  PrivateNote?: string
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Vendor
// ----------------------------------------------------------------------------

export interface QBVendor {
  Id: string
  SyncToken: string
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  BillAddr?: QBAddress
  Balance?: number
  Active?: boolean
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Account (Chart of Accounts)
// ----------------------------------------------------------------------------

export interface QBAccount {
  Id: string
  Name: string
  AccountType: string
  AccountSubType: string
  FullyQualifiedName?: string
  Active?: boolean
  CurrentBalance?: number
  CurrencyRef?: QBRef
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// ----------------------------------------------------------------------------
// Query Response Wrapper
// ----------------------------------------------------------------------------

export interface QBQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[] | number | undefined
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
  time: string
}

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

export interface QBErrorDetail {
  Message: string
  Detail: string
  code: string
  element?: string
}

export interface QBError {
  Fault: {
    Error: QBErrorDetail[]
    type: string
  }
  time: string
}

// ----------------------------------------------------------------------------
// Token Types
// ----------------------------------------------------------------------------

export interface QBTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  token_type: string
}

// ----------------------------------------------------------------------------
// Webhook Types
// ----------------------------------------------------------------------------

export interface QBWebhookNotification {
  realmId: string
  name: string
  id: string
  operation: 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void'
  lastUpdated: string
}

export interface QBWebhookPayload {
  eventNotifications: Array<{
    realmId: string
    dataChangeEvent: {
      entities: QBWebhookNotification[]
    }
  }>
}

// ----------------------------------------------------------------------------
// Entity Mapping Types
// ----------------------------------------------------------------------------

export type QBEntityType =
  | 'broker_customer'
  | 'driver_vendor'
  | 'order_invoice'
  | 'payment'
  | 'expense'

export type QBSyncStatus = 'active' | 'paused' | 'error' | 'disconnected'
