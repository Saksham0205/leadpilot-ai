export type Temperature = "Hot" | "Warm" | "Cold";
export type Direction = "incoming" | "outgoing";
export type AnalysisMode = "llm" | "fallback";
export type QueueStatus = "overdue" | "today" | "upcoming" | "completed";

export const REPS = ["Priya Sharma", "Arjun Rao", "Neha Kapoor", "Rohan Iyer", "Kavya Menon"] as const;
export const SOURCES = ["Website", "Referral", "Trade show", "WhatsApp"] as const;

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  source: string;
  rep: string;
  last_contact_at: string | null;
  temperature: Temperature;
  reason: string;
  next_follow_up: string | null;
  recommended_action: string;
  draft_message: string;
  intent_signals: string[];
  confidence: number;
  follow_up_status: "pending" | "completed";
  analysis_mode: AnalysisMode;
  analyzed_at: string | null;
  last_sent_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  direction: Direction;
  body: string;
  sent_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: string;
  detail: string;
  created_at: string;
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function queueStatus(lead: Lead, today = localToday()): QueueStatus {
  if (lead.follow_up_status === "completed") return "completed";
  if (!lead.next_follow_up) return "upcoming";
  if (lead.next_follow_up < today) return "overdue";
  if (lead.next_follow_up === today) return "today";
  return "upcoming";
}

const statusRank: Record<QueueStatus, number> = { overdue: 0, today: 1, upcoming: 2, completed: 3 };
const tempRank: Record<Temperature, number> = { Hot: 0, Warm: 1, Cold: 2 };

export function sortQueue(leads: Lead[], today = localToday()): Lead[] {
  return [...leads].sort((a, b) => {
    const s = statusRank[queueStatus(a, today)] - statusRank[queueStatus(b, today)];
    if (s) return s;
    const t = tempRank[a.temperature] - tempRank[b.temperature];
    if (t) return t;
    const ad = a.next_follow_up ?? "9999", bd = b.next_follow_up ?? "9999";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (b.last_contact_at ?? "").localeCompare(a.last_contact_at ?? "");
  });
}
