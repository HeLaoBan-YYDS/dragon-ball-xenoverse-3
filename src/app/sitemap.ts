import type { MetadataRoute } from "next";
import { getAllContentPaths } from "@/lib/content";
import { CONTENT_TYPES } from "@/config/navigation";
import { routing } from "@/i18n/routing";

function localizedPath(path: string, locale: string) {
  return `${locale === "en" ? "" : `/${locale}`}${path === "/" ? "" : path}`;
}

function absoluteUrl(siteUrl: string, path: string, locale: string) {
  return `${siteUrl}${localizedPath(path, locale)}`;
}

function languageAlternates(siteUrl: string, path: string) {
  return {
    ...Object.fromEntries(routing.locales.map((locale) => [locale, absoluteUrl(siteUrl, path, locale)])),
    "x-default": absoluteUrl(siteUrl, path, routing.defaultLocale),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dragon-ball-xenoverse-3.wiki";

  const staticPaths = [
    "/",
    ...CONTENT_TYPES.map((contentType) => `/${contentType}`),
    "/privacy-policy",
    "/terms-of-service",
    "/copyright",
    "/about",
  ];

  // Dynamic paths: scan actual MDX content files
  const contentPaths = await getAllContentPaths("en");
  const dynamicPaths = contentPaths.map((item) => `/${[item.contentType, ...item.slug].join("/")}`);

  const paths = [...staticPaths, ...dynamicPaths];

  return routing.locales.flatMap((locale) =>
    paths.map((path) => ({
      url: absoluteUrl(siteUrl, path, locale),
      lastModified: new Date(),
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : CONTENT_TYPES.some((contentType) => path === `/${contentType}`) ? 0.8 : 0.6,
      alternates: {
        languages: languageAlternates(siteUrl, path),
      },
    })),
  );
}
