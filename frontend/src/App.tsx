import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import './App.css'

type User = {
  id: number
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

type ApiResponse = {
  message?: string
  user?: User
  error?: string
}

type SearchUser = {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  relationship:
    | 'NONE'
    | 'PENDING_SENT'
    | 'PENDING_RECEIVED'
    | 'FRIEND'
}

type Friend = {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
}

type FriendRequest = {
  id: number
  sender: Friend
}

type AuthMode = 'login' | 'register'

async function requestJson(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse> {
  const hasJsonBody =
    options.body !== undefined &&
    !(options.body instanceof FormData)

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(hasJsonBody
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })

  const payload = (await response.json()) as ApiResponse

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed')
  }

  return payload
}

async function loadFriends() {
  const response = await requestJson('/api/friends')

  return response as {
    friends: Friend[]
  }
}

async function loadRequests() {
  const response = await requestJson(
    '/api/friends/requests',
  )

  return response as {
    requests: FriendRequest[]
  }
}

async function searchUsers(query: string) {
  const response = await requestJson(
    `/api/users/search?query=${encodeURIComponent(query)}`,
  )

  return response as {
    users: SearchUser[]
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [profileUsername, setProfileUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [loadingSession, setLoadingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [avatarSubmitting, setAvatarSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] =
    useState<SearchUser[]>([])

  const [friends, setFriends] =
    useState<Friend[]>([])

  const [friendRequests, setFriendRequests] =
    useState<FriendRequest[]>([])

  function applyUser(nextUser: User): void {
    setUser(nextUser)
    setProfileUsername(nextUser.username)
    setDisplayName(nextUser.displayName ?? '')
  }

  async function refreshFriendsData(): Promise<void> {
    const [loadedFriends, loadedRequests] =
      await Promise.all([
        loadFriends(),
        loadRequests(),
      ])

    setFriends(loadedFriends.friends)
    setFriendRequests(loadedRequests.requests)
  }

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const payload = await requestJson('/api/auth/me')

        if (!payload.user) {
          throw new Error('Invalid authentication response')
        }

        applyUser(payload.user)

        const loadedFriends =
          await loadFriends()

        setFriends(
          loadedFriends.friends,
        )

        const loadedRequests =
          await loadRequests()

        setFriendRequests(
          loadedRequests.requests,
        )
      } catch {
        setUser(null)
      } finally {
        setLoadingSession(false)
      }
    }

    void restoreSession()
  }, [])

  async function handleAuthentication(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')
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

      applyUser(payload.user)
      await refreshFriendsData()
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

  async function handleProfileUpdate(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')
    setProfileSubmitting(true)

    try {
      const payload = await requestJson('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username: profileUsername,
          displayName,
        }),
      })

      if (!payload.user) {
        throw new Error('Invalid profile response')
      }

      applyUser(payload.user)
      setSuccess('Profile updated')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Profile update failed',
      )
    } finally {
      setProfileSubmitting(false)
    }
  }

  async function handleAvatarUpdate(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!avatarFile) {
      setError('Select an avatar file')
      return
    }

    setAvatarSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const payload = await requestJson('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!payload.user) {
        throw new Error('Invalid avatar response')
      }

      applyUser(payload.user)
      setAvatarFile(null)
      setSuccess('Avatar updated')

      const input = document.getElementById(
        'avatar',
      ) as HTMLInputElement | null

      if (input) {
        input.value = ''
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Avatar update failed',
      )
    } finally {
      setAvatarSubmitting(false)
    }
  }

  async function handleUserSearch(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')

    const query = searchQuery.trim()

    if (query.length < 2) {
      setError('Search must contain at least 2 characters')
      return
    }

    try {
      const payload = await searchUsers(query)
      setSearchResults(payload.users)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'User search failed',
      )
    }
  }

  async function handleSendFriendRequest(
    userId: number,
  ): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await requestJson(`/api/friends/requests/${userId}`, {
        method: 'POST',
      })

      setSearchResults((currentResults) =>
        currentResults.map((result) =>
          result.id === userId
            ? {
                ...result,
                relationship: 'PENDING_SENT',
              }
            : result,
        ),
      )

      setSuccess('Friend request sent')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Friend request failed',
      )
    }
  }

  async function handleAcceptFriendRequest(
    requestId: number,
  ): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await requestJson(
        `/api/friends/requests/${requestId}/accept`,
        {
          method: 'POST',
        },
      )

      await refreshFriendsData()
      setSuccess('Friend request accepted')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to accept friend request',
      )
    }
  }

  async function handleDeclineFriendRequest(
    requestId: number,
  ): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await requestJson(
        `/api/friends/requests/${requestId}/decline`,
        {
          method: 'POST',
        },
      )

      await refreshFriendsData()
      setSuccess('Friend request declined')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to decline friend request',
      )
    }
  }

  async function handleRemoveFriend(
    friendId: number,
  ): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await requestJson(`/api/friends/${friendId}`, {
        method: 'DELETE',
      })

      await refreshFriendsData()

      setSearchResults((currentResults) =>
        currentResults.map((result) =>
          result.id === friendId
            ? {
                ...result,
                relationship: 'NONE',
              }
            : result,
        ),
      )

      setSuccess('Friend removed')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to remove friend',
      )
    }
  }

  async function handleLogout(): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await requestJson('/api/auth/logout', {
        method: 'POST',
      })

      setUser(null)
      setPassword('')
      setAvatarFile(null)
      setSearchQuery('')
      setSearchResults([])
      setFriends([])
      setFriendRequests([])
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
    setSuccess('')
    setPassword('')
  }

  function handleAvatarSelection(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    setAvatarFile(event.target.files?.[0] ?? null)
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
        <section className="card profile-card">
          <header className="profile-header">
            {user.avatarUrl ? (
              <img
                className="avatar"
                src={user.avatarUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true

                  const fallback =
                    event.currentTarget
                      .nextElementSibling as HTMLElement | null

                  if (fallback) {
                    fallback.hidden = false
                  }
                }}
              />
            ) : null}

            <div
              className="avatar avatar-placeholder"
              hidden={Boolean(user.avatarUrl)}
              aria-label={`${user.username}'s avatar`}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>

            <div>
              <h1>Transcendence</h1>
              <p>
                Connected as <strong>{user.username}</strong>
              </p>
              <p>{user.email}</p>
            </div>
          </header>

          <form onSubmit={(event) => void handleProfileUpdate(event)}>
            <h2>Profile</h2>

            <label>
              Username
              <input
                type="text"
                value={profileUsername}
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_-]+"
                required
                onChange={(event) =>
                  setProfileUsername(event.target.value)
                }
              />
            </label>

            <label>
              Display name
              <input
                type="text"
                value={displayName}
                maxLength={50}
                onChange={(event) =>
                  setDisplayName(event.target.value)
                }
              />
            </label>

            <button type="submit" disabled={profileSubmitting}>
              {profileSubmitting ? 'Saving...' : 'Save profile'}
            </button>
          </form>

          <form onSubmit={(event) => void handleAvatarUpdate(event)}>
            <h2>Avatar</h2>

            <label>
              Image
              <input
                id="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarSelection}
              />
            </label>

            <small>JPEG, PNG or WEBP. Maximum size: 2 MB.</small>

            <button type="submit" disabled={avatarSubmitting}>
              {avatarSubmitting ? 'Uploading...' : 'Upload avatar'}
            </button>
          </form>

          <section className="social-section">
            <h2>Search users</h2>

            <form
              className="search-form"
              onSubmit={(event) =>
                void handleUserSearch(event)
              }
            >
              <label>
                Username or display name
                <input
                  type="search"
                  value={searchQuery}
                  minLength={2}
                  required
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                />
              </label>

              <button type="submit">Search</button>
            </form>

            {searchResults.length > 0 && (
              <ul className="user-list">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <span>
                      <strong>
                        {result.displayName ??
                          result.username}
                      </strong>
                      {result.displayName && (
                        <small>@{result.username}</small>
                      )}
                    </span>

                    {result.relationship === 'NONE' && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleSendFriendRequest(
                            result.id,
                          )
                        }
                      >
                        Add
                      </button>
                    )}

                    {result.relationship ===
                      'PENDING_SENT' && (
                      <button type="button" disabled>
                        Request sent
                      </button>
                    )}

                    {result.relationship ===
                      'PENDING_RECEIVED' && (
                      <button type="button" disabled>
                        Request received
                      </button>
                    )}

                    {result.relationship === 'FRIEND' && (
                      <button type="button" disabled>
                        Friend
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="social-section">
            <h2>Friend requests</h2>

            {friendRequests.length === 0 ? (
              <p>No pending friend requests.</p>
            ) : (
              <ul className="user-list">
                {friendRequests.map((request) => (
                  <li key={request.id}>
                    <span>
                      <strong>
                        {request.sender.displayName ??
                          request.sender.username}
                      </strong>
                      {request.sender.displayName && (
                        <small>
                          @{request.sender.username}
                        </small>
                      )}
                    </span>

                    <div className="user-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void handleAcceptFriendRequest(
                            request.id,
                          )
                        }
                      >
                        Accept
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDeclineFriendRequest(
                            request.id,
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="social-section">
            <h2>Friends</h2>

            {friends.length === 0 ? (
              <p>No friends yet.</p>
            ) : (
              <ul className="user-list">
                {friends.map((friend) => (
                  <li key={friend.id}>
                    <span>
                      <strong>
                        {friend.displayName ??
                          friend.username}
                      </strong>
                      {friend.displayName && (
                        <small>@{friend.username}</small>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        void handleRemoveFriend(friend.id)
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <p className="message error">{error}</p>}
          {success && <p className="message success">{success}</p>}

          <button
            type="button"
            className="logout-button"
            onClick={() => void handleLogout()}
          >
            Log out
          </button>
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

        <form
          onSubmit={(event) =>
            void handleAuthentication(event)
          }
        >
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
                onChange={(event) =>
                  setUsername(event.target.value)
                }
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
              onChange={(event) =>
                setPassword(event.target.value)
              }
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

        {error && <p className="message error">{error}</p>}
      </section>
    </main>
  )
}

export default App
