import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  companyDetail: {
    marginTop: 2,
    color: '#4b5563',
  },
  receiptTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  receiptMeta: {
    marginTop: 4,
    color: '#4b5563',
  },
  sectionLabel: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    fontSize: 10,
  },
  billTo: {
    marginBottom: 20,
  },
  paymentPanel: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    color: '#6b7280',
    fontSize: 10,
  },
  paymentValue: {
    color: '#1a1a1a',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  statusPill: {
    color: '#065f46',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    paddingTop: 10,
    marginTop: 8,
  },
  amountLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  amountValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#065f46',
  },
  routeSection: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeCol: {
    width: '48%',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 9,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    paddingTop: 10,
  },
  logo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: 'contain',
    marginBottom: 8,
  },
})

interface ReceiptDocumentProps {
  order: {
    id: string
    order_number: string | null
    vehicle_vin: string | null
    vehicle_year: number | null
    vehicle_make: string | null
    vehicle_model: string | null
    pickup_location: string | null
    pickup_city: string | null
    pickup_state: string | null
    pickup_zip: string | null
    delivery_location: string | null
    delivery_city: string | null
    delivery_state: string | null
    delivery_zip: string | null
    payment_type: string | null
    amount_paid: string | null
    broker: { name: string; email: string | null } | null
  }
  tenant: {
    name: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
    dot_number?: string | null
    mc_number?: string | null
  }
  /** Recipient's display label (e.g. "Pickup contact: John Doe"). */
  recipientLabel: string
  /** ISO date string of the most recent payment event. */
  paymentDate: string
  /** Pre-signed URL for the company logo stored in the branding bucket. */
  logoUrl?: string | null
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  COD: 'Cash on Delivery',
  COP: 'Cash on Pickup',
  CHECK: 'Check',
  SPLIT: 'Split (COD + Billing)',
  BILL: 'Billed',
}

function formatCurrency(value: string | null): string {
  const n = value ? Number(value) : 0
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatAddress(
  location: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string {
  const line1 = location?.trim()
  const line2 = [city?.trim(), state?.trim()].filter(Boolean).join(', ')
  const line3 = zip?.trim()
  return [line1, line2 && line3 ? `${line2} ${line3}` : line2 || line3]
    .filter(Boolean)
    .join('\n')
}

export function ReceiptDocument({
  order,
  tenant,
  recipientLabel,
  paymentDate,
  logoUrl,
}: ReceiptDocumentProps) {
  const receiptNumber = order.order_number
    ? `RCPT-${order.order_number}`
    : `RCPT-${order.id.slice(0, 8).toUpperCase()}`

  const vehicleDescription = [
    order.vehicle_year,
    order.vehicle_make,
    order.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ')

  const paymentTypeLabel = order.payment_type
    ? PAYMENT_TYPE_LABEL[order.payment_type] ?? order.payment_type
    : 'N/A'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Company Header + Receipt Info */}
        <View style={styles.header}>
          <View>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <Text style={styles.companyName}>{tenant.name}</Text>
            {tenant.address && (
              <Text style={styles.companyDetail}>{tenant.address}</Text>
            )}
            {(tenant.city || tenant.state || tenant.zip) && (
              <Text style={styles.companyDetail}>
                {[tenant.city, tenant.state].filter(Boolean).join(', ')}
                {tenant.zip ? ` ${tenant.zip}` : ''}
              </Text>
            )}
            {tenant.phone && (
              <Text style={styles.companyDetail}>{tenant.phone}</Text>
            )}
            {(tenant.dot_number || tenant.mc_number) && (
              <Text style={styles.companyDetail}>
                {[
                  tenant.dot_number ? `DOT# ${tenant.dot_number}` : null,
                  tenant.mc_number ? `MC# ${tenant.mc_number}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
            <Text style={styles.receiptMeta}>{receiptNumber}</Text>
            <Text style={styles.receiptMeta}>
              Issued: {new Date().toLocaleDateString('en-US')}
            </Text>
          </View>
        </View>

        {/* Receipt For */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Receipt For:</Text>
          <Text>{recipientLabel}</Text>
          {order.broker?.name && (
            <Text style={styles.companyDetail}>
              Broker: {order.broker.name}
            </Text>
          )}
        </View>

        {/* Payment Panel */}
        <View style={styles.paymentPanel}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Date</Text>
            <Text style={styles.paymentValue}>{formatDate(paymentDate)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Type</Text>
            <Text style={styles.paymentValue}>{paymentTypeLabel}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Status</Text>
            <Text style={styles.statusPill}>PAID</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount Received</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(order.amount_paid)}
            </Text>
          </View>
        </View>

        {/* Order + Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeCol}>
            <Text style={styles.sectionLabel}>Pickup</Text>
            <Text>
              {formatAddress(
                order.pickup_location,
                order.pickup_city,
                order.pickup_state,
                order.pickup_zip,
              ) || 'N/A'}
            </Text>
          </View>
          <View style={styles.routeCol}>
            <Text style={styles.sectionLabel}>Delivery</Text>
            <Text>
              {formatAddress(
                order.delivery_location,
                order.delivery_city,
                order.delivery_state,
                order.delivery_zip,
              ) || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionLabel}>
            Order {order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
          </Text>
          {vehicleDescription && <Text>{vehicleDescription}</Text>}
          {order.vehicle_vin && (
            <Text style={styles.companyDetail}>VIN: {order.vehicle_vin}</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business.</Text>
        </View>
      </Page>
    </Document>
  )
}
