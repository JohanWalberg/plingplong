import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("keeps ends and a window around the current page with gaps", () => {
    expect(pageWindow(6, 20)).toEqual([1, null, 4, 5, 6, 7, 8, null, 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
  });
  it("fills a single skipped page instead of showing a gap for one number", () => {
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 6, null, 20]);
    expect(pageWindow(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, null, 20]);
  });
});
