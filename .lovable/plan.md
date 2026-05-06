## Untapt — Build Plan

A premium dark-mode app surfacing unmonetized startup opportunities, with simulated AI chat and prototype-builder flows.

### Stack & setup
- Enable Lovable Cloud (database + auth + email magic link)
- Add Inter + JetBrains Mono fonts
- Dark-by-default theme with near-black `#0a0a0a` bg, electric violet `#7c3aed` accent
- Design tokens in `src/styles.css` (semantic), card glow + animated gradient border utilities

### Database (Lovable Cloud)
- `opportunities` — id, title, pain_summary, sources (text[]), tam_estimate, urgency_score, icp, pain_description, competitors (jsonb), why_now, mvp_features (text[]), is_hot, created_at
- `chats` — id, opportunity_id, user_id, role, content, created_at
- `prototypes` — id, user_id, opportunity_id, name, thumbnail_url, deployed_url, status, email, created_at
- RLS: opportunities public read; chats & prototypes scoped to `auth.uid()`
- Seed ~30 realistic mock opportunities (varied sources, TAM, urgency; top 3 flagged hot)

### Auth
- Magic-link email sign-in (Lovable Cloud email)
- `/built` requires auth; redirect to `/auth` if signed out
- Build-prototype flow requires auth (modal prompts sign-in if needed)

### Pages

**`/` Home**
- Hero: tagline + live counter (JetBrains Mono, tick animation on increment, +1 every 3s via interval; also subscribed to realtime `opportunities` inserts)
- Infinite-scroll grid of `OpportunityCard`s (intersection observer, paginated)
- Card: title, pain summary, source badge pills (Reddit/X/HN/Product Hunt with brand-tinted bg), TAM, urgency 1–10 meter, View button
- Top 3 hot cards: animated gradient violet border
- Hover: subtle violet glow shadow
- Skeleton loaders pulse violet

**`/opportunity/$id`**
- Two-column layout (stack on mobile)
- Left: ICP, pain description, competitors (name + pricing), market size, "Why now", MVP feature list
- Right: sticky chatbot panel (messages, typing indicator, simulated streaming canned responses)
- CTA: "Build this prototype" → modal: email field (prefilled if signed in), Generate button
- Modal progress: "Researching… → Designing… → Deploying…" (simulated 6–8s), then shows fake `https://untapt-xxx.vercel.app` URL + "Sent to your email" + confetti
- Inserts row into `prototypes` with status transitions

**`/built` Dashboard**
- Auth-gated grid of user's prototypes: thumbnail, name, deployed URL, created date

**`/auth`**
- Magic-link sign-in form

### Simulated AI
- `chats`: client-side simulated streaming (token-by-token reveal of canned contextual responses). Persist messages to `chats` table.
- `prototypes`: client-side state machine with timed status transitions; final URL is a placeholder. No real `/api/*` server routes needed since simulation is client-side per the answer "Both fully simulated".

### Realtime
- Subscribe to `opportunities` inserts → prepend new card with fade-in + bump counter

### Components
- `Header` (logo, nav, auth state)
- `LiveCounter`, `OpportunityCard`, `SourceBadge`, `UrgencyMeter`
- `ChatPanel`, `BuildPrototypeModal`, `ConfettiBurst`
- `Skeleton` variants

### Errors & empty states
- Sonner toasts at top for errors (non-blocking)
- Pulsing violet skeletons for loading
- Empty dashboard: quiet illustration-free copy + CTA to browse

### Out of scope (per answers)
- Real scraping, real AI, real Vercel deploys
