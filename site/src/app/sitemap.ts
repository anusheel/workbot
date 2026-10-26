import type { MetadataRoute } from "next";
import { questions, site } from "../site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/research", ...questions.map((q) => `/questions/${q.slug}`)].map(
    (path) => ({
      url: `${site.url}${path}`,
      lastModified: site.updated,
    }),
  );
}
