import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	logging: { fetches: { fullUrl: true } },
	typedRoutes: true,
	serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
