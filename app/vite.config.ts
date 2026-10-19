import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Port 8000 matches the redirect URL already allowed for magic links in Supabase.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Mock builds use relative paths so the folder can be opened from any static host.
  base: mode === 'mock' ? './' : '/',
  // Escape non-ASCII characters in the bundle so any static host serves it intact.
  esbuild: { charset: 'ascii' },
  // PGlite ships its own WebAssembly and data files; pre-bundling would lose them.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  worker: { format: 'es' },
  server: { port: 8000, strictPort: true },
  preview: { port: 8000, strictPort: true },
  build: {
    outDir: mode === 'mock' ? 'dist-mock' : 'dist',
    rollupOptions: {
      output: {
        manualChunks: { supabase: ['@supabase/supabase-js'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
}))
