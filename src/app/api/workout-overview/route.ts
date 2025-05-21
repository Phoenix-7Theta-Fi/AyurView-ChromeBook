import { connectToDb } from "@/lib/sqlite"; // Changed
import { NextResponse } from "next/server";
// ObjectId no longer needed
import { startOfMonth, endOfMonth, formatISO } from "date-fns"; // formatISO
import jwt from "jsonwebtoken";

// Helper function to verify JWT token
interface DecodedToken {
  userId: number; // Expect numeric userId
  email: string;
  userType: string;
}
function verifyToken(token: string): DecodedToken | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "default-secret") as DecodedToken;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  console.log('Workout metrics API called (SQLite)');
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token or userId missing" }, { status: 401 });
    }
    const userId = decoded.userId;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // This param defines the month to query
    const currentJsDate = dateParam ? new Date(dateParam) : new Date();

    // Dates for SQL query, YYYY-MM-DD
    const queryStartDate = formatISO(startOfMonth(currentJsDate), { representation: 'date' });
    const queryEndDate = formatISO(endOfMonth(currentJsDate), { representation: 'date' });

    const db = await connectToDb();

    // Fetch the most recent workout metrics record within the specified month
    const sqlQuery = `
      SELECT 
        id, date, strength_actual, strength_target, 
        flexibility_actual, flexibility_target, 
        vo2max_actual, vo2max_target, 
        endurance_actual, endurance_target, 
        agility_actual, agility_target 
      FROM workout_metrics_log
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC 
      LIMIT 1;
    `;
    const queryParams: any[] = [userId, queryStartDate, queryEndDate];
    
    console.log('Executing SQL (Workout Overview):', sqlQuery);
    console.log('With params:', queryParams);

    const latestRecord = await new Promise<any>((resolve, reject) => {
      db.get(sqlQuery, queryParams, (err, row) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    let radarData: any[] = [];
    if (latestRecord) {
      console.log('Latest workout record (SQLite):', latestRecord);
      radarData = [
        { metric: "Strength", "Actual Score": latestRecord.strength_actual, "Target Score": latestRecord.strength_target },
        { metric: "Flexibility", "Actual Score": latestRecord.flexibility_actual, "Target Score": latestRecord.flexibility_target },
        { metric: "VO2 Max", "Actual Score": latestRecord.vo2max_actual, "Target Score": latestRecord.vo2max_target },
        { metric: "Endurance", "Actual Score": latestRecord.endurance_actual, "Target Score": latestRecord.endurance_target },
        { metric: "Agility", "Actual Score": latestRecord.agility_actual, "Target Score": latestRecord.agility_target }
      ];
    }

    console.log('Returning data (SQLite):', radarData.length > 0 ? 'Latest metrics available' : 'No metrics found for the period');
    return NextResponse.json(radarData);

  } catch (error) {
    console.error("Error fetching workout metrics data (SQLite):", error);
    return NextResponse.json(
      { error: "Failed to fetch workout metrics data" },
      { status: 500 }
    );
  }
}
