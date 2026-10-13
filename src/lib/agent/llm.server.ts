import { analysisJsonSchema, analysisSchema, type AgentInput, type Analysis } from "./schema";

const SYSTEM = `You are a sales follow-up agent for a B2B packaging-equipment company. Analyse the lead and its chronological WhatsApp conversation and return JSON.

Classification:
- Hot: explicit purchase intent; quotation, demo or proposal actively discussed; concrete requirement, budget, deadline or next step; or an urgent commercial question still unanswered.
- Warm: genuine interest but unclear timing/requirements; evaluating suppliers; requested info without immediate intent.
- Cold: no meaningful engagement; explicitly not interested; repeated follow-ups unanswered; distant timeline or unqualified.
Never mark Hot only because the buyer has not responded.

Scheduling (nextFollowUpDate, YYYY-MM-DD, relative to TODAY): unanswered urgent commercial question -> today or tomorrow; Hot 1-2 days; Warm 3-7 days; Cold 14-30+ days or nurture. Explicit buyer-requested dates take precedence. Never schedule before TODAY.

Message: concise, natural, professional WhatsApp style, use the buyer's first name, reference their actual requirement, one clear next step. No invented discounts, prices, quotations, specs or false claims. Do not repeat the previous draft. If the buyer asked not to be contacted, draftMessage must be "" and the action must respect that.
reason: one sentence grounded in the conversation. confidence: 0-1.`;

export async function llmAnalyze(input: AgentInput): Promise<Analysis> {
  const key = process.env['LLM_API_KEY'];
  if (!key) throw new Error("NO_KEY");

  const baseUrl = (process.env['LLM_BASE_URL'] || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env['LLM_MODEL'] || "gpt-4.1-mini";
  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: SYSTEM,
      input: [{ role: "user", content: JSON.stringify(input) }],
      text: { format: { type: "json_schema", name: "lead_analysis", strict: true, schema: analysisJsonSchema } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`LLM API ${res.status}: ${t.slice(0, 200)}`);
  }

  const response = await res.json() as {
    status?: string;
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (response.status && response.status !== "completed") {
    throw new Error(`LLM response status: ${response.status}`);
  }
  const text = response.output_text ?? response.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
  if (!text) throw new Error("LLM response did not contain output text");
  const parsed = analysisSchema.parse(JSON.parse(text));
  if (parsed.nextFollowUpDate < input.today) parsed.nextFollowUpDate = input.today;
  return parsed;
}
