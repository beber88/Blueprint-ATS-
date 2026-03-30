import Anthropic from '@anthropic-ai/sdk';

interface TranslatedContent {
  job_title: string;
  description: string;
  company: string;
}

export async function translateCandidateContent(
  content: { title: string; description: string; company: string },
  targetLang: 'he' | 'tl'
): Promise<TranslatedContent> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const langName = targetLang === 'he' ? 'Hebrew' : 'Tagalog';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Translate this construction industry job information to ${langName}.
Rules:
- Company names stay in English (proper nouns)
- Job titles should be translated naturally
- Descriptions should be translated professionally
- Keep technical terms that don't have a standard translation

Return ONLY JSON:
{"job_title":"translated title","description":"translated description","company":"original company name unchanged"}

Input:
Job title: ${content.title}
Company: ${content.company}
Description: ${content.description}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}
