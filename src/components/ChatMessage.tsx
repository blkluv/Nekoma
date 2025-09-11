import { ChatMessage } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { Wrench } from 'lucide-react';

interface ChatMessageComponentProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2 break-words',
          isUser
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted text-muted-foreground mr-auto'
        )}
      >
        {message.toolUsed && (
          <div className={cn(
            "flex items-center gap-2 mb-2 text-xs opacity-70",
            message.toolUsed.error ? "text-destructive" : ""
          )}>
            <Wrench className="h-3 w-3" />
            <span>
              {message.toolUsed.error 
                ? `Tool failed: ${message.toolUsed.name}` 
                : `Used tool: ${message.toolUsed.name}`
              }
            </span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div
          className={cn(
            'text-xs mt-1 opacity-70',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
