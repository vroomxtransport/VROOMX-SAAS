// ============================================================================
// Integration Registry — Single source of truth for all integrations
// ============================================================================

export type IntegrationCategory =
  | 'telematics'
  | 'eld_compliance'
  | 'accounting'
  | 'load_boards'
  | 'maintenance'
  | 'communication'

export type IntegrationStatus = 'available' | 'coming_soon'

export type IntegrationTag = 'official' | 'popular' | 'new' | 'beta'

export interface IntegrationStep {
  title: string
  description: string
}

export interface IntegrationDefinition {
  slug: string
  name: string
  description: string
  longDescription: string
  logo: string
  brandColor: string          // hex color for initial avatar fallback
  category: IntegrationCategory
  status: IntegrationStatus
  tags: IntegrationTag[]
  features: string[]
  steps: IntegrationStep[]
  externalUrl?: string
  // To add real logos: download from the brand's press page and save as
  // /public/images/integrations/{slug}.svg (or .png)
  // Brand press pages:
  //   Samsara:          https://www.samsara.com/resources/brand-assets
  //   Motive:           https://gomotive.com (contact for press kit)
  //   QuickBooks:       https://www.intuit.com/company/press-room/logos/
  //   Central Dispatch: https://www.centraldispatch.com (contact for press kit)
  //   Super Dispatch:   https://www.superdispatch.com (contact for press kit)
  //   Geotab:           https://www.geotab.com/press/
  //   Fleetio:          https://www.fleetio.com/press
  //   Slack:            https://slack.com/media-kit
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  telematics: 'Telematics',
  eld_compliance: 'ELD & Compliance',
  accounting: 'Accounting',
  load_boards: 'Load Boards',
  maintenance: 'Maintenance',
  communication: 'Communication',
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as IntegrationCategory[]

const INTEGRATIONS: IntegrationDefinition[] = [
  {
    slug: 'samsara',
    name: 'Samsara',
    description:
      'Real-time GPS tracking, ELD compliance, safety events, and vehicle diagnostics for your entire fleet.',
    longDescription:
      'Connect Samsara to VroomX for live GPS tracking on every trip, automatic ELD compliance monitoring, driver safety score integration, and real-time vehicle diagnostic alerts. Map Samsara vehicles and drivers directly to your VroomX fleet.',
    logo: '/images/integrations/samsara.png',
    brandColor: '#00263E',
    category: 'telematics',
    status: 'available',
    tags: ['official', 'popular'],
    features: [
      'Real-time GPS tracking on trips',
      'ELD compliance monitoring',
      'Driver safety scores',
      'Vehicle diagnostics & alerts',
      'Automatic vehicle/driver mapping',
      'Live fuel & idle tracking',
    ],
    steps: [
      { title: 'Connect your account', description: 'Enter your Samsara API key to establish a secure connection.' },
      { title: 'Map vehicles & drivers', description: 'Link Samsara assets to your VroomX trucks and drivers.' },
      { title: 'Data syncs automatically', description: 'GPS, HOS, and safety data flow into VroomX in real time.' },
    ],
    externalUrl: 'https://www.samsara.com',
  },
  {
    slug: 'motive',
    name: 'Motive (KeepTruckin)',
    description:
      'ELD compliance, fleet tracking, driver safety scoring, and DVIR management for carrier operations.',
    longDescription:
      'Integrate Motive (formerly KeepTruckin) with VroomX to automatically sync ELD logs, track driver hours of service, monitor safety events, and manage DVIRs. Keep your compliance data in sync across both platforms.',
    logo: '/images/integrations/motive.jpeg',
    brandColor: '#FF6B2B',
    category: 'eld_compliance',
    status: 'available',
    tags: ['popular'],
    features: [
      'ELD log synchronization',
      'Hours of Service tracking',
      'Driver safety scoring',
      'DVIR management',
      'Real-time fleet location',
      'Fuel card integration',
    ],
    steps: [
      { title: 'Connect your account', description: 'Authorize VroomX to access your Motive fleet data.' },
      { title: 'Map vehicles & drivers', description: 'Match Motive assets to your VroomX fleet records.' },
      { title: 'Data syncs automatically', description: 'ELD, GPS, and safety data stream into your dashboard.' },
    ],
    externalUrl: 'https://gomotive.com',
  },
  {
    slug: 'quickbooks',
    name: 'QuickBooks Online',
    description:
      'Sync invoices, payments, and expenses between VroomX and QuickBooks for seamless accounting.',
    longDescription:
      'Automatically push VroomX invoices to QuickBooks Online, sync payment statuses, and reconcile expenses. Eliminate double-entry and keep your books accurate with real-time financial data synchronization.',
    logo: '/images/integrations/quickbooks.png',
    brandColor: '#2CA01C',
    category: 'accounting',
    status: 'available',
    tags: ['popular', 'new'],
    features: [
      'Automatic invoice sync',
      'Payment status reconciliation',
      'Expense categorization',
      'Customer/vendor mapping',
      'Chart of accounts sync',
      'Tax-ready reporting',
    ],
    steps: [
      { title: 'Connect your account', description: 'Sign in to QuickBooks and authorize VroomX access.' },
      { title: 'Configure mapping', description: 'Map chart of accounts, customers, and expense categories.' },
      { title: 'Invoices sync automatically', description: 'New invoices and payments push to QuickBooks in real time.' },
    ],
    externalUrl: 'https://quickbooks.intuit.com',
  },
  {
    slug: 'central-dispatch',
    name: 'Central Dispatch',
    description:
      'Import loads directly from Central Dispatch into VroomX orders with one click.',
    longDescription:
      'Connect your Central Dispatch account to VroomX to automatically import available loads, accept dispatches, and update delivery statuses. Reduce manual data entry and respond to loads faster than your competition.',
    logo: '/images/integrations/central-dispatch.svg',
    brandColor: '#0B2545',
    category: 'load_boards',
    status: 'coming_soon',
    tags: ['popular'],
    features: [
      'One-click load import',
      'Automatic order creation',
      'Delivery status updates',
      'Rate comparison tools',
      'Broker rating visibility',
      'Load matching alerts',
    ],
    steps: [
      { title: 'Connect your account', description: 'Enter your Central Dispatch credentials to link accounts.' },
      { title: 'Import loads', description: 'Browse and import available loads into your trip planner.' },
      { title: 'Status syncs back', description: 'Pickup and delivery updates push to Central Dispatch automatically.' },
    ],
    externalUrl: 'https://www.centraldispatch.com',
  },
  {
    slug: 'super-dispatch',
    name: 'Super Dispatch',
    description:
      'Streamline auto transport operations with digital BOLs, instant payments, and load management.',
    longDescription:
      'Integrate Super Dispatch with VroomX to manage digital bills of lading, process instant carrier payments, and sync load statuses. Built specifically for auto transport carriers who want to digitize their paper-heavy workflows.',
    logo: '/images/integrations/super-dispatch.svg',
    brandColor: '#1565C0',
    category: 'load_boards',
    status: 'coming_soon',
    tags: [],
    features: [
      'Digital BOL management',
      'Instant payment processing',
      'Load status synchronization',
      'Photo documentation sync',
      'Carrier TMS integration',
      'Shipper communication tools',
    ],
    steps: [
      { title: 'Connect your account', description: 'Authorize VroomX access to your Super Dispatch account.' },
      { title: 'Import loads', description: 'Pull loads and BOL data directly into your trips.' },
      { title: 'Updates sync both ways', description: 'Status changes and BOLs stay in sync across platforms.' },
    ],
    externalUrl: 'https://www.superdispatch.com',
  },
  {
    slug: 'geotab',
    name: 'Geotab',
    description:
      'Advanced fleet telematics with route optimization, fuel management, and predictive maintenance.',
    longDescription:
      'Connect Geotab to VroomX for enterprise-grade fleet telematics including advanced route optimization, predictive maintenance alerts, fuel efficiency tracking, and comprehensive driver behavior analytics.',
    logo: '/images/integrations/geotab.jpeg',
    brandColor: '#00A651',
    category: 'telematics',
    status: 'coming_soon',
    tags: [],
    features: [
      'Advanced route optimization',
      'Predictive maintenance',
      'Fuel efficiency analytics',
      'Driver behavior scoring',
      'Zone & geofence alerts',
      'Custom reporting dashboards',
    ],
    steps: [
      { title: 'Connect your account', description: 'Enter your Geotab database and API credentials.' },
      { title: 'Map your fleet', description: 'Link Geotab devices to your VroomX trucks.' },
      { title: 'Data flows in real time', description: 'Tracking, maintenance, and compliance data sync continuously.' },
    ],
    externalUrl: 'https://www.geotab.com',
  },
  {
    slug: 'fleetio',
    name: 'Fleetio',
    description:
      'Fleet maintenance management with service reminders, work orders, and parts inventory tracking.',
    longDescription:
      'Integrate Fleetio with VroomX to manage vehicle maintenance schedules, track work orders, monitor parts inventory, and receive proactive service reminders. Keep your fleet running at peak performance.',
    logo: '/images/integrations/fleetio.jpeg',
    brandColor: '#0052CC',
    category: 'maintenance',
    status: 'coming_soon',
    tags: ['new'],
    features: [
      'Maintenance schedule sync',
      'Work order management',
      'Parts inventory tracking',
      'Service cost analytics',
      'Recall alerts',
      'Tire management',
    ],
    steps: [
      { title: 'Connect your account', description: 'Generate a Fleetio API key and connect to VroomX.' },
      { title: 'Sync fleet data', description: 'Maintenance, fuel, and inspection data import automatically.' },
      { title: 'Stay proactive', description: 'Service reminders and alerts appear in your VroomX dashboard.' },
    ],
    externalUrl: 'https://www.fleetio.com',
  },
  {
    slug: 'slack',
    name: 'Slack',
    description:
      'Get instant notifications for trip updates, driver alerts, and critical fleet events in Slack.',
    longDescription:
      'Connect Slack to VroomX to receive real-time notifications for trip status changes, driver safety alerts, maintenance reminders, and financial updates. Keep your team informed without leaving their communication hub.',
    logo: '/images/integrations/slack.svg',
    brandColor: '#4A154B',
    category: 'communication',
    status: 'coming_soon',
    tags: ['new'],
    features: [
      'Trip status notifications',
      'Driver safety alerts',
      'Maintenance reminders',
      'Invoice & payment updates',
      'Custom channel routing',
      'Interactive message actions',
    ],
    steps: [
      { title: 'Connect your workspace', description: 'Authorize VroomX to post in your Slack workspace.' },
      { title: 'Choose your channels', description: 'Route different notification types to specific channels.' },
      { title: 'Stay in the loop', description: 'Your team gets instant updates without switching apps.' },
    ],
    externalUrl: 'https://slack.com',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getIntegration(slug: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.slug === slug)
}

export function getIntegrationsByCategory(
  category: IntegrationCategory
): IntegrationDefinition[] {
  return INTEGRATIONS.filter((i) => i.category === category)
}

export function getAllIntegrations(): IntegrationDefinition[] {
  return INTEGRATIONS
}
