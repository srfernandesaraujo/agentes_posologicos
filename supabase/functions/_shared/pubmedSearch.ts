// Busca no PubMed (E-utilities do NCBI) para a Reunião Viva. A busca é feita por código: o agente só recebe e comenta o que voltou,
// e a lista de fontes que aparece na tela vem daqui, nunca do texto do modelo. Partes puras (parse, formatação, conferência de PMID)
// ficam testadas em src/lib/pubmedSearch.test.ts.

export interface PubmedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  pubTypes: string[];
  doi: string;
  abstract: string;
  url: string;
}

export interface PubmedResult {
  query: string;
  articles: PubmedArticle[];
  /** Nulo quando a busca funcionou (mesmo sem resultados); texto do problema quando o PubMed não respondeu. */
  error: string | null;
}

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
export const PUBMED_RETMAX = 5;
export const PUBMED_ABSTRACT_CHARS = 1600;
const FETCH_TIMEOUT_MS = 9000;

function decodeXml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Resumos por PMID a partir do XML do efetch (um bloco <PubmedArticle> por artigo; resumos estruturados ganham o rótulo de cada parte). */
export function parsePubmedAbstracts(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const blocks = xml.split(/<PubmedArticle[\s>]/).slice(1);
  for (const b of blocks) {
    const pmid = b.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const parts: string[] = [];
    const re = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b)) !== null) {
      const label = m[1].match(/Label="([^"]+)"/)?.[1];
      const text = decodeXml(m[2]);
      if (text) parts.push(label ? `${label}: ${text}` : text);
    }
    if (parts.length) out.set(pmid, parts.join(" ").slice(0, PUBMED_ABSTRACT_CHARS));
  }
  return out;
}

/** Junta o resumo (esummary, JSON) com o texto do resumo (efetch, XML). */
export function buildArticles(pmids: string[], summary: any, abstracts: Map<string, string>): PubmedArticle[] {
  const out: PubmedArticle[] = [];
  for (const pmid of pmids) {
    const a = summary?.result?.[pmid];
    if (!a) continue;
    const names = (a.authors || []).map((x: any) => x.name).filter(Boolean);
    const authors = names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", ");
    const doi = (a.articleids || []).find((x: any) => x.idtype === "doi")?.value || "";
    out.push({
      pmid,
      title: decodeXml(String(a.title || "Sem título")),
      authors,
      journal: String(a.fulljournalname || a.source || ""),
      year: String(a.pubdate || "").slice(0, 4),
      pubTypes: Array.isArray(a.pubtype) ? a.pubtype.map(String) : [],
      doi,
      abstract: abstracts.get(pmid) || "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }
  return out;
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`PubMed respondeu ${r.status}`);
  return await r.json();
}

/** Busca os artigos mais relevantes. Nunca lança: se o PubMed falhar, devolve o erro para o agente dizer isso com clareza. */
export async function searchPubmed(query: string, retmax = PUBMED_RETMAX): Promise<PubmedResult> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!q) return { query: q, articles: [], error: "Busca vazia" };
  try {
    const es = await getJson(`${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmode=json&retmax=${retmax}&sort=relevance`);
    const pmids: string[] = (es?.esearchresult?.idlist || []).map(String);
    if (!pmids.length) return { query: q, articles: [], error: null };
    const ids = pmids.join(",");
    const summary = await getJson(`${EUTILS}/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`);
    let abstracts = new Map<string, string>();
    try {
      const r = await fetch(`${EUTILS}/efetch.fcgi?db=pubmed&id=${ids}&rettype=abstract&retmode=xml`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (r.ok) abstracts = parsePubmedAbstracts(await r.text());
    } catch { /* sem resumo, o agente trabalha só com o título e os dados do artigo */ }
    return { query: q, articles: buildArticles(pmids, summary, abstracts), error: null };
  } catch (e) {
    return { query: q, articles: [], error: (e as Error).message || "Falha ao consultar o PubMed" };
  }
}

/** Bloco que o agente recebe: só o que a busca devolveu, com instruções de citação. */
export function formatPubmedForPrompt(r: PubmedResult): string {
  if (r.error) {
    return `Resultado da busca no PubMed para "${r.query}": o PubMed não respondeu (${r.error}). Diga isso com clareza ao dono e não cite nenhum artigo.`;
  }
  if (!r.articles.length) {
    return `Resultado da busca no PubMed para "${r.query}": nenhum artigo encontrado. Diga isso e sugira termos de busca mais específicos, em inglês. Não cite nenhum artigo.`;
  }
  const list = r.articles.map((a, i) =>
    `${i + 1}. PMID ${a.pmid} | ${a.title} | ${a.authors} | ${a.journal}, ${a.year} | Tipo: ${a.pubTypes.join(", ") || "não informado"}\n   Resumo: ${a.abstract || "(sem resumo disponível)"}`).join("\n");
  return `Resultado da busca no PubMed para "${r.query}" (${r.articles.length} artigos). Use SOMENTE estes artigos, cite sempre pelo PMID, diga o que o resumo mostra e os limites (tipo de estudo, amostra) e não invente dados que não estão no resumo:\n${list}`;
}

/** Remove PMIDs que o modelo citou mas que não vieram da busca (citação inventada). */
export function scrubUnknownPmids(text: string, allowed: string[]): { text: string; removed: number } {
  let removed = 0;
  const ok = new Set(allowed);
  const out = text.replace(/\bPMID[:\s]*(\d{4,9})\b/gi, (full, id) => {
    if (ok.has(id)) return full;
    removed++;
    return "[PMID não verificado]";
  });
  return { text: out, removed };
}
