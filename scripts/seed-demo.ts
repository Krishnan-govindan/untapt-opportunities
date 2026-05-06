#!/usr/bin/env node
/**
 * seed-demo.ts  —  Insert compelling mock opportunities for demo
 * Usage: node --experimental-strip-types scripts/seed-demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const opportunities = [
  {
    title: "AI contract redlining for solo lawyers",
    pain_summary:
      "Solo attorneys spend 4–6 hours manually redlining every contract, losing $800–1,200 in billable hours per deal",
    pain_description:
      "Solo and small-firm lawyers handle 10–30 contracts a week but can't afford the $3k/mo enterprise CLM tools used by BigLaw. They paste contracts into ChatGPT hoping for help, get hallucinated clauses, and still spend half a day fixing the output. The cognitive load of context-switching between drafting, redlining, and client calls is burning out an entire generation of attorneys who went solo to have freedom — not more busywork.",
    sources: ["reddit", "twitter"],
    tam_estimate: "$8.4B",
    urgency_score: 9,
    icp: "Solo attorneys and 2–5 person law firms billing $300–600/hr, handling M&A, RE, or SaaS vendor contracts",
    why_now:
      "GPT-4o can reliably extract risk clauses with low hallucination when given structured prompts. The ABA's 2024 ethics opinion cleared AI-assisted drafting. Solo lawyer population grew 18% post-pandemic.",
    competitors: [
      { name: "Ironclad", pricing: "$2,000/mo" },
      { name: "Lexion", pricing: "$1,500/mo" },
      { name: "Spellbook", pricing: "$99/mo (limited)" },
    ],
    mvp_features: [
      "Upload any PDF/DOCX contract",
      "One-click risk clause extraction with plain-English explanations",
      "Redline suggestions tracked as Word comments",
      "Playbook builder: save firm-standard positions",
      "Opposing counsel risk score (aggressive / standard / friendly)",
    ],
    is_hot: true,
  },
  {
    title: "Sleep tracking with zero wearables",
    pain_summary:
      "85% of people who want sleep data refuse to wear a device to bed, leaving a $2B market completely unserved",
    pain_description:
      "Fitbits and Apple Watches slip off, get sweaty, need charging overnight, and cost $200+. Bed sensors like Withings cost $300 and require under-mattress hardware. People who genuinely want to improve their sleep — new parents, shift workers, anxiety sufferers — give up within 2 weeks because the friction of the device itself disrupts the very sleep they're trying to track. Nobody has cracked passive, zero-hardware sleep monitoring at scale.",
    sources: ["reddit", "hackernews"],
    tam_estimate: "$2.1B",
    urgency_score: 7,
    icp: "Adults 25–45 with sleep anxiety, new parents, and shift workers who own smartphones but have abandoned wearables",
    why_now:
      "iOS 18 added background microphone processing for health use cases. Acoustic sleep staging via phone mic is now >85% accurate vs polysomnography benchmarks published in Nature 2024.",
    competitors: [
      { name: "Oura Ring", pricing: "$299 + $6/mo" },
      { name: "Withings Sleep", pricing: "$99 one-time" },
      { name: "Sleep Cycle (app)", pricing: "$30/yr" },
    ],
    mvp_features: [
      "Passive sleep detection via phone microphone (no input needed)",
      "Morning sleep quality score with breath rate + movement estimate",
      "Weekly trend dashboard with actionable suggestions",
      "Alarm that wakes within a light sleep window",
      "Snoring detection and audio clip review",
    ],
    is_hot: true,
  },
  {
    title: "Automated payroll reconciliation for restaurant groups",
    pain_summary:
      "Multi-location restaurant operators spend 20+ hours weekly reconciling tip pools, overtime, and POS data across systems that don't talk to each other",
    pain_description:
      "A 5-location restaurant group runs Toast for POS, Gusto for payroll, and Homebase for scheduling — none of which integrate cleanly. Every pay period, the GM or owner manually exports CSVs, pastes them into Excel, and tries to reconcile tip pools, California overtime rules, minors' hour limits, and last-minute schedule swaps. Mistakes mean DOL complaints and $25k+ fines. The pain is universal across any operator with 3+ locations.",
    sources: ["reddit", "twitter"],
    tam_estimate: "$1.8B",
    urgency_score: 8,
    icp: "Restaurant group operators running 3–20 locations with 50–500 hourly employees, $5M–$50M annual revenue",
    why_now:
      "DOL increased audit frequency 34% in 2024. Toast and Square both opened webhook APIs in Q1 2025. California's FAST Act compliance deadlines are driving panic hiring of payroll consultants.",
    competitors: [
      { name: "Restaurant365", pricing: "$435/mo/location" },
      { name: "Harri", pricing: "$200/mo/location" },
      { name: "Manual Excel", pricing: "$0 but 20 hrs/week" },
    ],
    mvp_features: [
      "Native connectors to Toast, Square, Gusto, ADP",
      "Automatic tip pool calculation by role and hours worked",
      "Overtime pre-alert: flags employees approaching thresholds mid-week",
      "One-click payroll export ready for processor",
      "Audit trail with change logs for DOL compliance",
    ],
    is_hot: false,
  },
  {
    title: "Personal finance OS for freelancers with irregular income",
    pain_summary:
      "42 million US freelancers have no budgeting tool that handles variable income — they either under-save for taxes or blow budgets when a big check hits",
    pain_description:
      "Mint was built for salaried workers. YNAB is philosophically sound but requires 45 minutes/week of manual entry that creative freelancers abandon in month 2. When a $15k invoice lands, a freelancer doesn't know whether to celebrate, set aside 35% for taxes, pay off the credit card, or invest. The cognitive load of managing money with no predictable paycheck is a genuine anxiety driver, and the existing tools offer zero behavioral guidance for the reality of feast-or-famine income.",
    sources: ["reddit", "twitter", "hackernews"],
    tam_estimate: "$3.2B",
    urgency_score: 8,
    icp: "US-based freelancers earning $60k–$200k/yr across creative, tech, consulting, and trades verticals — particularly 1099-heavy income",
    why_now:
      "Intuit shut down Mint in Jan 2024, displacing 3.6M users with no comparable alternative. The IRS is expanding 1099-K reporting to $600 in 2025, putting tax anxiety at an all-time high.",
    competitors: [
      { name: "YNAB", pricing: "$109/yr" },
      { name: "Quickbooks Self-Employed", pricing: "$180/yr" },
      { name: "Copilot", pricing: "$95/yr" },
    ],
    mvp_features: [
      "Variable income smoothing: auto-allocates each payment across taxes, runway buffer, and spend",
      "Quarterly tax estimator that updates in real time as invoices land",
      "\"Safe to spend\" number shown daily — no categories, no budgets",
      "Invoice importer from FreshBooks, HoneyBook, Bonsai",
      "Feast/famine early warning: alerts when runway drops below 60 days",
    ],
    is_hot: true,
  },
  {
    title: "B2B gifting for remote teams that actually arrives",
    pain_summary:
      "Corporate gifting for distributed teams is a logistical nightmare — wrong addresses, customs delays, and generic gifts that get thrown away cost $4B in waste annually",
    pain_description:
      "HR managers trying to send onboarding swag, quarterly appreciation gifts, or holiday packages to 50+ remote employees across 12 countries deal with: shipping costs that exceed the gift value, customs holds that destroy surprise timing, employees who moved and never updated their address, and gift baskets that cultural context makes inappropriate. The $16B corporate gifting market is dominated by players (Snappy, Sendoso) that cost $10k+/year minimums, leaving SMBs completely unserved.",
    sources: ["reddit", "hackernews"],
    tam_estimate: "$4.3B",
    urgency_score: 6,
    icp: "HR managers and people ops teams at remote-first companies with 25–500 employees, $5M–$100M revenue, in US/Canada/EU",
    why_now:
      "Remote work stabilized at 28% of all knowledge workers (BLS 2024). Slack marketplace opened gifting integrations in Q4 2024. Post-layoff culture anxiety is driving record spending on employee appreciation.",
    competitors: [
      { name: "Sendoso", pricing: "$10,000/yr minimum" },
      { name: "Snappy", pricing: "$5,000/yr minimum" },
      { name: "Amazon Business", pricing: "Free but manual" },
    ],
    mvp_features: [
      "Address collection via magic link — no HR data entry",
      "Choice-based gifting: recipient picks from curated options in their country",
      "Slack bot: send a gift in 3 clicks from any channel",
      "Customs-safe international catalog (no restricted items by region)",
      "Budget tracking and approval flows for managers",
    ],
    is_hot: false,
  },
  {
    title: "AI meeting notes that actually update your CRM",
    pain_summary:
      "Sales reps spend 45 minutes after every call manually updating Salesforce — killing 2 hours a day of selling time across 3.2M US sales professionals",
    pain_description:
      "Gong, Otter, and Fireflies all transcribe calls. None of them actually write the CRM update. Reps still have to open Salesforce, find the record, decode the transcript, decide what changed, and type it in — usually 3 hours after the call when context is cold. Deal stages don't update. Next steps don't get logged. Managers lose visibility. And the $4k/seat Salesforce license becomes a $4k parking lot for bad data that ruins forecasting.",
    sources: ["twitter", "hackernews", "reddit"],
    tam_estimate: "$6.7B",
    urgency_score: 9,
    icp: "B2B SaaS AEs and SDRs at companies with 20–500 employees using Salesforce or HubSpot, running 5–15 discovery calls per week",
    why_now:
      "Salesforce's Einstein Copilot opened its API to third parties in March 2025. HubSpot's AI assistant is invite-only but confirmed for GA in Q3. The window for an independent layer is 12–18 months before they lock the ecosystem.",
    competitors: [
      { name: "Gong", pricing: "$1,400/seat/yr" },
      { name: "Chorus by ZoomInfo", pricing: "$800/seat/yr" },
      { name: "Fireflies.ai", pricing: "$228/seat/yr — no CRM write" },
    ],
    mvp_features: [
      "Auto-joins Zoom/Meet/Teams and records with permission",
      "Post-call: drafts CRM field updates (stage, next steps, contact info changes)",
      "One-click approve-and-push to Salesforce or HubSpot",
      "Email follow-up draft ready to send in 30 seconds",
      "Manager dashboard: pipeline health based on actual call sentiment",
    ],
    is_hot: true,
  },
  {
    title: "Medical billing audit tool for independent physician practices",
    pain_summary:
      "Independent physicians lose $50k–$200k/year in underpaid or denied claims they never appeal because billing staff lack time and expertise",
    pain_description:
      "A 3-physician internal medicine practice bills 400–600 claims per month. Their biller is overwhelmed, working from a 10-year-old PM system, and manually reviews maybe 20% of ERA remittances. Insurers routinely underpay — sometimes intentionally — and the appeals window closes in 60–180 days. Nobody's watching the clock. The practice owner finds out 6 months later that they left $80k on the table. Medical billing audit companies charge $300–500/hr for this work. AI can do it for pennies per claim.",
    sources: ["reddit", "hackernews"],
    tam_estimate: "$5.1B",
    urgency_score: 8,
    icp: "Independent physician practices with 1–10 providers billing Medicare/Medicaid and commercial payers, using athenahealth, eClinicalWorks, or DrChrono",
    why_now:
      "CMS's No Surprises Act (2024 enforcement ramp) created new audit triggers. athenahealth opened partner API access in Q1 2025. Private equity consolidation of billing companies left independent practices without affordable audit options.",
    competitors: [
      { name: "Waystar", pricing: "$500/mo + % of recovered" },
      { name: "Change Healthcare", pricing: "Enterprise only" },
      { name: "Manual billing audit firms", pricing: "$300–500/hr" },
    ],
    mvp_features: [
      "ERA import from any clearinghouse (835 file format)",
      "Automated underpayment detection vs. fee schedule benchmarks",
      "Appeal letter generator with payer-specific language",
      "Appeals deadline tracker with 30/60-day warnings",
      "Monthly recovered revenue report for practice owner",
    ],
    is_hot: false,
  },
  {
    title: "Self-storage unit marketplace with real-time availability",
    pain_summary:
      "People searching for storage spend 3–5 hours calling facilities because no single platform shows live unit availability — 40% of calls end in 'sorry, we're full'",
    pain_description:
      "The self-storage industry is an $44B market where the top 10 operators (Public Storage, Extra Space, etc.) have their own apps, but the 30,000 independent and regional operators — who control 65% of units — have no API, no real-time inventory, and no online booking. Customers moving homes or businesses are searching under time pressure, calling 6–8 facilities, often being told the unit they want isn't available. The decision process is miserable.",
    sources: ["reddit", "twitter"],
    tam_estimate: "$2.6B",
    urgency_score: 6,
    icp: "Adults 28–50 within 30 days of a move, and small businesses needing overflow storage, searching in suburban/mid-size markets underserved by REITs",
    why_now:
      "SiteLink and Storedge (the two dominant storage management software providers) opened marketplace APIs in 2024. US storage occupancy hit 93% nationally — operators need demand-gen tools.",
    competitors: [
      { name: "SpareFoot", pricing: "Lead fee model" },
      { name: "StorageCafe", pricing: "Listing fees" },
      { name: "Direct facility websites", pricing: "No aggregation" },
    ],
    mvp_features: [
      "Live unit availability via SiteLink/Storedge API",
      "Map search with unit size filters and move-in date",
      "Instant booking with e-signature and ACH/card",
      "Price comparison across 3-mile radius",
      "Moving truck rental upsell integration",
    ],
    is_hot: false,
  },
  {
    title: "Churn prediction and rescue for bootstrapped SaaS",
    pain_summary:
      "Bootstrapped SaaS founders lose 3–8% of MRR monthly to churn they never see coming because enterprise-grade churn tools cost more than their entire ARR",
    pain_description:
      "Gainsight costs $60k/year. ChurnZero starts at $25k. The entire customer success software category was built for $20M+ ARR companies. A $200k ARR bootstrapped SaaS founder runs their entire retention strategy in a Notion doc and a Friday morning Stripe export. They don't know which customers are about to leave until the cancellation email arrives. By then it's too late for a save attempt.",
    sources: ["hackernews", "reddit", "twitter"],
    tam_estimate: "$1.4B",
    urgency_score: 8,
    icp: "Bootstrapped or early-stage SaaS founders at $50k–$500k ARR, typically solo or 2-person teams using Stripe, built on Rails or Next.js",
    why_now:
      "Stripe's new Sigma API (Q1 2025) gives programmatic access to cohort-level retention data. The collapse of VC funding has pushed 40k+ SaaS founders into bootstrapped mode where every churned dollar is irreplaceable.",
    competitors: [
      { name: "Gainsight", pricing: "$60,000/yr" },
      { name: "ChurnZero", pricing: "$25,000/yr" },
      { name: "Baremetrics", pricing: "$588/yr (metrics only)" },
    ],
    mvp_features: [
      "Stripe connect: 30-second setup, no code",
      "Churn risk score per customer based on usage drop, billing failures, support volume",
      "Weekly \"at risk\" digest email with one-click outreach templates",
      "Win-back sequences: automated emails triggered by payment failure or cancellation",
      "Cohort retention chart by acquisition channel",
    ],
    is_hot: true,
  },
  {
    title: "AI tutor for community college students who failed algebra",
    pain_summary:
      "2.1M community college students retake remedial math every year at $1,200/course with a 60% fail rate — the single biggest dropout trigger in higher education",
    pain_description:
      "Remedial math is the graveyard of community college ambitions. Students who failed high school algebra take a $1,200 non-credit course that doesn't count toward their degree, taught by adjuncts who have 30 students and zero time for 1:1 help. Khan Academy is free but requires extreme self-discipline. Existing AI tutors (Khanmigo, Wolfram) speak to the math-literate. Nobody has built a shame-free, mobile-first tutor for adults who believe they're just \"bad at math\" and need to unlearn that story.",
    sources: ["reddit", "twitter"],
    tam_estimate: "$900M",
    urgency_score: 7,
    icp: "Community college students 18–35, working adults returning to school, first-generation college students in urban/suburban areas",
    why_now:
      "Department of Education's 2024 FAFSA simplification drove a 12% surge in community college enrollment. ChatGPT's education API gives Socratic tutoring at $0.002/interaction — making a freemium model finally viable.",
    competitors: [
      { name: "Khanmigo", pricing: "$44/yr (for K-12)" },
      { name: "Mathway", pricing: "$40/yr (answer-only)" },
      { name: "Chegg", pricing: "$180/yr (homework help)" },
    ],
    mvp_features: [
      "Shame-free diagnostic: discovers exactly which concept broke (fractions? negatives? word problems?)",
      "Micro-lessons: 3-minute video + practice, broken down further than any textbook",
      "Socratic AI chat: never gives the answer, always asks the right next question",
      "Progress streaks calibrated for working adults (5 min/day is a win)",
      "FERPA-compliant instructor dashboard for faculty who opt in",
    ],
    is_hot: false,
  },
  {
    title: "Permit expediting SaaS for residential solar installers",
    pain_summary:
      "Solar installers wait 6–14 weeks for permits across 3,000 US jurisdictions, costing the industry $2B/year in stalled jobs and warehouse capital sitting on rooftops",
    pain_description:
      "A solar installer in California operates across 30+ counties and cities, each with different permit formats, AHJ requirements, structural calculation standards, and online portals. The permitting coordinator is a single person drowning in PDFs, following up on emails that go unread for weeks, and manually tracking status across spreadsheets. Installers lose 15–20% of their backlog to permit delays that cause homeowners to cancel. The industry is booming but operationally constrained by pre-1990s government processes.",
    sources: ["reddit", "hackernews"],
    tam_estimate: "$3.4B",
    urgency_score: 9,
    icp: "Residential solar installers doing 10–500 installations/month, operating across 5+ jurisdictions, with dedicated operations or permitting staff",
    why_now:
      "IRA solar tax credits extended through 2032 drove a 47% YoY surge in residential installs. SolarApp+ (NREL) launched an API for instant permit approval in 600+ jurisdictions in 2024 — nobody has built a multi-AHJ orchestration layer on top.",
    competitors: [
      { name: "SolarApp+ (NREL)", pricing: "Free but single AHJ" },
      { name: "PermitFlow", pricing: "$500/mo (construction)" },
      { name: "Manual process", pricing: "$15k/yr in staff time" },
    ],
    mvp_features: [
      "AHJ database: requirements, forms, fees, contacts for 3,000 US jurisdictions",
      "Auto-fill permit applications from project data (address, system specs)",
      "SolarApp+ API integration for instant e-permits where available",
      "Status tracking with automated follow-up emails to AHJs",
      "Structural calculation generator for plan sets (PE-stamped for supported states)",
    ],
    is_hot: true,
  },
  {
    title: "Fitness app for people who hate fitness apps",
    pain_summary:
      "73% of gym members who download fitness apps abandon them within 30 days — the apps are built for people who already love working out, not the other 80% who need to start",
    pain_description:
      "Every fitness app looks the same: aggressive streak counters, shirtless macro-optimizers, motivational quotes about 5am discipline. For the person who just got a scary cholesterol reading, or the 38-year-old who hasn't exercised in 3 years, or the new mom trying to find 20 minutes — these apps feel designed to shame. The onboarding asks for \"fitness goals\" before the user even knows if they'll make it to next week. The category is oversaturated for the converted and completely empty for the reluctant.",
    sources: ["reddit", "twitter"],
    tam_estimate: "$5.6B",
    urgency_score: 7,
    icp: "Adults 30–55 with a health trigger (doctor visit, family event, partner pressure) who have failed at fitness apps before and describe themselves as \"not athletic\"",
    why_now:
      "GLP-1 drugs (Ozempic, Wegovy) created 5M+ new exercisers who are losing weight but have no muscle baseline and are terrified of gyms. They need guided movement, not performance tracking.",
    competitors: [
      { name: "Peloton", pricing: "$44/mo" },
      { name: "Nike Training Club", pricing: "Free (overwhelming)" },
      { name: "Couch to 5K", pricing: "$10 one-time (running only)" },
    ],
    mvp_features: [
      "Zero-shame onboarding: \"What do you want to stop feeling?\" not \"What are your goals?\"",
      "5-minute wins: workouts that fit in a lunch break or commercial break",
      "Anti-streak: missing a day earns a \"Rest is training\" badge instead of a broken chain",
      "Body-neutral language: no weight, no calories, no before/afters",
      "GLP-1 track: muscle preservation workouts designed for users on weight loss medication",
    ],
    is_hot: false,
  },
];

async function main() {
  console.log(`Inserting ${opportunities.length} mock opportunities…`);

  const { data, error } = await supabase
    .from("opportunities")
    .insert(opportunities)
    .select("id, title");

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${data?.length} opportunities:`);
  data?.forEach((o) => console.log(`  · ${o.id.slice(0, 8)}  ${o.title}`));
}

main();
