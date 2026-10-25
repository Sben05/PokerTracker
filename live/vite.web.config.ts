import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'web',publicDir:'../public',base:'/',plugins:[react()],build:{outDir:'../web-dist',emptyOutDir:true}});
