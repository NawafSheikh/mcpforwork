# Deploy

MCP for Work is a static single-page app. It has no server of its own: local mode runs
entirely in the browser, and live mode talks straight to `https://clawai.eu/api/coc/*`
with a Supabase bearer token, which works cross-origin because that API sends
`Access-Control-Allow-Origin: *`.

Build output is `dist/`. Anything that can serve a folder with an SPA fallback will do.

---

## 1. Environment variables

Local mode needs none. Live mode reads three, all at build time (Vite inlines `VITE_*`
into the bundle, so treat them as public values):

| Name | Required | Default | What it is |
|---|---|---|---|
| `VITE_SUPABASE_URL` | for live mode | none | The Supabase project URL, for example `https://<ref>.supabase.co`. Used only for `/auth/v1/*`. |
| `VITE_SUPABASE_ANON_KEY` | for live mode | none | The Supabase anon key. Public by design: it is a client key, gated by row level security. |
| `VITE_CLAWAI_API` | no | `https://clawai.eu` | Base URL of the clawai API. Override to point at a staging host. |

There is no `.env.example` in this repo on purpose. Create a local `.env.local` (already
in `.gitignore`) with the three names above when you want live mode on a dev server:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_CLAWAI_API=https://clawai.eu
```

**Never put a service-role key, a database URL or any Composio credential here.** The
console only ever needs the anon key. The access token it gets back is held in memory in
`src/live/auth.ts` and is never written to `localStorage` and never placed in a URL.

If the variables are absent the app still builds and runs; `isLiveConfigured()` returns
false and the UI keeps live mode switched off.

---

## 2. Vercel

```bash
npm i -g vercel        # once
vercel link            # pick or create the project
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_CLAWAI_API production      # optional
vercel --prod
```

`vercel.json` in the repo root does four things:

1. **Framework and build**: `framework: "vite"`, `npm ci`, `npm run build`, output `dist`.
2. **SPA rewrites**: `/(.*)` rewrites to `/index.html`. Static files under `/assets` are
   served before rewrites are applied, so hashed bundles still resolve. This matters more
   than usual here: WebMCP tools are registered once by the top-level page, so any real
   navigation would tear the tool set down mid-conversation. Every tab in the console is
   React state, and the rewrite guarantees a deep link never 404s into a reload.
3. **Security headers**, with `Content-Security-Policy` mirroring the `<meta http-equiv>`
   in `index.html` exactly, byte for byte:

   ```
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data:; connect-src 'self' https://clawai.eu https://*.supabase.co;
   font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
   ```

   `connect-src` is the important line: the page may reach its own origin, the clawai API
   and the Supabase auth endpoint, and nothing else. `frame-ancestors 'none'` keeps the
   console out of other people's iframes. Also set: `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a `Permissions-Policy` that
   denies camera, microphone, geolocation, payment and USB, and HSTS for a year.

   If you change the CSP, change it in **both** `index.html` and `vercel.json`, or the
   meta tag (which is the stricter of the two at parse time) silently wins.
4. **Caching**: immutable for `/assets/*`, `no-cache` for `index.html`.

Preview deployments get the same headers, so a judge testing a preview URL sees the same
security posture as production.

---

## 3. Custom domain: mcpforwork.com at Dynadot

The domain is registered at Dynadot. Two ways to point it at Vercel; pick one, not both.

### Option A: Vercel nameservers (simplest, recommended)

1. Vercel dashboard, project, **Settings, Domains**, add `mcpforwork.com` and
   `www.mcpforwork.com`. Vercel shows the nameservers to use, currently
   `ns1.vercel-dns.com` and `ns2.vercel-dns.com` (read them off the screen, do not trust
   this line).
2. Dynadot, sign in, **My Domains, Manage Domains**, tick `mcpforwork.com`, choose
   **Name Servers** from the bulk action bar.
3. Select **Use Dynadot Name Servers?** No, pick **Custom Name Servers** (called "Name
   Servers" in the older UI), enter the two Vercel hosts, save.
4. Wait for propagation, usually 10 to 60 minutes, up to 24 hours. Vercel issues the
   Let's Encrypt certificate automatically once the nameservers resolve.

### Option B: keep Dynadot DNS, add records

Use this if other records already live at Dynadot, for example mail.

1. Dynadot, **My Domains, Manage Domains**, tick the domain, choose **DNS Settings** and
   set it to **Dynadot DNS**.
2. Add these records, then save:

   | Type | Host / subdomain | Value |
   |---|---|---|
   | A | (blank, the apex) | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Vercel shows the exact apex IP and CNAME target in **Settings, Domains** after you add
   the domain. Use what the dashboard prints; the values above are the current defaults.
3. Back in Vercel, add both `mcpforwork.com` and `www.mcpforwork.com` and set one as the
   redirect target for the other. Vercel verifies and issues the certificate.

Dynadot caveats worth knowing: DNS changes there can take up to an hour to publish even
when the page says saved, and the "Name Servers" and "DNS Settings" screens are mutually
exclusive, so setting custom nameservers wipes any A or CNAME records you entered.

---

## 4. Alternative: nginx on the VPS

If the console should live beside the existing clawai front end rather than on Vercel,
serve it from a path on the same host. Same origin as the API, so `connect-src 'self'`
alone would cover the calls, but the header below keeps the two deploys identical.

```bash
npm ci
npm run build
rsync -av --delete dist/ root@37.60.251.102:/var/www/mcpforwork/
```

Add this inside the existing `server { ... }` block for `clawai.eu`:

```nginx
location /console/ {
    alias /var/www/mcpforwork/;
    index index.html;

    # SPA fallback: any deep link renders the app, never a 404.
    try_files $uri $uri/ /console/index.html;

    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://clawai.eu https://*.supabase.co; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Frame-Options "DENY" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
}

location /console/assets/ {
    alias /var/www/mcpforwork/assets/;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

Then:

```bash
nginx -t && systemctl reload nginx
```

Two things to remember for a subpath deploy:

- Build with the matching base, otherwise the asset URLs point at the domain root:
  `npx vite build --base=/console/`.
- `add_header` inside a `location` block replaces, not merges, the headers inherited from
  the `server` block. Every header the page needs has to be repeated in the block above,
  which is why it is written out in full.

---

## 5. Post-deploy checklist

- [ ] `https://<host>/` loads and the WebMCP status pill says tools are registered.
- [ ] A deep link such as `https://<host>/monitors` renders the app, not a 404.
- [ ] `curl -sI https://<host>/ | grep -i content-security-policy` matches `index.html`.
- [ ] Local mode: the board opens empty, and no network call goes to clawai.
- [ ] Live mode: sign in with email and password inside the ChatGPT desktop browser,
      which is a separate storage partition from the normal browser, so the sign-in has
      to happen there. OAuth redirect flows are the fragile part; password and one-time
      code are the reliable paths.
- [ ] DevTools, Application, Local Storage: no access token anywhere.
