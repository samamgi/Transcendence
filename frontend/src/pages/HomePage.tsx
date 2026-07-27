type HomePageProps = {
  username: string
  onlineFriendsCount: number
  totalMatches: number
  winRate: number
  onPlay: () => void
  onSocial: () => void
  onOpenStatistics: () => void
  onOpenTournament: () => void
}

export default function HomePage({
  username,
  onlineFriendsCount,
  totalMatches,
  winRate,
  onPlay,
  onSocial,
  onOpenStatistics,
  onOpenTournament,
}: HomePageProps) {
  return (
    <section className="home-page">
      <section className="hero-panel">
        <div className="hero-content">
          <p className="eyebrow">WELCOME BACK</p>

          <h2>
            Ready to play, {username} ?
          </h2>

          <p>
            Choose a Pong mode, challenge the AI or
            find another player online.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-action"
              onClick={onPlay}
            >
              Play Pong
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onSocial}
            >
              Open Social
            </button>
          </div>
        </div>

        <div
          className="home-pong-preview"
          aria-hidden="true"
        >
          <div className="home-preview-line" />
          <div className="home-preview-paddle left" />
          <div className="home-preview-ball" />
          <div className="home-preview-paddle right" />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <p className="dashboard-card-label">
            TOURNAMENT
          </p>

          <h3>Future tournament hub</h3>

          <p>
            Access the upcoming tournament space and
            follow future competitive brackets.
          </p>

          <button
            type="button"
            onClick={onOpenTournament}
          >
            Open tournament
          </button>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card-label">
            STATISTICS
          </p>

          <h3>Online match summary</h3>

          <div className="home-stats-mini">
            <div>
              <span>Win rate</span>
              <strong>{winRate}%</strong>
            </div>

            <div>
              <span>Matches</span>
              <strong>{totalMatches}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenStatistics}
          >
            View details
          </button>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card-label">
            FRIENDS ONLINE
          </p>

          <strong className="home-online-count">
            {onlineFriendsCount}
          </strong>

          <p>
            {onlineFriendsCount === 1
              ? 'friend is currently online.'
              : 'friends are currently online.'}
          </p>

          <button type="button" onClick={onSocial}>
            View friends
          </button>
        </article>
      </section>
    </section>
  )
}
