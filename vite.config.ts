import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'development-entry',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url?.startsWith('/?'))
            req.url = '/web/index.html' + req.url.slice(1);
          next();
        });
      },
    },
  ],
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsDir: 'site',
    rollupOptions: { input: 'web/index.html' },
  },
  server: { port: 5173 },
});
