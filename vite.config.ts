import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { fileUploadPlugin } from './src/server/fileUpload'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    fileUploadPlugin()  // 添加文件上传插件
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    host: '0.0.0.0',  // 监听所有网络接口
    port: 5173,
    proxy: {
      // 代理 OnlyOffice 请求，避免 CORS 问题
      '/onlyoffice': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onlyoffice/, '')
      }
    }
  }
})
