import { test as setup, expect, request } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
    throw new Error('BASE_URL is not defined in environment variables');
}
const API_EMAIL = process.env.API_EMAIL as string;
const API_PASSWORD = process.env.API_PASSWORD as string;

// Export token to be used in other tests
export let authToken: string;

setup('global authentication setup', async () => {
    console.log('Starting global authentication setup...');

    const apiContext = await request.newContext({ 
        ignoreHTTPSErrors: true,
        baseURL: BASE_URL
    });

    const response = await apiContext.post('/api/Auth/login', {
        data: {
            email: API_EMAIL,
            password: API_PASSWORD
        },
        headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(200);

    const authData = await response.json();

    if (!authData.token) {
        throw new Error('No authentication token received from login response');
    }

    authToken = authData.token;

    // Ensure the .auth directory exists
    const authDir = 'playwright/.auth';
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Save token to a file for other tests to use
    fs.writeFileSync('playwright/.auth/token.json', JSON.stringify({ token: authToken }));

    console.log('Global authentication setup completed. Token saved:', authToken.substring(0, 20) + '...');
    await apiContext.dispose();
});

