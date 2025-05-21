// Main test runner for API endpoint tests.
// Prerequisites for running these tests:
// 1. The Next.js application must be running (e.g., `npm run dev` on http://localhost:9002).
// 2. The SQLite database (ayurview.db) must be seeded (e.g., `npm run seed:sqlite`).

import { runAuthTests } from './auth.test';
import { runPractitionerTests } from './practitioners.test';
import { runConsultationTests } from './consultations.test';

interface TestContext {
    token: string | null;
    userId: number | string | null;
    // Add other shared details if needed, e.g., practitionerId from seeding for consultation tests.
    // For now, we'll assume practitioner ID 1 is available from seed data.
    practitionerIdForTest: number | string; 
}

async function main() {
    console.log("Starting API Endpoint Test Suite...\n");

    const context: TestContext = {
        token: null,
        userId: null,
        practitionerIdForTest: 1 // Assuming practitioner with ID 1 is available from seed
    };

    // Run Auth Tests first to get a token and user ID
    try {
        const authResult = await runAuthTests();
        context.token = authResult.token;
        context.userId = authResult.userId;

        if (!context.token || !context.userId) {
            console.error("\nCritical: Auth tests did not yield a token or user ID. Subsequent tests that depend on auth will be affected.");
        } else {
            console.log(`\nRetrieved token for user ID: ${context.userId}. This token will be used for subsequent tests.`);
        }
    } catch (error) {
        console.error("\nCritical error during auth tests, aborting further tests:", error);
        process.exit(1); // Exit if auth tests fail catastrophically
    }
    
    // Run Practitioner Tests
    try {
        await runPractitionerTests(context.token);
    } catch (error) {
        console.error("\nError during practitioner tests:", error);
    }

    // Run Consultation Tests
    try {
        // Pass necessary context like token, userId, and a known practitionerId
        await runConsultationTests(context.token, context.userId, context.practitionerIdForTest);
    } catch (error) {
        console.error("\nError during consultation tests:", error);
    }

    console.log("\nAPI Endpoint Test Suite COMPLETE.");
    // Note: Consider exiting with a non-zero code if any test suite reported failures.
    // This simple runner doesn't aggregate pass/fail counts from suites yet.
}

main().catch(error => {
    console.error("Unhandled error during test suite execution:", error);
    process.exit(1);
});
