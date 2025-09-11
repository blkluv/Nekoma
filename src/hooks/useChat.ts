import { useState, useCallback } from 'react';
import { useTransferWithPermissions } from './useTransferWithPermissions';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: {
    name: string;
    parameters?: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { executeTransfer, isExecuting } = useTransferWithPermissions();

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Prepare conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      
      console.log('Chat API response:', JSON.stringify(data, null, 2));

      // Check if client-side execution is required
      if (data.executeClientSide && data.transactionParams) {
        console.log('Client-side execution detected!', data.transactionParams);
        
        // Add a message indicating transfer is starting
        const preparingMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response + "\n\nExecuting transfer (with retry logic)...",
          timestamp: new Date(),
          ...(data.toolUsed && { toolUsed: data.toolUsed }),
        };
        
        setMessages(prev => [...prev, preparingMessage]);

        console.log('🚀 Starting client-side transfer execution...');
        
        // Execute the transfer client-side
        const transferResult = await executeTransfer(data.transactionParams);
        
        console.log('📋 Transfer result:', transferResult);
        
        // Create the final result message based on success/failure
        let resultContent = transferResult.message;
        if (transferResult.success && transferResult.explorerUrl) {
          resultContent += `\n\nView transaction: ${transferResult.explorerUrl}`;
        }
        
        const resultMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: resultContent,
          timestamp: new Date(),
          toolUsed: {
            name: 'sendUSDCTransaction',
            result: transferResult
          }
        };

        setMessages(prev => [...prev, resultMessage]);
      } else {
        console.log('📝 Regular message response, no client-side execution needed');
        
        // Regular message handling
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          ...(data.toolUsed && { toolUsed: data.toolUsed }),
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messages, executeTransfer]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading: isLoading || isExecuting,
    error,
    sendMessage,
    clearChat,
  };
}
