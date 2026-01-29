import { test, expect, request } from '@playwright/test';
import fs from 'fs';
import dotenv from 'dotenv';

// Added functions directly in the file
function generateUniqueTitle(baseTitle: string): string {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `${baseTitle} ${timestamp}-${random}`;
}

function loadAuthToken(): string {
  try {
    const tokenData = JSON.parse(fs.readFileSync('playwright/.auth/token.json', 'utf8'));
    return tokenData.token;
  } catch (error) {
    throw new Error('Authentication token not found. Run AuthSetup first.');
  }
}

interface ToDoItem {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
}

dotenv.config();

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL is not defined in environment variables');
}

let apiContext: any;
let authToken: string;
let createdItemId: number;

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

// Global variables for unique titles
let uniqueCreateTitle: string;
let uniqueUpdateTitle: string;

test.describe.configure({ mode: 'serial' });
test.describe('ToDoItem API Crud Flow', () => {
  test.beforeAll(async () => {
    // Using the function to load auth token
    authToken = loadAuthToken();
    console.log('Using saved authentication token');

    apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      baseURL: BASE_URL
    });

    // Generate unique titles
    uniqueCreateTitle = generateUniqueTitle('Song is fun but i want to dance');
    uniqueUpdateTitle = generateUniqueTitle('Song is fun but I want to dance MORE');
    
    console.log('Unique create title:', uniqueCreateTitle);
    console.log('Unique update title:', uniqueUpdateTitle);
  });

  test('CREATE new ToDo item', async () => {
  const payload = {
    title: uniqueCreateTitle,
    description: 'Learn to dance and sing',
    isCompleted: false
  };

  // Sending POST request to create ToDo item
  const response = await test.step('Send POST request to create ToDo item', async () => {
    return await apiContext.post('/api/ToDoItems', {
      data: payload,
      headers: getAuthHeaders()
    });
  });

  // Validation of response status
  await test.step('Verify response status is 201 Created', async () => {
    expect(response.status()).toBe(201);
  });

  // Check response body and store created ID
  await test.step('Validate response body and store created ID', async () => {
    const responseBody: ToDoItem = await response.json();

    expect(responseBody.id).toBeDefined();
    expect(responseBody.title).toBe(payload.title);
    
    // Save created item ID for later tests
    createdItemId = responseBody.id;
  });
});

  test('GET all ToDo items for authenticated user', async () => {
  // Fetch the list from API
  const response = await test.step('Send GET request to fetch all ToDo items', async () => {
    return await apiContext.get('/api/ToDoItems', {
      headers: getAuthHeaders()
    });
  });

  // Validate the response status
  await test.step('Verify response status is 200 OK', async () => {
    expect(response.status()).toBe(200);
  });

  // Parse and validate the data structure
  const items: ToDoItem[] = await test.step('Parse response and verify it is an array', async () => {
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    return data;
  });

  // Ensure our specific item exists in the collection
  await test.step('Search for the previously created item in the list', async () => {
    const ourItem = items.find(item => item.id === createdItemId);
    
    // Assert that the item exists and its title matches
    expect(ourItem).toBeDefined();
    expect(ourItem?.title).toBe(uniqueCreateTitle);
  });
});

  test('GET ToDo item by ID', async () => {
  // Request the specific item using the ID from the creation step
  const response = await test.step('Send GET request for a specific ToDo item by ID', async () => {
    return await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });
  });

  // Ensure the item was found successfully
  await test.step('Verify response status is 200 OK', async () => {
    expect(response.status()).toBe(200);
  });

  // Validate that the returned item matches our expectations
  await test.step('Verify the item data matches the created item', async () => {
    const item: ToDoItem = await response.json();
    
    // Check both ID and Title to ensure data integrity
    expect(item.id).toBe(createdItemId);
    expect(item.title).toBe(uniqueCreateTitle);
  });
});

 test('UPDATE ToDo item', async () => {
  let currentItem: ToDoItem;

  // Get the current state of the item
  await test.step('Fetch current item state before update', async () => {
    const getResponse = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });
    expect(getResponse.status()).toBe(200);
    currentItem = await getResponse.json();
  });

  // Prepare the update data
  const updatePayload = {
    title: uniqueUpdateTitle,
    description: 'Learn to dance and sing even better',
    isCompleted: !currentItem!.isCompleted // Toggles the current completion status
  };

  // Perform the update
  const response = await test.step('Send PUT request to update the item', async () => {
    return await apiContext.put(`/api/ToDoItems/${createdItemId}`, {
      data: updatePayload,
      headers: getAuthHeaders()
    });
  });

  // Validate the update was successful
  await test.step('Verify response status and updated data integrity', async () => {
    // If this fails, Playwright automatically logs the error body
    expect(response.status()).toBe(200);

    const updatedItem: ToDoItem = await response.json();

    expect(updatedItem.id).toBe(createdItemId);
    expect(updatedItem.title).toBe(updatePayload.title);
    expect(updatedItem.description).toBe(updatePayload.description);
    expect(updatedItem.isCompleted).toBe(updatePayload.isCompleted);
  });
});

 test('SEARCH ToDo items - should find our created item', async () => {
  const searchTerm = 'Song';
  let items: ToDoItem[];

  // Execute search via API
  const response = await test.step('Perform search by title using query parameters', async () => {
    return await apiContext.get('/api/ToDoItems/search', {
      headers: getAuthHeaders(),
      params: { Title: searchTerm }
    });
  });

  // Validate API availability
  await test.step('Verify search response status is 200 OK', async () => {
    expect(response.status()).toBe(200);
  });

  // Analyze search results
  await test.step('Verify that our created item is present in search results', async () => {
    items = await response.json();
    
    // Find the specific item we created earlier in the serial flow
    const foundItem = items.find(item => item.id === createdItemId);
    
    // Assertions replace console.log - they provide "proof" of success
    expect(foundItem).toBeDefined();
    expect(foundItem?.title).toContain(searchTerm);
  });
});

  test('DELETE ToDo item', async () => {
  // Ensure we have a valid ID to delete
  await test.step('Check if createdItemId is available', async () => {
    expect(createdItemId).toBeDefined();
  });

  // Execute the DELETE request
  const deleteResponse = await test.step('Send DELETE request to remove the item', async () => {
    return await apiContext.delete(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });
  });

  // Validate successful deletion status
  await test.step('Verify deletion status code (200 or 204)', async () => {
    // Some APIs return 200 OK, others 204 No Content
    expect([200, 204]).toContain(deleteResponse.status());
  });

  // Final verification - try to fetch the deleted item
  await test.step('Confirm item no longer exists (expecting 404)', async () => {
    const getResponse = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });

    // If the API returns 200 here, it means the item wasn't actually deleted
    expect(getResponse.status()).toBe(404);
  });
});

  test.afterAll(async () => {
  // Check if apiContext exists before attempting to close it
  if (apiContext) {
    // Dispose the context to clean up memory and close any open connections
    await apiContext.dispose();
  }
});
});