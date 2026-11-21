// Convidado sem conta abre o link da reunião, entra (ou cria a conta) e precisa voltar ao link. O destino fica só na aba
// (sessionStorage) e só caminhos internos de reunião são aceitos: nada de redirecionar para endereço de fora.
const KEY = "posologia:returnTo";
const ALLOWED = /^\/reuniao-viva\/[A-Za-z0-9_-]{1,64}(\/[A-Za-z0-9_-]{1,64})?$/;

export function isSafeReturnTo(path: unknown): path is string {
  return typeof path === "string" && ALLOWED.test(path);
}

export function setReturnTo(path: string): void {
  try { if (isSafeReturnTo(path)) sessionStorage.setItem(KEY, path); } catch { /* armazenamento indisponível: segue sem voltar */ }
}

/** Devolve o destino guardado (uma vez só) ou null. */
export function takeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isSafeReturnTo(v) ? v : null;
  } catch {
    return null;
  }
}
