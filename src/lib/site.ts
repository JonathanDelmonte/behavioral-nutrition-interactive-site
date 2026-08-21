/** Origem pública do deploy. Base dos URLs ABSOLUTOS de canonical, Open Graph,
 *  JSON-LD, robots e sitemap — layout.tsx, robots.ts e sitemap.ts leem daqui.
 *
 *  Vem da env SITE_ORIGIN quando o host define uma (no painel da Cloudflare
 *  Pages, por exemplo: primeiro o *.pages.dev, depois o domínio próprio), e
 *  cai no GitHub Pages quando ninguém define — que é o caso do workflow de
 *  staging e do build local. Assim trocar de endereço deixou de ser uma
 *  edição de código. Sem barra no fim: SITE_URL abaixo é quem monta o path. */
export const SITE_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://jonathandelmonte.github.io";

/** Prefixo do deploy (GH Pages de projeto serve em /<repo>). Espelhado no
 *  bundle via next.config.mjs; vazio em dev e em hosts com domínio na raiz. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** URL canônica da home — com basePath e barra final (o export usa
 *  trailingSlash). Usar SEMPRE esta constante em vez de montar na mão:
 *  o canonical resolvido pelo metadataBase do Next NÃO prefixa o basePath. */
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}/`;
