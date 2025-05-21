import { NextRequest, NextResponse } from 'next/server';
import { connectToDb } from '@/lib/sqlite'; // Changed
import { verify } from 'jsonwebtoken';
// ObjectId no longer needed

// Interface for data coming from SQLite (column names)
interface YogaPracticeDbRow {
  id: number; // or string if converted before this point
  user_id: number;
  timestamp: string; // ISO8601 string
  type: string;
  practice: string;
  sub_practice: string;
  element: string;
  duration_minutes: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  completed: number; // 0 or 1
}

// Interface for the structure expected by transformToSunburstData
interface YogaPracticeTransformed {
  userId: number; // Keep consistent if needed, or remove if only for internal processing
  timestamp: Date; // transformToSunburstData might expect Date objects
  type: string;
  practice: string;
  subPractice: string; // Changed from sub_practice
  element: string;
  duration: number; // Changed from duration_minutes
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  completed: boolean; // Changed from number
}


interface SunburstNode {
  name: string;
  value: number;
  children?: SunburstNode[];
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: number; // Expect numeric userId
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication token required' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as DecodedToken;
    const userId = decoded.userId; // Numeric ID

    const searchParams = req.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate'); // Expect ISO8601 Date string
    const endDateParam = searchParams.get('endDate');     // Expect ISO8601 Date string

    const db = await connectToDb();

    let sqlQuery = `
      SELECT id, user_id, timestamp, type, practice, sub_practice, element, 
             duration_minutes, difficulty, completed 
      FROM yoga_practices_log 
      WHERE user_id = ?`;
    const queryParams: any[] = [userId];

    if (startDateParam) {
      // Basic validation, can be more robust
      if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(startDateParam) && !/\d{4}-\d{2}-\d{2}/.test(startDateParam)) {
          return NextResponse.json({ error: 'Invalid startDate format, use YYYY-MM-DD or ISO String' }, { status: 400 });
      }
      sqlQuery += ` AND timestamp >= ?`;
      queryParams.push(startDateParam);
    }
    if (endDateParam) {
      if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(endDateParam) && !/\d{4}-\d{2}-\d{2}/.test(endDateParam)) {
        return NextResponse.json({ error: 'Invalid endDate format, use YYYY-MM-DD or ISO String' }, { status: 400 });
      }
      sqlQuery += ` AND timestamp <= ?`;
      queryParams.push(endDateParam);
    }
    sqlQuery += ` ORDER BY timestamp DESC;`;

    console.log('Executing SQL (Yoga Practices):', sqlQuery);
    console.log('With params:', queryParams);

    const practicesDbData = await new Promise<YogaPracticeDbRow[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows as YogaPracticeDbRow[]);
        }
      });
    });

    // Transform data for the sunburst chart function
    const practicesForSunburst: YogaPracticeTransformed[] = practicesDbData.map(p => ({
        userId: p.user_id,
        timestamp: new Date(p.timestamp), // Convert ISO string to Date object
        type: p.type,
        practice: p.practice,
        subPractice: p.sub_practice,
        element: p.element,
        duration: p.duration_minutes,
        difficulty: p.difficulty,
        completed: Boolean(p.completed)
    }));
    
    const transformedData = transformToSunburstData(practicesForSunburst);

    return NextResponse.json(transformedData);
  } catch (error: any) {
    console.error('Error fetching yoga practices (SQLite):', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch yoga practices' },
      { status: 500 }
    );
  }
}

function transformToSunburstData(practices: YogaPractice[]): SunburstNode[] {
  // Step 1: Group and aggregate data
  const groupedData = practices.reduce((acc: Record<string, {
    totalDuration: number;
    practices: Record<string, {
      totalDuration: number;
      subPractices: Record<string, {
        totalDuration: number;
        elements: Record<string, { totalDuration: number }>;
      }>;
    }>;
  }>, practice) => {
    // Initialize type level
    if (!acc[practice.type]) {
      acc[practice.type] = { totalDuration: 0, practices: {} };
    }

    // Initialize practice level
    if (!acc[practice.type].practices[practice.practice]) {
      acc[practice.type].practices[practice.practice] = { totalDuration: 0, subPractices: {} };
    }

    // Initialize subPractice level
    if (!acc[practice.type].practices[practice.practice].subPractices[practice.subPractice]) {
      acc[practice.type].practices[practice.practice].subPractices[practice.subPractice] = {
        totalDuration: 0,
        elements: {},
      };
    }

    // Initialize element level
    if (!acc[practice.type].practices[practice.practice].subPractices[practice.subPractice].elements[practice.element]) {
      acc[practice.type].practices[practice.practice].subPractices[practice.subPractice].elements[practice.element] = {
        totalDuration: 0,
      };
    }

    // Update durations
    const duration = practice.duration;
    acc[practice.type].totalDuration += duration;
    acc[practice.type].practices[practice.practice].totalDuration += duration;
    acc[practice.type].practices[practice.practice].subPractices[practice.subPractice].totalDuration += duration;
    acc[practice.type].practices[practice.practice].subPractices[practice.subPractice].elements[practice.element].totalDuration += duration;

    return acc;
  }, {});

  // Step 2: Transform to sunburst format
  return Object.entries(groupedData).map(([type, typeData]): SunburstNode => ({
    name: type,
    value: typeData.totalDuration,
    children: Object.entries(typeData.practices).map(([practice, practiceData]): SunburstNode => ({
      name: practice,
      value: practiceData.totalDuration,
      children: Object.entries(practiceData.subPractices).map(([subPractice, subPracticeData]): SunburstNode => ({
        name: subPractice,
        value: subPracticeData.totalDuration,
        children: Object.entries(subPracticeData.elements).map(([element, elementData]): SunburstNode => ({
          name: element,
          value: elementData.totalDuration,
        })),
      })),
    })),
  }));
}
