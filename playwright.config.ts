import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './browser-tests',
  use: {
    baseURL: 'http://127.0.0.1:3197',
    viewport: { width: 1000, height: 700 },
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  webServer: {
    command: 'node browser-tests/server.mjs',
    url: 'http://127.0.0.1:3197',
    reuseExistingServer: false,
  },
})
