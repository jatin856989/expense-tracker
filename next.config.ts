import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB — too small for a portfolio screenshot sent as base64
    // (the "analyze my portfolio image" feature). 10mb comfortably covers a
    // typical phone photo/screenshot even after base64's ~33% size overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // lucide-react and recharts are already on Next's default-optimized
    // list; framer-motion isn't, so only import the bits each page actually
    // uses instead of bundling the whole library on every route.
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
