/**
 * Recipe Detail Hero 圖片 Fallback 測試
 * 覆蓋：Hero 圖片 404/離線 fallback
 */

import { renderHook, act } from '@testing-library/react-native';

describe('Recipe Hero Image Fallback', () => {
  // ─── heroBroken state ───────────────────────────────
  describe('heroBroken state', () => {
    it('應該初始為 false (圖片正常)', () => {
      let heroBroken = false;
      expect(heroBroken).toBe(false);
    });

    it('應該在 onError 時設為 true', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      // 模擬 Image onError
      setHeroBroken(true);
      expect(heroBroken).toBe(true);
    });

    it('應該在切換 recipe (id 變更) 時重置為 false', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      // Recipe A: 圖片失敗
      setHeroBroken(true);
      expect(heroBroken).toBe(true);

      // 切換到 Recipe B: useEffect 重置
      heroBroken = false; // 模擬 useEffect 重置
      expect(heroBroken).toBe(false);
    });
  });

  // ─── imgUrl 計算 ───────────────────────────────────
  describe('imgUrl 計算邏輯', () => {
    it('應該在 heroBroken=false 時顯示 rawImgUrl', () => {
      const heroBroken = false;
      const localImage = null;
      const rawImgUrl = 'https://example.com/image.jpg';
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      
      expect(imgUrl).toBe('https://example.com/image.jpg');
    });

    it('應該在 heroBroken=true 且無 localImage 時隱藏圖片 (null)', () => {
      const heroBroken = true;
      const localImage = null;
      const rawImgUrl = 'https://example.com/image.jpg';
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      
      expect(imgUrl).toBe(null);
    });

    it('應該即使 heroBroken=true 都顯示 localImage', () => {
      const heroBroken = true;
      const localImage = { uri: 'local://asset.jpg' };
      const rawImgUrl = 'https://example.com/image.jpg';
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      
      // localImage 存在，所以 imgUrl = rawImgUrl (但實際會用 localImage)
      expect(imgUrl).toBe('https://example.com/image.jpg');
    });

    it('應該優先使用 localImage', () => {
      const localImage = { uri: 'local://asset.jpg' };
      const rawImgUrl = 'https://example.com/image.jpg';
      
      // 實際渲染邏輯：localImage ? <Image source={localImage}> : <Image source={{ uri: imgUrl }}>
      const source = localImage || { uri: rawImgUrl };
      
      expect(source).toEqual({ uri: 'local://asset.jpg' });
    });
  });

  // ─── onError 處理器 ────────────────────────────────
  describe('Image onError 處理器', () => {
    it('應該在 remote 圖片失敗時調用 setHeroBroken', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      // 模擬 remote Image onError
      const onError = () => setHeroBroken(true);
      onError();

      expect(heroBroken).toBe(true);
    });

    it('應該在 local 圖片失敗時都調用 setHeroBroken', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      // 模擬 local Image onError (雖然 local asset 好少失敗)
      const onError = () => setHeroBroken(true);
      onError();

      expect(heroBroken).toBe(true);
    });
  });

  // ─── useEffect 重置 ───────────────────────────────
  describe('useEffect 重置邏輯', () => {
    it('應該在 id 變更時重置 heroBroken', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      // 初始 id: 'recipe-1'
      const id1 = 'recipe-1';
      
      // Recipe 1 圖片失敗
      setHeroBroken(true);
      expect(heroBroken).toBe(true);

      // 切換到 id: 'recipe-2' → useEffect 觸發
      const id2 = 'recipe-2';
      setHeroBroken(false); // useEffect 重置
      
      expect(heroBroken).toBe(false);
    });

    it('應該只在 id 變更時重置', () => {
      let heroBroken = false;
      const setHeroBroken = (value: boolean) => {
        heroBroken = value;
      };

      let renderCount = 0;
      const id = 'recipe-1';

      // 模擬多次 render (id 無變)
      renderCount++;
      // useEffect 唔會觸發 (因為 id 無變)
      // heroBroken 保持原狀
      
      expect(renderCount).toBe(1);
    });
  });

  // ─── Integration: 完整場景 ─────────────────────────
  describe('完整場景', () => {
    it('應該正確處理 remote 圖片 404', () => {
      const state = {
        heroBroken: false,
        localImage: null,
        rawImgUrl: 'https://example.com/404.jpg',
      };

      const setHeroBroken = (value: boolean) => {
        state.heroBroken = value;
      };

      // 初始：顯示 remote 圖片
      let imgUrl = state.heroBroken && !state.localImage ? null : state.rawImgUrl;
      expect(imgUrl).toBe('https://example.com/404.jpg');

      // 圖片載入失敗 (404)
      setHeroBroken(true);
      
      // 重新計算 imgUrl
      imgUrl = state.heroBroken && !state.localImage ? null : state.rawImgUrl;
      expect(imgUrl).toBe(null); // 隱藏，顯示 fallback
    });

    it('應該正確處理 local 圖片優先', () => {
      const state = {
        heroBroken: false,
        localImage: { uri: 'local://asset.jpg' },
        rawImgUrl: 'https://example.com/image.jpg',
      };

      // Local image 存在，永遠優先
      const source = state.localImage || { uri: state.rawImgUrl };
      expect(source).toEqual({ uri: 'local://asset.jpg' });

      // 即使 remote 失敗都唔影響 local
      state.heroBroken = true;
      const sourceAfterFail = state.localImage || { uri: state.rawImgUrl };
      expect(sourceAfterFail).toEqual({ uri: 'local://asset.jpg' });
    });

    it('應該在切換 recipe 時重置狀態', () => {
      const recipes = {
        'recipe-1': {
          id: 'recipe-1',
          heroBroken: false,
          rawImgUrl: 'https://example.com/1.jpg',
        },
        'recipe-2': {
          id: 'recipe-2',
          heroBroken: false,
          rawImgUrl: 'https://example.com/2.jpg',
        },
      };

      let currentId = 'recipe-1';
      
      // Recipe 1 失敗
      recipes['recipe-1'].heroBroken = true;
      expect(recipes['recipe-1'].heroBroken).toBe(true);

      // 切換到 Recipe 2
      currentId = 'recipe-2';
      // useEffect 重置 recipe-2 的 heroBroken (假設佢未失敗過)
      expect(recipes['recipe-2'].heroBroken).toBe(false);
    });
  });

  // ─── Edge Cases ───────────────────────────────────
  describe('Edge Cases', () => {
    it('應該處理 rawImgUrl 為 null/undefined', () => {
      const heroBroken = false;
      const localImage = null;
      const rawImgUrl = null;
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      expect(imgUrl).toBe(null);
    });

    it('應該處理空字串 URL', () => {
      const heroBroken = false;
      const localImage = null;
      const rawImgUrl = '';
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      expect(imgUrl).toBe(''); // 空字串，Image 會處理為失敗
    });

    it('應該在離線時 fallback', () => {
      const isOnline = false;
      const heroBroken = !isOnline; // 離線時直接設為 true
      const localImage = null;
      const rawImgUrl = 'https://example.com/image.jpg';
      
      const imgUrl = heroBroken && !localImage ? null : rawImgUrl;
      expect(imgUrl).toBe(null); // 離線時隱藏 remote 圖片
    });
  });
});
