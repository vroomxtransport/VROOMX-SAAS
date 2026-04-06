// ============================================================================
// Forecasting Engine — Pure Functions, No Side Effects
// ============================================================================
//
// Implements: linear regression, seasonal decomposition, break-even projection
// All functions are stateless and deterministic.

export interface DataPoint {
  period: string // 'yyyy-MM' format, e.g. '2026-01'
  value: number
}

export interface ForecastResult {
  historical: DataPoint[]
  projected: DataPoint[]
  confidence: {
    upper: DataPoint[]
    lower: DataPoint[]
  }
  trend: 'up' | 'down' | 'flat'
  avgGrowthRate: number // monthly % change
}

export interface BreakEvenDataPoint {
  period: string
  revenue: number
  costs: number
}

export interface BreakEvenProjection {
  period: string
  breakEvenReached: boolean
  projectedRevenue: number
  projectedCosts: number
}

// ============================================================================
// Period Helpers
// ============================================================================

/**
 * Generate `count` future 'yyyy-MM' period strings starting after `lastPeriod`.
 * Example: generateFuturePeriods('2026-03', 3) → ['2026-04', '2026-05', '2026-06']
 */
export function generateFuturePeriods(lastPeriod: string, count: number): string[] {
  if (count <= 0) return []
  const [yearStr, monthStr] = lastPeriod.split('-')
  let year = parseInt(yearStr, 10)
  let month = parseInt(monthStr, 10) // 1-indexed

  const result: string[] = []
  for (let i = 0; i < count; i++) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    result.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return result
}

// ============================================================================
// Linear Regression Core
// ============================================================================

interface RegressionParams {
  slope: number
  intercept: number
  standardError: number
}

/**
 * Compute ordinary least-squares linear regression coefficients and
 * the standard error of the residuals.
 */
function computeRegression(values: number[]): RegressionParams {
  const n = values.length
  if (n === 0) return { slope: 0, intercept: 0, standardError: 0 }
  if (n === 1) return { slope: 0, intercept: values[0], standardError: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // Standard error of regression (residuals)
  let sse = 0
  for (let i = 0; i < n; i++) {
    const residual = values[i] - (slope * i + intercept)
    sse += residual * residual
  }
  // Use n-2 degrees of freedom (minimum 1 to avoid div by zero)
  const standardError = n > 2 ? Math.sqrt(sse / (n - 2)) : 0

  return { slope, intercept, standardError }
}

/**
 * Detect trend direction from slope relative to the mean value scale.
 * Threshold of 0.01 means 1% of mean per period.
 */
function detectTrend(slope: number, values: number[]): 'up' | 'down' | 'flat' {
  if (values.length === 0) return 'flat'
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  // Normalise slope against mean so we compare relative change
  const normSlope = mean !== 0 ? slope / Math.abs(mean) : slope
  if (normSlope > 0.01) return 'up'
  if (normSlope < -0.01) return 'down'
  return 'flat'
}

/**
 * Compute average month-over-month growth rate from data values.
 * Returns percentage (e.g. 5.2 = 5.2%).
 */
function computeAvgGrowthRate(values: number[]): number {
  if (values.length < 2) return 0
  let totalRate = 0
  let count = 0
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]
    const curr = values[i]
    if (prev !== 0) {
      totalRate += ((curr - prev) / Math.abs(prev)) * 100
      count += 1
    }
  }
  return count > 0 ? Math.round((totalRate / count) * 100) / 100 : 0
}

// ============================================================================
// Linear Forecast
// ============================================================================

/**
 * Project `periodsAhead` future data points using simple OLS linear regression.
 * Confidence bands are ±1 standard error of the regression residuals.
 *
 * Returns empty `projected` / `confidence` when fewer than 3 data points.
 */
export function linearForecast(data: DataPoint[], periodsAhead: number): ForecastResult {
  const historical = data.map((d) => ({ period: d.period, value: d.value }))
  const values = data.map((d) => d.value)
  const avgGrowthRate = computeAvgGrowthRate(values)
  const trend = detectTrend(
    values.length >= 2 ? computeRegression(values).slope : 0,
    values
  )

  // Edge case: fewer than 3 data points → no projection
  if (data.length < 3 || periodsAhead <= 0) {
    return {
      historical,
      projected: [],
      confidence: { upper: [], lower: [] },
      trend,
      avgGrowthRate,
    }
  }

  const { slope, intercept, standardError } = computeRegression(values)
  const n = values.length

  const futurePeriods = generateFuturePeriods(data[data.length - 1].period, periodsAhead)

  const projected: DataPoint[] = []
  const upper: DataPoint[] = []
  const lower: DataPoint[] = []

  for (let i = 0; i < periodsAhead; i++) {
    const idx = n + i
    const predictedValue = slope * idx + intercept
    const period = futurePeriods[i]

    projected.push({ period, value: Math.round(predictedValue * 100) / 100 })
    upper.push({ period, value: Math.round((predictedValue + standardError) * 100) / 100 })
    lower.push({ period, value: Math.round((predictedValue - standardError) * 100) / 100 })
  }

  return {
    historical,
    projected,
    confidence: { upper, lower },
    trend,
    avgGrowthRate,
  }
}

// ============================================================================
// Seasonal Forecast
// ============================================================================

/**
 * Seasonal decomposition forecast. Requires at least 12 months of data.
 * Falls back to linearForecast when fewer than 12 data points are available.
 *
 * Algorithm:
 *  1. Compute centred 12-month moving average (trend component)
 *  2. Derive seasonal indices: value / trend for each month position
 *  3. Average seasonal indices across years → 12 normalised indices
 *  4. Project trend forward with OLS regression on the trend values
 *  5. Apply seasonal index for each projected month
 */
export function seasonalForecast(data: DataPoint[], periodsAhead: number): ForecastResult {
  if (data.length < 12) {
    return linearForecast(data, periodsAhead)
  }

  const values = data.map((d) => d.value)
  const n = values.length

  // --- Step 1: 12-month centred moving average ---
  // A centred 12-month MA uses 13 points (weighted: 0.5 * endpoints + 1 * middle 11)
  // producing a trend value for indices 6 … n-7
  const trendValues: (number | null)[] = new Array(n).fill(null)

  for (let i = 6; i <= n - 7; i++) {
    // 2×12 centred MA: average of MA[i-0.5] and MA[i+0.5]
    let sum = 0
    for (let j = i - 5; j <= i + 6; j++) {
      sum += values[j]
    }
    // This gives us a 12-point MA centred between i and i+1.
    // We need two such MAs and average them. Shortcut: sum 13 points with half-weight on ends.
    sum = 0.5 * values[i - 6] + values[i - 5] + values[i - 4] + values[i - 3] +
      values[i - 2] + values[i - 1] + values[i] + values[i + 1] +
      values[i + 2] + values[i + 3] + values[i + 4] + values[i + 5] +
      0.5 * values[i + 6]
    trendValues[i] = sum / 12
  }

  // --- Step 2: Seasonal ratios ---
  // Accumulate ratios per month-of-year index (0-11)
  const monthAccum: number[][] = Array.from({ length: 12 }, () => [])

  for (let i = 0; i < n; i++) {
    const trend = trendValues[i]
    if (trend === null || trend === 0) continue
    // Determine which month-of-year this index corresponds to
    // Parse the period string to get the month
    const parts = data[i].period.split('-')
    if (parts.length < 2) continue
    const monthIdx = parseInt(parts[1], 10) - 1 // 0-indexed
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) continue
    monthAccum[monthIdx].push(values[i] / trend)
  }

  // --- Step 3: Normalise seasonal indices ---
  const rawIndices = monthAccum.map((arr) => {
    if (arr.length === 0) return 1
    return arr.reduce((a, b) => a + b, 0) / arr.length
  })
  const indexSum = rawIndices.reduce((a, b) => a + b, 0)
  // Scale so indices sum to 12
  const scaleFactor = indexSum !== 0 ? 12 / indexSum : 1
  const seasonalIndices = rawIndices.map((s) => s * scaleFactor)

  // --- Step 4: OLS regression on trend values (non-null only) ---
  const trendNonNull: { idx: number; val: number }[] = []
  for (let i = 0; i < n; i++) {
    if (trendValues[i] !== null) {
      trendNonNull.push({ idx: i, val: trendValues[i] as number })
    }
  }

  let trendSlope = 0
  let trendIntercept = 0
  let trendStdError = 0

  if (trendNonNull.length >= 2) {
    const tn = trendNonNull.length
    let sX = 0, sY = 0, sXY = 0, sX2 = 0
    for (const { idx, val } of trendNonNull) {
      sX += idx; sY += val; sXY += idx * val; sX2 += idx * idx
    }
    const denom = tn * sX2 - sX * sX
    trendSlope = denom === 0 ? 0 : (tn * sXY - sX * sY) / denom
    trendIntercept = (sY - trendSlope * sX) / tn

    // Standard error on trend regression
    let sse = 0
    for (const { idx, val } of trendNonNull) {
      const res = val - (trendSlope * idx + trendIntercept)
      sse += res * res
    }
    trendStdError = tn > 2 ? Math.sqrt(sse / (tn - 2)) : 0
  }

  // --- Step 5: Project forward ---
  const futurePeriods = generateFuturePeriods(data[data.length - 1].period, periodsAhead)
  const projected: DataPoint[] = []
  const upper: DataPoint[] = []
  const lower: DataPoint[] = []

  for (let i = 0; i < periodsAhead; i++) {
    const futureIdx = n + i
    const parts = futurePeriods[i].split('-')
    const monthIdx = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : 0
    const sIndex = (monthIdx >= 0 && monthIdx <= 11) ? seasonalIndices[monthIdx] ?? 1 : 1
    const projectedTrend = trendSlope * futureIdx + trendIntercept
    const projectedValue = projectedTrend * sIndex

    projected.push({ period: futurePeriods[i], value: Math.round(projectedValue * 100) / 100 })
    upper.push({
      period: futurePeriods[i],
      value: Math.round((projectedValue + trendStdError * sIndex) * 100) / 100,
    })
    lower.push({
      period: futurePeriods[i],
      value: Math.round((projectedValue - trendStdError * sIndex) * 100) / 100,
    })
  }

  const avgGrowthRate = computeAvgGrowthRate(values)
  const trend = detectTrend(trendSlope, values)

  return {
    historical: data.map((d) => ({ period: d.period, value: d.value })),
    projected,
    confidence: { upper, lower },
    trend,
    avgGrowthRate,
  }
}

// ============================================================================
// Break-Even Forecast
// ============================================================================

/**
 * Project revenue and costs independently using linear regression and report
 * whether the projected revenue exceeds projected costs each period.
 */
export function breakEvenForecast(
  data: BreakEvenDataPoint[],
  periodsAhead: number
): BreakEvenProjection[] {
  if (data.length < 3 || periodsAhead <= 0) return []

  const revenues = data.map((d) => d.revenue)
  const costs = data.map((d) => d.costs)

  const revReg = computeRegression(revenues)
  const costReg = computeRegression(costs)
  const n = data.length

  const futurePeriods = generateFuturePeriods(data[data.length - 1].period, periodsAhead)

  return futurePeriods.map((period, i) => {
    const idx = n + i
    const projectedRevenue = Math.max(0, Math.round((revReg.slope * idx + revReg.intercept) * 100) / 100)
    const projectedCosts = Math.max(0, Math.round((costReg.slope * idx + costReg.intercept) * 100) / 100)

    return {
      period,
      breakEvenReached: projectedRevenue >= projectedCosts,
      projectedRevenue,
      projectedCosts,
    }
  })
}
