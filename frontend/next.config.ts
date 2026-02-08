import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Modal deployment (build only)
  output: "export",
  images: { unoptimized: true },

  // Proxy API calls to local FastAPI during development (next dev)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
