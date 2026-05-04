/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/forecastiqdemo" : "";

const nextConfig = {
  reactStrictMode: true,
  // Static export so the site can be served by GitHub Pages
  output: "export",
  // ESLint at build time has a habit of hanging on network calls
  // (eslint-config-next pulls some rules from npm registry during init).
  // The build itself doesn't need lint to succeed — `npm run lint` covers
  // that separately and CI can run it as its own step.
  eslint: { ignoreDuringBuilds: true },
  // GitHub Pages serves at username.github.io/<repo>/, so all internal
  // links + assets need to be prefixed with the repo name in production
  basePath,
  assetPrefix: basePath,
  // Each route gets its own folder with index.html (cleaner GH Pages routing)
  trailingSlash: true,
  // GH Pages can't run the Next.js image optimizer, so serve raw images
  images: { unoptimized: true },
  // Expose basePath to the browser bundle so plain <img> tags can prefix correctly
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
