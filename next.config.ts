import type { NextConfig } from "next";

// The browser talks only to this origin; /api is proxied to the backend so the
// httpOnly session cookie stays first-party and no CORS setup is needed.
const BACKEND_URL = process.env.BACKEND_URL || "https://email-warmer-psi.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
