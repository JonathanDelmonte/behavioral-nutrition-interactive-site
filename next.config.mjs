/** @type {import('next').NextConfig} */

// When set, the build produces a fully static export (out/) suitable for
// hosting on GitHub Pages or any static host. Inactive by default — local
// dev, regular builds, and platforms like Vercel get the full Next runtime.
const isGhPages = process.env.BUILD_FOR_GH_PAGES === "1";
const repo = "behavioral-nutrition-interactive-site";
const basePath = isGhPages ? `/${repo}` : "";

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages-only static export + path prefix. The site lives at
  // username.github.io/<repo>, so every internal URL needs the prefix.
  ...(isGhPages && {
    output: "export",
    basePath,
    assetPrefix: `${basePath}/`,
    images: { unoptimized: true },
    trailingSlash: true,
  }),
  // Mirror the basePath into the client bundle so we can prepend it to
  // hand-built URLs (like the GLB fetch in constants.ts).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
