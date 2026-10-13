import { createFileRoute, Link, notFound, ClientOnly } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { LeadWorkspace } from "@/components/crm/LeadWorkspace";
import { leadQuery } from "@/lib/queries";
export const Route = createFileRoute("/leads/$id")({
  head: () => ({
    meta: [
      { title: "Lead details — Lead Pilot AI" },
      { name: "description", content: "Conversation history, AI classification and the next follow-up message for this lead." },
      { property: "og:title", content: "Lead details — Lead Pilot AI" },
      { property: "og:description", content: "Conversation, Hot/Warm/Cold reason and next message draft." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(leadQuery(params.id));
    if (!d) throw notFound();
  },
  component: LeadPage,
  notFoundComponent: () => <AppShell><div className="p-10 text-center"><p className="font-medium">Lead not found</p><Link to="/" className="text-primary underline">Back to dashboard</Link></div></AppShell>,
  errorComponent: ({ error }) => <AppShell><div className="p-10 text-center text-destructive">Couldn't load this lead: {error instanceof Error ? error.message : String(error)} <Link to="/" className="ml-2 text-primary underline">Back</Link></div></AppShell>,
});

function LeadPage() {
  const { id } = Route.useParams();
  return <ClientOnly fallback={<AppShell><div className="flex h-96 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading lead…</div></AppShell>}><AppShell><LeadWorkspace id={id} /></AppShell></ClientOnly>;
}
