'use client';

import React from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatInput } from '@/components/ChatInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Bot } from 'lucide-react';

const ChatPage = () => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();

  return (
    <div className="container mx-auto p-4 h-screen flex flex-col">
      <Card className="flex-1 flex flex-col max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <CardTitle>Gemini Chat Assistant</CardTitle>
            </div>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Chat
              </Button>
            )}
          </div>
          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-md">
              Error: {error}
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <ChatMessages messages={messages} isLoading={isLoading} />
          <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatPage;
