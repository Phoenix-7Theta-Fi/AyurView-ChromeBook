const { ObjectId } = require('mongodb');

// ASSUMPTION: These ObjectIds are present in the 'practitioners' and 'users' collections
// after their respective seed scripts (seed-practitioners.js, seed-users.js) have run.
// Ideally, these would be dynamically fetched or exported from those scripts.

// Example Practitioner ObjectIds (replace with actual ones if possible)
const practitionerId1 = new ObjectId("60d5ec49f0d9a3001c8e4c51"); // Placeholder for Dr. Ananya Sharma
const practitionerId2 = new ObjectId("60d5ec49f0d9a3001c8e4c52"); // Placeholder for Yogi Rajendra Desai

// Example User ObjectIds (replace with actual ones if possible)
const userId1 = new ObjectId("60d5ec49f0d9a3001c8e4b01"); // Placeholder for Sarah
const userId2 = new ObjectId("60d5ec49f0d9a3001c8e4b02"); // Placeholder for Michael
const userId3 = new ObjectId("60d5ec49f0d9a3001c8e4b03"); // Placeholder for Emma

const mockConsultations = [
  {
    _id: new ObjectId(),
    practitionerId: practitionerId1,
    practitionerName: "Dr. Ananya Sharma", // Ensure this matches the practitioner's actual name
    userId: userId1,
    userName: "Sarah", // Ensure this matches the user's actual name
    specialization: "Ayurvedic General Practice",
    date: "2024-09-10",
    time: "10:00 AM",
    mode: "online",
    status: "booked", // Added status based on type
    notes: "Initial consultation for digestive issues.", // Added notes based on type
    paymentDetails: { // Added paymentDetails based on type
        amount: 50,
        currency: "USD",
        status: "paid",
        transactionId: new ObjectId().toHexString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: new ObjectId(),
    practitionerId: practitionerId2,
    practitionerName: "Yogi Rajendra Desai", // Ensure this matches the practitioner's actual name
    userId: userId2,
    userName: "Michael", // Ensure this matches the user's actual name
    specialization: "Yoga Therapy & Meditation",
    date: "2024-09-12",
    time: "11:00 AM",
    mode: "online",
    status: "completed",
    notes: "Follow-up session for stress management.",
    paymentDetails: {
        amount: 70,
        currency: "USD",
        status: "paid",
        transactionId: new ObjectId().toHexString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: new ObjectId(),
    practitionerId: practitionerId1,
    practitionerName: "Dr. Ananya Sharma",
    userId: userId3,
    userName: "Emma",
    specialization: "Ayurvedic General Practice",
    date: "2024-09-15",
    time: "02:00 PM",
    mode: "in-person",
    status: "booked",
    notes: "Consultation regarding skin allergies.",
    paymentDetails: {
        amount: 60,
        currency: "USD",
        status: "pending",
        transactionId: new ObjectId().toHexString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: new ObjectId(),
    practitionerId: practitionerId2,
    practitionerName: "Yogi Rajendra Desai",
    userId: userId1, // Sarah also consults with Yogi Rajendra
    userName: "Sarah",
    specialization: "Yoga Therapy & Meditation",
    date: "2024-09-18",
    time: "09:00 AM",
    mode: "online",
    status: "cancelled",
    notes: "Cancelled by patient due to conflict.",
    paymentDetails: {
        amount: 70,
        currency: "USD",
        status: "refunded",
        transactionId: new ObjectId().toHexString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seedConsultations(db) {
  try {
    const consultationsCollection = db.collection('consultations');

    const existingConsultations = await consultationsCollection.countDocuments();
    if (existingConsultations > 0) {
      // Check if the existing consultations are the ones from seed-practitioners.js
      // Those don't have userId. If so, we might want to remove them or update them.
      // For now, if any consultations exist, we skip.
      // A more robust check would be to see if consultations with `userId` field exist.
      const consultationsWithUserId = await consultationsCollection.countDocuments({ userId: { $exists: true } });
      if (consultationsWithUserId > 0) {
        console.log('Consultations data (with userId) already seeded. Skipping...');
        return;
      }
      console.log('Found existing consultations, but none with userId. Proceeding to seed new consultation data...');
    }

    // The problem states that seed-practitioners.js *also* seeds some consultations.
    // Those consultations do NOT have userId. The API route for practitioners/{id}/patients
    // relies on `userId` being present in the `consultations` collection.
    // So, the consultations seeded by `seed-practitioners.js` are not sufficient for that API.
    // This new `seedConsultations` script adds consultations that *do* have `userId`.

    await consultationsCollection.insertMany(mockConsultations);
    console.log(`Successfully seeded ${mockConsultations.length} new consultations with user details.`);

  } catch (error) {
    console.error('Error seeding consultations data:', error);
    // Not exiting process here, to allow other seed scripts to run if called in sequence
  }
}

module.exports = { seedConsultations, mockConsultations };
