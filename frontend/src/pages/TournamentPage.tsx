import { useCallback, useEffect, useMemo, useState } from 'react'

type TournamentParticipant = {
  userId: number
  username: string
  displayName: string | null
  joinedAt: string
}

type TournamentMatch = {
  id: string
  round: 1 | 2
  position: number
  player1Id: number
  player2Id: number
  winnerId: number | null
  player1Score: number | null
  player2Score: number | null
  status: 'PENDING' | 'COMPLETED'
}

type Tournament = {
  id: string
  name: string
  createdBy: number
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
  winnerId: number | null
  createdAt: string
  updatedAt: string
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
}

type TournamentResponse = {
  tournament: Tournament | null
  error?: string
}

type TournamentPageProps = {
  currentUserId: number
}

async function fetchTournament(url: string, options?: RequestInit): Promise<TournamentResponse> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })

  const payload = (await response.json()) as TournamentResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Tournament request failed')
  }

  return payload
}

function getDisplayName(participant: TournamentParticipant): string {
  return participant.displayName ?? participant.username
}

export default function TournamentPage({
  currentUserId,
}: TournamentPageProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newTournamentName, setNewTournamentName] = useState('Weekly Cup')

  const loadActiveTournament = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = await fetchTournament('/api/tournaments/active')
      setTournament(payload.tournament)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load tournament',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadOnMount() {
      try {
        const payload = await fetchTournament('/api/tournaments/active')

        if (!cancelled) {
          setTournament(payload.tournament)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load tournament',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOnMount()

    return () => {
      cancelled = true
    }
  }, [loadActiveTournament])

  const participantsById = useMemo(() => {
    const map = new Map<number, TournamentParticipant>()

    for (const participant of tournament?.participants ?? []) {
      map.set(participant.userId, participant)
    }

    return map
  }, [tournament])

  const isCurrentUserRegistered = Boolean(
    tournament?.participants.some(
      (participant) => participant.userId === currentUserId,
    ),
  )

  const nextMatchForCurrentUser =
    tournament?.matches.find(
      (match) =>
        match.status === 'PENDING' &&
        (match.player1Id === currentUserId ||
          match.player2Id === currentUserId),
    ) ?? null

  const tournamentProgressLabel =
    tournament?.status === 'OPEN'
      ? 'Registration open'
      : tournament?.status === 'IN_PROGRESS'
        ? 'Bracket in progress'
        : 'Tournament completed'

  async function createTournament() {
    const name = newTournamentName.trim()

    if (name.length < 3) {
      setError('Tournament name must contain at least 3 characters')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = await fetchTournament('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name,
        }),
      })

      setTournament(payload.tournament)
      setSuccess('Tournament created')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create tournament',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function joinTournament() {
    if (!tournament) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = await fetchTournament(
        `/api/tournaments/${tournament.id}/join`,
        {
          method: 'POST',
        },
      )

      setTournament(payload.tournament)
      setSuccess('You joined the tournament')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to join tournament',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function startTournament() {
    if (!tournament) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = await fetchTournament(
        `/api/tournaments/${tournament.id}/start`,
        {
          method: 'POST',
        },
      )

      setTournament(payload.tournament)
      setSuccess('Tournament started')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to start tournament',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function reportMatch(
    matchId: string,
    winnerId: number,
    player1Score: number,
    player2Score: number,
  ) {
    if (!tournament) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = await fetchTournament(
        `/api/tournaments/${tournament.id}/matches/${matchId}/report`,
        {
          method: 'POST',
          body: JSON.stringify({
            winnerId,
            player1Score,
            player2Score,
          }),
        },
      )

      setTournament(payload.tournament)
      setSuccess('Match result recorded')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to report match result',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="tournament-page">
      <section className="tournament-header-card">
        <p className="eyebrow">TOURNAMENT</p>
        <h2>Single-elimination cup</h2>
        <p>
          4-player bracket with automatic semifinals and final.
        </p>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadActiveTournament()}
          disabled={loading || submitting}
        >
          Refresh
        </button>
      </section>

      {loading ? (
        <p>Loading tournament...</p>
      ) : tournament ? (
        <section className="tournament-body-grid">
          <article className="dashboard-card tournament-card tournament-card--status">
            <div className="tournament-card-head">
              <p className="dashboard-card-label">STATUS</p>
              <span className={`tournament-status-chip status-${tournament.status.toLowerCase()}`}>
                {tournamentProgressLabel}
              </span>
            </div>

            <h3>{tournament.name}</h3>
            <p>{tournament.status.replace('_', ' ')}</p>

            <div className="tournament-card-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadActiveTournament()}
                disabled={loading || submitting}
              >
                Refresh
              </button>

              {tournament.status === 'OPEN' && !isCurrentUserRegistered && (
                <button
                  type="button"
                  onClick={() => void joinTournament()}
                  disabled={submitting}
                >
                  Join tournament
                </button>
              )}

              {tournament.status === 'OPEN' && tournament.createdBy === currentUserId && (
                <button
                  type="button"
                  onClick={() => void startTournament()}
                  disabled={submitting || tournament.participants.length !== 4}
                >
                  Start bracket
                </button>
              )}
            </div>

            {tournament.status === 'OPEN' && isCurrentUserRegistered && (
              <p className="tournament-card-note">You are registered and ready for the bracket.</p>
            )}

            {tournament.status === 'COMPLETED' && tournament.winnerId !== null && (
              <p>
                Winner:{' '}
                <strong>
                  {getDisplayName(
                    participantsById.get(tournament.winnerId) ?? {
                      userId: tournament.winnerId,
                      username: `user-${tournament.winnerId}`,
                      displayName: null,
                      joinedAt: new Date().toISOString(),
                    },
                  )}
                </strong>
              </p>
            )}
          </article>

          <article className="dashboard-card tournament-card">
            <div className="tournament-card-head">
              <p className="dashboard-card-label">PARTICIPANTS</p>
              <span className="tournament-count-pill">
                {tournament.participants.length} / 4
              </span>
            </div>

            <h3>Registered players</h3>
            <ul className="tournament-list">
              {tournament.participants.map((participant, index) => (
                <li key={participant.userId}>
                  <span>Seed {index + 1}</span>
                  <strong>{getDisplayName(participant)}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="dashboard-card tournament-card">
            <p className="dashboard-card-label">MATCHMAKING</p>
            <h3>Next match</h3>

            {nextMatchForCurrentUser ? (
              <>
                <p>
                  Round {nextMatchForCurrentUser.round} · Match {nextMatchForCurrentUser.position}
                </p>
                <p>
                  {getDisplayName(
                    participantsById.get(nextMatchForCurrentUser.player1Id)!,
                  )}{' '}
                  vs{' '}
                  {getDisplayName(
                    participantsById.get(nextMatchForCurrentUser.player2Id)!,
                  )}
                </p>
              </>
            ) : (
              <p>No pending match for you.</p>
            )}
          </article>

          <article className="dashboard-card tournament-card tournament-bracket-card">
            <div className="tournament-card-head">
              <p className="dashboard-card-label">BRACKET</p>
              <span className="tournament-count-pill">
                {tournament.matches.length} matches
              </span>
            </div>

            <h3>Match order and results</h3>

            {tournament.matches.length === 0 ? (
              <p>Bracket will be generated when the creator starts the tournament.</p>
            ) : (
              <ul className="tournament-list tournament-list--matches">
                {tournament.matches.map((match) => {
                  const player1 = participantsById.get(match.player1Id)
                  const player2 = participantsById.get(match.player2Id)

                  const canReport =
                    match.status === 'PENDING' &&
                    (match.player1Id === currentUserId ||
                      match.player2Id === currentUserId ||
                      tournament.createdBy === currentUserId)

                  return (
                    <li key={match.id}>
                      <div>
                        <span>
                          Round {match.round} · Match {match.position}
                        </span>
                        <strong>
                          {(player1 ? getDisplayName(player1) : `user-${match.player1Id}`) +
                            ' vs ' +
                            (player2 ? getDisplayName(player2) : `user-${match.player2Id}`)}
                        </strong>
                      </div>

                      {match.status === 'COMPLETED' ? (
                        <p>
                          {match.player1Score} - {match.player2Score}
                        </p>
                      ) : canReport ? (
                        <div className="tournament-report-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void reportMatch(
                                match.id,
                                match.player1Id,
                                5,
                                3,
                              )
                            }
                            disabled={submitting}
                          >
                            {player1 ? getDisplayName(player1) : 'Player 1'} wins
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void reportMatch(
                                match.id,
                                match.player2Id,
                                3,
                                5,
                              )
                            }
                            disabled={submitting}
                          >
                            {player2 ? getDisplayName(player2) : 'Player 2'} wins
                          </button>
                        </div>
                      ) : (
                        <p>Pending</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        </section>
      ) : (
          <section className="dashboard-card tournament-card tournament-create-card">
          <p className="dashboard-card-label">CREATE</p>
          <h3>Create the next tournament</h3>
          <p>
            Create one active tournament and register 4 players to launch the bracket.
          </p>

          <label>
            Tournament name
            <input
              type="text"
              value={newTournamentName}
              minLength={3}
              maxLength={64}
              onChange={(event) =>
                setNewTournamentName(event.target.value)
              }
            />
          </label>

          <button
            type="button"
            onClick={() => void createTournament()}
            disabled={submitting}
          >
            Create tournament
          </button>
        </section>
      )}

      {error && <p className="message error">{error}</p>}
      {success && <p className="message success">{success}</p>}
    </section>
  )
}
