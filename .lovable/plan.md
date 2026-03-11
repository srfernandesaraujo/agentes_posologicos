

## Diagnosis

The agent works in the platform (logged-in user) but not in virtual rooms (anonymous participant). Here's why:

**Root Cause**: When an anonymous user sends a message in a virtual room, the Edge Function `agent-chat` cannot identify any `userId`. At line 6068, it checks `if (userId)` to look up the user's API keys -- this is `null` for anonymous participants, so it skips user API keys entirely. It then falls back to the Lovable AI Gateway, which appears to be failing silently (edge function logs show TMDB search completing but no AI response logged).

When you test from the platform (logged in), your `userId` is available, your Google API key is found, and the agent works perfectly.

**Evidence**:
- Edge function logs show your virtual room attempts at 07:43-07:47: TMDB searches succeed, but NO "AI usage logged" entries -- the AI call never completes
- My curl test at 07:48 succeeded because the tool sends auth that resolves to a real userId, finding your Google API key
- The log "Native agent: using user's google key" only appears for the curl test, never for virtual room attempts

## Fix Plan

### 1. Edge Function: Use room owner's API keys for virtual rooms

In the `agent-chat` Edge Function, after validating the room (around line 5268-5282), extract the room owner's `user_id` from `roomData` and store it as a fallback for API key lookup:

- The room validation query already fetches `roomData` including the room's `user_id` (the owner)
- Store this as `roomOwnerId` 
- When looking up API keys for native agents (line 6067-6146), if `userId` is null but `roomOwnerId` exists, use `roomOwnerId` to fetch the room owner's API keys
- This way anonymous participants can use the room owner's configured API key

### 2. Fallback chain

The modified logic at the native agent API key lookup section:

```text
1. If userId exists → use user's own API keys (current behavior)
2. If userId is null AND roomOwnerId exists → use room owner's API keys  
3. If neither has keys → fall back to Lovable AI Gateway
```

This is consistent with the existing pattern documented in memory: "the Edge Function uses service_role_key to fetch configurations and API keys of the original agent creator."

### Technical Details

**File**: `supabase/functions/agent-chat/index.ts`

Changes:
1. Around line 5270-5282: Save `roomData.user_id` as `roomOwnerId` (the room already returns this field, it's selected but not used)
2. Need to add `user_id` to the select query: change `.select("id, agent_id, is_active")` to `.select("id, agent_id, is_active, user_id")`
3. Around line 6067-6146: Modify the API key lookup to use `roomOwnerId` when `userId` is null
4. Same pattern needed for the custom agent section (around line 6200+) where it looks up the agent creator's keys

