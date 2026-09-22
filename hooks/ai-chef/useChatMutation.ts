import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import type { Message } from '@/types/ai-chef';
import { friendlyError } from "@/lib/errors";

interface UseChatMutationOptions {
  onSuccess?: (data: { content: string; recipes: any[] }) => void;
  onError?: (error: Error) => void;
}

interface UseChatMutationReturn {
  sendMessage: (messages: Message[], options?: SendMessageOptions) => void;
  isPending: boolean;
  reset: () => void;
  error: Error | null;
}

interface SendMessageOptions {
  mode?: 'chat' | 'recipe' | 'library';
  count?: number;
  soupIntent?: boolean;
  instant?: boolean;
  source?: 'library' | 'ai';
}

export function useChatMutation(
  userId: number | null,
  options: UseChatMutationOptions = {}
): UseChatMutationReturn {
  const { onSuccess, onError } = options;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chatMutation = trpc.aiRecipe.chat.useMutation({
    onSuccess: (data) => {
      setIsPending(false);
      setError(null);
      onSuccess?.(data);
    },
    onError: (e: any) => {
      setIsPending(false);
      const err = new Error(friendlyError(e) || 'AI 回應失敗');
      setError(err);
      onError?.(err);
    },
  });

  const sendMessage = useCallback((
    messages: Message[],
    sendOptions?: SendMessageOptions
  ) => {
    if (!userId || chatMutation.isPending) return;

    setIsPending(true);
    setError(null);

    const backendMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    chatMutation.mutate({
      messages: backendMessages,
      mode: sendOptions?.mode || 'chat',
      instant: sendOptions?.instant,
      source: sendOptions?.source,
      count: sendOptions?.count,
      soupIntent: sendOptions?.soupIntent,
    });
  }, [userId, chatMutation]);

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
  }, []);

  return {
    sendMessage,
    isPending: isPending || chatMutation.isPending,
    reset,
    error,
  };
}
