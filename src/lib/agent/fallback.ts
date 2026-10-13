import { addDays, type AgentInput, type Analysis } from "./schema";

const SIGNALS: { re: RegExp; label: string; weight: number }[] = [
  { re: /\b(quote|quotation|proposal)\b/i, label: "quotation discussed", weight: 3 },
  { re: /\b(demo|demonstration|trial|visit)\b/i, label: "demo interest", weight: 3 },
  { re: /\b(order|purchase|buy|ready to)\b/i, label: "purchase intent", weight: 3 },
  { re: /\b(budget|approved|approval)\b/i, label: "budget mentioned", weight: 2 },
  { re: /\b(deadline|urgent|asap|next month|this quarter|this week)\b/i, label: "time pressure", weight: 2 },
  { re: /\b(price|pricing|cost|best price|discount)\b/i, label: "pricing question", weight: 2 },
  { re: /\b(capacity|per (minute|day|hour)|output|packs?\/min)\b/i, label: "capacity question", weight: 2 },
  { re: /\b(install|installation|lead time|delivery)\b/i, label: "installation/delivery question", weight: 2 },
  { re: /\b(compar|other suppliers?|shortlist|evaluat)\w*/i, label: "evaluating suppliers", weight: 1 },
  { re: /\b(catalogue|catalog|brochure|details|specs?)\b/i, label: "information request", weight: 1 },
  { re: /\b(service|maintenance|amc|repair)\b/i, label: "service inquiry", weight: 1 },
];
const NEGATIVE = /\b(not interested|do not (contact|follow)|don'?t (contact|follow)|stop messaging|unsubscribe)\b/i;
const FUTURE = /\b(next (financial )?year|next quarter|in \d+ months|later this year|april)\b/i;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function fallbackAnalyze(input: AgentInput): Analysis {
  const { today, lead, messages } = input;
  const first = lead.name.split(" ")[0];
  const incoming = messages.filter((m) => m.direction === "incoming");
  const lastIncoming = incoming[incoming.length - 1];
  const last = messages[messages.length - 1];
  const recentText = incoming.slice(-3).map((m) => m.body).join(" ");

  if (incoming.some((m) => NEGATIVE.test(m.body))) {
    return {
      temperature: "Cold",
      reason: "The buyer explicitly said they are not interested or asked not to be contacted.",
      nextFollowUpDate: addDays(today, 90),
      recommendedAction: "Respect the request: no outreach unless they re-engage.",
      draftMessage: "",
      intentSignals: ["opt-out"],
      confidence: 0.9,
    };
  }

  const hits = SIGNALS.filter((s) => s.re.test(recentText));
  let score = hits.reduce((n, s) => n + s.weight, 0);
  const signals = hits.map((h) => h.label);

  const daysSinceIncoming = lastIncoming ? daysBetween(lastIncoming.sentAt.slice(0, 10), today) : 999;
  if (daysSinceIncoming <= 3) score += 1;
  else if (daysSinceIncoming > 14) score -= 3;

  const trailingOutgoing = (() => {
    let n = 0;
    for (let i = messages.length - 1; i >= 0 && messages[i]?.direction === "outgoing"; i--) n++;
    return n;
  })();
  if (trailingOutgoing >= 2) { score -= 3; signals.push("unanswered follow-ups"); }

  const future = FUTURE.test(recentText);
  if (future) { score -= 4; signals.push("distant timeline"); }

  const unansweredQuestion = last?.direction === "incoming" && /\?|please|send|can you/i.test(last.body);
  if (unansweredQuestion) signals.push("buyer waiting on reply");

  const temperature = score >= 5 ? "Hot" : score >= 2 ? "Warm" : "Cold";
  const interval = unansweredQuestion ? 0 : temperature === "Hot" ? 1 : temperature === "Warm" ? 4 : future ? 30 : 14;
  const nextFollowUpDate = addDays(today, interval);

  const topic = hits[0]?.label;
  const snippet = lastIncoming ? lastIncoming.body.replace(/\s+/g, " ").slice(0, 90) : "";
  const reason = messages.length === 0
    ? `New ${lead.source.toLowerCase()} lead with no conversation yet; intent unknown.`
    : temperature === "Hot"
      ? `Strong buying signals (${signals.slice(0, 2).join(", ")}) in recent messages.`
      : temperature === "Warm"
        ? `Shows interest (${signals[0] ?? "engaged"}) but timing or requirements are unclear.`
        : future
          ? "Buying timeline is distant; nurture until closer to their budget cycle."
          : trailingOutgoing >= 2
            ? "Several follow-ups have gone unanswered with no new buying signal."
            : "Little engagement or buying intent so far.";

  let draftMessage: string;
  let recommendedAction: string;
  if (messages.length === 0) {
    draftMessage = `Hi ${first}, this is ${lead.rep.split(" ")[0]} from the packaging equipment team. Thanks for reaching out — what product are you looking to pack, and roughly what volume per day?`;
    recommendedAction = "Introduce yourself and qualify product type and volume.";
  } else if (unansweredQuestion) {
    draftMessage = `Hi ${first}, thanks for your message about "${snippet}". I'm getting you a clear answer on this — could we do a quick 10-minute call today or tomorrow to close any open points?`;
    recommendedAction = `Answer the open question${topic ? ` (${topic})` : ""} today.`;
  } else if (temperature === "Hot") {
    draftMessage = `Hi ${first}, following up on our discussion for ${lead.company}. Would you like to fix a time this week to finalise the next step?`;
    recommendedAction = "Propose a concrete next step (call, demo or quote review) this week.";
  } else if (temperature === "Warm") {
    draftMessage = `Hi ${first}, just checking in on your packaging requirement. Is there any detail (output, pack size or timeline) I can help clarify so you can compare options?`;
    recommendedAction = "Clarify requirements and timeline.";
  } else {
    draftMessage = `Hi ${first}, checking in from our side. If the timing isn't right now, no problem — happy to reconnect whenever it suits ${lead.company}.`;
    recommendedAction = future ? "Add to nurture and check in near their budget cycle." : "Send a low-pressure check-in; move to monthly nurture if silent.";
  }
  if (input.previousDraft && input.previousDraft.trim() === draftMessage.trim()) {
    draftMessage = draftMessage.replace(/^Hi (\w+),/, "Hello $1,");
  }

  return {
    temperature,
    reason,
    nextFollowUpDate,
    recommendedAction,
    draftMessage,
    intentSignals: signals.slice(0, 6),
    confidence: Math.min(0.75, 0.4 + hits.length * 0.07),
  };
}
