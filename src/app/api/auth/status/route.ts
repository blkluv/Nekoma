import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
interface Payload {
  address: string;
  iat: number;
}
export async function GET(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.json({
      isAuthenticated: false,
      error: "No session",
    });
  }
  try {
    const decoded = jwt.verify(session, process.env.SESSION_SECRET!);
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("address" in decoded) ||
      !("iat" in decoded)
    ) {
      throw new Error("Invalid token payload");
    }
    const payload = decoded as Payload;
    console.log("Session valid for address:", payload);
    return NextResponse.json({
      isAuthenticated: true,
      address: payload.address,
    });
  } catch (e) {
    return NextResponse.json({
      isAuthenticated: false,
      error: "Invalid session",
    });
  }
}
