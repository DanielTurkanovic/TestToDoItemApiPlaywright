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

    console.log('Creating item with unique title:', payload.title);

    const response = await apiContext.post('/api/ToDoItems', {
      data: payload,
      headers: getAuthHeaders()
    });

    expect(response.status()).toBe(201);
    const responseBody: ToDoItem = await response.json();

    expect(responseBody.id).toBeDefined();
    expect(responseBody.title).toBe(payload.title);

    createdItemId = responseBody.id;
    console.log('CREATE - Item created with ID:', createdItemId);
  });

  test('GET all ToDo items for authenticated user', async () => {
    const response = await apiContext.get('/api/ToDoItems', {
      headers: getAuthHeaders()
    });

    expect(response.status()).toBe(200);
    const items: ToDoItem[] = await response.json();
    expect(Array.isArray(items)).toBe(true);

    // Check that our created item is in the list
    const ourItem = items.find(item => item.id === createdItemId);
    expect(ourItem).toBeDefined();
    expect(ourItem?.title).toBe(uniqueCreateTitle);
    console.log('GET ALL - Our created item found in list');
  });

  test('GET ToDo item by ID', async () => {
    const response = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });

    expect(response.status()).toBe(200);

    const item: ToDoItem = await response.json();
    expect(item.id).toBe(createdItemId);
    expect(item.title).toBe(uniqueCreateTitle);
    console.log('GET by ID works, item title:', item.title);
  });

  test('UPDATE ToDo item', async () => {
    console.log('UPDATE test - Using our created item ID:', createdItemId);

    // First, get the current state of the item
    const getResponse = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });

    expect(getResponse.status()).toBe(200);
    const currentItem: ToDoItem = await getResponse.json();
    console.log('Current item title:', currentItem.title);

    const updatePayload = {
      title: uniqueUpdateTitle,
      description: 'Learn to dance and sing even better',
      isCompleted: !currentItem.isCompleted
    };

    console.log('Updating with unique title:', updatePayload.title);

    const response = await apiContext.put(`/api/ToDoItems/${createdItemId}`, {
      data: updatePayload,
      headers: getAuthHeaders()
    });

    console.log('UPDATE response status:', response.status());
    
    if (response.status() !== 200) {
      const errorBody = await response.text();
      console.log('UPDATE error response:', errorBody);
    }

    expect(response.status()).toBe(200);

    const updatedItem: ToDoItem = await response.json();

    expect(updatedItem.id).toBe(createdItemId);
    expect(updatedItem.title).toBe(updatePayload.title);
    expect(updatedItem.description).toBe(updatePayload.description);
    expect(updatedItem.isCompleted).toBe(updatePayload.isCompleted);

    console.log('UPDATE successful!');
    console.log('New title:', updatedItem.title);
  });

  test('SEARCH ToDo items - should find our created item', async () => {
    const searchTerm = 'Song';
    
    const response = await apiContext.get('/api/ToDoItems/search', {
      headers: getAuthHeaders(),
      params: { Title: searchTerm }
    });

    expect(response.status()).toBe(200);
    
    const items: ToDoItem[] = await response.json();
    
    // Check that our created item is in the search results
    const foundItem = items.find(item => item.id === createdItemId);
    expect(foundItem).toBeDefined();
    expect(foundItem?.title).toContain(searchTerm);
    console.log('SEARCH - Found our item with title:', foundItem?.title);
  });

  test('DELETE ToDo item', async () => {
    expect(createdItemId).toBeDefined();
    console.log('Deleting our created item, ID:', createdItemId);

    const deleteResponse = await apiContext.delete(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });

    console.log('DELETE status:', deleteResponse.status());
    expect([200, 204]).toContain(deleteResponse.status());

    // Verify that the item no longer exists
    const getResponse = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
      headers: getAuthHeaders()
    });

    expect(getResponse.status()).toBe(404);
    console.log('Item successfully deleted and verified!');
  });

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
      console.log('API context disposed for CRUD suite');
    }
  });
});