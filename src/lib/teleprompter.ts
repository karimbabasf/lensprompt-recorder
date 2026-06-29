export type PromptWord = {
  text: string;
  normalized: string;
  sentenceIndex: number;
  wordIndex: number;
  flatIndex: number;
};

export type PromptSentence = {
  id: string;
  text: string;
  words: string[];
  normalizedWords: string[];
  startWordIndex: number;
  endWordIndex: number;
};

export type PromptModel = {
  sentences: PromptSentence[];
  flatWords: PromptWord[];
  totalWordCount: number;
};

export type PromptProgress = {
  currentSentenceIndex: number;
  displaySentenceIndex: number;
  currentWordIndex: number;
  displayWordIndex: number;
  completedWordCount: number;
  improvisedWords: string[];
  spokenWords: string[];
  sentenceWordCounts: number[];
  isComplete: boolean;
  progressRatio: number;
};

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
const SENTENCE_PATTERN = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;

export function splitScriptIntoSentences(script: string): string[] {
  const manualLines = script
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (manualLines.length > 1) {
    return manualLines;
  }

  const pastedBlock = manualLines[0] ?? "";
  const punctuationSentences = pastedBlock
    .match(SENTENCE_PATTERN)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  return punctuationSentences?.length ? punctuationSentences : manualLines;
}

export function createPromptModel(script: string): PromptModel {
  const sentences = splitScriptIntoSentences(script);
  const flatWords: PromptWord[] = [];

  const promptSentences = sentences.map((text, sentenceIndex): PromptSentence => {
    const words = extractDisplayWords(text);
    const normalizedWords = words.map(normalizeWord).filter(Boolean);
    const startWordIndex = flatWords.length;

    normalizedWords.forEach((normalized, wordIndex) => {
      flatWords.push({
        text: words[wordIndex],
        normalized,
        sentenceIndex,
        wordIndex,
        flatIndex: startWordIndex + wordIndex,
      });
    });

    return {
      id: `${sentenceIndex}-${normalizedWords[0] ?? "sentence"}`,
      text,
      words,
      normalizedWords,
      startWordIndex,
      endWordIndex: flatWords.length,
    };
  });

  return {
    sentences: promptSentences,
    flatWords,
    totalWordCount: flatWords.length,
  };
}

export function advancePrompt(
  model: PromptModel,
  transcript: string,
  searchWindow = 6,
): PromptProgress {
  const spokenWords = tokenize(transcript);
  const improvisedWords: string[] = [];
  let nextExpectedIndex = 0;

  for (const spokenWord of spokenWords) {
    if (nextExpectedIndex >= model.flatWords.length) {
      improvisedWords.push(spokenWord);
      continue;
    }

    const matchIndex = findNextMatch(model.flatWords, spokenWord, nextExpectedIndex, searchWindow);

    if (matchIndex === -1) {
      improvisedWords.push(spokenWord);
      continue;
    }

    nextExpectedIndex = matchIndex + 1;
  }

  const isComplete = model.totalWordCount > 0 && nextExpectedIndex >= model.totalWordCount;
  const activeWord = model.flatWords[Math.min(nextExpectedIndex, model.totalWordCount - 1)];
  const currentSentenceIndex = isComplete
    ? Math.max(model.sentences.length - 1, 0)
    : activeWord?.sentenceIndex ?? 0;
  const currentSentence = model.sentences[currentSentenceIndex];
  const currentWordIndex = isComplete
    ? currentSentence?.normalizedWords.length ?? 0
    : activeWord?.wordIndex ?? 0;
  const displaySentenceIndex = getDisplaySentenceIndex(
    model.sentences,
    currentSentenceIndex,
    nextExpectedIndex,
    isComplete,
  );
  const displaySentence = model.sentences[displaySentenceIndex];
  const displayWordIndex =
    displaySentenceIndex === currentSentenceIndex ? currentWordIndex : 0;

  return {
    currentSentenceIndex,
    displaySentenceIndex,
    currentWordIndex,
    displayWordIndex,
    completedWordCount: nextExpectedIndex,
    improvisedWords,
    spokenWords,
    sentenceWordCounts: countCompletedWordsBySentence(model.sentences, nextExpectedIndex),
    isComplete,
    progressRatio: model.totalWordCount === 0 ? 0 : nextExpectedIndex / model.totalWordCount,
  };
}

export function normalizeWord(word: string): string {
  return word
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function tokenize(text: string): string[] {
  return extractDisplayWords(text).map(normalizeWord).filter(Boolean);
}

function extractDisplayWords(text: string): string[] {
  return text.match(WORD_PATTERN) ?? [];
}

function findNextMatch(
  flatWords: PromptWord[],
  spokenWord: string,
  fromIndex: number,
  searchWindow: number,
): number {
  const endIndex = Math.min(flatWords.length, fromIndex + searchWindow);

  for (let index = fromIndex; index < endIndex; index += 1) {
    if (wordsAreClose(spokenWord, flatWords[index].normalized)) {
      return index;
    }
  }

  return -1;
}

function wordsAreClose(spokenWord: string, expectedWord: string): boolean {
  if (spokenWord === expectedWord) {
    return true;
  }

  if (spokenWord.length <= 3 || expectedWord.length <= 3) {
    return false;
  }

  if (spokenWord.startsWith(expectedWord) || expectedWord.startsWith(spokenWord)) {
    return Math.abs(spokenWord.length - expectedWord.length) <= 2;
  }

  const distance = levenshteinDistance(spokenWord, expectedWord, 2);
  return distance <= (expectedWord.length > 7 ? 2 : 1);
}

function levenshteinDistance(left: string, right: string, maxDistance: number): number {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowBest = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const editDistance = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );

      current[rightIndex] = editDistance;
      rowBest = Math.min(rowBest, editDistance);
    }

    if (rowBest > maxDistance) {
      return maxDistance + 1;
    }

    previous = current;
  }

  return previous[right.length];
}

function countCompletedWordsBySentence(
  sentences: PromptSentence[],
  completedWordCount: number,
): number[] {
  return sentences.map((sentence) => {
    if (completedWordCount <= sentence.startWordIndex) {
      return 0;
    }

    if (completedWordCount >= sentence.endWordIndex) {
      return sentence.normalizedWords.length;
    }

    return completedWordCount - sentence.startWordIndex;
  });
}

function getDisplaySentenceIndex(
  sentences: PromptSentence[],
  currentSentenceIndex: number,
  completedWordCount: number,
  isComplete: boolean,
): number {
  if (isComplete) {
    return currentSentenceIndex;
  }

  const currentSentence = sentences[currentSentenceIndex];
  const nextSentence = sentences[currentSentenceIndex + 1];

  if (!currentSentence || !nextSentence) {
    return currentSentenceIndex;
  }

  const remainingWords = currentSentence.endWordIndex - completedWordCount;
  return remainingWords <= 1 ? currentSentenceIndex + 1 : currentSentenceIndex;
}
