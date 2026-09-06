import { describe, expect, it } from "vitest";
import { assertPublicUrl, BlockedUrlError, isPublicIp } from "./net-guard";

describe("isPublicIp", () => {
  it("refuses loopback, private, link-local, unique-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.5.5", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) expect(isPublicIp(ip), ip).toBe(false);
  });
  it("accepts public addresses", () => {
    for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicIp(ip), ip).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isPublicIp("not-an-ip")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("refuses other schemes, odd ports, credentials and private literals", async () => {
    for (const u of ["ftp://example.se/x", "file:///etc/passwd", "javascript:alert(1)", "http://example.se:8080/", "http://user:pw@example.se/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/"]) {
      await expect(assertPublicUrl(u), u).rejects.toBeInstanceOf(BlockedUrlError);
    }
  });
  it("refuses names that resolve to loopback", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toBeInstanceOf(BlockedUrlError);
  });
  it("accepts a public literal on a default port", async () => {
    expect((await assertPublicUrl("https://93.184.216.34/feed.xml")).hostname).toBe("93.184.216.34");
  });
});
