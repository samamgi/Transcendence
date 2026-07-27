import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Socket } from 'socket.io-client'

const FIELD_WIDTH = 900
const FIELD_HEIGHT = 500
const PADDLE_WIDTH = 14
const PADDLE_HEIGHT = 92
const BALL_SIZE = 16
const PADDLE_SPEED = 430
const INITIAL_BALL_SPEED = 330
const WINNING_SCORE = 5
const AI_SPEED = 325
const AI_DEAD_ZONE = 12

type GameMode =
  | 'local'
  | 'computer'
  | 'online'

type OnlineStatus =
  | 'idle'
  | 'waiting'
  | 'matched'

type OnlineMatchFoundEvent = {
  roomId: string
  side: 'left' | 'right'
  opponentUserId: number
}

type OnlineQueueResponse = {
  success: boolean
  status?: OnlineStatus
  error?: string
}

type OnlinePaddleMovedEvent = {
  y: number
}

type OnlineGameStateEvent = {
  roomId: string
  leftPaddleY: number
  rightPaddleY: number
  ballX: number
  ballY: number
  leftScore: number
  rightScore: number
  winner: 'left' | 'right' | null
}

type PlayPageProps = {
  socket: Socket | null
  controlScheme: 'qwerty' | 'azerty'
}

type GameState = {
  leftPaddleY: number
  rightPaddleY: number
  ballX: number
  ballY: number
  ballVelocityX: number
  ballVelocityY: number
  leftScore: number
  rightScore: number
  running: boolean
  winner: 'left' | 'right' | null
}

function createInitialGameState(): GameState {
  return {
    leftPaddleY:
      FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    rightPaddleY:
      FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: FIELD_WIDTH / 2 - BALL_SIZE / 2,
    ballY: FIELD_HEIGHT / 2 - BALL_SIZE / 2,
    ballVelocityX: INITIAL_BALL_SPEED,
    ballVelocityY: INITIAL_BALL_SPEED * 0.45,
    leftScore: 0,
    rightScore: 0,
    running: false,
    winner: null,
  }
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function resetBall(
  state: GameState,
  direction: 1 | -1,
): GameState {
  return {
    ...state,
    ballX: FIELD_WIDTH / 2 - BALL_SIZE / 2,
    ballY: FIELD_HEIGHT / 2 - BALL_SIZE / 2,
    ballVelocityX:
      INITIAL_BALL_SPEED * direction,
    ballVelocityY:
      INITIAL_BALL_SPEED *
      (Math.random() > 0.5 ? 0.45 : -0.45),
  }
}

export default function PlayPage({
  socket,
  controlScheme,
}: PlayPageProps) {
  const [game, setGame] =
    useState<GameState>(createInitialGameState)

  const [gameMode, setGameMode] =
    useState<GameMode>('local')

  const [onlineStatus, setOnlineStatus] =
    useState<OnlineStatus>('idle')

  const [onlineRoomId, setOnlineRoomId] =
    useState<string | null>(null)

  const [onlineSide, setOnlineSide] =
    useState<'left' | 'right' | null>(null)

  const [onlineError, setOnlineError] =
    useState('')

  const [onlineGame, setOnlineGame] =
    useState<OnlineGameStateEvent | null>(null)

  const [isArenaExpanded, setIsArenaExpanded] =
    useState(false)

  const [onlineLocalPaddleY, setOnlineLocalPaddleY] =
    useState(
      FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    )

  const [
    onlineOpponentPaddleY,
    setOnlineOpponentPaddleY,
  ] = useState(
    FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  )

  const onlineLocalPaddleYRef = useRef(
    FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  )

  const gameRef = useRef(game)
  const gameModeRef = useRef(gameMode)
  const controlSchemeRef =
    useRef(controlScheme)
  const keysRef = useRef<Set<string>>(new Set())
  const frameRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    gameModeRef.current = gameMode
  }, [gameMode])

  useEffect(() => {
    controlSchemeRef.current = controlScheme
  }, [controlScheme])


  useEffect(() => {
    if (!socket) {
      return
    }

    function handleMatchFound(
      event: OnlineMatchFoundEvent,
    ): void {
      const initialPaddleY =
        FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2

      onlineLocalPaddleYRef.current =
        initialPaddleY

      setOnlineLocalPaddleY(initialPaddleY)
      setOnlineOpponentPaddleY(initialPaddleY)
      setOnlineGame(null)
      setOnlineStatus('matched')
      setOnlineRoomId(event.roomId)
      setOnlineSide(event.side)
      setOnlineError('')
    }

    function handleOnlineGameState(
      event: OnlineGameStateEvent,
    ): void {
      setOnlineGame(event)

      if (onlineSide === 'left') {
        setOnlineOpponentPaddleY(
          event.rightPaddleY,
        )
      } else if (onlineSide === 'right') {
        setOnlineOpponentPaddleY(
          event.leftPaddleY,
        )
      }
    }

    function handleOpponentPaddleMoved(
      event: OnlinePaddleMovedEvent,
    ): void {
      setOnlineOpponentPaddleY(
        clamp(
          event.y,
          0,
          FIELD_HEIGHT - PADDLE_HEIGHT,
        ),
      )
    }

    function handleOpponentLeft(): void {
      setOnlineStatus('waiting')
      setOnlineRoomId(null)
      setOnlineSide(null)
      setOnlineError(
        'Your opponent left the match. You were placed back in the queue.',
      )

      if (!socket?.connected) {
        setOnlineStatus('idle')
        setOnlineError(
          'Your opponent left and the online connection is unavailable.',
        )
        return
      }

      socket.emit(
        'online:joinQueue',
        (response: OnlineQueueResponse) => {
          if (!response.success) {
            setOnlineStatus('idle')
            setOnlineError(
              response.error ??
                'Unable to rejoin the queue.',
            )
            return
          }

          setOnlineStatus(
            response.status ?? 'waiting',
          )
        },
      )
    }

    socket.on(
      'online:matchFound',
      handleMatchFound,
    )

    socket.on(
      'online:opponentLeft',
      handleOpponentLeft,
    )

    socket.on(
      'online:opponentPaddleMoved',
      handleOpponentPaddleMoved,
    )

    socket.on(
      'online:gameState',
      handleOnlineGameState,
    )

    return () => {
      socket.off(
        'online:matchFound',
        handleMatchFound,
      )

      socket.off(
        'online:opponentLeft',
        handleOpponentLeft,
      )

      socket.off(
        'online:opponentPaddleMoved',
        handleOpponentPaddleMoved,
      )

      socket.off(
        'online:gameState',
        handleOnlineGameState,
      )
    }
  }, [socket, onlineSide])


  useEffect(() => {
    if (
      gameMode !== 'online' ||
      onlineStatus !== 'matched' ||
      !socket?.connected
    ) {
      return
    }

    const currentSocket = socket

    let animationFrameId = 0
    let previousTimestamp: number | null = null
    let previousEmissionTimestamp = 0

    function updateOnlinePaddle(
      timestamp: number,
    ): void {
      if (!currentSocket.connected) {
        return
      }

      if (previousTimestamp === null) {
        previousTimestamp = timestamp
      }

      const deltaTime = Math.min(
        (timestamp - previousTimestamp) / 1000,
        0.03,
      )

      previousTimestamp = timestamp

      let nextY = onlineLocalPaddleYRef.current

      const playerUpKey =
        controlSchemeRef.current === 'azerty'
          ? 'z'
          : 'w'

      if (
        keysRef.current.has(playerUpKey) ||
        keysRef.current.has('arrowup')
      ) {
        nextY -= PADDLE_SPEED * deltaTime
      }

      if (
        keysRef.current.has('s') ||
        keysRef.current.has('arrowdown')
      ) {
        nextY += PADDLE_SPEED * deltaTime
      }

      nextY = clamp(
        nextY,
        0,
        FIELD_HEIGHT - PADDLE_HEIGHT,
      )

      if (nextY !== onlineLocalPaddleYRef.current) {
        onlineLocalPaddleYRef.current = nextY
        setOnlineLocalPaddleY(nextY)

        /*
         * L'affichage local reste fluide à la fréquence
         * de l'écran, mais le réseau est limité à 30 Hz.
         */
        if (
          timestamp - previousEmissionTimestamp >=
          1000 / 30
        ) {
          previousEmissionTimestamp = timestamp

          currentSocket.emit('online:paddleMove', {
            y: nextY,
          })
        }
      }

      animationFrameId =
        window.requestAnimationFrame(
          updateOnlinePaddle,
        )
    }

    animationFrameId =
      window.requestAnimationFrame(
        updateOnlinePaddle,
      )

    return () => {
      window.cancelAnimationFrame(
        animationFrameId,
      )
    }
  }, [gameMode, onlineStatus, socket])

  useEffect(() => {
    function handleEscape(
      event: globalThis.KeyboardEvent,
    ): void {
      if (
        event.key === 'Escape' &&
        isArenaExpanded
      ) {
        setIsArenaExpanded(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [isArenaExpanded])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const controlledKeys = [
        'w',
        'z',
        's',
        'arrowup',
        'arrowdown',
        ' ',
      ]

      if (
        controlledKeys.includes(
          event.key.toLowerCase(),
        )
      ) {
        event.preventDefault()
      }

      if (event.key === ' ') {
        setGame((currentGame) => {
          if (currentGame.winner) {
            return currentGame
          }

          return {
            ...currentGame,
            running: !currentGame.running,
          }
        })

        return
      }

      keysRef.current.add(event.key.toLowerCase())
    }

    function handleKeyUp(event: KeyboardEvent): void {
      keysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
      window.removeEventListener(
        'keyup',
        handleKeyUp,
      )
    }
  }, [])

  useEffect(() => {
    function update(timestamp: number): void {
      const previousTime = previousTimeRef.current
      previousTimeRef.current = timestamp

      if (previousTime !== null) {
        const deltaTime = Math.min(
          (timestamp - previousTime) / 1000,
          0.03,
        )

        const currentGame = gameRef.current

        if (
          currentGame.running &&
          !currentGame.winner
        ) {
          const nextGame = { ...currentGame }
          const keys = keysRef.current

          const playerUpKey =
            controlSchemeRef.current === 'azerty'
              ? 'z'
              : 'w'

          if (
            keys.has(playerUpKey) ||
            (
              gameModeRef.current === 'computer' &&
              keys.has('arrowup')
            )
          ) {
            nextGame.leftPaddleY -=
              PADDLE_SPEED * deltaTime
          }

          if (
            keys.has('s') ||
            (
              gameModeRef.current === 'computer' &&
              keys.has('arrowdown')
            )
          ) {
            nextGame.leftPaddleY +=
              PADDLE_SPEED * deltaTime
          }

          if (gameModeRef.current === 'computer') {
            const paddleCenter =
              nextGame.rightPaddleY +
              PADDLE_HEIGHT / 2

            const ballCenter =
              nextGame.ballY + BALL_SIZE / 2

            const difference =
              ballCenter - paddleCenter

            if (Math.abs(difference) > AI_DEAD_ZONE) {
              const movement =
                AI_SPEED * deltaTime

              nextGame.rightPaddleY +=
                Math.sign(difference) *
                Math.min(
                  movement,
                  Math.abs(difference),
                )
            }
          } else if (
            gameModeRef.current === 'local'
          ) {
            if (keys.has('arrowup')) {
              nextGame.rightPaddleY -=
                PADDLE_SPEED * deltaTime
            }

            if (keys.has('arrowdown')) {
              nextGame.rightPaddleY +=
                PADDLE_SPEED * deltaTime
            }
          }

          nextGame.leftPaddleY = clamp(
            nextGame.leftPaddleY,
            0,
            FIELD_HEIGHT - PADDLE_HEIGHT,
          )

          nextGame.rightPaddleY = clamp(
            nextGame.rightPaddleY,
            0,
            FIELD_HEIGHT - PADDLE_HEIGHT,
          )

          nextGame.ballX +=
            nextGame.ballVelocityX * deltaTime
          nextGame.ballY +=
            nextGame.ballVelocityY * deltaTime

          if (nextGame.ballY <= 0) {
            nextGame.ballY = 0
            nextGame.ballVelocityY =
              Math.abs(nextGame.ballVelocityY)
          }

          if (
            nextGame.ballY + BALL_SIZE >=
            FIELD_HEIGHT
          ) {
            nextGame.ballY =
              FIELD_HEIGHT - BALL_SIZE
            nextGame.ballVelocityY =
              -Math.abs(nextGame.ballVelocityY)
          }

          const leftCollision =
            nextGame.ballVelocityX < 0 &&
            nextGame.ballX <= PADDLE_WIDTH + 24 &&
            nextGame.ballX + BALL_SIZE >= 24 &&
            nextGame.ballY + BALL_SIZE >=
              nextGame.leftPaddleY &&
            nextGame.ballY <=
              nextGame.leftPaddleY +
                PADDLE_HEIGHT

          if (leftCollision) {
            const paddleCenter =
              nextGame.leftPaddleY +
              PADDLE_HEIGHT / 2

            const ballCenter =
              nextGame.ballY + BALL_SIZE / 2

            const impact =
              (ballCenter - paddleCenter) /
              (PADDLE_HEIGHT / 2)

            nextGame.ballX =
              PADDLE_WIDTH + 24
            nextGame.ballVelocityX =
              Math.abs(
                nextGame.ballVelocityX * 1.04,
              )
            nextGame.ballVelocityY =
              impact * INITIAL_BALL_SPEED
          }

          const rightPaddleX =
            FIELD_WIDTH - PADDLE_WIDTH - 24

          const rightCollision =
            nextGame.ballVelocityX > 0 &&
            nextGame.ballX + BALL_SIZE >=
              rightPaddleX &&
            nextGame.ballX <=
              rightPaddleX + PADDLE_WIDTH &&
            nextGame.ballY + BALL_SIZE >=
              nextGame.rightPaddleY &&
            nextGame.ballY <=
              nextGame.rightPaddleY +
                PADDLE_HEIGHT

          if (rightCollision) {
            const paddleCenter =
              nextGame.rightPaddleY +
              PADDLE_HEIGHT / 2

            const ballCenter =
              nextGame.ballY + BALL_SIZE / 2

            const impact =
              (ballCenter - paddleCenter) /
              (PADDLE_HEIGHT / 2)

            nextGame.ballX =
              rightPaddleX - BALL_SIZE
            nextGame.ballVelocityX =
              -Math.abs(
                nextGame.ballVelocityX * 1.04,
              )
            nextGame.ballVelocityY =
              impact * INITIAL_BALL_SPEED
          }

          if (nextGame.ballX + BALL_SIZE < 0) {
            nextGame.rightScore += 1

            if (
              nextGame.rightScore >= WINNING_SCORE
            ) {
              nextGame.running = false
              nextGame.winner = 'right'
            } else {
              Object.assign(
                nextGame,
                resetBall(nextGame, -1),
              )
            }
          }

          if (nextGame.ballX > FIELD_WIDTH) {
            nextGame.leftScore += 1

            if (
              nextGame.leftScore >= WINNING_SCORE
            ) {
              nextGame.running = false
              nextGame.winner = 'left'
            } else {
              Object.assign(
                nextGame,
                resetBall(nextGame, 1),
              )
            }
          }

          gameRef.current = nextGame
          setGame(nextGame)
        }
      }

      frameRef.current =
        window.requestAnimationFrame(update)
    }

    frameRef.current =
      window.requestAnimationFrame(update)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(
          frameRef.current,
        )
      }
    }
  }, [])

  function toggleArenaExpanded(): void {
    setIsArenaExpanded(
      (currentValue) => !currentValue,
    )
  }

  function startGame(): void {
    setGame((currentGame) => ({
      ...currentGame,
      running: true,
      winner: null,
    }))
  }

  function resetGame(): void {
    keysRef.current.clear()
    previousTimeRef.current = null
    setGame(createInitialGameState())
  }

  function leaveOnlineQueue(): void {
    if (socket?.connected) {
      socket.emit(
        'online:leaveQueue',
        () => undefined,
      )
    }

    setOnlineStatus('idle')
    setOnlineRoomId(null)
    setOnlineSide(null)
    setOnlineGame(null)
  }

  function selectGameMode(
    nextMode: GameMode,
  ): void {
    if (
      gameModeRef.current === 'online' &&
      nextMode !== 'online'
    ) {
      leaveOnlineQueue()
    }

    setGameMode(nextMode)
    gameModeRef.current = nextMode
    setOnlineError('')
    resetGame()
  }

  function joinOnlineQueue(): void {
    if (!socket?.connected) {
      setOnlineError(
        'Online connection is unavailable.',
      )
      return
    }

    setOnlineError('')

    socket.emit(
      'online:joinQueue',
      (response: OnlineQueueResponse) => {
        if (!response.success) {
          setOnlineError(
            response.error ??
              'Unable to join the queue.',
          )
          return
        }

        setOnlineStatus(
          response.status ?? 'waiting',
        )
      },
    )
  }

  return (
    <section
      className={
        isArenaExpanded
          ? 'play-page arena-expanded'
          : 'play-page'
      }
    >
      <div className="play-header">
        <p className="eyebrow">LOCAL PONG</p>
        <h2>Pong Arena</h2>
        <p>
          {gameMode === 'computer'
            ? `Player: ${
                controlScheme === 'azerty'
                  ? 'Z / S'
                  : 'W / S'
              } or ↑ / ↓ · Computer opponent · Space: pause`
            : `Player 1: ${
                controlScheme === 'azerty'
                  ? 'Z / S'
                  : 'W / S'
              } · Player 2: ↑ / ↓ · Space: pause`}
        </p>
      </div>

      <div className="pong-display-actions">
        <button
          type="button"
          className="pong-expand-button"
          onClick={toggleArenaExpanded}
        >
          {isArenaExpanded
            ? 'Reduce arena'
            : 'Expand arena'}
        </button>

        <small>
          {isArenaExpanded
            ? 'Return to the standard Play page'
            : 'Enlarge the arena inside the application'}
        </small>
      </div>

      <div
        className="pong-mode-selector"
        aria-label="Game mode"
      >
        <button
          type="button"
          className={
            gameMode === 'local' ? 'active' : ''
          }
          onClick={() => selectGameMode('local')}
        >
          Local — 2 players
        </button>

        <button
          type="button"
          className={
            gameMode === 'computer' ? 'active' : ''
          }
          onClick={() =>
            selectGameMode('computer')
          }
        >
          Against computer
        </button>

        <button
          type="button"
          className={
            gameMode === 'online' ? 'active' : ''
          }
          onClick={() => selectGameMode('online')}
        >
          Online match
        </button>
      </div>

      {gameMode === 'online' ? (
        <section className="online-pong-panel">
          <p className="eyebrow">ONLINE MATCH</p>

          {onlineStatus === 'idle' && (
            <>
              <h3>Find an opponent</h3>
              <p>
                Join the queue and wait for another
                connected player.
              </p>

              <button
                type="button"
                onClick={joinOnlineQueue}
              >
                Find match
              </button>
            </>
          )}

          {onlineStatus === 'waiting' && (
            <>
              <div className="online-waiting-indicator" />
              <h3>Waiting for an opponent...</h3>
              <p>
                Keep this page open while another
                player joins.
              </p>

              <button
                type="button"
                onClick={leaveOnlineQueue}
              >
                Cancel
              </button>
            </>
          )}

          {onlineStatus === 'matched' && (
            <div className="online-paddle-test">
              <div className="online-match-heading">
                <div>
                  <h3>Match found</h3>
                  <p>
                    You are on the{' '}
                    <strong>{onlineSide}</strong> side.
                    Use W/S or ↑/↓.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={leaveOnlineQueue}
                >
                  Leave match
                </button>
              </div>

              <div className="pong-game-toolbar">
                <div className="pong-score">
                  <span>Left</span>
                  <strong>
                    {onlineGame?.leftScore ?? 0}
                  </strong>

                  <span className="score-divider">
                    :
                  </span>

                  <strong>
                    {onlineGame?.rightScore ?? 0}
                  </strong>
                  <span>Right</span>
                </div>

                <small>
                  First to {WINNING_SCORE}
                </small>
              </div>

              <div
                className="online-paddle-field"
                style={{
                  aspectRatio: `${FIELD_WIDTH} / ${FIELD_HEIGHT}`,
                }}
              >
                <div className="pong-center-line" />

                <div
                  className="pong-game-paddle pong-game-paddle-left"
                  style={{
                    top: `${
                      ((onlineGame?.leftPaddleY ??
                        (onlineSide === 'left'
                          ? onlineLocalPaddleY
                          : onlineOpponentPaddleY)) /
                        FIELD_HEIGHT) *
                      100
                    }%`,
                    height: `${
                      (PADDLE_HEIGHT / FIELD_HEIGHT) *
                      100
                    }%`,
                  }}
                />

                <div
                  className="pong-game-paddle pong-game-paddle-right"
                  style={{
                    top: `${
                      ((onlineGame?.rightPaddleY ??
                        (onlineSide === 'right'
                          ? onlineLocalPaddleY
                          : onlineOpponentPaddleY)) /
                        FIELD_HEIGHT) *
                      100
                    }%`,
                    height: `${
                      (PADDLE_HEIGHT / FIELD_HEIGHT) *
                      100
                    }%`,
                  }}
                />

                {onlineGame && (
                  <div
                    className="pong-game-ball"
                    style={{
                      left: `${
                        (onlineGame.ballX /
                          FIELD_WIDTH) *
                        100
                      }%`,
                      top: `${
                        (onlineGame.ballY /
                          FIELD_HEIGHT) *
                        100
                      }%`,
                      width: `${
                        (BALL_SIZE / FIELD_WIDTH) *
                        100
                      }%`,
                      aspectRatio: '1',
                    }}
                  />
                )}

                {onlineGame?.winner && (
                  <div className="pong-game-overlay">
                    <strong>
                      {onlineGame.winner === onlineSide
                        ? 'You win'
                        : 'You lose'}
                    </strong>

                    <p>
                      Final score:{' '}
                      {onlineGame.leftScore} -{' '}
                      {onlineGame.rightScore}
                    </p>

                    <button
                      type="button"
                      onClick={leaveOnlineQueue}
                    >
                      Leave match
                    </button>
                  </div>
                )}
              </div>

              <small>
                Room: {onlineRoomId}
              </small>
            </div>
          )}

          {onlineError && (
            <p className="message error">
              {onlineError}
            </p>
          )}
        </section>
      ) : (
        <>

      <div className="pong-game-toolbar">
        <div className="pong-score">
          <span>Player 1</span>
          <strong>{game.leftScore}</strong>
          <span className="score-divider">:</span>
          <strong>{game.rightScore}</strong>
          <span>
            {gameMode === 'computer'
              ? 'Computer'
              : 'Player 2'}
          </span>
        </div>

        <div className="pong-game-actions">
          {!game.running && !game.winner && (
            <button
              type="button"
              onClick={startGame}
            >
              {game.leftScore === 0 &&
              game.rightScore === 0
                ? 'Start match'
                : 'Resume'}
            </button>
          )}

          {game.running && (
            <button
              type="button"
              onClick={() =>
                setGame((currentGame) => ({
                  ...currentGame,
                  running: false,
                }))
              }
            >
              Pause
            </button>
          )}

          <button type="button" onClick={resetGame}>
            Reset
          </button>
        </div>
      </div>

      <div className="pong-game-viewport">
        <div
          className="pong-game-field"
          style={{
            aspectRatio: `${FIELD_WIDTH} / ${FIELD_HEIGHT}`,
          }}
        >
          <div className="pong-center-line" />

          <div
            className="pong-game-paddle pong-game-paddle-left"
            style={{
              top: `${
                (game.leftPaddleY / FIELD_HEIGHT) *
                100
              }%`,
              height: `${
                (PADDLE_HEIGHT / FIELD_HEIGHT) *
                100
              }%`,
            }}
          />

          <div
            className="pong-game-paddle pong-game-paddle-right"
            style={{
              top: `${
                (game.rightPaddleY / FIELD_HEIGHT) *
                100
              }%`,
              height: `${
                (PADDLE_HEIGHT / FIELD_HEIGHT) *
                100
              }%`,
            }}
          />

          <div
            className="pong-game-ball"
            style={{
              left: `${
                (game.ballX / FIELD_WIDTH) * 100
              }%`,
              top: `${
                (game.ballY / FIELD_HEIGHT) * 100
              }%`,
              width: `${
                (BALL_SIZE / FIELD_WIDTH) * 100
              }%`,
              aspectRatio: '1',
            }}
          />

          {!game.running && (
            <div className="pong-game-overlay">
              {game.winner ? (
                <>
                  <strong>
                    {game.winner === 'left'
                      ? gameMode === 'computer'
                        ? 'You win'
                        : 'Player 1 wins'
                      : gameMode === 'computer'
                        ? 'Computer wins'
                        : 'Player 2 wins'}
                  </strong>

                  <button
                    type="button"
                    onClick={resetGame}
                  >
                    New match
                  </button>
                </>
              ) : (
                <strong>
                  {game.leftScore === 0 &&
                  game.rightScore === 0
                    ? 'Press Start or Space'
                    : 'Paused'}
                </strong>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pong-controls-grid">
        <article>
          <span>PLAYER 1</span>

          <strong>
            {controlScheme === 'azerty'
              ? 'Z / S'
              : 'W / S'}
          </strong>

          <p>
            {controlScheme === 'azerty'
              ? 'AZERTY keyboard'
              : 'QWERTY keyboard'}
          </p>
        </article>

        <article>
          <span>FIRST TO</span>
          <strong>{WINNING_SCORE}</strong>
          <p>Points wins the match</p>
        </article>

        <article>
          <span>
            {gameMode === 'computer'
              ? 'OPPONENT'
              : 'PLAYER 2'}
          </span>

          <strong>
            {gameMode === 'computer'
              ? 'AI'
              : '↑ / ↓'}
          </strong>

          <p>
            {gameMode === 'computer'
              ? 'Computer-controlled paddle'
              : 'Right paddle'}
          </p>
        </article>
      </div>
        </>
      )}
    </section>
  )
}
