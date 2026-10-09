import type { NextConfig } from "next";

/**
 * Content Security Policy (CSP) tuned for Puneri Safar Next.js application
 * with Google Maps JavaScript API and font/tile services.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://maps.googleapis.com ${isDev ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://maps.googleapis.com https://generativelanguage.googleapis.com https://api.groq.com;
  frame-src 'self' https://www.google.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  {
    // Content-Security-Policy: Restricts sources of scripts, styles, images, and API connections
    // Configured explicitly to permit Google Maps JS API, Google Fonts, and map tiles while blocking XSS
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    // X-Content-Type-Options: Prevents MIME-type sniffing by browsers, forcing declared content types
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // X-Frame-Options: Prevents clickjacking attacks by forbidding embedding inside any iframes
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Referrer-Policy: Protects user privacy while providing origin context to third-party maps
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Permissions-Policy: Restricts powerful browser APIs; allows geolocation (city navigation)
    // and microphone (voice search) strictly for the first-party application origin
    key: "Permissions-Policy",
    value:
      "geolocation=(self), microphone=(self), camera=(), interest-cohort=(), browsing-topics=()",
  },
  {
    // Strict-Transport-Security: Enforces HTTPS connections and prevents SSL stripping attacks
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // X-XSS-Protection: Disabled legacy browser auditor in favor of robust Content Security Policy
    key: "X-XSS-Protection",
    value: "0",
  },
];

const nextConfig: NextConfig = {
  // Enforce Next.js React strict compiler / server features
  reactStrictMode: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        // Apply security headers to all application and API routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
