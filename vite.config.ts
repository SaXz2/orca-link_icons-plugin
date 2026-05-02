import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(
          command === 'build' ? 'production' : 'development',
        ),
      },
    },
    build: {
      lib: {
        entry: 'src/main.ts',
        fileName: 'index',
        formats: ['es'],
      },
      rollupOptions: {
        external: ['valtio'],
      },
    },
  };
});
