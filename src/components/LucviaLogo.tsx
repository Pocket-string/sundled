import Image from 'next/image'

interface Props {
  className?: string
  variant?: 'white' | 'emerald' | 'dark'
}

const srcs: Record<string, string> = {
  white: '/logo/lucvia-mark-white.png',
  emerald: '/logo/lucvia-mark-emerald.png',
  dark: '/logo/lucvia-mark-dark.png',
}

export function LucviaLogo({ className = 'h-5 w-5', variant = 'white' }: Props) {
  return (
    <Image
      src={srcs[variant]}
      alt=""
      width={227}
      height={159}
      aria-hidden="true"
      className={className}
      unoptimized
    />
  )
}
