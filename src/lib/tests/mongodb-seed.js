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

module.exports = {
  connectToDb,
  createUser
};
