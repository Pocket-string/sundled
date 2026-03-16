import Image from 'next/image'
import Link from 'next/link'
import { LucviaLogo } from '@/components/LucviaLogo'

export const metadata = {
  title: 'Lucvia — Monitoreo fotovoltaico inteligente',
  description:
    'Detecta bajo-rendimiento, optimiza limpieza y maximiza producción. Análisis avanzado con IA para plantas solares a nivel de string.',
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconSparkle() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}

// ─── Feature card data ─────────────────────────────────────────────────────────

const features = [
  {
    icon: <IconGrid />,
    title: 'Heatmap interactivo',
    description:
      'Visualiza el estado de cada string en tiempo real con un mapa de calor que revela patrones de degradación al instante.',
    screenshot: '/screenshots/feature-heatmap.png',
  },
  {
    icon: <IconChart />,
    title: 'Motor analítico avanzado',
    description:
      'Calcula desviaciones de rendimiento usando ventanas de energía de pico y referencias P75 por grupo de módulo.',
    screenshot: '/screenshots/feature-dashboard.png',
  },
  {
    icon: <IconShield />,
    title: 'Detección automática de bajo-rendimiento',
    description:
      'Alertas inteligentes que identifican strings problemáticos en menos de 30 minutos desde que ocurre el evento.',
    screenshot: '/screenshots/feature-detection.png',
  },
  {
    icon: <IconSparkle />,
    title: 'Agente IA integrado',
    description:
      'Pregunta en lenguaje natural sobre rendimiento, pérdidas y recomendaciones. LUCIA analiza tus datos y responde con cifras reales.',
    screenshot: '/screenshots/feature-agent.png',
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white antialiased">

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
          aria-label="Navegación principal"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white" aria-label="Lucvia — inicio">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <LucviaLogo className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">Lucvia</span>
          </Link>

          {/* Nav links */}
          <ul className="hidden items-center gap-8 md:flex" role="list">
            <li>
              <a href="#features" className="text-sm text-gray-400 transition-colors hover:text-white">
                Producto
              </a>
            </li>
            <li>
              <Link
                href="/demo/PLT_A/dashboard"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Demo
              </Link>
            </li>
            <li>
              <a href="#contacto" className="text-sm text-gray-400 transition-colors hover:text-white">
                Contacto
              </a>
            </li>
          </ul>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/demo/PLT_A/dashboard"
              className="hidden rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/10 sm:inline-flex"
            >
              Ver Demo
            </Link>
            <a
              href="mailto:ventas@lucvia.com"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Contactar
            </a>
          </div>
        </nav>
      </header>

      <main>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-32 lg:pt-28">
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0 -top-40 flex items-start justify-center overflow-hidden"
            aria-hidden="true"
          >
            <div className="h-[500px] w-[900px] rounded-full bg-emerald-600/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Badge */}
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/60 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Análisis a nivel de string — en tiempo real
            </span>

            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Monitoreo fotovoltaico{' '}
              <span className="text-emerald-400">inteligente</span> a nivel de string
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400">
              Detecta bajo-rendimiento, optimiza limpieza, maximiza producción.
              Análisis avanzado con IA para plantas solares.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/demo/PLT_A/dashboard"
                className="w-full rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition-colors hover:bg-emerald-500 sm:w-auto"
              >
                Ver Demo Gratis
              </Link>
              <a
                href="mailto:ventas@lucvia.com"
                className="w-full rounded-xl border border-gray-700 px-8 py-3.5 text-base font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white sm:w-auto"
              >
                Contactar Ventas
              </a>
            </div>

            {/* Social proof micro-text */}
            <p className="mt-8 text-sm text-gray-600">
              Demo interactivo con datos reales de planta
            </p>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section
          id="features"
          className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2
                id="features-heading"
                className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Todo lo que necesita tu planta solar
              </h2>
              <p className="mx-auto max-w-xl text-gray-400">
                Desde la ingestión de datos hasta la detección de anomalías, una plataforma
                integrada pensada para operadores e ingenieros.
              </p>
            </div>

            <div className="space-y-20">
              {features.map((f, i) => (
                <article
                  key={f.title}
                  className={`flex flex-col items-center gap-8 lg:gap-12 ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
                >
                  {/* Text */}
                  <div className="flex-1 text-center lg:text-left">
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
                      {f.icon}
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">{f.title}</h3>
                    <p className="max-w-md text-base leading-relaxed text-gray-400">{f.description}</p>
                  </div>
                  {/* Screenshot */}
                  <div className="flex-1">
                    <div className="overflow-hidden rounded-2xl border border-gray-800/50 shadow-2xl shadow-black/40">
                      <Image
                        src={f.screenshot}
                        alt={f.title}
                        width={700}
                        height={450}
                        className="w-full"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────────────────────────────── */}
        <section
          id="contacto"
          className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/60 via-gray-900 to-gray-900 p-12 text-center">
            {/* Ambient spot */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 mx-auto h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl"
              aria-hidden="true"
            />

            <h2
              id="cta-heading"
              className="mb-4 text-3xl font-bold text-white sm:text-4xl"
            >
              Implementa Lucvia en tu planta
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-gray-400">
              Cada planta es diferente. Evaluamos tu infraestructura SCADA,
              configuramos la ingestión de datos y adaptamos el análisis a tu operación.
            </p>
            <a
              href="mailto:ventas@lucvia.com"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition-colors hover:bg-emerald-500"
            >
              Solicitar demostración
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2 text-white" aria-label="Lucvia — inicio">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <LucviaLogo className="h-4 w-4" />
            </span>
            <span className="font-bold">Lucvia</span>
          </Link>
          <p className="text-sm text-gray-600">
            © 2026 Lucvia. Todos los derechos reservados.
          </p>
          <nav aria-label="Pie de página" className="flex gap-5">
            <a href="#features" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
              Producto
            </a>
            <Link href="/demo/PLT_A/dashboard" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
              Demo
            </Link>
            <a href="mailto:ventas@lucvia.com" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
              Contacto
            </a>
          </nav>
        </div>
      </footer>

    </div>
  )
}
