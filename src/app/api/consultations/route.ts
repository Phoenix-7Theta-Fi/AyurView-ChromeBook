import { connectToDb } from '@/lib/sqlite'; // Changed
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwtToken } from '@/lib/utils';
// Practitioner type might still be useful for type hints if fetching full practitioner data
import type { Practitioner } from '@/lib/types'; 

// Get JWT token from authorization header helper
async function getToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookiesList = await cookies(); // Ensure this runs only in context where cookies are available
  const token = cookiesList.get('token');
  return token?.value || null;
}

// Define what a decoded JWT payload looks like (ensure userId is number)
interface DecodedToken {
  userId: number;
  email: string;
  userType: 'regular' | 'practitioner';
  // add other fields if present in your JWT
}


// GET consultations, optionally filter by practitioner or date range
export async function GET(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized, no token" }, { status: 401 });
    
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser?.userId) {
      return NextResponse.json({ error: "Unauthorized or invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const practitionerId = searchParams.get('practitionerId');
    const startDate = searchParams.get('startDate'); // Expect YYYY-MM-DD
    const endDate = searchParams.get('endDate');   // Expect YYYY-MM-DD

    const db = await connectToDb();
    
    let sqlQuery = `SELECT id, user_id, practitioner_id, practitioner_name, specialization, consultation_date, consultation_time, mode, treatment_plan_id, createdAt, updatedAt FROM consultations WHERE 1=1`;
    const queryParams: any[] = [];

    // Filter by authenticated user if not a practitioner (practitioners might see all their appointments)
    // This logic might need refinement based on exact requirements for who can see what
    if (decodedUser.userType === 'regular') {
        sqlQuery += ` AND user_id = ?`;
        queryParams.push(decodedUser.userId);
    } else if (practitionerId) { // If practitioner is specified, and user is a practitioner, they might be viewing their own schedule
        sqlQuery += ` AND practitioner_id = ?`;
        queryParams.push(parseInt(practitionerId));
    }
    // If a regular user specifies a practitionerId, it might be for booking, not general fetching.
    // The current logic seems to allow any authenticated user to query by practitionerId.

    if (startDate) {
      sqlQuery += ` AND consultation_date >= ?`;
      queryParams.push(startDate);
    }
    if (endDate) {
      sqlQuery += ` AND consultation_date <= ?`;
      queryParams.push(endDate);
    }
    sqlQuery += ` ORDER BY consultation_date DESC, consultation_time DESC;`;

    const results = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({...row, id: row.id.toString() }))); // Ensure ID is string
      });
    });
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching consultations (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Book a new consultation
export async function POST(req: NextRequest) {
  try {
    const consultation = await req.json();
    const { practitionerId, date, time, mode, treatment_plan_id } = consultation; // Added treatment_plan_id

    if (!practitionerId || !date || !time || !mode) {
      return NextResponse.json({ error: 'Missing required fields: practitionerId, date, time, mode' }, { status: 400 });
    }
    
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized, no token for booking" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser?.userId) return NextResponse.json({ error: "Unauthorized or invalid token for booking" }, { status: 401 });
    const userId = decodedUser.userId;


    const db = await connectToDb();

    // Verify practitioner exists
    const practitioner: Practitioner | undefined = await new Promise((resolve, reject) => {
      db.get("SELECT id, name, specialization FROM practitioners WHERE id = ?", [practitionerId], (err, row) => {
        if (err) reject(err); else resolve(row as Practitioner | undefined);
      });
    });
    if (!practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }

    // Check if slot is available in practitioner_availability_slots table
    const availabilitySlot: { id: number } | undefined = await new Promise((resolve, reject) => {
        db.get("SELECT id FROM practitioner_availability_slots WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ? AND is_available = 1", 
        [practitionerId, date, time], (err, row) => {
            if (err) reject(err); else resolve(row as { id: number } | undefined);
        });
    });

    if (!availabilitySlot) {
      return NextResponse.json({ error: 'Time slot is not available or does not exist' }, { status: 400 });
    }
    
    // Check if this exact slot is already booked in consultations table (double check)
    const slotTaken: { id: number } | undefined = await new Promise((resolve, reject) => {
        db.get("SELECT id FROM consultations WHERE practitioner_id = ? AND consultation_date = ? AND consultation_time = ?",
        [practitionerId, date, time], (err, row) => {
            if(err) reject(err); else resolve(row as { id: number } | undefined);
        });
    });

    if (slotTaken) {
      return NextResponse.json({ error: 'Time slot already booked (consultation exists)' }, { status: 400 });
    }


    // Book the consultation (Insert into consultations table)
    const sqlInsert = `INSERT INTO consultations (user_id, practitioner_id, practitioner_name, specialization, consultation_date, consultation_time, mode, treatment_plan_id, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    const paramsInsert = [userId, practitionerId, practitioner.name, practitioner.specialization, date, time, mode, treatment_plan_id || null];
    
    const result = await new Promise<{ lastID: number }>((resolve, reject) => {
      db.run(sqlInsert, paramsInsert, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID });
      });
    });

    // Update the availability slot in practitioner_availability_slots to unavailable
    const sqlUpdateSlot = `UPDATE practitioner_availability_slots SET is_available = 0 WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ?`;
    await new Promise<void>((resolve, reject) => {
        db.run(sqlUpdateSlot, [practitionerId, date, time], function(err) {
            if (err) reject(err); else resolve();
        });
    });
    
    return NextResponse.json({ 
      success: true, 
      id: result.lastID.toString(),
      consultation: {
        id: result.lastID.toString(),
        userId: userId,
        practitionerId: practitionerId,
        practitionerName: practitioner.name,
        specialization: practitioner.specialization,
        date,
        time,
        mode,
        treatment_plan_id: treatment_plan_id || null
      }
    });
  } catch (error) {
    console.error('Error booking consultation (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Cancel a consultation
export async function DELETE(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    if (!idParam) return NextResponse.json({ error: 'Consultation ID is required' }, { status: 400 });
    const consultationId = parseInt(idParam);

    const db = await connectToDb();

    const consultation: { practitioner_id: number, consultation_date: string, consultation_time: string, user_id: number } | undefined = await new Promise((resolve, reject) => {
        db.get("SELECT practitioner_id, consultation_date, consultation_time, user_id FROM consultations WHERE id = ?", [consultationId], (err, row) => {
            if(err) reject(err); else resolve(row as any);
        });
    });

    if (!consultation) return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });

    // Add logic here to ensure only the user who booked or an admin/practitioner can delete
    if (decodedUser.userType === 'regular' && decodedUser.userId !== consultation.user_id) {
        return NextResponse.json({ error: 'Forbidden: You can only cancel your own consultations.' }, { status: 403 });
    }

    await new Promise<void>((resolve, reject) => {
        db.run("DELETE FROM consultations WHERE id = ?", [consultationId], function(err){
            if(err) reject(err); else resolve();
        });
    });

    const sqlUpdateSlot = `UPDATE practitioner_availability_slots SET is_available = 1 WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ?`;
    await new Promise<void>((resolve, reject) => {
        db.run(sqlUpdateSlot, [consultation.practitioner_id, consultation.consultation_date, consultation.consultation_time], function(err){
            if(err) reject(err); else resolve(); // Log error but try to continue
        });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling consultation (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Update consultation details (e.g., reschedule)
export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    if (!idParam) return NextResponse.json({ error: 'Consultation ID is required' }, { status: 400 });
    const consultationId = parseInt(idParam);

    const updates = await req.json();
    const { date: newDate, time: newTime, mode: newMode } = updates; // only allow rescheduling specific fields for now

    const db = await connectToDb();

    const currentConsultation: {id: number, practitioner_id: number, consultation_date: string, consultation_time: string, user_id: number} | undefined = await new Promise((resolve, reject) => {
        db.get("SELECT id, practitioner_id, consultation_date, consultation_time, user_id FROM consultations WHERE id = ?", [consultationId], (err, row) => {
            if(err) reject(err); else resolve(row as any);
        });
    });
    
    if (!currentConsultation) return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });

    if (decodedUser.userType === 'regular' && decodedUser.userId !== currentConsultation.user_id) {
        return NextResponse.json({ error: 'Forbidden: You can only update your own consultations.' }, { status: 403 });
    }

    if (newDate && newTime) { // If rescheduling
      // Check new slot availability in practitioner_availability_slots
      const newSlotAvailable: {id: number} | undefined = await new Promise((resolve, reject) => {
          db.get("SELECT id FROM practitioner_availability_slots WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ? AND (is_available = 1 OR (slot_date = ? AND slot_time = ?))", // allow if it's the current slot
          [currentConsultation.practitioner_id, newDate, newTime, currentConsultation.consultation_date, currentConsultation.consultation_time], (err, row) => {
              if(err) reject(err); else resolve(row as any);
          });
      });
      if (!newSlotAvailable) return NextResponse.json({ error: 'New time slot is not available' }, { status: 400 });

      // Check if another consultation (not this one) already booked the new slot
      const otherConsultationInNewSlot: {id:number} | undefined = await new Promise((resolve, reject) => {
          db.get("SELECT id FROM consultations WHERE practitioner_id = ? AND consultation_date = ? AND consultation_time = ? AND id != ?",
          [currentConsultation.practitioner_id, newDate, newTime, consultationId], (err, row) => {
              if(err) reject(err); else resolve(row as any);
          });
      });
      if (otherConsultationInNewSlot) return NextResponse.json({ error: 'New time slot is already booked by another consultation' }, { status: 400 });
      
      // Free up old slot
      await new Promise<void>((resolve, reject) => db.run("UPDATE practitioner_availability_slots SET is_available = 1 WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ?", [currentConsultation.practitioner_id, currentConsultation.consultation_date, currentConsultation.consultation_time], (e)=>e?reject(e):resolve()));
      // Book new slot
      await new Promise<void>((resolve, reject) => db.run("UPDATE practitioner_availability_slots SET is_available = 0 WHERE practitioner_id = ? AND slot_date = ? AND slot_time = ?", [currentConsultation.practitioner_id, newDate, newTime], (e)=>e?reject(e):resolve()));
    }

    // Update consultation (only specific fields)
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    if (newDate) { updateFields.push("consultation_date = ?"); updateValues.push(newDate); }
    if (newTime) { updateFields.push("consultation_time = ?"); updateValues.push(newTime); }
    if (newMode) { updateFields.push("mode = ?"); updateValues.push(newMode); }

    if (updateFields.length > 0) {
      updateFields.push("updatedAt = CURRENT_TIMESTAMP");
      updateValues.push(consultationId);
      const sqlUpdate = `UPDATE consultations SET ${updateFields.join(', ')} WHERE id = ?`;
      await new Promise<void>((resolve, reject) => db.run(sqlUpdate, updateValues, (e)=>e?reject(e):resolve()));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating consultation (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
