import Link from 'next/link'
import { SignupForm } from '@/features/auth/components'
import { LucviaLogo } from '@/components/LucviaLogo'

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <LucviaLogo className="w-6 h-6" variant="emerald" />
        </div>
        <span className="text-xl font-bold text-white">Lucvia</span>
      </div>

      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold text-white">Crea tu cuenta</h1>
        <p className="mt-2 text-gray-400">Comienza a monitorear tu planta fotovoltaica</p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-gray-400">
        ¿Ya tienes una cuenta?{' '}
        <Link href="/login" className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline">
          Inicia sesion
        </Link>
      </p>
    </div>
  )
}
