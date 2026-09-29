import { describe, expect, it } from "vitest";
import { generateNtfyTopic } from "./preferences.utils";

describe("generateNtfyTopic", () => {
  it("includes a slugified version of the name", () => {
    expect(generateNtfyTopic("Megan Ward")).toMatch(/^padel-megan-ward-[a-z0-9]+$/);
  });

  it("strips characters that aren't safe in a topic name", () => {
    expect(generateNtfyTopic("Adam O'Brien!!")).toMatch(/^padel-adam-o-brien-[a-z0-9]+$/);
  });

  it("falls back to a generic slug for an empty name", () => {
    expect(generateNtfyTopic("   ")).toMatch(/^padel-friend-[a-z0-9]+$/);
  });

  it("generates a different topic on each call", () => {
    expect(generateNtfyTopic("Lily")).not.toBe(generateNtfyTopic("Lily"));
  });
});
