import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React bundle
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          
          // Firebase bundle
          if (id.includes('node_modules/firebase/') || 
              id.includes('node_modules/@firebase/')) {
            return 'vendor-firebase';
          }
          
          // Radix UI components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }
          
          // Framer motion
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-ui';
          }
          
          // Lucide icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          
          // Workflow/automation (XYFlow/ReactFlow, dagre)
          if (id.includes('node_modules/reactflow/') || 
              id.includes('node_modules/@reactflow/') ||
              id.includes('node_modules/@xyflow/') ||
              id.includes('node_modules/dagre/')) {
            return 'vendor-workflow';
          }
          
          // Automation services only
          if (id.includes('/src/services/automation/')) {
            return 'feature-automation';
          }
          
          // Workforce services (not components to avoid circular deps)
          if (id.includes('/src/services/workforce/')) {
            return 'feature-workforce-services';
          }
        },
      },
    },
    
    // Chunk size warnings - raise limit slightly for main bundle
    chunkSizeWarningLimit: 600,
    
    // Minification
    minify: 'esbuild',
    
    // Target modern browsers for smaller bundles
    target: 'esnext',
    
    // Source maps for production debugging
    sourcemap: false,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'framer-motion',
      'lucide-react',
    ],
  },
  
  // Preview server config
  preview: {
    port: 5173,
  },
  
  // Dev server config
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
