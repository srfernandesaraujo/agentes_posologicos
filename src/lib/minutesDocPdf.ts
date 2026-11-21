import jsPDF from "jspdf";

// PDF da ata institucional da Reunião Viva. Recebe o documento estruturado que a função `squad-meeting` grava na mensagem da ata
// (meta.minutes_doc) e desenha: capa com dados da reunião, síntese, identificação, pauta, discussões e consensos, deliberações,
// plano de ação, referências, pendências, próxima reunião e encerramento com campos de assinatura.
export interface MinutesDoc {
  title: string;
  date: string;
  start: string;
  end: string;
  modality: string;
  purpose: string;
  executiveSummary: string;
  nature: string;
  convocation: string;
  coordination: string;
  secretary: string;
  participants: { name: string; role: string }[];
  agenda: string[];
  discussions: { title: string; body: string }[];
  deliberations: string[];
  actionPlan: { action: string; owner: string; deadline: string; product: string }[];
  references: { pmid: string; title: string; journal: string; year: string }[];
  pending: { item: string; validation: string }[];
  nextMeeting: string;
  closing: string;
  validationNote: string;
}

type RGB = [number, number, number];
const NAVY: RGB = [19, 42, 68];
const BLUE: RGB = [31, 90, 130];
const TEAL: RGB = [46, 134, 142];
const GOLD: RGB = [200, 160, 70];
const TEXT: RGB = [35, 45, 60];
const MUTED: RGB = [105, 120, 135];
const LINE: RGB = [214, 222, 228];
const ZEBRA: RGB = [239, 247, 247];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 24; // abaixo da faixa do cabeçalho corrente
const BOTTOM = PAGE_H - 20;
const BODY_PT = 10;
const LINE_H = 5.1;

/** As fontes padrão do PDF cobrem o alfabeto latino e a pontuação comum; o resto é trocado para não sair como lixo. */
export function pdfSafe(s: string): string {
  return String(s ?? "")
    .replace(/→/g, "->").replace(/←/g, "<-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≈/g, "~").replace(/×/g, "x")
    .replace(/[→←↔]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/[^\x09\x0A\x20-\x7E -ÿ–—‘’“”•…]/g, "");
}

export function minutesFileName(doc: Pick<MinutesDoc, "title" | "date">): string {
  const base = `Ata - ${doc.title}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const day = (doc.date || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w ]+/g, " ").replace(/\s+/g, "-").trim();
  return `${base}${day ? ` ${day}` : ""}.pdf`.replace(/\s+/g, " ");
}

export function buildMinutesPdf(data: MinutesDoc): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let y = MARGIN;
  let onCover = true;

  const color = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
  const font = (face: "helvetica" | "times", style: "normal" | "bold" | "italic", size: number, c: RGB = TEXT) => {
    pdf.setFont(face, style); pdf.setFontSize(size); color(c);
  };
  const wrap = (text: string, width: number): string[] => pdf.splitTextToSize(pdfSafe(text), width);

  const runningHeader = () => {
    fill(NAVY); pdf.rect(0, 0, PAGE_W, 13, "F");
    fill(GOLD); pdf.rect(MARGIN, 14.2, CONTENT_W, 0.5, "F");
    font("helvetica", "bold", 8, [255, 255, 255]);
    const t = pdfSafe(`ATA DE REUNIÃO  |  ${data.title}`).toUpperCase();
    pdf.text(pdf.splitTextToSize(t, CONTENT_W)[0], MARGIN, 8.2);
  };
  const newPage = () => {
    pdf.addPage();
    onCover = false;
    runningHeader();
    y = TOP;
  };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };

  // ---------- blocos de texto ----------
  const sectionTitle = (text: string) => {
    ensure(18);
    y += 4;
    font("times", "bold", 17, NAVY);
    const lines = wrap(text, CONTENT_W);
    pdf.text(lines, MARGIN, y + 5);
    y += lines.length * 7.2 + 3;
  };
  const subTitle = (text: string) => {
    ensure(14);
    y += 1.5;
    font("helvetica", "bold", 11, BLUE);
    const lines = wrap(text, CONTENT_W);
    pdf.text(lines, MARGIN, y + 4);
    y += lines.length * 5.4 + 2.2;
  };
  const paragraph = (text: string, opts: { size?: number; c?: RGB; style?: "normal" | "italic"; gap?: number } = {}) => {
    font("helvetica", opts.style ?? "normal", opts.size ?? BODY_PT, opts.c ?? TEXT);
    const lh = (opts.size ?? BODY_PT) * 0.5;
    for (const para of pdfSafe(text).split(/\n{1,}/).filter((p) => p.trim())) {
      const lines: string[] = pdf.splitTextToSize(para.trim(), CONTENT_W);
      let i = 0;
      while (i < lines.length) {
        const room = Math.max(1, Math.floor((BOTTOM - y) / lh));
        const chunk = lines.slice(i, i + room);
        if (chunk.length < Math.min(2, lines.length - i) && y > TOP + 20) { newPage(); continue; } // evita linha solta no pé da página
        pdf.text(chunk, MARGIN, y + lh * 0.8);
        y += chunk.length * lh;
        i += chunk.length;
        if (i < lines.length) { newPage(); font("helvetica", opts.style ?? "normal", opts.size ?? BODY_PT, opts.c ?? TEXT); }
      }
      y += opts.gap ?? 1.8;
    }
  };
  const bullets = (items: string[]) => {
    font("helvetica", "normal", BODY_PT);
    for (const it of items) {
      const lines = wrap(it, CONTENT_W - 6);
      ensure(lines.length * LINE_H + 1.5);
      font("helvetica", "normal", BODY_PT);
      pdf.text("•", MARGIN + 1.5, y + 4);
      pdf.text(lines, MARGIN + 6, y + 4);
      y += lines.length * LINE_H + 1.6;
    }
    y += 1.5;
  };
  const numbered = (items: string[]) => {
    for (let i = 0; i < items.length; i++) {
      font("helvetica", "normal", BODY_PT);
      const lines = wrap(items[i], CONTENT_W - 9);
      ensure(lines.length * LINE_H + 2);
      font("helvetica", "bold", BODY_PT, BLUE);
      pdf.text(String(i + 1).padStart(2, "0"), MARGIN, y + 4);
      font("helvetica", "normal", BODY_PT);
      pdf.text(lines, MARGIN + 9, y + 4);
      y += lines.length * LINE_H + 2.4;
    }
    y += 1.5;
  };

  // ---------- tabela ----------
  const table = (cols: { label: string; w: number }[], rows: string[][], opts: { boldFirst?: boolean } = {}) => {
    const PAD = 2.2;
    const SM = 8.6;
    const lh = SM * 0.48;
    const total = cols.reduce((s, c) => s + c.w, 0);
    const widths = cols.map((c) => (c.w / total) * (CONTENT_W - 1));
    const drawHeader = () => {
      ensure(10);
      fill(NAVY); pdf.rect(MARGIN, y, CONTENT_W - 1, 7.4, "F");
      font("helvetica", "bold", 8, [255, 255, 255]);
      let x = MARGIN;
      cols.forEach((c, i) => { pdf.text(pdfSafe(c.label).toUpperCase(), x + PAD, y + 4.9); x += widths[i]; });
      y += 7.4;
    };
    drawHeader();
    rows.forEach((row, r) => {
      font("helvetica", "normal", SM);
      const cells = row.map((cell, i) => wrap(cell, widths[i] - PAD * 2));
      const h = Math.max(...cells.map((l) => l.length)) * lh + PAD * 2 - 0.4;
      if (y + h > BOTTOM) { newPage(); drawHeader(); }
      if (r % 2 === 1) { fill(ZEBRA); pdf.rect(MARGIN, y, CONTENT_W - 1, h, "F"); }
      stroke(LINE); pdf.setLineWidth(0.2);
      pdf.rect(MARGIN, y, CONTENT_W - 1, h);
      let x = MARGIN;
      cells.forEach((lines, i) => {
        if (i > 0) pdf.line(x, y, x, y + h);
        font("helvetica", opts.boldFirst && i === 0 ? "bold" : "normal", SM);
        pdf.text(lines, x + PAD, y + PAD + lh * 0.82);
        x += widths[i];
      });
      y += h;
    });
    y += 5;
  };

  // ---------- capa ----------
  font("helvetica", "bold", 9, TEAL);
  pdf.setCharSpace(0.6);
  pdf.text("REGISTRO INSTITUCIONAL", MARGIN, 52);
  pdf.setCharSpace(0);
  font("times", "bold", 28, NAVY);
  const titleLines = wrap("Ata de Reunião", CONTENT_W);
  pdf.text(titleLines, MARGIN, 64);
  let cy = 64 + titleLines.length * 11;
  font("times", "bold", 21, NAVY);
  const topicLines = wrap(data.title, CONTENT_W);
  pdf.text(topicLines, MARGIN, cy);
  cy += topicLines.length * 8.6 + 2;
  font("helvetica", "normal", 12, MUTED);
  const natureLines = wrap(data.nature, CONTENT_W);
  pdf.text(natureLines, MARGIN, cy + 3);
  cy += natureLines.length * 5.8 + 12;
  y = cy;
  table(
    [{ label: "Data", w: 1 }, { label: "Horário", w: 1 }, { label: "Local ou modalidade", w: 1.5 }],
    [[data.date, `${data.start} às ${data.end}`, data.modality]],
  );
  y += 4;
  font("helvetica", "bold", 13, BLUE); pdf.text("Finalidade do encontro", MARGIN, y + 4); y += 8;
  paragraph(data.purpose, { size: 10.5 });
  y += 5;
  font("helvetica", "bold", 13, BLUE); pdf.text("Síntese executiva", MARGIN, y + 4); y += 8;
  paragraph(data.executiveSummary, { size: 10.5 });
  y = Math.max(y + 10, 232);
  if (y > BOTTOM - 22) y = BOTTOM - 22;
  font("helvetica", "bold", 9.5, TEAL); pdf.text("Versão para validação", MARGIN, y); y += 4.5;
  paragraph(data.validationNote, { size: 8.5, c: MUTED });

  // ---------- corpo ----------
  newPage();
  sectionTitle("1 Identificação da reunião");
  table(
    [{ label: "Campo", w: 1 }, { label: "Registro", w: 2.6 }],
    [
      ["Natureza", data.nature],
      ["Convocação", data.convocation],
      ["Coordenação dos trabalhos", data.coordination],
      ["Secretaria da reunião", data.secretary],
      ["Participantes", data.participants.map((p) => `${p.name} (${p.role})`).join("; ")],
    ],
    { boldFirst: true },
  );

  sectionTitle("2 Pauta consolidada");
  bullets(data.agenda);

  sectionTitle("3 Discussões e consensos");
  data.discussions.forEach((d, i) => { subTitle(`3.${i + 1} ${d.title}`); paragraph(d.body); });

  sectionTitle("4 Deliberações");
  if (data.deliberations.length) numbered(data.deliberations); else paragraph("Nenhuma deliberação registrada.", { c: MUTED });

  sectionTitle("5 Plano de ação");
  if (data.actionPlan.length) {
    table(
      [{ label: "Ação", w: 1.5 }, { label: "Responsável", w: 1.1 }, { label: "Prazo ou marco", w: 1 }, { label: "Produto esperado", w: 1.1 }],
      data.actionPlan.map((a) => [a.action, a.owner, a.deadline, a.product]),
    );
  } else paragraph("Nenhuma ação registrada.", { c: MUTED });

  let n = 6;
  if (data.references.length) {
    sectionTitle(`${n++} Referências consultadas (PubMed)`);
    bullets(data.references.map((r) => `${r.title} ${r.journal}${r.year ? `, ${r.year}` : ""}. PMID ${r.pmid}.`));
  }

  sectionTitle(`${n++} Pontos pendentes de validação`);
  if (data.pending.length) table([{ label: "Item", w: 1 }, { label: "Validação necessária", w: 2.4 }], data.pending.map((p) => [p.item, p.validation]), { boldFirst: true });
  else paragraph("Nenhum ponto pendente registrado.", { c: MUTED });

  sectionTitle(`${n++} Próxima reunião`);
  paragraph(data.nextMeeting);

  sectionTitle(`${n} Encerramento`);
  paragraph(data.closing);
  ensure(36);
  y += 16;
  stroke(NAVY); pdf.setLineWidth(0.25);
  const half = (CONTENT_W - 12) / 2;
  pdf.line(MARGIN, y, MARGIN + half, y);
  pdf.line(MARGIN + half + 12, y, MARGIN + CONTENT_W, y);
  font("helvetica", "normal", 8.6, MUTED);
  pdf.text(["Presidência ou coordenação da reunião", "Nome e assinatura"], MARGIN, y + 4);
  pdf.text(["Responsável pela ata", "Nome e assinatura"], MARGIN + half + 12, y + 4);

  // ---------- rodapé em todas as páginas ----------
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    stroke(LINE); pdf.setLineWidth(0.2);
    pdf.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    font("helvetica", "normal", 8, MUTED);
    pdf.text("Documento elaborado com apoio de IA a partir do registro da reunião", MARGIN, PAGE_H - 9);
    pdf.text(`Página ${p} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
  void onCover;
  return pdf;
}

export function downloadMinutesPdf(data: MinutesDoc): void {
  buildMinutesPdf(data).save(minutesFileName(data));
}
