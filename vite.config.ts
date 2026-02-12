import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, proxy /api requests to either:
      // - Firebase emulator (port 5001) if running `firebase emulators:start`
      // - Direct Express server (port 3001) if running `npm run dev` in server/
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
