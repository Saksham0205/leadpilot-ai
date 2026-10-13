CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL,
  phone text NOT NULL,
  source text NOT NULL DEFAULT 'Website',
  rep text NOT NULL,
  last_contact_at timestamptz,
  temperature text NOT NULL DEFAULT 'Warm' CHECK (temperature IN ('Hot','Warm','Cold')),
  reason text NOT NULL DEFAULT '',
  next_follow_up date,
  recommended_action text NOT NULL DEFAULT '',
  draft_message text NOT NULL DEFAULT '',
  intent_signals text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0.5,
  follow_up_status text NOT NULL DEFAULT 'pending' CHECK (follow_up_status IN ('pending','completed')),
  analysis_mode text NOT NULL DEFAULT 'fallback' CHECK (analysis_mode IN ('llm','fallback')),
  analyzed_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.messages(lead_id, sent_at);
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.activities(lead_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads, public.messages, public.activities TO anon, authenticated;
GRANT ALL ON public.leads, public.messages, public.activities TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open demo access" ON public.leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open demo access" ON public.messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open demo access" ON public.activities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed: dates relative to now()
DO $$
DECLARE
  d date := current_date;
  l uuid;
BEGIN
  -- helper pattern: insert lead, then messages
  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Rahul Mehta','Sunrise Foods Pvt Ltd','+91 90000 10001','Trade show','Priya Sharma', now() - interval '3 days','Hot','Requested a formal quotation for two form-fill-seal machines and has not received it yet.', d - 1,'Send the FFS quotation with delivery timeline today.','Hi Rahul, apologies for the delay. I am finalising the quotation for the two vertical FFS machines (60 packs/min) and will share it today. Would a quick call tomorrow at 11 work to walk through it?', ARRAY['quotation requested','quantity specified'],0.86) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Hi, we met at PackExpo. We need 2 vertical FFS machines for snacks, around 60 packs per minute.', now()-interval '6 days'),
   (l,'outgoing','Thanks Rahul! What pouch sizes and film type do you use?', now()-interval '5 days 20 hours'),
   (l,'incoming','100g and 200g pouches, laminated film. Please send a quotation, we want to order this quarter.', now()-interval '3 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Anita Desai','GreenLeaf Organics','+91 90000 10002','Website','Arjun Rao', now() - interval '2 days','Warm','Comparing our shrink-wrapper with two other suppliers; no decision timeline yet.', d,'Share a comparison sheet highlighting energy use and service coverage.','Hi Anita, since you are comparing shrink-wrap options, I have put together a one-page comparison of our SW-400 on energy use and local service. Shall I send it over?', ARRAY['evaluating suppliers'],0.7) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Looking for a shrink wrapping machine for our juice bottles.', now()-interval '8 days'),
   (l,'outgoing','Happy to help, Anita. Our SW-400 handles up to 25 packs/min. I have shared the brochure.', now()-interval '7 days'),
   (l,'incoming','Thanks. We are also checking two other suppliers before we decide.', now()-interval '2 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Vikram Singh','Apex Pharma Packaging','+91 90000 10003','Referral','Neha Kapoor', now() - interval '1 day','Hot','Asked about blister machine capacity for a concrete 40,000 strips/day requirement.', d,'Answer the capacity question with exact output figures and propose a demo.','Hi Vikram, our BL-250 runs up to 45,000 strips per day on a single shift, so it fits your 40,000 target with headroom. Would you like to see it running at our demo centre this week?', ARRAY['capacity question','concrete volume'],0.84) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Referred by Kumar from MedLife. We need a blister packing machine.', now()-interval '4 days'),
   (l,'outgoing','Great to hear from you Vikram. What output do you need per day?', now()-interval '3 days'),
   (l,'incoming','About 40,000 strips a day. Can your machine handle that capacity?', now()-interval '1 day');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Sara Thomas','CoastLine Seafood Exports','+91 90000 10004','WhatsApp','Rohan Iyer', now() - interval '5 days','Hot','Needs installation done before a firm export deadline next month and asked for timelines.', d - 2,'Confirm installation slot and engineer availability before her deadline.','Hi Sara, following up on installation for the vacuum packer. We can schedule installation within 10 days of order so you are ready before your export deadline. Shall I block a slot?', ARRAY['deadline','installation timeline'],0.82) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','We want a vacuum packing machine for frozen prawns.', now()-interval '9 days'),
   (l,'outgoing','Sure Sara, I have sent specs for the VP-600 double chamber.', now()-interval '8 days'),
   (l,'incoming','Looks good. How long does installation take? We must be running before our export order next month.', now()-interval '5 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Mohit Agarwal','Agarwal Spices','+91 90000 10005','Trade show','Priya Sharma', now() - interval '2 days','Hot','Negotiating price on a quoted auger filler and asked for our best offer.', d,'Call to discuss payment terms and value; do not offer unapproved discounts.','Hi Mohit, thanks for reviewing the auger filler quote. I would like to walk you through what is included (installation, training, 1-year warranty) and the payment terms we can offer. Free for a 10-minute call today?', ARRAY['price negotiation','quote reviewed'],0.8) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'outgoing','Hi Mohit, attached is the quotation for the AF-200 auger filler.', now()-interval '6 days'),
   (l,'incoming','Price is higher than we expected. What is your best price?', now()-interval '2 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Lakshmi Narayan','Temple Town Sweets','+91 90000 10006','Website','Arjun Rao', now() - interval '4 days','Warm','Requested the product catalogue but has not shared a requirement or timeline.', d - 1,'Send the catalogue and ask about product type and daily volume.','Hi Lakshmi, sharing our sweets and snacks packaging catalogue as promised. Which products are you looking to pack, and roughly how many boxes per day?', ARRAY['catalogue requested'],0.65) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Please send your product catalogue.', now()-interval '4 days'),
   (l,'outgoing','Sure, will share it shortly.', now()-interval '4 days' + interval '1 hour');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Deepak Joshi','Joshi Dairy','+91 90000 10007','Referral','Neha Kapoor', now() - interval '16 days','Cold','Went silent after receiving a quotation; two follow-ups unanswered.', d + 7,'Send a low-pressure check-in and move to monthly nurture if no reply.','Hi Deepak, just checking whether the pouch-filling quotation is still relevant for Joshi Dairy. If timing has changed, happy to reconnect later. No pressure.', ARRAY['quote sent','no response'],0.6) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Need a milk pouch filling machine quote.', now()-interval '30 days'),
   (l,'outgoing','Quotation attached for the MP-1000, Deepak.', now()-interval '28 days'),
   (l,'outgoing','Hi Deepak, any questions on the quote?', now()-interval '22 days'),
   (l,'outgoing','Following up on the pouch filler quotation.', now()-interval '16 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Fatima Sheikh','NovaCare Cosmetics','+91 90000 10008','WhatsApp','Kavya Menon', now() - interval '6 days','Cold','Interested but plans to purchase only after next financial year.', d + 21,'Add to nurture and check in closer to their budget cycle.','Hi Fatima, noted that you are planning the tube filler for next financial year. I will check in closer to then — meanwhile, happy to send a case study whenever useful.', ARRAY['future timeline'],0.72) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','We are exploring a tube filling machine for creams.', now()-interval '10 days'),
   (l,'outgoing','Great, Fatima. What volume do you expect?', now()-interval '9 days'),
   (l,'incoming','Small volumes for now. Budget is only planned for next financial year, around April.', now()-interval '6 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Suresh Kumar','Kumar Beverages','+91 90000 10009','Referral','Rohan Iyer', now() - interval '1 day','Warm','Existing customer asking about an annual maintenance contract for the capping line.', d,'Send AMC options and schedule a service visit.','Hi Suresh, thanks for asking about maintenance for the capping line. I can share our AMC options (quarterly and half-yearly visits) and arrange an engineer check. Which week suits you?', ARRAY['service inquiry','existing customer'],0.74) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Our capping machine needs servicing. Do you offer annual maintenance contracts?', now()-interval '1 day');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Neeraj Gupta','FreshBake Industries','+91 90000 10010','Website','Kavya Menon', now() - interval '1 day','Hot','Ready to schedule a demo of the flow wrapper with their production head.', d,'Confirm demo date and time with Neeraj and his production head.','Hi Neeraj, great to hear you are ready for a demo. We can run the FW-300 flow wrapper with your bread samples on Thursday or Friday at 11 am. Which works for you and your production head?', ARRAY['demo requested','decision maker involved'],0.9) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','Hi, interested in a flow wrapping machine for bread loaves.', now()-interval '7 days'),
   (l,'outgoing','Hi Neeraj, sharing the FW-300 video and specs.', now()-interval '6 days'),
   (l,'incoming','Looks right for us. Can we schedule a demo? Our production head will join.', now()-interval '1 day');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Pooja Reddy','Reddy Agro Mills','+91 90000 10011','Trade show','Priya Sharma', now() - interval '12 days','Cold','Said they are not interested right now after the trade show.', d + 30,'Respect the decision; no further outreach unless they re-engage.','', ARRAY['not interested'],0.88) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'outgoing','Hi Pooja, great meeting you at the expo. Can I share details on our bagging machines?', now()-interval '14 days'),
   (l,'incoming','Thanks but we are not interested at the moment. Please do not follow up.', now()-interval '12 days');

  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence)
  VALUES ('Karan Malhotra','Urban Kitchen Co','+91 90000 10012','WhatsApp','Arjun Rao', now() - interval '3 days','Warm','Asked general pricing for a tray sealer without volumes or timeline.', d + 1,'Ask for tray size and daily volume to recommend a model.','Hi Karan, to give you accurate pricing on a tray sealer, could you share your tray size and approximate trays per day? I will recommend the best-fit model.', ARRAY['pricing inquiry'],0.62) RETURNING id INTO l;
  INSERT INTO messages (lead_id,direction,body,sent_at) VALUES
   (l,'incoming','What is the price range for tray sealing machines?', now()-interval '3 days'),
   (l,'outgoing','Depends on the model, Karan. I will share a few options.', now()-interval '3 days' + interval '2 hours');

  -- leads with short/no histories
  INSERT INTO leads (name, company, phone, source, rep, last_contact_at, temperature, reason, next_follow_up, recommended_action, draft_message, intent_signals, confidence) VALUES
  ('Meera Pillai','Pillai Pickles','+91 90000 10013','Website','Neha Kapoor', now()-interval '5 days','Warm','Website enquiry about jar capping with no follow-up yet.', d - 3,'Call to understand jar sizes and volume.','Hi Meera, thanks for your enquiry about jar capping. Could you share your jar sizes and daily output so I can suggest the right machine?', ARRAY['inbound enquiry'],0.55),
  ('Arvind Patel','Patel Plastics','+91 90000 10014','Trade show','Rohan Iyer', now()-interval '20 days','Cold','Collected a brochure at the trade show; no engagement since.', d + 14,'Send a short nurture message with a relevant case study.','Hi Arvind, it was good meeting you at the expo. Sharing a short case study on how a plastics maker cut packing time by 30%. Let me know if it is relevant.', ARRAY[]::text[],0.5),
  ('Rekha Iyer','Spice Route Traders','+91 90000 10015','Referral','Kavya Menon', now()-interval '2 days','Hot','Confirmed budget approval for a sachet machine and asked for a final quote.', d - 1,'Send final quote with delivery date today.','Hi Rekha, great news on the budget approval. I am sending the final quote for the sachet machine with delivery and installation dates today.', ARRAY['budget approved','quote requested'],0.88),
  ('Imran Khan','Khan Textiles','+91 90000 10016','Website','Priya Sharma', now()-interval '8 days','Cold','Enquired about strapping machines but is a very small operation and unqualified.', d + 21,'Keep on low-frequency nurture.','Hi Imran, sharing details of our entry-level strapping tool in case it suits your current volumes.', ARRAY[]::text[],0.6),
  ('Divya Nair','Kerala Coir Works','+91 90000 10017','WhatsApp','Arjun Rao', now()-interval '4 days','Warm','Interested in a baling press but still defining requirements.', d + 2,'Ask about bale size and daily throughput.','Hi Divya, to recommend the right baling press, could you share your target bale size and daily throughput?', ARRAY['interest shown'],0.6),
  ('Gaurav Bansal','Bansal Snacks','+91 90000 10018','Trade show','Neha Kapoor', now()-interval '3 days','Warm','Shortlisted us among three suppliers for a multihead weigher.', d + 3,'Offer a reference visit to an existing customer.','Hi Gaurav, since you are shortlisting multihead weighers, would a visit to one of our snack customers running the MW-10 be useful?', ARRAY['shortlisted'],0.66),
  ('Nisha Verma','Verma Chemicals','+91 90000 10019','Referral','Rohan Iyer', now()-interval '1 day','Hot','Urgent question on drum filling machine lead time for a plant opening.', d + 1,'Reply with lead time and propose a call.','Hi Nisha, for your plant opening, the drum filler lead time is about 5 weeks from order. Can we do a quick call tomorrow to align on dates?', ARRAY['urgent','plant opening'],0.8),
  ('Ashok Rao','Rao Rice Mills','+91 90000 10020','Website','Kavya Menon', now()-interval '25 days','Cold','No reply to three follow-ups after initial enquiry.', d + 30,'Move to monthly nurture.','Hi Ashok, checking in once more on rice bagging. If now is not the right time, I will reach out next quarter.', ARRAY['no response'],0.7),
  ('Tanya Chopra','Chopra Confectionery','+91 90000 10021','WhatsApp','Priya Sharma', now()-interval '2 days','Warm','Asked about wrapping machine options for chocolates; timeline unclear.', d + 4,'Share two model options and ask about timeline.','Hi Tanya, here are two wrapping options suited to chocolates. When are you looking to have the machine running?', ARRAY['information request'],0.6),
  ('Ravi Shankar','Shankar Tea Estates','+91 90000 10022','Trade show','Arjun Rao', now()-interval '1 day','Warm','Discussed tea bag packing machine; awaiting internal review.', d + 5,'Follow up after their internal review.','Hi Ravi, hope the internal review of the tea bag packer is going well. Happy to answer any questions from your team.', ARRAY['internal review'],0.6);

  -- a completed follow-up
  UPDATE leads SET follow_up_status='completed', last_sent_at = now() - interval '3 hours' WHERE name='Ravi Shankar';
  INSERT INTO activities (lead_id, type, detail, created_at) SELECT id,'message_sent','Follow-up message marked as sent', now()-interval '3 hours' FROM leads WHERE name='Ravi Shankar';
  INSERT INTO activities (lead_id, type, detail) SELECT id,'seeded','Lead imported from sample data' FROM leads;
END $$;