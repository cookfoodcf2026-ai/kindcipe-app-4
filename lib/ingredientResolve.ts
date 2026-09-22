/**
 * Ingredient name normalisation + candidate generation for dictionary lookup.
 *
 * Users (and imports) type ingredients in many shapes: prefixes ("調味料：生抽"),
 * parentheticals ("豬骨（飛水）"), multi-item strings ("生抽/糖/生粉水"),
 * qualifiers ("新鮮三文魚扒"), sizes ("中蝦") and trailing quantities ("三文魚 200g").
 *
 * normalizeIngredientCandidates() returns the original name first, followed by
 * progressively looser candidates. Callers try each against their dictionary and
 * use the first hit.
 */

const PREFIX_RE = /^(調味料|材料|配料|醃料|醬汁|湯料|湯底|主料|主材料|餸料)\s*[:：]\s*/;
const PAREN_RE = /[（(][^）)]*[）)]/g;
const SPLIT_RE = /[/、,，]|或|及|\+|\+|＆|&/;
const LEADING_QUALIFIER_RE = /^(新鮮|優質|上等|靚|自製|現成|冰鮮|急凍|冷凍|冷藏|熟|生|日本|韓國|泰式|日式|中式|西式|台式|意大利|義大利|法國|美國|澳洲|本地|有機|無鹽|低脂|特大|特級|特選|大|中|小|細|鮮|乾|急凍)+/;
const TRAILING_QTY_RE = /\s*[0-9０-９一二三四五六七八九十半]+\s*(克|g|kg|公斤|磅|lb|安士|oz|毫升|ml|升|l|L|杯|碗|湯匙|茶匙|個|隻|條|片|粒|棵|扎|把|包|盒|罐|支|瓶|瓣|件|塊|份|斤|両|両)?\s*$/;

// Common HK variant characters → canonical
const VARIANT_MAP: Record<string, string> = {
  蕃: "番", 蕃茄: "番茄",
  蒜茸: "蒜蓉",
  蒟蒻: "蒟蒻",
  青瓜: "青瓜",
  粟米: "粟米",
  花生: "花生",
};

export function applyVariants(s: string): string {
  let out = s;
  for (const [from, to] of Object.entries(VARIANT_MAP)) {
    if (from !== to && out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Generate lookup candidates, best (most specific) first. */
export function normalizeIngredientCandidates(raw: string): string[] {
  const base = String(raw ?? "").trim();
  if (!base) return [];
  const out: string[] = [base];

  let s = base.replace(PREFIX_RE, "").trim();
  out.push(s);
  out.push(s.replace(PAREN_RE, "").trim());

  // strip trailing quantity from the longest form
  const noQty = s.replace(TRAILING_QTY_RE, "").trim();
  if (noQty && noQty !== s) out.push(noQty);
  const noQtyNoParen = noQty.replace(PAREN_RE, "").trim();
  if (noQtyNoParen) out.push(noQtyNoParen);

  // split multi-item strings and push each part (plus its looser forms)
  const parts = s.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const p of parts) {
      out.push(p);
      out.push(p.replace(PAREN_RE, "").trim());
      const q = p.replace(TRAILING_QTY_RE, "").trim();
      if (q) out.push(q);
    }
  }

  // drop leading qualifiers (only when something remains)
  for (const cand of [...out]) {
    const stripped = cand.replace(LEADING_QUALIFIER_RE, "").trim();
    if (stripped && stripped.length >= 1 && stripped !== cand) out.push(stripped);
  }

  return dedupe([...out, ...out.map(applyVariants)]);
}
