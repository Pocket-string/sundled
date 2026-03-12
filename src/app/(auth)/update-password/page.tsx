import { UpdatePasswordForm } from '@/features/auth/components'

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold text-white">Nueva contrasena</h1>
        <p className="mt-2 text-gray-400">Elige una contrasena segura que no hayas usado antes</p>
      </div>

      <UpdatePasswordForm />
    </div>
  )
}
