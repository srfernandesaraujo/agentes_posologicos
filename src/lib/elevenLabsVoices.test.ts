import { describe, it, expect } from "vitest";
import { CURATED_VOICES, DEFAULT_VOICE_ID, findCuratedVoice } from "./elevenLabsVoices";

describe("elevenLabsVoices", () => {
  it("DEFAULT_VOICE_ID matches the first curated voice", () => {
    expect(DEFAULT_VOICE_ID).toBe(CURATED_VOICES[0].id);
  });

  it("findCuratedVoice finds a known id", () => {
    expect(findCuratedVoice(CURATED_VOICES[1].id)?.name).toBe(CURATED_VOICES[1].name);
  });

  it("findCuratedVoice returns undefined for a custom/unknown id", () => {
    expect(findCuratedVoice("some-custom-elevenlabs-id")).toBeUndefined();
    expect(findCuratedVoice(null)).toBeUndefined();
    expect(findCuratedVoice(undefined)).toBeUndefined();
  });

  it("has no duplicate voice ids", () => {
    const ids = CURATED_VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
