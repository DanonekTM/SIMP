export const siteConfig = {
  name: "S.I.M.P",
  description: "S.I.M.P - Simple Image Management Platform",
  defaultTitle: "S.I.M.P",
  favicon: "/favicon.ico",
  appleTouchIcon: "/apple-touch-icon.png",
  manifest: "/site.webmanifest",
};

export const getPageTitle = (title?: string) => {
  if (!title) return siteConfig.defaultTitle;
  return `${title} | ${siteConfig.name}`;
};

export const getPageMetadata = (title?: string) => {
  return {
    title: getPageTitle(title),
    description: siteConfig.description,
    icons: {
      icon: siteConfig.favicon,
      apple: siteConfig.appleTouchIcon,
    },
  };
}; 
