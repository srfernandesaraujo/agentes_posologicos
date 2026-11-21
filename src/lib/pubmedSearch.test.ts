import { describe, expect, it } from "vitest";
import { buildArticles, formatPubmedForPrompt, parsePubmedAbstracts, scrubUnknownPmids } from "../../supabase/functions/_shared/pubmedSearch";

const xml = `<PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID Version="1">111111</PMID><Article><Abstract>
<AbstractText Label="BACKGROUND">Adherence is low &amp; variable.</AbstractText>
<AbstractText Label="RESULTS">Adherence improved by <i>12%</i>.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">222222</PMID><Article><Abstract><AbstractText>Plain abstract.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">333333</PMID><Article></Article></MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;

const summary = {
  result: {
    "111111": { title: "Adherence in polypharmacy.", authors: [{ name: "Silva A" }, { name: "Souza B" }, { name: "Lima C" }, { name: "Costa D" }], fulljournalname: "J Clin Pharm", pubdate: "2023 Mar", pubtype: ["Meta-Analysis"], articleids: [{ idtype: "doi", value: "10.1/x" }] },
    "222222": { title: "Second &amp; study", authors: [], source: "Ann Pharm", pubdate: "2021", pubtype: [] },
  },
};

describe("parsePubmedAbstracts", () => {
  it("separa por PMID, mantém rótulos e limpa tags e entidades", () => {
    const m = parsePubmedAbstracts(xml);
    expect(m.get("111111")).toBe("BACKGROUND: Adherence is low & variable. RESULTS: Adherence improved by 12%.");
    expect(m.get("222222")).toBe("Plain abstract.");
    expect(m.has("333333")).toBe(false);
  });
  it("XML vazio não quebra", () => {
    expect(parsePubmedAbstracts("").size).toBe(0);
  });
});

describe("buildArticles e formatação", () => {
  const articles = buildArticles(["111111", "222222", "999999"], summary, parsePubmedAbstracts(xml));
  it("junta resumo e metadados e ignora PMID sem dados", () => {
    expect(articles.map((a) => a.pmid)).toEqual(["111111", "222222"]);
    expect(articles[0].authors).toBe("Silva A, Souza B, Lima C et al.");
    expect(articles[0].year).toBe("2023");
    expect(articles[0].doi).toBe("10.1/x");
    expect(articles[0].url).toBe("https://pubmed.ncbi.nlm.nih.gov/111111/");
    expect(articles[1].title).toBe("Second & study");
    expect(articles[1].abstract).toBe("Plain abstract.");
  });
  it("o bloco do agente traz só o que voltou e manda citar pelo PMID", () => {
    const t = formatPubmedForPrompt({ query: "adherence polypharmacy", articles, error: null });
    expect(t).toContain("PMID 111111");
    expect(t).toContain("Use SOMENTE estes artigos");
    expect(t).toContain("Meta-Analysis");
  });
  it("sem resultado ou com erro, manda dizer isso e não citar", () => {
    expect(formatPubmedForPrompt({ query: "x", articles: [], error: null })).toContain("nenhum artigo encontrado");
    expect(formatPubmedForPrompt({ query: "x", articles: [], error: "timeout" })).toContain("não respondeu");
  });
});

describe("scrubUnknownPmids", () => {
  it("mantém PMID da busca e troca os inventados", () => {
    const r = scrubUnknownPmids("Veja PMID 111111 e também PMID: 987654321 e PMID 55555.", ["111111"]);
    expect(r.text).toBe("Veja PMID 111111 e também [PMID não verificado] e [PMID não verificado].");
    expect(r.removed).toBe(2);
  });
  it("texto sem PMID fica igual", () => {
    expect(scrubUnknownPmids("Sem citações.", [])).toEqual({ text: "Sem citações.", removed: 0 });
  });
});
