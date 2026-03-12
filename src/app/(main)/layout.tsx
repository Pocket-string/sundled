import { AppSidebar } from '@/components/layout/sidebar'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
