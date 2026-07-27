import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import ChatWindow from './components/ChatWindow'
import HomePage from './pages/HomePage'
import PlayPage from './pages/PlayPage'
import ConversationList, {
  type Conversation,
} from './components/ConversationList'
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

type OnlineFriendsResponse = {
  success: boolean
  userIds?: number[]
  error?: string
}

type PresenceEvent = {
  userId: number
}

type ReactionNotificationEvent = {
  messageId: number
  conversationId: number
  messageSenderId?: number
  userId: number
  emoji: string
  user: {
    id: number
    username: string
    displayName: string | null
  }
}

type ConversationResponse = {
  conversation?: Conversation
  error?: string
}

type SocialConversationSummary = {
  id: number
  unreadCount?: number
  reactionUnreadCount?: number
}

type SocialConversationsResponse = {
  conversations?: SocialConversationSummary[]
  error?: string
}

type SocialRealtimeMessage = {
  id: number
  conversationId: number
  senderId: number
}

type AuthMode = 'login' | 'register'

type Page =
  | 'home'
  | 'play'
  | 'social'
  | 'profile'

type ProfileScrollTarget =
  | 'statistics'
  | null

type ControlScheme =
  | 'qwerty'
  | 'azerty'

type MatchHistoryItem = {
  id: number
  mode: string
  status?: string
  result?: string
  opponent?: string | null
  score?: string

  player1Id: number
  player2Id: number | null
  winnerId: number | null

  player1Username: string
  player2Username: string | null

  player1Score: number
  player2Score: number

  startedAt: string
  finishedAt: string
}

type GameStatistics = {
  total: number
  wins: number
  losses: number
  winRate: number
  forfeitWins: number
  forfeitLosses: number
  history: MatchHistoryItem[]
}

function getMatchDisplayScores(
  match: MatchHistoryItem,
  currentUserId: number,
): {
  userScore: number
  opponentScore: number
} {
  const rawMatch =
    match as unknown as Record<string, unknown>

  const directUserScore =
    typeof rawMatch.userScore === 'number'
      ? rawMatch.userScore
      : null

  const directOpponentScore =
    typeof rawMatch.opponentScore === 'number'
      ? rawMatch.opponentScore
      : null

  if (
    directUserScore !== null &&
    directOpponentScore !== null
  ) {
    return {
      userScore: directUserScore,
      opponentScore: directOpponentScore,
    }
  }

  const player1Score =
    typeof rawMatch.player1Score === 'number'
      ? rawMatch.player1Score
      : 0

  const player2Score =
    typeof rawMatch.player2Score === 'number'
      ? rawMatch.player2Score
      : 0

  const player1Id =
    typeof rawMatch.player1Id === 'number'
      ? rawMatch.player1Id
      : null

  const player2Id =
    typeof rawMatch.player2Id === 'number'
      ? rawMatch.player2Id
      : null

  if (player1Id === currentUserId) {
    return {
      userScore: player1Score,
      opponentScore: player2Score,
    }
  }

  if (player2Id === currentUserId) {
    return {
      userScore: player2Score,
      opponentScore: player1Score,
    }
  }

  return {
    userScore: player1Score,
    opponentScore: player2Score,
  }
}


type GameStatisticsResponse = {
  statistics?: GameStatistics
  error?: string
}

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
  const [accountDeleting, setAccountDeleting] =
    useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!success) {
      return
    }

    if (successTimeoutRef.current !== null) {
      clearTimeout(successTimeoutRef.current)
    }

    successTimeoutRef.current =
      window.setTimeout(() => {
        setSuccess('')
        successTimeoutRef.current = null
      }, 3000)

    return () => {
      if (successTimeoutRef.current !== null) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [success])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] =
    useState<SearchUser[]>([])

  const [friends, setFriends] =
    useState<Friend[]>([])

  const [friendRequests, setFriendRequests] =
    useState<FriendRequest[]>([])

  const [onlineFriendIds, setOnlineFriendIds] =
    useState<Set<number>>(new Set())

  const socketRef = useRef<Socket | null>(null)

  const successTimeoutRef =
    useRef<number | null>(null)

  const notificationTimeoutRef =
    useRef<number | null>(null)

  const [socket, setSocket] =
    useState<Socket | null>(null)

  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null)

  const [conversationRefreshKey, setConversationRefreshKey] =
    useState(0)


  const [page, setPage] =
    useState<Page>('home')

  const pageRef = useRef<Page>('home')
  const profileScrollTargetRef =
    useRef<ProfileScrollTarget>(null)

  const [
    socialUnreadMessageCount,
    setSocialUnreadMessageCount,
  ] = useState(0)

  const [
    hasUnseenSocialReaction,
    setHasUnseenSocialReaction,
  ] = useState(false)

  const hasSocialNotification =
    friendRequests.length > 0 ||
    socialUnreadMessageCount > 0 ||
    hasUnseenSocialReaction

  const [gameStatistics, setGameStatistics] =
    useState<GameStatistics | null>(null)

  const [gameStatisticsLoading, setGameStatisticsLoading] =
    useState(false)

  const [controlScheme, setControlScheme] =
    useState<ControlScheme>(() =>
      window.localStorage.getItem(
        'pong-control-scheme',
      ) === 'azerty'
        ? 'azerty'
        : 'qwerty',
    )

  useEffect(() => {
    pageRef.current = page
  }, [page])

  async function loadGameStatistics(): Promise<void> {
    setGameStatisticsLoading(true)

    try {
      const response = await fetch(
        '/api/users/me/statistics',
        {
          credentials: 'include',
        },
      )

      const payload =
        (await response.json()) as
          GameStatisticsResponse

      if (!response.ok || !payload.statistics) {
        throw new Error(
          payload.error ??
            'Unable to load game statistics',
        )
      }

      setGameStatistics(payload.statistics)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load game statistics',
      )
    } finally {
      setGameStatisticsLoading(false)
    }
  }

  function openProfilePage(
    scrollTarget: ProfileScrollTarget = null,
  ): void {
    profileScrollTargetRef.current = scrollTarget
    setPage('profile')
    void loadGameStatistics()
  }

  useEffect(() => {
    if (page !== 'profile') {
      return
    }

    if (
      profileScrollTargetRef.current !==
      'statistics'
    ) {
      return
    }

    profileScrollTargetRef.current = null

    const animationFrameId =
      window.requestAnimationFrame(() => {
        const statisticsSection =
          document.getElementById(
            'profile-statistics-section',
          )

        statisticsSection?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [page])

  useEffect(() => {
    if (
      !user ||
      (page !== 'profile' && page !== 'home')
    ) {
      return
    }

    let cancelled = false

    async function loadGameStatistics(): Promise<void> {
      setGameStatisticsLoading(true)
      try {
        const response = await fetch(
          '/api/users/me/statistics',
          {
            credentials: 'include',
          },
        )

        const payload =
          (await response.json()) as
            GameStatisticsResponse

        if (!response.ok || !payload.statistics) {
          throw new Error(
            payload.error ??
              'Unable to load game statistics',
          )
        }

        if (!cancelled) {
          setGameStatistics({
          ...payload.statistics,
          total: payload.statistics.total ?? 0,
          wins: payload.statistics.wins ?? 0,
          losses: payload.statistics.losses ?? 0,
          winRate: payload.statistics.winRate ?? 0,
          forfeitWins:
            payload.statistics.forfeitWins ?? 0,
          forfeitLosses:
            payload.statistics.forfeitLosses ?? 0,
          history: payload.statistics.history ?? [],
        })
        }
      } catch (caughtError) {
        if (!cancelled) {
        setError(
          caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load game statistics',
        )
        }
      } finally {
        if (!cancelled) {
          setGameStatisticsLoading(false)
        }
      }
    }

    void loadGameStatistics()

    return () => {
      cancelled = true
    }
  }, [page, user])

  function openSocialPage(): void {
    pageRef.current = 'social'
    setHasUnseenSocialReaction(false)
    setPage('social')
  }

  function applyUser(nextUser: User): void {
    setPage('home')
    setUser(nextUser)
    setProfileUsername(nextUser.username)
    setDisplayName(nextUser.displayName ?? '')
  }

  async function refreshSocialUnreadMessages(
    activeSocket?: Socket,
  ): Promise<void> {
    try {
      const response = await fetch(
        '/api/conversations',
        {
          credentials: 'include',
        },
      )

      const payload =
        (await response.json()) as
          SocialConversationsResponse

      if (!response.ok) {
        return
      }

      const conversations =
        payload.conversations ?? []

      setSocialUnreadMessageCount(
        conversations.reduce(
          (total, conversation) =>
            total +
            (conversation.unreadCount ?? 0) +
            (conversation.reactionUnreadCount ?? 0),
          0,
        ),
      )

      if (activeSocket?.connected) {
        for (const conversation of conversations) {
          activeSocket.emit(
            'joinConversation',
            conversation.id,
            () => undefined,
          )
        }
      }
    } catch {
      // La page Social chargera de nouveau les données.
    }
  }

  const refreshOnlineFriends =
    useCallback((): void => {
      const socket = socketRef.current

      if (!socket?.connected) {
        return
      }

      socket.emit(
        'getOnlineFriends',
        (response: OnlineFriendsResponse) => {
          if (!response.success) {
            return
          }

          setOnlineFriendIds(
            new Set(response.userIds ?? []),
          )
        },
      )
    }, [])

  const refreshFriendsData =
    useCallback(async (): Promise<void> => {
      const [loadedFriends, loadedRequests] =
        await Promise.all([
          loadFriends(),
          loadRequests(),
        ])

      setFriends(loadedFriends.friends)
      setFriendRequests(loadedRequests.requests)
      refreshOnlineFriends()
    }, [refreshOnlineFriends])

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

  useEffect(() => {
    if (!user) {
      return
    }

    const activeSocket = io({
      withCredentials: true,
    })

    socketRef.current = activeSocket

    const handleConnect = (): void => {
      setSocket(activeSocket)
      refreshOnlineFriends()

      void refreshSocialUnreadMessages(
        activeSocket,
      )
    }

    const handleDisconnect = (): void => {
      setSocket((currentSocket) =>
        currentSocket === activeSocket
          ? null
          : currentSocket,
      )
    }

    const handleOnline = (
      event: PresenceEvent,
    ): void => {
      setOnlineFriendIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.add(event.userId)
        return nextIds
      })
    }

    const handleOffline = (
      event: PresenceEvent,
    ): void => {
      setOnlineFriendIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(event.userId)
        return nextIds
      })
    }

    const handleSocialMessage = (
      message: SocialRealtimeMessage,
    ): void => {
      if (
        message.senderId === user.id ||
        pageRef.current === 'social'
      ) {
        return
      }

      setSocialUnreadMessageCount(
        (currentCount) => currentCount + 1,
      )
    }

    const handleRealtimeFriendRequest =
      (): void => {
        void refreshFriendsData()
      }

    const handleReactionNotification = (
      reaction: ReactionNotificationEvent,
    ): void => {
      const reactedToCurrentUsersMessage =
        reaction.messageSenderId === user.id

      const wasAddedByAnotherUser =
        reaction.userId !== user.id

      if (
        !reactedToCurrentUsersMessage ||
        !wasAddedByAnotherUser
      ) {
        return
      }

      if (pageRef.current !== 'social') {
        setHasUnseenSocialReaction(true)
      }

      const reactionAuthor =
        reaction.user.displayName ??
        reaction.user.username

      setSuccess(
        `${reactionAuthor} reacted ${reaction.emoji} to your message`,
      )

      if (notificationTimeoutRef.current !== null) {
        window.clearTimeout(
          notificationTimeoutRef.current,
        )
      }

      notificationTimeoutRef.current =
        window.setTimeout(() => {
          setSuccess('')
          notificationTimeoutRef.current = null
        }, 4000)
    }

    activeSocket.on('connect', handleConnect)
    activeSocket.on('disconnect', handleDisconnect)
    activeSocket.on('userOnline', handleOnline)
    activeSocket.on('userOffline', handleOffline)
    activeSocket.on(
      'social:newMessage',
      handleSocialMessage,
    )
    activeSocket.on(
      'social:reaction',
      handleReactionNotification,
    )
    activeSocket.on(
      'social:friendRequest',
      handleRealtimeFriendRequest,
    )

    return () => {
      activeSocket.off('connect', handleConnect)
      activeSocket.off('disconnect', handleDisconnect)
      activeSocket.off('userOnline', handleOnline)
      activeSocket.off('userOffline', handleOffline)
      activeSocket.off(
        'social:newMessage',
        handleSocialMessage,
      )
      activeSocket.off(
        'social:reaction',
        handleReactionNotification,
      )
      activeSocket.off(
        'social:friendRequest',
        handleRealtimeFriendRequest,
      )

      if (notificationTimeoutRef.current !== null) {
        window.clearTimeout(
          notificationTimeoutRef.current,
        )
        notificationTimeoutRef.current = null
      }

      activeSocket.disconnect()

      if (socketRef.current === activeSocket) {
        socketRef.current = null
      }
    }
  }, [
    user,
    refreshFriendsData,
    refreshOnlineFriends,
  ])

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

  async function handleOpenConversation(
    friendId: number,
  ): Promise<void> {
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: friendId,
        }),
      })

      const payload =
        (await response.json()) as ConversationResponse

      if (!response.ok || !payload.conversation) {
        throw new Error(
          payload.error ?? 'Unable to open conversation',
        )
      }

      setSelectedConversation(payload.conversation)
      setConversationRefreshKey((currentKey) => currentKey + 1)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to open conversation',
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

  async function handleDeleteAccount(): Promise<void> {
    const confirmation = window.prompt(
      'This action is permanent. Type DELETE to confirm.',
    )

    if (confirmation !== 'DELETE') {
      return
    }

    const finalConfirmation = window.confirm(
      'Permanently delete your account and all associated data?',
    )

    if (!finalConfirmation) {
      return
    }

    setError('')
    setSuccess('')
    setAccountDeleting(true)

    try {
      await requestJson('/api/auth/account', {
        method: 'DELETE',
      })

      socketRef.current?.disconnect()
      socketRef.current = null

      setSocket(null)
      setUser(null)
      setPassword('')
      setAvatarFile(null)
      setSearchQuery('')
      setSearchResults([])
      setFriends([])
      setFriendRequests([])
      setOnlineFriendIds(new Set())
      setSocialUnreadMessageCount(0)
      setHasUnseenSocialReaction(false)
      setSelectedConversation(null)
      setConversationRefreshKey(0)
      setGameStatistics(null)
      setPage('home')
      setMode('login')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to delete account',
      )
    } finally {
      setAccountDeleting(false)
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
      setOnlineFriendIds(new Set())
      setSocialUnreadMessageCount(0)
      setHasUnseenSocialReaction(false)
      setSelectedConversation(null)
      setConversationRefreshKey(0)
      setGameStatistics(null)
      setPage('home')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Logout failed',
      )
    }
  }

  function changeControlScheme(
    nextScheme: ControlScheme,
  ): void {
    setControlScheme(nextScheme)

    window.localStorage.setItem(
      'pong-control-scheme',
      nextScheme,
    )

    setSuccess(
      nextScheme === 'azerty'
        ? 'AZERTY controls selected'
        : 'QWERTY controls selected',
    )
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
      <main className="app-page">
        <section className="app-shell">
          <header className="app-topbar">
            <button
              type="button"
              className="brand-button"
              onClick={() => setPage('home')}
            >
              <span className="brand-mark">T</span>

              <span className="brand-copy">
                <strong>TRANSCENDENCE</strong>
                <small>ONLINE PONG ARENA</small>
              </span>
            </button>

            <div className="topbar-user">
              {user.avatarUrl ? (
                <img
                  className="topbar-avatar"
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
                className="topbar-avatar topbar-avatar-placeholder"
                hidden={Boolean(user.avatarUrl)}
                aria-label={`${user.username}'s avatar`}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>

              <div className="topbar-identity">
                <strong>
                  {user.displayName ?? user.username}
                </strong>
                <small>@{user.username}</small>
              </div>

              <button
                type="button"
                className="topbar-logout"
                onClick={() => void handleLogout()}
              >
                Log out
              </button>
            </div>
          </header>

          <nav className="main-navigation">
            <button
              type="button"
              className={page === 'home' ? 'active' : ''}
              onClick={() => setPage('home')}
            >
              <span aria-hidden="true">⌂</span>
              Home
            </button>

            <button
              type="button"
              className={page === 'play' ? 'active' : ''}
              onClick={() => setPage('play')}
            >
              <span aria-hidden="true">▶</span>
              Play
            </button>

            <button
              type="button"
              className={page === 'social' ? 'active' : ''}
              onClick={openSocialPage}
            >
              <span
                aria-hidden="true"
                className="nav-icon nav-icon--social"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7.2 10.2h9.6a4 4 0 0 1 3.88 5l-.72 2.6a2.1 2.1 0 0 1-3.35 1.07l-1.68-1.28a4.2 4.2 0 0 0-5.06 0l-1.68 1.28a2.1 2.1 0 0 1-3.35-1.07l-.72-2.6a4 4 0 0 1 3.88-5Z"
                    stroke="currentColor"
                    strokeWidth="1.55"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.9 14h2.8M10.3 12.6v2.8"
                    stroke="currentColor"
                    strokeWidth="1.55"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="15.9"
                    cy="13.2"
                    r="1.1"
                    fill="currentColor"
                  />
                  <circle
                    cx="18"
                    cy="14.9"
                    r="1.1"
                    fill="currentColor"
                  />
                </svg>
              </span>
              Social

              {hasSocialNotification && (
                <span
                  className="social-notification-dot"
                  aria-label="Unseen social notifications"
                />
              )}
            </button>

            <button
              type="button"
              className={page === 'profile' ? 'active' : ''}
              onClick={() => openProfilePage()}
            >
              <span
                aria-hidden="true"
                className="nav-icon"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M5.5 18.5a6.5 6.5 0 0 1 13 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              Profile
            </button>
          </nav>

          {page === 'home' && (
            <HomePage
              username={user.displayName ?? user.username}
              onlineFriendsCount={onlineFriendIds.size}
              totalMatches={gameStatistics?.total ?? 0}
              winRate={gameStatistics?.winRate ?? 0}
              onPlay={() => setPage('play')}
              onSocial={openSocialPage}
              onOpenStatistics={() =>
                openProfilePage('statistics')
              }
              onOpenTournament={() => setPage('play')}
            />
          )}

          {page === 'play' && (
            <PlayPage
              socket={socket}
              controlScheme={controlScheme}
            />
          )}

          {page === 'profile' && (
            <>
              <form
                onSubmit={(event) =>
                  void handleProfileUpdate(event)
                }
              >
            <h2>Profile</h2>

            <label>
              Username
              <input
                type="text"
                value={profileUsername}
                minLength={3}
                maxLength={20}
               
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

          <section
            className="profile-statistics"
            id="profile-statistics-section"
          >
            <div className="profile-statistics-heading">
              <div>
                <p className="profile-statistics-label">
                  GAME ACTIVITY
                </p>
                <h2>Statistics and match history</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadGameStatistics()
                }
                disabled={gameStatisticsLoading}
              >
                {gameStatisticsLoading
                  ? 'Loading...'
                  : 'Refresh'}
              </button>
            </div>

            {gameStatisticsLoading &&
            !gameStatistics ? (
              <p>Loading statistics...</p>
            ) : gameStatistics ? (
              <>
                <div className="profile-statistics-grid">
                  <article>
                    <span>Matches</span>
                    <strong>
                      {gameStatistics.total}
                    </strong>
                  </article>

                  <article>
                    <span>Wins</span>
                    <strong>
                      {gameStatistics.wins}
                    </strong>
                  </article>

                  <article>
                    <span>Losses</span>
                    <strong>
                      {gameStatistics.losses}
                    </strong>
                  </article>

                  <article>
                    <span>Win rate</span>
                    <strong>
                      {gameStatistics.winRate}%
                    </strong>
                  </article>
                </div>

                <div className="match-history">
                  <h3>Recent matches</h3>

                  {gameStatistics.history.length === 0 ? (
                    <p>
                      No recorded matches yet.
                    </p>
                  ) : (
                    <ul>
                      {gameStatistics.history.map(
                        (match) => (
                          <li key={match.id}>
                            <span
                              className={
                                match.result === 'WIN'
                                  ? 'match-result win'
                                  : match.result ===
                                      'LOSS'
                                    ? 'match-result loss'
                                    : 'match-result draw'
                              }
                            >
                              {match.result}
                            </span>

                            <span>
                              <strong>
                                {getMatchDisplayScores(match, user.id).userScore}
                                {' - '}
                                {getMatchDisplayScores(match, user.id).opponentScore}
                              </strong>

                              <small>
                                vs {match.opponent}
                                {' · '}
                                {match.mode}
                              </small>
                            </span>

                            <time
                              dateTime={
                                match.finishedAt
                              }
                            >
                              {new Date(
                                match.finishedAt,
                              ).toLocaleDateString()}
                            </time>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p>
                Statistics could not be loaded.
              </p>
            )}
          </section>

          <section className="control-settings">
            <div>
              <p className="control-settings-label">
                GAME CONTROLS
              </p>

              <h2>Keyboard layout</h2>

              <p>
                Choose the movement keys matching your
                keyboard. Arrow keys remain available
                against the AI and in online matches.
              </p>
            </div>

            <div
              className="control-scheme-selector"
              aria-label="Keyboard layout"
            >
              <button
                type="button"
                className={
                  controlScheme === 'qwerty'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  changeControlScheme('qwerty')
                }
              >
                <strong>QWERTY</strong>
                <span>W / S</span>
              </button>

              <button
                type="button"
                className={
                  controlScheme === 'azerty'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  changeControlScheme('azerty')
                }
              >
                <strong>AZERTY</strong>
                <span>Z / S</span>
              </button>
            </div>
          </section>

          <section className="danger-zone">
            <div>
              <p className="danger-zone-label">
                DANGER ZONE
              </p>

              <h2>Delete account</h2>

              <p>
                Permanently delete your profile, messages,
                friendships and game data. This action cannot
                be undone.
              </p>
            </div>

            <button
              type="button"
              className="delete-account-button"
              disabled={accountDeleting}
              onClick={() =>
                void handleDeleteAccount()
              }
            >
              {accountDeleting
                ? 'Deleting account...'
                : 'Delete my account'}
            </button>
          </section>
            </>
          )}

          {page === 'social' && (
            <>
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

                      <small
                        className={
                          onlineFriendIds.has(friend.id)
                            ? 'online-status'
                            : 'offline-status'
                        }
                      >
                        {onlineFriendIds.has(friend.id)
                          ? 'Online'
                          : 'Offline'}
                      </small>
                    </span>

                    <div className="user-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void handleOpenConversation(friend.id)
                        }
                      >
                        Message
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleRemoveFriend(friend.id)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="chat-layout">
            <ConversationList
              currentUserId={user.id}
              selectedConversationId={
                selectedConversation?.id ?? null
              }
              friends={friends}
              socket={socket}
              refreshKey={conversationRefreshKey}
              onSelect={setSelectedConversation}
              onError={setError}
              onUnreadCountChange={
                setSocialUnreadMessageCount
              }
            />

            <div className="chat-panel">
              {selectedConversation ? (
                <ChatWindow
                  conversation={selectedConversation}
                  currentUserId={user.id}
                  socket={socket}
                  onError={setError}
                  onMessageSent={() => undefined}
                />
              ) : (
                <div className="empty-chat">
                  <h2>Select a conversation</h2>
                  <p>
                    Choose a conversation to start messaging.
                  </p>
                </div>
              )}
            </div>
          </div>
            </>
          )}

          {error && <p className="message error">{error}</p>}
          {success && <p className="message success">{success}</p>}

        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="card auth-card">
        <div className="auth-brand">
          <span className="brand-mark">T</span>

          <div>
            <h1>Transcendence</h1>
            <p>Online Pong Arena</p>
          </div>
        </div>

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
