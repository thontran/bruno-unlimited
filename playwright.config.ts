import { defineConfig } from '@playwright/test';

const reporter: any[] = [['list'], ['html'], ['json', { outputFile: 'playwright-report/results.json' }]];

if (process.env.CI) {
  reporter.push(['github']);
  // Blob reports are mergeable across shards (see tests-linux.yml e2e-test-report).
  reporter.push(['blob']);
}

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Unset = one worker per core. Each worker launches a full Electron app, so on a small CI
  // runner (or a busy laptop) that starves them into spurious step timeouts — cap it with
  // PLAYWRIGHT_WORKERS, or `--workers=1` locally.
  workers: process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : undefined,
  reporter,

  use: {
    trace: process.env.CI ? 'on-first-retry' : 'on'
  },

  projects: [
    {
      name: 'default',
      testDir: './tests',
      testIgnore: [
        'ssl/**', // custom CA certificate tests require separate server setup and certificate generation
        'auth/**', // auth tests have their own project
        'benchmarks/**',
        'proxy/system-pac/**', // shares ports with proxy/pac — runs in its own project after default
        'mock-server/**' // own project; workerIndex ports + per-worker Electron state
      ]
    },
    {
      name: 'auth',
      testDir: './tests/auth'
    },
    {
      name: 'ssl',
      testDir: './tests/ssl'
    },
    {
      // system-pac and pac specs share the same PAC/proxy/target ports.
      name: 'system-pac',
      testDir: './tests/proxy/system-pac',
    },
    {
      name: 'mock-server',
      testDir: './tests/mock-server'
    }
  ],

  webServer: [
    {
      command: 'npm run dev:web',
      stdout: 'pipe', 
      wait: { stdout: /ready\s+built in/i },
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 60 * 1000
    },
    {
      command: 'npm start --workspace=packages/bruno-tests',
      url: 'http://localhost:8081/ping',
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 60 * 1000
    }
  ]
});
