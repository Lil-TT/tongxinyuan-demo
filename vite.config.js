import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 将公共基础路径设置为相对路径
  build: {
    outDir: 'dist', // 打包输出的目录名称
  }
});