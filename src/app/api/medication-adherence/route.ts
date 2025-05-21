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
  console.log('Medication adherence API called (SQLite)');
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

    // Dates for SQL query, YYYY-MM-DD
    const startDate = formatISO(startOfMonth(currentJsDate), { representation: 'date' });
    const endDate = formatISO(endOfMonth(currentJsDate), { representation: 'date' });

    const db = await connectToDb();

    const sqlQuery = `
      SELECT 
        id,
        date,
        adherence_percentage 
      FROM medication_adherence_log
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC;
    `;
    const queryParams: any[] = [userId, startDate, endDate];

    console.log('Executing SQL (Medication Adherence):', sqlQuery);
    console.log('With params:', queryParams);

    const adherenceData = await new Promise<any[]>((resolve, reject) => {
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
    const transformedData = adherenceData.map(record => ({
      // id: record.id.toString(), // if needed by frontend
      date: record.date, // Already YYYY-MM-DD string
      adherence: record.adherence_percentage 
    }));

    console.log('Returning data (SQLite):', transformedData.length, 'records');
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Error fetching medication adherence data (SQLite):", error);
    return NextResponse.json(
      { error: "Failed to fetch medication adherence data" },
      { status: 500 }
    );
  }
}
