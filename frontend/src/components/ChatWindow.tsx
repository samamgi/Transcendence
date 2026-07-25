import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import type { Socket } from 'socket.io-client'
import type { Conversation } from './ConversationList'

type MessageUser = {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
}

type ChatMessage = {
  id: number
  conversationId: number
  senderId: number
  content: string
  createdAt: string
  updatedAt: string
  sender: MessageUser
}

type MessagesResponse = {
  messages?: ChatMessage[]
  error?: string
}

type SocketResponse = {
  success: boolean
  message?: ChatMessage
  error?: string
}

type JoinConversationResponse = {
  success: boolean
  error?: string
}

type TypingEvent = {
  conversationId: number
  userId: number
}

type ChatWindowProps = {
  conversation: Conversation
  currentUserId: number
  socket: Socket | null
  onError: (message: string) => void
  onMessageSent: () => void
}

function getConversationName(
  conversation: Conversation,
  currentUserId: number,
): string {
  if (conversation.type === 'GROUP') {
    return conversation.name ?? 'Unnamed group'
  }

  const otherParticipant = conversation.participants.find(
    (participant) =>
      participant.userId !== currentUserId,
  )

  return (
    otherParticipant?.user.displayName ??
    otherParticipant?.user.username ??
    'Private conversation'
  )
}

function getTypingUserName(
  conversation: Conversation,
  userId: number,
): string {
  const participant = conversation.participants.find(
    (currentParticipant) =>
      currentParticipant.userId === userId,
  )

  return (
    participant?.user.displayName ??
    participant?.user.username ??
    'Someone'
  )
}

export default function ChatWindow({
  conversation,
  currentUserId,
  socket,
  onError,
  onMessageSent,
}: ChatWindowProps) {
  const [messages, setMessages] =
    useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typingUserIds, setTypingUserIds] =
    useState<Set<number>>(new Set())

  const typingTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMessages(): Promise<void> {
      setLoading(true)

      try {
        const response = await fetch(
          `/api/conversations/${conversation.id}/messages`,
          {
            credentials: 'include',
          },
        )

        const payload =
          (await response.json()) as MessagesResponse

        if (!response.ok) {
          throw new Error(
            payload.error ?? 'Unable to load messages',
          )
        }

        if (!cancelled) {
          setMessages(payload.messages ?? [])
        }
      } catch (caughtError) {
        if (!cancelled) {
          onError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load messages',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMessages()

    return () => {
      cancelled = true
    }
  }, [conversation.id, onError])

  useEffect(() => {
    if (!socket?.connected) {
      return
    }

    function handleNewMessage(
      message: ChatMessage,
    ): void {
      if (
        message.conversationId !== conversation.id
      ) {
        return
      }

      setMessages((currentMessages) => {
        const alreadyPresent =
          currentMessages.some(
            (currentMessage) =>
              currentMessage.id === message.id,
          )

        if (alreadyPresent) {
          return currentMessages
        }

        return [...currentMessages, message]
      })
    }

    function handleTypingStart(
      event: TypingEvent,
    ): void {
      if (
        event.conversationId !== conversation.id ||
        event.userId === currentUserId
      ) {
        return
      }

      setTypingUserIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.add(event.userId)
        return nextIds
      })
    }

    function handleTypingStop(
      event: TypingEvent,
    ): void {
      if (
        event.conversationId !== conversation.id
      ) {
        return
      }

      setTypingUserIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(event.userId)
        return nextIds
      })
    }

    socket.on('newMessage', handleNewMessage)
    socket.on('typing:start', handleTypingStart)
    socket.on('typing:stop', handleTypingStop)

    socket.emit(
      'joinConversation',
      conversation.id,
      (response: JoinConversationResponse) => {
        if (!response.success) {
          onError(
            response.error ??
              'Unable to join conversation',
          )
        }
      },
    )

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      socket.emit(
        'typing:stop',
        {
          conversationId: conversation.id,
        },
        () => undefined,
      )

      socket.off('newMessage', handleNewMessage)
      socket.off('typing:start', handleTypingStart)
      socket.off('typing:stop', handleTypingStop)

      socket.emit(
        'leaveConversation',
        conversation.id,
        () => undefined,
      )
    }
  }, [
    conversation.id,
    currentUserId,
    onError,
    socket,
  ])

  function handleContentChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ): void {
    const nextContent = event.target.value
    setContent(nextContent)

    if (!socket?.connected) {
      return
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (!nextContent.trim()) {
      socket.emit(
        'typing:stop',
        {
          conversationId: conversation.id,
        },
        () => undefined,
      )
      return
    }

    socket.emit(
      'typing:start',
      {
        conversationId: conversation.id,
      },
      () => undefined,
    )

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit(
        'typing:stop',
        {
          conversationId: conversation.id,
        },
        () => undefined,
      )

      typingTimeoutRef.current = null
    }, 1200)
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault()
    onError('')

    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    if (!socket?.connected) {
      onError('Chat connection is unavailable')
      return
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    socket.emit(
      'typing:stop',
      {
        conversationId: conversation.id,
      },
      () => undefined,
    )

    setSending(true)

    socket.emit(
      'sendMessage',
      {
        conversationId: conversation.id,
        content: trimmedContent,
      },
      (response: SocketResponse) => {
        setSending(false)

        if (!response.success) {
          onError(
            response.error ??
              'Unable to send message',
          )
          return
        }

        setContent('')
        onMessageSent()
      },
    )
  }

  const typingNames = Array.from(typingUserIds).map(
    (userId) =>
      getTypingUserName(conversation, userId),
  )

  return (
    <section className="social-section chat-window">
      <h2>
        {getConversationName(
          conversation,
          currentUserId,
        )}
      </h2>

      <div className="message-list">
        {loading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={
                message.senderId === currentUserId
                  ? 'chat-message own-message'
                  : 'chat-message'
              }
            >
              <strong>
                {message.sender.displayName ??
                  message.sender.username}
              </strong>

              <p>{message.content}</p>

              <small>
                {new Date(
                  message.createdAt,
                ).toLocaleString()}
              </small>
            </article>
          ))
        )}
      </div>

      <p className="typing-indicator">
        {typingNames.length > 0
          ? `${typingNames.join(', ')} ${
              typingNames.length === 1
                ? 'is'
                : 'are'
            } typing...`
          : '\u00a0'}
      </p>

      <form
        className="message-form"
        onSubmit={handleSubmit}
      >
        <label>
          Message
          <textarea
            value={content}
            maxLength={2000}
            rows={3}
            required
            onChange={handleContentChange}
          />
        </label>

        <button type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  )
}
