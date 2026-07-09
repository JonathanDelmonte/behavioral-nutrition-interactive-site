import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** robots.txt via file convention (gerado estático no export).
 *
 *  NOTA (staging): com basePath (GH Pages de projeto) este arquivo sai em
 *  /<repo>/robots.txt — e crawlers só leem robots.txt na RAIZ do host, então
 *  ele só passa a valer de fato no domínio próprio (sem basePath). O noindex
 *  do staging NÃO depende disso: vem da meta robots no layout.tsx.
 *
 *  Sem Disallow de propósito, mesmo em staging: o Google precisa conseguir
 *  crawlear a página para VER o noindex — bloquear o crawl o esconderia. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}sitemap.xml`,
  };
}
