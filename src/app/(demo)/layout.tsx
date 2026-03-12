import Link from 'next/link'

function IconSun() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

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
              <IconSun />
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

          {/* Right: Signup CTA */}
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Regístrate
          </Link>

        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="min-h-[calc(100vh-57px)]">
        {children}
      </main>

    </div>
  )
}
