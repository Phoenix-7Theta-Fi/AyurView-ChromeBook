import { NextResponse } from 'next/server';
import { connectToDb } from '@/lib/sqlite'; // Changed
// ObjectId no longer needed
import jwt from 'jsonwebtoken';
// SleepWellnessData type might need adjustment if its structure was MongoDB specific (e.g. Date types)
// import type { SleepWellnessData } from '@/lib/types'; 
import { parseISO } from 'date-fns'; // To handle date strings from query params

// Helper function to verify JWT token
interface DecodedToken {
  userId: number; // Expect numeric userId
  email: string;
  userType: string;
}
function verifyToken(token: string): DecodedToken | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as DecodedToken;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded?.userId) { // Check for userId from token
      return NextResponse.json({ error: 'Invalid token or userId missing' }, { status: 401 });
    }
    const userId = decoded.userId;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate'); // Expect YYYY-MM-DD
    const endDateParam = searchParams.get('endDate');     // Expect YYYY-MM-DD

    // Validate and format dates for SQL query
    let sqlStartDate: string | null = null;
    let sqlEndDate: string | null = null;

    if (startDateParam) {
        // Basic validation, can be more robust
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) return NextResponse.json({ error: 'Invalid startDate format, use YYYY-MM-DD' }, { status: 400 });
        sqlStartDate = startDateParam;
    }
    if (endDateParam) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) return NextResponse.json({ error: 'Invalid endDate format, use YYYY-MM-DD' }, { status: 400 });
        sqlEndDate = endDateParam;
    }
    
    const db = await connectToDb();
    
    let sqlQuery = `
      SELECT 
        id, date, rem_hours, deep_hours, light_hours, awake_hours, 
        total_duration_hours, stress_level, mood_score 
      FROM sleep_wellness_log 
      WHERE user_id = ?`;
    const queryParams: any[] = [userId];

    if (sqlStartDate) {
      sqlQuery += ` AND date >= ?`;
      queryParams.push(sqlStartDate);
    }
    if (sqlEndDate) {
      sqlQuery += ` AND date <= ?`;
      queryParams.push(sqlEndDate);
    }
    sqlQuery += ` ORDER BY date ASC;`;

    console.log('Executing SQL (Sleep Wellness):', sqlQuery);
    console.log('With params:', queryParams);

    const sleepWellnessDbData = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    console.log('Found sleep wellness records (SQLite):', sleepWellnessDbData.length);

    const formattedData = sleepWellnessDbData.map((data) => {
      // data.date is YYYY-MM-DD string from SQLite
      const recordDate = parseISO(data.date); // parseISO correctly handles YYYY-MM-DD
      return {
        // id: data.id.toString(), // if needed
        day: recordDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
        REM: data.rem_hours,
        Deep: data.deep_hours,
        Light: data.light_hours,
        Awake: data.awake_hours,
        // totalDuration: data.total_duration_hours, // if needed
        stressLevel: data.stress_level,
        moodScore: data.mood_score,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedData
    });

  } catch (error: any) {
    console.error('Error fetching sleep wellness data (SQLite):', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch sleep wellness data' }, { status: 500 });
  }
}
