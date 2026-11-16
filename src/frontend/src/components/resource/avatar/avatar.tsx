export function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{initials}</span>
}
