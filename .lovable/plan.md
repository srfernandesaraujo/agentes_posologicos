

# Fix: Meeting Webhook Missing Function Definitions

## Root Cause

The `meeting-webhook` Edge Function crashes with **`ReferenceError: isDoneStatus is not defined`** every time Recall.ai sends the "done" webhook. The logs show this error repeating dozens of times — the bot finished recording, Recall.ai sent the completion webhook, but the function crashes before it can fetch the transcript and generate the meeting minutes.

Three functions are used but never defined in `meeting-webhook/index.ts`:
- `isDoneStatus()` (line 260)
- `isErrorStatus()` (line 412)
- `hasTranscriptNotReadyMessage()` (lines 138, 192)

## Fix

Add the three missing function definitions to `supabase/functions/meeting-webhook/index.ts`, matching the logic from `meeting-sync`:

```typescript
const isDoneStatus = (status: string): boolean => {
  if (!status) return false;
  return (
    DONE_STATUSES.has(status) ||
    status.includes("call_ended") ||
    status.endsWith("_done") ||
    status === "left_call" ||
    status.includes("completed")
  );
};

const isErrorStatus = (status: string): boolean => {
  if (!status) return false;
  return (
    ERROR_STATUSES.has(status) ||
    status.includes("fatal") ||
    status.includes("error") ||
    status.includes("failed")
  );
};

const hasTranscriptNotReadyMessage = (text: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes("not ready") || lower.includes("pending") || lower.includes("processing");
};
```

These will be inserted after the existing constant definitions (after line 27) and before the `normalizeStatus` function.

After deploying, the existing stuck meeting (bot_id `aa8d5e5f-...`) should be processed on the next sync cycle (every 15 seconds) and the transcript + AI-generated minutes will be produced.

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/meeting-webhook/index.ts` | Add 3 missing function definitions, redeploy |

