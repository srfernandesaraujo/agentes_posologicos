import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active research interests
    const { data: interests, error: intError } = await supabase
      .from("user_research_interests")
      .select("*")
      .eq("is_active", true);

    if (intError) throw intError;
    if (!interests || interests.length === 0) {
      return new Response(JSON.stringify({ message: "No active interests found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${interests.length} active research interests`);

    // Calculate date 7 days ago for PubMed filter
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const minDate = `${weekAgo.getFullYear()}/${String(weekAgo.getMonth() + 1).padStart(2, "0")}/${String(weekAgo.getDate()).padStart(2, "0")}`;
    const maxDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;

    let totalNotifications = 0;

    // Group interests by user to batch notifications
    const userInterests: Record<string, typeof interests> = {};
    for (const interest of interests) {
      if (!userInterests[interest.user_id]) userInterests[interest.user_id] = [];
      userInterests[interest.user_id].push(interest);
    }

    for (const [userId, userInts] of Object.entries(userInterests)) {
      const allNewArticles: { pmid: string; title: string; authors: string; interest: string; interestId: string }[] = [];

      for (const interest of userInts) {
        try {
          const query = encodeURIComponent(interest.terms);
          const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmode=json&retmax=5&sort=date&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}`;

          const esearchResp = await fetch(esearchUrl);
          const esearchData = await esearchResp.json();
          const pmids: string[] = esearchData?.esearchresult?.idlist || [];

          if (pmids.length === 0) continue;

          // Check which PMIDs are already notified
          const { data: existingLogs } = await supabase
            .from("pubmed_notifications_log")
            .select("pmid")
            .eq("user_id", userId)
            .in("pmid", pmids);

          const existingPmids = new Set((existingLogs || []).map((l: any) => l.pmid));
          const newPmids = pmids.filter((p) => !existingPmids.has(p));

          if (newPmids.length === 0) continue;

          // Fetch summaries for new articles
          const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${newPmids.join(",")}&retmode=json`;
          const esummaryResp = await fetch(esummaryUrl);
          const esummaryData = await esummaryResp.json();

          for (const pmid of newPmids) {
            const article = esummaryData?.result?.[pmid];
            if (!article) continue;

            const authors = (article.authors || []).map((a: any) => a.name).slice(0, 2).join(", ");
            const authorsStr = article.authors?.length > 2 ? `${authors} et al.` : authors;

            allNewArticles.push({
              pmid,
              title: article.title || "Sem título",
              authors: authorsStr,
              interest: interest.terms,
              interestId: interest.id,
            });

            // Log the PMID as notified
            await supabase.from("pubmed_notifications_log").insert({
              user_id: userId,
              pmid,
              interest_id: interest.id,
            });
          }

          // Rate limit: respect PubMed's 3 req/sec
          await new Promise((r) => setTimeout(r, 400));
        } catch (e) {
          console.error(`Error processing interest "${interest.terms}":`, e.message);
        }
      }

      // Create a single consolidated notification per user
      if (allNewArticles.length > 0) {
        const articleList = allNewArticles
          .slice(0, 10) // Max 10 articles per notification
          .map((a) => `• ${a.title.substring(0, 80)}... (${a.authors}) — Interesse: "${a.interest}"`)
          .join("\n");

        const message = `📚 ${allNewArticles.length} novo(s) artigo(s) encontrado(s) no PubMed esta semana:\n\n${articleList}\n\nAcesse o agente Especialista PubMed para ler mais.`;

        await supabase.from("notifications").insert({
          user_id: userId,
          title: `🔬 ${allNewArticles.length} novos artigos PubMed`,
          message,
          type: "pubmed",
          link: "/agentes",
        });

        totalNotifications++;
        console.log(`Notified user ${userId}: ${allNewArticles.length} new articles`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${interests.length} interests, sent ${totalNotifications} notifications`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PubMed monitor error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
