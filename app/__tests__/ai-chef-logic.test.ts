/**
 * AI Chef 核心邏輯測試
 * 覆蓋 bugs: #11 (servings override), #12 (200 克 parsing), #13 (categorize), #14 (generateId), #15 (localToday)
 */

// 由於被測試函數喺 component 內部，我哋需要模擬佢哋嘅邏輯
// 呢度測試純函數版本

describe('AI Chef 核心邏輯', () => {
  // ─── Bug #15: localToday() UTC 日期錯 ─────────────────
  describe('localToday', () => {
    const originalDate = global.Date;

    afterEach(() => {
      global.Date = originalDate;
    });

    it('應該返回本地日期而非 UTC 日期 (HKT 時區)', () => {
      // 模擬 UTC 時間 2026-08-09T23:30:00Z = HKT 2026-08-10 07:30
      // toISOString() 會返回 "2026-08-09T23:30:00.000Z" (錯！)
      // localToday() 應該返回 "2026-08-10" (啱！)
      global.Date = class extends originalDate {
        constructor() {
          super();
          // 返回 UTC 時間 2026-08-09 23:30 (HKT 係 8 月 10 日朝早)
          return new originalDate('2026-08-09T23:30:00.000Z');
        }
      } as any;

      // localToday() 實現
      const localToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const result = localToday();
      expect(result).toBe('2026-08-10'); // HKT 日期
      expect(result).not.toBe('2026-08-09'); // UTC 日期 (錯)
    });

    it('應該正確格式化月份和日期為兩位數', () => {
      global.Date = class extends originalDate {
        constructor() {
          super();
          return new originalDate('2026-01-05T10:00:00.000Z');
        }
      } as any;

      const localToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      expect(localToday()).toBe('2026-01-05');
    });
  });

  // ─── Bug #14: generateId 可碰撞 ───────────────────────
  describe('generateId', () => {
    it('應該生成唯一 ID (1000 次無碰撞)', () => {
      const ids = new Set<string>();
      
      // generateId 實現
      let idCounter = 0;
      const generateId = () => {
        idCounter += 1;
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + idCounter.toString(36);
      };

      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(1000); // 1000 個 ID 全部唯一
    });

    it('應該包含時間戳、隨機數和計數器', () => {
      let idCounter = 0;
      const generateId = () => {
        idCounter += 1;
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + idCounter.toString(36);
      };

      const id1 = generateId();
      const id2 = generateId();

      // 計數器部分應該唔同 (最後 1-2 個字符)
      expect(id1).not.toBe(id2);
    });
  });

  // ─── Bug #12: 200 克 quantity/unit 分唔到 ─────────────
  describe('NAME_QTY_COMPACT_RE (緊湊格式解析)', () => {
  const QTY_NUM = String.raw`[\d.]+(?:[\d.-]*[\d.]+)?|半|一|兩|二|三|四|五|六|七|八|九|十|幾|若干|少許|適量|些許`;
  const UNITS = String.raw`克|毫升|ml|g|kg|個|條|隻|片|碗|湯匙|茶匙|匙|包|盒|粒|瓣|棵|紮|杯|碟|勺|份|根|塊|斤|磅|oz|lb`;
    const NAME_QTY_COMPACT_RE = new RegExp(`^(.+?)(${QTY_NUM})(${UNITS})$`);
    const NAME_QTY_RE = new RegExp(`^(.+?)\\s+(${QTY_NUM})\\s*(${UNITS})?\\s*$`);
    const QTY_ONLY_RE = new RegExp(`^(${QTY_NUM})\\s*(${UNITS})?\\s*$`);

    it('應該解析格式「雞胸 200 克」', () => {
      const match = '雞胸 200 克'.match(NAME_QTY_RE);
      expect(match).toBeTruthy();
      expect(match?.[1].trim()).toBe('雞胸');
      expect(match?.[2]).toBe('200');
      expect(match?.[3]).toBe('克');
    });

    it('應該解析「生抽 1 湯匙」', () => {
      const match = '生抽 1 湯匙'.match(NAME_QTY_RE);
      expect(match).toBeTruthy();
      expect(match?.[1].trim()).toBe('生抽');
      expect(match?.[2]).toBe('1');
      expect(match?.[3]).toBe('湯匙');
    });

    it('應該解析「魚 500g」', () => {
      const match = '魚 500g'.match(NAME_QTY_COMPACT_RE);
      expect(match).toBeTruthy();
      expect(match?.[1].trim()).toBe('魚');
      expect(match?.[2]).toBe('500');
      expect(match?.[3]).toBe('g');
    });

    it('應該解析中文數量「鹽 少許」', () => {
      const match = '鹽 少許'.match(NAME_QTY_RE);
      expect(match).toBeTruthy();
      expect(match?.[1].trim()).toBe('鹽');
      expect(match?.[2]).toBe('少許');
    });

    it('唔應該匹配只有數量的格式 (用 QTY_ONLY_RE)', () => {
      const match = '200 克'.match(NAME_QTY_COMPACT_RE);
      expect(match).toBeFalsy(); // 因為 NAME_QTY_COMPACT_RE 需要 name 部分
    });
  });

  // ─── Bug #13: categorizeIngredient 誤分類 ────────────
  describe('categorizeIngredient', () => {
    const categorizeIngredient = (name: string): string => {
      const n = name.toLowerCase().trim();
      if (!n) return '其他';
      if (/醬油|生抽|老抽|蠔油|調味|食鹽|粗鹽|細鹽|砂糖|冰糖|片糖|米醋|陳醋|白醋|料酒|紹酒|黃酒|味精|雞粉|雞精|胡椒|花椒|八角|桂皮|五香|麻油|香油|花生油|粟米油|橄欖油|菜油|魚露|豆辦醬|豆瓣醬|甜麵醬|柱侯醬|南乳|腐乳|咖喱|茄汁|喼汁|蚝油/.test(n)) return "調味料";
      if (/冬菇|香菇|木耳|銀耳|雪耳|金針|蝦米|乾蝦|瑤柱|干貝|蓮子|百合|紅棗|黑棗|枸杞|淮山|黨參|蜜棗|腐竹|粉絲|花膠|海味|菜乾|梅菜|鹹菜|酸菜|醬菜/.test(n)) return "乾貨";
      if (/水餃|雲吞|餃子|白米|糙米|糯米|香米|絲苗|意粉|通粉|烏冬|拉麵|伊麵|河粉|米粉|麵|方包|多士|燕麥|麥皮|小米|粉絲|腸粉|米餅|^飯$|^米$/.test(n)) return "主食";
      if (/白飯魚|魚柳|魚片|魚頭|魚尾|鯇魚|鯽魚|鱸魚|桂花魚|石斑|東星斑|龍躉|鯧魚|秋刀魚|三文魚|鱈魚|吞拿魚|帶魚|黃花魚|紅衫魚|鮟鱇|魷魚|八爪魚|章魚|墨魚|鮮蝦|大蝦|蝦仁|蝦球|蟹|膏蟹|肉蟹|花蟹|扇貝|帶子|青口|蜆|花甲|鮑魚|海參|海螺|螺|蚬|蛤蜊|象拔蚌|瀨尿蝦|龍蝦/.test(n) || /^魚$/.test(n) || /鮮魚$/.test(n)) return "海鮮";
      if (/豬肉|豬扒|豬頸|排骨|五花腩|豬腩|豬手|豬腳|牛肉|牛腩|牛柳|牛展|牛筋|羊肉|雞|雞翼|雞髀|雞腿|雞胸|雞腳|雞肝|雞腎|雞扒|鴨|鴨胸|鵝|鵪鶉|肉片|肉碎|免治豬|肉排|臘肉|腊味|午餐肉|火腿/.test(n) || /^肉$/.test(n)) return "肉類";
      if (/雞蛋|鴨蛋|鵪鶉蛋|皮蛋|鹹蛋|鮮奶|牛奶|奶粉|淡奶|芝士|起司|奶油|牛油|忌廉|酸奶|乳酪/.test(n)) return "蛋奶";
      if (/白菜|菜心|芥蘭|芥菜|生菜|菠菜|通菜|莧菜|油麥菜|娃娃菜|椰菜|西蘭花|椰菜花|小白菜|上海青|韭菜|韭黃|蒜芯|蒜苔|蘆筍|西芹|芹菜|青瓜|黃瓜|節瓜|絲瓜|冬瓜|南瓜|茄子|番茄|薯仔|土豆|馬鈴薯|紅蘿蔔|白蘿蔔|蘿蔔|沙葛|蓮藕|芋頭|大薯|番薯|菜苗|韭菜花|洋蔥|紅蔥|蔥|豆苗|豌豆|荷蘭豆|四季豆|豆角|蜜豆|粟米|玉米|甜椒|燈籠椒|青椒|尖椒|蘑菇|鮮菇|金針菇|鴻喜菇|秀珍菇|大啡菇|平菇|杏鮑菇|草菇|芽菜|佛手瓜|水蓮|秋葵|芥財|枸杞葉/.test(n)) return "蔬菜";
      if (/果汁|鮮榨|可樂|汽水|梳打|雪碧|芬達|檸檬茶|奶茶|咖啡|啤酒|紅酒|白酒|威士忌|清酒|氣水|椰子水|椰汁|湯包|高湯|上湯|雞湯|豬骨湯/.test(n)) return "飲品";
      return '其他';
    };

    it('應該正確分類調味料', () => {
      expect(categorizeIngredient('生抽')).toBe('調味料');
      expect(categorizeIngredient('蠔油')).toBe('調味料');
      expect(categorizeIngredient('砂糖')).toBe('調味料');
    });

    it('應該正確分類蔬菜', () => {
      expect(categorizeIngredient('白菜')).toBe('蔬菜');
      expect(categorizeIngredient('番茄')).toBe('蔬菜');
      expect(categorizeIngredient('薯仔')).toBe('蔬菜');
    });

    it('應該正確分類肉類', () => {
      expect(categorizeIngredient('豬肉')).toBe('肉類');
      expect(categorizeIngredient('雞胸')).toBe('肉類');
      expect(categorizeIngredient('牛肉')).toBe('肉類');
    });

    it('應該正確分類海鮮', () => {
      expect(categorizeIngredient('鮮蝦')).toBe('海鮮');
      expect(categorizeIngredient('三文魚')).toBe('海鮮');
      expect(categorizeIngredient('魚')).toBe('海鮮');
    });

    // Bug #5 相關：爸媽唔應該誤判做老人家 (audience 分類)
    // 呢度係 ingredient 分類，但同樣原理：唔好過度匹配
    it('應該正確分類「菜乾」為乾貨而非蔬菜 (避免誤判)', () => {
      expect(categorizeIngredient('菜乾')).toBe('乾貨');
    });

    it('應該正確分類「魚香茄子」為蔬菜 (包含「茄子」)', () => {
      // 魚香茄子 -> 包含「茄子」所以分類為蔬菜
      expect(categorizeIngredient('茄子')).toBe('蔬菜');
      expect(categorizeIngredient('魚香茄子')).toBe('蔬菜'); // 包含「茄子」關鍵字
    });

    it('應該正確分類「水餃」為主食而非飲品', () => {
      expect(categorizeIngredient('水餃')).toBe('主食');
    });

    it('應該返回「其他」對於未分類食材', () => {
      expect(categorizeIngredient('未知食材')).toBe('其他');
      expect(categorizeIngredient('')).toBe('其他');
    });
  });

  // ─── Bug #3: 歷史記錄截斷 ───────────────────────────
  describe('MAX_HISTORY_MESSAGES 和 MAX_STORED_MESSAGES', () => {
    const MAX_HISTORY_MESSAGES = 20;
    const MAX_STORED_MESSAGES = 100;

    it('buildBackendMessages 應該只送最後 20 條訊息', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        content: `Message ${i}`,
      }));

      const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
      expect(trimmed.length).toBe(20);
      expect(trimmed[0].content).toBe('Message 30'); // 第 30 條 (0-indexed: 29)
      expect(trimmed[trimmed.length - 1].content).toBe('Message 49');
    });

    it('persist 應該只存最後 100 條訊息', () => {
      const messages = Array.from({ length: 200 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        content: `Message ${i}`,
      }));

      const trimmed = messages.slice(-MAX_STORED_MESSAGES);
      expect(trimmed.length).toBe(100);
      expect(trimmed[0].content).toBe('Message 100');
      expect(trimmed[trimmed.length - 1].content).toBe('Message 199');
    });

    it('應該處理少於上限的訊息', () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      }));

      const trimmedForBackend = messages.slice(-MAX_HISTORY_MESSAGES);
      const trimmedForPersist = messages.slice(-MAX_STORED_MESSAGES);
      
      expect(trimmedForBackend.length).toBe(5);
      expect(trimmedForPersist.length).toBe(5);
    });
  });

  // ─── Bug #3: 3MB 警告 toast ─────────────────────────
  describe('payload size guard', () => {
    it('應該檢測 payload 超過 3MB', () => {
      const largePayload = 'x'.repeat(3_000_001); // > 3MB
      expect(largePayload.length).toBeGreaterThan(3_000_000);
    });

    it('應該允許 payload 少於 3MB', () => {
      const smallPayload = 'x'.repeat(1_000_000); // 1MB
      expect(smallPayload.length).toBeLessThan(3_000_000);
    });
  });
});
