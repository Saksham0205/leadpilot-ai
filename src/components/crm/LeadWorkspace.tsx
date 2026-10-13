import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Check, Copy, Loader2, Maximize2, MessageSquarePlus, Phone, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatusChip, TempBadge } from "@/components/crm/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadQuery } from "@/lib/queries";
import { addMessage, analyzeLead, markSent, saveDraft } from "@/lib/leads.functions";
import { localToday, queueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const intentTagColors = [
  "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
];

const fmt = (s: string | null, p = "d MMM yyyy") => (s ? format(parseISO(s), p) : "—");

export function LeadWorkspace({ id, variant = "page" }: { id: string; variant?: "page" | "panel" }) {
  const panel = variant === "panel";
  const { data } = useSuspenseQuery(leadQuery(id));
  const qc = useQueryClient();
  const lead = data!.lead;
  const today = localToday();
  const [draft, setDraft] = useState(lead.draft_message);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(lead.draft_message), [lead.draft_message, lead.analyzed_at]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["leads"] }); };
  const analyzeFn = useServerFn(analyzeLead);
  const sentFn = useServerFn(markSent);
  const draftFn = useServerFn(saveDraft);
  const msgFn = useServerFn(addMessage);

  const reanalyze = useMutation({
    mutationFn: () => analyzeFn({ data: { id, today, resetStatus: true } }),
    onSuccess: (r) => toast.success(`Re-analyzed: ${r.temperature}`),
    onError: (e) => toast.error(`Analysis failed — previous data kept. ${e instanceof Error ? e.message : ""}`),
    onSettled: refresh,
  });
  const sent = useMutation({
    mutationFn: () => sentFn({ data: { id, message: draft, today } }),
    onSuccess: (r) => toast.success(`Marked as sent. Next check-in ${format(parseISO(r.next), "d MMM")}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not mark as sent"),
    onSettled: refresh,
  });
  const save = useMutation({
    mutationFn: () => draftFn({ data: { id, draft } }),
    onSuccess: () => toast.success("Draft saved"),
    onError: () => toast.error("Could not save draft"),
    onSettled: refresh,
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); toast.success("Message copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Clipboard not available — select the text and copy manually"); }
  };

  const s = queueStatus(lead, today);
  const busy = reanalyze.isPending;

  return (
    <>
      <div className={panel ? "p-4" : "px-4 py-6 md:px-8"}>
        {!panel && <BackLink />}
        <div className={cn("flex flex-wrap items-start gap-3", panel ? "mb-4" : "mb-6")}>
          <div className="mr-auto min-w-0">
            <div className="flex flex-wrap items-center gap-2">{panel ? <h2 className="text-lg font-semibold">{lead.name}</h2> : <h1 className="text-2xl font-bold">{lead.name}</h1>}<TempBadge t={lead.temperature} /><StatusChip s={s} /></div>
            <p className="text-muted-foreground">{lead.company}</p>
          </div>
          <Button variant="outline" size={panel ? "sm" : "default"} onClick={() => reanalyze.mutate()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {panel ? "Re-analyze" : "Re-analyze Lead"}
          </Button>
          {panel && <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="Open full lead page"><Link to="/leads/$id" params={{ id }}><Maximize2 className="h-4 w-4" /></Link></Button>}
        </div>

        <div className={cn("grid gap-6", !panel && "lg:grid-cols-[1fr_1.1fr]", panel && "gap-4")}>
          <div className="space-y-6">
            <section className="rounded-lg border bg-card p-5 shadow-[0_1px_2px_0_oklch(0_0_0/0.03)]">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Info k="Phone"><a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" />{lead.phone}</a></Info>
                <Info k="Source">{lead.source}</Info>
                <Info k="Assigned rep">{lead.rep}</Info>
                <Info k="Last contact">{fmt(lead.last_contact_at)}</Info>
                <Info k="Next follow-up"><span className={cn(s === "overdue" && "font-semibold text-hot", s === "today" && "font-semibold text-today")}>{fmt(lead.next_follow_up)}</span></Info>
                <Info k="Last sent">{lead.last_sent_at ? fmt(lead.last_sent_at, "d MMM, HH:mm") : "Not yet"}</Info>
              </dl>
            </section>

            <section className={cn("rounded-lg border bg-card p-5 shadow-[0_1px_2px_0_oklch(0_0_0/0.03)]", busy && "opacity-60")}>
              <div className="mb-3 flex flex-wrap items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-semibold">Agent analysis</h2>
                {lead.analyzed_at && <span className="ml-auto text-xs text-muted-foreground">Analyzed {fmt(lead.analyzed_at, "d MMM, HH:mm")} · {Math.round(Number(lead.confidence) * 100)}% confidence</span>}</div>
              <p className="text-sm"><span className="font-medium">Why {lead.temperature}:</span> {lead.reason}</p>
              <p className="mt-2 text-sm"><span className="font-medium">Next action:</span> {lead.recommended_action}</p>
              {lead.intent_signals.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{lead.intent_signals.map((x, i) => <span key={x} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", intentTagColors[i % intentTagColors.length])}>{x}</span>)}</div>}
            </section>

            <section className="rounded-lg border bg-card p-5 shadow-[0_1px_2px_0_oklch(0_0_0/0.03)]">
              <h2 className="mb-2 font-semibold">Follow-up message</h2>
              {!lead.draft_message && <p className="mb-2 text-sm text-hot">The buyer asked not to be contacted, so no message is suggested.</p>}
              <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Draft message" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={copy} disabled={!draft.trim()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy Message</Button>
                <Button className="ml-auto" onClick={() => sent.mutate()} disabled={sent.isPending || !draft.trim()}>
                  {sent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Mark as Sent</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Send it from WhatsApp yourself, then mark as sent here — Lead Pilot AI doesn't send WhatsApp messages.</p>
            </section>

            <section className="rounded-lg border bg-card p-5 shadow-[0_1px_2px_0_oklch(0_0_0/0.03)]">
              <h2 className="mb-3 font-semibold">Activity</h2>
              <ul className="space-y-2 text-sm">{data!.activities.map((a) => (
                <li key={a.id} className="flex gap-3"><span className="w-24 shrink-0 text-xs text-muted-foreground">{fmt(a.created_at, "d MMM HH:mm")}</span><span className={cn(a.type === "message_sent" && "text-success")}>{a.type === "analyzed" ? a.detail.replace(/^(?:AI model|Rule-based fallback(?: \([^)]+\))?) classified as /, "Lead re-analyzed as ") : a.detail}</span></li>))}</ul>
            </section>
          </div>

          <section className="rounded-lg border bg-[#efeae2] p-5 shadow-[0_1px_2px_0_oklch(0_0_0/0.03)] dark:bg-[#0b141a]">
            <h2 className="mb-4 font-semibold">Conversation</h2>
            {data!.messages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Log the first one below.</p> : (
              <ol className="space-y-3">{data!.messages.map((m) => (
                <li key={m.id} className={cn("flex", m.direction === "outgoing" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm", m.direction === "outgoing" ? "rounded-br-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white" : "rounded-bl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-white")}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-right text-[11px] opacity-70">{m.direction === "outgoing" ? lead.rep : lead.name} · {fmt(m.sent_at, "d MMM, HH:mm")}</p>
                  </div>
                </li>))}</ol>)}
            <AddChat onSubmit={(v) => msgFn({ data: { ...v, leadId: id, today } })} onDone={refresh} />
          </section>
        </div>
      </div>
    </>
  );
}

function Info({ k, children }: { k: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{children}</dd></div>;
}

function nowLocal() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function AddChat({ onSubmit, onDone }: { onSubmit: (v: { direction: "incoming" | "outgoing"; body: string; sentAt: string }) => Promise<{ analysis: { mode: string; temperature: string } | null; analysisError: string | null }>; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing");
  const [body, setBody] = useState("");
  const [at, setAt] = useState(nowLocal());
  const m = useMutation({
    mutationFn: () => onSubmit({ direction, body, sentAt: new Date(at).toISOString() }),
    onSuccess: (r) => {
      setBody(""); setOpen(false);
      if (r.analysisError) toast.error("Message saved, but re-analysis failed — previous analysis kept.");
      else toast.success(`Message saved · lead re-analyzed as ${r.analysis?.temperature}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save message"),
    onSettled: onDone,
  });
  if (!open) return <Button variant="outline" className="mt-5 w-full" onClick={() => { setAt(nowLocal()); setOpen(true); }}><MessageSquarePlus className="h-4 w-4" /> Add Chat Message</Button>;
  return (
    <form className="mt-5 space-y-3 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) m.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="dir">Direction</Label>
          <select id="dir" className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}>
            <option value="outgoing">Sent by sales rep</option><option value="incoming">Received from buyer</option></select></div>
        <div className="space-y-1"><Label htmlFor="at">Timestamp</Label><Input id="at" type="datetime-local" value={at} max={nowLocal()} onChange={(e) => setAt(e.target.value)} required /></div>
      </div>
      <Textarea rows={3} placeholder="Paste or type the WhatsApp message…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message text" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={m.isPending || !body.trim()}>{m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving & re-analyzing…</> : "Save message"}</Button>
      </div>
    </form>
  );
}

function BackLink() {
  const router = useRouter();
  // Go back in history so dashboard filters (kept in the URL) are restored;
  // fall back to a plain navigation when there is no dashboard entry in history.
  return (
    <button
      type="button"
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        idx > 0 ? router.history.back() : router.navigate({ to: "/" });
      }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Dashboard
    </button>
  );
}
