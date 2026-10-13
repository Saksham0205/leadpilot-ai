# Lead Pilot AI — AI-Powered Sales Follow-Up Agent

A sales workspace for a 5-rep packaging-equipment team. It shows who to contact today, what's overdue, whether each lead is Hot, Warm or Cold and why, plus a ready-to-send WhatsApp-style draft.

## Stack
- **TanStack Start** (React 19, TypeScript, file routes, server functions), Vite, Tailwind CSS v4, shadcn/ui, Lucide.
  - TanStack Start provides full-stack server functions through `createServerFn`, and API keys stay server-side.
- **Postgres** through your Supabase project for leads, messages and activities.
- **LLM**: OpenAI Responses API (configurable model and base URL, strict JSON schema), with a rule-based fallback.
- No login, by design.

## Architecture
```text
Browser (dashboard /, lead detail /leads/$id)
   │  TanStack Query + useServerFn
   ▼
src/lib/leads.functions.ts   server functions, inputs checked with zod
   ├── db.server.ts          Postgres client (publishable key)
   └── agent/
        ├── llm.server.ts    server-side API call, zod-validated
        ├── fallback.ts      rule-based engine
        └── schema.ts        output schema + JSON schema
```
Every analysis runs `runAnalysis()`: it loads the lead and its full chronological conversation, tries the LLM, and falls back to the rules if the key is missing or the call fails. It validates the result and saves it. An activity row records which mode produced the result. If saving fails, nothing is overwritten.

## Hot / Warm / Cold scoring
- **LLM mode:** the model gets the brief's classification, scheduling and messaging rules plus the conversation. Its output must match a strict schema with an enum temperature, a `YYYY-MM-DD` date, a confidence between 0 and 1, and signals. Dates in the past are moved forward to today.
- **Fallback mode:** weighted keyword signals in the last 3 incoming messages. Quote, demo or order count +3. Budget, deadline, price, capacity or installation count +2. Comparing suppliers, catalogue or service requests count +1.
  - Score adjustments: +1 if the buyer replied in the last 3 days. −3 if their last reply is more than 14 days old. −3 for 2 or more unanswered outgoing messages. −4 for a distant timeline.
  - Classification: a score of 5 or more is Hot, 2 or more is Warm, anything lower is Cold.
  - Opt-out phrases ("not interested", "do not follow up") always give Cold with no draft.
  - Next follow-up: today if a buyer question is unanswered, otherwise Hot +1 day, Warm +4 days, Cold +14 days (+30 days for a future timeline).
  - Drafts come from context-aware templates. Fallback confidence is capped at 0.75.
- The UI always labels each result as "AI model analysis" or "Rule-based fallback". Seed rows are hand-written sample analyses and show "Seed data" until they are re-analyzed.

**Queue order:** overdue first, then due today, then upcoming, then completed. Within each group: Hot before Warm before Cold, then earlier date, then most recent contact.

**Mark as Sent:** saves the draft as an outgoing message and sets the status to completed. It records the timestamp and an activity row, and schedules the next check-in (Hot +2 days, Warm +5, Cold +14). New chat messages or a re-analysis set the lead back to pending.

## Setup
```bash
bun install
cp .env.example .env   # add your Supabase values and OpenAI API key
bun run dev
```
Create a Supabase project, then run `drizzle/migrations/0000_migration.sql` in its SQL Editor. It creates the `leads`, `messages` and `activities` tables, enables the open demo access rules required by this no-login app, and inserts the sample leads and chats. Seed dates are relative to `now()`, so there are always overdue, due-today and upcoming leads. Run the migration only once per fresh project; it is not idempotent.

Use the project's **Project URL** and **publishable key** for the Supabase variables below. The app uses the publishable key from server functions and does not need a service-role key. The OpenAI key is optional: without it, analysis uses the existing rule-based fallback. To enable model analysis, set `LLM_API_KEY`. Keep API keys server-side and never add a `VITE_` prefix to them.

## Environment variables
| Name | Where | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server | Your Supabase project URL and publishable key |
| `LLM_API_KEY` | server only | OpenAI API key; if missing or the request fails, analysis uses the rule-based fallback |
| `LLM_MODEL` | server only | Model name (default: `gpt-4.1-mini`) |
| `LLM_BASE_URL` | server only | API base URL (default: `https://api.openai.com/v1`) |

## Deployment
- **Deployment:** set the server environment variables above, run `bun run build`, and deploy the app. Provision your Supabase project and run the SQL migration before opening it.

## AI tools used
- AI-assisted coding tools during development.
- OpenAI Responses API at runtime; configure the API key, model and optional compatible API base URL through server environment variables.

## Known limitations
- There is no login. The database is open to anyone using the publishable key: fine for a demo, not for production.
- "Run Agent" analyzes leads one at a time from the browser, so it is slow for large lists.
- The keyword fallback is English-only and has no real language understanding.
- Messages are logged by hand. There is no WhatsApp integration.

## Next steps
- Per-rep login and access rules, and an owner view.
- WhatsApp Business API import and Excel/CSV upload.
- A scheduled daily agent run and a morning digest per rep.
- Reply-rate analytics, and a feedback loop where reps correct the classification.
