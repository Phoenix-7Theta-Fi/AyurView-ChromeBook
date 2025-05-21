import { connectToDb } from '@/lib/sqlite'; // Changed
import { verifyJwtToken } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
// ObjectId no longer needed

// Interface for the product structure expected by the frontend (if specific)
// This can be similar to the MongoProduct but without _id and Date types if SQLite returns strings
interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  dataAiHint?: string;
  category: string;
  stock: number;
  // createdAt and updatedAt are usually not directly sent unless needed
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const verified = await verifyJwtToken(token); // Assuming verifyJwtToken returns a payload or throws
    if (!verified) { // Check depends on what verifyJwtToken returns upon failure
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const db = await connectToDb();
    
    let sqlQuery = `
      SELECT id, name, description, price, image_url, data_ai_hint, category, stock, createdAt, updatedAt 
      FROM products 
      WHERE 1=1
    `; // Using 1=1 to easily append AND conditions
    const queryParams: any[] = [];

    if (category) {
      sqlQuery += " AND category = ?";
      queryParams.push(category);
    }
    if (search) {
      sqlQuery += " AND (name LIKE ? OR description LIKE ?)";
      queryParams.push(`%${search}%`);
      queryParams.push(`%${search}%`);
    }

    sqlQuery += " ORDER BY category ASC, name ASC;";

    console.log('Executing SQL (Products):', sqlQuery);
    console.log('With params:', queryParams);

    const products = await new Promise<any[]>((resolve, reject) => {
      db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) {
          console.error("SQL Error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const mappedProducts: ProductResponse[] = products.map((product) => ({
      id: product.id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.image_url,
      dataAiHint: product.data_ai_hint,
      category: product.category,
      stock: product.stock
      // createdAt and updatedAt can be added if needed by frontend
    }));

    return NextResponse.json(mappedProducts);
  } catch (error: any) {
    console.error('Error fetching products (SQLite):', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
