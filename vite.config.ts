import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  base: '/FootwearMaker/',
  },
  // Expose both VITE_ (standard) and NEXT_PUBLIC_ (copied from Pixogen) prefixes
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // remove below after tested online with ngrok
  server: {
    host: true,
    allowedHosts: true
  }
})
