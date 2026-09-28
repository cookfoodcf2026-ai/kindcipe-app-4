import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { trpc } from "@/lib/trpc";
import type { Message } from "@/types/ai-chef";

/** Refetch when the app returns to the foreground (App↔Web handoff). */
function useFocusRefetch(refetch: () => void) {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);
}

export interface CloudChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

/**
 * Cross-device AI Chef chat sync.
 *
 * Local AsyncStorage remains the fast/offline cache; the backend is the source
 * of truth so the same conversation history appears on App + Web.
 *
 * - On mount with a userId: fetch cloud sessions; if the cloud is empty but the
 *   device has local sessions, they are uploaded once (migration).
 * - `syncSession` upserts a single session after it changes (debounced by caller).
 */
export function useAiChatCloudSync(userId: string | number | null | undefined) {
  const listQuery = trpc.aiChat.list.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const utils = trpc.useUtils();
  const upsertM = trpc.aiChat.upsert.useMutation();
  const deleteM = trpc.aiChat.delete.useMutation();
  const bulkImportM = trpc.aiChat.bulkImport.useMutation();

  const migratedRef = useRef(false);

  const cloudSessions: CloudChatSession[] | undefined = listQuery.data as
    | CloudChatSession[]
    | undefined;

  /** Upload local-only sessions once when the cloud account is fresh. */
  const migrateLocalIfNeeded = useCallback(
    async (local: CloudChatSession[]) => {
      if (!userId || migratedRef.current) return;
      if (cloudSessions === undefined) return; // still loading
      if (cloudSessions.length > 0 || local.length === 0) {
        migratedRef.current = true;
        return;
      }
      migratedRef.current = true;
      try {
        await bulkImportM.mutateAsync({
          sessions: local.map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            messages: s.messages as any,
          })),
        });
        await utils.aiChat.list.invalidate();
      } catch {
        migratedRef.current = false; // allow retry next mount
      }
    },
    [userId, cloudSessions, bulkImportM, utils]
  );

  const syncSession = useCallback(
    (session: CloudChatSession) => {
      if (!userId) return;
      upsertM.mutate(
        {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          messages: session.messages as any,
        },
        {
          onSuccess: () => {
            // Keep list ordering fresh without a full spinner.
            void utils.aiChat.list.invalidate();
          },
        }
      );
    },
    [userId, upsertM, utils]
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      if (!userId) return;
      deleteM.mutate({ id: sessionId }, { onSuccess: () => void utils.aiChat.list.invalidate() });
    },
    [userId, deleteM, utils]
  );

  // Refetch cloud sessions when the app regains focus (e.g. switching App↔Web).
  useFocusRefetch(listQuery.refetch);

  return {
    cloudSessions,
    cloudLoading: listQuery.isLoading,
    syncSession,
    removeSession,
    migrateLocalIfNeeded,
    refetch: listQuery.refetch,
  };
}
