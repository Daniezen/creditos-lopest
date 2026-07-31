export const responsiveContract = {
  mobileMax: 767,
  drawerMin: 768,
  drawerMax: 1199,
  persistentSidebarMin: 1200,
  validationViewports: [
    { width: 1440, height: 900, name: "desktop" },
    { width: 1024, height: 576, name: "compact-desktop" },
    { width: 425, height: 576, name: "mobile" },
  ],
} as const;
