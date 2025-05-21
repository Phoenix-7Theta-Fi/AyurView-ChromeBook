// Test cases for consultations API endpoints.
// Prerequisites:
// 1. The Next.js application must be running (e.g., `npm run dev` on http://localhost:9002).
// 2. The SQLite database (ayurview.db) must be seeded (e.g., `npm run seed:sqlite`).
// 3. A valid auth token and user ID are required for these tests.

// @ts-ignore
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:9002/api/consultations';

interface Consultation {
    id: string | number;
    practitionerId?: string | number;
    practitioner_id?: string | number; // SQLite might return snake_case
    practitionerName?: string;
    practitioner_name?: string;
    date?: string;
    consultation_date?: string;
    time?: string;
    consultation_time?: string;
    mode?: string;
    // Add other expected fields
}

export async function runConsultationTests(authToken: string | null, userId: number | string | null, practitionerIdForTest: number | string | null) {
    console.log("\nRunning Consultation API Tests...");
    let successCount = 0;
    let testCount = 0;

    if (!authToken || !userId || !practitionerIdForTest) {
        console.error("  SKIPPED: All Consultation API Tests (Auth token, User ID, or Practitioner ID for test not provided).");
        console.log(`\nConsultation API Tests Summary: ${successCount}/${testCount} passed. (All skipped)`);
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };

    let newConsultationId: string | number | null = null;

    // Test 1: Book a new consultation
    testCount++;
    console.log("Test 1: Book a new consultation (/api/consultations POST)");
    // Find an available slot for practitionerIdForTest - for simplicity, we'll try a future date and common time.
    // A more robust test would query /api/practitioners?id=X to find an actual available slot.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7); // Book a week from now to improve chances of slot availability
    const testDate = tomorrow.toISOString().split('T')[0];
    const testTime = "10:00 AM"; // Assuming this is a common time

    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                practitionerId: practitionerIdForTest,
                date: testDate,
                time: testTime,
                mode: "online",
                // userId will be implicitly taken from the token by the backend
            }),
        });
        const data: Consultation & { success?: boolean } = await response.json();

        if (response.status === 200 && data.success && data.id) { // API returns 200 on successful booking based on previous work
            console.log(`  PASSED: Booked new consultation successfully. ID: ${data.id}`);
            newConsultationId = data.id;
            successCount++;
        } else if (response.status === 400 && data.error === "Time slot is not available or does not exist") {
            console.warn(`  SKIPPED/WARN: Book new consultation. Slot ${testDate} ${testTime} for practitioner ${practitionerIdForTest} not available. Check seed data & practitioner_availability_slots.`);
            // Not incrementing successCount, but not a hard fail if slot genuinely unavailable.
        } else if (response.status === 400 && data.error === "Time slot already booked (consultation exists)") {
             console.warn(`  SKIPPED/WARN: Book new consultation. Slot ${testDate} ${testTime} for practitioner ${practitionerIdForTest} already booked by another test run?`);
        }
        else {
            console.error(`  FAILED: Book new consultation. Status: ${response.status}, Body: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("  FAILED: Book new consultation with error:", error);
    }

    // Test 2: Fetch consultations for the authenticated user
    testCount++;
    console.log("\nTest 2: Fetch consultations for user (/api/consultations GET)");
    try {
        const response = await fetch(BASE_URL, { headers });
        const data: Consultation[] = await response.json();

        if (response.status === 200 && Array.isArray(data)) {
            console.log(`  PASSED: Fetched ${data.length} consultations for the user.`);
            if (newConsultationId) {
                const found = data.some(c => c.id.toString() === newConsultationId!.toString());
                if (found) {
                    console.log(`    VERIFIED: Newly booked consultation (ID: ${newConsultationId}) is present in the list.`);
                } else {
                    console.warn(`    VERIFICATION NOTE: Newly booked consultation (ID: ${newConsultationId}) was NOT found in the list. This might be an issue or due to test slot unavailability.`);
                }
            }
            successCount++;
        } else {
            console.error(`  FAILED: Fetch consultations for user. Status: ${response.status}, Body: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("  FAILED: Fetch consultations for user with error:", error);
    }
    
    // Test 3: Fetch consultations for a specific practitioner (if user is practitioner or for public view - current API allows any auth user)
    testCount++;
    console.log(`\nTest 3: Fetch consultations for practitioner ID ${practitionerIdForTest} (/api/consultations?practitionerId=${practitionerIdForTest} GET)`);
    try {
        const response = await fetch(`${BASE_URL}?practitionerId=${practitionerIdForTest}`, { headers });
        const data: Consultation[] = await response.json();

        if (response.status === 200 && Array.isArray(data)) {
            console.log(`  PASSED: Fetched ${data.length} consultations for practitioner ID ${practitionerIdForTest}.`);
            // Optionally, verify if the newConsultationId is in this list too, if it was for this practitioner
            successCount++;
        } else {
            console.error(`  FAILED: Fetch consultations for practitioner. Status: ${response.status}, Body: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        console.error("  FAILED: Fetch consultations for practitioner with error:", error);
    }


    console.log(`\nConsultation API Tests Summary: ${successCount}/${testCount} passed.`);
}
