import fs from "fs";
import path from "path";
import { CONTENT_TYPES as CONFIG_CONTENT_TYPES } from "@/config/navigation";
import { routing, type Locale } from "@/i18n/routing";

export const CONTENT_TYPES = CONFIG_CONTENT_TYPES;

export function fileNameToSlug(fileName: string): string {
  return fileName
    .replace(/\.mdx$/, "")
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findFileBySlug(
  dir: string,
  slug: string,
  basePath: string[] = [],
): string | null {
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findFileBySlug(fullPath, slug, [...basePath, entry.name]);
      if (result) return result;
    } else if (entry.name.endsWith(".mdx")) {
      const fileName = entry.name.replace(".mdx", "");
      const entrySlug = [...basePath, fileNameToSlug(fileName)].join("/");
      if (entrySlug === slug) {
        return [...basePath, fileName].join("/");
      }
    }
  }

  return null;
}

export interface ContentMetadata {
  title: string;
  description: string;
  category: string;
  date: string;
  lastModified?: string;
  image?: string;
  badge?: string;
  summary?: string;
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface ContentItem {
  slug: string;
  segments: string[];
  contentType: string;
  locale: Locale;
  metadata: ContentMetadata;
}

export type ContentData = {
  slug: string;
  segments: string[];
  contentType: string;
  locale: Locale;
  metadata: ContentMetadata;
  MDXContent: React.ComponentType;
  headings: Heading[];
};

const CONTENT_ROOT = path.join(process.cwd(), "content");

function extractHeadings(mdxSource: string): Heading[] {
  const headings: Heading[] = [];
  const lines = mdxSource.split("\n");
  const slugger = new GithubSlugger();

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].replace(/\{[^}]*\}/g, "").trim();
    const id = slugger.slug(text);

    headings.push({ id, text, level });
  }

  return headings;
}

function getHeadingsFromFile(filePath: string): Heading[] {
  try {
    const source = fs.readFileSync(filePath, "utf-8");
    return extractHeadings(source);
  } catch {
    return [];
  }
}

function getSlugsFromDirectory(dir: string, basePath: string[] = []): string[][] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const paths: string[][] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...getSlugsFromDirectory(fullPath, [...basePath, entry.name]));
    } else if (entry.name.endsWith(".mdx")) {
      const fileName = entry.name.replace(".mdx", "");
      paths.push([...basePath, fileNameToSlug(fileName)]);
    }
  }

  return paths;
}

export async function getAllContent(
  contentType: string,
  language: Locale,
): Promise<ContentItem[]> {
  const contentDir = path.join(CONTENT_ROOT, language, contentType);
  const slugPaths = getSlugsFromDirectory(contentDir);

  const items = await Promise.all(
    slugPaths.map(async (segments) => {
      const slug = segments.join("/");
      try {
        const realSlug = findFileBySlug(contentDir, slug) || slug;
        const mod = await import(
          `../../content/${language}/${contentType}/${realSlug}.mdx`
        );

        return {
          slug,
          segments,
          contentType,
          locale: language,
          metadata: mod.metadata as ContentMetadata,
        } satisfies ContentItem;
      } catch {
        return null;
      }
    }),
  );

  return items
    .filter((item): item is ContentItem => Boolean(item))
    .sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
}

export async function getContent(
  contentType: string,
  slugSegments: string[],
  language: Locale,
): Promise<ContentData | null> {
  const currentSlug = slugSegments.join("/");
  const contentDir = path.join(CONTENT_ROOT, language, contentType);

  try {
    const realSlug = findFileBySlug(contentDir, currentSlug) || currentSlug;
    const mdxPath = path.join(contentDir, `${realSlug}.mdx`);
    const { default: MDXContent, metadata } = await import(
      `../../content/${language}/${contentType}/${realSlug}.mdx`
    );

    return {
      slug: currentSlug,
      segments: slugSegments,
      contentType,
      locale: language,
      metadata: metadata as ContentMetadata,
      MDXContent,
      headings: getHeadingsFromFile(mdxPath),
    };
  } catch {
    if (language === routing.defaultLocale) return null;

    try {
      const enContentDir = path.join(
        CONTENT_ROOT,
        routing.defaultLocale,
        contentType,
      );
      const enRealSlug = findFileBySlug(enContentDir, currentSlug) || currentSlug;
      const enMdxPath = path.join(enContentDir, `${enRealSlug}.mdx`);
      const { default: MDXContent, metadata } = await import(
        `../../content/${routing.defaultLocale}/${contentType}/${enRealSlug}.mdx`
      );

      return {
        slug: currentSlug,
        segments: slugSegments,
        contentType,
        locale: routing.defaultLocale,
        metadata: metadata as ContentMetadata,
        MDXContent,
        headings: getHeadingsFromFile(enMdxPath),
      };
    } catch {
      return null;
    }
  }
}

export interface NavGroup {
  title: string;
  count: number;
  slug: string;
  links: Array<{ label: string; href: string; badge?: string }>;
}

const GROUP_TITLES: Record<string, string> = {
  release: "Release",
  media: "Media",
  guide: "Guide",
  customization: "Customization",
  characters: "Characters",
  platforms: "Platforms",
  features: "Features",
  community: "Community",
};

const GROUP_TITLES_BY_LOCALE: Record<string, Record<string, string>> = {};

const OVERVIEW_LABEL_BY_LOCALE: Record<string, string> = {};

const GROUP_ORDER: string[] = [
  "release",
  "media",
  "guide",
  "customization",
  "characters",
  "platforms",
  "features",
  "community",
];

export function getDynamicNavigation(language: Locale = "en"): NavGroup[] {
  const localeDir = path.join(CONTENT_ROOT, language);
  if (!fs.existsSync(localeDir)) return [];

  const entries = fs.readdirSync(localeDir, { withFileTypes: true });
  const groups: NavGroup[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const groupSlug = entry.name;
    if (!CONTENT_TYPES.includes(groupSlug as typeof CONTENT_TYPES[number])) {
      continue;
    }

    const groupDir = path.join(localeDir, groupSlug);
    const slugPaths = getSlugsFromDirectory(groupDir);
    if (slugPaths.length === 0) continue;

    const links: NavGroup["links"] = [];
    const overviewLabel = OVERVIEW_LABEL_BY_LOCALE[language] || "Overview";
    links.push({ label: overviewLabel, href: `/${groupSlug}` });

    for (const segments of slugPaths) {
      const articleSlug = segments.join("/");
      const mdxFilePath = findFileBySlug(groupDir, articleSlug);
      if (!mdxFilePath) continue;

      const fullPath = path.join(groupDir, `${mdxFilePath}.mdx`);
      let title = segments[segments.length - 1]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      let badge: string | undefined;

      try {
        const source = fs.readFileSync(fullPath, "utf-8");
        const titleMatch = source.match(/title:\s*["'](.+?)["']/);
        if (titleMatch) title = titleMatch[1];

        const badgeMatch = source.match(/badge:\s*["'](.+?)["']/);
        if (badgeMatch) badge = badgeMatch[1];
      } catch {
        // Keep the filename-derived title when metadata cannot be read.
      }

      links.push({ label: title, href: `/${groupSlug}/${articleSlug}`, badge });
    }

    const localTitles = GROUP_TITLES_BY_LOCALE[language] || {};
    const groupTitle =
      localTitles[groupSlug] ||
      GROUP_TITLES[groupSlug] ||
      groupSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    groups.push({
      title: groupTitle,
      count: links.length - 1,
      slug: groupSlug,
      links,
    });
  }

  groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.slug);
    const bi = GROUP_ORDER.indexOf(b.slug);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return groups;
}

export async function getAllContentPaths(language: Locale) {
  const localeDir = path.join(CONTENT_ROOT, language);
  if (!fs.existsSync(localeDir)) return [];

  const entries = fs.readdirSync(localeDir, { withFileTypes: true });
  const contentTypeDirs = entries.filter(
    (entry) => entry.isDirectory() && CONTENT_TYPES.includes(entry.name),
  );

  return contentTypeDirs.flatMap((entry) => {
    const segments = getSlugsFromDirectory(path.join(localeDir, entry.name));
    return segments.map((slug) => ({ contentType: entry.name, slug }));
  });
}
