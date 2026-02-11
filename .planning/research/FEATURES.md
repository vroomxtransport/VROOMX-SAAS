# Feature Landscape: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS TMS for vehicle transport carriers
**Researched:** 2026-02-11

## Table Stakes

Features carriers expect from any TMS. Missing any of these means the product feels incomplete and carriers will not switch from their current solution.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Order management (create, edit, status tracking) | Core TMS function | Medium | CRUD with status workflow: Pending > Assigned > Picked Up > Delivered |
| Trip management (group orders into trips) | How carriers organize multi-stop routes | Medium | A trip contains N orders, assigned to 1 driver + 1 truck |
| Dispatch board (visual assignment interface) | Dispatchers need to see and assign work at a glance | High | Drag-and-drop, real-time updates, filter by status/driver/date |
| Driver management (profiles, documents, compliance) | Carriers must track driver info and compliance docs | Medium | CDL expiration tracking, document uploads, contact info |
| Truck/fleet management | Track vehicle inventory and status | Low-Medium | VIN, year/make/model, maintenance status, assignment history |
| Broker management | Carriers work with multiple brokers | Low | Contact info, payment terms, load history |
| Invoice generation | Carriers must bill for services | Medium | Generate from completed orders, support multiple line items |
| Basic financial reporting | Carriers need to see revenue, expenses, P&L | Medium | Period-based reports, export to CSV/PDF |
| User roles (admin, dispatcher, accounting) | Multi-user access control | Medium | Role-based access within a tenant |
| Mobile driver app (iOS) | Drivers need field access | High | Inspections, BOL, status updates, earnings view |
| Document management (BOL, POD, rate confirmations) | Paper trail is legally required in transport | Medium | Upload, generate, sign, store, retrieve |
| Real-time status updates | Dispatchers and drivers must see current state | Medium | Supabase Realtime, push notifications |
| Search and filtering | Large order/trip volumes need efficient navigation | Medium | Full-text search, date ranges, status filters |
| Multi-tenant data isolation | SaaS requirement -- carriers must not see each other's data | High | PostgreSQL RLS, enforced at database level |

## Differentiators

Features that set VroomX apart from competitors like Alvys, Super Dispatch, and Central Dispatch. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Self-service signup and onboarding | Carriers start in minutes, not days of sales calls | Medium | Stripe Checkout, guided setup wizard, sample data |
| Tiered pricing with instant plan changes | Carriers scale up/down without contacting support | Medium | Stripe Billing Portal, feature flags per tier |
| AI-assisted dispatch suggestions | Reduce dispatcher cognitive load | High | Match available drivers/trucks to orders based on location, capacity, history |
| Automated BOL generation | Save 15-30 minutes per trip for drivers | Medium | PDF generation from order data, digital signatures |
| Driver earnings dashboard (real-time) | Drivers see their pay without asking dispatch | Low-Medium | Calculate from completed trips, show pending vs paid |
| Vehicle inspection workflow (mobile) | Digital inspections replace paper forms | High | Photo capture, structured checklist, timestamp/GPS, customer signature |
| Load board integration (Central Dispatch, Super Dispatch) | Import loads directly, no double-entry | High | API integration, field mapping, conflict resolution |
| Custom branding per tenant | Enterprise carriers want their logo/colors | Low-Medium | Theme customization, white-label option |
| Expense tracking and categorization | Carriers track fuel, maintenance, tolls per trip | Medium | Receipt upload, categorization, per-trip cost allocation |
| Automated payment reminders | Reduce accounts receivable aging | Low | Scheduled emails for overdue invoices |
| Fleet maintenance scheduling | Prevent breakdowns with scheduled maintenance | Medium | Mileage/date-based triggers, service history |
| API access for enterprise integrations | Large carriers need to connect to their existing systems | High | RESTful API with tenant-scoped keys, rate limiting, documentation |

## Anti-Features

Features to explicitly NOT build. Common mistakes in the TMS SaaS domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Built-in GPS tracking / ELD integration | Extremely complex regulatory domain (FMCSA), existing solutions are mature (Samsara, KeepTruckin/Motive) | Integrate with existing ELD providers via API |
| Custom accounting system | Carriers already use QuickBooks, Sage, or FreshBooks | Export-friendly reports, eventual QuickBooks integration |
| Built-in payroll processing | Tax withholding, W-2/1099, state regulations | Calculate earnings, export to payroll providers (Gusto, ADP) |
| Route optimization engine | Requires real-time traffic data, map licensing, algorithmic complexity | Use Google Maps/Mapbox for basic routing, partner with route optimization API for advanced needs |
| Built-in messaging/chat | Carriers use text/WhatsApp/Teams already | Push notifications for status changes, deep links to call/text |
| Multi-language support at launch | Vehicle transport in the US is primarily English | Design for i18n but do not translate until there is demand |
| Offline-first web dashboard | Dispatchers work from offices with internet | Offline support for the mobile driver app only |

## Feature Dependencies

```
Tenant Creation (Supabase Auth + Stripe)
  |
  +--> User Roles & Permissions
  |     |
  |     +--> All tenant-scoped features
  |
  +--> Stripe Subscription
        |
        +--> Tier Enforcement (feature flags)
        |     |
        |     +--> All tier-gated features
        |
        +--> Billing Portal

Orders
  |
  +--> Trips (orders grouped into trips)
  |     |
  |     +--> Dispatch Board (visual trip/order management)
  |     |
  |     +--> Driver Assignment
  |           |
  |           +--> Mobile App Trip View
  |           |
  |           +--> Status Tracking (real-time)
  |
  +--> Invoices (generated from completed orders)
  |     |
  |     +--> Financial Reports
  |     |
  |     +--> Payment Tracking
  |
  +--> Documents (BOL, POD, rate confirmations)
        |
        +--> Automated BOL Generation
        |
        +--> Vehicle Inspections (mobile)
```

## MVP Recommendation

For MVP, prioritize:

1. **Tenant creation + auth + Stripe billing** (foundation -- nothing works without this)
2. **Order CRUD with status workflow** (core value proposition)
3. **Trip management with driver/truck assignment** (core dispatch workflow)
4. **Basic dispatch board** (list view with filters, not drag-and-drop)
5. **Invoice generation from completed orders** (carriers need to bill)
6. **Driver mobile app: trip list + status updates** (minimum field functionality)
7. **Basic financial reports** (revenue by period, per-driver, per-broker)

Defer to post-MVP:
- **Drag-and-drop dispatch board:** Start with a filterable list view. Add drag-and-drop when user feedback confirms it is the primary workflow.
- **Vehicle inspections:** Complex mobile workflow. Ship basic trip management first.
- **Load board integration:** Requires Central Dispatch/Super Dispatch API access and mapping logic. High value but high complexity.
- **AI-assisted dispatch:** Requires data (completed trips, driver patterns) that does not exist at launch.
- **Custom branding:** Nice-to-have for enterprise tier. Not needed for early carriers.
- **API access:** Build internal APIs well (they become the external API later), but do not document/expose until enterprise demand exists.

## Sources
- [Geotab: Top TMS Software](https://www.geotab.com/blog/tms-software/)
- [Fast Forward TMS: TMS for Carriers Guide](https://fastforwardtms.com/blogs/tms-for-carriers-guide/)
- [PCS Software: TMS Features for Carriers](https://pcssoft.com/blog/tms-features/)
- [PortPro: TMS Benefits and Features](https://portpro.io/blog/transportation-management-software-uses-benefits-and-features)
