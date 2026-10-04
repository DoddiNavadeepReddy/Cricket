# Play XI

An IPL-inspired friends league prototype: invite your crew into a private room, bid on players with a purse, assign a player's signature batting style, and take that style into a ball-by-ball match.

## Run it

```bash
npm install
npm run dev -- --host
```

Open the network URL printed by Vite on your phone or laptop. The app runs on port `5180`.

## Connect Supabase for live rooms

1. In Supabase, enable **Authentication → Providers → Anonymous Sign-ins**.
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and add the values from **Project Settings → API Keys**:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

   The browser-safe publishable/anon key is expected. Never put a `service_role` key or database password in `.env.local` or the frontend.
4. Restart Vite. The room status changes from `demo mode` to `live sync` when the connection is active.

## Prototype flow

1. Open **Room 24A8** and use **Invite friends** to copy the room code.
2. Use **Live auction** to select an upcoming player and place bids.
3. Lock a player into **My squad**, then choose a signature move such as *The cover drive* or *The helicopter*.
4. Open **Match day**, choose a move, and play the ball-by-ball scorecard.

Without Supabase configuration, the UI uses local browser state so the auction and match can still be demoed. With the schema and credentials configured, room members, bids, squads, and match score updates use Supabase Realtime.

## Checks

```bash
npm run build
npm run lint -- src
```
