// src/app/sitemap.ts
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conplexus.com";
  return [
    { url: `${base}/`, priority: 1.0 },
    { url: `${base}/admin/rollup`, priority: 0.8 },
  ];
}
