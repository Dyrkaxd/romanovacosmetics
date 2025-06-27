import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env variables based on mode (development, production)
    // This makes .env variables available via import.meta.env
    // For process.env, we need to define them specifically if used in client-side code
    // that's not processed by Node.js (like services/supabaseClient.ts if it were client-side only)
    // However, services/supabaseClient.ts is used by Netlify Functions (Node.js context there)
    // AND potentially could be imported by frontend. Vite's `process.env` replacement is usually for `import.meta.env`.
    // We will prefix with VITE_ for client-side exposure.
    // Netlify functions will use actual environment variables set in Netlify UI.
    const env = loadEnv(mode, __dirname, ''); 

    return {
      define: {
        // This makes SUPABASE_URL and SUPABASE_ANON_KEY available as process.env.SUPABASE_URL in your client-side code
        // Ensure these are also set in your Netlify build environment if your client directly uses them.
        // For Netlify functions, they will pick up env vars directly from the Netlify environment.
        // If supabaseClient.ts is ONLY used by functions, this define block for it isn't strictly needed for it.
        // But if any frontend code were to import supabaseClient directly, it would be.
        // Let's assume supabaseClient.ts might be imported by frontend for other utilities in future.
         'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
         'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY),
         // Keep other process.env definitions if you have them, e.g. for API_KEY if used elsewhere
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Proxy API requests to Netlify Functions during development
      server: {
        proxy: {
          '/api': {
            target: 'http://localhost:8888', // Default port for Netlify Dev
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, '/.netlify/functions'),
          },
        },
      },
    };
});
