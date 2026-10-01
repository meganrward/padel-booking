import { describe, expect, it } from "vitest";
import { generateNtfyTopic, isEligibleForAdvancedTraining } from "./preferences.utils";

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

describe("isEligibleForAdvancedTraining", () => {
  it("is false when gender is not set", () => {
    expect(isEligibleForAdvancedTraining(null, 5)).toBe(false);
  });

  it("is false when level is not set", () => {
    expect(isEligibleForAdvancedTraining("male", null)).toBe(false);
  });

  it("is false for a man below level 5", () => {
    expect(isEligibleForAdvancedTraining("male", 4.75)).toBe(false);
  });

  it("is true for a man at or above level 5", () => {
    expect(isEligibleForAdvancedTraining("male", 5)).toBe(true);
    expect(isEligibleForAdvancedTraining("male", 5.5)).toBe(true);
  });

  it("is false for a woman below level 4", () => {
    expect(isEligibleForAdvancedTraining("female", 3.75)).toBe(false);
  });

  it("is true for a woman at or above level 4", () => {
    expect(isEligibleForAdvancedTraining("female", 4)).toBe(true);
    expect(isEligibleForAdvancedTraining("female", 4.5)).toBe(true);
  });
});
