import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg/wasm runs only in the browser — don't try to bundle it server-side
  // sharp ships a native binary — let Vercel's Linux runtime require it at runtime
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "sharp"],
  // Beauty-shot route reads fonts + logo from /public at module load. Vercel
  // serves /public from CDN by default and does NOT include it in the Node
  // function bundle — trace these specific files in so readFileSync works.
  outputFileTracingIncludes: {
    "/api/round/[id]/beauty": [
      "./public/fonts/*.ttf",
      "./public/tour-it-logo-full.png",
    ],
  },
};

export default nextConfig;
