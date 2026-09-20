import type { MetadataRoute } from "next";

/**
 * The colours here must match `globals.css`, or the splash screen greets you in last
 * season's paper while the app itself is warm. A test reads the stylesheet and checks.
 */
export const SPLASH_BACKGROUND = "#f7f2e8";
export const THEME_COLOUR = "#f7f2e8";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tipon",
    short_name: "Tipon",
    description: "Gather it all. Sort it out. Turn a brain dump into projects and tasks.",
    start_url: "/",
    display: "standalone",
    background_color: SPLASH_BACKGROUND,
    theme_color: THEME_COLOUR,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops "any" icons into its own shape. Without a maskable one, the
      // notebook loses its corners; with it, the art sits inside the safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
