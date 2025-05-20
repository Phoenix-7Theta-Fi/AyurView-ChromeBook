const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env");
}

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToDb() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
    return client;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

async function createUser(name, email, password, userType) {
  try {
    const db = client.db("ayurview");
    const users = db.collection("users");
    
    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const result = await users.insertOne({
      _id: new ObjectId(),
      name,
      email,
      password: hashedPassword,
      userType, // Add userType to the document
      createdAt: new Date()
    });

    return {
      id: result.insertedId.toString(),
      name,
      email,
      userType // Include userType in the returned object
    };
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

const { seedConsultations } = require('./seed-consultations'); // Import the new seeder

// New function to run specific seeders like seedConsultations
async function runTargetedSeeders() {
  let localClient; // Use a local client instance for this function
  try {
    console.log('Connecting to database for targeted seeding...');
    // Use the existing client or create a new one if connectToDb is designed for reuse
    // For simplicity, let's assume client is already configured and we can connect.
    // If connectToDb returns a new client each time, that's fine.
    // If client is a global singleton, also fine.
    
    // The existing connectToDb() connects the global `client`.
    // We need a db instance.
    await client.connect(); // Ensure the global client is connected
    const db = client.db("ayurview"); // Get the db instance
    
    console.log("Successfully connected to MongoDB for targeted seeding.");

    // Call specific seeders
    // For now, only seedConsultations as per the task
    // This assumes users and practitioners are already seeded by their respective scripts
    await seedConsultations(db);

    console.log('Targeted seeding completed successfully.');

  } catch (error) {
    console.error('Error during targeted seeding:', error);
    process.exit(1); // Exit if targeted seeding fails
  } finally {
    // Ensure the client is closed if this function initiated the connection
    // or if it's managing its own connection lifecycle.
    // Given `client` is global, close it here.
    if (client) {
      await client.close();
      console.log('MongoDB connection closed after targeted seeding.');
    }
  }
}

module.exports = {
  connectToDb,
  createUser,
  runTargetedSeeders, // Export the new function
  // Exposing client might be useful if other scripts need to share the connection
  // client 
};

// Example of how this might be run (optional, for illustration):
// if (require.main === module) {
//   runTargetedSeeders().catch(console.error);
// }
