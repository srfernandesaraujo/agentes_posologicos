

# Fix: Meeting Bot Stuck in "Transcribing" -- Split Processing Pipeline

## Root Cause

The logs show the `meeting-webhook` function is being **killed by Supabase before it finishes**. Every 8-10 seconds:
1. Function boots (~30ms)
2. Starts fetching transcript from Recall.ai
3. Gets shut down before the response arrives

The function tries to do too much in one invocation: fetch bot data + fetch transcript + call AI for summary. This exceeds the edge function wall time limit.

Meanwhile, `meeting-sync` keeps calling the webhook every 15s from the frontend poll, creating an infinite retry loop that never succeeds.

## Fix: Move Transcript Fetch Into meeting-sync

Instead of `meeting-sync` calling `meeting-webhook` (which then tries to do everything), `meeting-sync` will handle the transcript fetch and summary generation directly, in smaller steps:

**Step 1**: When `meeting-sync` detects a "done" bot, it fetches the transcript directly and saves it to the DB (status: "transcribing" -> save transcript -> status: "summarizing"). This is one sync cycle.

**Step 2**: On the next sync cycle, for meetings in "summarizing" status that have a transcript but no summary, `meeting-sync` calls `meeting-summary` (which already exists as a separate function).

This ensures no single function call needs more than one external API call.

### Architecture Change

```text
BEFORE (broken):
  meeting-sync -> meeting-webhook (fetch transcript + AI summary = TIMEOUT)

AFTER (fixed):
  meeting-sync cycle 1: detect done -> fetch transcript -> save to DB
  meeting-sync cycle 2: detect summarizing -> call meeting-summary -> done
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/meeting-sync/index.ts` | Add transcript fetching logic directly; handle "summarizing" meetings by calling meeting-summary; stop delegating to webhook |
| `supabase/functions/meeting-webhook/index.ts` | Simplify to only handle status updates (done/error) -- set status to "transcribing" without trying to fetch transcript |

## Implementation Details

### meeting-webhook (simplified)
- On "done" status: just update meeting to `status: "transcribing"`, return immediately
- On "error" status: update with error message (keep existing logic)
- Remove all transcript fetching and AI summary code from this function

### meeting-sync (enhanced)
- Query meetings in `["pending", "recording", "transcribing", "summarizing"]`
- For `pending`/`recording`: fetch bot status from Recall, update if done/error
- For `transcribing`: fetch transcript from Recall directly (reuse fetchTranscript logic), save to DB, set status to "summarizing"
- For `summarizing`: call `meeting-summary` function via internal service-role call
- Keep existing timeout protections (15min max wait)

### Key technical points
- Move `fetchRecallJson`, `extractTranscriptShortcut`, `fetchTranscriptPayload`, `fetchTranscript` helper functions into `meeting-sync`
- `meeting-summary` already exists and works -- just need to call it with service role auth pattern
- Each sync cycle does at most ONE external API call per meeting, staying within edge function limits

