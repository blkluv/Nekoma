import {
  fetchPermissions,
  requestSpendPermission,
} from "@base-org/account/spend-permission";

import { createBaseAccountSDK } from "@base-org/account";

export interface SpendPermissionSummary {
  token: string;
  tokenName: string;
  allowance: string;
  account: string;
  spender: string;
  createdAt?: number;
}

const CHAIN_ID = 8453;

// USDC token config
const USDC = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
};

export async function allocateSpendPermission(
  userAccount: string,
  spenderAccount: string,
  dailyLimit: number = 2
): Promise<SpendPermissionSummary | null> {
  try {
    const allowance = BigInt(Math.floor(dailyLimit * 10 ** USDC.decimals));
    const sdk = createBaseAccountSDK({ appName: "Coinbase Agent" });

    const permission = await requestSpendPermission({
      account: userAccount as `0x${string}`,
      spender: spenderAccount as `0x${string}`,
      token: USDC.address as `0x${string}`,
      chainId: CHAIN_ID,
      allowance,
      periodInDays: 1,
      provider: sdk.getProvider(),
    });

    return {
      token: USDC.address,
      tokenName: USDC.symbol,
      allowance: allowance.toString(),
      account: userAccount,
      spender: spenderAccount,
      createdAt: Date.now(), // track creation timestamp
    };
  } catch (error) {
    console.error("Failed to allocate spend permission:", error);
    return null;
  }
}

export async function getUserSpendPermissions(
  userAccount: string,
  spenderAccount: string
): Promise<SpendPermissionSummary[]> {
  try {
    const sdk = createBaseAccountSDK({ appName: "Coinbase Agent" });
    const permissions = await fetchPermissions({
      account: userAccount as `0x${string}`,
      chainId: CHAIN_ID,
      spender: spenderAccount as `0x${string}`,
      provider: sdk.getProvider(),
    });

    if (!permissions || permissions.length === 0) return [];

    const filtered = permissions.filter(
      (p) => p.permission?.token?.toLowerCase() === USDC.address.toLowerCase()
    );

    const mapped = filtered.map((p) => ({
      token: USDC.address,
      tokenName: USDC.symbol,
      allowance: p.permission?.allowance?.toString() || "0",
      account: p.permission?.account || userAccount,
      spender: p.permission?.spender || spenderAccount,
      createdAt: p.permission.start || Date.now(),
    }));

    // Sort by creation time ascending
    return mapped.sort((a, b) => a.createdAt! - b.createdAt!);
  } catch (error) {
    console.error("Failed to fetch spend permissions:", error);
    return [];
  }
}

export function formatAllowance(allowance: string): string {
  try {
    const amount = Number(allowance) / 10 ** USDC.decimals;
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  } catch {
    return "0.00";
  }
}

export function getRawPermissions(userAccount: string, spenderAccount: string) {
  const permissions = fetchPermissions({
    account: userAccount as `0x${string}`,
    chainId: CHAIN_ID,
    spender: spenderAccount as `0x${string}`,
    provider: createBaseAccountSDK({ appName: "Coinbase Agent" }).getProvider(),
  });
  return permissions;
}
