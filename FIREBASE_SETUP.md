# DanaTrack — Firebase Security Setup

This document describes the **remaining external setup** to close the current
data-exposure gap. Until you complete it, the app keeps working exactly as
before (client-side PIN, full state loaded for everyone). Nothing here has been
enforced automatically, on purpose, so you cannot be locked out of production.

## What is and isn't a secret

- The Firebase config in `index.html` (`apiKey`, `projectId`, …) is **public by
  design**. It is not a secret and does not need hiding. Security comes from the
  Firestore **rules**, not from hiding the key.
- The real secrets today are: the **hardcoded PIN `110869`** and the fact that
  the **entire private financial state** (ledger, investor names/amounts,
  balances) is served to any anonymous visitor. The steps below fix both.

## Current state of the code

- `firestore.rules` — written and checked in, **not deployed**. Deploy it only
  after step 3.
- `USE_FIREBASE_AUTH` in `index.html` — a flag, currently `false`. While false,
  the app uses the existing PIN unlock and loads the full doc (today's behavior).
  Flip it to `true` only after steps 1–3, or the admin cannot sign in.
- `publicSummary(S)` in `index.html` — builds the sanitized, public-safe payload
  (portfolio-level only: project names, public values/returns, status — **no**
  ledger, **no** investor identities/amounts, **no** pocket balances).

## Steps (all in the Firebase console / CLI — I cannot do these for you)

### 1. Enable Authentication
Firebase console → **Build → Authentication → Get started** → enable a provider
(**Email/Password** is simplest, or Google). Create your admin user (your email +
a password). Note its **UID** (Authentication → Users).

### 2. Grant the admin custom claim
The rules trust `request.auth.token.admin == true`. Set that claim once for your
UID using the Admin SDK (run locally with a service-account key that you keep out
of git — do **not** commit it):

```js
// setAdmin.js  (run: node setAdmin.js)  — service-account key stays OFF git
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
admin.auth().setCustomUserClaims('PASTE_YOUR_UID', { admin: true })
  .then(() => { console.log('admin claim set'); process.exit(0); });
```

(Alternatively use the gcloud Identity Platform UI if you prefer no local script.)

### 3. Add the Auth SDK + deploy the rules
- Add the Auth compat SDK next to the other Firebase scripts in `index.html`:
  ```html
  <script src="https://www.gstatic.com/firebasejs/11.1.0/firebase-auth-compat.js"></script>
  ```
- Deploy the rules (console → Firestore → Rules → paste `firestore.rules` →
  Publish, **or** `firebase deploy --only firestore:rules`).

### 4. Publish the first sanitized public doc
Sign in as admin in the app (see step 5), which writes both the private
`danatrack/main_data` and the public `danatrack_public/summary`. Verify in the
console that `danatrack_public/summary` contains **no** private data.

### 5. Flip the app to auth mode
Set `USE_FIREBASE_AUTH = true` in `index.html`, commit, and let it deploy. From
then on:
- Anonymous visitors load **only** `danatrack_public/summary` (sanitized).
- The Admin button opens an email/password login (`adminLogin()`), not the PIN.
- Only a signed-in admin can read/write the private doc; the rules enforce it
  server-side, so the client PIN is no longer a security boundary and its
  hardcoded value can be deleted.

## Rollback
If anything goes wrong, keep `USE_FIREBASE_AUTH = false` and revert the rules to
allow your access again. Because the flag defaults to false and the rules are not
auto-deployed, a partial setup cannot brick production.
