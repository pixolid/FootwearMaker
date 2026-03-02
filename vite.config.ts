import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Sub-path where the app is served (must match Next.js rewrite source)
  base: '/FootwearMaker/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Expose both VITE_ (standard) and NEXT_PUBLIC_ (copied from Pixogen) prefixes
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    host: true,
    allowedHosts: true,
  },
})
