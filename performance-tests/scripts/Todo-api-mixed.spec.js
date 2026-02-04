import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export const options = {
    scenarios: {
        readers: {
            executor: 'constant-vus',
            vus: 15, // 15 users wich continuously read items
            duration: '1m', // test duration
            exec: 'viewAction', // function to execute
        },
        writers: {
            executor: 'constant-vus',
            vus: 5, // 5 users wich continuously create items
            duration: '1m', // test duration
            exec: 'createAction', // function to execute
        },
    },
    thresholds: {
        // Tolerance for 95% of requests to complete within 500ms
        http_req_duration: ['p(95)<500'],
    },
};

const BASE_URL = 'https://localhost:7101';

export function setup() {
    const res = http.post(`${BASE_URL}/api/Auth/login`, JSON.stringify({
        email: 'user@example.com',
        password: 'User123!'
    }), { headers: { 'Content-Type': 'application/json' } });

    if (res.status !== 200) {
        console.error('Login nije uspeo! Proveri kredencijale.');
        return { token: null };
    }
    return { token: res.json().token };
}

// Action for "readers" scenario (GET requests)
export function viewAction(data) {
    if (!data.token) return;
    
    const params = { headers: { 'Authorization': `Bearer ${data.token}` } };
    const res = http.get(`${BASE_URL}/api/ToDoItems`, params);
    
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(1);
}

// Action for "writers" scenario (POST requests)
export function createAction(data) {
    if (!data.token) return;

    const params = { 
        headers: { 
            'Authorization': `Bearer ${data.token}`,
            'Content-Type': 'application/json' 
        } 
    };

    // Generating a unique title for each ToDo item
    // Comabing timestamp and random number for uniqueness
    const randomId = Math.floor(Math.random() * 1000);
    const body = JSON.stringify({ 
        Title: `Zadatak-${Date.now()}-${randomId}`, 
        Description: "Load test sa unikatnim naslovom",
        IsCompleted: false 
    });

    const res = http.post(`${BASE_URL}/api/ToDoItems`, body, params);

    // Check if creation was successful (201 Created or 200 OK)
    check(res, { 
        'created 201 or 200': (r) => r.status === 201 || r.status === 200 
    });
    
    sleep(2);
}

export function handleSummary(data) {
    return { "summary-mixed.html": htmlReport(data) };
}