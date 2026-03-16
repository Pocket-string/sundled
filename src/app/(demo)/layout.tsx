import Link from 'next/link'
import { AgentProvider } from '@/features/ai-analyst/components/AgentProvider'
import { LucviaLogo } from '@/components/LucviaLogo'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

          {/* Left: Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
            aria-label="Lucvia — volver al inicio"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <LucviaLogo className="h-4 w-4" />
            </span>
            <span className="font-bold tracking-tight">Lucvia</span>
          </Link>

          {/* Center: DEMO badge */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-700/50 bg-yellow-950/60 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-yellow-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" aria-hidden="true" />
              Demo
            </span>
          </div>

          {/* Right: Contact CTA */}
          <a
            href="mailto:ventas@lucvia.com"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Contactar
          </a>

        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="min-h-[calc(100vh-57px)]">
        {children}
      </main>

      {/* AI Analyst — demo context (no persistence) */}
      <AgentProvider context={{
        plantId: 'PLT_A',
        plantName: 'Zaldivia',
        stringCount: 693,
        energyPrice: 0.12,
      }} />

    </div>
  )
}
