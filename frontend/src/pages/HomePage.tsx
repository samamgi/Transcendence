type HomePageProps = {
  username: string
  onlineFriendsCount: number
  onPlay: () => void
  onSocial: () => void
}

export default function HomePage({
  username,
  onlineFriendsCount,
  onPlay,
  onSocial,
}: HomePageProps) {
  return (
    <section className="home-page">
      <section className="hero-panel">
        <div className="hero-content">
          <p className="eyebrow">WELCOME BACK</p>

          <h2>
            Ready to play, {username}?
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
            QUICK PLAY
          </p>

          <h3>Enter the arena</h3>

          <p>
            Start a match immediately and choose your
            preferred game mode.
          </p>

          <button type="button" onClick={onPlay}>
            Choose a mode
          </button>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card-label">
            GAME MODES
          </p>

          <h3>Three ways to play</h3>

          <ul className="home-mode-list">
            <li>
              <strong>Local</strong>
              <span>Two players, one keyboard</span>
            </li>

            <li>
              <strong>Against AI</strong>
              <span>Solo game against the computer</span>
            </li>

            <li>
              <strong>Online</strong>
              <span>Real-time multiplayer matchmaking</span>
            </li>
          </ul>
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
