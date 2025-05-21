// Test cases for practitioners API endpoints.
// Prerequisites:
// 1. The Next.js application must be running (e.g., `npm run dev` on http://localhost:9002).
// 2. The SQLite database (ayurview.db) must be seeded (e.g., `npm run seed:sqlite`).
// 3. A valid auth token is required for these tests.

// @ts-ignore
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:9002/api/practitioners';

interface Practitioner {
    id: string | number;
    name: string;
    specialization: string;
    availabilitySlots?: any[]; // Define more strictly if possible
    // Add other expected fields
}

export async function runPractitionerTests(authToken: string | null) {
    console.log("\nRunning Practitioner API Tests...");
    let successCount = 0;
    let testCount = 0;

    if (!authToken) {
        console.error("  SKIPPED: All Practitioner API Tests (No auth token provided).");
        console.log(`\nPractitioner API Tests Summary: ${successCount}/${testCount} passed. (All skipped)`);
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };

    // Test 1: Fetch all practitioners
    testCount++;
    console.log("Test 1: Fetch all practitioners (/api/practitioners)");
    try {
        const response = await fetch(BASE_URL, { headers });
        const data: Practitioner[] = await response.json();

        if (response.status === 200 && Array.isArray(data) && data.length > 0) {
            const practitioner = data[0];
            if (practitioner && typeof practitioner.id !== 'undefined' && practitioner.name && practitioner.specialization && Array.isArray(practitioner.availabilitySlots)) {
                console.log(`  PASSED: Fetched ${data.length} practitioners. First practitioner has availability slots.`);
                successCount++;
            } else {
                console.error(`  FAILED: Fetch all practitioners. Response structure is invalid. Sample: ${JSON.stringify(practitioner)}`);
            }
        } else {
            console.error(`  FAILED: Fetch all practitioners. Status: ${response.status}, Body: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("  FAILED: Fetch all practitioners with error:", error);
    }

    // Test 2: Fetch a single practitioner by ID (e.g., ID 1)
    testCount++;
    const practitionerIdToTest = 1; // Assuming practitioner with ID 1 exists from seed data
    console.log(`\nTest 2: Fetch practitioner by ID (${practitionerIdToTest}) (/api/practitioners?id=${practitionerIdToTest})`);
    try {
        const response = await fetch(`${BASE_URL}?id=${practitionerIdToTest}`, { headers });
        const practitioner: Practitioner = await response.json();

        if (response.status === 200 && practitioner && practitioner.id.toString() === practitionerIdToTest.toString() && practitioner.name && Array.isArray(practitioner.availabilitySlots)) {
            console.log(`  PASSED: Fetched practitioner ID ${practitionerIdToTest} successfully with availability slots.`);
            successCount++;
        } else if (response.status === 404) {
             console.error(`  FAILED: Fetch practitioner by ID. Practitioner with ID ${practitionerIdToTest} not found (404). Check seed data.`);
        }
        else {
            console.error(`  FAILED: Fetch practitioner by ID. Status: ${response.status}, Body: ${JSON.stringify(practitioner)}`);
        }
    } catch (error) {
        console.error(`  FAILED: Fetch practitioner by ID (${practitionerIdToTest}) with error:`, error);
    }
    
    // Test 3: Fetch a non-existent practitioner by ID
    testCount++;
    const nonExistentPractitionerId = 99999;
    console.log(`\nTest 3: Fetch non-existent practitioner by ID (${nonExistentPractitionerId})`);
    try {
        const response = await fetch(`${BASE_URL}?id=${nonExistentPractitionerId}`, { headers });
        // const responseBody = await response.text(); // Use .text() if JSON parsing might fail for 404
        if (response.status === 404) {
            console.log(`  PASSED: Fetch non-existent practitioner correctly returned 404.`);
            successCount++;
        } else {
            const data = await response.json();
            console.error(`  FAILED: Fetch non-existent practitioner. Expected 404, Got: ${response.status}, Body: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error(`  FAILED: Fetch non-existent practitioner by ID (${nonExistentPractitionerId}) with error:`, error);
    }


    console.log(`\nPractitioner API Tests Summary: ${successCount}/${testCount} passed.`);
}
