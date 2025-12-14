import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        base: '/',
        resolve: {
            alias: {
                '@': path.resolve(process.cwd(), './'),
            }
        },
        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        build: {
            chunkSizeWarningLimit: 1000
        }
    };
});
