---
name: User Memory
description: Per-user professional context and auto-extracted facts injected silently as <USER_CONTEXT> into every agent prompt
type: feature
---

Tables:
- `user_profile_context` (1 row/user): area_atuacao, public_target, tone_preference, institution, research_lines, restrictions, memory_enabled, auto_extract_enabled.
- `user_memory_facts`: fact, source_session_id, confidence, active.

Edge function `extract-user-facts` runs fire-and-forget after each user message in `Chat.tsx`. Uses `google/gemini-2.5-flash` via Lovable AI Gateway with `save_user_facts` tool-call (max 5 facts, 6-200 chars, deduped). Respects opt-out flags.

Injection: `buildUserContextBlock(client, userId)` in `supabase/functions/agent-chat/index.ts` builds a `<USER_CONTEXT>` block (profile + up to 30 active facts) and appends to both native `systemPrompt` and custom `finalSystemPrompt`. Instruction explicitly tells the model NOT to repeat the context back to the user.

UI: `src/components/account/UserMemoryPanel.tsx` mounted at `/conta` — edit profile, toggle/delete facts, master switches for memory/auto-extract.