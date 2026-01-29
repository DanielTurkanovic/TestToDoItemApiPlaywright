import { Given, When, Then, Before, After, setWorldConstructor } from '@cucumber/cucumber';
import { expect, request, APIRequestContext, APIResponse } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL environment variable is not set');
}

// Interfaces 

interface ToDoItem {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
}

// Helper functions 

function generateUniqueTitle(baseTitle: string): string {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `${baseTitle} ${timestamp}-${random}`;
}

function loadAuthToken(): string {
  const authPath = path.join(process.cwd(), 'playwright', '.auth', 'token.json');

  if (!fs.existsSync(authPath)) {
    throw new Error(`Auth file not found at: ${authPath}`);
  }

  const tokenData = JSON.parse(fs.readFileSync(authPath, 'utf8'));

  if (!tokenData.token) {
    throw new Error('Token not found in auth file');
  }

  return tokenData.token;
}

function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// World 

class CustomWorld {
  apiContext!: APIRequestContext;
  authToken!: string;
  createdItemId?: number;
  response?: APIResponse;
  items?: ToDoItem[];

  async init() {
    this.authToken = loadAuthToken();
    this.apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      baseURL: BASE_URL
    });
  }

  async dispose() {
    if (this.createdItemId) {
      try {
        await this.apiContext.delete(`/api/ToDoItems/${this.createdItemId}`, {
          headers: getAuthHeaders(this.authToken)
        });
      } catch {
        // ignore cleanup errors
      }
    }
    await this.apiContext.dispose();
  }
}

setWorldConstructor(CustomWorld);

// Hooks 

Before(async function(this: CustomWorld) {
  await this.init();
});

After(async function(this: CustomWorld) {
  await this.dispose();
});

// Step Definitions 

Given('I am an authenticated user', function(this: CustomWorld) {
  expect(this.authToken).toBeDefined();
});

Given('I have an existing ToDo item', async function(this: CustomWorld) {
  const payload = {
    title: generateUniqueTitle('Test Item for Gherkin'),
    description: 'This item was created for Gherkin testing',
    isCompleted: false
  };

  const res = await this.apiContext.post('/api/ToDoItems', {
    data: payload,
    headers: getAuthHeaders(this.authToken)
  });

  expect(res.status()).toBe(201);
  const body: ToDoItem = await res.json();
  this.createdItemId = body.id;
});

Given('I have multiple ToDo items', async function(this: CustomWorld) {
  const testItems: Omit<ToDoItem, 'id'>[] = [
    { title: generateUniqueTitle('Learn Playwright with Gherkin'), description: 'BDD testing', isCompleted: false },
    { title: generateUniqueTitle('Practice BDD'), description: 'Behavior Driven Development', isCompleted: true },
    { title: generateUniqueTitle('API Automation'), description: 'REST API testing', isCompleted: false }
  ];

  for (const item of testItems) {
    const res = await this.apiContext.post('/api/ToDoItems', {
      data: item,
      headers: getAuthHeaders(this.authToken)
    });
    expect(res.status()).toBe(201);
  }
});

When('I create a new ToDo item with title {string} and description {string}', async function(this: CustomWorld, title: string, description: string) {
  const payload = { title: generateUniqueTitle(title), description, isCompleted: false };
  this.response = await this.apiContext.post('/api/ToDoItems', { data: payload, headers: getAuthHeaders(this.authToken) });
});

When('I update the item title to {string} and mark it as completed', async function(this: CustomWorld, newTitle: string) {
  const payload = { title: generateUniqueTitle(newTitle), description: 'Updated via Gherkin test', isCompleted: true };
  this.response = await this.apiContext.put(`/api/ToDoItems/${this.createdItemId}`, { data: payload, headers: getAuthHeaders(this.authToken) });
});

When('I search for items with term {string}', async function(this: CustomWorld, searchTerm: string) {
  this.response = await this.apiContext.get('/api/ToDoItems/search', {
    headers: getAuthHeaders(this.authToken),
    params: { Title: searchTerm }
  });
  this.items = await this.response.json() as ToDoItem[];
});

When('I get the item by ID', async function(this: CustomWorld) {
  this.response = await this.apiContext.get(`/api/ToDoItems/${this.createdItemId}`, { headers: getAuthHeaders(this.authToken) });
});

Then('the item should be created successfully', async function(this: CustomWorld) {
  expect(this.response?.status()).toBe(201);
  const body: ToDoItem = await this.response?.json();
  this.createdItemId = body.id;
  expect(this.createdItemId).toBeDefined();
});

Then('I should be able to find it in my ToDo list', async function(this: CustomWorld) {
  const getRes = await this.apiContext.get('/api/ToDoItems', { headers: getAuthHeaders(this.authToken) });
  expect(getRes.status()).toBe(200);
  const allItems: ToDoItem[] = await getRes.json();
  const found = allItems.find((item: ToDoItem) => item.id === this.createdItemId);
  expect(found).toBeDefined();
});

Then('the item should be updated successfully', function(this: CustomWorld) {
  expect(this.response?.status()).toBe(200);
});

Then('the changes should be reflected in the system', async function(this: CustomWorld) {
  const getRes = await this.apiContext.get(`/api/ToDoItems/${this.createdItemId}`, { headers: getAuthHeaders(this.authToken) });
  expect(getRes.status()).toBe(200);
  const updated: ToDoItem = await getRes.json();
  expect(updated.isCompleted).toBe(true);
});

Then('I should see relevant search results', function(this: CustomWorld) {
  expect(this.response?.status()).toBe(200);
  expect(Array.isArray(this.items)).toBe(true);
  expect(this.items!.length).toBeGreaterThan(0);
  const hasRelevant = this.items!.some((item: ToDoItem) => item.title.toLowerCase().includes('playwright'));
  expect(hasRelevant).toBe(true);
});

Then('the response status should be {int}', function(this: CustomWorld, expectedStatus: number) {
  expect(this.response?.status()).toBe(expectedStatus);
});

Then('the item should have title {string}', async function(this: CustomWorld, expectedTitle: string) {
  const item: ToDoItem = await this.response?.json();
  expect(item.title).toContain(expectedTitle);
});
