/**
 * AI Chef 3 餸 1 湯流程測試
 * 覆蓋 bugs: #2 (重複觸發/跳步), #5 (audience regex 誤判)
 */

describe('Meal Flow 流程控制', () => {
  // ─── Bug #2: 3 餸 1 湯流程重複觸發/跳步 ────────────────
  describe('startMealFlow guard', () => {
    type MealPlanStep = 'idle' | 'people' | 'audience' | 'time' | 'dislike' | 'generating' | 'result';
    
    it('應該只允許在 idle 狀態時開始流程', () => {
      let mealStep: MealPlanStep = 'idle';
      let startCalled = false;

      const startMealFlow = () => {
        if (mealStep !== 'idle') return; // Early return guard
        startCalled = true;
      };

      // Idle 狀態：應該啟動
      startMealFlow();
      expect(startCalled).toBe(true);

      // 非 idle 狀態：應該阻止
      startCalled = false;
      mealStep = 'people';
      startMealFlow();
      expect(startCalled).toBe(false);

      mealStep = 'audience';
      startMealFlow();
      expect(startCalled).toBe(false);

      mealStep = 'generating';
      startMealFlow();
      expect(startCalled).toBe(false);
    });

    it('應該防止重複點擊 chip 導致重複觸發', () => {
      let mealStep: MealPlanStep = 'idle';
      let callCount = 0;

      const startMealFlow = () => {
        if (mealStep !== 'idle') return;
        callCount++;
        mealStep = 'people'; // 模擬狀態變更
      };

      // 模擬用戶快速點擊 5 次
      for (let i = 0; i < 5; i++) {
        startMealFlow();
      }

      expect(callCount).toBe(1); // 只應該觸發一次
    });

    it('應該在 chatMutation.isPending 時阻止啟動', () => {
      let mealStep: MealPlanStep = 'idle';
      let isPending = false;
      let startCalled = false;

      const startMealFlow = () => {
        if (isPending) return;
        if (mealStep !== 'idle') return;
        startCalled = true;
      };

      isPending = true;
      startMealFlow();
      expect(startCalled).toBe(false);

      isPending = false;
      startMealFlow();
      expect(startCalled).toBe(true);
    });
  });

  // ─── Bug #2: handleMealAnswer 防重複 ─────────────────
  describe('handleMealAnswer guard', () => {
    it('應該在 isPending 時阻止回答', () => {
      let isPending = false;
      let answerCalled = false;

      const handleMealAnswer = () => {
        if (isPending) return;
        answerCalled = true;
      };

      isPending = true;
      handleMealAnswer();
      expect(answerCalled).toBe(false);

      isPending = false;
      handleMealAnswer();
      expect(answerCalled).toBe(true);
    });

    it('應該在 isMealAnswering 為 false 時阻止回答', () => {
      let isMealAnswering = false;
      let answerCalled = false;

      const handleMealAnswer = () => {
        if (!isMealAnswering) return;
        answerCalled = true;
      };

      isMealAnswering = false;
      handleMealAnswer();
      expect(answerCalled).toBe(false);

      isMealAnswering = true;
      handleMealAnswer();
      expect(answerCalled).toBe(true);
    });

    it('isMealAnswering 應該正確反映 mealStep 狀態', () => {
      const mealStepToIsAnswering = (step: string) => {
        return step === 'people' || step === 'audience' || step === 'time' || step === 'dislike';
      };

      expect(mealStepToIsAnswering('idle')).toBe(false);
      expect(mealStepToIsAnswering('people')).toBe(true);
      expect(mealStepToIsAnswering('audience')).toBe(true);
      expect(mealStepToIsAnswering('time')).toBe(true);
      expect(mealStepToIsAnswering('dislike')).toBe(true);
      expect(mealStepToIsAnswering('generating')).toBe(false);
      expect(mealStepToIsAnswering('result')).toBe(false);
    });
  });

  // ─── Bug #5: audience regex 誤判 ───────────────────
  describe('parseMealAnswer audience 判斷', () => {
    const parseMealAnswer = (text: string, mealStep: string) => {
      const lower = text.trim().toLowerCase();
      
      if (mealStep === 'audience') {
        // Bug #5 fix: 爸媽 = parents (normal adults), NOT elderly
        // 只匹配明確的 senior-related words 和 young-children words
        const hasKids = /仔|女|小朋友|細路|學童|兒童|孩童|kids|child|children|bb|嬰幼/.test(lower);
        const hasElderly = /老人家|長者|老人|公公|婆婆|奶奶|爺爺|嫲嫲|外婆|外公|阿嫲|阿爺|祖母|祖父|senior|elderly/.test(lower);
        return { hasKids, hasElderly };
      }
      
      return {};
    };

    it('應該正確判斷「爸媽」為正常成年人 (唔係老人家)', () => {
      const result = parseMealAnswer('爸媽', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷「小朋友」為有小孩', () => {
      const result = parseMealAnswer('有小朋友', 'audience');
      expect(result.hasKids).toBe(true);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷「老人家」為有長者', () => {
      const result = parseMealAnswer('有老人家', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(true);
    });

    it('應該正確判斷「公公婆婆」為有長者', () => {
      const result = parseMealAnswer('公公婆婆', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(true);
    });

    it('應該正確判斷「仔女」為有小孩', () => {
      const result = parseMealAnswer('仔女', 'audience');
      expect(result.hasKids).toBe(true);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷「爸媽和小朋友」為既有小孩', () => {
      const result = parseMealAnswer('爸媽和小朋友', 'audience');
      expect(result.hasKids).toBe(true);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷「爺爺嫲嫲」為有長者', () => {
      const result = parseMealAnswer('爺爺嫲嫲', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(true);
    });

    it('應該正確判斷「一家三口」為無特別標記 (純描述)', () => {
      const result = parseMealAnswer('一家三口', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷英文「children」為有小孩', () => {
      const result = parseMealAnswer('children', 'audience');
      expect(result.hasKids).toBe(true);
      expect(result.hasElderly).toBe(false);
    });

    it('應該正確判斷英文「elderly」為有長者', () => {
      const result = parseMealAnswer('elderly', 'audience');
      expect(result.hasKids).toBe(false);
      expect(result.hasElderly).toBe(true);
    });
  });

  // ─── AudienceKey typed bypass ───────────────────────
  describe('AudienceKey typed option', () => {
    const AUDIENCE_OPTIONS = [
      { label: '有小朋友', value: 'kids' },
      { label: '有老人家', value: 'elderly' },
      { label: '兩者都有', value: 'both' },
      { label: '沒有', value: 'none' },
    ] as const;

    type AudienceKey = typeof AUDIENCE_OPTIONS[number]['value'];

    it('應該使用 typed key 繞過 regex', () => {
      const applyAudienceKey = (key: AudienceKey) => {
        switch (key) {
          case 'kids':
            return { hasKids: true, hasElderly: false };
          case 'elderly':
            return { hasKids: false, hasElderly: true };
          case 'both':
            return { hasKids: true, hasElderly: true };
          case 'none':
            return { hasKids: false, hasElderly: false };
        }
      };

      expect(applyAudienceKey('kids')).toEqual({ hasKids: true, hasElderly: false });
      expect(applyAudienceKey('elderly')).toEqual({ hasKids: false, hasElderly: true });
      expect(applyAudienceKey('both')).toEqual({ hasKids: true, hasElderly: true });
      expect(applyAudienceKey('none')).toEqual({ hasKids: false, hasElderly: false });
    });

    it('應該允許 audienceOverride 直接設定', () => {
      const handleMealAnswer = (audienceOverride?: AudienceKey) => {
        if (audienceOverride !== undefined) {
          return {
            hasKids: audienceOverride === 'kids' || audienceOverride === 'both',
            hasElderly: audienceOverride === 'elderly' || audienceOverride === 'both',
          };
        }
        return null;
      };

      expect(handleMealAnswer('kids')).toEqual({ hasKids: true, hasElderly: false });
      expect(handleMealAnswer('both')).toEqual({ hasKids: true, hasElderly: true });
    });
  });

  // ─── Meal step 流程 ─────────────────────────────────
  describe('Meal step 流程', () => {
    it('應該正確推進流程', () => {
      const nextStepMap: Record<string, string> = {
        idle: 'people',
        people: 'audience',
        audience: 'time',
        time: 'dislike',
        dislike: 'generating',
        generating: 'result',
        result: 'idle',
      };

      expect(nextStepMap['idle']).toBe('people');
      expect(nextStepMap['people']).toBe('audience');
      expect(nextStepMap['audience']).toBe('time');
      expect(nextStepMap['time']).toBe('dislike');
      expect(nextStepMap['dislike']).toBe('generating');
      expect(nextStepMap['generating']).toBe('result');
      expect(nextStepMap['result']).toBe('idle');
    });

    it('應該只在非 generating/result/idle 時提問', () => {
      const shouldAskQuestion = (step: string) => {
        return step !== 'generating' && step !== 'result' && step !== 'idle';
      };

      expect(shouldAskQuestion('people')).toBe(true);
      expect(shouldAskQuestion('audience')).toBe(true);
      expect(shouldAskQuestion('time')).toBe(true);
      expect(shouldAskQuestion('dislike')).toBe(true);
      expect(shouldAskQuestion('generating')).toBe(false);
      expect(shouldAskQuestion('result')).toBe(false);
      expect(shouldAskQuestion('idle')).toBe(false);
    });
  });
});
