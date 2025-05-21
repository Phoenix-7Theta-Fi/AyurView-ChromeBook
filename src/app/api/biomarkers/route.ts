import { connectToDb } from "@/lib/sqlite"; // Changed to sqlite
import { NextResponse } from "next/server";
// ObjectId is no longer needed from mongodb
import { startOfDay, endOfDay } from "date-fns";
import jwt from "jsonwebtoken";

// Helper function to verify JWT token
// Token now contains numeric userId
function verifyToken(token: string): { userId: number; email: string, userType: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "default-secret") as { userId: number; email: string, userType: string };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  console.log('Biomarkers API called (SQLite)');
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    
    if (!decoded?.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const biomarkerTypes = searchParams.get("types")?.split(",") || [];

    // Set date range
    const startDate = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(new Date());
    const endDate = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());

    // Connect to database
    const client = await connectToDb();
    const db = client.db("ayurview");

    // Get user ID
    const user = await db.collection("users").findOne({ email: decoded.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build query to handle both string and ObjectId formats for userId
    const query: any = {
      $or: [
        { userId: new ObjectId(user._id) },  // Match ObjectId format
        { userId: user._id.toString() }      // Match string format
      ],
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    console.log('User ID from token:', user._id);
    console.log('Query $or conditions:', query.$or);
    console.log('Date range:', { startDate, endDate });

    // Add biomarker type filter if specified
    if (biomarkerTypes.length > 0) {
      query.biomarkerName = { $in: biomarkerTypes };
    }

    console.log('Query:', query);
    
    // Fetch the latest record for each biomarker type
    const biomarkerData = await db.collection("biomarkers").aggregate([
      { $match: query },
      { 
        $sort: { 
          biomarkerName: 1,
          date: -1 
        }
      },
      {
        $group: {
          _id: "$biomarkerName",
          id: { $first: "$_id" },
          biomarkerName: { $first: "$biomarkerName" },
          value: { $first: "$value" },
          unit: { $first: "$unit" },
          date: { $first: "$date" },
          referenceRange: { $first: "$referenceRange" },
          targetValue: { $first: "$targetValue" }
        }
      },
      { $sort: { biomarkerName: 1 } }
    ]).toArray();

    console.log('Found biomarker records:', biomarkerData.length);
    if (biomarkerData.length > 0) {
      console.log('Sample record:', JSON.stringify(biomarkerData[0], null, 2));
    }

    // Transform MongoDB documents for client
    const transformedData = biomarkerData.map(record => {
      // Convert _id to id string
      const { _id, ...rest } = record;
      return {
        id: _id.toString(),  // Ensure consistent id field
        ...rest  // Keep all other fields
      };
    });

    console.log('Sample transformed record:', transformedData[0]);

    const response = {
      success: true,
      data: transformedData,
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRecords: transformedData.length
      }
    };

    console.log('Sending response with', transformedData.length, 'records');
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching biomarker data:", error);
    return NextResponse.json(
      { error: "Failed to fetch biomarker data" },
      { status: 500 }
    );
  }
}
