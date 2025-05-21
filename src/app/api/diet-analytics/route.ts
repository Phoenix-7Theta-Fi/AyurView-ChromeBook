import { connectToDb } from "@/lib/sqlite"; // Changed
import { NextResponse } from "next/server";
// ObjectId no longer needed
import { startOfMonth, endOfMonth, formatISO, parseISO } from "date-fns"; // formatISO and parseISO
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
  console.log('Diet analytics API called (SQLite)');
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
        protein_g,
        carbs_g,
        fats_g,
        vitamins_units,
        minerals_units
      FROM diet_analytics_log
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC; 
    `;
    const queryParams: any[] = [userId, startDate, endDate];
    
    console.log('Executing SQL (Diet Analytics):', sqlQuery);
    console.log('With params:', queryParams);

    const dietData = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Transform data to match the DietAnalyticsChart component format
    const transformedData = dietData.map(record => {
      // record.date is YYYY-MM-DD from SQLite
      const recordDate = parseISO(record.date); // Parse YYYY-MM-DD string to JS Date
      return {
        // id: record.id.toString(), // if frontend needs an id for each item
        day: recordDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        Protein: record.protein_g,
        Carbs: record.carbs_g,
        Fats: record.fats_g,
        Vitamins: record.vitamins_units,
        Minerals: record.minerals_units
      };
    });
    
    // Sorting is already handled by SQL's ORDER BY date ASC.

    console.log('Returning data (SQLite):', transformedData.length, 'records');
    return NextResponse.json(transformedData);

  } catch (error) {
    console.error("Error fetching diet analytics data (SQLite):", error);
    return NextResponse.json(
      { error: "Failed to fetch diet analytics data" },
      { status: 500 }
    );
  }
}
