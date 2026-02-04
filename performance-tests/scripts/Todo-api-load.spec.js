import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export const options = {
    stages: [
        { duration: '20s', target: 100 },
        { duration: '40s', target: 100 },
        { duration: '20s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
    },
};

// 2. Costant values
const BASE_URL = 'https://localhost:7101';

export function setup() {
    const loginUrl = `${BASE_URL}/api/Auth/login`; 
    const payload = JSON.stringify({
        email: 'user@example.com',
        password: 'User123!'
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(loginUrl, payload, params);

    return { authToken: res.json().token };
}

export default function (data) {
    if (!data.authToken) return;

    const url = `${BASE_URL}/api/ToDoItems`;
    const params = {
        headers: {
            'Authorization': `Bearer ${data.authToken}`,
            'Content-Type': 'application/json',
        },
    };

    const res = http.get(url, params);
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(1); 
}
export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
  };
}