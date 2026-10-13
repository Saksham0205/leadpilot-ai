import { z } from "zod";

export const analysisSchema = z.object({
  temperature: z.enum(["Hot", "Warm", "Cold"]),
  reason: z.string().min(5).max(300),
  nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), "invalid date"),
  recommendedAction: z.string().min(3).max(400),
  draftMessage: z.string().max(1200),
  intentSignals: z.array(z.string().max(80)).max(8),
  confidence: z.number().min(0).max(1),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["temperature", "reason", "nextFollowUpDate", "recommendedAction", "draftMessage", "intentSignals", "confidence"],
  properties: {
    temperature: { type: "string", enum: ["Hot", "Warm", "Cold"] },
    reason: { type: "string", description: "One concise sentence grounded in the conversation" },
    nextFollowUpDate: { type: "string", description: "YYYY-MM-DD" },
    recommendedAction: { type: "string" },
    draftMessage: { type: "string", description: "WhatsApp-style message, or empty string if the buyer asked not to be contacted" },
    intentSignals: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
} as const;

export interface AgentInput {
  today: string;
  lead: { name: string; company: string; source: string; rep: string; lastContactAt: string | null };
  messages: { direction: "incoming" | "outgoing"; body: string; sentAt: string }[];
  previousDraft?: string;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
