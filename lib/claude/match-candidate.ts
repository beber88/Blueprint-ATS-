import { createClient } from '@supabase/supabase-js';

interface MatchResult {
  matched: boolean;
  candidate_id: string | null;
  candidate_name: string | null;
  match_method: 'exact_name' | 'fuzzy_name' | 'filename_parse' | 'none';
  confidence: number;
}

export async function matchDocumentToCandidate(
  detectedName: string | null,
  fileName: string
): Promise<MatchResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Strategy 1: Match by detected name from AI classification
  if (detectedName) {
    const { data: exactMatch } = await supabase
      .from('candidates')
      .select('id, full_name')
      .ilike('full_name', `%${detectedName}%`)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return {
        matched: true,
        candidate_id: exactMatch[0].id,
        candidate_name: exactMatch[0].full_name,
        match_method: 'exact_name',
        confidence: 0.95
      };
    }

    // Fuzzy match: try parts of the name
    const nameParts = detectedName.split(' ').filter(p => p.length > 2);
    for (const part of nameParts) {
      const { data: fuzzyMatch } = await supabase
        .from('candidates')
        .select('id, full_name')
        .ilike('full_name', `%${part}%`)
        .limit(5);

      if (fuzzyMatch && fuzzyMatch.length === 1) {
        return {
          matched: true,
          candidate_id: fuzzyMatch[0].id,
          candidate_name: fuzzyMatch[0].full_name,
          match_method: 'fuzzy_name',
          confidence: 0.75
        };
      }
    }
  }

  // Strategy 2: Parse the filename for a name
  const cleanedName = fileName
    .replace(/\.(pdf|docx?|jpg|png)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(portfolio|cv|resume|certificate|ref|letter|architectural)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedName.length > 3) {
    const nameParts = cleanedName.split(' ').filter(p => p.length > 2);
    if (nameParts.length > 0) {
      const orConditions = nameParts.map(p => `full_name.ilike.%${p}%`).join(',');
      const { data: fileNameMatch } = await supabase
        .from('candidates')
        .select('id, full_name')
        .or(orConditions)
        .limit(5);

      if (fileNameMatch && fileNameMatch.length === 1) {
        return {
          matched: true,
          candidate_id: fileNameMatch[0].id,
          candidate_name: fileNameMatch[0].full_name,
          match_method: 'filename_parse',
          confidence: 0.7
        };
      }
    }
  }

  return {
    matched: false,
    candidate_id: null,
    candidate_name: null,
    match_method: 'none',
    confidence: 0
  };
}
