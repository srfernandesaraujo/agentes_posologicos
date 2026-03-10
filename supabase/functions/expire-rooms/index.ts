import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Deactivate rooms past their expiration date
    const { data: expiredByDate, error: err1 } = await supabase
      .from("virtual_rooms")
      .update({ is_active: false })
      .eq("is_active", true)
      .not("room_expires_at", "is", null)
      .lt("room_expires_at", now)
      .select("id");

    if (err1) console.error("Error expiring rooms by date:", err1);

    // 2. Deactivate rooms with no activity for 7 days
    // Get all active rooms
    const { data: activeRooms, error: err2 } = await supabase
      .from("virtual_rooms")
      .select("id, updated_at")
      .eq("is_active", true);

    if (err2) {
      console.error("Error fetching active rooms:", err2);
    } else if (activeRooms && activeRooms.length > 0) {
      const roomIds = activeRooms.map((r: any) => r.id);

      // Get latest message per room
      const { data: latestMessages, error: err3 } = await supabase
        .from("room_messages")
        .select("room_id, created_at")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false });

      if (err3) console.error("Error fetching room messages:", err3);

      // Build map of latest activity per room
      const latestActivityMap: Record<string, string> = {};
      if (latestMessages) {
        for (const msg of latestMessages) {
          if (!latestActivityMap[msg.room_id] || msg.created_at > latestActivityMap[msg.room_id]) {
            latestActivityMap[msg.room_id] = msg.created_at;
          }
        }
      }

      // Find rooms inactive for 7+ days
      const inactiveRoomIds: string[] = [];
      for (const room of activeRooms) {
        const lastActivity = latestActivityMap[room.id] || room.updated_at;
        if (lastActivity < oneWeekAgo) {
          inactiveRoomIds.push(room.id);
        }
      }

      if (inactiveRoomIds.length > 0) {
        const { error: err4 } = await supabase
          .from("virtual_rooms")
          .update({ is_active: false })
          .in("id", inactiveRoomIds);

        if (err4) console.error("Error deactivating inactive rooms:", err4);
      }

      console.log(`Deactivated ${inactiveRoomIds.length} rooms due to inactivity`);
    }

    const expiredCount = expiredByDate?.length || 0;
    console.log(`Expired ${expiredCount} rooms by date`);

    return new Response(
      JSON.stringify({ expired_by_date: expiredCount, message: "Room expiration check complete" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in expire-rooms:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
