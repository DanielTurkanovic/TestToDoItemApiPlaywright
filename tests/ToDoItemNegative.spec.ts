import { test, expect, request } from '@playwright/test';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL is not defined in environment variables');
}

let apiContext: any;
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
      console.log('Using saved authentication token for negative tests');
    } catch (error) {
      throw new Error('Authentication token not found. Run AuthSetup first.');
    }

    apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      baseURL: BASE_URL
    });
  });

  test('CREATE with invalid data - empty title should return 400', async () => {
    const invalidPayload = {
      title: '', // Empty title to trigger validation error
      description: 'Valid description',
      isCompleted: false
    };

    const response = await apiContext.post('/api/ToDoItems', {
      data: invalidPayload,
      headers: getAuthHeaders()
    });

    expect(response.status()).toBe(400);
    console.log('CREATE with empty title properly returns 400');
  });

  test('GET non-existent item should return 404', async () => {
    const nonExistentId = 999999; // ID that does not exist
    
    const response = await apiContext.get(`/api/ToDoItems/${nonExistentId}`, {
      headers: getAuthHeaders()
    });

    expect(response.status()).toBe(404);
    console.log('GET non-existent item properly returns 404');

    // Check if the response contains an error message
    if (response.status() === 404) {
      try {
        const errorBody = await response.json();
        console.log('Not found response:', errorBody);
      } catch {
        const errorText = await response.text();
        console.log('Not found response:', errorText);
      }
    }
  });

  test('GET without authentication token should return 401', async () => {
  const response = await apiContext.get('/api/ToDoItems', {
    headers: {
      'Content-Type': 'application/json'
      // No Authorization header!
    }
  });

  expect(response.status()).toBe(401);
  console.log('GET without authentication properly returns 401');

  if (response.status() === 401) {
    try {
      const errorBody = await response.json();
      console.log('Unauthorized response:', errorBody);
    } catch {
      const errorText = await response.text();
      console.log('Unauthorized response:', errorText);
    }
  }
});

test('UPDATE non-existent item should return 404', async () => {
  const nonExistentId = 888888; // ID that does not exist
  
  const updatePayload = {
    title: 'Trying to update non-existent item',
    description: 'This should fail',
    isCompleted: true
  };

  const response = await apiContext.put(`/api/ToDoItems/${nonExistentId}`, {
    data: updatePayload,
    headers: getAuthHeaders()
  });

  expect(response.status()).toBe(404);
  console.log('UPDATE non-existent item properly returns 404');

  if (response.status() === 404) {
    try {
      const errorBody = await response.json();
      console.log('Update not found response:', errorBody);
    } catch {
      const errorText = await response.text();
      console.log('Update not found response:', errorText);
    }
  }
});

test('SQL injection should not break API', async () => {
  const response = await apiContext.post('/api/ToDoItems', {
    data: {
      title: "Test'; DROP TABLE ToDoItems; --",
      description: "SQL injection test",
      isCompleted: false
    },
    headers: getAuthHeaders()
  });

  // API should not return 500 error
  expect(response.status()).not.toBe(500);
  console.log(`SQL injection handled with status: ${response.status()}`);
});

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
      console.log('API context disposed for negative tests');
    }
  });
});