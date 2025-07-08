import path from 'path';
import { defineConfig } from 'vite'; // loadEnv már nem szükséges, ha nem használod direktben

export default defineConfig(() => { // a 'mode' paraméter sem kell feltétlenül, ha nem használod a loadEnv-et
    return {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});