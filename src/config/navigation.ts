type NavigationItem = {
  key: string;
  path: `/${string}`;
  isContentType: boolean;
};

export const NAVIGATION_CONFIG: NavigationItem[] = [
  { key: "release", path: "/release", isContentType: true },
  { key: "media", path: "/media", isContentType: true },
  { key: "guide", path: "/guide", isContentType: true },
  { key: "customization", path: "/customization", isContentType: true },
  { key: "characters", path: "/characters", isContentType: true },
  { key: "platforms", path: "/platforms", isContentType: true },
  { key: "features", path: "/features", isContentType: true },
  { key: "community", path: "/community", isContentType: true },
];

export const CONTENT_TYPES: string[] = NAVIGATION_CONFIG
  .filter((item) => item.isContentType)
  .map((item) => item.key);
