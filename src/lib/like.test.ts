import { expect, it } from "vitest";
import { escapeLike } from "./like";

it("escapes percent, underscore and backslash", () => {
  expect(escapeLike("50% off_now\\x")).toBe("50\\% off\\_now\\\\x");
  expect(escapeLike("Solna")).toBe("Solna");
});
