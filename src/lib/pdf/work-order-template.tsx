import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { WorkOrder, WorkOrderItem, Shop, Truck } from '@/types/database'

interface WorkOrderPdfTenant {
  name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  dot_number?: string | null
  mc_number?: string | null
}

interface WorkOrderPdfProps {
  workOrder: WorkOrder
  shop: Shop | null
  truck: Truck | null
  items: WorkOrderItem[]
  tenant: WorkOrderPdfTenant
  logoUrl?: string | null
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  companyBlock: { maxWidth: '60%' },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  companyDetail: { marginTop: 2, color: '#4b5563' },
  logo: { width: 80, height: 40, objectFit: 'contain' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  woTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  meta: { marginTop: 2, color: '#4b5563', textAlign: 'right' },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
  },
  cardLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  cardDetail: { color: '#4b5563', marginTop: 2 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#111',
    paddingBottom: 6,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  colKind: { width: '12%' },
  colDesc: { width: '42%' },
  colQty: { width: '10%', textAlign: 'right' },
  colRate: { width: '16%', textAlign: 'right' },
  colAmount: { width: '20%', textAlign: 'right' },
  totalsBlock: {
    alignSelf: 'flex-end',
    width: '45%',
    marginTop: 14,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 2,
    borderColor: '#111',
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 9,
  },
})

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: '#f1f5f9', color: '#334155' },
  scheduled: { bg: '#dbeafe', color: '#1e40af' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  closed: { bg: '#e5e7eb', color: '#374151' },
}

function fmtMoney(raw: string | number | null | undefined): string {
  const n = Number(raw ?? 0)
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.valueOf())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truckLine(t: Truck | null): string {
  if (!t) return 'No equipment'
  const parts = [t.year, t.make, t.model].filter(Boolean)
  const label = parts.length ? parts.join(' ') : 'Truck'
  return t.unit_number ? `${label} · Unit ${t.unit_number}` : label
}

export function WorkOrderDocument({
  workOrder,
  shop,
  truck,
  items,
  tenant,
  logoUrl,
}: WorkOrderPdfProps) {
  const statusStyle = STATUS_COLORS[workOrder.status] ?? STATUS_COLORS.new
  const companyAddress = [tenant.address, tenant.city, tenant.state, tenant.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Carrier header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{tenant.name ?? 'Your Company'}</Text>
            {companyAddress && <Text style={styles.companyDetail}>{companyAddress}</Text>}
            {tenant.phone && <Text style={styles.companyDetail}>{tenant.phone}</Text>}
            {tenant.dot_number && (
              <Text style={styles.companyDetail}>
                DOT #{tenant.dot_number}
                {tenant.mc_number ? `  ·  MC #${tenant.mc_number}` : ''}
              </Text>
            )}
          </View>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        {/* WO title + status + date */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.woTitle}>
              Work Order #{workOrder.wo_number ?? '—'}
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusStyle.bg, color: statusStyle.color }]}
            >
              <Text>{workOrder.status.replace('_', ' ')}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.meta}>
              Issued {fmtDate(workOrder.created_at)}
            </Text>
            {workOrder.closed_at && (
              <Text style={styles.meta}>Closed {fmtDate(workOrder.closed_at)}</Text>
            )}
            {workOrder.completed_date && !workOrder.closed_at && (
              <Text style={styles.meta}>Completed {fmtDate(workOrder.completed_date)}</Text>
            )}
          </View>
        </View>

        {/* Shop + truck cards */}
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Shop</Text>
            <Text style={styles.cardTitle}>{shop?.name ?? '—'}</Text>
            {shop?.kind && (
              <Text style={styles.cardDetail}>
                {shop.kind === 'internal' ? 'Internal bay' : 'External vendor'}
              </Text>
            )}
            {shop?.address && <Text style={styles.cardDetail}>{shop.address}</Text>}
            {(shop?.city || shop?.state) && (
              <Text style={styles.cardDetail}>
                {[shop.city, shop.state, shop.zip].filter(Boolean).join(', ')}
              </Text>
            )}
            {shop?.phone && <Text style={styles.cardDetail}>{shop.phone}</Text>}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Equipment</Text>
            <Text style={styles.cardTitle}>{truckLine(truck)}</Text>
            {truck?.vin && <Text style={styles.cardDetail}>VIN {truck.vin}</Text>}
            {workOrder.odometer != null && (
              <Text style={styles.cardDetail}>Odometer {workOrder.odometer.toLocaleString()}</Text>
            )}
          </View>
        </View>

        {/* Description (if set) */}
        {workOrder.description && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.cardLabel}>Description</Text>
            <Text>{workOrder.description}</Text>
          </View>
        )}

        {/* Line items */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colKind, styles.bold]}>Kind</Text>
          <Text style={[styles.colDesc, styles.bold]}>Description</Text>
          <Text style={[styles.colQty, styles.bold]}>Qty</Text>
          <Text style={[styles.colRate, styles.bold]}>Rate</Text>
          <Text style={[styles.colAmount, styles.bold]}>Amount</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ color: '#9ca3af' }}>No line items</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colKind}>{item.kind === 'labor' ? 'Labor' : 'Part'}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{Number(item.quantity).toLocaleString()}</Text>
              <Text style={styles.colRate}>{fmtMoney(item.unit_rate)}</Text>
              <Text style={styles.colAmount}>{fmtMoney(item.amount)}</Text>
            </View>
          ))
        )}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={{ color: '#6b7280' }}>Total Labor</Text>
            <Text>{fmtMoney(workOrder.total_labor)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={{ color: '#6b7280' }}>Total Parts</Text>
            <Text>{fmtMoney(workOrder.total_parts)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.bold}>Grand Total</Text>
            <Text style={styles.bold}>{fmtMoney(workOrder.grand_total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {workOrder.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{workOrder.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Generated by {tenant.name ?? 'VroomX'} via VroomX TMS
        </Text>
      </Page>
    </Document>
  )
}
