import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB — too small for a portfolio screenshot sent as base64
    // (the "analyze my portfolio image" feature). 10mb comfortably covers a
    // typical phone photo/screenshot even after base64's ~33% size overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
