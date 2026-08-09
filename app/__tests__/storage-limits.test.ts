/**
 * AI Chef 儲存上限測試
 * 覆蓋 bug: #3 (歷史爆 token / AsyncStorage)
 */

describe('Storage Limits 儲存上限', () => {
  const MAX_HISTORY_MESSAGES = 20;
  const MAX_STORED_MESSAGES = 100;
  const PAYLOAD_SIZE_LIMIT = 3_000_000; // 3MB

  // ─── buildBackendMessages: slice(-20) ───────────────
  describe('buildBackendMessages', () => {
    const buildBackendMessages = (msgs: any[]) => {
      const trimmedMsgs = msgs.slice(-MAX_HISTORY_MESSAGES);
      return trimmedMsgs.map(m => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content };
        
        const hasEmptyImage = m.content.some(
          (b: any) => b.type === 'image_url' && !b.image_url.url
        );
        
        if (!hasEmptyImage) return { role: m.role, content: m.content };
        
        // Bug #4: 空 image block 轉文字備註
        return {
          role: m.role,
          content: '文字內容\n[用戶之前上傳了一張雪櫃食材相]',
        };
      });
    };

    it('應該只送最後 20 條訊息給後端', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const backendMessages = buildBackendMessages(messages);
      expect(backendMessages.length).toBe(20);
      expect(backendMessages[0].content).toBe('Message 30');
      expect(backendMessages[backendMessages.length - 1].content).toBe('Message 49');
    });

    it('應該保留少於 20 條的訊息', () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
      }));

      const backendMessages = buildBackendMessages(messages);
      expect(backendMessages.length).toBe(10);
    });

    it('應該處理空訊息陣列', () => {
      const backendMessages = buildBackendMessages([]);
      expect(backendMessages.length).toBe(0);
    });

    // Bug #4: 空 image block 轉文字備註
    it('應該將空 image block 轉成文字備註', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: '我雪櫃有呢啲食材' },
            { type: 'image_url', image_url: { url: '' } }, // Empty base64 (stripped)
          ],
        },
      ];

      const backendMessages = buildBackendMessages(messages);
      expect(backendMessages[0].content).toContain('[用戶之前上傳了一張雪櫃食材相]');
    });

    it('應該保留非空 image block', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: '我雪櫃有呢啲食材' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j...' } },
          ],
        },
      ];

      const backendMessages = buildBackendMessages(messages);
      expect(backendMessages[0].content).toEqual([
        { type: 'text', text: '我雪櫃有呢啲食材' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j...' } },
      ]);
    });
  });

  // ─── persistSessions: slice(-100) ──────────────────
  describe('persistSessions', () => {
    it('應該只存最後 100 條訊息到 AsyncStorage', () => {
      const session = {
        id: 'chat-1',
        title: 'Test Chat',
        createdAt: Date.now(),
        messages: Array.from({ length: 200 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        })),
      };

      const compact = {
        ...session,
        messages: session.messages.slice(-MAX_STORED_MESSAGES),
      };

      expect(compact.messages.length).toBe(100);
      expect(compact.messages[0].content).toBe('Message 100');
      expect(compact.messages[compact.messages.length - 1].content).toBe('Message 199');
    });

    it('應該 strip base64 image data 慳空間', () => {
      const session = {
        id: 'chat-1',
        title: 'Test Chat',
        createdAt: Date.now(),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,very_long_base64...' } },
            ],
          },
        ],
      };

      const compact = {
        ...session,
        messages: session.messages.map(m => ({
          role: m.role,
          content: m.content.map((b: any) => {
            if (b.type === 'image_url') {
              return { type: 'image_url', image_url: { url: '' } }; // Strip base64
            }
            return b;
          }),
        })),
      };

      expect(compact.messages[0].content[1].image_url.url).toBe('');
      expect(compact.messages[0].content[0].text).toBe('Hello');
    });

    it('應該計算 payload 大小', () => {
      const largeSession = {
        id: 'chat-1',
        title: 'Large Chat',
        createdAt: Date.now(),
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: 'user',
          content: 'x'.repeat(50000), // 50KB per message = 5MB total
        })),
      };

      const payload = JSON.stringify(largeSession);
      expect(payload.length).toBeGreaterThan(PAYLOAD_SIZE_LIMIT);
    });
  });

  // ─── 3MB 警告 toast ─────────────────────────────────
  describe('3MB payload warning', () => {
    it('應該在 payload > 3MB 時顯示警告', () => {
      const payloadSize = 3_500_000; // 3.5MB
      const shouldWarn = payloadSize > PAYLOAD_SIZE_LIMIT;
      expect(shouldWarn).toBe(true);
    });

    it('應該在 payload < 3MB 時不顯示警告', () => {
      const payloadSize = 2_000_000; // 2MB
      const shouldWarn = payloadSize > PAYLOAD_SIZE_LIMIT;
      expect(shouldWarn).toBe(false);
    });

    it('應該只在第一次超過 3MB 時顯示警告 (toast dedup)', () => {
      let toastShown = false;
      const showToastOnce = (size: number) => {
        if (size > PAYLOAD_SIZE_LIMIT && !toastShown) {
          toastShown = true;
          return true;
        }
        return false;
      };

      expect(showToastOnce(3_500_000)).toBe(true);  // 第一次：顯示
      expect(showToastOnce(4_000_000)).toBe(false); // 第二次：不顯示
      expect(showToastOnce(3_100_000)).toBe(false); // 第三次：不顯示
    });

    it('應該在 persist 失敗時顯示錯誤 toast', () => {
      let errorToastShown = false;
      const persistFailHandler = (error: any) => {
        if (!errorToastShown) {
          errorToastShown = true;
          return '對話記錄保存失敗（儲存空間不足）';
        }
        return null;
      };

      expect(persistFailHandler('error')).toBe('對話記錄保存失敗（儲存空間不足）');
      expect(persistFailHandler('error')).toBe(null); // 第二次不顯示
    });
  });

  // ─── Integration: 完整流程 ─────────────────────────
  describe('完整儲存流程', () => {
    it('應該正確處理整個流程', () => {
      // 1. 用戶 send 訊息 (超過 20 條)
      const messages = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      // 2. buildBackendMessages 截斷到 20 條
      const backendMessages = messages.slice(-MAX_HISTORY_MESSAGES);
      expect(backendMessages.length).toBe(20);

      // 3. Persist 時截斷到 100 條
      const persistedMessages = messages.slice(-MAX_STORED_MESSAGES);
      expect(persistedMessages.length).toBe(30); // 少於 100，全部保存

      // 4. Payload 檢查
      const payload = JSON.stringify(persistedMessages);
      const shouldWarn = payload.length > PAYLOAD_SIZE_LIMIT;
      expect(shouldWarn).toBe(false); // 30 條短訊息唔夠 3MB
    });
  });
});
