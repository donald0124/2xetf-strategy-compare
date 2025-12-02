import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 這裡很重要，讓 Vite 開放在 0.0.0.0，這樣你的手機才連得上 Frontend
    host: '0.0.0.0', 
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001', // 對應剛剛 Python 的 Port
        changeOrigin: true,
        secure: false,
      }
    }
  }
})