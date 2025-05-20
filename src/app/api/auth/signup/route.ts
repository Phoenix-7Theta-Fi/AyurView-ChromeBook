import { NextResponse } from "next/server";
import { createUser } from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  userType: z.enum(["regular", "practitioner"], {
    required_error: "User type is required",
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password, userType } = result.data;

    // Create user in the database
    // Ensure createUser is updated to accept userType
    const user = await createUser(name, email, password, userType); 

    // Generate JWT token - include userType if needed for client-side logic immediately after signup
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "7d" }
    );
    // The user object returned by createUser should already include userType
    return NextResponse.json({ token, user }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    if (error instanceof Error && error.message === "User already exists") {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
