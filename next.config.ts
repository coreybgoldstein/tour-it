import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg/wasm runs only in the browser — don't try to bundle it server-side
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  // Make sure the beauty-shot route can read its bundled fonts + logo on Vercel
  outputFileTracingIncludes: {
    "/api/round/[id]/beauty": [
      "./src/app/api/round/[id]/beauty/*.ttf",
      "./src/app/api/round/[id]/beauty/*.png",
    ],
  },
};

export default nextConfig;
