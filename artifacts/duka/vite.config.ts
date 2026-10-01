import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, '../../'),
  envPrefix: ['VITE_', 'API_URL', 'CLERK_PUBLISHABLE_KEY', 'CLERK_PROXY_URL', 'RC_API_KEY', 'REVENUECAT_'],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      (process.env.VITE_API_URL || process.env.API_URL || process.env.VITE_API_BASE_URL || 'https://api.usetakeorder.app').replace(/\/+$/, '')
    ),
    'import.meta.env.VITE_RC_API_KEY': JSON.stringify(
      process.env.VITE_RC_API_KEY || process.env.RC_API_KEY || process.env.REVENUECAT_API_KEY || 'pdl_vcGFFumhSZjAmNqTiDIbNlenSEvU'
    ),
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsudXNldGFrZW9yZGVyLmFwcCQ'
    ),
  },
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-icons';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react';
          if (id.includes('@clerk')) return 'vendor-clerk';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('@revenuecat')) return 'vendor-revenuecat';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('date-fns')) return 'vendor-date';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/branding': {
        target: process.env.API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
