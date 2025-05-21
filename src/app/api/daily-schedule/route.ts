import { NextRequest, NextResponse } from 'next/server';
import { connectToDb } from '@/lib/sqlite'; // Changed
import { verify } from 'jsonwebtoken';
// ObjectId no longer needed
import type { TreatmentPlanActivity } from '@/lib/types'; // Still useful for type hints

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: number; // Expect numeric userId from JWT
  // other fields from your JWT payload if any
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication token required' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as DecodedToken;
    const userId = decoded.userId; // Numeric ID

    const { activityId, status } = await req.json();
    
    if (!activityId || !status) {
      return NextResponse.json({ error: 'Activity ID and status are required' }, { status: 400 });
    }
    const activityIdNum = parseInt(activityId); // Ensure activityId is a number
    if (isNaN(activityIdNum)) {
        return NextResponse.json({ error: 'Invalid Activity ID format' }, { status: 400 });
    }


    if (!['pending', 'completed', 'skipped', 'missed'].includes(status)) { // Added 'skipped' based on schema
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const db = await connectToDb();

    const sqlUpdate = `
      UPDATE daily_schedule_activities 
      SET status = ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?;
    `;
    const paramsUpdate = [status, activityIdNum, userId];

    const result = await new Promise<{ changes: number }>((resolve, reject) => {
      db.run(sqlUpdate, paramsUpdate, function(err) {
        if (err) {
          console.error("SQL Error (PATCH daily-schedule):", err);
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Activity not found or user mismatch' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity status updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating activity status (SQLite):', error);
    // Check if JWT verification error
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update activity status' }, { status: 500 });
  }
}


export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication token required' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as DecodedToken;
    const userId = decoded.userId; // Numeric ID

    const db = await connectToDb();

    // Consider if filtering by a specific date is needed, e.g., DATE(createdAt) = DATE('now')
    // The original code fetches all activities for the user.
    const sqlSelect = `
      SELECT id, user_id, original_id, time, title, category, description, details, icon, duration_minutes, status, createdAt, updatedAt 
      FROM daily_schedule_activities
      WHERE user_id = ? 
      ORDER BY date(createdAt) ASC, time ASC; 
    `; 
    // Sorting by date part of createdAt then time to ensure chronological order across days.

    const schedule = await new Promise<TreatmentPlanActivity[]>((resolve, reject) => {
      db.all(sqlSelect, [userId], (err, rows) => {
        if (err) {
          console.error("SQL Error (GET daily-schedule):", err);
          reject(err);
        } else {
          // Ensure 'id' is a string if frontend expects it, matching MongoDB's _id.toString()
          resolve(rows.map(row => ({ ...row, id: row.id.toString() } as TreatmentPlanActivity)));
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: schedule
    });

  } catch (error: any) {
    console.error('Error fetching daily schedule (SQLite):', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch daily schedule' },
      { status: 500 }
    );
  }
}
