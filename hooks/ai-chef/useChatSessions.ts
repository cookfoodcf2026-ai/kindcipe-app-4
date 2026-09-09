import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '@/types/ai-chef';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  createNewSession: () => string;
  saveMessages: (sessionId: string, messages: Message[]) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  isLoading: boolean;
}

export function useChatSessions(userId: string | number | null): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionsKey = userId ? `kindcipe_ai_sessions_${userId}` : null;
  const activeKey = userId ? `kindcipe_ai_active_${userId}` : null;

  // Load sessions on mount
  useEffect(() => {
    if (!userId || !sessionsKey || !activeKey) {
      setSessions([]);
      setActiveChatIdState(null);
      setIsLoading(false);
      return;
    }

    const loadSessions = async () => {
      try {
        const [sessionsRaw, activeRaw] = await Promise.all([
          AsyncStorage.getItem(sessionsKey),
          AsyncStorage.getItem(activeKey),
        ]);

        const loadedSessions: ChatSession[] = sessionsRaw ? JSON.parse(sessionsRaw) : [];
        const loadedActiveId: string | null = activeRaw || null;

        setSessions(loadedSessions);
        setActiveChatIdState(loadedActiveId);
      } catch (e) {
        console.error('[useChatSessions] Load failed:', e);
        setSessions([]);
        setActiveChatIdState(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSessions();
  }, [userId, sessionsKey, activeKey]);

  // Persist sessions
  const persistSessions = useCallback(async (newSessions: ChatSession[]) => {
    if (!sessionsKey) return;
    try {
      await AsyncStorage.setItem(sessionsKey, JSON.stringify(newSessions));
    } catch (e) {
      console.error('[useChatSessions] Persist failed:', e);
    }
  }, [sessionsKey]);

  // Create new session
  const createNewSession = useCallback((): string => {
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const newSession: ChatSession = {
      id: newId,
      title: '新對話',
      createdAt: Date.now(),
      messages: [],
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      void persistSessions(updated);
      return updated;
    });

    return newId;
  }, [persistSessions]);

  // Set active chat ID
  const setActiveChatId = useCallback((id: string | null) => {
    setActiveChatIdState(id);
    if (activeKey && id) {
      AsyncStorage.setItem(activeKey, id).catch(e => {
        console.error('[useChatSessions] Set active failed:', e);
      });
    }
  }, [activeKey]);

  // Save messages for a session
  const saveMessages = useCallback(async (sessionId: string, messages: Message[]) => {
    if (!sessionsKey) return;
    
    setSessions(prev => {
      const updated = prev.map(session => 
        session.id === sessionId 
          ? { ...session, messages }
          : session
      );
      void persistSessions(updated);
      return updated;
    });
  }, [sessionsKey, persistSessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!sessionsKey) return;

    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      void persistSessions(updated);
      return updated;
    });

    if (activeChatId === sessionId) {
      setActiveChatId(null);
    }
  }, [sessionsKey, persistSessions, activeChatId, setActiveChatId]);

  return {
    sessions,
    activeChatId,
    setActiveChatId,
    createNewSession,
    saveMessages,
    deleteSession,
    isLoading,
  };
}
