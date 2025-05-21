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
  console.log('Meditation practices API called (SQLite)');
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
    const dateParam = searchParams.get("date");
    const currentJsDate = dateParam ? new Date(dateParam) : new Date();

    // Dates for SQL query, YYYY-MM-DDTHH:MM:SS.SSSZ (ISO8601 string for DATETIME comparison)
    const startDate = startOfMonth(currentJsDate).toISOString();
    const endDate = endOfMonth(currentJsDate).toISOString();

    const db = await connectToDb();

    const sqlQuery = `
      SELECT 
        id,
        timestamp,
        practice_type,
        duration_minutes,
        completed 
      FROM meditation_practices_log
      WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC;
    `;
    const queryParams: any[] = [userId, startDate, endDate];

    console.log('Executing SQL (Meditation Practices):', sqlQuery);
    console.log('With params:', queryParams);

    const meditationData = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Transform data to match the expected format
    const transformedData = meditationData.map(record => ({
      // id: record.id.toString(), // if needed by frontend
      timestamp: record.timestamp, // Already ISO string
      practiceType: record.practice_type,
      duration: record.duration_minutes,
      completed: Boolean(record.completed) // Convert 0/1 to boolean
    }));

    console.log('Returning data (SQLite):', transformedData.length, 'records');
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Error fetching meditation practices data (SQLite):", error);
    return NextResponse.json(
      { error: "Failed to fetch meditation practices data" },
      { status: 500 }
    );
  }
}
