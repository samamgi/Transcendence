import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

type User = {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

type AuthResponse = {
  message?: string
  user?: User
  error?: string
}

type AuthMode = 'login' | 'register'

async function requestJson(
  url: string,
  options: RequestInit = {},
): Promise<AuthResponse> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const payload = (await response.json()) as AuthResponse

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed')
  }

  return payload
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingSession, setLoadingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const payload = await requestJson('/api/auth/me')

        if (!payload.user) {
          throw new Error('Invalid authentication response')
        }

        setUser(payload.user)
      } catch {
        setUser(null)
      } finally {
        setLoadingSession(false)
      }
    }

    void restoreSession()
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const body =
        mode === 'register'
          ? { username, email, password }
          : { email, password }

      const payload = await requestJson(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (!payload.user) {
        throw new Error('Invalid authentication response')
      }

      setUser(payload.user)
      setPassword('')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Authentication failed',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout(): Promise<void> {
    setError('')

    try {
      await requestJson('/api/auth/logout', {
        method: 'POST',
      })

      setUser(null)
      setPassword('')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Logout failed',
      )
    }
  }

  function changeMode(nextMode: AuthMode): void {
    setMode(nextMode)
    setError('')
    setPassword('')
  }

  if (loadingSession) {
    return (
      <main className="page">
        <p>Loading...</p>
      </main>
    )
  }

  if (user) {
    return (
      <main className="page">
        <section className="card">
          <h1>Transcendence</h1>

          <p>
            Connected as <strong>{user.username}</strong>
          </p>

          <p>{user.email}</p>

          <button type="button" onClick={() => void handleLogout()}>
            Log out
          </button>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Transcendence</h1>

        <div className="tabs" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
          >
            Log in
          </button>

          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => changeMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          {mode === 'register' && (
            <label>
              Username
              <input
                type="text"
                value={username}
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_-]+"
                autoComplete="username"
                required
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              minLength={8}
              autoComplete={
                mode === 'register'
                  ? 'new-password'
                  : 'current-password'
              }
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait...'
              : mode === 'register'
                ? 'Create account'
                : 'Log in'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  )
}

export default App
