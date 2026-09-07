/**
 * Company registry lookup behind a provider interface. The default provider
 * is Bolagsverket's free "värdefulla datamängder" API, active only when its
 * credentials are configured; otherwise lookups return null and the approval
 * queue shows "verify manually".
 *
 * Env (see .env.example):
 *   BOLAGSVERKET_API_URL    base URL of the company-information API
 *   BOLAGSVERKET_TOKEN_URL  OAuth2 client-credentials token endpoint
 *   BOLAGSVERKET_CLIENT_ID / BOLAGSVERKET_CLIENT_SECRET
 * The exact response shape is documented in the credentials mail from
 * Bolagsverket; `parseRegistryResponse` reads the common field names and is
 * the one place to adjust.
 */
export type RegistryResult = {
  name: string | null;
  legalForm: string | null;
  registeredAt: string | null; // YYYY-MM-DD
  status: "active" | "deregistered" | "unknown";
  provider: string;
  raw?: unknown;
};

export interface RegistryProvider {
  id: string;
  configured(): boolean;
  lookup(orgNumber: string): Promise<RegistryResult | null>;
}

/** Reads name, legal form, registration date and status from the usual Swedish field names. */
export function parseRegistryResponse(json: unknown, provider = "bolagsverket"): RegistryResult | null {
  if (!json || typeof json !== "object") return null;
  const root = (Array.isArray(json) ? json[0] : json) as Record<string, unknown> | undefined;
  if (!root) return null;
  const org = (root.organisation ?? (root.organisationer as unknown[] | undefined)?.[0] ?? root.foretag ?? root) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = k.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), org);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const text = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      return text(o.namn ?? o.name ?? o.beskrivning ?? o.kod ?? o.code ?? o.value);
    }
    return String(v);
  };
  const name = text(pick("organisationsnamn", "namn", "name", "organisationsnamn.namn", "organisationsnamnLista.0.namn", "foretagsnamn"));
  const legalForm = text(pick("organisationsform", "juridiskForm", "legalForm", "organisationsform.beskrivning", "bolagsform"));
  const registeredAt = text(pick("registreringsdatum", "registreringsDatum", "registrationDate", "bildatDatum"))?.slice(0, 10) ?? null;
  const rawStatus = text(pick("status", "organisationsstatus", "verksamhetsstatus", "avregistreringsdatum", "deregistrationDate"))?.toLowerCase() ?? null;
  const deregistered = pick("avregistreringsdatum", "deregistrationDate") !== undefined || /avregistrerad|upphört|deregistered|konkurs|likvid/.test(rawStatus ?? "");
  const active = /aktiv|active|registrerad|bildat/.test(rawStatus ?? "") || (rawStatus === null && (name !== null || legalForm !== null));
  return { name, legalForm, registeredAt, status: deregistered ? "deregistered" : active ? "active" : "unknown", provider, raw: json };
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function bearerToken(): Promise<string | null> {
  const url = process.env.BOLAGSVERKET_TOKEN_URL;
  const id = process.env.BOLAGSVERKET_CLIENT_ID;
  const secret = process.env.BOLAGSVERKET_CLIENT_SECRET;
  if (!url || !id || !secret) return process.env.BOLAGSVERKET_API_KEY ?? null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

export const bolagsverketProvider: RegistryProvider = {
  id: "bolagsverket",
  configured: () => Boolean(process.env.BOLAGSVERKET_API_URL && (process.env.BOLAGSVERKET_API_KEY || (process.env.BOLAGSVERKET_CLIENT_ID && process.env.BOLAGSVERKET_CLIENT_SECRET))),
  async lookup(orgNumber) {
    const base = process.env.BOLAGSVERKET_API_URL!.replace(/\/$/, "");
    const digits = orgNumber.replace(/\D/g, "");
    const token = await bearerToken();
    const res = await fetch(`${base}/organisationer/${digits}`, {
      headers: { accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { name: null, legalForm: null, registeredAt: null, status: "unknown", provider: "bolagsverket", raw: { notFound: true } };
    if (!res.ok) throw new Error(`registry ${res.status}`);
    return parseRegistryResponse(await res.json());
  },
};

export const noRegistry: RegistryProvider = { id: "none", configured: () => false, lookup: async () => null };

export function registryProvider(): RegistryProvider {
  return bolagsverketProvider.configured() ? bolagsverketProvider : noRegistry;
}

/** Lookup that never throws: a registry outage must not block a sign-up. */
export async function lookupOrganisation(orgNumber: string): Promise<{ result: RegistryResult | null; error?: string; configured: boolean }> {
  const p = registryProvider();
  if (!p.configured()) return { result: null, configured: false };
  try {
    return { result: await p.lookup(orgNumber), configured: true };
  } catch (e) {
    return { result: null, error: (e as Error).message, configured: true };
  }
}
