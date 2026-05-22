/**
 * Duplicate-employee detection.
 *
 * Operates fully in memory — the employee roster is small (tens of
 * rows), so an O(n^2) pairwise comparison is fine and avoids any
 * fuzzy-matching dependency.
 */

export interface QcEmployee {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  national_id: string | null;
  employee_code: string | null;
}

export interface DuplicatePair {
  a: QcEmployee;
  b: QcEmployee;
  score: number;
  reasons: string[];
}

function normalizeName(name: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9֐-׿ ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Compare on the last 9 digits to absorb country-code variation.
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Name similarity in [0,1] after token-sort normalization. */
function nameSimilarity(a: string | null, b: string | null): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Returns candidate duplicate pairs ordered by descending confidence.
 * A pair is reported when it shares a hard identifier (email, phone,
 * national id) or its names are highly similar.
 */
export function findDuplicates(employees: QcEmployee[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < employees.length; i++) {
    for (let j = i + 1; j < employees.length; j++) {
      const a = employees[i];
      const b = employees[j];
      const reasons: string[] = [];
      let score = 0;

      if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
        reasons.push("email");
        score += 0.5;
      }

      const phonesA = [normalizePhone(a.phone), normalizePhone(a.whatsapp_phone)].filter(Boolean);
      const phonesB = [normalizePhone(b.phone), normalizePhone(b.whatsapp_phone)].filter(Boolean);
      if (phonesA.some((p) => phonesB.includes(p))) {
        reasons.push("phone");
        score += 0.4;
      }

      if (
        a.national_id &&
        b.national_id &&
        a.national_id.replace(/\s/g, "") === b.national_id.replace(/\s/g, "")
      ) {
        reasons.push("national_id");
        score += 0.6;
      }

      if (
        a.employee_code &&
        b.employee_code &&
        a.employee_code.toLowerCase() === b.employee_code.toLowerCase()
      ) {
        reasons.push("employee_code");
        score += 0.5;
      }

      const sim = nameSimilarity(a.full_name, b.full_name);
      if (sim >= 0.85) {
        reasons.push(sim === 1 ? "identical_name" : "similar_name");
        score += sim * 0.5;
      }

      if (reasons.length > 0 && (score >= 0.5 || reasons.length >= 2)) {
        pairs.push({ a, b, score: Math.min(Math.round(score * 100) / 100, 1), reasons });
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score);
}
