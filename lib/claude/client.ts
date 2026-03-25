import Anthropic from "@anthropic-ai/sdk";
import { CVParseResult, AIScoreResult } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function parseCV(cvText: string): Promise<CVParseResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an expert HR assistant. Extract the following information from this CV text and return ONLY valid JSON with no additional text:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "experience_years": number,
  "education": "string",
  "skills": ["array of skills"],
  "certifications": ["array of certifications"],
  "previous_roles": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "description": "string"
    }
  ]
}

CV Text:
${cvText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    return JSON.parse(content.text) as CVParseResult;
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CVParseResult;
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}

export async function scoreCandidate(
  jobTitle: string,
  jobRequirements: string,
  candidateName: string,
  experienceYears: number,
  skills: string[],
  previousRoles: { title: string; company: string; duration: string; description: string }[],
  education: string
): Promise<AIScoreResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are a senior recruiter. Evaluate this candidate for the given job position.

JOB TITLE: ${jobTitle}
JOB REQUIREMENTS: ${jobRequirements}

CANDIDATE PROFILE:
Name: ${candidateName}
Experience: ${experienceYears} years
Skills: ${skills.join(", ")}
Previous Roles: ${JSON.stringify(previousRoles)}
Education: ${education}

Return ONLY valid JSON:
{
  "score": number between 0-100,
  "reasoning": "2-3 sentences explaining the score",
  "strengths": ["top 3 strengths"],
  "weaknesses": ["top 2 gaps"],
  "recommendation": "strong_yes | yes | maybe | no"
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    return JSON.parse(content.text) as AIScoreResult;
  } catch {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AIScoreResult;
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}
