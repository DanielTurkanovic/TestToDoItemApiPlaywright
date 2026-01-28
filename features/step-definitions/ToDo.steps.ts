import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect, request, APIRequestContext, APIResponse } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Improved function for generating unique titles
function generateUniqueTitle(baseTitle: string): string {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `${baseTitle} ${timestamp}-${random}`;
}

// Improved function for loading auth token
function loadAuthToken(): string {
  const authPath = path.join(process.cwd(), 'playwright', '.auth', 'token.json');
  
  try {
    if (!fs.existsSync(authPath)) {
      throw new Error(`Auth file not found at: ${authPath}`);
    }
    
    const tokenData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    
    if (!tokenData.token) {
      throw new Error('Token not found in auth file');
    }
    
    return tokenData.token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Authentication token not found. Run AuthSetup first. Details: ${errorMessage}`);
  }
}

// Interface for ToDoItem
interface ToDoItem {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
}

dotenv.config();

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL environment variable is not set');
}

let apiContext: APIRequestContext;
let authToken: string;
let createdItemId: number;
let response: APIResponse;
let items: ToDoItem[];

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
}

Before(async function() {
  authToken = loadAuthToken();
  
  apiContext = await request.newContext({
    ignoreHTTPSErrors: true,
    baseURL: BASE_URL
  });
});

After(async function() {
  const cleanupErrors: string[] = [];
  
  if (createdItemId) {
    try {
      await apiContext.delete(`/api/ToDoItems/${createdItemId}`, {
        headers: getAuthHeaders()
      });
    } catch (error) {
      const errorMsg = `Cleanup failed for item: ${createdItemId}`;
      cleanupErrors.push(errorMsg);
    }
  }
  
  if (apiContext) {
    await apiContext.dispose();
  }
  
  // Attach cleanup results to Cucumber world for better reporting
  if (cleanupErrors.length > 0) {
    console.warn('Cleanup warnings:', cleanupErrors);
  }
});

// Step Definitions

Given('I am an authenticated user', function() {
  expect(authToken).toBeDefined();
});

Given('I have an existing ToDo item', async function() {
  const uniqueTitle = generateUniqueTitle('Test Item for Gherkin');
  const payload = {
    title: uniqueTitle,
    description: 'This item was created for Gherkin testing',
    isCompleted: false
  };
  
  const response = await apiContext.post('/api/ToDoItems', {
    data: payload,
    headers: getAuthHeaders()
  });

  expect(response.status()).toBe(201);
  const responseBody = await response.json();
  createdItemId = responseBody.id;
});

Given('I have multiple ToDo items', async function() {
  const testItems = [
    { 
      title: generateUniqueTitle('Learn Playwright with Gherkin'), 
      description: 'BDD testing', 
      isCompleted: false 
    },
    { 
      title: generateUniqueTitle('Practice BDD'), 
      description: 'Behavior Driven Development', 
      isCompleted: true 
    },
    { 
      title: generateUniqueTitle('API Automation'), 
      description: 'REST API testing', 
      isCompleted: false 
    }
  ];

  for (const item of testItems) {
    const response = await apiContext.post('/api/ToDoItems', {
      data: item,
      headers: getAuthHeaders()
    });
    expect(response.status()).toBe(201);
  }
});

When('I create a new ToDo item with title {string} and description {string}', 
async function(title: string, description: string) {
  const uniqueTitle = generateUniqueTitle(title);
  const payload = {
    title: uniqueTitle,
    description: description,
    isCompleted: false
  };
  
  response = await apiContext.post('/api/ToDoItems', {
    data: payload,
    headers: getAuthHeaders()
  });
});

When('I update the item title to {string} and mark it as completed', 
async function(newTitle: string) {
  const uniqueTitle = generateUniqueTitle(newTitle);
  const updatePayload = {
    title: uniqueTitle,
    description: 'Updated via Gherkin test',
    isCompleted: true
  };

  response = await apiContext.put(`/api/ToDoItems/${createdItemId}`, {
    data: updatePayload,
    headers: getAuthHeaders()
  });
});

When('I search for items with term {string}', async function(searchTerm: string) {
  response = await apiContext.get('/api/ToDoItems/search', {
    headers: getAuthHeaders(),
    params: { Title: searchTerm }
  });
  
  items = await response.json();
});

When('I get the item by ID', async function() {
  response = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
    headers: getAuthHeaders()
  });
});

Then('the item should be created successfully', async function() {
  expect(response.status()).toBe(201);
  const responseBody = await response.json();
  createdItemId = responseBody.id;
  expect(createdItemId).toBeDefined();
});

Then('I should be able to find it in my ToDo list', async function() {
  const getResponse = await apiContext.get('/api/ToDoItems', {
    headers: getAuthHeaders()
  });
  
  expect(getResponse.status()).toBe(200);
  const allItems = await getResponse.json();
  const foundItem = allItems.find((item: ToDoItem) => item.id === createdItemId);
  expect(foundItem).toBeDefined();
});

Then('the item should be updated successfully', function() {
  expect(response.status()).toBe(200);
});

Then('the changes should be reflected in the system', async function() {
  const getResponse = await apiContext.get(`/api/ToDoItems/${createdItemId}`, {
    headers: getAuthHeaders()
  });
  
  expect(getResponse.status()).toBe(200);
  const updatedItem = await getResponse.json();
  expect(updatedItem.isCompleted).toBe(true);
});

Then('I should see relevant search results', function() {
  expect(response.status()).toBe(200);
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);
  
  const hasRelevantResult = items.some((item: ToDoItem) => 
    item.title.toLowerCase().includes('playwright')
  );
  expect(hasRelevantResult).toBe(true);
});

Then('the response status should be {int}', function(expectedStatus: number) {
  expect(response.status()).toBe(expectedStatus);
});

Then('the item should have title {string}', async function(expectedTitle: string) {
  const item = await response.json();
  expect(item.title).toContain(expectedTitle);
});