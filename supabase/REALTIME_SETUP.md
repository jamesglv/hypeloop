# Supabase Realtime Setup Guide

## Overview

Realtime subscriptions are enabled for the following tables:
- `messages` - For live chat updates
- `subscriptions` - For live subscription status updates
- `creator_profiles` - For live profile updates

## Usage in Frontend

### TypeScript/React Example

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@hype-loop/shared'

function useRealtimeMessages(creatorId: string) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `creator_id=eq.${creatorId}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `creator_id=eq.${creatorId}`
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
          )
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [creatorId])

  return messages
}

// Usage in component
function MessagesList({ creatorId }: { creatorId: string }) {
  const messages = useRealtimeMessages(creatorId)
  
  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Subscription Updates

```typescript
function useRealtimeSubscriptions(creatorId: string) {
  const [subscriptions, setSubscriptions] = useState([])

  useEffect(() => {
    const channel = supabase
      .channel(`subscriptions:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // All events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'subscriptions',
          filter: `creator_id=eq.${creatorId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubscriptions((prev) => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setSubscriptions((prev) =>
              prev.map((sub) => 
                sub.id === payload.new.id ? payload.new : sub
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setSubscriptions((prev) =>
              prev.filter((sub) => sub.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [creatorId])

  return subscriptions
}
```

### Profile Updates

```typescript
function useRealtimeProfile(creatorId: string) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const channel = supabase
      .channel(`profile:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'creator_profiles',
          filter: `id=eq.${creatorId}`
        },
        (payload) => {
          setProfile(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [creatorId])

  return profile
}
```

## Channel Naming Conventions

- Messages: `messages:${creatorId}` or `messages:${subscriptionId}`
- Subscriptions: `subscriptions:${creatorId}` or `subscriptions:${fanId}`
- Profiles: `profile:${creatorId}`

## Best Practices

1. **Cleanup subscriptions**: Always remove channels when components unmount
2. **Filter efficiently**: Use specific filters to reduce unnecessary updates
3. **Handle errors**: Add error handlers to channel subscriptions
4. **Limit subscriptions**: Don't create too many concurrent subscriptions
5. **Use React hooks**: Create reusable hooks for common Realtime patterns

## Error Handling

```typescript
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {...}, (payload) => {
    // Handle update
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to messages')
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Channel error')
    } else if (status === 'TIMED_OUT') {
      console.error('Connection timed out')
    } else if (status === 'CLOSED') {
      console.log('Channel closed')
    }
  })
```

