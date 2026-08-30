import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncMeetingsForUser } from "../_shared/meetingSyncCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Triggered every 5 minutes by pg_cron (see migration 20260830120200_meeting_sync_cron.sql).
// Iterates every connected google_connections row so meetings progress even with no tab open.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authVal = req.headers.get("Authorization") || "";
    const authorized =
      (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      (!!anonKey && authVal === `Bearer ${anonKey}`);

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only bother with users who both have an active connection and at least one meeting still
    // in flight, to avoid needless Drive API calls for idle accounts.
    const { data: activeMeetings, error: meetingsError } = await supabaseAdmin
      .from("meetings")
      .select("user_id")
      .in("status", ["pending", "matched", "summarizing"]);
    if (meetingsError) throw meetingsError;

    const userIds = Array.from(new Set((activeMeetings || []).map((m: any) => m.user_id as string)));

    const results: any[] = [];
    for (const userId of userIds) {
      try {
        const { synced, total } = await syncMeetingsForUser(supabaseAdmin, userId);
        results.push({ user_id: userId, synced, total });
      } catch (e) {
        console.error("[meeting-sync-cron] user", userId, "failed:", e instanceof Error ? e.message : e);
        results.push({ user_id: userId, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meeting-sync-cron] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
