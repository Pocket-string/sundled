interface Props {
  className?: string
}

export function LucviaLogo({ className = 'h-5 w-5' }: Props) {
  return (
    <svg
      viewBox="0 0 44 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Input chevrons */}
      <polyline
        points="1,9 5,16 1,23"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="6,9 10,16 6,23"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Prism bars */}
      <polygon points="16,2 38,2 38,9 14,9" fill="currentColor" />
      <polygon points="13,12 38,12 38,20 13,20" fill="currentColor" />
      <polygon points="14,23 38,23 38,30 16,30" fill="currentColor" />
    </svg>
  )
}
