import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './', // 将公共基础路径设置为相对路径
  build: {
    outDir: 'dist', // 打包输出的目录名称
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        products: path.resolve(__dirname, 'products.html'),
        careers: path.resolve(__dirname, 'careers.html'),
        news: path.resolve(__dirname, 'news.html'),
        contact: path.resolve(__dirname, 'contact.html'),
      },
    },
  },
  server: {
    // 本地开发时把同源 /api/* 转发到线上，避免浏览器 CORS（见 news_script 中 dev 基址回落）
    proxy: {
      '/api': {
        target: 'https://eutronsense.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});