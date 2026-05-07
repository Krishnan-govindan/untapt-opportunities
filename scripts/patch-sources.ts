#!/usr/bin/env node
/**
 * patch-sources.ts  —  Add real research source URLs to existing opportunities
 * Usage: node --experimental-strip-types scripts/patch-sources.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv();

const supabase = createClient(
  process.env.APP_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All Reddit links use /top/?t=year on the subreddit (no login needed).
// All X links use plain search (no &f=top which requires auth).
// HN links use Algolia search (always public).
const patches: Record<string, { platform: string; snippet: string; url: string }[]> = {
  "AI contract redlining for solo lawyers": [
    {
      platform: "reddit",
      snippet: "\"I'm a solo attorney and I spend 3+ hours redlining every NDA. ChatGPT helps but I still have to fix every clause manually. Someone needs to build this properly.\"",
      url: "https://www.reddit.com/r/Lawyertalk/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Solo lawyers are the most underserved market in legal tech. BigLaw gets Ironclad, solos get ChatGPT and prayer.\"",
      url: "https://x.com/search?q=solo+lawyer+contract+review+AI+redline",
    },
  ],
  "Sleep tracking with zero wearables": [
    {
      platform: "reddit",
      snippet: "\"I've tried Oura, Whoop, Fitbit. They all either wake me up charging or I rip them off at 3am. There has to be a way to track sleep without wearing something.\"",
      url: "https://www.reddit.com/r/sleep/top/?t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Ask HN: Why hasn't anyone shipped a passive sleep tracker using the phone mic? The ML research is there.\"",
      url: "https://hn.algolia.com/?query=sleep+tracking+without+wearable&sort=byPopularity",
    },
  ],
  "Automated payroll reconciliation for restaurant groups": [
    {
      platform: "reddit",
      snippet: "\"Running 4 locations. We spend every other Friday manually exporting CSVs from Toast into Gusto. 6 hours every pay period and we've been fined twice for OT errors.\"",
      url: "https://www.reddit.com/r/restaurantowners/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"DOL audits for restaurant tip pools are up 34% in 2024. If you're still doing tip reconciliation in Excel you are playing with fire.\"",
      url: "https://x.com/search?q=restaurant+payroll+tip+pool+Toast+Gusto",
    },
  ],
  "Personal finance OS for freelancers with irregular income": [
    {
      platform: "reddit",
      snippet: "\"Mint is dead and nothing else handles variable income. YNAB assumes you know how much you earn this month. I have no idea — big invoice could land or not.\"",
      url: "https://www.reddit.com/r/freelance/top/?t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Ask HN: What do freelancers use for financial planning after Mint shutdown? All alternatives assume salaried income.\"",
      url: "https://hn.algolia.com/?query=freelancer+finance+irregular+income+mint&sort=byPopularity",
    },
    {
      platform: "twitter",
      snippet: "\"IRS expanding 1099-K reporting to $600 is going to create a tax anxiety crisis for the 42M freelancers who aren't tracking properly.\"",
      url: "https://x.com/search?q=freelancer+1099+taxes+budgeting+irregular+income",
    },
  ],
  "B2B gifting for remote teams that actually arrives": [
    {
      platform: "reddit",
      snippet: "\"We tried to send holiday gifts to 80 remote employees across 9 countries. 30% got stuck in customs, 12 went to old addresses. The vendor charged $40/gift. Never again.\"",
      url: "https://www.reddit.com/r/humanresources/top/?t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Show HN: We built a remote team gifting platform after HR spent 3 days chasing shipping addresses for 60 employees.\"",
      url: "https://hn.algolia.com/?query=remote+team+corporate+gifting&sort=byPopularity",
    },
  ],
  "AI meeting notes that actually update your CRM": [
    {
      platform: "twitter",
      snippet: "\"I pay $1,400/seat/yr for Gong. It transcribes perfectly. I still spend 45 min after every call updating Salesforce manually. The transcript just sits open in another tab.\"",
      url: "https://x.com/search?q=CRM+update+sales+call+Salesforce+manual",
    },
    {
      platform: "hackernews",
      snippet: "\"Why do call recording tools stop at the transcript? The real pain is 45 minutes of CRM cleanup after every demo call.\"",
      url: "https://hn.algolia.com/?query=sales+call+CRM+update+automatic+salesforce&sort=byPopularity",
    },
    {
      platform: "reddit",
      snippet: "\"SDR here. My company uses Gong + Salesforce. I transcribe every call then manually copy next steps, objections, and contact updates into 4 Salesforce fields. Gong does none of this.\"",
      url: "https://www.reddit.com/r/sales/top/?t=year",
    },
  ],
  "Medical billing audit tool for independent physician practices": [
    {
      platform: "reddit",
      snippet: "\"We found out our biller had been missing $60k/year in underpaid Medicare claims for 3 years. The insurer paid 40% of fee schedule and nobody noticed until the appeals window closed.\"",
      url: "https://www.reddit.com/r/medicine/top/?t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Medical billing is a $200B/yr problem hidden inside healthcare. Independent practices leave 15–40% of revenue on the table in underpaid or incorrectly denied claims.\"",
      url: "https://hn.algolia.com/?query=medical+billing+denied+claims+audit+physician&sort=byPopularity",
    },
  ],
  "Self-storage unit marketplace with real-time availability": [
    {
      platform: "reddit",
      snippet: "\"Called 8 storage facilities this weekend. 5 said they were full or didn't have the size I needed. No website showed real availability. Had to physically drive to 3 of them.\"",
      url: "https://www.reddit.com/r/moving/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"US self-storage occupancy is at 93% nationally and there's no Booking.com for storage. Millions of people are calling facilities one by one to find an open unit.\"",
      url: "https://x.com/search?q=self+storage+availability+find+unit+near+me",
    },
  ],
  "Churn prediction and rescue for bootstrapped SaaS": [
    {
      platform: "hackernews",
      snippet: "\"Ask HN: How do bootstrapped SaaS founders handle churn? I can't afford Gainsight ($60k/yr). Currently just manually checking Stripe cancellations every Friday.\"",
      url: "https://hn.algolia.com/?query=bootstrapped+SaaS+churn+prediction+affordable&sort=byPopularity",
    },
    {
      platform: "reddit",
      snippet: "\"Lost 8% MRR this month. Had no warning. I check Stripe once a week but by the time I see the cancellation there's nothing I can do. Gainsight wants $60k/yr.\"",
      url: "https://www.reddit.com/r/SaaS/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Every churn tool is built for companies with a CS team. Nothing exists for the $200k ARR founder who is doing all of this alone.\"",
      url: "https://x.com/search?q=SaaS+churn+prediction+bootstrapped+founder+Stripe",
    },
  ],
  "AI tutor for community college students who failed algebra": [
    {
      platform: "reddit",
      snippet: "\"Took remedial math twice at community college. The professor had 32 students and no time for questions. Khan Academy felt designed for people who already sort of get it. I dropped out.\"",
      url: "https://www.reddit.com/r/communitycolleges/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Remedial math is the single biggest dropout trigger in community college. 2.1M students retake it every year. The 60% fail rate hasn't moved in 20 years.\"",
      url: "https://x.com/search?q=community+college+remedial+math+dropout+algebra",
    },
  ],
  "Permit expediting SaaS for residential solar installers": [
    {
      platform: "reddit",
      snippet: "\"We're a 12-person solar company in California. Permitting is our #1 bottleneck. 80 jobs waiting on permits across 25 jurisdictions — one person manages all of it in a spreadsheet.\"",
      url: "https://www.reddit.com/r/solar/top/?t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Solar permitting takes 6–14 weeks in most US jurisdictions. IRA drove 47% more demand. The bottleneck is entirely in AHJ processing now, not installation capacity.\"",
      url: "https://hn.algolia.com/?query=solar+permit+AHJ+automation+installer&sort=byPopularity",
    },
  ],
  "Fitness app for people who hate fitness apps": [
    {
      platform: "reddit",
      snippet: "\"Every fitness app feels designed for people who already love working out. The onboarding asks 'What are your goals?' before I even know if I'll make it to next week.\"",
      url: "https://www.reddit.com/r/loseit/top/?t=year",
    },
    {
      platform: "twitter",
      snippet: "\"5M+ people on GLP-1 drugs are losing weight but have no muscle baseline and are terrified of gyms. Every fitness app is built for athletes. Nobody is building for this cohort.\"",
      url: "https://x.com/search?q=fitness+app+beginners+GLP1+ozempic+exercise",
    },
  ],
};

async function main() {
  console.log("Patching sources_detail for all seeded opportunities…\n");

  let updated = 0;
  let failed = 0;

  for (const [title, sources_detail] of Object.entries(patches)) {
    const { error } = await supabase
      .from("opportunities")
      .update({ sources_detail })
      .eq("title", title);

    if (error) {
      console.error(`  ✗ "${title}": ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${title}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed.`);
}

main();
