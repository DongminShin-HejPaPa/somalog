import type { NextConfig } from "next";

const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
const buildTime = `${String(kstDate.getUTCHours()).padStart(2, "0")}:${String(kstDate.getUTCMinutes()).padStart(2, "0")}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || "dev",
  },
};

export default nextConfig;
