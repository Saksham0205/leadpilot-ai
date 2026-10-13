import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Flame, Layers, PanelLeftClose, PanelLeftOpen, Users, type LucideIcon } from "lucide-react";
import logoUrl from "@/assets/logo_final.png";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { leadsQuery } from "@/lib/queries";
import { REPS, localToday, queueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = { key: string; label: string; Icon: LucideIcon; temp: string; status: string; count: number };
const base = { q: "", temp: "all", status: "all", rep: "all", page: 1, sel: "" };
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [today, setToday] = useState("");
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    setToday(localToday());
  }, []);
  const toggle = () => setCollapsed((previous) => {
    const next = !previous;
    localStorage.setItem("sidebar-collapsed", String(next));
    return next;
  });
  const { data: leads = [] } = useQuery(leadsQuery());
  const loc = useRouterState({ select: (s) => s.location });
  const onDash = loc.pathname === "/";
  const cur = loc.search as Partial<typeof base>;

  const views: View[] = useMemo(() => {
    const st = (l: (typeof leads)[number]) => (today ? queueStatus(l, today) : "upcoming");
    return [
      { key: "queue", label: "Priority Queue", Icon: Layers, temp: "all", status: "all", count: leads.length },
      { key: "attention", label: "Needs Attention Now", Icon: AlertTriangle, temp: "all", status: "attention", count: leads.filter((l) => ["overdue", "today"].includes(st(l))).length },
      { key: "hot", label: "Hot Buying Intent", Icon: Flame, temp: "Hot", status: "all", count: leads.filter((l) => l.temperature === "Hot").length, tone: "hot" },
      { key: "active", label: "All Active Leads", Icon: Users, temp: "all", status: "active", count: leads.filter((l) => l.follow_up_status !== "completed").length },
    ];
  }, [leads, today]);
  const repCounts = useMemo(() => Object.fromEntries(REPS.map((r) => [r, leads.filter((l) => l.rep === r).length])), [leads]);

  const viewActive = (v: View) => onDash && (cur.temp ?? "all") === v.temp && (cur.status ?? "all") === v.status && (cur.rep ?? "all") === "all";
  const resetSaved = () => sessionStorage.removeItem("dashboard-filters");

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen">
      <aside aria-label="Workspace sidebar" className={cn("sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r bg-nav px-2 py-3 text-nav-foreground transition-[width] duration-200 motion-reduce:transition-none md:flex", collapsed ? "w-16" : "w-60")}>
        <div className={cn("mb-4 flex gap-1", collapsed ? "flex-col items-center" : "items-center")}>
          <Link to="/" aria-label="Lead Pilot AI" className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 hover:bg-nav-active">
            <img src={logoUrl} alt="" width={24} height={24} className="h-6 w-6 shrink-0" decoding="async" />
            {!collapsed && <span className="flex min-w-0 flex-col"><span className="whitespace-nowrap text-sm font-semibold">Lead Pilot AI</span><span className="text-[9px] leading-tight text-nav-muted">AI-Powered Sales Follow-Up Agent</span></span>}
          </Link>
          <Tooltip>
            <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-nav-muted hover:bg-nav-active hover:text-nav-foreground" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-navigation">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button></TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>

        {!collapsed && (
          <div className="mx-1 mb-4 flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs">
            <span className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full bg-success" />{REPS.length} Reps Active</span>
            <span className="text-muted-foreground">Live</span>
          </div>
        )}

        <nav id="workspace-navigation" aria-label="Views">
          {!collapsed && <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-nav-muted">Views</p>}
          <ul className="space-y-0.5">
            {views.map((v) => {
              const active = viewActive(v);
              return (
                <li key={v.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/" search={{ ...base, temp: v.temp, status: v.status }} onClick={resetSaved} aria-current={active ? "page" : undefined}
                        className={cn("flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-nav-muted hover:bg-nav-active hover:text-nav-foreground", collapsed && "justify-center", active && "bg-nav-active font-medium text-nav-foreground")}>
                        <v.Icon className={cn("h-4 w-4 shrink-0", (v.key === "hot" || v.key === "attention") && "text-hot")} />
                        {!collapsed && <><span className="min-w-0 flex-1 truncate">{v.label}</span><span className={cn("rounded px-1.5 text-xs tabular-nums", active ? "bg-hot/10 text-hot" : "bg-muted text-muted-foreground")}>{v.count}</span></>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && <TooltipContent side="right">{v.label} ({v.count})</TooltipContent>}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav aria-label="Sales reps" className="mt-5">
          {!collapsed && <p className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-nav-muted">Sales reps <span className="font-normal normal-case tracking-normal">{REPS.length} members</span></p>}
          <ul className="space-y-0.5">
            {REPS.map((r) => {
              const active = onDash && cur.rep === r;
              return (
                <li key={r}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/" search={{ ...base, rep: r }} onClick={resetSaved} aria-current={active ? "page" : undefined}
                        className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-nav-muted hover:bg-nav-active hover:text-nav-foreground", collapsed && "justify-center", active && "bg-nav-active font-medium text-nav-foreground")}>
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-card text-[10px] font-semibold text-foreground">{initials(r)}</span>
                        {!collapsed && <><span className="min-w-0 flex-1 truncate">{r}</span><span className="text-xs tabular-nums text-muted-foreground">{repCounts[r]}</span></>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && <TooltipContent side="right">{r} ({repCounts[r]})</TooltipContent>}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b bg-nav px-4 py-3 text-nav-foreground md:hidden">
          <img src={logoUrl} alt="" width={20} height={20} className="h-5 w-5 shrink-0" decoding="async" /><Link to="/" className="flex flex-col"><span className="font-semibold">Lead Pilot AI</span><span className="text-[10px] leading-tight text-nav-muted">AI-Powered Sales Follow-Up Agent</span></Link>
        </div>
        {children}
      </div>
    </div>
    </TooltipProvider>
  );
}
