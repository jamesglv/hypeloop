# Supabase Edge Functions Setup Guide

## Overview

Edge Functions are serverless functions that run on Supabase's edge network. They handle:
- AI prompt generation and responses
- Chat memory management
- Subscription management

## Functions

### 1. generate-ai-response

Generates AI responses based on creator profile and training data.

**Endpoint**: `https://<project-ref>.supabase.co/functions/v1/generate-ai-response`

**Method**: POST

**Request Body**:
```json
{
  "fan_id": "uuid",
  "creator_id": "uuid",
  "message": "user message text",
  "subscription_id": "uuid (optional)",
  "conversation_history": [
    {
      "role": "fan",
      "content": "previous message"
    }
  ]
}
```

**Response**:
```json
{
  "response": "AI generated response",
  "message_id": "uuid",
  "status": "sent" | "pending_approval",
  "requires_approval": false
}
```

**Usage Example**:
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/generate-ai-response`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      fan_id: fanId,
      creator_id: creatorId,
      message: userMessage,
      conversation_history: history
    })
  }
)

const data = await response.json()
```

### 2. store-chat-memory

Retrieves conversation history for chat memory.

**Endpoint**: `https://<project-ref>.supabase.co/functions/v1/store-chat-memory`

**Method**: POST

**Request Body**:
```json
{
  "subscription_id": "uuid (optional)",
  "fan_id": "uuid (optional)",
  "creator_id": "uuid (optional)",
  "limit": 50
}
```

**Response**:
```json
{
  "conversation_history": [
    {
      "role": "fan" | "ai",
      "content": "message text",
      "created_at": "timestamp",
      "id": "uuid"
    }
  ],
  "count": 50
}
```

### 3. manage-subscription

Manages subscription lifecycle (create, cancel, update).

**Endpoint**: `https://<project-ref>.supabase.co/functions/v1/manage-subscription`

**Method**: POST

**Request Body (create)**:
```json
{
  "action": "create",
  "fan_id": "uuid",
  "creator_id": "uuid",
  "tier": "basic" | "premium",
  "price_per_month": 9.99
}
```

**Request Body (cancel)**:
```json
{
  "action": "cancel",
  "subscription_id": "uuid"
}
```

**Request Body (update)**:
```json
{
  "action": "update",
  "subscription_id": "uuid",
  "tier": "premium",
  "price_per_month": 19.99
}
```

## Environment Variables

Set these in Supabase Dashboard → Edge Functions → Secrets:

- `OPENAI_API_KEY` - Your OpenAI API key for AI responses
- `SUPABASE_URL` - Automatically available
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically available

## Deployment

Deploy functions using Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Deploy a function
supabase functions deploy generate-ai-response
supabase functions deploy store-chat-memory
supabase functions deploy manage-subscription

# Deploy all functions
supabase functions deploy
```

## Local Development

```bash
# Start local Supabase (includes Edge Functions)
supabase start

# Serve functions locally
supabase functions serve generate-ai-response --env-file .env.local
```

## Testing

Test functions locally:

```bash
curl -X POST http://localhost:54321/functions/v1/generate-ai-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "fan_id": "uuid",
    "creator_id": "uuid",
    "message": "Hello!"
  }'
```

## Error Handling

All functions return consistent error responses:

```json
{
  "error": "Error message",
  "details": {} // Optional additional details
}
```

HTTP Status Codes:
- 200: Success
- 400: Bad Request (missing/invalid parameters)
- 403: Forbidden (e.g., no active subscription)
- 404: Not Found (e.g., creator not found)
- 500: Internal Server Error

## Security

- Functions use service role key for database access
- RLS policies still apply but are bypassed with service role
- Validate all inputs
- Rate limiting should be configured at the Supabase project level
- Never expose service role key in frontend code

