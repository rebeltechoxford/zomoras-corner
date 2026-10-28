# Comments and moderation

Text-only comments appear below published stories. Name and comment become public
only after a writer approves them. Emails live in a separate RLS-protected table;
neither anonymous visitors nor unrelated signed-in users can read them. Writers
may change moderation status, not edit a visitor's words.

The writing desk's **comment basket** supports approve, decline, return to review,
and a private Reply by email link. Declining does not automatically email anyone.
An approved comment stops being public when its parent story is unpublished.

## Private pending receipts

The submitting browser keeps up to 20 receipts for 30 days, without email addresses.
An unguessable HMAC capability allows that browser to check its own status. Only
that browser sees pending/declined receipts. Refresh comments checks for decisions.
Clearing browser storage or dismissing a receipt removes this local status display;
it does not withdraw the submitted comment. If storage is blocked, submission
still succeeds and the form explains that a receipt could not be saved.

## Spam protection

This release uses a small arithmetic check, not Cloudflare Turnstile. It is a
lightweight deterrent, not sophisticated bot detection. The server validates a
one-use, IP-bound answer hash with a 10-minute expiry and two-second minimum age.
The UI waits before enabling Send. Failed answers consume the challenge. A
honeypot, strict text/email validation, body byte cap, and atomic database limits
add protection. No HTML, links, photos or attachments are accepted.

Limits: 30 challenges per IP/hour, 1,000 globally/hour; five submissions per
IP/hour, five per email/day, and 100 globally/day. IP and email rate-limit keys
are HMAC hashes, never raw IPs. Expired challenge/limit rows are cleaned on the
next challenge request. CF-Connecting-IP is taken from Supabase's Cloudflare
ingress; missing ingress identity fails closed. No client-supplied forwarded IP
is trusted. A coordinated bot can still exhaust these low-volume limits; upgrade
to managed Turnstile if abuse becomes a problem. Moderation remains mandatory.

## Backend deployment

Dedicated Supabase project: `moqpjxzkhdmruqxpjvpz`.
Apply `supabase/migrations/20261028150913_comment_moderation.sql`, then deploy
`supabase/functions/story-comments/index.ts` with its `validation.mjs` dependency.
Deploy with JWT verification disabled: this function deliberately accepts public
commenters and authenticates writer-only notification retries itself using Auth
and the writer allowlist. Keep all RPCs service-role-only as defined in the migration.
Default Supabase service-role credentials stay inside the Edge runtime.

Allowed browser origins are the .com root/www and her two known Workers addresses.
Local Playwright tests mock this backend and never contact production.

## Moderation email setup

The email path is implemented, but **not enabled in the October 28 deployment**:
the previously saved Brevo SMTP credential failed authentication. No invalid
credential was copied to this project, and no test messages were sent.

To enable it, save a valid SMTP configuration in **this project's Supabase Vault**
under the unique name `zomora_comment_mail`, as JSON with `host`, `user`, `pass`,
and `from` (one verified sender email address). Use the dashboard's secure secret
input, never commit these values. The implementation uses TLS on port 465.
Verify sender/domain authorization with the chosen provider before enabling.
Do not enable a paid plan without the owner's approval.

Notifications go only to Zomora's configured address in the backend, with a
verified sender and the visitor's name/address as **Reply-To**. Visitor addresses
are supplied by visitors and are not verified. The frontend never receives mail
credentials. Replying from Zomora's inbox targets the commenter.

Each comment creates a durable notification record. The Edge Function claims it
before SMTP submission, preventing concurrent duplicate sends. `sent` means the
mail server accepted the message, not confirmed inbox delivery. Authentication
failures remain retryable; ambiguous disconnects after submission remain
`sending` and require inbox/provider review before any manual resend. The basket
shows delivery status and offers Retry email notice for queued, failed, or
unconfigured records. Missing email setup never loses a submitted comment.

## Verification

- `npm run build`
- `npm test` — reader receipt, failed submission, writer decisions, existing site
- `node --test tests/comments-validation.test.mjs tests/providers.test.mjs`
- Run `supabase/tests/comments.sql` through the SQL tool; fixtures roll back.
- Run Supabase security advisors. RLS without policies on challenge/limit tables
  intentionally denies clients; only the service role can access these tables.

Live verification exercised valid submission and simultaneous retries, private
receipt lookup, anonymous email/secret rejection, and writer authorization. The
private integration-test comment was deleted afterward.
