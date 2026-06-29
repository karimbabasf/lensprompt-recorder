import { describe, expect, it } from "vitest";
import {
  advancePrompt,
  createPromptModel,
  splitScriptIntoSentences,
} from "./teleprompter";

describe("splitScriptIntoSentences", () => {
  it("prefers the user's manual sentence breaks", () => {
    expect(
      splitScriptIntoSentences("Open on the camera.\n\nSay the first line.\nLand the close."),
    ).toEqual(["Open on the camera.", "Say the first line.", "Land the close."]);
  });

  it("falls back to punctuation when the text is pasted as one block", () => {
    expect(splitScriptIntoSentences("First beat. Second beat! Final beat?")).toEqual([
      "First beat.",
      "Second beat!",
      "Final beat?",
    ]);
  });
});

describe("advancePrompt", () => {
  it("advances sentence-by-sentence at the speaker's pace", () => {
    const model = createPromptModel("Hello there.\nToday we launch.");
    const progress = advancePrompt(model, "hello there today");

    expect(progress.currentSentenceIndex).toBe(1);
    expect(progress.displaySentenceIndex).toBe(1);
    expect(progress.currentWordIndex).toBe(1);
    expect(progress.completedWordCount).toBe(3);
    expect(progress.isComplete).toBe(false);
  });

  it("shows the next sentence when the speaker reaches the last word of the current one", () => {
    const model = createPromptModel("One two three four five.\nNext line now.");
    const progress = advancePrompt(model, "one two three four");

    expect(progress.currentSentenceIndex).toBe(0);
    expect(progress.displaySentenceIndex).toBe(1);
  });

  it("keeps tracking when the speaker improvises between scripted words", () => {
    const model = createPromptModel("We open the camera.\nThen we hit record.");
    const progress = advancePrompt(
      model,
      "we open honestly this matters the camera then we hit",
    );

    expect(progress.currentSentenceIndex).toBe(1);
    expect(progress.displaySentenceIndex).toBe(1);
    expect(progress.currentWordIndex).toBe(3);
    expect(progress.improvisedWords).toEqual(["honestly", "this", "matters"]);
  });

  it("fuzzy-matches small recognition errors", () => {
    const model = createPromptModel("Compression stays untouched.");
    const progress = advancePrompt(model, "compression stays untoched");

    expect(progress.isComplete).toBe(true);
    expect(progress.completedWordCount).toBe(3);
  });
});
