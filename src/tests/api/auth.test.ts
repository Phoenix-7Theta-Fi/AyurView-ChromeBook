// Test cases for authentication API endpoints.
// Prerequisites:
// 1. The Next.js application must be running (e.g., `npm run dev` on http://localhost:9002).
// 2. The SQLite database (ayurview.db) must be seeded (e.g., `npm run seed:sqlite`).

// @ts-ignore
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:9002/api/auth';

interface AuthResponse {
    token?: string;
    user?: { id: number | string; name: string; email: string; userType: string };
    message?: string;
    errors?: any[];
}

// Store user details and token from signup to use in login and other tests
let signedUpUser: { id?: number | string; email?: string; token?: string; password?: string } = {};

export async function runAuthTests(): Promise<{ token: string | null; userId: number | string | null }> {
    console.log("\nRunning Authentication API Tests...");
    let successCount = 0;
    let testCount = 0;

    // Generate a unique email for each test run to ensure signup works
    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const userPassword = "password123";

    // Test 1: User Signup
    testCount++;
    console.log("Test 1: User Signup (/signup)");
    try {
        const signupResponse = await fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Test User",
                email: uniqueEmail,
                password: userPassword,
                userType: "regular"
            }),
        });
        const signupData: AuthResponse = await signupResponse.json();
        
        if (signupResponse.status === 201 && signupData.token && signupData.user) {
            console.log("  PASSED: User Signup successful.");
            signedUpUser = { 
                id: signupData.user.id, 
                email: signupData.user.email, 
                token: signupData.token,
                password: userPassword 
            };
            successCount++;
        } else {
            console.error(`  FAILED: User Signup. Status: ${signupResponse.status}, Body: ${JSON.stringify(signupData)}`);
        }
    } catch (error) {
        console.error("  FAILED: User Signup with error:", error);
    }

    // Test 2: User Login
    testCount++;
    console.log("\nTest 2: User Login (/login)");
    if (signedUpUser.email && signedUpUser.password) {
        try {
            const loginResponse = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: signedUpUser.email,
                    password: signedUpUser.password,
                }),
            });
            const loginData: AuthResponse = await loginResponse.json();

            if (loginResponse.status === 200 && loginData.token && loginData.user) {
                console.log("  PASSED: User Login successful.");
                // Update token if it changed, though it shouldn't for the same user immediately after signup
                signedUpUser.token = loginData.token; 
                successCount++;
            } else {
                console.error(`  FAILED: User Login. Status: ${loginResponse.status}, Body: ${JSON.stringify(loginData)}`);
            }
        } catch (error) {
            console.error("  FAILED: User Login with error:", error);
        }
    } else {
        console.error("  SKIPPED: User Login (Signup failed or no email/password captured).");
    }
    
    // Test 3: User Login with incorrect password
    testCount++;
    console.log("\nTest 3: User Login with incorrect password (/login)");
    if (signedUpUser.email) {
        try {
            const loginResponse = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: signedUpUser.email,
                    password: "wrongpassword",
                }),
            });
             const loginData: AuthResponse = await loginResponse.json();

            if (loginResponse.status === 401) { // Expecting Unauthorized
                console.log("  PASSED: User Login with incorrect password correctly failed.");
                successCount++;
            } else {
                console.error(`  FAILED: User Login with incorrect password. Expected 401, Got: ${loginResponse.status}, Body: ${JSON.stringify(loginData)}`);
            }
        } catch (error) {
            console.error("  FAILED: User Login with incorrect password with error:", error);
        }
    } else {
        console.error("  SKIPPED: User Login with incorrect password (Signup failed or no email captured).");
    }


    console.log(`\nAuthentication API Tests Summary: ${successCount}/${testCount} passed.`);
    return { token: signedUpUser.token || null, userId: signedUpUser.id || null };
}
