import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const practitionerId = params.id;

    if (!ObjectId.isValid(practitionerId)) {
      return NextResponse.json({ message: 'Invalid practitioner ID format' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Find distinct userIds from consultations for the given practitionerId
    const patientIds = await db.collection('consultations').distinct('userId', {
      practitionerId: new ObjectId(practitionerId),
    });

    if (!patientIds || patientIds.length === 0) {
      return NextResponse.json({ message: 'No patients found for this practitioner' }, { status: 404 });
    }

    // Fetch user details for each patientId
    // Ensure patientIds are converted to ObjectId if they are not already
    const patientObjectIds = patientIds.map(id => id instanceof ObjectId ? id : new ObjectId(id));

    const patients = await db.collection<User>('users').find({
      _id: { $in: patientObjectIds },
    }).toArray();

    if (!patients || patients.length === 0) {
      // This case should ideally not be reached if patientIds were found,
      // but it's a good safeguard.
      return NextResponse.json({ message: 'Patient details not found' }, { status: 404 });
    }

    return NextResponse.json(patients, { status: 200 });

  } catch (error) {
    console.error('Failed to fetch patients:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
