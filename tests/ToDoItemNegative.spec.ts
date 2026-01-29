import { test, expect, request, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Prevents the suite from running with invalid config.
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL is not defined in environment variables');
}

let apiContext: APIRequestContext;
let authToken: string;

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

test.describe('ToDoItem API Negative Tests', () => {
  test.beforeAll(async () => {
    // Load authentication token
    try {
      const tokenData = JSON.parse(fs.readFileSync('playwright/.auth/token.json', 'utf8'));
      authToken = tokenData.token;
    } catch (error) {
      throw new Error('Authentication token not found. Run AuthSetup first.');
    }

    apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      baseURL: BASE_URL
    });
  });

  test('CREATE with invalid data - empty title should return 400', async () => {
    const response = await test.step('Send POST with empty title', async () => {
      return await apiContext.post('/api/ToDoItems', {
        data: { title: '', description: 'Valid description', isCompleted: false },
        headers: getAuthHeaders()
      });
    });

    expect(response.status()).toBe(400);
  });

  test('GET non-existent item should return 404', async () => {
    const response = await test.step('Request item with non-existent ID', async () => {
      return await apiContext.get('/api/ToDoItems/999999', {
        headers: getAuthHeaders()
      });
    });

    expect(response.status()).toBe(404);
  });

  test('GET without authentication token should return 401', async () => {
    const response = await test.step('Send request without Auth header', async () => {
      return await apiContext.get('/api/ToDoItems', {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    expect(response.status()).toBe(401);
  });

  test('UPDATE non-existent item should return 404', async () => {
    const response = await test.step('Try to update item 888888', async () => {
      return await apiContext.put('/api/ToDoItems/888888', {
        data: { title: 'Fail', description: 'Fail', isCompleted: true },
        headers: getAuthHeaders()
      });
    });

    expect(response.status()).toBe(404);
  });

  test('SQL injection should not break API', async () => {
    const response = await test.step('Inject SQL string into title', async () => {
      return await apiContext.post('/api/ToDoItems', {
        data: { title: "Test'; DROP TABLE ToDoItems; --", description: "Inject", isCompleted: false },
        headers: getAuthHeaders()
      });
    });

    // We verify the server stays stable (no 500 error)
    expect(response.status()).not.toBe(500);
  });

  test.afterAll(async () => {
    if (apiContext) await apiContext.dispose();
  });
});