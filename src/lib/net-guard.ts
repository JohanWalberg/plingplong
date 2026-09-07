import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * Guards every outbound request made on behalf of a landlord URL. Only
 * http(s) on the default ports, and only to public addresses: loopback,
 * private, link-local (cloud metadata lives there), unique-local, multicast
 * and unspecified ranges are refused after resolving the host.
 *
 * ALLOW_PRIVATE_FETCH=1 lifts the address check outside production so the
 * local fixture feed server can be crawled during development.
 */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2001:db8::", 32]] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicIp(mapped[1]);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

export class BlockedUrlError extends Error {}

const allowPrivate = () => process.env.ALLOW_PRIVATE_FETCH === "1" && process.env.NODE_ENV !== "production";

/**
 * Parses, checks scheme and port, resolves the host and requires every address
 * to be public. Returns the address the caller must connect to: checking one
 * answer and letting the socket resolve again would let a rebinding DNS name
 * pass the check with a public address and connect to a private one.
 * `address` is null only in development with ALLOW_PRIVATE_FETCH=1.
 */
export async function resolvePublicUrl(raw: string): Promise<{ url: URL; address: string | null }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BlockedUrlError(`not a valid URL: ${raw}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedUrlError(`scheme not allowed: ${u.protocol}`);
  if (u.username || u.password) throw new BlockedUrlError("credentials in URL are not allowed");
  if (allowPrivate()) return { url: u, address: null }; // development: local fixture servers on any port
  if (u.port && u.port !== "80" && u.port !== "443") throw new BlockedUrlError(`port not allowed: ${u.port}`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new BlockedUrlError(`host does not resolve: ${host}`);
  for (const a of addresses) if (!isPublicIp(a)) throw new BlockedUrlError(`host resolves to a non-public address: ${host}`);
  return { url: u, address: addresses[0] };
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  return (await resolvePublicUrl(raw)).url;
}
