import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Activity, Lead, Message } from "./types";
import { addDays } from "./agent/schema";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

async function getDb() {
  const { db } = await import("./db.server");
  return db();
}

async function runAnalysis(leadId: string, today: string, opts: { resetStatus: boolean }) {
  const sb = await getDb();
  const { data: lead, error } = await sb.from("leads").select("*").eq("id", leadId).single();
  if (error || !lead) throw new Error("Lead not found");
  const { data: msgs } = await sb.from("messages").select("*").eq("lead_id", leadId).order("sent_at");
  const input = {
    today,
    lead: { name: lead.name, company: lead.company, source: lead.source, rep: lead.rep, lastContactAt: lead.last_contact_at },
    messages: (msgs ?? []).map((m) => ({ direction: m.direction as "incoming" | "outgoing", body: m.body, sentAt: m.sent_at })),
    previousDraft: lead.draft_message,
  };

  const { fallbackAnalyze } = await import("./agent/fallback");
  let mode: "llm" | "fallback" = "llm";
  let note = "";
  let result;
  try {
    const { llmAnalyze } = await import("./agent/llm.server");
    result = await llmAnalyze(input);
  } catch (e) {
    mode = "fallback";
    const msg = e instanceof Error ? e.message : String(e);
    note = msg === "NO_KEY" ? "AI key not configured" : "AI request failed";
    console.error("LLM analysis failed, using fallback:", msg);
    result = fallbackAnalyze(input);
  }

  const update = {
    temperature: result.temperature,
    reason: result.reason,
    next_follow_up: result.nextFollowUpDate,
    recommended_action: result.recommendedAction,
    draft_message: result.draftMessage,
    intent_signals: result.intentSignals,
    confidence: result.confidence,
    analysis_mode: mode,
    analyzed_at: new Date().toISOString(),
    ...(opts.resetStatus ? { follow_up_status: "pending" } : {}),
  };
  const { error: upErr } = await sb.from("leads").update(update).eq("id", leadId);
  if (upErr) throw new Error("Could not save analysis");
  await sb.from("activities").insert({
    lead_id: leadId,
    type: "analyzed",
    detail: `Lead re-analyzed as ${result.temperature}; next follow-up ${result.nextFollowUpDate}`,
  });
  return { mode, note, temperature: result.temperature };
}

export const listLeads = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getDb();
  const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Could not load leads");
  return data as unknown as Lead[];
});

export const getLead = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => ({ id: uuid.parse(d.id) }))
  .handler(async ({ data }) => {
    const sb = await getDb();
    const [l, m, a] = await Promise.all([
      sb.from("leads").select("*").eq("id", data.id).maybeSingle(),
      sb.from("messages").select("*").eq("lead_id", data.id).order("sent_at"),
      sb.from("activities").select("*").eq("lead_id", data.id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (l.error) throw new Error("Could not load lead");
    if (!l.data) return null;
    return { lead: l.data as unknown as Lead, messages: (m.data ?? []) as Message[], activities: (a.data ?? []) as Activity[] };
  });

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  company: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone"),
  source: z.string().min(2).max(40),
  rep: z.string().min(2).max(60),
  initialMessage: z.string().trim().max(2000).optional(),
  initialDirection: z.enum(["incoming", "outgoing"]).default("incoming"),
  lastContactDate: dateStr.optional(),
  today: dateStr,
});

export const createLead = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await getDb();
    const lastContact = data.lastContactDate ? new Date(data.lastContactDate + "T10:00:00").toISOString() : data.initialMessage ? new Date().toISOString() : null;
    const { data: lead, error } = await sb
      .from("leads")
      .insert({ name: data.name, company: data.company, phone: data.phone, source: data.source, rep: data.rep, last_contact_at: lastContact, next_follow_up: data.today })
      .select("id")
      .single();
    if (error || !lead) throw new Error("Could not save lead");
    if (data.initialMessage) {
      await sb.from("messages").insert({ lead_id: lead.id, direction: data.initialDirection, body: data.initialMessage, sent_at: lastContact ?? new Date().toISOString() });
    }
    await sb.from("activities").insert({ lead_id: lead.id, type: "created", detail: `Lead created by ${data.rep}` });
    let analysis = null;
    let analysisError: string | null = null;
    try { analysis = await runAnalysis(lead.id, data.today, { resetStatus: true }); }
    catch (e) { analysisError = e instanceof Error ? e.message : "Analysis failed"; }
    return { id: lead.id, analysis, analysisError };
  });

const msgSchema = z.object({
  leadId: uuid,
  direction: z.enum(["incoming", "outgoing"]),
  body: z.string().trim().min(1).max(2000),
  sentAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  today: dateStr,
});

export const addMessage = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof msgSchema>) => msgSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await getDb();
    const sentAt = new Date(data.sentAt).toISOString();
    const { error } = await sb.from("messages").insert({ lead_id: data.leadId, direction: data.direction, body: data.body, sent_at: sentAt });
    if (error) throw new Error("Could not save message");
    const { data: lead } = await sb.from("leads").select("last_contact_at").eq("id", data.leadId).single();
    if (!lead?.last_contact_at || lead.last_contact_at < sentAt) await sb.from("leads").update({ last_contact_at: sentAt }).eq("id", data.leadId);
    await sb.from("activities").insert({ lead_id: data.leadId, type: "message_added", detail: `${data.direction === "incoming" ? "Incoming" : "Outgoing"} message logged` });
    let analysis = null;
    let analysisError: string | null = null;
    try { analysis = await runAnalysis(data.leadId, data.today, { resetStatus: true }); }
    catch (e) { analysisError = e instanceof Error ? e.message : "Analysis failed"; }
    return { analysis, analysisError };
  });

export const analyzeLead = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; today: string; resetStatus?: boolean }) => ({ id: uuid.parse(d.id), today: dateStr.parse(d.today), resetStatus: !!d.resetStatus }))
  .handler(async ({ data }) => runAnalysis(data.id, data.today, { resetStatus: data.resetStatus }));

export const saveDraft = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; draft: string }) => ({ id: uuid.parse(d.id), draft: z.string().max(2000).parse(d.draft) }))
  .handler(async ({ data }) => {
    const sb = await getDb();
    const { error } = await sb.from("leads").update({ draft_message: data.draft }).eq("id", data.id);
    if (error) throw new Error("Could not save draft");
    return { ok: true };
  });

export const markSent = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; message: string; today: string }) => ({ id: uuid.parse(d.id), message: z.string().trim().min(1).max(2000).parse(d.message), today: dateStr.parse(d.today) }))
  .handler(async ({ data }) => {
    const sb = await getDb();
    const { data: lead } = await sb.from("leads").select("temperature").eq("id", data.id).single();
    if (!lead) throw new Error("Lead not found");
    const now = new Date().toISOString();
    const gap = lead.temperature === "Hot" ? 2 : lead.temperature === "Warm" ? 5 : 14;
    const next = addDays(data.today, gap);
    const { error: mErr } = await sb.from("messages").insert({ lead_id: data.id, direction: "outgoing", body: data.message, sent_at: now });
    if (mErr) throw new Error("Could not record message");
    const { error } = await sb.from("leads").update({ follow_up_status: "completed", last_sent_at: now, last_contact_at: now, next_follow_up: next, draft_message: data.message }).eq("id", data.id);
    if (error) throw new Error("Could not update lead");
    await sb.from("activities").insert({ lead_id: data.id, type: "message_sent", detail: `Follow-up marked as sent; next check-in ${next}` });
    return { next, sentAt: now };
  });
