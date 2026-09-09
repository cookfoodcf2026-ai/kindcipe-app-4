import { useState, useCallback, useRef } from 'react';

export type MealPlanStep = 'idle' | 'people' | 'audience' | 'time' | 'dislike' | 'generating' | 'result';

export interface MealPlanPreferences {
  people: number;
  hasKids: boolean;
  hasElderly: boolean;
  time: 'quick' | 'normal' | 'leisure' | null;
  dislikes: string;
}

const EMPTY_PREFS: MealPlanPreferences = {
  people: 0,
  hasKids: false,
  hasElderly: false,
  time: null,
  dislikes: '',
};

interface UseMealPlanFlowReturn {
  mealStep: MealPlanStep;
  mealPrefs: MealPlanPreferences;
  isSoupMode: boolean;
  startMealFlow: () => void;
  handleMealAnswer: (text: string) => void;
  handleSkipMealQuestions: () => void;
  resetMealFlow: () => void;
  setSoupMode: (isSoup: boolean) => void;
}

export function useMealPlanFlow(
  onComplete: (prefs: MealPlanPreferences, messages: any[]) => void
): UseMealPlanFlowReturn {
  const [mealStep, setMealStep] = useState<MealPlanStep>('idle');
  const [mealPrefs, setMealPrefs] = useState<MealPlanPreferences>(EMPTY_PREFS);
  const [isSoupMode, setIsSoupMode] = useState(false);
  const messagesRef = useRef<any[]>([]);

  const parseMealAnswer = useCallback((text: string): Partial<MealPlanPreferences> => {
    const t = text.trim().toLowerCase();
    
    switch (mealStep) {
      case 'people': {
        const numMatch = t.match(/(\d+)/);
        const n = numMatch ? parseInt(numMatch[1], 10) : 4;
        return { people: n < 1 ? 4 : n };
      }
      case 'audience': {
        return {
          hasKids: /仔 | 女|小朋友 | 細路|童|孩|kids|child/.test(t),
          hasElderly: /老人家 | 長者 | 老人|爸|媽|爺|嫲|公公 | 婆婆|elderly|old/.test(t),
        };
      }
      case 'time': {
        if (/快 |30| 半|急|quick/.test(t)) return { time: 'quick' };
        if (/慢 | 煲|燉|leisure|slow/.test(t)) return { time: 'leisure' };
        return { time: 'normal' };
      }
      case 'dislike':
        return { dislikes: /冇 | 没有 | 無|none|沒有/.test(t) ? '' : t };
      default:
        return {};
    }
  }, [mealStep]);

  const advanceMealStep = useCallback(() => {
    const nextStep: Record<MealPlanStep, MealPlanStep> = {
      idle: 'people',
      people: 'audience',
      audience: 'time',
      time: 'dislike',
      dislike: 'generating',
      generating: 'result',
      result: 'idle',
    };
    setMealStep(nextStep[mealStep]);
  }, [mealStep]);

  const startMealFlow = useCallback(() => {
    setMealPrefs(EMPTY_PREFS);
    setMealStep('people');
    messagesRef.current = [];
  }, []);

  const handleMealAnswer = useCallback((text: string) => {
    const update = parseMealAnswer(text);
    const nextPrefs = { ...mealPrefs, ...update };
    setMealPrefs(nextPrefs);
    messagesRef.current.push({ role: 'user' as const, content: text });

    if (mealStep === 'dislike') {
      setMealStep('generating');
      setIsSoupMode(true);
      onComplete(nextPrefs, messagesRef.current);
    } else {
      advanceMealStep();
    }
  }, [mealPrefs, mealStep, parseMealAnswer, advanceMealStep, onComplete]);

  const handleSkipMealQuestions = useCallback(() => {
    setMealStep('generating');
    setIsSoupMode(true);
    
    const defaultPrefs: MealPlanPreferences = {
      people: 4,
      hasKids: false,
      hasElderly: false,
      time: 'normal',
      dislikes: '',
    };
    
    messagesRef.current.push({
      role: 'user' as const,
      content: `請為我設計今晚「3 餸 1 湯」晚餐，總共 4 道菜，適合 4 人食用。`,
    });
    
    onComplete(defaultPrefs, messagesRef.current);
  }, [onComplete]);

  const resetMealFlow = useCallback(() => {
    setMealStep('idle');
    setMealPrefs(EMPTY_PREFS);
    messagesRef.current = [];
  }, []);

  const setSoupMode = useCallback((isSoup: boolean) => {
    setIsSoupMode(isSoup);
  }, []);

  return {
    mealStep,
    mealPrefs,
    isSoupMode,
    startMealFlow,
    handleMealAnswer,
    handleSkipMealQuestions,
    resetMealFlow,
    setSoupMode,
  };
}
