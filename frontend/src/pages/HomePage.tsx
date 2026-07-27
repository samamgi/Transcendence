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
      <div className="hero-panel">
        <p className="eyebrow">ONLINE PONG ARENA</p>

        <h2>
          Welcome back,
          <span>{username}</span>
        </h2>

        <p className="hero-description">
          Challenge your friends and become the next
          Transcendence champion.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="primary-action"
            onClick={onPlay}
          >
            Play now
          </button>

          <button type="button" onClick={onSocial}>
            Open social
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <small>Friends online</small>
          <strong>{onlineFriendsCount}</strong>
          <p>Players currently available.</p>
        </article>

        <article className="dashboard-card">
          <small>Game mode</small>
          <strong>Pong</strong>
          <p>The arena is being prepared.</p>
        </article>

        <article className="dashboard-card">
          <small>Next objective</small>
          <strong>First victory</strong>
          <p>Your match history will appear here.</p>
        </article>
      </div>
    </section>
  )
}
