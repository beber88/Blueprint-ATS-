import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Insights {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) {
    try {
      return JSON.parse(block[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]) as T;
  throw new Error("Failed to parse insights response");
}

/**
 * POST /api/hr-reports/insights
 * Body: the overview JSON from /api/hr-reports/overview.
 *
 * Asks Claude to read the HR snapshot and return an executive summary
 * with highlights, concerns and concrete recommendations.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
    }

    const overview = await request.json();
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are an HR director at a construction company in the Philippines. Read this HR data snapshot and produce a concise executive briefing for the owner.

HR snapshot (JSON):
${JSON.stringify(overview, null, 2)}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence plain-language overview of the HR state",
  "highlights": ["positive findings, max 4"],
  "concerns": ["risks or issues that need attention, max 4"],
  "recommendations": ["specific, actionable next steps, max 4"]
}

Be concrete and reference the actual numbers. Consider PH labor context (statutory contributions, contract expiry, overtime). If a section has no data, say so rather than inventing figures.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected AI response" }, { status: 502 });
    }

    const parsed = extractJSON<Insights>(content.text);
    return NextResponse.json({
      summary: parsed.summary || "",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    });
  } catch (err) {
    console.error("HR insights error:", err);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
