import { Flame, Snowflake, Sun, AlertTriangle, CalendarClock, CalendarDays, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueStatus, Temperature } from "@/lib/types";

const temp: Record<Temperature, { cls: string; Icon: typeof Flame }> = {
  Hot: { cls: "bg-hot-soft text-hot", Icon: Flame },
  Warm: { cls: "bg-warm-soft text-warm", Icon: Sun },
  Cold: { cls: "bg-cold-soft text-cold", Icon: Snowflake },
};

export function TempBadge({ t, className }: { t: Temperature; className?: string }) {
  const { cls, Icon } = temp[t];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium", cls, className)}>
      <Icon className="h-3 w-3" /> {t}
    </span>
  );
}

const status: Record<QueueStatus, { label: string; cls: string; Icon: typeof Flame }> = {
  overdue: { label: "Overdue", cls: "bg-hot-soft text-hot border-hot/30", Icon: AlertTriangle },
  today: { label: "Due today", cls: "bg-today-soft text-today border-today/30", Icon: CalendarClock },
  upcoming: { label: "Upcoming", cls: "bg-muted text-muted-foreground border-border", Icon: CalendarDays },
  completed: { label: "Completed", cls: "bg-success-soft text-success border-success/30", Icon: CheckCircle2 },
};

export function StatusChip({ s }: { s: QueueStatus }) {
  const { label, cls, Icon } = status[s];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

