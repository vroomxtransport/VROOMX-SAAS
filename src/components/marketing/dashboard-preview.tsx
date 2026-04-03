'use client'

import {
  Search,
  Bell,
  Gauge,
  ListTodo,
  MapPinned,
  Car,
  Milestone,
  Truck,
  IdCard,
  CircleDollarSign,
  FileText,
  SlidersHorizontal,
  Plus,
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  Users,
} from 'lucide-react'

export function DashboardPreview() {
  return (
    <div className="hidden md:block w-full max-w-5xl mx-auto select-none pointer-events-none">
      <div
        className="rounded-2xl overflow-hidden p-3 md:p-4"
        style={{
          background: 'rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: 'var(--shadow-dashboard)',
        }}
      >
        <div className="bg-card rounded-xl overflow-hidden flex flex-col">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="bg-brand text-white font-bold text-[10px] w-5 h-5 rounded flex items-center justify-center">
                V
              </div>
              <span className="text-xs font-semibold text-foreground">VroomX</span>
              <span className="text-[10px] text-muted-foreground">/ Dashboard</span>
            </div>

            <div className="bg-secondary rounded-lg px-3 py-1 flex items-center gap-2 text-muted-foreground w-56">
              <Search className="h-3 w-3" />
              <span className="text-[10px]">Search orders, drivers...</span>
              <span className="ml-auto text-[9px] bg-card border border-border rounded px-1.5 py-0.5 font-medium">
                ⌘K
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="bg-brand text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-semibold">
                MR
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex">
            {/* Sidebar — dark theme */}
            <div className="w-36 py-2.5 px-1.5" style={{ background: '#1a1a19' }}>
              <NavCategory label="Main">
                <NavItem icon={Gauge} label="Dashboard" active />
                <NavItem icon={ListTodo} label="Tasks" badge="5" />
                <NavItem icon={MapPinned} label="Live Map" />
              </NavCategory>
              <NavCategory label="Operations">
                <NavItem icon={Car} label="Orders" />
                <NavItem icon={Milestone} label="Trips" />
              </NavCategory>
              <NavCategory label="Fleet">
                <NavItem icon={Truck} label="Trucks" />
                <NavItem icon={IdCard} label="Drivers" />
              </NavCategory>
              <NavCategory label="Finance">
                <NavItem icon={CircleDollarSign} label="Financials" />
                <NavItem icon={FileText} label="Billing" />
              </NavCategory>
              <NavCategory label="System">
                <NavItem icon={SlidersHorizontal} label="Settings" />
              </NavCategory>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-3 bg-secondary/30 space-y-2.5">
              {/* Hero header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-foreground">Welcome back, Mike!</span>
                  <div className="flex items-center gap-2">
                    <StatPill dot="bg-blue-500" text="47 active loads" />
                    <StatPill dot="bg-amber-500" text="23 in transit" />
                    <StatPill dot="bg-emerald-500" text="$128K MTD" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-brand text-white rounded-md px-2 py-0.5 text-[9px] font-medium">
                    <Plus className="h-2.5 w-2.5" />
                    New Order
                  </div>
                  <div className="flex items-center gap-1 border border-border rounded-md px-2 py-0.5 text-[9px] font-medium text-foreground bg-card">
                    <Plus className="h-2.5 w-2.5" />
                    New Trip
                  </div>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={Car} iconBg="bg-blue-50" iconColor="text-blue-500" label="Active Loads" value="47" trend="+12%" up />
                <StatCard icon={Truck} iconBg="bg-amber-50" iconColor="text-amber-500" label="In-Transit" value="23" trend="+8%" up />
                <StatCard icon={Activity} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Revenue MTD" value="$128,450" trend="+18%" up />
                <StatCard icon={CircleDollarSign} iconBg="bg-violet-50" iconColor="text-violet-500" label="Avg $/Mile" value="$2.47" trend="-3%" up={false} />
              </div>

              {/* Widget Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Loads Pipeline */}
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      Loads Pipeline
                    </span>
                    <span className="text-[9px] font-semibold bg-brand/10 text-brand rounded-full px-2 py-0.5">142 total</span>
                  </div>

                  {/* Segmented bar */}
                  <div className="h-3.5 rounded-full overflow-hidden flex gap-px mb-1.5">
                    <div className="bg-blue-500 rounded-l-full" style={{ width: '18%' }} />
                    <div className="bg-amber-500" style={{ width: '15%' }} />
                    <div className="bg-purple-500" style={{ width: '22%' }} />
                    <div className="bg-green-500" style={{ width: '20%' }} />
                    <div className="bg-indigo-500" style={{ width: '14%' }} />
                    <div className="bg-emerald-500 rounded-r-full" style={{ width: '11%' }} />
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                    {[
                      { label: 'New', color: 'bg-blue-500', count: 26 },
                      { label: 'Assigned', color: 'bg-amber-500', count: 21 },
                      { label: 'Picked Up', color: 'bg-purple-500', count: 31 },
                      { label: 'Delivered', color: 'bg-green-500', count: 28 },
                      { label: 'Invoiced', color: 'bg-indigo-500', count: 20 },
                      { label: 'Paid', color: 'bg-emerald-500', count: 16 },
                    ].map((s) => (
                      <span key={s.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                        {s.label} {s.count}
                      </span>
                    ))}
                  </div>

                  {/* Mini orders table */}
                  <div className="text-[10px]">
                    <div className="grid grid-cols-[60px_1fr_1fr_60px_50px] text-muted-foreground font-medium pb-1">
                      <span>Order</span>
                      <span>Vehicle</span>
                      <span>Route</span>
                      <span>Status</span>
                      <span className="text-right">Rev</span>
                    </div>
                    <OrderRow num="ORD-1047" vehicle="Tesla Model Y" route="Dallas → Miami" status="Picked Up" statusColor="bg-purple-100 text-purple-700" revenue="$2,450" />
                    <OrderRow num="ORD-1046" vehicle="BMW X5" route="LA → Phoenix" status="Assigned" statusColor="bg-amber-50 text-amber-600" revenue="$1,800" />
                    <OrderRow num="ORD-1045" vehicle="Ford F-150" route="Houston → ATL" status="New" statusColor="bg-blue-50 text-blue-600" revenue="$3,200" />
                  </div>
                </div>

                {/* Revenue Chart */}
                <div className="bg-card rounded-lg p-2.5 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      Revenue
                    </span>
                    <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">+18.4%</span>
                  </div>

                  <div className="text-base font-bold text-foreground tabular-nums">$128,450</div>

                  {/* Period selector */}
                  <div className="flex items-center gap-1 mt-1 mb-1.5">
                    {['7D', '30D', '90D'].map((p) => (
                      <span
                        key={p}
                        className={`text-[9px] font-medium rounded-md px-2 py-0.5 ${
                          p === '30D'
                            ? 'bg-brand text-white'
                            : 'text-muted-foreground bg-secondary'
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* SVG Chart */}
                  <svg viewBox="0 0 400 80" className="w-full h-16" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#192334" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#192334" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,65 C20,60 40,58 70,50 C100,42 120,48 160,38 C200,28 230,32 260,22 C290,16 320,20 350,14 C370,10 390,16 400,12"
                      fill="none"
                      stroke="#192334"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M0,65 C20,60 40,58 70,50 C100,42 120,48 160,38 C200,28 230,32 260,22 C290,16 320,20 350,14 C370,10 390,16 400,12 L400,80 L0,80 Z"
                      fill="url(#revenueGradient)"
                    />
                  </svg>
                </div>
              </div>

              {/* Fleet Pulse — full width */}
              <div className="bg-card rounded-lg p-2.5 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Fleet Pulse
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="flex gap-4">
                  <FleetRow icon={Truck} label="Trucks" sublabel="Active vehicles" current={6} total={8} barColor="from-blue-500 to-blue-400" />
                  <FleetRow icon={Users} label="Drivers" sublabel="On trip" current={4} total={5} barColor="from-violet-500 to-violet-400" />
                  <FleetRow icon={Layers} label="Capacity" sublabel="Slots in use" current={47} total={72} barColor="from-amber-500 to-amber-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Helper components ---------- */

function NavCategory({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="text-[8px] font-semibold uppercase tracking-wider px-2 mb-0.5" style={{ color: '#d4d4d0' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  badge?: string
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]"
      style={{
        color: active ? '#f5f5f4' : '#a3a3a0',
        background: active ? '#333332' : 'transparent',
      }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className={active ? 'font-medium' : ''}>{label}</span>
      {badge && (
        <span className="ml-auto text-[8px] font-semibold bg-blue-500 text-white rounded-full px-1.5">
          {badge}
        </span>
      )}
    </div>
  )
}

function StatPill({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[9px] text-muted-foreground">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
  up,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  label: string
  value: string
  trend: string
  up: boolean
}) {
  return (
    <div className="bg-card rounded-lg p-2 border border-border">
      <div className="flex items-center justify-between mb-1">
        <div className={`${iconBg} rounded-md w-5 h-5 flex items-center justify-center`}>
          <Icon className={`h-3 w-3 ${iconColor}`} />
        </div>
        <span className={`text-[9px] font-medium flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {trend}
        </span>
      </div>
      <div className="text-xs font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  )
}

function OrderRow({
  num,
  vehicle,
  route,
  status,
  statusColor,
  revenue,
}: {
  num: string
  vehicle: string
  route: string
  status: string
  statusColor: string
  revenue: string
}) {
  return (
    <div className="grid grid-cols-[60px_1fr_1fr_60px_50px] text-[10px] py-1.5 border-t border-border/40 items-center">
      <span className="font-medium text-foreground">{num}</span>
      <span className="text-foreground truncate">{vehicle}</span>
      <span className="text-muted-foreground truncate">{route}</span>
      <span className={`text-[8px] font-medium rounded-full px-1.5 py-0.5 text-center ${statusColor}`}>{status}</span>
      <span className="text-right font-medium text-foreground">{revenue}</span>
    </div>
  )
}

function FleetRow({
  icon: Icon,
  label,
  sublabel,
  current,
  total,
  barColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel: string
  current: number
  total: number
  barColor: string
}) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-foreground">{label}</span>
        </div>
        <span className="text-[10px] font-semibold text-foreground tabular-nums">{current}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[8px] text-muted-foreground mt-0.5">{sublabel}</div>
    </div>
  )
}
