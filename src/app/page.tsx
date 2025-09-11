/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { SignInWithBaseButton } from "@/components/SignInWithBase";
import SpendSection from "@/components/SpendSection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getRawPermissions } from "@/utils/spendUtils";
import { getPermissionStatus } from "@base-org/account/spend-permission/browser";

import { prepareSpendCallData } from "@base-org/account/spend-permission/browser";
interface ServerWalletResponse {
  address: string;
  smartAccountAddress?: string;
}
export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userAddress, setUserAddress] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  });
  const checkAuthStatus = async () => {
    try {
      const res = await axios.get("/api/auth/status");
      if (res.data.isAuthenticated) {
        setIsAuthenticated(true);
        setUserAddress(res.data.address);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSignIn = async (address: string) => {
    console.log("User authenticated with address:", address);
    setIsAuthenticated(true);
    setUserAddress(address);
  };
  const sendTransaction = async () => {
    try {
      const smartWallet = await fetch("/api/serverwallet");
      const data: ServerWalletResponse = await smartWallet.json();

      const rawPermissions = await getRawPermissions(
        userAddress!,
        data.smartAccountAddress!
      );

      const requiredAmount = BigInt(100_000);
      let remainingAmount = requiredAmount;
      const spendCalls: any[] = [];

      for (const perm of rawPermissions) {
        if (remainingAmount <= 0) break;

        const status = await getPermissionStatus(perm);

        if (status.remainingSpend <= BigInt(0)) continue;

        const spendAmount =
          remainingAmount > status.remainingSpend
            ? status.remainingSpend
            : remainingAmount;

        const call = await prepareSpendCallData(perm, spendAmount);
        spendCalls.push(call);

        remainingAmount -= spendAmount;
      }

      if (remainingAmount > BigInt(0)) {
        throw new Error(
          `Not enough permission to cover the required amount. Still need ${Number(
            remainingAmount
          )} units`
        );
      }

      console.log("Spend calls to send:", spendCalls);

      const res = await axios.post("/api/transfer", {
        recipient: "0xF77A1B7294c761ea5DbD77D3AC3050c9AC802Cc3",
        sender: userAddress,
        amount: requiredAmount.toString(),
        spendCalls,
      });

      if (res.data.success) {
        toast.success("Transaction sent successfully");
        console.log("Transaction response:", res.data);
      } else {
        toast.error("Transaction failed: " + res.data.error);
      }
    } catch (err) {
      console.error("Error sending transaction:", err);
      toast.error("Error sending transaction");
    }
  };

  const handleSignOut = async () => {
    console.log("Signing out user");
    try {
      await axios.get("/api/auth/signout");
      setIsAuthenticated(false);
      setUserAddress(undefined);
      toast.success("Signed out successfully");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-base-blue"></div>
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Coinbase Agent
              </h1>
            </div>
            {isAuthenticated && (
              <Button onClick={handleSignOut}>Sign-Out</Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAuthenticated ? (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Coinbase Agent
            </h2>

            <div className="flex justify-center">
              <SignInWithBaseButton
                onSignIn={handleSignIn}
                colorScheme="light"
              />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              You are signed in
            </h2>
            <p className="text-gray-600">Address: {userAddress}</p>
            <div>
              <SpendSection />
            </div>
            <div>
              <Button onClick={sendTransaction}>Send Transaction</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
