import { connectToDb } from "@/lib/sqlite"; // Changed to sqlite
import { NextResponse } from "next/server";
// ObjectId no longer needed
import { startOfMonth, endOfMonth, formatISO } from "date-fns"; // formatISO for date strings
import jwt from "jsonwebtoken";

// Helper function to verify JWT token
function verifyToken(token: string): { userId: number; email: string; userType: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "default-secret") as { userId: number; email: string; userType: string };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  console.log('Cardio performance API called (SQLite)');
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

    // Dates for SQL query, ensuring they are in YYYY-MM-DD format for DATE comparison in SQLite if time is not stored.
    // If time is stored (DATETIME), use .toISOString()
    const startDate = formatISO(startOfMonth(currentJsDate), { representation: 'date' }); // YYYY-MM-DD
    const endDate = formatISO(endOfMonth(currentJsDate), { representation: 'date' });     // YYYY-MM-DD

    const db = await connectToDb();

    const sqlQuery = `
      SELECT 
        id,
        date,
        duration_minutes,
        distance_km
      FROM cardio_performance_log
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC;
    `;
    const queryParams: any[] = [userId, startDate, endDate];

    console.log('Executing SQL (Cardio Performance):', sqlQuery);
    console.log('With params:', queryParams);
    
    const cardioData = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Transform data to match component needs (nesting duration and distance)
    const transformedData = cardioData.map(record => ({
      id: record.id.toString(), // Keep id as string if frontend expects
      date: record.date, // This will be YYYY-MM-DD from SQLite
      metrics: {
        duration: record.duration_minutes,
        distance: record.distance_km
      }
    }));

    console.log('Returning data (SQLite):', transformedData.length, 'records');
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Error fetching cardio performance data (SQLite):", error);
    return NextResponse.json(
      { error: "Failed to fetch cardio performance data" },
      { status: 500 }
    );
  }
}
