// Small shared building blocks. Page-specific pieces live next to their page.

import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import { cx } from '../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-raised',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'text-danger hover:bg-danger-soft',
}

export function Button({
  variant = 'primary',
  busy,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
    >
      {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('rounded-2xl border border-line bg-surface p-5 sm:p-6', className)}>{children}</As>
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'accent' | 'warn'; children: ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-raised text-muted',
    accent: 'bg-accent-soft text-accent-text',
    warn: 'bg-warn-soft text-warn-text',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-raised', className)} />
}

/** A stack of placeholder cards shown while a list loads. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cx('space-y-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx('rounded-2xl border border-line bg-surface p-6 text-center', className)}>
      <AlertCircle aria-hidden className="mx-auto size-6 text-danger" />
      <p className="mt-3 font-medium">Couldn't load this</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function FullPageSpinner() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <Loader2 aria-hidden className="size-6 animate-spin text-faint" />
    </div>
  )
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  )
}

// ---- Form fields: every input gets a real <label> ----

const fieldClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

function FieldShell({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cx(fieldClass, className)} {...rest} />
    </FieldShell>
  )
}

export function TextArea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cx(fieldClass, 'resize-y', className)} {...rest} />
    </FieldShell>
  )
}

export function SelectField({ label, hint, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={cx(fieldClass, className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}
