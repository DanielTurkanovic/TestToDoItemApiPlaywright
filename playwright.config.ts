import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://localhost:7101';

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['dot']
  ],
  timeout: 30000,
  expect: {
    timeout: 5000
  },

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/AuthSetup.spec.ts',
      workers: 1,  
    },
    {
      name: 'ToDoItem CRUD Flow',
      dependencies: ['setup'],
      testMatch: '**/ToDoItemCrudFlow.spec.ts',
      workers: 1,  
    },
    {
      name: 'ToDoItem Negative tests',  
      dependencies: ['setup'],
      testMatch: '**/ToDoItemNegative.spec.ts',
      workers: 4,
    }
  ]
});