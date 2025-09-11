/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { getRawPermissions } from '@/utils/spendUtils';
import { getPermissionStatus } from '@base-org/account/spend-permission/browser';
import { prepareSpendCallData } from '@base-org/account/spend-permission/browser';
import axios from 'axios';

interface TransferParams {
  recipient: string;
  amount: string;
  amountUSD: number;
  userAddress: string;
  smartAccountAddress: string;
}

interface TransferResult {
  success: boolean;
  message: string;
  error?: string;
  transactionHash?: string;
  explorerUrl?: string;
  details?: any;
}

export const useTransferWithPermissions = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeTransfer = useCallback(async (params: TransferParams): Promise<TransferResult> => {
    setIsExecuting(true);
    
    try {
      const maxRetries = 5;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { recipient, amount, amountUSD, userAddress, smartAccountAddress } = params;

          console.log(`Transfer attempt ${attempt}/${maxRetries}:`, { recipient, amountUSD, userAddress });

          // Get raw permissions from blockchain
          const rawPermissions = await getRawPermissions(userAddress, smartAccountAddress);

          if (!rawPermissions || rawPermissions.length === 0) {
            return {
              success: false,
              message: "No spend permissions found. Please set up spend permissions first.",
              error: "No permissions available"
            };
          }

          const requiredAmount = BigInt(amount);
          let remainingAmount = requiredAmount;
          const spendCalls: any[] = [];

          // Prepare spend calls using available permissions
          for (const perm of rawPermissions) {
            if (remainingAmount <= 0) break;

            const status = await getPermissionStatus(perm);

            if (status.remainingSpend <= BigInt(0)) continue;

            const spendAmount = remainingAmount > status.remainingSpend 
              ? status.remainingSpend 
              : remainingAmount;

            const call = await prepareSpendCallData(perm, spendAmount);
            spendCalls.push(call);

            remainingAmount -= spendAmount;
          }

          if (remainingAmount > BigInt(0)) {
            return {
              success: false,
              message: `Insufficient spend permission allowance. Need ${Number(remainingAmount) / 1_000_000} more USDC in permissions.`,
              error: "Insufficient permissions"
            };
          }

          console.log(`Executing ${spendCalls.length} spend calls (attempt ${attempt})...`);

          // Execute transfer using the regular transfer endpoint
          const response = await axios.post('/api/transfer', {
            recipient,
            sender: userAddress,
            amount: amount,
            spendCalls,
          });

          if (response.data.success) {
            console.log(`Transfer successful on attempt ${attempt}`);
            return {
              success: true,
              message: `Transaction successful!${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ''}`,
              transactionHash: response.data.transferUserOpHash,
              explorerUrl: response.data.explorerUrl || "https://account.base.app/activity",
              details: response.data
            };
          } else {
            throw new Error(response.data.error || 'Transfer failed');
          }

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error(`Transfer attempt ${attempt}/${maxRetries} failed:`, lastError.message);
          
          // If this is the last attempt, don't retry
          if (attempt === maxRetries) {
            break;
          }
          
          // Wait before retrying (exponential backoff: 1s, 2s, 4s, 8s)
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // All attempts failed
      return {
        success: false,
        message: `Transfer failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
        error: lastError?.message || 'Unknown error'
      };
      
    } finally {
      setIsExecuting(false);
    }
  }, []);

  return {
    executeTransfer,
    isExecuting
  };
};
