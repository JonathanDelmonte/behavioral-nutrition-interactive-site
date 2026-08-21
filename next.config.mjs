/** @type {import('next').NextConfig} */

// When set, the build produces a fully static export (out/) suitable for ANY
// file host — Cloudflare Pages, Netlify, GitHub Pages. Inactive by default:
// local dev and regular builds get the full Next runtime.
const isStaticExport =
  process.env.STATIC_EXPORT === "1" || process.env.BUILD_FOR_GH_PAGES === "1";
// The path prefix is a GitHub Pages-ONLY concern: a project page serves the
// site under username.github.io/<repo>, so every internal URL needs the
// prefix there. On a *.pages.dev or on a domain of our own the site sits at
// the root and the prefix must be empty — which is why the prefix can't ride
// along with the export flag (it used to, and that made "export at the root"
// impossible to ask for).
const isGhPages = process.env.BUILD_FOR_GH_PAGES === "1";
const repo = "behavioral-nutrition-interactive-site";
const basePath = isGhPages ? `/${repo}` : "";

const nextConfig = {
  reactStrictMode: true,
  // Static export for whichever file host is serving this build; basePath and
  // assetPrefix only tag along on GitHub Pages (empty everywhere else).
  ...(isStaticExport && {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    ...(basePath && { basePath, assetPrefix: `${basePath}/` }),
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
