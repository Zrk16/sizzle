import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The spike/ folder is the throwaway Vite harness that proved web-renderer works.
  // Keep it in the repo as evidence, keep it out of the build.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
