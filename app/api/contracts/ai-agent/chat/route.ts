import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildContractsContext } from "@/lib/claude/contracts-context";
import { buildContractsSystemPrompt } from "@/lib/claude/contracts-prompt";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  locale?: "he" | "en" | "tl";
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }
    const body = (await request.json()) as ChatBody;
    if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const ctx = await buildContractsContext();
    const system = buildContractsSystemPrompt(ctx.text, body.locale || "he");

    const msgs: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of (body.conversationHistory || []).slice(-10)) {
      msgs.push({ role: m.role, content: m.content });
    }
    msgs.push({ role: "user", content: body.message });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system,
      messages: msgs,
    });

    const block = response.content[0];
    if (!block || block.type !== "text") return NextResponse.json({ error: "Bad response" }, { status: 500 });
    return NextResponse.json({ response: block.text, counts: ctx.counts });
  } catch (error) {
    console.error("contracts ai-agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI failed" },
      { status: 500 }
    );
  }
}
