import type { MetadataRoute } from "next";

const SITE = "https://sameplz.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my", "/checkout", "/play", "/admin", "/welcome", "/auth", "/api"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
