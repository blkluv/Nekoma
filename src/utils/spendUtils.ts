import {
  fetchPermissions,
  requestSpendPermission,
} from "@base-org/account/spend-permission";

import { ethers, JsonRpcProvider } from "ethers";
import { createBaseAccountSDK } from "@base-org/account";

export interface SpendPermissionSummary {
  token: string;
  tokenName: string;
  allowance: string;
  account: string;
  spender: string;
}

const CHAIN_ID = 8453;
const BASE_RPC_URL = "https://mainnet.base.org";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// Token addresses and their symbols for fallback
const TOKEN_SYMBOLS: { [key: string]: string } = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC", // Base USDC
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": "USDT", // Base USDT
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI", // Base DAI
  "0x4200000000000000000000000000000000000006": "WETH", // Base WETH
};

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

    // Get token symbol for display
    const tokenSymbol = await getTokenSymbol(tokenAddress);

    return {
      token: tokenAddress,
      tokenName: tokenSymbol,
      allowance: allowance.toString(),
      account: userAccount,
      spender: spenderAccount,
    };
  } catch (error) {
    console.error("Failed to allocate spend permission:", error);
    return null;
  }
}

// Helper function to get token symbol
async function getTokenSymbol(tokenAddress: string): Promise<string> {
  // Try fallback first for known tokens
  const fallbackSymbol = TOKEN_SYMBOLS[tokenAddress.toLowerCase()];
  if (fallbackSymbol) {
    return fallbackSymbol;
  }

  // Try to fetch from contract
  try {
    const ethersProvider = new JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      ethersProvider
    );
    return await contract.symbol();
  } catch (err) {
    console.warn(`Failed to fetch token symbol for ${tokenAddress}:`, err);
    return `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
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

    if (!permissions || permissions.length === 0) {
      console.log("No permissions found");
      return [];
    }

    console.log("Raw permissions:", permissions);

    let filtered = permissions;
    if (tokenAddress) {
      filtered = permissions.filter(
        (p) => p.permission?.token?.toLowerCase() === tokenAddress.toLowerCase()
      );
    }

    const ethersProvider = new JsonRpcProvider(BASE_RPC_URL);

    const results: SpendPermissionSummary[] = await Promise.all(
      filtered.map(async (p) => {
        const tokenAddr = p.permission?.token || "";
        let tokenName = tokenAddr;

        // First try the fallback map
        const fallbackSymbol = TOKEN_SYMBOLS[tokenAddr.toLowerCase()];
        if (fallbackSymbol) {
          tokenName = fallbackSymbol;
        } else {
          // Try to fetch from contract
          try {
            const contract = new ethers.Contract(
              tokenAddr,
              ERC20_ABI,
              ethersProvider
            );
            tokenName = await contract.symbol();
          } catch (err) {
            console.warn(
              `Failed to fetch token symbol for ${tokenAddr}, using address as fallback:`,
              err
            );
            tokenName = `${tokenAddr.slice(0, 6)}...${tokenAddr.slice(-4)}`;
          }
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

    console.log("Processed permissions:", results);
    return results;
  } catch (error) {
    console.error("Failed to fetch spend permissions:", error);
    return [];
  }
}

export function addTokenSymbol(address: string, symbol: string) {
  TOKEN_SYMBOLS[address.toLowerCase()] = symbol;
}

export function getSupportedTokens() {
  return Object.entries(TOKEN_SYMBOLS).map(([address, symbol]) => ({
    address,
    symbol,
  }));
}

export function isTokenSupported(address: string): boolean {
  return address.toLowerCase() in TOKEN_SYMBOLS;
}

export function formatAllowance(
  allowance: string,
  decimals: number = 6
): string {
  try {
    const amount = Number(allowance) / Math.pow(10, decimals);
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  } catch {
    return "0.00";
  }
}
