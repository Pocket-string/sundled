import Link from 'next/link'
import { LoginForm } from '@/features/auth/components'

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white">Lucvia</span>
      </div>

      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold text-white">Bienvenido de vuelta</h1>
        <p className="mt-2 text-gray-400">Inicia sesion para acceder a tus plantas</p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-gray-400">
        ¿No tienes una cuenta?{' '}
        <Link href="/signup" className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline">
          Registrate
        </Link>
      </p>
    </div>
  )
}
