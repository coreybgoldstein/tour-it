import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg/wasm runs only in the browser — don't try to bundle it server-side
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
};

export default nextConfig;
