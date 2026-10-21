export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--accent)" />
      <path d="M11 13.5c0-1.4 1.1-2.5 2.5-2.5H19c6.1 0 10 3.7 10 9s-3.9 9-10 9h-5.5a2.5 2.5 0 0 1-2.5-2.5z" fill="var(--accent-fg)" opacity=".95" />
      <circle cx="19.5" cy="20" r="3.6" fill="var(--accent)" />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">Dailybase</span>
    </div>
  )
}
