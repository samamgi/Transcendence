import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'

export type ConversationUser = {
  id: number
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export type ConversationParticipant = {
  userId: number
  user?: ConversationUser
}

type ConversationMessagePreview = {
  id: number
  content: string
  createdAt: string
  senderId: number
}

export type Conversation = {
  id: number
  type: 'PRIVATE' | 'GROUP'
  name: string | null
  ownerId: number | null
  participants?: ConversationParticipant[]
  messages?: ConversationMessagePreview[]
  unreadCount?: number
  reactionUnreadCount?: number

  // Formats également possibles renvoyés par le backend.
  otherUser?: ConversationUser | null
  lastMessage?: ConversationMessagePreview | null
}

type RawConversation = Conversation & {
  participants?: Array<
    ConversationParticipant | ConversationUser
  >
}

type ConversationsResponse = {
  conversations?: RawConversation[]
  error?: string
}

type RealtimeMessage = {
  id: number
  conversationId: number
  senderId: number
  content: string
  createdAt: string
}

type SocketResponse = {
  success: boolean
  error?: string
}

type ConversationListProps = {
  currentUserId: number
  selectedConversationId: number | null
  friends: ConversationUser[]
  socket: Socket | null
  refreshKey: number
  onSelect: (conversation: Conversation) => void
  onError: (message: string) => void
  onUnreadCountChange: (count: number) => void
}

function isConversationParticipant(
  participant:
    | ConversationParticipant
    | ConversationUser,
): participant is ConversationParticipant {
  return 'userId' in participant
}

function normalizeConversation(
  conversation: RawConversation,
): Conversation {
  const normalizedParticipants =
    (conversation.participants ?? []).map(
      (participant): ConversationParticipant => {
        if (isConversationParticipant(participant)) {
          return participant
        }

        const user = participant as ConversationUser

        return {
          userId: user.id,
          user,
        }
      },
    )

  if (
    conversation.type === 'PRIVATE' &&
    conversation.otherUser &&
    !normalizedParticipants.some(
      (participant) =>
        participant.userId ===
        conversation.otherUser?.id,
    )
  ) {
    normalizedParticipants.push({
      userId: conversation.otherUser.id,
      user: conversation.otherUser,
    })
  }

  const messages =
    conversation.messages ??
    (conversation.lastMessage
      ? [conversation.lastMessage]
      : [])

  return {
    ...conversation,
    name: conversation.name ?? null,
    ownerId: conversation.ownerId ?? null,
    participants: normalizedParticipants,
    messages,
    unreadCount: conversation.unreadCount ?? 0,
    reactionUnreadCount:
      conversation.reactionUnreadCount ?? 0,
  }
}

function getConversationName(
  conversation: Conversation,
  currentUserId: number,
  friends: ConversationUser[],
): string {
  if (conversation.type === 'GROUP') {
    return conversation.name ?? 'Unnamed group'
  }

  if (conversation.otherUser) {
    return (
      conversation.otherUser.displayName ??
      conversation.otherUser.username
    )
  }

  const otherParticipant =
    conversation.participants?.find(
      (participant) =>
        participant.userId !== currentUserId,
    )

  const matchingFriend = friends.find(
    (friend) =>
      friend.id === otherParticipant?.userId,
  )

  return (
    otherParticipant?.user?.displayName ??
    otherParticipant?.user?.username ??
    matchingFriend?.displayName ??
    matchingFriend?.username ??
    'Private conversation'
  )
}

export default function ConversationList({
  currentUserId,
  selectedConversationId,
  friends,
  socket,
  refreshKey,
  onSelect,
  onError,
  onUnreadCountChange,
}: ConversationListProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadConversations(): Promise<void> {
      setLoading(true)

      try {
        const response = await fetch(
          '/api/conversations',
          {
            credentials: 'include',
          },
        )

        const payload =
          (await response.json()) as ConversationsResponse

        if (!response.ok) {
          throw new Error(
            payload.error ??
              'Unable to load conversations',
          )
        }

        if (!cancelled) {
          setConversations(
            (payload.conversations ?? []).map(
              normalizeConversation,
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

  /*
   * On rejoint toutes les conversations afin que la liste
   * reçoive aussi les messages des conversations non ouvertes.
   */
  useEffect(() => {
    const unreadCount =
      conversations.reduce(
        (total, conversation) =>
          total +
          (conversation.unreadCount ?? 0) +
          (conversation.reactionUnreadCount ?? 0),
        0,
      )

    onUnreadCountChange(unreadCount)
  }, [
    conversations,
    onUnreadCountChange,
  ])

  useEffect(() => {
    if (!socket?.connected) {
      return
    }

    for (const conversation of conversations) {
      socket.emit(
        'joinConversation',
        conversation.id,
        () => undefined,
      )
    }
  }, [conversations, socket])

  useEffect(() => {
    if (!socket) {
      return
    }

    function markRead(
      conversationId: number,
      messageId: number,
    ): void {
      if (!socket || !socket.connected) {
        return
      }

      socket.emit(
        'conversation:read',
        {
          conversationId,
          messageId,
        },
        (response: SocketResponse) => {
          if (!response.success) {
            onError(
              response.error ??
                'Unable to mark conversation as read',
            )
          }
        },
      )
    }

    function handleNewMessage(
      message: RealtimeMessage,
    ): void {
      const isConversationOpen =
        selectedConversationId ===
        message.conversationId

      const wasSentByCurrentUser =
        message.senderId === currentUserId

      setConversations((currentConversations) => {
        const conversationExists =
          currentConversations.some(
            (conversation) =>
              conversation.id ===
              message.conversationId,
          )

        if (!conversationExists) {
          return currentConversations
        }

        const updatedConversations =
          currentConversations.map((conversation) => {
            if (
              conversation.id !==
              message.conversationId
            ) {
              return conversation
            }

            return {
              ...conversation,
              messages: [
                message,
                ...(conversation.messages ?? []).filter(
                  (currentMessage) =>
                    currentMessage.id !== message.id,
                ),
              ],
              unreadCount:
                isConversationOpen ||
                wasSentByCurrentUser
                  ? 0
                  : (conversation.unreadCount ?? 0) +
                    1,
            }
          })

        const updatedConversation =
          updatedConversations.find(
            (conversation) =>
              conversation.id ===
              message.conversationId,
          )

        if (updatedConversation) {
          onSelect(
            isConversationOpen
              ? {
                  ...updatedConversation,
                  unreadCount: 0,
                reactionUnreadCount: 0,
                }
              : updatedConversation,
          )
        }

        return [
          ...updatedConversations.filter(
            (conversation) =>
              conversation.id ===
              message.conversationId,
          ),
          ...updatedConversations.filter(
            (conversation) =>
              conversation.id !==
              message.conversationId,
          ),
        ]
      })

      if (isConversationOpen) {
        markRead(
          message.conversationId,
          message.id,
        )
      }
    }

    function handleReactionNotification(
      reaction: {
        conversationId: number
        messageId: number
        messageSenderId?: number
        userId: number
      },
    ): void {
      if (
        reaction.messageSenderId !== currentUserId ||
        reaction.userId === currentUserId
      ) {
        return
      }

      const isConversationOpen =
        selectedConversationId ===
        reaction.conversationId

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id ===
          reaction.conversationId
            ? {
                ...conversation,
                reactionUnreadCount:
                  isConversationOpen
                    ? 0
                    : (
                        conversation
                          .reactionUnreadCount ?? 0
                      ) + 1,
              }
            : conversation,
        ),
      )

      if (isConversationOpen) {
        markRead(
          reaction.conversationId,
          reaction.messageId,
        )
      }
    }

    socket.on('newMessage', handleNewMessage)
    socket.on(
      'messageReactionAdded',
      handleReactionNotification,
    )

    return () => {
      socket.off('newMessage', handleNewMessage)
      socket.off(
        'messageReactionAdded',
        handleReactionNotification,
      )
    }
  }, [
    currentUserId,
    onError,
    onSelect,
    selectedConversationId,
    socket,
  ])

  function selectConversation(
    conversation: Conversation,
  ): void {
    const lastMessage = conversation.messages?.[0]

    setConversations((currentConversations) =>
      currentConversations.map(
        (currentConversation) =>
          currentConversation.id === conversation.id
            ? {
                ...currentConversation,
                unreadCount: 0,
                reactionUnreadCount: 0,
              }
            : currentConversation,
      ),
    )

    const selectedConversation = {
      ...conversation,
      unreadCount: 0,
      reactionUnreadCount: 0,
    }

    onSelect(selectedConversation)

    if (
      socket &&
      socket.connected &&
      lastMessage
    ) {
      socket.emit(
        'conversation:read',
        {
          conversationId: conversation.id,
          messageId: lastMessage.id,
        },
        (response: SocketResponse) => {
          if (!response.success) {
            onError(
              response.error ??
                'Unable to mark conversation as read',
            )
          }
        },
      )
    }
  }

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
            const lastMessage =
              conversation.messages?.[0]

            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={
                    selectedConversationId ===
                    conversation.id
                      ? 'conversation-button active'
                      : 'conversation-button'
                  }
                  onClick={() =>
                    selectConversation(conversation)
                  }
                >
                  <span>
                    <strong>
                      {getConversationName(
                        conversation,
                        currentUserId,
                        friends,
                      )}
                    </strong>

                    {lastMessage && (
                      <small>
                        {lastMessage.content}
                      </small>
                    )}
                  </span>

                  {(
                    (conversation.unreadCount ?? 0) +
                    (conversation.reactionUnreadCount ??
                      0)
                  ) > 0 && (
                    <span
                      className="unread-count"
                      title={
                        `${
                          conversation.unreadCount ?? 0
                        } unread messages, ${
                          conversation
                            .reactionUnreadCount ?? 0
                        } unseen reactions`
                      }
                    >
                      {(conversation.unreadCount ?? 0) +
                        (conversation
                          .reactionUnreadCount ?? 0)}
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
