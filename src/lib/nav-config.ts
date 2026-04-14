import {
  DashboardSquare01Icon,
  TaskDaily02Icon,
  MapsLocation01Icon,
  MessageMultiple02Icon,
  Car01Icon,
  Route01Icon,
  TruckIcon,
  CaravanIcon,
  UserSettings01Icon,
  UserAdd01Icon,
  DeliveryTruck01Icon,
  Wrench01Icon,
  Fuel01Icon,
  HeadsetIcon,
  Analytics02Icon,
  ChartBarLineIcon,
  Agreement02Icon,
  ShieldEnergyIcon,
  PlugSocketIcon,
  Settings02Icon,
  Menu01Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import type { TenantRole } from '@/types'
import { hasMinRole } from '@/lib/tier'

export type NavItem = {
  name: string
  href: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  minRole?: TenantRole
  badge?: number
}

export type NavCategory = {
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any
  items: NavItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: DashboardSquare01Icon },
      { name: 'Tasks', href: '/tasks', icon: TaskDaily02Icon },
      { name: 'Live Map', href: '/live-map', icon: MapsLocation01Icon },
      { name: 'Team Chat', href: '/team-chat', icon: MessageMultiple02Icon },
    ],
  },
  {
    label: 'Operations',
    icon: Route01Icon,
    items: [
      { name: 'Orders', href: '/orders', icon: Car01Icon },
      { name: 'Trips', href: '/dispatch', icon: Route01Icon },
    ],
  },
  {
    label: 'Fleet',
    icon: TruckIcon,
    items: [
      { name: 'Trucks', href: '/trucks', icon: TruckIcon },
      { name: 'Trailers', href: '/trailers', icon: CaravanIcon },
      { name: 'Drivers', href: '/drivers', icon: UserSettings01Icon, minRole: 'dispatcher' },
      { name: 'Onboarding', href: '/onboarding', icon: UserAdd01Icon, minRole: 'dispatcher' },
      { name: 'Local Runs', href: '/local-runs', icon: DeliveryTruck01Icon, minRole: 'dispatcher' },
      { name: 'Maintenance', href: '/maintenance', icon: Wrench01Icon, minRole: 'dispatcher' },
      { name: 'Fuel Tracking', href: '/fuel-tracking', icon: Fuel01Icon, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'People',
    icon: UserMultipleIcon,
    items: [
      { name: 'Dispatchers', href: '/dispatchers', icon: HeadsetIcon, minRole: 'admin' },
      { name: 'Performance', href: '/dispatcher-performance', icon: Analytics02Icon, minRole: 'admin' },
    ],
  },
  {
    label: 'Safety & Compliance',
    icon: ShieldEnergyIcon,
    items: [
      { name: 'Safety & Compliance', href: '/compliance', icon: ShieldEnergyIcon, minRole: 'admin' },
    ],
  },
  {
    label: 'Finance',
    icon: ChartBarLineIcon,
    items: [
      { name: 'Accounting', href: '/financials', icon: ChartBarLineIcon, minRole: 'admin' },
      { name: 'Brokers', href: '/brokers', icon: Agreement02Icon, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'System',
    icon: Settings02Icon,
    items: [
      { name: 'Integrations', href: '/integrations', icon: PlugSocketIcon },
      { name: 'Settings', href: '/settings', icon: Settings02Icon, minRole: 'admin' },
    ],
  },
]

export type BottomTabItem = {
  name: string
  href: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  /** If true, this tab is a trigger (opens a sheet) rather than a navigation link */
  isTrigger?: boolean
}

export const BOTTOM_TAB_ITEMS: BottomTabItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: DashboardSquare01Icon },
  { name: 'Dispatch', href: '/dispatch', icon: Route01Icon },
  { name: 'Orders', href: '/orders', icon: Car01Icon },
  { name: 'Map', href: '/live-map', icon: MapsLocation01Icon },
  { name: 'More', href: '#more', icon: Menu01Icon, isTrigger: true },
]

/** Primary tab hrefs — items NOT in this set appear in the "More" sheet */
const PRIMARY_TAB_HREFS = new Set(BOTTOM_TAB_ITEMS.filter((t) => !t.isTrigger).map((t) => t.href))

export function filterNavByRole(categories: NavCategory[], userRole: TenantRole): NavCategory[] {
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (!item.minRole) return true
        return hasMinRole(userRole, item.minRole)
      }),
    }))
    .filter((category) => category.items.length > 0)
}

/** Returns nav items that are NOT covered by the bottom tab bar (for the "More" sheet) */
export function getMoreMenuItems(categories: NavCategory[], userRole: TenantRole): NavCategory[] {
  return filterNavByRole(categories, userRole)
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !PRIMARY_TAB_HREFS.has(item.href)),
    }))
    .filter((category) => category.items.length > 0)
}
