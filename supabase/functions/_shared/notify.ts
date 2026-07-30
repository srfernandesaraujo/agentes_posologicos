import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const FROM_EMAIL = "LearnLead <noreply@agentes-ai.posologia.app>";

// Sends a transactional e-mail to an existing app user by id, looking up their address via
// the admin auth API — same pattern already used in generate-briefing/index.ts and
// invite-user/index.ts. Returns false (never throws) if the user has no e-mail or sending
// fails, so callers can treat this as a best-effort side channel alongside the in-app
// notifications table.
export async function sendUserEmail(
  admin: SupabaseClient,
  userId: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return false;
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    if (!user?.email) return false;
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [user.email],
      subject,
      html,
    });
    return !error;
  } catch (e) {
    console.warn("sendUserEmail failed:", (e as Error).message);
    return false;
  }
}
