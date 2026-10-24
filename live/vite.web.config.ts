import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'web',base:'/PokerTracker/',plugins:[react()],build:{outDir:'../web-dist',emptyOutDir:true}});
