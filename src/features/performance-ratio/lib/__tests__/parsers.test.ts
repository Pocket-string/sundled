import { describe, it, expect } from 'vitest'
import {
  parseIrradianceCsv,
  cleanIrradianceRows,
  validateDualPyranometer,
} from '../etl/parseIrradianceCsv'
import {
  parseInverterProductionCsv,
  parseMeterCsv,
} from '../etl/parseProductionCsv'
import {
  buildFactIrradiance,
  buildFactInverterProduction,
  buildFactMeterProduction,
} from '../etl/buildPrFacts'
import type { DimInverter } from '../../types'

// ---------------------------------------------------------------------------
// parseIrradianceCsv
// ---------------------------------------------------------------------------
describe('parseIrradianceCsv', () => {
  const CSV = [
    'Medida;Fecha;Meteo - INSTANT RADIATION POA1_UP DIRECTO (W/m2);Meteo - INSTANT RADIATION POA2_UP DIRECTO (W/m2)',
    '0;01 may. 2025 01:00;0;0',
    '1;01 may. 2025 08:00;529.6;540.2',
    '2;01 may. 2025 12:00;856.01;794.15',
  ].join('\n')

  it('parses all data rows', () => {
    const rows = parseIrradianceCsv(CSV)
    expect(rows).toHaveLength(3)
  })

  it('normalizes timestamps', () => {
    const rows = parseIrradianceCsv(CSV)
    expect(rows[0].fecha).toBe('2025-05-01 01:00:00')
    expect(rows[1].fecha).toBe('2025-05-01 08:00:00')
  })

  it('parses numeric values correctly', () => {
    const rows = parseIrradianceCsv(CSV)
    expect(rows[1].pyranometer1Whm2).toBe(529.6)
    expect(rows[1].pyranometer2Whm2).toBe(540.2)
  })

  it('handles BOM', () => {
    const bomCsv = '\uFEFF' + CSV
    const rows = parseIrradianceCsv(bomCsv)
    expect(rows).toHaveLength(3)
  })

  it('returns empty for empty input', () => {
    expect(parseIrradianceCsv('')).toHaveLength(0)
    expect(parseIrradianceCsv('header only')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// validateDualPyranometer
// ---------------------------------------------------------------------------
describe('validateDualPyranometer', () => {
  it('averages when both agree within 3%', () => {
    const result = validateDualPyranometer(500, 510)
    expect(result.method).toBe('avg_pyro')
    expect(result.treated).toBe(505)
  })

  it('averages even when pyranometers disagree > 3% (LIAR 2.0)', () => {
    const result = validateDualPyranometer(500, 600)
    expect(result.method).toBe('avg_pyro')
    expect(result.treated).toBe(550)
  })

  it('uses single pyro when one is null', () => {
    const r1 = validateDualPyranometer(500, null)
    expect(r1.method).toBe('single_pyro')
    expect(r1.treated).toBe(500)

    const r2 = validateDualPyranometer(null, 400)
    expect(r2.method).toBe('single_pyro')
    expect(r2.treated).toBe(400)
  })

  it('returns missing when both are null', () => {
    const result = validateDualPyranometer(null, null)
    expect(result.method).toBe('missing')
    expect(result.treated).toBeNull()
  })

  it('handles both zero correctly', () => {
    const result = validateDualPyranometer(0, 0)
    expect(result.method).toBe('avg_pyro')
    expect(result.treated).toBe(0)
  })

  it('handles negative values as invalid', () => {
    const result = validateDualPyranometer(-10, 500)
    expect(result.method).toBe('single_pyro')
    expect(result.treated).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// cleanIrradianceRows
// ---------------------------------------------------------------------------
describe('cleanIrradianceRows', () => {
  it('sets aboveThreshold correctly', () => {
    const raw = [
      { fecha: '2025-05-01 08:00:00', pyranometer1Whm2: 100, pyranometer2Whm2: 100 },
      { fecha: '2025-05-01 01:00:00', pyranometer1Whm2: 10, pyranometer2Whm2: 10 },
    ]
    const clean = cleanIrradianceRows(raw)
    expect(clean[0].aboveThreshold).toBe(true)
    expect(clean[1].aboveThreshold).toBe(false)
  })

  it('respects custom threshold', () => {
    const raw = [
      { fecha: '2025-05-01 08:00:00', pyranometer1Whm2: 50, pyranometer2Whm2: 50 },
    ]
    const clean = cleanIrradianceRows(raw, 40)
    expect(clean[0].aboveThreshold).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseInverterProductionCsv
// ---------------------------------------------------------------------------
describe('parseInverterProductionCsv', () => {
  const CSV = [
    'Medida;Fecha;INV 1-1 - ENERGIA ACTIVA TOTAL EXPORTADA (kWh);INV 1-2 - ENERGIA ACTIVA TOTAL EXPORTADA (kWh);INV 2-1 - ENERGIA ACTIVA TOTAL EXPORTADA (kWh)',
    '0;28 abr. 2025 08:00;42;38;45',
    '1;28 abr. 2025 09:00;109;;120',
  ].join('\n')

  it('parses and unpivots all inverter columns', () => {
    const rows = parseInverterProductionCsv(CSV)
    // 2 timestamps × 3 inverters = 6 rows
    expect(rows).toHaveLength(6)
  })

  it('extracts correct inverter IDs', () => {
    const rows = parseInverterProductionCsv(CSV)
    const ids = [...new Set(rows.map(r => r.inverterId))]
    expect(ids).toEqual(['INV 1-1', 'INV 1-2', 'INV 2-1'])
  })

  it('handles empty cells as null', () => {
    const rows = parseInverterProductionCsv(CSV)
    const inv12Hour9 = rows.find(r => r.inverterId === 'INV 1-2' && r.fecha.includes('09:00'))
    expect(inv12Hour9?.productionKwh).toBeNull()
  })

  it('parses numeric values correctly', () => {
    const rows = parseInverterProductionCsv(CSV)
    const inv11Hour8 = rows.find(r => r.inverterId === 'INV 1-1' && r.fecha.includes('08:00'))
    expect(inv11Hour8?.productionKwh).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// parseMeterCsv
// ---------------------------------------------------------------------------
describe('parseMeterCsv', () => {
  const CSV = [
    'Medida;Fecha;ION7400 - ENERGIA ACTIVA EXPORTADA (kWh);ION7400 - ENERGIA ACTIVA IMPORTADA (kWh);ION8650 - ENERGIA ACTIVA EXPORTADA (kWh);ION8650 - ENERGIA ACTIVA IMPORTADA (kWh)',
    '0;01 may. 2025 01:00;7.73;0;8;0',
    '1;01 may. 2025 02:00;7.72;0;8;0',
  ].join('\n')

  it('parses both meters', () => {
    const rows = parseMeterCsv(CSV)
    // 2 timestamps × 2 meters = 4 rows
    expect(rows).toHaveLength(4)
  })

  it('extracts meter IDs', () => {
    const rows = parseMeterCsv(CSV)
    const ids = [...new Set(rows.map(r => r.meterId))]
    expect(ids).toEqual(['ION7400', 'ION8650'])
  })

  it('parses decimal values', () => {
    const rows = parseMeterCsv(CSV)
    const ion7400 = rows.find(r => r.meterId === 'ION7400' && r.fecha.includes('01:00'))
    expect(ion7400?.exportedKwh).toBe(7.73)
    expect(ion7400?.importedKwh).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildPrFacts
// ---------------------------------------------------------------------------
describe('buildFactIrradiance', () => {
  it('maps clean rows to fact schema', () => {
    const clean = [{
      fecha: '2025-05-01 08:00:00',
      pyranometer1Whm2: 500,
      pyranometer2Whm2: 510,
      treatedIrrWhm2: 505,
      validationMethod: 'avg_pyro' as const,
      aboveThreshold: true,
    }]
    const facts = buildFactIrradiance(clean, 'PLT_A')
    expect(facts).toHaveLength(1)
    expect(facts[0].plant_id).toBe('PLT_A')
    expect(facts[0].Fecha).toBe('2025-05-01 08:00:00')
    expect(facts[0].treated_irr_whm2).toBe(505)
    expect(facts[0].solargis_whm2).toBeNull()
  })
})

describe('buildFactInverterProduction', () => {
  const inverters: DimInverter[] = [
    { plant_id: 'PLT_A', inverter_id: 'INV 1-1', ct_id: 'CT1', peak_power_kwp: 241.92 },
    { plant_id: 'PLT_A', inverter_id: 'INV 2-1', ct_id: 'CT2', peak_power_kwp: 302.4 },
  ]

  it('joins with dim_inverters for Wp', () => {
    const prod = [
      { fecha: '2025-05-01 08:00:00', inverterId: 'INV 1-1', productionKwh: 42 },
      { fecha: '2025-05-01 08:00:00', inverterId: 'INV 2-1', productionKwh: 55 },
    ]
    const facts = buildFactInverterProduction(prod, inverters, 'PLT_A')
    expect(facts[0].peak_power_kwp).toBe(241.92)
    expect(facts[1].peak_power_kwp).toBe(302.4)
  })

  it('returns null Wp for unknown inverter', () => {
    const prod = [
      { fecha: '2025-05-01 08:00:00', inverterId: 'INV 9-9', productionKwh: 10 },
    ]
    const facts = buildFactInverterProduction(prod, inverters, 'PLT_A')
    expect(facts[0].peak_power_kwp).toBeNull()
  })

  it('sanitizes NaN to null', () => {
    const prod = [
      { fecha: '2025-05-01 08:00:00', inverterId: 'INV 1-1', productionKwh: NaN },
    ]
    const facts = buildFactInverterProduction(prod, inverters, 'PLT_A')
    expect(facts[0].production_kwh).toBeNull()
  })
})

describe('buildFactMeterProduction', () => {
  it('creates synthetic meter IDs', () => {
    const meters = [
      { fecha: '2025-05-01 01:00:00', meterId: 'ION7400', exportedKwh: 7.73, importedKwh: 0 },
    ]
    const facts = buildFactMeterProduction(meters, 'PLT_A')
    expect(facts[0].inverter_id).toBe('METER_ION7400')
    expect(facts[0].production_kwh).toBe(7.73)
    expect(facts[0].peak_power_kwp).toBeNull()
  })
})
