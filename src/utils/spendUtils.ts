import {
  fetchPermissions,
  getPermissionStatus,
  prepareSpendCallData,
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

export interface FullSpendPermission {
  account: string;
  spender: string;
  token: string;
  chainId: number;
  allowance: bigint;
  periodInDays: number;
  signature?: string;
  permissionHash?: string;
  start?: number;
  end?: number;
  rawPermission?: any; // Store the raw permission object from the SDK
}

const CHAIN_ID = 8453;

// USDC token config
const USDC = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
};

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

export async function getFullUserSpendPermissions(
  userAccount: string,
  spenderAccount: string
): Promise<FullSpendPermission[]> {
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
      account: p.permission?.account || userAccount,
      spender: p.permission?.spender || spenderAccount,
      token: USDC.address,
      chainId: CHAIN_ID,
      allowance: BigInt(p.permission?.allowance?.toString() || "0"),
      periodInDays: 1, // Default to daily
      signature: p.signature,
      permissionHash: p.permissionHash,
      start: p.permission?.start,
      end: p.permission?.end,
      rawPermission: p, // Store the complete raw permission object
    }));

    // Sort by creation time ascending
    return mapped.sort((a, b) => (a.start || 0) - (b.start || 0));
  } catch (error) {
    console.error("Failed to fetch full spend permissions:", error);
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
