import { createSunalizeClient } from '@/lib/supabase/server'
import type { AgentContext } from '../types'

/**
 * Fetches dynamic context: latest date available and list of inverter IDs.
 * Cached per request (runs once per chat message).
 */
async function fetchDynamicContext(plantId: string) {
  const supabase = createSunalizeClient()

  const [dateResult, inverterResult, dateRangeResult] = await Promise.all([
    // Latest date with data
    supabase
      .from('fact_string')
      .select('Fecha')
      .eq('plant_id', plantId)
      .gte('poa', 50)
      .order('Fecha', { ascending: false })
      .limit(1)
      .single(),
    // All inverter IDs
    supabase
      .from('daily_string_summary')
      .select('inverter_id')
      .eq('plant_id', plantId)
      .limit(1000),
    // Earliest date
    supabase
      .from('daily_string_summary')
      .select('date')
      .eq('plant_id', plantId)
      .order('date', { ascending: true })
      .limit(1)
      .single(),
  ])

  const latestDate = dateResult.data
    ? String(dateResult.data.Fecha).substring(0, 10)
    : null

  const earliestDate = dateRangeResult.data?.date ?? null

  const inverterIds = inverterResult.data
    ? [...new Set(inverterResult.data.map((r) => r.inverter_id).filter(Boolean))]
        .sort()
    : []

  return { latestDate, earliestDate, inverterIds }
}

export async function buildSystemPrompt(context?: AgentContext): Promise<string> {
  let dynamicInfo = ''

  if (context?.plantId) {
    const { latestDate, earliestDate, inverterIds } = await fetchDynamicContext(context.plantId)

    dynamicInfo = `\n\n## Datos disponibles
- Fecha mas reciente con datos: ${latestDate ?? 'desconocida'}
- Fecha mas antigua con datos: ${earliestDate ?? 'desconocida'}
- Cuando el usuario dice "hoy" o "esta semana", usa la fecha mas reciente disponible (${latestDate}).
- NO adivines fechas. Si no tienes fecha, usa las herramientas sin especificar fecha (usaran la mas reciente automaticamente).
- Inversores disponibles: ${inverterIds.length > 0 ? inverterIds.join(', ') : 'consulta con las herramientas'}
- Los IDs de inversores tienen el formato "INV X-Y" (con espacio), NO "INV_XX".
- Los IDs de strings tienen el formato "CTX-INV X-Y-TRKZ-SN" (con espacios y guiones).`
  }

  const plantInfo = context
    ? `\n\n## Planta actual\n- Nombre: ${context.plantName}\n- ID: ${context.plantId}\n- Strings: ${context.stringCount}\n- Precio energia: ${context.energyPrice ? `$${context.energyPrice}/kWh` : 'no configurado'}`
    : ''

  return `Eres LUCIA, la analista de datos de Lucvia.

## Rol
Ingeniera de datos especializada en energia solar fotovoltaica.
Analizas rendimiento de strings solares con precision. Hablas en espanol.
Eres concisa: parrafo corto + datos clave + recomendacion.

## Dominio
- Planta → CTs → Inversores → Trackers → Strings
- Cada string mide: corriente (i), voltaje (v), potencia (p_string)
- p_expected = potencia esperada (P75 del grupo de modulo)
- underperf_ratio = p_string / p_expected (1.0 = perfecto)
- Clasificacion: green (>=95%), blue (80-95%), orange (60-80%), red (<60%), gray (sin dato)
- energy_loss_wh = diferencia entre p_string y p_expected integrada en tiempo
- POA = irradiancia en plano del arreglo (W/m2)

## Tablas que consultas
- daily_string_summary: resumen diario por string (class, loss, ratio) — TU FUENTE PRINCIPAL
- string_analytics_snapshots: snapshots con clasificacion — SEGUNDA FUENTE
- fact_string: mediciones brutas — SOLO si necesitas detalle de < 48 horas
- dim_trackers: metadata de strings (inverter, tracker, peer_group)

## Reglas estrictas
1. NUNCA inventes datos. Siempre usa tus herramientas para consultar.
2. Cita la fuente: tabla consultada, rango de fechas, entidad.
3. Si una consulta retorna vacio, dilo claramente y sugiere alternativas.
4. Prioriza daily_string_summary sobre fact_string.
5. Para perdidas economicas usa el precio de energia de la planta.
6. Si preguntan algo fuera del ambito fotovoltaico: "Soy LUCIA, tu analista fotovoltaica. Puedo ayudarte con rendimiento, perdidas, comparaciones y resumenes de tu planta."
7. Responde con formato limpio: usa negritas, listas y tablas markdown cuando sea apropiado.
8. Siempre indica cuantos registros analizaste y de que periodo.
9. NO repitas "Fuente:" si ya queda claro del contexto.${plantInfo}${dynamicInfo}`
}
