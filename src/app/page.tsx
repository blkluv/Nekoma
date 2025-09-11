"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { SignInWithBaseButton } from "@/components/SignInWithBase";
import SpendSection from "@/components/SpendSection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
          </div>
        )}
      </div>
    </main>
  );
}
