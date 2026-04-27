import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.106'],
  experimental: {
    // silence the middleware deprecation for now
  },
};

export default nextConfig;