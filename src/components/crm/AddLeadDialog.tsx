import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/lib/leads.functions";
import { REPS, SOURCES, localToday } from "@/lib/types";

const sel = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", company: "", phone: "", source: "Website", rep: REPS[0] as string, initialMessage: "", initialDirection: "incoming" as "incoming" | "outgoing", lastContactDate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const nav = useNavigate();
  const fn = useServerFn(createLead);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (r.analysisError) toast.error(`Lead saved, but analysis failed: ${r.analysisError}`);
      else toast.success(`Lead saved · ${r.analysis?.temperature}`);
      setOpen(false);
      setF({ ...f, name: "", company: "", phone: "", initialMessage: "", lastContactDate: "" });
      nav({ to: "/leads/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save lead"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er["name"] = "Enter the contact's name";
    if (f.company.trim().length < 2) er["company"] = "Enter the company";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim())) er["phone"] = "Enter a valid phone number";
    if (f.lastContactDate && f.lastContactDate > localToday()) er["lastContactDate"] = "Can't be in the future";
    setErrors(er);
    if (Object.keys(er).length) return;
    m.mutate({ data: { ...f, initialMessage: f.initialMessage.trim() || undefined, lastContactDate: f.lastContactDate || undefined, today: localToday() } });
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add Lead</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add a new lead</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Name")}
            {field("company", "Company")}
            {field("phone", "Phone", { placeholder: "+91 90000 00000" })}
            {field("lastContactDate", "Last contact date (optional)", { type: "date", max: localToday() })}
            <div className="space-y-1"><Label htmlFor="source">Source</Label>
              <select id="source" className={sel} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="rep">Assigned rep</Label>
              <select id="rep" className={sel} value={f.rep} onChange={(e) => setF({ ...f, rep: e.target.value })}>{REPS.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between"><Label htmlFor="msg">Initial conversation message (optional)</Label>
              <select aria-label="Message direction" className="h-7 rounded-md border border-input bg-card px-2 text-xs" value={f.initialDirection} onChange={(e) => setF({ ...f, initialDirection: e.target.value as "incoming" | "outgoing" })}>
                <option value="incoming">From buyer</option><option value="outgoing">From rep</option></select></div>
            <Textarea id="msg" rows={3} value={f.initialMessage} onChange={(e) => setF({ ...f, initialMessage: e.target.value })} placeholder="e.g. Hi, we need a quote for a pouch packing machine…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving & analyzing…</> : "Save lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
