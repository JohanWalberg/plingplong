import { describe, expect, it } from "vitest";

describe("SITE_HOST", () => {
  it("drops a www prefix so printed and mailed forms read as the bare domain", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.plingplong.se";
    const { SITE_HOST, SITE_URL } = await import("./site");
    expect(SITE_URL).toBe("https://www.plingplong.se");
    expect(SITE_HOST).toBe("plingplong.se");
  });
});
