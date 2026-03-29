import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || text.length < 3) return text;
  if (!process.env.ANTHROPIC_API_KEY) return text;

  const langName = targetLang === "he" ? "Hebrew" : targetLang === "tl" ? "Tagalog" : "English";

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Translate the following text to ${langName}. Return ONLY the translated text, nothing else. Keep technical terms, proper nouns, and abbreviations as-is. If the text is already in ${langName}, return it unchanged.

Text: ${text}`,
      }],
    });

    const content = response.content[0];
    return content.type === "text" ? content.text : text;
  } catch {
    return text;
  }
}

export async function translateAnalysis(
  analysis: Record<string, unknown>,
  targetLang: string
): Promise<Record<string, unknown>> {
  if (!analysis || targetLang === "en") return analysis; // Analysis is stored in English

  const anthropic = getClient();
  const langName = targetLang === "he" ? "Hebrew" : "Tagalog";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Translate this JSON analysis to ${langName}. Translate ALL string values but keep the JSON keys in English. Keep proper nouns (company names, person names, software names like AutoCAD, Revit) as-is. Return ONLY valid JSON.

${JSON.stringify(analysis)}`,
      }],
    });

    const content = response.content[0];
    if (content.type === "text") {
      // Try to parse the translated JSON
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(content.text);
      } catch {
        return analysis; // Return original if parse fails
      }
    }
    return analysis;
  } catch {
    return analysis;
  }
}
