/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { requestSpendPermission } from "@base-org/account/spend-permission";
import { createBaseAccountSDK } from "@base-org/account";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "./ui/select";
import {
  getUserSpendPermissions,
  SpendPermissionSummary,
} from "@/utils/spendUtils";

interface ServerWalletResponse {
  address: string;
  smartAccountAddress?: string;
}

const CHAIN_ID = 8453; // Base mainnet

// Predefined stable tokens with Base addresses
const TOKENS = [
  {
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
  },
  {
    symbol: "DAI",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
  },
];

const SpendSection = () => {
  const [userAddress, setUserAddress] = useState<string>("");
  const [spenderAddress, setSpenderAddress] = useState<string>("");
  const [permissions, setPermissions] = useState<SpendPermissionSummary[]>([]);
  const [selectedToken, setSelectedToken] = useState(TOKENS[0].address);
  const [dailyLimit, setDailyLimit] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [fetchingPermissions, setFetchingPermissions] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchServerWallet = async () => {
    try {
      const res = await fetch("/api/serverwallet");
      const data: ServerWalletResponse = await res.json();
      setUserAddress(data.address);
      if (data.smartAccountAddress) {
        setSpenderAddress(data.smartAccountAddress);
      }
    } catch (err) {
      console.error("Failed to fetch server wallet", err);
      setError("Failed to fetch server wallet");
    }
  };

  // Fetch permissions using the utility function
  const fetchPermissions = async () => {
    if (!userAddress || !spenderAddress) return;

    setFetchingPermissions(true);
    try {
      const fetchedPermissions = await getUserSpendPermissions(
        userAddress,
        spenderAddress
      );
      setPermissions(fetchedPermissions);
    } catch (err) {
      console.error("Failed to fetch permissions", err);
      setError("Failed to fetch permissions");
    } finally {
      setFetchingPermissions(false);
    }
  };

  useEffect(() => {
    fetchServerWallet();
  }, []);

  useEffect(() => {
    if (userAddress && spenderAddress) {
      fetchPermissions();
    }
  }, [userAddress, spenderAddress]);

  // Format allowance for display
  const formatAllowance = (allowance: string, tokenAddress: string): string => {
    try {
      const token = TOKENS.find(
        (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      const decimals = token?.decimals || 6;
      const amount = Number(allowance) / Math.pow(10, decimals);
      return `${amount.toFixed(2)} ${token?.symbol || "tokens"}`;
    } catch {
      return allowance;
    }
  };

  const handleAllocate = async () => {
    if (!userAddress || !spenderAddress) {
      setError("User address or spender address not available");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = TOKENS.find((t) => t.address === selectedToken);
      if (!token) {
        throw new Error("Token not found");
      }

      const allowanceAmount = BigInt(
        Math.floor(dailyLimit * Math.pow(10, token.decimals))
      );

      console.log("Requesting spend permission...", {
        account: userAddress,
        spender: spenderAddress,
        token: token.address,
        allowance: allowanceAmount.toString(),
        dailyLimit,
      });

      const permission = await requestSpendPermission({
        account: userAddress as `0x${string}`,
        spender: spenderAddress as `0x${string}`,
        token: token.address as `0x${string}`,
        chainId: CHAIN_ID,
        allowance: allowanceAmount,
        periodInDays: 1,
        provider: createBaseAccountSDK({
          appName: "Coinbase Agent",
        }).getProvider(),
      });

      console.log("Spend permission granted:", permission);

      // Refresh permissions from blockchain after successful allocation
      await fetchPermissions();
    } catch (error) {
      console.error("Permission allocation error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to allocate permission"
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Spend Permissions</span>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPermissions}
            disabled={fetchingPermissions || !userAddress || !spenderAddress}
          >
            {fetchingPermissions ? "Refreshing..." : "Refresh"}
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Grant spend permissions to allow the agent to purchase tokens on your
          behalf
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label>Token</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {TOKENS.map((t) => (
                  <SelectItem key={t.address} value={t.address}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Daily Limit</Label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={dailyLimit}
              onChange={(e: any) => setDailyLimit(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={handleAllocate}
              disabled={loading || !userAddress || !spenderAddress}
            >
              {loading ? "Allocating..." : "Grant Permission"}
            </Button>
          </div>
        </div>

        {!userAddress || !spenderAddress ? (
          <div className="text-center py-4 text-gray-500">
            Loading wallet addresses...
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
              <p>
                <strong>User Address:</strong> {userAddress}
              </p>
              <p>
                <strong>Spender Address:</strong> {spenderAddress}
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Daily Allowance</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fetchingPermissions ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-gray-500"
                    >
                      Loading permissions...
                    </TableCell>
                  </TableRow>
                ) : permissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-gray-500"
                    >
                      No spend permissions granted yet
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map((p, index) => (
                    <TableRow key={`${p.token}-${index}`}>
                      <TableCell className="font-medium">
                        {p.tokenName}
                      </TableCell>
                      <TableCell>
                        {formatAllowance(p.allowance, p.token)}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {p.account.slice(0, 6)}...{p.account.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>
            💡 Spend permissions are fetched directly from the blockchain and
            allow the agent to spend the specified amount per day. Gas fees are
            sponsored automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpendSection;
