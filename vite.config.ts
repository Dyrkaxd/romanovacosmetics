import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env variables based on mode (development, production)
    const env = loadEnv(mode, __dirname, ''); 

    return {
      define: {
        // Supabase variables are used server-side in Netlify functions
        // and should not be exposed to the client.
        // Keep other process.env definitions if you have them.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
    };
});