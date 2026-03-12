'use client'

import { FileUpload } from './FileUpload'
import { GpmConfigForm } from './GpmConfigForm'
import { uploadTrackersCsv, uploadSvgLayout } from '@/actions/plants'
import type { Plant } from '@/types/database'

interface Props {
  plant: Plant
  trackerCount: number
  layoutCount: number
  hasIntegration: boolean
  queryIds: Record<string, string> | null
}

export function PlantSettingsClient({ plant, trackerCount, layoutCount, hasIntegration, queryIds }: Props) {
  return (
    <div className="space-y-6">
      {/* Onboarding Status */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Estado del onboarding</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatusStep
            label="Datos basicos"
            done={true}
            detail={`${plant.string_count} strings`}
          />
          <StatusStep
            label="Trackers.csv"
            done={trackerCount > 0}
            detail={trackerCount > 0 ? `${trackerCount} registros` : 'Pendiente'}
          />
          <StatusStep
            label="SVG Layout"
            done={layoutCount > 0}
            detail={layoutCount > 0 ? `${layoutCount} elementos` : 'Pendiente'}
          />
          <StatusStep
            label="Integracion GPM"
            done={hasIntegration}
            detail={hasIntegration ? 'Configurado' : 'Pendiente'}
          />
        </div>
      </div>

      {/* Plant Info */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Informacion de la planta</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label="Nombre" value={plant.name} />
          <InfoRow label="Timezone" value={plant.timezone} />
          <InfoRow label="Latitud" value={plant.lat?.toString() ?? '—'} />
          <InfoRow label="Longitud" value={plant.lon?.toString() ?? '—'} />
          <InfoRow label="CTs" value={plant.ct_count.toString()} />
          <InfoRow label="Inversores" value={plant.inverter_count.toString()} />
          <InfoRow label="Potencia modulo" value={plant.module_power_w ? `${plant.module_power_w} W` : '—'} />
          <InfoRow label="Precio energia" value={plant.energy_price ? `${plant.energy_price} ${plant.currency}` : '—'} />
          <InfoRow label="Portal" value={plant.portal_type ?? 'No configurado'} />
          <InfoRow label="Ultima sync" value={plant.last_sync_at ? new Date(plant.last_sync_at).toLocaleString('es-CL') : 'Nunca'} />
        </dl>
      </div>

      {/* File Uploads */}
      <FileUpload
        label="Subir Trackers.csv"
        accept=".csv"
        description="Archivo CSV con columnas: CT, Inverter, Tracker, String, dc_in, module. Separador: punto y coma (;) o coma (,)."
        onUpload={(formData) => uploadTrackersCsv(plant.id, formData)}
      />

      <FileUpload
        label="Subir SVG Layout"
        accept=".svg"
        description="Archivo SVG con elementos <rect> cuyos IDs correspondan a los svg_id de los trackers (ej: CT1_INV1-1_TRK1_S1)."
        onUpload={(formData) => uploadSvgLayout(plant.id, formData)}
      />

      {/* GPM Integration */}
      <GpmConfigForm
        plantId={plant.id}
        hasIntegration={hasIntegration}
        queryIds={queryIds}
      />
    </div>
  )
}

function StatusStep({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="text-center">
      <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
        done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'
      }`}>
        {done ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )}
      </div>
      <p className="text-xs font-medium text-gray-300">{label}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-300">{value}</dd>
    </>
  )
}
