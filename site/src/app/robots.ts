import type { MetadataRoute } from "next";
import { site } from "../site";

// Every crawler is welcome, the answer engines' by name, so a default rule elsewhere cannot shut them out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"],
        allow: "/",
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
