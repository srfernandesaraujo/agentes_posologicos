import { beforeEach, describe, expect, it } from "vitest";
import { isSafeReturnTo, setReturnTo, takeReturnTo } from "./returnTo";

describe("returnTo (volta ao link da reunião depois do login)", () => {
  beforeEach(() => sessionStorage.clear());

  it("aceita só caminhos de reunião", () => {
    expect(isSafeReturnTo("/reuniao-viva/convite/abc_DEF-123")).toBe(true);
    expect(isSafeReturnTo("/reuniao-viva/0b1c2d3e-0000-4000-8000-000000000000")).toBe(true);
    expect(isSafeReturnTo("/squads/0b1c2d3e-0000-4000-8000-000000000000")).toBe(true);
  });
  it("recusa endereço externo, outras rotas e tentativas de escapar do caminho", () => {
    for (const p of ["https://evil.com", "//evil.com", "/agentes", "/reuniao-viva/../admin", "/reuniao-viva/a/b/c", "/reuniao-viva/", "javascript:alert(1)", "/reuniao-viva/a?x=1", "/squads/abc", "/squads/0b1c2d3e-0000-4000-8000-000000000000/../x", "", null, 5]) {
      expect(isSafeReturnTo(p as any)).toBe(false);
    }
  });
  it("guarda uma vez e devolve uma vez só", () => {
    setReturnTo("/reuniao-viva/convite/tok_en");
    expect(takeReturnTo()).toBe("/reuniao-viva/convite/tok_en");
    expect(takeReturnTo()).toBeNull();
  });
  it("não guarda caminho inseguro", () => {
    setReturnTo("https://evil.com");
    expect(takeReturnTo()).toBeNull();
  });
  it("valor adulterado no storage é ignorado", () => {
    sessionStorage.setItem("posologia:returnTo", "https://evil.com");
    expect(takeReturnTo()).toBeNull();
  });
});
