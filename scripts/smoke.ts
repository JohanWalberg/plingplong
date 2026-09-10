/**
 * Post-deploy smoke test: proves a deploy is actually serving, in ten seconds,
 * from the outside. Run against any origin:
 *
 *   pnpm smoke https://plingplong.se
 *
 * It checks what a first deploy most often gets wrong — the health probe, the
 * public pages, the security headers, an unknown slug answering 404 rather than
 * 200 — and exits non-zero on the first failure so it can gate a rollout.
 */
export {};

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: pnpm smoke https://plingplong.se");
  process.exit(2);
}

type Check = { name: string; run: () => Promise<string | null> };
const get = (path: string) => fetch(`${base}${path}`, { redirect: "manual", headers: { "user-agent": "hyrabostad-smoke/1" }, signal: AbortSignal.timeout(15_000) });

const checks: Check[] = [
  {
    name: "health probe answers and the database is reachable",
    run: async () => {
      const r = await get("/api/health");
      const body = (await r.json().catch(() => ({}))) as { ok?: boolean };
      return r.status === 200 && body.ok === true ? null : `status ${r.status}, body ${JSON.stringify(body)}`;
    },
  },
  {
    name: "root redirects to a locale",
    run: async () => {
      const r = await get("/");
      const loc = r.headers.get("location") ?? "";
      return [301, 302, 307, 308].includes(r.status) && /\/(sv|en)/.test(loc) ? null : `status ${r.status}, location "${loc}"`;
    },
  },
  ...["/sv", "/sv/bostader", "/sv/karta", "/sv/hyresvardar", "/sv/kommuner", "/en/homes"].map((p) => ({
    name: `${p} renders`,
    run: async () => {
      const r = await get(p);
      const html = await r.text();
      if (r.status !== 200) return `status ${r.status}`;
      if (!html.includes("<main")) return "no <main> in the response";
      if (/__next_error__/.test(html)) return "Next rendered its error shell";
      return null;
    },
  })),
  {
    name: "security headers are set",
    run: async () => {
      const r = await get("/sv");
      const missing = ["strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy", "x-frame-options"].filter((h) => !r.headers.get(h));
      return missing.length ? `missing ${missing.join(", ")}` : null;
    },
  },
  {
    name: "sitemap and robots point at this origin",
    run: async () => {
      const [s, rb] = await Promise.all([get("/sitemap.xml"), get("/robots.txt")]);
      const [sx, rt] = await Promise.all([s.text(), rb.text()]);
      if (s.status !== 200 || !sx.includes("<urlset")) return `sitemap status ${s.status}`;
      if (!sx.includes(base)) return `sitemap URLs do not start with ${base} — NEXT_PUBLIC_SITE_URL is wrong`;
      if (rb.status !== 200 || !rt.includes(`${base}/sitemap.xml`)) return `robots.txt does not name ${base}/sitemap.xml`;
      return null;
    },
  },
  {
    name: "an unknown home answers 404, not a page",
    run: async () => {
      const r = await get("/sv/bostad/finns-inte-alls-12345");
      return r.status === 404 ? null : `status ${r.status}`;
    },
  },
  {
    name: "the admin is reachable but not indexable",
    run: async () => {
      const r = await get("/sv/admin/logga-in");
      if (r.status !== 200) return `status ${r.status}`;
      const tag = r.headers.get("x-robots-tag") ?? "";
      return /noindex/.test(tag) ? null : `x-robots-tag is "${tag}"`;
    },
  },
  {
    name: "sign-in rate limiting is live (six bad attempts, the last must be refused)",
    run: async () => {
      let last = 0;
      for (let i = 0; i < 6; i++) {
        // Better Auth's CSRF check refuses a POST whose Origin is null, which is
        // what Node's fetch sends; a browser sends the page's origin, so do that.
        const r = await fetch(`${base}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ email: "smoke@example.invalid", password: "not-a-real-password" }), signal: AbortSignal.timeout(15_000) });
        last = r.status;
      }
      if (last === 429) return null;
      if (last === 401) return "sixth attempt still answered 401: limits are off (expected only on a localhost test server)";
      return `sixth attempt answered ${last}, expected 429 — check TRUSTED_PROXY_HOPS and BETTER_AUTH_URL`;
    },
  },
];

let failed = 0;
for (const c of checks) {
  const problem = await c.run().catch((e: Error) => e.message);
  console.log(`${problem ? "FAIL" : " ok "}  ${c.name}${problem ? `\n       ${problem}` : ""}`);
  if (problem) failed++;
}
console.log(failed ? `\n${failed} check(s) failed against ${base}` : `\nall ${checks.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
