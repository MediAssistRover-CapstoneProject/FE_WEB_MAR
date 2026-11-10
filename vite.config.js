import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const target = env.VITE_API_BASE_URL || 'https://mediassistrover.duckdns.org';
  const proxyEntry = {
    target,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('origin', 'http://localhost:5173');
      });
    },
  };

  return {
    server: {
      watch: {
        // Generated test files and downloaded tools can be locked on Windows.
        ignored: [/(^|[\\/])\.workstation-build([\\/]|$)/],
      },
      proxy: target ? {
        '/api': proxyEntry,
        '/assistant.css': proxyEntry,
        '/kiosk-voice.js': proxyEntry,
      } : undefined,
    },
  };
});
