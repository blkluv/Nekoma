import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import jwt from "jsonwebtoken";

const client = createPublicClient({ chain: base, transport: http() });
const nonces = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json();

    if (!address || !message || !signature) {
      return NextResponse.json(
        {
          error: "Missing required fields: address, message, signature",
        },
        { status: 400 }
      );
    }

    console.log("Verifying signature for address:", address);
    const nonce = message.match(/Nonce: (\w+)/)?.[1];
    if (!nonce) {
      return NextResponse.json(
        {
          error: "Invalid message format - nonce not found",
        },
        { status: 400 }
      );
    }

    if (!nonces.has(nonce)) {
      return NextResponse.json(
        {
          error: "Invalid or expired nonce",
        },
        { status: 401 }
      );
    }

    nonces.delete(nonce);

    const isValid = await client.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json(
        {
          error: "Invalid signature",
        },
        { status: 401 }
      );
    }

    console.log("✅ Signature verified successfully for address:", address);

    const sessionToken = jwt.sign(
      {
        address,
        timestamp: Date.now(),
      },
      process.env.SESSION_SECRET!
    );

    const response = NextResponse.json({
      ok: true,
      address,
      sessionToken,
    });

    // Set session cookie
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error("Auth verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Generate a secure random nonce
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  // Add to nonce store
  nonces.add(nonce);

  console.log("Generated nonce:", nonce);
  return NextResponse.json({ nonce });
}
