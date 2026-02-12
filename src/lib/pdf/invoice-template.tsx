import {
  Document,
  Page,
  Text,
  View,
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
  invoiceTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  invoiceMeta: {
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
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  col1: { width: '40%' },
  col2: { width: '30%' },
  col3: { width: '30%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderColor: '#1a1a1a',
    paddingTop: 10,
    marginTop: 10,
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
})

interface InvoiceDocumentProps {
  order: {
    id: string
    order_number: string | null
    carrier_pay: string
    vehicle_vin: string | null
    vehicle_year: number | null
    vehicle_make: string | null
    vehicle_model: string | null
    pickup_city: string | null
    pickup_state: string | null
    delivery_city: string | null
    delivery_state: string | null
    broker: { name: string; email: string | null } | null
  }
  tenant: {
    name: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
  }
}

function formatCurrency(value: string): string {
  return `$${parseFloat(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function InvoiceDocument({ order, tenant }: InvoiceDocumentProps) {
  const invoiceNumber = `INV-${order.id}`

  const vehicleDescription = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean)
    .join(' ')

  const routeDescription = [
    [order.pickup_city, order.pickup_state].filter(Boolean).join(', '),
    [order.delivery_city, order.delivery_state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' -> ')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Company Header + Invoice Info */}
        <View style={styles.header}>
          <View>
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
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>{invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {new Date().toLocaleDateString('en-US')}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Bill To:</Text>
          <Text>{order.broker?.name ?? 'N/A'}</Text>
          {order.broker?.email && <Text style={styles.companyDetail}>{order.broker.email}</Text>}
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.bold]}>Description</Text>
            <Text style={[styles.col2, styles.bold]}>Details</Text>
            <Text style={[styles.col3, styles.bold]}>Amount</Text>
          </View>

          {/* Vehicle row */}
          <View style={styles.tableRow}>
            <Text style={styles.col1}>
              {vehicleDescription || 'Vehicle Transport'}
            </Text>
            <Text style={styles.col2}>{routeDescription || 'N/A'}</Text>
            <Text style={styles.col3}>{formatCurrency(order.carrier_pay)}</Text>
          </View>

          {/* VIN row (if available) */}
          {order.vehicle_vin && (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>VIN: {order.vehicle_vin}</Text>
              <Text style={styles.col2} />
              <Text style={styles.col3} />
            </View>
          )}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={[styles.col1, styles.bold]}>Total Due</Text>
          <Text style={styles.col2} />
          <Text style={[styles.col3, styles.bold]}>
            {formatCurrency(order.carrier_pay)}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business</Text>
        </View>
      </Page>
    </Document>
  )
}
