import { useEffect, useState } from 'react'

export type ConversationUser = {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export type ConversationParticipant = {
  userId: number
  user: ConversationUser
}

export type Conversation = {
  id: number
  type: 'PRIVATE' | 'GROUP'
  name: string | null
  ownerId: number | null
  participants?: ConversationParticipant[]
  messages?: Array<{
    id: number
    content: string
    createdAt: string
    senderId: number
  }>
  unreadCount?: number
}

type ConversationsResponse = {
  conversations?: Conversation[]
  error?: string
}

type ConversationListProps = {
  currentUserId: number
  selectedConversationId: number | null
  refreshKey: number
  onSelect: (conversation: Conversation) => void
  onError: (message: string) => void
}

function getConversationName(
  conversation: Conversation,
  currentUserId: number,
): string {
  if (conversation.type === 'GROUP') {
    return conversation.name ?? 'Unnamed group'
  }

  const otherParticipant = conversation.participants?.find(
    (participant) => participant.userId !== currentUserId,
  )

  if (!otherParticipant) {
    return 'Private conversation'
  }

  return (
    otherParticipant?.user?.displayName ??
    otherParticipant?.user?.username ??
    'Private conversation'
  )
}

export default function ConversationList({
  currentUserId,
  selectedConversationId,
  refreshKey,
  onSelect,
  onError,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadConversations(): Promise<void> {
      setLoading(true)

      try {
        const response = await fetch('/api/conversations', {
          credentials: 'include',
        })

        const payload =
          (await response.json()) as ConversationsResponse

        if (!response.ok) {
          throw new Error(
            payload.error ?? 'Unable to load conversations',
          )
        }

        if (!cancelled) {
          setConversations(
            (payload.conversations ?? []).map(
              (conversation) => ({
                ...conversation,
                participants: conversation.participants ?? [],
                messages: conversation.messages ?? [],
                unreadCount: conversation.unreadCount ?? 0,
              }),
            ),
          )
        }
      } catch (caughtError) {
        if (!cancelled) {
          onError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load conversations',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadConversations()

    return () => {
      cancelled = true
    }
  }, [refreshKey, onError])

  return (
    <section className="social-section">
      <h2>Conversations</h2>

      {loading ? (
        <p>Loading conversations...</p>
      ) : conversations.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <ul className="conversation-list">
          {conversations.map((conversation) => {
            const lastMessage = conversation.messages?.[0]

            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={
                    selectedConversationId === conversation.id
                      ? 'conversation-button active'
                      : 'conversation-button'
                  }
                  onClick={() => onSelect(conversation)}
                >
                  <span>
                    <strong>
                      {getConversationName(
                        conversation,
                        currentUserId,
                      )}
                    </strong>

                    {lastMessage && (
                      <small>{lastMessage.content}</small>
                    )}
                  </span>

                  {(conversation.unreadCount ?? 0) > 0 && (
                    <span className="unread-count">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
