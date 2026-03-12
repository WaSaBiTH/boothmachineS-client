const nextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: {
    appIsrStatus: process.env.HIDE_DEV_TOOLS !== 'true',
    buildActivity: process.env.HIDE_DEV_TOOLS !== 'true',
  },
  experimental: {
    devOverlay: process.env.HIDE_DEV_TOOLS !== 'true',
  }
};

export default nextConfig;
