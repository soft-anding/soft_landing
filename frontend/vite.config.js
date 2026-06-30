import { defineConfig } from 'vite'
import react from '@vitejs/react-refresh' // או מה שיש לך שם למעלה

export default defineConfig({
  plugins: [react()],
  // לחלק הזה את צריכה לדאוג:
  preview: {
    allowedHosts: true
  }
})