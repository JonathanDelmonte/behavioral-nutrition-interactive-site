/** Origem pública do deploy atual (GitHub Pages). Base dos URLs ABSOLUTOS de
 *  canonical, Open Graph, JSON-LD, robots e sitemap. Ao migrar para um domínio
 *  próprio, trocar SOMENTE esta constante — layout.tsx, robots.ts e sitemap.ts
 *  leem daqui. */
export const SITE_ORIGIN = "https://jonathandelmonte.github.io";

/** Prefixo do deploy (GH Pages de projeto serve em /<repo>). Espelhado no
 *  bundle via next.config.mjs; vazio em dev e em hosts com domínio na raiz. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** URL canônica da home — com basePath e barra final (o export usa
 *  trailingSlash). Usar SEMPRE esta constante em vez de montar na mão:
 *  o canonical resolvido pelo metadataBase do Next NÃO prefixa o basePath. */
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}/`;
