import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 請填入你的 Repo 名稱，前後都要有斜線
  base: '/2xetf-strategy-compare/', 
})