import { NextRequest, NextResponse } from 'next/server';
// ObjectId no longer needed
import { connectToDb } from '@/lib/sqlite'; // Changed
import { cookies } from 'next/headers'; // Used by getToken
// verifyJwtToken might not be used directly here if jwt.verify is used
import jwt from 'jsonwebtoken';

// Get JWT token from authorization header helper
async function getToken(req: NextRequest): Promise<string | null> { // Can return null
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookiesList = await cookies();
  const token = cookiesList.get('token');
  return token?.value || null;
}

interface DecodedToken {
  userId: number; // Expect numeric userId
  // Add other fields from your JWT payload if any
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized, no token provided' }, { status: 401 });
    }
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined for token verification');
    }

    let decoded: DecodedToken;
    try {
      // Ensure that the type cast matches the actual structure of your decoded token
      decoded = jwt.verify(token, process.env.JWT_SECRET) as DecodedToken; 
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.json({ error: 'Unauthorized, invalid token' }, { status: 401 });
    }

    if (!decoded || typeof decoded.userId !== 'number') {
        return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }
    const userId = decoded.userId;

    const db = await connectToDb();
    
    // Query main treatment plan for the user
    const treatmentPlanSql = `SELECT * FROM treatment_plans WHERE user_id = ?`;
    const planRow: any = await new Promise((resolve, reject) => {
      db.get(treatmentPlanSql, [userId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!planRow) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 });
    }

    const treatmentPlanId = planRow.id;

    // Fetch related data
    const milestonesSql = `SELECT id, original_id, title, status, due_date FROM treatment_plan_milestones WHERE treatment_plan_id = ? ORDER BY due_date ASC`;
    const milestones = await new Promise((resolve, reject) => db.all(milestonesSql, [treatmentPlanId], (err, rows) => err ? reject(err) : resolve(rows.map(r => ({...r, id: r.id.toString()})))));

    const planBiomarkersSql = `SELECT id, original_id, name, current_value, target_value, unit, last_checked FROM treatment_plan_biomarkers WHERE treatment_plan_id = ?`;
    const planBiomarkers = await new Promise((resolve, reject) => db.all(planBiomarkersSql, [treatmentPlanId], (err, rows) => err ? reject(err) : resolve(rows.map(r => ({...r, id: r.id.toString()})))));

    const timelineEntriesSql = `SELECT id, original_id, name, start_date, end_date, category, status FROM treatment_plan_timeline_entries WHERE treatment_plan_id = ? ORDER BY start_date ASC`;
    const timelineEntries = await new Promise((resolve, reject) => db.all(timelineEntriesSql, [treatmentPlanId], (err, rows) => err ? reject(err) : resolve(rows.map(r => ({...r, id: r.id.toString()})))));
    
    let assignedPractitioner = null;
    if (planRow.assigned_practitioner_id) {
      const practSql = `SELECT id, name, specialization, bio, image_url, rating, availability_text, location FROM practitioners WHERE id = ?`;
      assignedPractitioner = await new Promise((resolve, reject) => db.get(practSql, [planRow.assigned_practitioner_id], (err, row: any) => {
        if (err) reject(err); else resolve(row ? {...row, id: row.id.toString()} : null);
      }));
    }
    
    const upcomingConsultationsSql = `SELECT id, practitioner_name, specialization, consultation_date, consultation_time, mode FROM consultations WHERE treatment_plan_id = ? AND consultation_date >= date('now') ORDER BY consultation_date ASC, consultation_time ASC`;
    const upcomingConsultations = await new Promise((resolve, reject) => db.all(upcomingConsultationsSql, [treatmentPlanId], (err, rows) => err ? reject(err) : resolve(rows.map(r => ({...r, id: r.id.toString()})))));

    // Assemble the response object
    const response = {
      id: planRow.id.toString(),
      userId: planRow.user_id,
      problemOverview: { // Reconstruct this object
        problemTitle: planRow.problem_title,
        problemDescription: planRow.problem_description,
        treatmentPlanSummary: planRow.plan_summary,
        goals: planRow.goals ? JSON.parse(planRow.goals) : [], // Parse JSON string
      },
      milestones,
      biomarkers: planBiomarkers, // Renamed from planBiomarkers for consistency if frontend expects 'biomarkers'
      treatmentTimeline: timelineEntries,
      assignedPractitioner: assignedPractitioner, 
      upcomingConsultations,
      lastUpdated: planRow.last_updated, // Ensure this is a string (ISO format)
      createdAt: planRow.createdAt, // Ensure this is a string (ISO format)
      updatedAt: planRow.updatedAt  // Ensure this is a string (ISO format)
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching treatment plan (SQLite):', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
