import { describe, expect, it } from "vitest";
import { DOMAINS, resolveRoute } from "./navConfig";

describe("resolveRoute", () => {
  it.each([
    ["/dashboard", "inicio", "/dashboard"],
    ["/calculadora", "clinica", "/calculadora"],
    ["/chat/abc", "clinica", "/agentes"],
    ["/meus-agentes/123", "clinica", "/meus-agentes"],
    ["/squads/9", "equipes", "/squads"],
    ["/reuniao-viva/7", "equipes", "/reunioes"],
    ["/fluxos/3", "equipes", "/fluxos"],
    ["/osce/estacao/1", "ensino", "/osce"],
    ["/salas-virtuais/aula/123456", "ensino", "/salas-virtuais"],
    ["/marketplace/fluxos", "acervo", "/marketplace"],
    ["/conteudos/5", "acervo", "/conteudos"],
    ["/admin/agente/2", "ajuda", "/admin"],
    ["/creditos", "ajuda", "/creditos"],
  ])("%s -> %s", (path, domain, item) => {
    const r = resolveRoute(path);
    expect(r.domain.id).toBe(domain);
    expect(r.item?.to).toBe(item);
  });

  it("rota desconhecida cai em Clínica sem item ativo", () => {
    const r = resolveRoute("/nao-existe");
    expect(r.domain.id).toBe("clinica");
    expect(r.item).toBeNull();
  });

  it("não repete rotas entre domínios", () => {
    const all = DOMAINS.flatMap((d) => d.items.map((i) => i.to));
    expect(new Set(all).size).toBe(all.length);
  });
});
