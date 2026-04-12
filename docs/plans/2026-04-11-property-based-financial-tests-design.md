# Property-Based Financial Tests — Design

**Date:** 2026-04-11
**Author:** Claude (with operator approval)
**Status:** Approved — ready for implementation

## Problem

Three pure calculation engines handle all money math in VroomX:

- `src/lib/financial/trip-calculations.ts` — driver pay across 5 pay models + trip net profit
- `src/lib/financial/kpi-calculations.ts` — dashboard KPIs (RPM, CPM, margins, fleet metrics)
- `src/lib/financial/pnl-calculations.ts` — full P&L waterfall + unit metrics

CLAUDE.md calls out the carrier walk-away risk explicitly: a bug in any of these ships as a customer-visible money error. Existing tests are hand-picked tables (`trip-calculations.test.ts`, `pnl-calculations.test.ts`) that cover the scenarios someone thought to write down. They miss algebraic bugs — things like "forgot to subtract local fee", "order of operations wrong", "off-by-one in reduce".

## Goal

Add a property-based test suite that asserts algebraic invariants the engines must satisfy *for all valid inputs*, not just hand-picked ones. Treat it as a safety net layered on top of the existing unit tests, not a replacement.

## Non-goals

- Replacing existing unit tests (they stay, for regression clarity on concrete scenarios)
- Testing impure code (server actions, Supabase queries, React components)
- Monotonicity laws — deferred to a future pass
- Stateful testing (fast-check model-based testing)

## Approach

### Tooling

Single new devDependency: **`fast-check`** (MIT, ~80KB, zero runtime deps). Industry standard for property-based testing in TypeScript. Works out of the box with vitest — no config changes needed.

### Number model

All generated monetary values produced as **integer cents** internally, then divided by 100 before passing to calc functions. Matches `numeric(12,2)` DB precision and gives us exact equality on addition/subtraction, avoiding `toBeCloseTo` flakiness on conservation laws. Percentage multiplication still needs `toBeCloseTo` with a cents-scale tolerance (`1e-9`).

### File layout

```
src/lib/financial/__tests__/
├── trip-calculations.test.ts                    (existing, untouched)
├── pnl-calculations.test.ts                     (existing, untouched)
└── properties/
    ├── generators.ts                            (shared fast-check arbitraries)
    ├── trip-calculations.property.test.ts       (new)
    ├── kpi-calculations.property.test.ts        (new)
    └── pnl-calculations.property.test.ts        (new)
```

Vitest picks these up automatically via its default `*.test.ts` glob.

### Generators (shared)

`properties/generators.ts` exports:

- `arbMoney(maxDollars)` — integer cents in `[0, maxDollars * 100]`, returned as dollars
- `arbMoneyNonNeg(maxDollars)` — same, non-negative
- `arbPercent()` — integer in `[0, 100]`
- `arbDistance()` — integer in `[0, 5000]` miles (plus 30% chance of `null`)
- `arbVehicleCount()` — integer in `[1, 10]`
- `arbOrder()` — `OrderFinancials` with `revenue > broker + local` constrained so cleanGross ≥ 0
- `arbOrders(min, max)` — array of `[min, max]` orders
- `arbDriver(payType?)` — `DriverConfig` with optional pay type pin
- `arbExpenses()` — array of `TripExpenseItem`
- `arbCarrierPay()` — money
- `arbKPIInput()` — constrained `KPIInput`
- `arbPnLInput()` — constrained `PnLInput`

All arbitraries use `fc.record` with realistic bounds (max revenue $100K, max fleet 50 trucks, etc.) so shrunk counterexamples are human-readable.

### Invariants to assert

**`trip-calculations.property.test.ts` (~15 properties):**

1. `cleanGross === revenue − brokerFees − localFees` (for any orders)
2. `truckGross === cleanGross − driverPay`
3. `netProfit === revenue − brokerFees − localFees − driverPay − expenses − carrierPay`
4. `orderCount === orders.length`
5. `totalMiles === Σ orders.distanceMiles`
6. `appc === revenue / orderCount` when `orderCount > 0`, else `null`
7. `rpm === revenue / totalMiles` when miles > 0, else `null`
8. Empty orders → all numeric outputs zero, all per-unit outputs null
9. `driver === null` → `driverPay === 0`
10. Order shuffling preserves every output (order-independence)
11. Doubling every monetary input (and leaving percentages/miles fixed) doubles revenue, broker, local, cleanGross, truckGross, netProfit (linearity)
12. For `per_car`: `driverPay === payRate × Σ vehicleCount`
13. For `per_mile`: `driverPay === payRate × totalMiles`
14. **Cross-model check:** for any order set, running the same orders once with `percentage_of_carrier_pay` at rate `r` and once with `dispatch_fee_percent` at rate `100 − r` produces driver pays that sum to exactly `cleanGross` (within float tolerance). This is the dispatch fee complement law.
15. Per-order override precedence: setting `driverPayRateOverride` on one order and leaving another null is equivalent to running each order separately and summing

**`kpi-calculations.property.test.ts` (~8 properties):**

1. `netProfit === totalRevenue − totalExpenses`
2. `totalExpenses === brokerFees + localFees + driverPay + tripExpenses + carrierPay`
3. `cleanGross === totalRevenue − totalBrokerFees − totalLocalFees`
4. `truckGross === cleanGross − totalDriverPay`
5. `operatingRatio + netMargin === 100` (when revenue > 0, within tolerance)
6. Per-mile metrics null iff `totalMiles === 0`
7. Fleet metrics null iff `truckCount === 0`
8. Break-even consistency: when `breakEvenRevenue !== null`, `breakEvenRevenue × grossProfitMarginRatio ≈ totalFixedExpenses`

**`pnl-calculations.property.test.ts` (~10 properties):**

1. `cleanGross === revenue − brokerFees − localFees`
2. `truckGross === cleanGross − driverPay`
3. `directTripCosts === fuel + tolls + maintenance + lodging + misc`
4. `totalOperatingExpenses === fixedCosts + directTripCosts + carrierPay`
5. `netProfitBeforeTax === truckGross − totalOperatingExpenses`
6. `netMargin === (netProfitBeforeTax / revenue) × 100` when revenue > 0, else 0
7. Full chain: `netProfitBeforeTax === revenue − brokerFees − localFees − driverPay − fixedCosts − directTripCosts − carrierPay`
8. `calculateUnitMetrics`: all per-truck metrics null iff `truckCount === 0`
9. All per-trip metrics null iff `completedTripCount === 0`
10. All per-mile metrics null iff `totalMiles === 0`

### Floating-point tolerance

- **Exact equality (`.toBe()`)** for sums/differences of cent-precise values (rule-of-thumb: if no multiplication by a percentage is involved, it's exact)
- **`.toBeCloseTo(expected, 4)`** (four decimal places) for invariants that involve percentage multiplication

### Run budget

`fast-check` defaults: 100 runs per property, ~10ms per run → full suite <1s. Good for CI. Seed pinning on failures is automatic via fast-check's output.

## Verification

After implementation:

1. `npx vitest run src/lib/financial/__tests__/properties` — full property suite must pass
2. `npx vitest run src/lib/financial` — existing tests must still pass (no regression)
3. `npx tsc --noEmit` — zero type errors
4. Open a generated failure (temporarily break one calc to confirm the property test catches it and produces a readable counterexample), then revert

## Out of scope for this pass

- Property tests for `src/lib/financial/driver-pay.ts`, `dispatcher-calculations.ts`, `forecasting.ts` (different engines, future pass)
- Monotonicity laws ("increasing revenue never decreases cleanGross")
- Stateful testing
- Coverage threshold bump in `vitest.config.ts`
