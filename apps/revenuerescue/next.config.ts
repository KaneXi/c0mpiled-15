import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};
export default config;
