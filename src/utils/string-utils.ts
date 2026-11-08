export function normalizeTag(tag: string): string {
  if (!tag) return "";
  let clean = tag.trim();
  if (clean.startsWith("#")) {
    clean = clean.slice(1);
  }
  return clean.trim();
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function fuzzyMatch(pattern: string, text: string): boolean {
  if (!pattern) return true;
  if (!text) return false;
  const p = pattern.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(p)) return true;

  // Subsequence match
  let pIdx = 0;
  for (let i = 0; i < t.length && pIdx < p.length; i++) {
    if (t[i] === p[pIdx]) {
      pIdx++;
    }
  }
  return pIdx === p.length;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
