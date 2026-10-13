import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect, useMemo, useState, type MouseEvent } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, Flame, Loader2, RefreshCw, Search, Users, Inbox, ListFilter, X, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/crm/AppShell";
import { LeadWorkspace } from "@/components/crm/LeadWorkspace";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { StatusChip, TempBadge } from "@/components/crm/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { leadsQuery } from "@/lib/queries";
import { analyzeLead } from "@/lib/leads.functions";
import { REPS, SOURCES, localToday, queueStatus, sortQueue, type Lead, type QueueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  temp: fallback(z.string(), "all").default("all"),
  status: fallback(z.string(), "all").default("all"),
  rep: fallback(z.string(), "all").default("all"),
  source: fallback(z.string(), "all").default("all"),
  page: fallback(z.number().int(), 1).default(1),
  sel: fallback(z.string(), "").default(""),
});
const PAGE_SIZE = 8;

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Lead Pilot AI — Today's sales follow-ups" },
      { name: "description", content: "See which packaging-equipment leads to contact today, what's overdue, and the next message to send." },
      { property: "og:title", content: "Lead Pilot AI — Today's sales follow-ups" },
      { property: "og:description", content: "AI sales follow-up agent: Hot/Warm/Cold leads, reasons and ready-to-send drafts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(leadsQuery()); },
  component: Dashboard,
  pendingComponent: () => <AppShell><div className="flex h-96 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leads…</div></AppShell>,
});

function Dashboard() {
  const { data: leads } = useSuspenseQuery(leadsQuery());
  // Dates depend on the rep's local timezone, so compute them only in the browser.
  const [today, setToday] = useState("");
  useEffect(() => setToday(localToday()), []);
  // Filters live in the URL and are mirrored to sessionStorage, so they survive
  // navigation to/from lead pages — including plain "Dashboard" links without params.
  const { q, temp, status, rep, source, page, sel } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const isDefault = !q && temp === "all" && status === "all" && rep === "all" && source === "all";
  useEffect(() => {
    const KEY = "dashboard-filters";
    if (isDefault) {
      const saved = sessionStorage.getItem(KEY);
      if (saved && saved !== "{}") {
        try {
          const f = JSON.parse(saved);
          if (f.q || f.temp !== "all" || f.status !== "all" || f.rep !== "all" || (f.source && f.source !== "all"))
            navigate({ search: (prev) => ({ ...prev, ...f }), replace: true });
        } catch { /* ignore corrupt value */ }
      }
    } else {
      sessionStorage.setItem(KEY, JSON.stringify({ q, temp, status, rep, source }));
    }
  }, [q, temp, status, rep, source, isDefault, navigate]);
  const setFilter = (patch: Partial<{ q: string; temp: string; status: string; rep: string; source: string }>) =>
    navigate({ search: (prev) => {
      const next = { ...prev, ...patch, page: 1, sel: prev.sel === "closed" ? "closed" : "" };
      if (!next.q && next.temp === "all" && next.status === "all" && next.rep === "all" && next.source === "all")
        sessionStorage.removeItem("dashboard-filters");
      return next;
    }, replace: true });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeLead);

  const stats = useMemo(() => ({
    total: leads.length,
    hot: leads.filter((l) => l.temperature === "Hot").length,
    today: leads.filter((l) => queueStatus(l, today) === "today").length,
    overdue: leads.filter((l) => queueStatus(l, today) === "overdue").length,
  }), [leads, today]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return sortQueue(leads.filter((l) =>
      (!s || l.name.toLowerCase().includes(s) || l.company.toLowerCase().includes(s) || (digits.length > 2 && l.phone.replace(/\D/g, "").includes(digits))) &&
      (temp === "all" || l.temperature === temp) &&
      (status === "all" || (status === "attention" ? ["overdue", "today"].includes(queueStatus(l, today)) : status === "active" ? l.follow_up_status !== "completed" : queueStatus(l, today) === status)) &&
      (rep === "all" || l.rep === rep) &&
      (source === "all" || l.source === source)), today);
  }, [leads, q, temp, status, rep, source, today]);

  const run = useMutation({
    mutationFn: async () => {
      const open = leads.filter((l) => l.follow_up_status !== "completed");
      setProgress({ done: 0, total: open.length });
      let llm = 0, fb = 0, failed = 0;
      for (const [i, l] of open.entries()) {
        try { const r = await analyze({ data: { id: l.id, today } }); r.mode === "llm" ? llm++ : fb++; }
        catch { failed++; }
        setProgress({ done: i + 1, total: open.length });
      }
      return { llm, fb, failed };
    },
    onSettled: () => { setProgress(null); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onSuccess: (r) => {
      const msg = `Agent re-analyzed ${r.llm + r.fb} leads`;
      r.failed ? toast.error(`${msg}; ${r.failed} failed and kept previous data`) : toast.success(msg);
    },
  });

  const cards = [
    { label: "Total leads", value: stats.total, Icon: Users, cls: "text-foreground", f: () => setFilter({ status: "all", temp: "all" }) },
    { label: "Hot leads", value: stats.hot, Icon: Flame, cls: "text-hot", f: () => setFilter({ temp: "Hot" }) },
    { label: "Due today", value: stats.today, Icon: CalendarClock, cls: "text-today", f: () => setFilter({ status: "today" }) },
    { label: "Overdue", value: stats.overdue, Icon: AlertTriangle, cls: "text-hot", f: () => setFilter({ status: "overdue" }) },
  ];
  const actNow = filtered.filter((l) => { const s = queueStatus(l, today); return s === "overdue" || s === "today"; }).length;
  const activeFilters = [
    ...(q ? [{ key: "q" as const, label: `Search: ${q}`, reset: "" }] : []),
    ...(temp !== "all" ? [{ key: "temp" as const, label: `Temperature: ${temp}`, reset: "all" }] : []),
    ...(status !== "all" ? [{ key: "status" as const, label: `Status: ${{ overdue: "Overdue", today: "Due today", upcoming: "Upcoming", completed: "Completed" }[status] ?? status}`, reset: "all" }] : []),
    ...(rep !== "all" ? [{ key: "rep" as const, label: `Rep: ${rep}`, reset: "all" }] : []),
    ...(source !== "all" ? [{ key: "source" as const, label: `Source: ${source}`, reset: "all" }] : []),
  ];
  const clearAll = () => setFilter({ q: "", temp: "all", status: "all", rep: "all", source: "all" });

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(Math.max(1, page), pages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const selected = sel === "closed" ? undefined : leads.find((l) => l.id === sel) ?? pageRows[0];
  useEffect(() => {
    if (!sel && selected) navigate({ search: (prev) => ({ ...prev, sel: selected.id }), replace: true });
  }, [sel, selected?.id, navigate]);
  const goPage = (n: number) => navigate({ search: (prev) => ({ ...prev, page: n, sel: prev.sel === "closed" ? "closed" : "" }), replace: true });
  const closePreview = () => navigate({ search: (prev) => ({ ...prev, sel: "closed" }), replace: true });
  const select = (id: string) => {
    if (window.matchMedia("(min-width: 1024px)").matches) navigate({ search: (prev) => ({ ...prev, sel: id }), replace: true });
    else navigate({ to: "/leads/$id", params: { id } });
  };
  const statusOpts = [{ value: "all", label: "All statuses" }, { value: "attention", label: "Needs attention" }, { value: "active", label: "Active (not completed)" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "upcoming", label: "Upcoming" }, { value: "completed", label: "Completed" }];

  return (
    <AppShell>
      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card/95 px-4 py-2.5 backdrop-blur md:flex md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold">Priority Follow-Up Queue</h1>
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline-flex"><CalendarClock className="h-3 w-3" />{today ? format(parseISO(today), "EEEE, d MMM yyyy") : "\u00a0"}</span>
        </div>
        <div className="col-span-2 row-start-2 md:mx-auto md:w-full md:max-w-md md:flex-1">
          <label htmlFor="lead-search" className="sr-only">Search leads</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="lead-search" className="h-9 bg-card pl-9 shadow-none" placeholder="Search leads by name, company, or phone…" value={q} onChange={(e) => setFilter({ q: e.target.value })} /></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress ? `${progress.done}/${progress.total}` : "Starting"}</> : <><RefreshCw className="h-4 w-4" /> Run Agent</>}
          </Button>
          <AddLeadDialog />
        </div>
      </header>

      <div className={cn("lg:grid", selected && "lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]")}>
      <main className="min-w-0 space-y-4 px-4 py-4 md:px-6">
        <section aria-label="Lead overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map((c) => (
            <Button variant="ghost" key={c.label} onClick={c.f} className="h-auto flex-col items-stretch gap-0 rounded-lg border bg-card p-4 text-left hover:bg-muted/60">
              <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">{c.label}<c.Icon className={cn("h-4 w-4", c.cls)} /></span>
              <span className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", c.cls)}>{c.value}</span>
            </Button>
          ))}
        </section>

        <section aria-labelledby="queue-heading" className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <div className="grid min-w-0 grid-cols-1 gap-2 border-b px-4 py-3">
            <h2 id="queue-heading" className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider"><span className="truncate">Priority queue</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-muted-foreground">{filtered.length} of {leads.length}</span>{actNow > 0 && <span className="shrink-0 text-[11px] font-medium normal-case tracking-normal text-hot">{actNow} to contact now</span>}</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
            <FilterSelect label="Temperature" value={temp} onChange={(value) => setFilter({ temp: value })} options={[{ value: "all", label: "All temperatures" }, ...["Hot", "Warm", "Cold"].map((value) => ({ value, label: value }))]} />
            <FilterSelect label="Follow-up status" value={status} onChange={(value) => setFilter({ status: value })} options={statusOpts} />
            <FilterSelect label="Sales rep" value={rep} onChange={(value) => setFilter({ rep: value })} options={[{ value: "all", label: "All reps" }, ...REPS.map((value) => ({ value, label: value }))]} />
            <FilterSelect label="Source" value={source} onChange={(value) => setFilter({ source: value })} options={[{ value: "all", label: "All sources" }, ...SOURCES.map((value) => ({ value, label: value }))]} />
            {!isDefault && <Button variant="ghost" size="sm" onClick={clearAll}><X className="h-3.5 w-3.5" /> Clear all</Button>}
            </div>
          </div>
          {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2"><ListFilter className="h-3.5 w-3.5 text-muted-foreground" />{activeFilters.map((filter) => <Button key={filter.key} variant="secondary" size="sm" className="h-auto min-h-6 max-w-full gap-1.5 whitespace-normal break-words px-2 py-0.5 text-left text-xs font-normal shadow-none" onClick={() => setFilter({ [filter.key]: filter.reset })} aria-label={`Remove ${filter.label} filter`}>{filter.label}<X className="h-3 w-3 shrink-0" /></Button>)}</div>}
          {!today ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading queue…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="font-medium text-foreground">No leads match these filters</p>
              {!isDefault && <Button variant="ghost" size="sm" onClick={clearAll}>Clear all filters</Button>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table aria-label="Sales leads" className="w-full min-w-[600px] table-fixed text-left text-xs">
                  <colgroup><col className="w-[29%]" /><col className="w-[13%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[5%]" /></colgroup>
                  <thead className="border-b bg-muted/60 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 font-medium">Lead / Company</th>
                      <th scope="col" className="px-2 py-2.5 font-medium">Temp.</th>
                      <th scope="col" className="px-2 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-2 py-2.5 font-medium">Next follow-up</th>
                      <th scope="col" className="px-2 py-2.5 font-medium">Sales rep</th>
                      <th scope="col" className="py-2.5"><span className="sr-only">Open lead</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">{pageRows.map((l) => <Row key={l.id} lead={l} s={queueStatus(l, today)} active={selected?.id === l.id} onSelect={select} />)}</tbody>
                </table>
              </div>
              <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span>Showing {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => goPage(curPage - 1)} disabled={curPage <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                  {Array.from({ length: pages }, (_, k) => k + 1).map((n) => <Button key={n} variant={n === curPage ? "default" : "ghost"} size="sm" className="h-7 min-w-7 px-2" onClick={() => goPage(n)} aria-current={n === curPage ? "page" : undefined}>{n}</Button>)}
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => goPage(curPage + 1)} disabled={curPage >= pages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </nav>
            </>
          )}
        </section>
      </main>
      {selected && <aside aria-label="Lead preview" className="hidden border-l bg-card lg:block">
        <div className="sticky top-[53px] h-[calc(100vh-53px)] overflow-y-auto">
          <div className="flex justify-end border-b px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePreview} aria-label="Close lead preview" title="Close lead preview"><X className="h-4 w-4" /></Button>
          </div>
          <ClientOnly fallback={null}><Suspense fallback={<div className="flex h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading lead…</div>}><LeadWorkspace key={selected.id} id={selected.id} variant="panel" /></Suspense></ClientOnly>
        </div>
      </aside>}
      </div>
    </AppShell>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className={cn("h-8 w-auto min-w-[8.5rem] bg-card text-xs shadow-none", value !== "all" && "border-ring bg-accent/40")}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function Row({ lead: l, s, active, onSelect }: { lead: Lead; s: QueueStatus; active: boolean; onSelect: (id: string) => void }) {
  const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (window.getSelection()?.toString()) return;
    onSelect(l.id);
  };
  return (
    <tr onClick={onClick} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onSelect(l.id); } }} tabIndex={0} aria-selected={active}
      className={cn("group cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2", active && "bg-accent/50 hover:bg-accent/50")}>
      <td className="px-3 py-3 align-middle">
        <span className={cn("block truncate text-sm font-semibold", active && "text-today")} title={l.name}>{l.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={l.company}>{l.company}</span>
      </td>
      <td className="px-2 py-3 align-middle"><TempBadge t={l.temperature} /></td>
      <td className="whitespace-nowrap px-2 py-3 align-middle"><StatusChip s={s} /></td>
      <td className={cn("whitespace-nowrap px-2 py-3 align-middle font-medium tabular-nums", s === "overdue" ? "text-hot" : s === "today" ? "text-today" : "text-foreground")}>{l.next_follow_up ? format(parseISO(l.next_follow_up), "d MMM yyyy") : "—"}</td>
      <td className="break-words px-2 py-3 align-middle text-muted-foreground">{l.rep}</td>
      <td className="py-3 pr-2 align-middle"><Link to="/leads/$id" params={{ id: l.id }} aria-label={`Open ${l.name} full page`} className="inline-flex rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUpRight className="h-4 w-4" /></Link></td>
    </tr>
  );
}
