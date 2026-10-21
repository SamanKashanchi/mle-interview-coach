import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { db, isMock } from '../../lib/db'
import { mockCompleteSignIn } from '../../mock/backend'
import { Button, Card, InlineError, TextField } from '../../components/ui'
import { Logo } from '../../components/Logo'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  // The Home Screen app can't receive the emailed link (it opens in Safari), so the email's code works too.
  async function verify(e: FormEvent) {
    e.preventDefault()
    setCodeBusy(true)
    setCodeError(null)
    try {
      await db.verifyEmailCode(email.trim(), code.replace(/\s/g, ''))
    } catch (err) {
      const message = (err as Error).message
      setCodeError(/expired|invalid/i.test(message) ? "That code didn't work. Check it, or send a new email." : message)
      setCodeBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await db.sendMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 text-lg" />
        {sent ? (
          <Card>
            <MailCheck aria-hidden className="size-8 text-accent" />
            <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-muted">
              We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open it on this device, or enter the code from the email.
            </p>
            <form onSubmit={verify} className="mt-5 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  label="Code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" busy={codeBusy} className="min-h-12" disabled={code.replace(/\s/g, '').length < 6}>
                Sign in
              </Button>
            </form>
            {codeError && (
              <div className="mt-2">
                <InlineError>{codeError}</InlineError>
              </div>
            )}
            {isMock && (
              <Button className="mt-6 w-full" onClick={() => mockCompleteSignIn(email.trim())}>
                Open the link (mock mode)
              </Button>
            )}
            <Button variant="ghost" className="mt-3 -ml-3" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </Card>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Practice for the interviews you want.</h1>
            <p className="mt-3 text-muted">
              A daily coach for ML engineers. It studies how your target companies interview and gives you a few focused questions each day.
            </p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <TextField
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <InlineError>{error}</InlineError>}
              <Button type="submit" busy={busy} className="w-full">
                Send me a sign-in link
              </Button>
              <p className="text-center text-xs text-faint">No password needed. We'll email you a one-time link.</p>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
