import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env");
}

const uri = process.env.MONGODB_URI;

interface User {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  userType: 'regular' | 'practitioner';
  createdAt: Date;
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  userType: 'regular' | 'practitioner';
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Add connection pooling settings
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 60000
});

let clientPromise: Promise<MongoClient>;

async function connectToDb() {
  if (!clientPromise) {
    clientPromise = client.connect()
      .then(async (client) => {
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Successfully connected to MongoDB!");
        return client;
      })
      .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
        throw error;
      });
  }
  return clientPromise;
}

// User-related operations
async function createUser(name: string, email: string, password: string, userType: 'regular' | 'practitioner'): Promise<SafeUser> {
  try {
    const db = client.db("ayurview");
    const users = db.collection<User>("users");
    
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
      userType,
      createdAt: new Date()
    });

    return {
      id: result.insertedId.toString(),
      name,
      email,
      userType
    };
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const db = client.db("ayurview");
    const users = db.collection<User>("users");
    return await users.findOne({ email });
  } catch (error) {
    console.error("Error finding user:", error);
    throw error;
  }
}

async function validateUserCredentials(email: string, password: string): Promise<SafeUser | null> {
  try {
    // findUserByEmail returns the full User object which includes userType
    const user = await findUserByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name, // use name instead of firstName
      email: user.email,
      userType: user.userType // include userType
    };
  } catch (error) {
    console.error("Error validating credentials:", error);
    throw error;
  }
}

// Export for CommonJS
module.exports = {
  connectToDb,
  createUser,
  findUserByEmail,
  validateUserCredentials,
  mongodb: client
};

// Database connection helper for API routes
export async function connectToDatabase() {
  try {
    await connectToDb();
    return {
      db: client.db("ayurview")
    };
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
}

// Export for ESM
export {
  connectToDb,
  createUser,
  findUserByEmail,
  validateUserCredentials,
  type SafeUser,
  type User
};

export const mongodb = client;
