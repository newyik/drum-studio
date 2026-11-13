import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { teacherAuth } from './teacher-auth.mjs';

export default defineConfig(({ mode }) => ({
  plugins: [react(), teacherAuth(loadEnv(mode, '.', 'DRUM_'))],
  base: './',
}));
