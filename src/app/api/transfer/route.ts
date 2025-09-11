/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerWalletForUser, getCdpClient } from "@/utils/cdp";
import { encodeFunctionData, createPublicClient, http } from "viem";
import { base } from "viem/chains";

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
];

// USDC contract address on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      recipient,
      tokenAddress = USDC_ADDRESS,
      sender,
      amount,
      spendCalls,
    } = await req.json();

    if (
      !recipient ||
      !amount ||
      !sender ||
      !spendCalls ||
      !Array.isArray(spendCalls)
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: recipient, sender, amount, or spendCalls (array)",
        },
        { status: 400 }
      );
    }

    const amt = BigInt(amount.toString());
    const serverWallet = getServerWalletForUser(sender);
    if (!serverWallet?.smartAccount) {
      return NextResponse.json(
        { error: "Server wallet not found" },
        { status: 400 }
      );
    }

    const cdpClient = getCdpClient();

    // Step 1: Execute all spend calls to pull USDC from user account to smart wallet
    console.log(`Executing ${spendCalls.length} spend calls to pull funds...`);
    console.log("Raw spend calls:", JSON.stringify(spendCalls, null, 2));

    // Validate and format spend calls
    const pullCalls = spendCalls.map((spendCall: any, index: number) => {
      const spendValue = spendCall[0];
      if (!spendValue.to) {
        throw new Error(`Spend call at index ${index} is missing 'to' field`);
      }

      const call: any = {
        to: spendValue.to as `0x${string}`,
        data: spendValue.data as `0x${string}`,
      };

      // Only add value if it exists and is greater than 0
      if (spendValue.value && BigInt(spendValue.value.toString()) > BigInt(0)) {
        call.value = BigInt(spendValue.value.toString());
      }

      console.log(`Spend call ${index}:`, call);
      return call;
    });

    const pullResult = await cdpClient.evm.sendUserOperation({
      smartAccount: serverWallet.smartAccount,
      network: "base",
      calls: pullCalls,
      paymasterUrl: process.env.PAYMASTER_URL,
    });

    console.log("Funds pulled into smart wallet:", pullResult.userOpHash);

    // Step 2: Transfer USDC from smart wallet to recipient
    const transferCalls: any[] = [];

    // ERC20 transfer (USDC)
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient as `0x${string}`, amt],
    });

    transferCalls.push({
      to: tokenAddress as `0x${string}`,
      data: transferData,
    });

    console.log(`Transferring ${amt.toString()} USDC to recipient...`);

    const transferResult = await cdpClient.evm.sendUserOperation({
      smartAccount: serverWallet.smartAccount,
      network: "base",
      calls: transferCalls,
      paymasterUrl: process.env.PAYMASTER_URL,
    });

    console.log("Transfer to recipient completed:", transferResult.userOpHash);

    return NextResponse.json({
      success: true,
      message: "✅ USDC transfer completed successfully",
      pullUserOpHash: pullResult.userOpHash,
      transferUserOpHash: transferResult.userOpHash,
      amount: amt.toString(),
      recipient,
      tokenAddress: tokenAddress || "native",
      explorerUrl: `https://account.base.app/activity`,
      details: {
        spendCallsExecuted: spendCalls.length,
        totalAmount: amt.toString(),
      },
    });
  } catch (err) {
    console.error("Transfer error:", err);
    return NextResponse.json(
      {
        error: "Transfer failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
