import { describe, it, expect } from 'vitest'
import {
  cleanIrradiance,
  isAboveThreshold,
  specificProduction,
  rawPr,
  isAvailable,
  computeLostEnergy,
  computeLostIrradiance,
  totalAvailableEnergy,
  totalAvailableIrradiation,
  prClean,
  internalAvailability,
  computeInterval,
  aggregateDaily,
  aggregateDailyPlant,
} from '../engine'

// ---------------------------------------------------------------------------
// 1. cleanIrradiance
// ---------------------------------------------------------------------------
describe('cleanIrradiance', () => {
  it('averages when both pyros agree within 3%', () => {
    const r = cleanIrradiance(500, 510)
    expect(r.method).toBe('avg_pyro')
    expect(r.treated).toBe(505)
  })

  it('averages even when pyros disagree > 3% (LIAR 2.0)', () => {
    const r = cleanIrradiance(500, 600)
    expect(r.method).toBe('avg_pyro')
    expect(r.treated).toBe(550)
  })

  it('uses single pyro when one is null', () => {
    expect(cleanIrradiance(500, null).treated).toBe(500)
    expect(cleanIrradiance(null, 400).treated).toBe(400)
  })

  it('returns missing when both null', () => {
    const r = cleanIrradiance(null, null)
    expect(r.method).toBe('missing')
    expect(r.treated).toBeNull()
  })

  it('handles both zero', () => {
    const r = cleanIrradiance(0, 0)
    expect(r.treated).toBe(0)
    expect(r.method).toBe('avg_pyro')
  })
})

// ---------------------------------------------------------------------------
// 2. isAboveThreshold
// ---------------------------------------------------------------------------
describe('isAboveThreshold', () => {
  it('returns true for irr >= 75', () => {
    expect(isAboveThreshold(75)).toBe(true)
    expect(isAboveThreshold(100)).toBe(true)
  })

  it('returns false for irr < 75', () => {
    expect(isAboveThreshold(74.9)).toBe(false)
    expect(isAboveThreshold(0)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAboveThreshold(null)).toBe(false)
  })

  it('respects custom threshold', () => {
    expect(isAboveThreshold(50, 40)).toBe(true)
    expect(isAboveThreshold(30, 40)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. specificProduction
// ---------------------------------------------------------------------------
describe('specificProduction', () => {
  it('computes kWh/kWp correctly', () => {
    expect(specificProduction(100, 250)).toBeCloseTo(0.4)
  })

  it('returns null for null inputs', () => {
    expect(specificProduction(null, 250)).toBeNull()
    expect(specificProduction(100, null)).toBeNull()
  })

  it('returns null for zero Wp', () => {
    expect(specificProduction(100, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. rawPr (LIAR 2.0: returns FRACTION, not %)
// ---------------------------------------------------------------------------
describe('rawPr', () => {
  it('computes raw PR as fraction', () => {
    // specProd = 0.4 kWh/kWp, irr = 500 Wh/m2
    // PR = 0.4 / (500 * 0.001) = 0.4 / 0.5 = 0.8 (fraction)
    expect(rawPr(0.4, 500)).toBeCloseTo(0.8)
  })

  it('returns null for null inputs', () => {
    expect(rawPr(null, 500)).toBeNull()
    expect(rawPr(0.4, null)).toBeNull()
  })

  it('returns null for zero irradiance', () => {
    expect(rawPr(0.4, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. isAvailable (LIAR 2.0: PR-threshold based, LPr = 0.5)
// ---------------------------------------------------------------------------
describe('isAvailable', () => {
  it('returns true when PR >= LPr threshold (0.5)', () => {
    expect(isAvailable(0.8, 500)).toBe(true)
    expect(isAvailable(0.5, 500)).toBe(true)
  })

  it('returns false when PR < LPr threshold', () => {
    expect(isAvailable(0.49, 500)).toBe(false)
    expect(isAvailable(0.246, 500)).toBe(false) // Like LIAR inv14 example
  })

  it('returns false when no production (null PR)', () => {
    expect(isAvailable(null, 500)).toBe(false)
  })

  it('returns true when irradiance below threshold (not penalized)', () => {
    expect(isAvailable(null, 50)).toBe(true)
    expect(isAvailable(0.1, 30)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. computeLostEnergy / computeLostIrradiance
// ---------------------------------------------------------------------------
describe('computeLostEnergy', () => {
  it('returns actual production of unavailable inverter (LIAR 2.0)', () => {
    // LAEC/LAEO = actual production of unavailable inverter
    expect(computeLostEnergy(35.36)).toBeCloseTo(35.36)
    expect(computeLostEnergy(0)).toBe(0)
  })
})

describe('computeLostIrradiance', () => {
  it('returns the irradiance value directly', () => {
    expect(computeLostIrradiance(500)).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// 7. TAE / TAI (LIAR 2.0: SUBTRACTION)
// ---------------------------------------------------------------------------
describe('totalAvailableEnergy', () => {
  it('subtracts LAEO and LAEC from production', () => {
    // TAE = 1000 - 50 - 30 = 920
    expect(totalAvailableEnergy(1000, 50, 30)).toBe(920)
  })
})

describe('totalAvailableIrradiation', () => {
  it('subtracts LAIO and LAIC from EAI', () => {
    // TAI = 500 - 10 - 5 = 485
    expect(totalAvailableIrradiation(500, 10, 5)).toBe(485)
  })
})

// ---------------------------------------------------------------------------
// 8. prClean (LIAR 2.0: Prod / (EAI × sumCi × 0.001), fraction)
// ---------------------------------------------------------------------------
describe('prClean', () => {
  it('computes PR clean as fraction', () => {
    // Prod = 5000 kWh, EAI = 600 Wh/m2, sumCi = 10516.9 kWp
    // PR = 5000 / (600 * 10516.9 * 0.001) = 5000 / 6310.14 ≈ 0.7924
    const result = prClean(5000, 600, 10516.9)
    expect(result).toBeCloseTo(0.7924, 3)
  })

  it('returns null when EAI is zero', () => {
    expect(prClean(5000, 0, 10000)).toBeNull()
  })

  it('returns null when sumCi is zero', () => {
    expect(prClean(5000, 600, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 9. internalAvailability (LIAR 2.0: TAI / EAI, fraction)
// ---------------------------------------------------------------------------
describe('internalAvailability', () => {
  it('computes TAI/EAI as fraction', () => {
    // TAI = 900, EAI = 1000 → 0.9
    expect(internalAvailability(900, 1000)).toBeCloseTo(0.9)
  })

  it('returns 1.0 when no losses (TAI = EAI)', () => {
    expect(internalAvailability(1000, 1000)).toBeCloseTo(1.0)
  })

  it('returns null when EAI is zero', () => {
    expect(internalAvailability(0, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeInterval (integration)
// ---------------------------------------------------------------------------
describe('computeInterval', () => {
  const inverters = [
    { inverterId: 'INV 1-1', productionKwh: 100, rawProductionKwh: 100, peakPowerKwp: 250 },
    { inverterId: 'INV 1-2', productionKwh: 0, rawProductionKwh: 0, peakPowerKwp: 250 },
    { inverterId: 'INV 1-3', productionKwh: 95, rawProductionKwh: 95, peakPowerKwp: 250 },
  ]

  it('returns empty when irradiance below threshold', () => {
    const results = computeInterval(50, inverters, [], '2025-05-01 08:00:00')
    expect(results).toHaveLength(0)
  })

  it('detects unavailable inverter via PR threshold and computes lost energy', () => {
    const results = computeInterval(500, inverters, [], '2025-05-01 10:00:00')
    expect(results).toHaveLength(3)

    const inv12 = results.find(r => r.inverterId === 'INV 1-2')!
    expect(inv12.available).toBe(false)
    expect(inv12.rawPrFraction).toBeCloseTo(0) // 0 production → PR = 0 < LPr
    // LIAR 2.0: LAEC = actual production of unavailable inverter (0 here)
    expect(inv12.laecKwh).toBe(0)
    expect(inv12.laicWhm2).toBe(500) // Lost irradiance = treated irr
    expect(inv12.liability).toBe('contractor')
  })

  it('flags inverter with low PR as unavailable (LIAR LPr test)', () => {
    // Inv with production but PR < 0.5 (like LIAR inv14 example: PR=24.6%)
    const lowPrInverters = [
      { inverterId: 'INV 1-1', productionKwh: 100, rawProductionKwh: 100, peakPowerKwp: 250 }, // PR = 0.8
      { inverterId: 'INV 1-4', productionKwh: 51.5, rawProductionKwh: 51.5, peakPowerKwp: 250 }, // PR ≈ 0.412 < LPr
    ]
    const results = computeInterval(500, lowPrInverters, [], '2025-05-01 10:00:00')

    const inv14 = results.find(r => r.inverterId === 'INV 1-4')!
    expect(inv14.available).toBe(false) // PR 0.412 < LPr 0.5
    expect(inv14.rawPrFraction).toBeCloseTo(0.412, 2)
  })

  it('classifies operator liability from events', () => {
    const events = [{
      start_ts: '2025-05-01 08:00:00',
      end_ts: '2025-05-01 18:00:00',
      inverter_id: 'INV 1-2',
      liability: 'operator' as const,
    }]
    const results = computeInterval(500, inverters, events, '2025-05-01 10:00:00')

    const inv12 = results.find(r => r.inverterId === 'INV 1-2')!
    expect(inv12.liability).toBe('operator')
    // LIAR 2.0: LAEO = actual production (0 for this inverter)
    expect(inv12.laeoKwh).toBe(0)
    expect(inv12.laioWhm2).toBe(500) // Lost irradiance = treated irr
    expect(inv12.laecKwh).toBe(0)
  })

  it('handles all inverters producing normally', () => {
    const allProducing = [
      { inverterId: 'INV 1-1', productionKwh: 100, rawProductionKwh: 100, peakPowerKwp: 250 },
      { inverterId: 'INV 1-2', productionKwh: 95, rawProductionKwh: 95, peakPowerKwp: 250 },
    ]
    const results = computeInterval(500, allProducing, [], '2025-05-01 10:00:00')
    expect(results.every(r => r.available)).toBe(true)
    expect(results.every(r => r.laeoKwh === 0 && r.laecKwh === 0)).toBe(true)
  })

  it('handles all inverters down', () => {
    const allDown = [
      { inverterId: 'INV 1-1', productionKwh: 0, rawProductionKwh: 0, peakPowerKwp: 250 },
      { inverterId: 'INV 1-2', productionKwh: null, rawProductionKwh: null, peakPowerKwp: 250 },
    ]
    const results = computeInterval(500, allDown, [], '2025-05-01 10:00:00')
    expect(results.every(r => !r.available)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// aggregateDaily
// ---------------------------------------------------------------------------
describe('aggregateDaily', () => {
  it('aggregates intervals for a single inverter', () => {
    const intervals = [
      { inverterId: 'INV 1-1', productionKwh: 100, rawProductionKwh: 100, peakPowerKwp: 250, specProd: 0.4, rawPrFraction: 0.8, available: true, laeoKwh: 0, laecKwh: 0, laioWhm2: 0, laicWhm2: 0, liability: null },
      { inverterId: 'INV 1-1', productionKwh: 120, rawProductionKwh: 120, peakPowerKwp: 250, specProd: 0.48, rawPrFraction: 0.8, available: true, laeoKwh: 0, laecKwh: 0, laioWhm2: 0, laicWhm2: 0, liability: null },
    ]
    const irrPerInterval = [500, 600]

    const result = aggregateDaily('2025-05-01', 'INV 1-1', intervals, 250, irrPerInterval)
    expect(result.totalProductionKwh).toBe(220)
    expect(result.totalTreatedIrrWhm2).toBe(1100)
    expect(result.validIntervals).toBe(2)
    expect(result.availabilityFraction).toBeCloseTo(1.0) // No losses → TAI = EAI
    expect(result.prCleanFraction).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// aggregateDailyPlant (Wp-weighted LAIC/LAIO)
// ---------------------------------------------------------------------------
describe('aggregateDailyPlant', () => {
  it('aggregates all inverters into plant-level summary with Wp-weighted losses', () => {
    const intervals = [
      { inverterId: 'INV 1-1', productionKwh: 100, rawProductionKwh: 100, peakPowerKwp: 250, specProd: 0.4, rawPrFraction: 0.8, available: true, laeoKwh: 0, laecKwh: 0, laioWhm2: 0, laicWhm2: 0, liability: null },
      { inverterId: 'INV 1-2', productionKwh: 0, rawProductionKwh: 0, peakPowerKwp: 250, specProd: 0, rawPrFraction: 0, available: false, laeoKwh: 0, laecKwh: 50, laioWhm2: 0, laicWhm2: 500, liability: 'contractor' as const },
    ]
    const irrPerInterval = [500]
    const intervalsPerTimestamp = [intervals] // 1 timestamp with both inverters

    const result = aggregateDailyPlant('2025-05-01', intervals, 500, irrPerInterval, intervalsPerTimestamp)
    expect(result.inverterId).toBeNull()
    expect(result.totalProductionKwh).toBe(100)
    expect(result.peakPowerKwp).toBe(500)
    // Wp-weighted LAIC: 500 * (250/500) = 250 (not 500)
    expect(result.totalLaicWhm2).toBeCloseTo(250)
    // Availability = TAI/EAI = (500-250)/500 = 0.5
    expect(result.availabilityFraction).toBeCloseTo(0.5)
  })
})
