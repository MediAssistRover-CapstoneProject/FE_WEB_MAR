import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const target = env.VITE_DEV_PROXY_TARGET;

  return {
    server: {
      watch: {
        // Generated test files and downloaded tools can be locked on Windows.
        ignored: [/(^|[\\/])\.workstation-build([\\/]|$)/],
      },
      proxy: target ? {
        '/api': { target, changeOrigin: true },
      } : undefined,
    },
  };
});
