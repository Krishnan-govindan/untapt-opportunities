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

const patches: Record<string, { platform: string; snippet: string; url: string }[]> = {
  "AI contract redlining for solo lawyers": [
    {
      platform: "reddit",
      snippet: "\"I'm a solo attorney and I spend 3+ hours redlining every NDA. ChatGPT helps but I still have to fix every clause manually. Someone needs to build this properly.\"",
      url: "https://www.reddit.com/r/Lawyertalk/search/?q=contract+review+ai+redline&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Solo lawyers are the most underserved market in legal tech. BigLaw gets Ironclad, solos get… ChatGPT and prayer.\"",
      url: "https://x.com/search?q=solo+lawyer+contract+review+AI&f=top",
    },
  ],
  "Sleep tracking with zero wearables": [
    {
      platform: "reddit",
      snippet: "\"I've tried Oura, Whoop, Fitbit. They all either wake me up charging or I rip them off at 3am. There has to be a way to track sleep without wearing something.\"",
      url: "https://www.reddit.com/r/sleep/search/?q=sleep+tracking+without+wearable+device&sort=top&t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Ask HN: Why hasn't anyone shipped a passive sleep tracker using the phone mic? The ML research is there.\"",
      url: "https://hn.algolia.com/?query=sleep+tracking+phone+microphone+passive&sort=byPopularity&dateRange=pastYear",
    },
  ],
  "Automated payroll reconciliation for restaurant groups": [
    {
      platform: "reddit",
      snippet: "\"Running 4 locations. We spend every other Friday manually exporting CSVs from Toast into Gusto. It takes 6 hours and we've been fined twice for OT errors we didn't catch.\"",
      url: "https://www.reddit.com/r/restaurantowners/search/?q=payroll+reconciliation+toast+gusto&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"DOL audits for restaurant tip pools are up 34% in 2024. If you're still doing tip reconciliation in Excel you are playing with fire.\"",
      url: "https://x.com/search?q=restaurant+payroll+tip+pool+reconciliation&f=top",
    },
  ],
  "Personal finance OS for freelancers with irregular income": [
    {
      platform: "reddit",
      snippet: "\"Mint is dead and nothing else handles variable income. YNAB assumes you know how much you earn this month. I have no idea. Big invoice could land or not.\"",
      url: "https://www.reddit.com/r/freelance/search/?q=budgeting+irregular+income+mint+alternative&sort=top&t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Ask HN: What do freelancers use for financial planning after Mint shutdown? All the alternatives assume salaried income.\"",
      url: "https://hn.algolia.com/?query=freelancer+personal+finance+irregular+income&sort=byPopularity&dateRange=pastYear",
    },
    {
      platform: "twitter",
      snippet: "\"The IRS expanding 1099-K reporting to $600 is going to create a tax anxiety crisis for the 42M freelancers who aren't tracking properly.\"",
      url: "https://x.com/search?q=freelancer+finance+1099+taxes+budgeting&f=top",
    },
  ],
  "B2B gifting for remote teams that actually arrives": [
    {
      platform: "reddit",
      snippet: "\"We tried to send holiday gifts to 80 remote employees across 9 countries. 30% of packages got stuck in customs, 12 went to old addresses, and the vendor charged us $40 per gift. Never again.\"",
      url: "https://www.reddit.com/r/humanresources/search/?q=remote+team+gifting+international+problems&sort=top&t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Show HN: We built a remote team gifting platform after our HR team spent 3 days chasing shipping addresses for 60 employees.\"",
      url: "https://hn.algolia.com/?query=remote+team+gifting+corporate+international&sort=byPopularity&dateRange=pastYear",
    },
  ],
  "AI meeting notes that actually update your CRM": [
    {
      platform: "twitter",
      snippet: "\"I pay $1,400/seat/yr for Gong. It transcribes perfectly. I still spend 45 minutes after every call updating Salesforce manually. The transcript is just open in another tab while I type.\"",
      url: "https://x.com/search?q=CRM+update+after+sales+call+manual+salesforce&f=top",
    },
    {
      platform: "hackernews",
      snippet: "\"Why do all the call recording tools stop at the transcript? The real pain is the 45 minutes of CRM cleanup after every demo.\"",
      url: "https://hn.algolia.com/?query=sales+call+CRM+update+automatic+salesforce+hubspot&sort=byPopularity&dateRange=pastYear",
    },
    {
      platform: "reddit",
      snippet: "\"SDR here. My company uses Gong + Salesforce. I transcribe every call, then manually copy next steps, objections, and contact updates into 4 different fields. Gong doesn't do any of this.\"",
      url: "https://www.reddit.com/r/sales/search/?q=CRM+update+automation+after+call+gong&sort=top&t=year",
    },
  ],
  "Medical billing audit tool for independent physician practices": [
    {
      platform: "reddit",
      snippet: "\"We found out our biller had been missing $60k/year in underpaid Medicare claims for 3 years. The insurer paid 40% of fee schedule and nobody noticed. The appeals window had closed.\"",
      url: "https://www.reddit.com/r/medicine/search/?q=medical+billing+underpayment+denied+claims+audit&sort=top&t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Medical billing is a $200B/yr problem hidden inside healthcare. Independent practices leave 15–40% of revenue on the table in underpaid or incorrectly denied claims.\"",
      url: "https://hn.algolia.com/?query=medical+billing+audit+denied+claims+physician&sort=byPopularity&dateRange=pastYear",
    },
  ],
  "Self-storage unit marketplace with real-time availability": [
    {
      platform: "reddit",
      snippet: "\"Called 8 storage facilities this weekend. 5 said they were full or didn't have the size I needed. No website showed real availability. Had to physically drive to 3 of them.\"",
      url: "https://www.reddit.com/r/moving/search/?q=storage+unit+availability+near+me&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"US self-storage occupancy is at 93% nationally. There's no Booking.com for storage. Millions of people are calling facilities one by one to find an open unit.\"",
      url: "https://x.com/search?q=self+storage+availability+marketplace&f=top",
    },
  ],
  "Churn prediction and rescue for bootstrapped SaaS": [
    {
      platform: "hackernews",
      snippet: "\"Ask HN: How do bootstrapped SaaS founders handle churn? I can't afford Gainsight. I'm currently just manually looking at Stripe cancellations on Fridays.\"",
      url: "https://hn.algolia.com/?query=bootstrapped+SaaS+churn+prediction+affordable&sort=byPopularity&dateRange=pastYear",
    },
    {
      platform: "reddit",
      snippet: "\"Lost 8% MRR this month. Had no warning. I check Stripe once a week but by the time I see the cancellation there's nothing I can do. Gainsight wants $60k/yr for a solution.\"",
      url: "https://www.reddit.com/r/SaaS/search/?q=churn+prediction+bootstrapped+early+stage&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Every churn tool is built for companies with a CS team. There's nothing for the $200k ARR founder who's doing all of this alone.\"",
      url: "https://x.com/search?q=SaaS+churn+prediction+bootstrapped+founder&f=top",
    },
  ],
  "AI tutor for community college students who failed algebra": [
    {
      platform: "reddit",
      snippet: "\"Took remedial math twice at community college. The professor had 32 students and zero time for questions. Khan Academy felt designed for people who already sort of get it. I finally dropped out.\"",
      url: "https://www.reddit.com/r/communitycolleges/search/?q=remedial+math+algebra+struggling+tutor&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"Remedial math is the single biggest dropout trigger in community college. 2.1M students retake it every year. The 60% fail rate hasn't moved in 20 years. AI tutoring could actually fix this.\"",
      url: "https://x.com/search?q=community+college+remedial+math+AI+tutor&f=top",
    },
  ],
  "Permit expediting SaaS for residential solar installers": [
    {
      platform: "reddit",
      snippet: "\"We're a 12-person solar company in California. Permitting is our #1 bottleneck. We have 80 jobs waiting on permits across 25 different jurisdictions. One person manages all of it in a spreadsheet.\"",
      url: "https://www.reddit.com/r/solar/search/?q=permit+delays+residential+installer+AHJ&sort=top&t=year",
    },
    {
      platform: "hackernews",
      snippet: "\"Solar permitting takes 6–14 weeks in most US jurisdictions. IRA created a 47% surge in demand. The bottleneck is now entirely in AHJ processing, not installation capacity.\"",
      url: "https://hn.algolia.com/?query=solar+permit+expediting+AHJ+automation&sort=byPopularity&dateRange=pastYear",
    },
  ],
  "Fitness app for people who hate fitness apps": [
    {
      platform: "reddit",
      snippet: "\"Every fitness app I've tried feels designed for people who already love working out. The onboarding is all 'What are your goals?' and '5am discipline.' I just want to not feel terrible when I climb stairs.\"",
      url: "https://www.reddit.com/r/loseit/search/?q=fitness+app+for+beginners+hate+gym&sort=top&t=year",
    },
    {
      platform: "twitter",
      snippet: "\"5M+ people are on GLP-1 drugs losing weight but have no muscle baseline and are terrified of gyms. Every fitness app is built for athletes. Nobody is building for this new cohort.\"",
      url: "https://x.com/search?q=fitness+app+beginners+ozempic+GLP1+exercise&f=top",
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
