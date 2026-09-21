import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Connectivity detection for `useOffline`. Worth the experimental flag: it listens
     * for the browser's offline event *and* polls with HEAD requests, so it doesn't
     * believe `navigator.onLine`, which happily reports true on a captive portal.
     */
    useOffline: true,
  },

  async headers() {
    return [
      {
        // A cached service worker is a service worker you can't replace. This is the one
        // file that must always come from the network, or a deploy may never arrive.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
