import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** sitemap.xml via file convention (gerado estático no export). Uma URL só —
 *  o site é uma landing única; novas rotas (blog etc.) entram aqui quando
 *  existirem. lastModified = data do build, que é exatamente quando o
 *  conteúdo publicado muda. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
