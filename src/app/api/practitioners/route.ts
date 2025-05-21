import { connectToDb } from '@/lib/sqlite'; // Changed
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // Still used by getToken
import { verifyJwtToken } from '@/lib/utils'; // For admin actions

// Get JWT token from authorization header helper
async function getToken(req: NextRequest): Promise<string | null> { // Return type can be null
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookiesList = await cookies();
  const token = cookiesList.get('token');
  return token?.value || null;
}

interface DecodedToken { // Assuming verifyJwtToken decodes to this structure
    userId: number;
    userType: string; // e.g. 'admin', 'regular', 'practitioner'
    // Add other fields as necessary
}

// GET all practitioners or filter by specialization/location
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const specialization = searchParams.get('specialization');
    const location = searchParams.get('location');
    const practitionerId = searchParams.get('id'); // For fetching a single practitioner

    const db = await connectToDb();
    
    let sqlQuery = `
      SELECT id, original_id, name, gender, specialization, bio, rating, 
             availability_text, location, image_url, data_ai_hint, 
             createdAt, updatedAt 
      FROM practitioners
    `;
    const queryParams: any[] = [];

    if (practitionerId) {
      sqlQuery += " WHERE id = ?";
      queryParams.push(parseInt(practitionerId));
    } else {
      let conditions: string[] = [];
      if (specialization) {
        conditions.push("specialization LIKE ?");
        queryParams.push(`%${specialization}%`);
      }
      if (location) {
        conditions.push("location LIKE ?");
        queryParams.push(`%${location}%`);
      }
      if (conditions.length > 0) {
        sqlQuery += " WHERE " + conditions.join(" AND ");
      }
    }
    sqlQuery += " ORDER BY name ASC;";

    const practitionersList = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // For each practitioner, fetch their availability slots
    const resultWithSlots = await Promise.all(practitionersList.map(async (p) => {
      const slotsSql = `
        SELECT slot_date, slot_time, is_available 
        FROM practitioner_availability_slots 
        WHERE practitioner_id = ? 
        ORDER BY slot_date, slot_time;
      `;
      const slots = await new Promise<any[]>((resolve, reject) => {
        db.all(slotsSql, [p.id], (err, slotRows) => {
          if (err) reject(err);
          // Map is_available from 0/1 to boolean for frontend consistency
          else resolve(slotRows.map(s => ({ date: s.slot_date, time: s.slot_time, available: Boolean(s.is_available) })));
        });
      });
      return { ...p, id: p.id.toString(), availabilitySlots: slots };
    }));
    
    // If a single practitioner was requested by ID, return that object, otherwise the array
    if (practitionerId && resultWithSlots.length === 1) {
        return NextResponse.json(resultWithSlots[0]);
    }
    if (practitionerId && resultWithSlots.length === 0) {
        return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }

    return NextResponse.json(resultWithSlots);
  } catch (error) {
    console.error('Error fetching practitioners (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST endpoint for creating a new practitioner (admin only)
export async function POST(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    // Add admin check here if `verifyJwtToken` doesn't handle it.
    // e.g. if (decodedUser?.userType !== 'admin') return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!decodedUser) return NextResponse.json({ error: "Invalid token" }, { status: 401 });


    const practitionerData = await req.json();
    const { name, gender, specialization, bio, rating, availability_text, location, image_url, data_ai_hint, original_id, availabilitySlots } = practitionerData;

    // Validate required fields
    if (!name || !specialization) {
        return NextResponse.json({ error: "Name and specialization are required." }, { status: 400 });
    }

    const db = await connectToDb();
    
    const sqlInsertPractitioner = `
      INSERT INTO practitioners 
      (name, gender, specialization, bio, rating, availability_text, location, image_url, data_ai_hint, original_id, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    const practitionerParams = [name, gender, specialization, bio, rating, availability_text, location, image_url, data_ai_hint, original_id || null];
    
    const result = await new Promise<{ lastID: number }>((resolve, reject) => {
      db.run(sqlInsertPractitioner, practitionerParams, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID });
      });
    });
    const newPractitionerId = result.lastID;

    // If availabilitySlots are provided, insert them
    if (availabilitySlots && Array.isArray(availabilitySlots) && newPractitionerId) {
        const slotStmt = db.prepare(`
            INSERT INTO practitioner_availability_slots
            (practitioner_id, slot_date, slot_time, is_available, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        for (const slot of availabilitySlots) {
            if (slot.date && slot.time) { // Basic validation for slot
                 await new Promise<void>(rs => slotStmt.run(newPractitionerId, slot.date, slot.time, slot.available === undefined ? 1 : (slot.available ? 1 : 0), rs));
            }
        }
        slotStmt.finalize();
    }

    return NextResponse.json({ success: true, id: newPractitionerId.toString() });
  } catch (error) {
    console.error('Error creating practitioner (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH endpoint for updating practitioner details (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    // Add admin check if needed

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    if (!idParam) return NextResponse.json({ error: 'Practitioner ID is required' }, { status: 400 });
    const practitionerId = parseInt(idParam);

    const updates = await req.json();
    // Exclude id, createdAt, updatedAt from direct updates if they are in `updates` object
    const { id, createdAt, updatedAt, availabilitySlots, ...validUpdates } = updates; 

    if (Object.keys(validUpdates).length === 0 && !availabilitySlots) {
        return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }
    
    const db = await connectToDb();
    
    if (Object.keys(validUpdates).length > 0) {
        const fields = Object.keys(validUpdates).map(key => `${key.replace(/([A-Z])/g, "_$1").toLowerCase()} = ?`).join(', '); // Camel to snake_case
        const values = Object.values(validUpdates);
        values.push(practitionerId);

        const sqlUpdate = `UPDATE practitioners SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        const result = await new Promise<{ changes: number }>((resolve, reject) => {
        db.run(sqlUpdate, values, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
        });
        if (result.changes === 0 && !availabilitySlots) { // if no other fields updated and no slots, then not found
             return NextResponse.json({ error: 'Practitioner not found or no changes made' }, { status: 404 });
        }
    }
    
    // Handle availabilitySlots update: delete existing and insert new ones
    if (availabilitySlots && Array.isArray(availabilitySlots)) {
        await new Promise<void>((resolve,reject) => db.run("DELETE FROM practitioner_availability_slots WHERE practitioner_id = ?", [practitionerId], (e)=>e?reject(e):resolve() ));
        
        const slotStmt = db.prepare(`
            INSERT INTO practitioner_availability_slots
            (practitioner_id, slot_date, slot_time, is_available, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        for (const slot of availabilitySlots) {
            if (slot.date && slot.time) {
                 await new Promise<void>(rs => slotStmt.run(practitionerId, slot.date, slot.time, slot.available === undefined ? 1 : (slot.available ? 1 : 0), rs));
            }
        }
        slotStmt.finalize();
    }


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating practitioner (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE endpoint for removing a practitioner (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decodedUser = await verifyJwtToken(token) as DecodedToken | null;
    if (!decodedUser) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    // Add admin check if needed

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    if (!idParam) return NextResponse.json({ error: 'Practitioner ID is required' }, { status: 400 });
    const practitionerId = parseInt(idParam);
    
    const db = await connectToDb();

    // The ON DELETE CASCADE on practitioner_availability_slots.practitioner_id 
    // should handle deleting associated slots automatically.
    const result = await new Promise<{ changes: number }>((resolve, reject) => {
      db.run("DELETE FROM practitioners WHERE id = ?", [practitionerId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting practitioner (SQLite):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
