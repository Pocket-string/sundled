import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lucvia — Solar Plant Monitoring',
  description: 'Monitoreo fotovoltaico a nivel de string. Detecta bajo-rendimiento, optimiza limpieza, maximiza produccion.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
