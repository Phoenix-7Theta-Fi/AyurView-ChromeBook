import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), 'ayurview.db')
  : path.join(process.cwd(), 'ayurview.db');

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  userType: 'regular' | 'practitioner';
  createdAt: string;
  updatedAt: string;
}

interface SafeUser {
  id: number;
  name: string;
  email: string;
  userType: 'regular' | 'practitioner';
}

let db: sqlite3.Database | null = null;
let dbInitializationPromise: Promise<sqlite3.Database> | null = null;

async function initializeDbSchema(currentDb: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    currentDb.serialize(() => {
      // Use run for statements that don't return rows, exec for multiple statements
      // Wrap each in a promise or manage sequence carefully if dependencies exist.
      const tableCreationPromises = [
        // Users Table (already existed, ensure schema here)
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          userType TEXT NOT NULL CHECK(userType IN ('regular', 'practitioner')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Practitioners Table
        `CREATE TABLE IF NOT EXISTS practitioners (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          original_id TEXT,
          name TEXT NOT NULL,
          gender TEXT,
          specialization TEXT,
          bio TEXT,
          rating REAL,
          availability_text TEXT,
          location TEXT,
          image_url TEXT,
          data_ai_hint TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Practitioner Availability Slots Table
        `CREATE TABLE IF NOT EXISTS practitioner_availability_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
          slot_date TEXT NOT NULL,
          slot_time TEXT NOT NULL,
          is_available INTEGER DEFAULT 1, -- 1 for true, 0 for false
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Products Table
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          image_url TEXT,
          data_ai_hint TEXT,
          category TEXT,
          stock INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Treatment Plans Table
        `CREATE TABLE IF NOT EXISTS treatment_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          assigned_practitioner_id INTEGER REFERENCES practitioners(id) ON DELETE SET NULL,
          problem_title TEXT,
          problem_description TEXT,
          plan_summary TEXT,
          goals TEXT, -- Store as JSON string
          last_updated TEXT, -- ISO8601 Date string
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Consultations Table
        `CREATE TABLE IF NOT EXISTS consultations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          original_id TEXT, -- from mongo seed
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- User who booked
          practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
          practitioner_name TEXT, -- Denormalized for convenience
          specialization TEXT, -- Denormalized
          consultation_date TEXT NOT NULL,
          consultation_time TEXT NOT NULL,
          mode TEXT CHECK(mode IN ('online', 'offline')),
          treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Practitioner Assignments Table (e.g. primary practitioner for a user or plan)
        `CREATE TABLE IF NOT EXISTS practitioner_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- User who is assigned
          treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE CASCADE, -- Optional: assignment specific to a plan
          practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
          practitioner_name TEXT, -- Denormalized
          specialization TEXT, -- Denormalized
          assigned_at TEXT NOT NULL, -- ISO8601 Date string
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, treatment_plan_id, practitioner_id) -- Avoid duplicate assignments
        )`,
        // Treatment Plan Milestones
        `CREATE TABLE IF NOT EXISTS treatment_plan_milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          treatment_plan_id INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
          original_id TEXT, -- from mongo seed
          title TEXT NOT NULL,
          status TEXT CHECK(status IN ('pending', 'in-progress', 'completed', 'cancelled')),
          due_date TEXT, -- ISO8601 Date string
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Treatment Plan Biomarkers (specific instances for a plan)
        `CREATE TABLE IF NOT EXISTS treatment_plan_biomarkers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          treatment_plan_id INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
          original_id TEXT, -- from mongo seed
          name TEXT NOT NULL,
          current_value TEXT,
          target_value TEXT,
          unit TEXT,
          last_checked TEXT, -- ISO8601 Date string
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Treatment Plan Timeline Entries
        `CREATE TABLE IF NOT EXISTS treatment_plan_timeline_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          treatment_plan_id INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
          original_id TEXT, -- from mongo seed
          name TEXT NOT NULL,
          start_date TEXT NOT NULL, -- ISO8601 Date string
          end_date TEXT NOT NULL, -- ISO8601 Date string
          category TEXT,
          status TEXT CHECK(status IN ('pending', 'in-progress', 'completed', 'cancelled')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Biomarkers User Log (general tracking, separate from plan-specific ones)
        `CREATE TABLE IF NOT EXISTS biomarkers_user_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          biomarker_name TEXT NOT NULL,
          value REAL,
          unit TEXT,
          date TEXT NOT NULL, -- ISO8601 Date string
          ref_range_min REAL,
          ref_range_max REAL,
          target_value REAL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Cardio Performance Log
        `CREATE TABLE IF NOT EXISTS cardio_performance_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, -- ISO8601 Date string
          duration_minutes INTEGER,
          distance_km REAL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Daily Schedule Activities
        `CREATE TABLE IF NOT EXISTS daily_schedule_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          original_id TEXT, -- from mongo seed
          time TEXT NOT NULL, -- e.g., "06:00 AM"
          title TEXT NOT NULL,
          category TEXT,
          description TEXT,
          details TEXT,
          icon TEXT,
          duration_minutes INTEGER,
          status TEXT CHECK(status IN ('pending', 'completed', 'skipped')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Diet Analytics Log
        `CREATE TABLE IF NOT EXISTS diet_analytics_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, -- ISO8601 Date string
          protein_g REAL,
          carbs_g REAL,
          fats_g REAL,
          vitamins_units REAL, -- Assuming a generic unit
          minerals_units REAL, -- Assuming a generic unit
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Medication Adherence Log
        `CREATE TABLE IF NOT EXISTS medication_adherence_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, -- ISO8601 Date string
          adherence_percentage REAL CHECK(adherence_percentage >= 0 AND adherence_percentage <= 1),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Meditation Practices Log
        `CREATE TABLE IF NOT EXISTS meditation_practices_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          timestamp TEXT NOT NULL, -- ISO8601 DateTime string
          practice_type TEXT,
          duration_minutes INTEGER,
          completed INTEGER DEFAULT 0, -- 0 for false, 1 for true
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Sleep Wellness Log
        `CREATE TABLE IF NOT EXISTS sleep_wellness_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, -- ISO8601 Date string
          rem_hours REAL,
          deep_hours REAL,
          light_hours REAL,
          awake_hours REAL,
          total_duration_hours REAL,
          stress_level INTEGER CHECK(stress_level >=1 AND stress_level <=10),
          mood_score INTEGER CHECK(mood_score >=1 AND mood_score <=10),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Workout Metrics Log
        `CREATE TABLE IF NOT EXISTS workout_metrics_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL, -- ISO8601 Date string
          strength_actual REAL, strength_target REAL,
          flexibility_actual REAL, flexibility_target REAL,
          vo2max_actual REAL, vo2max_target REAL,
          endurance_actual REAL, endurance_target REAL,
          agility_actual REAL, agility_target REAL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        // Yoga Practices Log
        `CREATE TABLE IF NOT EXISTS yoga_practices_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          timestamp TEXT NOT NULL, -- ISO8601 DateTime string
          type TEXT,
          practice TEXT,
          sub_practice TEXT,
          element TEXT,
          duration_minutes INTEGER,
          difficulty TEXT CHECK(difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
          completed INTEGER DEFAULT 0, -- 0 for false, 1 for true
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      const indexCreationQueries = [
        // Indexes for users
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
        // Indexes for practitioners
        `CREATE INDEX IF NOT EXISTS idx_practitioners_specialization ON practitioners(specialization)`,
        `CREATE INDEX IF NOT EXISTS idx_practitioners_location ON practitioners(location)`,
        // Indexes for practitioner_availability_slots
        `CREATE INDEX IF NOT EXISTS idx_practitioner_availability_slots_practitioner_id ON practitioner_availability_slots(practitioner_id)`,
        `CREATE INDEX IF NOT EXISTS idx_practitioner_availability_slots_date ON practitioner_availability_slots(slot_date)`,
        // Indexes for products
        `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
        `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
        // Indexes for treatment_plans
        `CREATE INDEX IF NOT EXISTS idx_treatment_plans_user_id ON treatment_plans(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_treatment_plans_assigned_practitioner_id ON treatment_plans(assigned_practitioner_id)`,
        // Indexes for consultations
        `CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_consultations_practitioner_id ON consultations(practitioner_id)`,
        `CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(consultation_date)`,
        `CREATE INDEX IF NOT EXISTS idx_consultations_treatment_plan_id ON consultations(treatment_plan_id)`,
        // Indexes for practitioner_assignments
        `CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_user_id ON practitioner_assignments(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_practitioner_id ON practitioner_assignments(practitioner_id)`,
        `CREATE INDEX IF NOT EXISTS idx_practitioner_assignments_treatment_plan_id ON practitioner_assignments(treatment_plan_id)`,
        // Indexes for various log tables by user_id and date/timestamp
        `CREATE INDEX IF NOT EXISTS idx_biomarkers_user_log_user_date ON biomarkers_user_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_cardio_performance_log_user_date ON cardio_performance_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_daily_schedule_activities_user_date ON daily_schedule_activities(user_id, createdAt DESC)`, // Using createdAt as primary date
        `CREATE INDEX IF NOT EXISTS idx_diet_analytics_log_user_date ON diet_analytics_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_medication_adherence_log_user_date ON medication_adherence_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_meditation_practices_log_user_timestamp ON meditation_practices_log(user_id, timestamp DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_sleep_wellness_log_user_date ON sleep_wellness_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_workout_metrics_log_user_date ON workout_metrics_log(user_id, date DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_yoga_practices_log_user_timestamp ON yoga_practices_log(user_id, timestamp DESC)`
      ];

      // Execute all table creations
      currentDb.exec('BEGIN TRANSACTION;', (errBegin) => {
        if (errBegin) return reject(errBegin);

        Promise.all(tableCreationPromises.map(sql => 
          new Promise<void>((res, rej) => currentDb.run(sql, (err) => err ? rej(err) : res()))
        ))
        .then(() => Promise.all(indexCreationQueries.map(sql =>
          new Promise<void>((res, rej) => currentDb.run(sql, (err) => err ? rej(err) : res()))
        )))
        .then(() => {
          currentDb.exec('COMMIT;', (errCommit) => {
            if (errCommit) return reject(errCommit);
            console.log("All tables and indexes created or already exist.");
            resolve();
          });
        })
        .catch(err => {
          currentDb.exec('ROLLBACK;', (errRollback) => {
            if (errRollback) console.error("Error rolling back transaction:", errRollback);
            console.error("Error in schema initialization:", err);
            reject(err);
          });
        });
      });
    });
  });
}


async function connectToDb(): Promise<sqlite3.Database> {
  if (db) {
    return db;
  }

  // If a connection attempt is already in progress, return that promise
  if (dbInitializationPromise) {
    return dbInitializationPromise;
  }

  // Start a new connection attempt
  dbInitializationPromise = new Promise((resolve, reject) => {
    const newDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
        dbInitializationPromise = null; // Reset promise on failure
        reject(err);
      } else {
        console.log("Successfully connected to SQLite database at", dbPath);
        // Enable foreign key constraints
        newDb.run("PRAGMA foreign_keys = ON;", (fkErr) => {
          if (fkErr) {
            console.error("Error enabling foreign keys:", fkErr.message);
            newDb.close();
            dbInitializationPromise = null;
            return reject(fkErr);
          }
          console.log("Foreign key constraints enabled.");
          initializeDbSchema(newDb)
            .then(() => {
              db = newDb;
              resolve(db);
            })
            .catch(schemaErr => {
              console.error("Schema initialization failed:", schemaErr);
              newDb.close((closeErr) => {
                if (closeErr) console.error("Error closing DB after schema failure:", closeErr.message);
              });
              dbInitializationPromise = null; // Reset promise on schema failure
              reject(schemaErr);
            });
        });
      }
    });
  });
  return dbInitializationPromise;
}

async function createUser(name: string, email: string, password: string, userType: 'regular' | 'practitioner'): Promise<SafeUser> {
  const currentDb = await connectToDb();
  
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error("User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO users (name, email, password, userType, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    currentDb.run(
      sql,
      [name, email, hashedPassword, userType],
      function (err) { 
        if (err) {
          console.error("Error creating user:", err.message);
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            name,
            email,
            userType
          });
        }
      }
    );
  });
}

async function findUserByEmail(email: string): Promise<User | null> {
  const currentDb = await connectToDb();
  return new Promise((resolve, reject) => {
    currentDb.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
      if (err) {
        console.error("Error finding user by email:", err.message);
        reject(err);
      } else {
        resolve(row as User | null);
      }
    });
  });
}

async function validateUserCredentials(email: string, password: string): Promise<SafeUser | null> {
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      userType: user.userType
    };
  } catch (error) {
    console.error("Error validating credentials:", error);
    if (error instanceof Error && !['User already exists'].includes(error.message)) {
        throw error;
    }
    return null; 
  }
}

export async function connectToDatabase() {
  try {
    const connectedDb = await connectToDb();
    return {
      db: connectedDb 
    };
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
}

module.exports = {
  connectToDb,
  createUser,
  findUserByEmail,
  validateUserCredentials,
  db, 
  connectToDatabase 
};

export {
  connectToDb as esmConnectToDb, 
  createUser as esmCreateUser,
  findUserByEmail as esmFindUserByEmail,
  validateUserCredentials as esmValidateUserCredentials,
  type SafeUser,
  type User,
};

export { db as sqliteDbInstance };
