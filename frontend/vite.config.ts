import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  base: '/admin/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    assetsDir: 'assets',
    // Ensure build compatibility
    target: 'esnext',
    // Generate sourcemaps for easier debugging
    sourcemap: mode === 'development',
    // Enable minification with esbuild (default and doesn't require additional dependencies)
    minify: 'esbuild',
    // Configure esbuild options
    esbuildOptions: {
      // Remove console.log and debugger in production
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    // Improve CSS processing
    cssMinify: true,
    // Keep large chunks but optimize aggressively
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
        // Enhanced chunking strategy
        manualChunks: {
          // Core framework chunks
          'framework': [
            'react', 
            'react-dom', 
            'react/jsx-runtime'
          ],
          // Routing-related chunks
          'routing': [
            'react-router-dom',
            '@remix-run/router'
          ],
          // UI framework chunks (stable libraries)
          'ui-framework': [
            'clsx',
            'class-variance-authority',
            'tailwind-merge'
          ],
          // Radix UI components (commonly used UI primitives)
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip'
          ],
          // Form handling
          'forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod'
          ],
          // Icons
          'icons': [
            'lucide-react'
          ],
          // Data fetching
          'data': [
            '@tanstack/react-query'
          ],
          // Date handling
          'dates': [
            'date-fns',
            'react-day-picker'
          ],
          // Notifications
          'notifications': [
            'sonner'
          ],
          // Charts/visualizations
          'charts': [
            'recharts'
          ]
        }
      },
    },
  },
  // Enable dynamic imports and code splitting across modules
  optimizeDeps: {
    // Force include problematic dependencies
    include: [
      'react', 
      'react-dom', 
      'react-router-dom'
    ]
  },
  preview: {
    port: 8080,
    strictPort: true,
    host: true,
  },
}));
