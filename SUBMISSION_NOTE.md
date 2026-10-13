# Lead Pilot AI — Sales Follow-Up Agent

I built Lead Pilot AI, a follow-up workspace for a five-rep packaging-equipment team. Reps can see leads by urgency and filter them by temperature, status, owner, or source; review the conversation; log messages; and edit, copy, and mark a suggested follow-up as sent. Lead, message, and activity data are stored in Supabase.

For each analysis, the agent reads the lead context and chronological conversation. When configured, the OpenAI Responses API (default model `gpt-4.1-mini`) returns a schema-validated temperature, evidence-based reason, intent signals, next action, follow-up date, and message draft. Hot indicates strong buying intent, active quote/demo/order discussion, concrete budget or timing, or an urgent unanswered question. Warm indicates genuine interest with requirements or timing still unclear. Cold indicates weak engagement, repeated unanswered outreach, a distant timeline, or an opt-out; opt-outs produce no draft. If the API key is absent or the call fails, a deterministic fallback scores buying-signal keywords in the last three incoming messages, then adjusts for recency, unanswered follow-ups, and distant timelines: 5+ is Hot, 2–4 Warm, and below 2 Cold. Opt-outs always override the score.

The AI tools used are the OpenAI Responses API for runtime analysis and AI-assisted coding tools during development. The app is built with TanStack Start, React, and TypeScript, with Supabase for persistence.

Next, I would add rep accounts and role-based access, import leads and conversations from CSV or WhatsApp, and run scheduled daily analyses with rep-specific digests. I would also let reps correct classifications and use those corrections to evaluate and improve the agent against labeled conversations.
