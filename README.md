# Zomora’s Corner

A personal notebook built with React, TypeScript, Vite, and a dedicated Supabase project. Stories and photos are shared across devices. Visitors read published stories; only the designated writer can manage content.

## Run and verify

```sh
npm ci
npm run dev
npm run build
npm test
```

Use Node 22.12+ (or 20.19+). Browser tests use installed Microsoft Edge on Windows; elsewhere install Playwright Chromium with `npx playwright install chromium`. UI tests mock the backend so they never publish test stories to the live site. Database authorization checks are in `supabase/tests/access.sql` and roll back their fixtures.

## Her first visit

Open **Writer login** in the footer, then **First visit? Set up your account**. Enter the private setup code from the local, Git-ignored `writer-setup.txt`, then choose a password. The code expires seven days after it was issued and creates only the pre-authorized writer’s account. No email is sent. Treat this code like a password; never commit it or put it in frontend settings. After activation, use the designated email and chosen password to log in.

The initial account has deliberately not been activated so its owner can choose her own password. Passwords are managed by Supabase Auth, not stored by this application. Signed-in writers can change their password under **A little help & housekeeping**. Email password recovery is not configured; an administrator must handle recovery through Supabase Auth. Do not enable email flows until a suitable SMTP service is configured.

## Writing, photos, and coffee breaks

- **Write a story** opens the editor. Add a title, introduction, body, and category.
- **Add photos** accepts JPG, PNG, or WebP, up to eight per story. Photos are resized to at most 1600 pixels, re-encoded as JPEG, and stripped of original metadata. Add accessible descriptions and optional captions; the first photo is the cover. Export HEIC images as JPG first.
- **Save draft** stores unfinished writing and photos privately online. **Publish story** makes them visible to readers. Published stories can be edited, returned to drafts, or deleted with confirmation.
- A device recovery copy is saved while typing. It is a fallback, not a replacement for saving online. **Recover device draft** restores it after leaving an editor. Clearing browser storage removes this recovery copy, but not online drafts.
- **Download a backup** saves a JSON file with the words and embedded photos. **Load JSON draft** creates a new private draft; the original three-field JSON format is still supported. Imports never overwrite published stories.
- **Edit my corner** updates the site name, tagline, about text, and optional public contact details.
- Search, category filters, individual story pages, and the photo diary update from published content. Existing browser-only stories can be imported from the same browser/address under housekeeping.

Concurrent edits are checked at save time to avoid silently overwriting another device’s changes. Keep JSON backups of important stories. Photo cleanup removes your unreferenced uploads older than 24 hours; save device-only drafts online before using it.

## Backend and privacy

The project is **Zomora-Corner**, reference `moqpjxzkhdmruqxpjvpz`. It is separate from other apps. `src/supabase.ts` contains only the public project URL and publishable key. These are intentionally safe to ship; database and Storage row-level policies enforce access. Optional `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` build variables override the defaults. Never add a service-role key to Vite variables.

Schema migrations are in `supabase/migrations`. The writer allowlist and setup secret are provisioned separately, so personal account details and credentials stay out of source control. The `activate-writer` Edge Function uses its server-only service credentials after checking an expiring 256-bit setup code hash. Its gateway JWT check is disabled because activation happens before a user exists; it authenticates the setup code itself and never resets existing accounts.

Drafts are protected by database policies. The photo bucket is private; visitors can obtain short-lived signed URLs only for photos referenced by published stories. A previously issued URL may keep working for up to ten minutes after unpublishing. Setup records have RLS enabled with no browser policies and all browser grants revoked; the Supabase “RLS Enabled No Policy” informational advisory is intentional for this service-only table.

The original sample stories were copied from `content/posts.json`; she can edit or delete them. The local `story-draft.json` remains private and ignored by Git.

## Hosting

### Cloudflare Pages

The shareable site is `https://zomorascorner.pages.dev`, under the existing Rebeltechoxford Cloudflare account. It uses the free Pages static hosting plan with a Direct Upload deployment. Build with `npm run build`, then upload only the contents of `dist/` to this Pages project. Do not upload the repository, private draft, or writer setup code. No Node runtime or start command is needed. Cloudflare handles SPA deep links automatically when no top-level `404.html` is present. Direct Upload does not automatically deploy GitHub pushes; upload a fresh build for future code changes. Blog edits and photos publish directly through Supabase without rebuilding.

### Daily pause

The hero uses licensed stationary mug footage (see `public/media/CREDITS.md`), subtle depth-animated steam, a static poster, and a pause control. Reduced-motion and data-saving preferences disable autoplay.

The `daily-inspiration` Supabase Edge Function fetches ZenQuotes' daily quote and Bible Gateway's NLT verse-of-the-day feed. It stores only the latest readings, refreshes on the first visit of each Chicago calendar day, and limits failed refresh attempts to once per 15 minutes. Provider outages retain the last successful reading with its date. Attribution links are displayed with the readings. No paid API subscription or scheduled job is required. Verify parsers with `node --test tests/providers.test.mjs`.

### GoDaddy or another Node host

Install `npm ci`, build `npm run build`, start `npm start`. `server.mjs` serves `dist/`, binds to `0.0.0.0`, and reads `PORT` (default 3000). Direct page links fall back to the SPA. Use HTTPS. No private Supabase credentials are needed on the hosting platform.

GoDaddy's development preview may instead run `npm run dev`. Vite also binds to `0.0.0.0` and reads `PORT`, without falling back to another port if it is occupied. The known GoDaddy preview hostname is allowed explicitly; if it changes, add the exact hostname through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`. Local writer setup/draft files are denied by Vite. Production should use `npm start` after building.

### GitHub Pages or another static host

The included `.github/workflows/static.yml` installs dependencies, runs `npm run build:pages`, and deploys only `dist/` on pushes to `main`. This sets the base to `/zomoras-corner/` and uses hash routes, including `/zomoras-corner/#/writer`, so direct links work without a Node server. Select GitHub Actions as the source in repository Settings → Pages. A public repository can use Pages on GitHub Free. Regular static hosts with SPA rewrites can use `npm run build` and `dist/` instead.

The frontend must be deployed for visitors to see these changes; provisioning Supabase does not redeploy the website.

### Free tier

This Supabase project was created at $0 on the Free plan, without an upgrade. The plan has quotas (including 500 MB database and 1 GB file storage) and may pause after a week of inactivity. Check current [Supabase pricing](https://supabase.com/pricing) before changing plans. Photo compression helps conserve space; the app does not purchase capacity automatically. GoDaddy hosting charges are separate.
