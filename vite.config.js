import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const target = env.VITE_DEV_PROXY_TARGET;

  return {
    server: target ? {
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    } : undefined,
  };
});
