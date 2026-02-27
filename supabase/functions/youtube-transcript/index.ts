import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n/g, " ");
}

function parseTranscriptXml(xml: string): string {
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  const segments: string[] = [];
  let match;
  while ((match = textRegex.exec(xml)) !== null) {
    const raw = match[1].replace(/<[^>]+>/g, "");
    const decoded = decodeHtmlEntities(raw).trim();
    if (decoded) segments.push(decoded);
  }
  return segments.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source_id, url } = await req.json();
    if (!source_id || !url) {
      return new Response(
        JSON.stringify({ error: "source_id and url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Invalid YouTube URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update status to processing
    await supabaseAdmin
      .from("knowledge_sources")
      .update({ status: "processing" })
      .eq("id", source_id);

    console.log(`Extracting transcript for video: ${videoId}`);

    // Fetch the YouTube page to get caption data
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch YouTube page: ${pageRes.status}`);
    }

    const pageHtml = await pageRes.text();

    // Extract ytInitialPlayerResponse
    const playerMatch = pageHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (!playerMatch) {
      // Try alternative pattern
      const altMatch = pageHtml.match(/"captions":\s*({.+?}),\s*"videoDetails"/s);
      if (!altMatch) {
        await supabaseAdmin
          .from("knowledge_sources")
          .update({
            content: "⚠️ Não foi possível encontrar legendas para este vídeo. O vídeo pode não ter legendas automáticas disponíveis.",
            status: "error",
          })
          .eq("id", source_id);

        return new Response(
          JSON.stringify({ success: false, message: "No captions found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let captionsData: any = null;
    try {
      if (playerMatch) {
        const playerResponse = JSON.parse(playerMatch[1]);
        captionsData = playerResponse?.captions?.playerCaptionsTracklistRenderer;
      }
    } catch (e) {
      console.error("Failed to parse player response:", e);
    }

    if (!captionsData?.captionTracks?.length) {
      await supabaseAdmin
        .from("knowledge_sources")
        .update({
          content: "⚠️ Este vídeo não possui legendas (automáticas ou manuais) disponíveis.",
          status: "error",
        })
        .eq("id", source_id);

      return new Response(
        JSON.stringify({ success: false, message: "No caption tracks available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find best caption track: prefer pt, then en, then first available
    const tracks = captionsData.captionTracks;
    let selectedTrack =
      tracks.find((t: any) => t.languageCode === "pt") ||
      tracks.find((t: any) => t.languageCode?.startsWith("pt")) ||
      tracks.find((t: any) => t.languageCode === "en") ||
      tracks.find((t: any) => t.languageCode?.startsWith("en")) ||
      tracks[0];

    console.log(`Selected caption track: ${selectedTrack.languageCode} (${selectedTrack.kind || "manual"})`);

    // Fetch the transcript XML
    const captionUrl = selectedTrack.baseUrl;
    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      throw new Error(`Failed to fetch captions: ${captionRes.status}`);
    }

    const captionXml = await captionRes.text();
    let transcript = parseTranscriptXml(captionXml);

    if (!transcript || transcript.length < 10) {
      await supabaseAdmin
        .from("knowledge_sources")
        .update({
          content: "⚠️ A transcrição extraída estava vazia ou muito curta.",
          status: "error",
        })
        .eq("id", source_id);

      return new Response(
        JSON.stringify({ success: false, message: "Empty transcript" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate to 50k chars
    if (transcript.length > 50000) {
      transcript = transcript.substring(0, 50000) + "\n\n[Transcrição truncada em 50.000 caracteres]";
    }

    const langLabel = selectedTrack.name?.simpleText || selectedTrack.languageCode || "desconhecido";
    const header = `📝 Transcrição automática do YouTube (idioma: ${langLabel})\nVídeo: https://youtube.com/watch?v=${videoId}\n\n---\n\n`;

    await supabaseAdmin
      .from("knowledge_sources")
      .update({
        content: header + transcript,
        status: "ready",
      })
      .eq("id", source_id);

    console.log(`Transcript saved: ${transcript.length} chars`);

    return new Response(
      JSON.stringify({ success: true, length: transcript.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error extracting transcript:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
