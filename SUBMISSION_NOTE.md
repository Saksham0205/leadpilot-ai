# Lead Pilot AI - AI-Powered Sales Follow-Up Agent

Lead Pilot AI is a sales workspace for a five-rep packaging-equipment team. The dashboard prioritizes leads by follow-up urgency and supports filtering by temperature, status, rep, and source. Reps can review each buyer's WhatsApp-style conversation, log incoming or outgoing messages, edit and copy a suggested follow-up, and mark it as sent. Leads, messages, and activities are stored in Supabase.

## How the agent classifies leads

The agent reviews the chronological conversation and lead context. **Hot** means clear buying intent, an active quote or demo, concrete budget or deadline, or an urgent unanswered buyer question. **Warm** means genuine interest with unclear requirements or timing, including supplier comparisons. **Cold** means weak engagement, repeated unanswered follow-ups, a distant buying timeline, or an opt-out. Opt-outs suppress suggested outreach. The agent also returns an evidence-based reason, intent signals, next action, follow-up date, and draft message.

## AI tools

Analysis uses a configurable LLM Responses API endpoint and requests strict JSON output, validated with Zod before saving. The default model is `gpt-4.1-mini`; the provider, model, and API key are configurable through server environment variables. If the API key is missing or the request fails, a deterministic weighted rule-based classifier analyzes buying signals, recency, unanswered questions, and follow-up history.

## What I would build next

Add rep accounts and role-based access, import leads and chats from CSV or WhatsApp, and schedule daily analysis with rep-specific digests. I would also collect rep corrections to improve classification and evaluate both the LLM and fallback against labeled conversations.
