import {
  fetchPermissions,
  requestSpendPermission,
} from "@base-org/account/spend-permission";

import { ethers, JsonRpcProvider } from "ethers";
import { createBaseAccountSDK } from "@base-org/account";
export interface SpendPermissionSummary {
  token: string;
  tokenName: string; // token symbol or name
  allowance: string;
  account: string;
  spender: string;
}

const CHAIN_ID = 8453;
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

export async function allocateSpendPermission(
  userAccount: string,
  spenderAccount: string,
  tokenAddress: string,
  dailyLimit: number = 2,
  decimals: number = 6
): Promise<SpendPermissionSummary | null> {
  try {
    const allowance = BigInt(Math.floor(dailyLimit * 10 ** decimals));
    const sdk = createBaseAccountSDK({
      appName: "Coinbase Agent",
    });
    const permission = await requestSpendPermission({
      account: userAccount as `0x${string}`,
      spender: spenderAccount as `0x${string}`,
      token: tokenAddress as `0x${string}`,
      chainId: CHAIN_ID,
      allowance,
      periodInDays: 1,
      provider: sdk.getProvider(),
    });
    console.log("Spend permission allocated:", permission);

    return {
      token: tokenAddress,
      tokenName: tokenAddress,
      allowance: allowance.toString(),
      account: userAccount,
      spender: spenderAccount,
    };
  } catch (error) {
    console.error("Failed to allocate spend permission:", error);
    return null;
  }
}

export async function getUserSpendPermissions(
  userAccount: string,
  spenderAccount: string,
  tokenAddress?: string
): Promise<SpendPermissionSummary[]> {
  try {
    const sdk = createBaseAccountSDK({
      appName: "Coinbase Agent",
    });
    const permissions = await fetchPermissions({
      account: userAccount as `0x${string}`,
      chainId: CHAIN_ID,
      spender: spenderAccount as `0x${string}`,
      provider: sdk.getProvider(),
    });

    if (!permissions || permissions.length === 0) return [];

    let filtered = permissions;
    if (tokenAddress) {
      filtered = permissions.filter(
        (p) => p.permission?.token?.toLowerCase() === tokenAddress.toLowerCase()
      );
    }

    const ethersProvider = new JsonRpcProvider("https://base-mainnet.rpc.url");

    const results: SpendPermissionSummary[] = await Promise.all(
      filtered.map(async (p) => {
        const tokenAddr = p.permission?.token || "";
        let tokenName = tokenAddr;

        try {
          const contract = new ethers.Contract(
            tokenAddr,
            ERC20_ABI,
            ethersProvider
          );
          tokenName = await contract.symbol();
        } catch (err) {
          console.log(err);
          console.warn(
            `Failed to fetch token symbol for ${tokenAddr}, using address as fallback`
          );
        }

        return {
          token: tokenAddr,
          tokenName,
          allowance: p.permission?.allowance?.toString() || "0",
          account: p.permission?.account || userAccount,
          spender: p.permission?.spender || spenderAccount,
        };
      })
    );

    return results;
  } catch (error) {
    console.error("Failed to fetch spend permissions:", error);
    return [];
  }
}
