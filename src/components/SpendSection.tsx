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

interface ServerWalletResponse {
  address: string;
  smartAccountAddress?: string;
}

interface SpendPermission {
  token: string;
  tokenName: string;
  allowance: string;
  account: string;
  spender: string;
  periodInDays: number;
}

const CHAIN_ID = 8453; // Base mainnet

// Predefined stable tokens with Base addresses
const TOKENS = [
  {
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT on Base
    decimals: 6,
  },
  {
    symbol: "DAI",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI on Base
    decimals: 18,
  },
];

const SpendSection = () => {
  const [userAddress, setUserAddress] = useState<string>("");
  const [spenderAddress, setSpenderAddress] = useState<string>("");
  const [permissions, setPermissions] = useState<SpendPermission[]>([]);
  const [selectedToken, setSelectedToken] = useState(TOKENS[0].address);
  const [dailyLimit, setDailyLimit] = useState<number>(1);
  const [loading, setLoading] = useState(false);
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

  const loadStoredPermissions = () => {
    try {
      const storedPermissions = localStorage.getItem("spendPermissions");
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions));
      }
    } catch (err) {
      console.error("Failed to load stored permissions", err);
    }
  };

  const savePermissionsToStorage = (perms: SpendPermission[]) => {
    try {
      localStorage.setItem("spendPermissions", JSON.stringify(perms));
    } catch (err) {
      console.error("Failed to save permissions to storage", err);
    }
  };

  useEffect(() => {
    fetchServerWallet();
    loadStoredPermissions();
  }, []);

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
          appName: "Zora Creator Coins Agent",
        }).getProvider(),
      });

      console.log("Spend permission granted:", permission);

      const newPermission: SpendPermission = {
        token: token.address,
        tokenName: token.symbol,
        allowance: `${dailyLimit} ${token.symbol}`,
        account: userAddress,
        spender: spenderAddress,
        periodInDays: 1,
      };

      const updatedPermissions = [
        ...permissions.filter((p) => p.token !== token.address),
        newPermission,
      ];

      setPermissions(updatedPermissions);
      savePermissionsToStorage(updatedPermissions);

      const storedPermissions = JSON.parse(
        localStorage.getItem("rawSpendPermissions") || "{}"
      );
      storedPermissions[token.address] = permission;
      localStorage.setItem(
        "rawSpendPermissions",
        JSON.stringify(storedPermissions)
      );
    } catch (error) {
      console.error("Permission allocation error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to allocate permission"
      );
    } finally {
      setLoading(false);
    }
  };

  const clearPermissions = () => {
    setPermissions([]);
    localStorage.removeItem("spendPermissions");
    localStorage.removeItem("rawSpendPermissions");
  };

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Spend Permissions</CardTitle>
        <p className="text-sm text-gray-600">
          Grant spend permissions to allow the agent to purchase tokens on your
          behalf
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
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
            {permissions.length > 0 && (
              <Button variant="outline" onClick={clearPermissions}>
                Clear All
              </Button>
            )}
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-gray-500"
                    >
                      No spend permissions granted yet
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map((p) => (
                    <TableRow key={p.token}>
                      <TableCell className="font-medium">
                        {p.tokenName}
                      </TableCell>
                      <TableCell>{p.allowance}</TableCell>
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
            💡 Spend permissions are stored locally and allow the agent to spend
            the specified amount per day. Gas fees are sponsored automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpendSection;
