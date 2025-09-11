import { NextResponse, NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { createServerWalletForUser, getServerWalletForUser } from "@/utils/cdp";
interface Payload {
  address: string;
  iat: number;
}
export async function GET(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  try {
    const decoded = jwt.verify(session, process.env.SESSION_SECRET!) as Payload;
    if (!decoded || typeof decoded !== "object" || !decoded.address) {
      throw new Error("Invalid token payload");
    }

    const userAddress = decoded.address;
    let serverWallet = getServerWalletForUser(userAddress);
    if (!serverWallet) {
      serverWallet = await createServerWalletForUser(userAddress);
    }
    return NextResponse.json({
      address: userAddress,
      serverWalletAdress: serverWallet.address,
      smartAccountAddress: serverWallet.smartAccount?.address,
      message: "Server wallet retrieved successfully",
    });
  } catch (err) {
    console.log("Error in session verification:", err);
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
