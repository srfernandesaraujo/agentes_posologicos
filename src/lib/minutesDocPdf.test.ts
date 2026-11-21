import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMinutesPdf, minutesFileName, pdfSafe, type MinutesDoc } from "./minutesDocPdf";

const long = (s: string, n: number) => Array.from({ length: n }, () => s).join(" ");

export const sample: MinutesDoc = {
  title: "Escolha do tema do próximo livro",
  date: "21 de novembro de 2026", start: "05:19", end: "06:02",
  modality: "Reunião virtual com agentes de IA (Escritório de Agentes)",
  purpose: "Definir o tema do próximo livro do squad, avaliando o desempenho de vendas dos últimos 12 meses e os candidatos a tema, e registrar os encaminhamentos.",
  executiveSummary: "O grupo analisou as vendas dos últimos 12 meses e concluiu que os títulos de anticoagulação vendem 2,3 vezes a média. Foi sugerido um recorte por paciente idoso polimedicado para reduzir a saturação. A decisão final do tema ficou com o anfitrião, que a tomará até sexta-feira.",
  nature: "Reunião de planejamento editorial",
  convocation: "Convocada pelo anfitrião na plataforma",
  coordination: "Helena (Diretora editorial)",
  secretary: "Ata elaborada com apoio de inteligência artificial",
  participants: [{ name: "Anfitrião", role: "Dono do squad" }, { name: "Helena", role: "Diretora editorial" }, { name: "Lia", role: "Editora de estrutura" }, { name: "Íris", role: "Nicho e lançamento" }],
  agenda: ["Vendas dos últimos 12 meses", "Candidatos a tema", "Decisão e próximos passos"],
  discussions: [
    { title: "Vendas dos últimos 12 meses", body: `A Íris apresentou a leitura das vendas: nove títulos, com os de anticoagulação em 2,3 vezes a média e queda de 18% entre janeiro e março. ${long("A projeção linear indicou estabilidade, com ressalva de amostra pequena.", 6)}\n\nO anfitrião pediu que a análise fosse repetida com o recorte por canal de venda, o que ficou como encaminhamento.` },
    { title: "Candidatos a tema", body: `${long("A Lia propôs fechar o recorte em paciente idoso polimedicado em vez de um tema amplo, e se ofereceu para esboçar três estruturas de livro.", 5)}\n\nA Helena observou o risco de saturação do mercado de farmácia clínica, apontado pelo anfitrião.` },
    { title: "Decisão e próximos passos", body: "O grupo não chegou a uma decisão final. O anfitrião informou que escolherá o recorte até sexta-feira, após ver as três estruturas." },
  ],
  deliberations: ["Esboçar três estruturas de livro com o recorte de paciente idoso polimedicado.", "Repetir a análise de vendas por canal.", "O anfitrião decide o tema até sexta-feira."],
  actionPlan: [
    { action: "Esboçar três estruturas de livro", owner: "Lia", deadline: "Antes da decisão", product: "Três esboços de estrutura" },
    { action: "Análise de vendas por canal", owner: "Íris", deadline: "A definir", product: "Planilha comentada" },
  ],
  references: [{ pmid: "32383493", title: "Interventions for improving medication-taking ability and adherence in older adults prescribed multiple medications.", journal: "Cochrane Database Syst Rev", year: "2020" }],
  pending: [{ item: "Dados de vendas", validation: "Confirmar os números com o relatório oficial da editora." }, { item: "Prazo da decisão", validation: "Confirmar a data exata de sexta-feira." }],
  nextMeeting: "Não definida na reunião.",
  closing: "Nada mais havendo a registrar, a reunião foi encerrada. A presente ata foi elaborada a partir do registro da conversa. Após conferência e aprovação dos participantes, seguirá para assinatura e arquivamento.",
  validationNote: "Os campos não confirmados na conversa foram mantidos como pendentes. Esta ata foi elaborada com apoio de inteligência artificial a partir do registro da reunião: as falas dos agentes são sugestões, não decisões.",
};

describe("PDF da ata", () => {
  it("gera um PDF com capa e corpo, em várias páginas quando o texto é longo", () => {
    const pdf = buildMinutesPdf(sample);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const out = process.env.MINUTES_PDF_OUT;
    if (out) writeFileSync(out, Buffer.from(pdf.output("arraybuffer")));
    const big = buildMinutesPdf({ ...sample, discussions: Array.from({ length: 10 }, (_, i) => ({ title: `Tema ${i + 1}`, body: long("Texto longo de discussão que ocupa bastante espaço na página.", 60) })) });
    expect(big.getNumberOfPages()).toBeGreaterThan(pdf.getNumberOfPages());
  });
  it("aguenta documento mínimo (ata de contingência)", () => {
    const pdf = buildMinutesPdf({ ...sample, deliberations: [], actionPlan: [], references: [], pending: [] });
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
  it("troca caracteres que a fonte do PDF não tem", () => {
    expect(pdfSafe("Ação → resultado ≥ 3 ✅ **ok**")).toBe("Ação -> resultado >= 3  ok");
    expect(pdfSafe("“aspas” – travessão • item…")).toBe("“aspas” – travessão • item…");
  });
  it("nome de arquivo sem acento nem caracteres proibidos", () => {
    expect(minutesFileName(sample)).toBe("Ata - Escolha do tema do proximo livro 21-de-novembro-de-2026.pdf");
    expect(minutesFileName({ title: "A/B: \"teste\"?", date: "" })).toBe("Ata - A B teste.pdf");
  });
});
