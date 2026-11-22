import { lazy, type ComponentType } from "react";

/**
 * lazy() que se recupera de pedaço obsoleto: depois de um deploy, o nome do arquivo antigo some e o
 * import falha. Recarrega a página uma vez (marcador em sessionStorage evita laço) para pegar a versão nova.
 */
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem("pos-chunk-reload"); } catch { /* ignora */ }
      return mod;
    } catch (err) {
      let already = false;
      try { already = sessionStorage.getItem("pos-chunk-reload") === "1"; sessionStorage.setItem("pos-chunk-reload", "1"); } catch { /* ignora */ }
      if (!already) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
