export type KeywordGroups = string[][];

export type LessonExercise = {
  id: string;
  lesson_id: string;
  title: string;
  prompt: string;
  required_keywords: KeywordGroups;
  explanation: string | null;
  order_index: number;
  created_at: string;
};

export type ExerciseCheckResult = {
  answer: string;
  exerciseId: string;
  isCorrect: boolean;
  missingKeywords: string[];
};

export type ExerciseSubmissionState = {
  completedLesson: boolean;
  correctCount: number;
  error?: string;
  passed: boolean;
  results: ExerciseCheckResult[];
  score: number;
  submitted: boolean;
  total: number;
};

const LEADING_MARKER_PATTERN = /^\s*(?:\d+[\).:-]\s*|[-*]\s*)/;

function cleanKeyword(keyword: string) {
  return keyword.replace(LEADING_MARKER_PATTERN, "").trim();
}

export function parseKeywordGroups(rawKeywords: string): KeywordGroups {
  return rawKeywords
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split("|")
        .map(cleanKeyword)
        .filter(Boolean),
    )
    .filter((group) => group.length > 0);
}

export function coerceKeywordGroups(value: unknown): KeywordGroups {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      if (Array.isArray(group)) {
        return group.map((item) => String(item).trim()).filter(Boolean);
      }

      return [String(group).trim()].filter(Boolean);
    })
    .filter((group) => group.length > 0);
}

export function normalizeKeywordText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, " ")
    .replace(/[ʼ'’`]/g, "")
    .replace(/[^0-9a-zа-яёєіїґ]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findKeywordRange(
  answerTokens: string[],
  keywordTokens: string[],
  usedTokenIndexes: Set<number>,
) {
  if (keywordTokens.length === 0 || keywordTokens.length > answerTokens.length) {
    return null;
  }

  for (
    let startIndex = 0;
    startIndex <= answerTokens.length - keywordTokens.length;
    startIndex += 1
  ) {
    const matches = keywordTokens.every(
      (token, tokenIndex) =>
        answerTokens[startIndex + tokenIndex] === token &&
        !usedTokenIndexes.has(startIndex + tokenIndex),
    );

    if (matches) {
      return {
        end: startIndex + keywordTokens.length,
        start: startIndex,
      };
    }
  }

  return null;
}

function getNumberTokens(value: string) {
  return value.match(/\d+/g) ?? [];
}

export function checkKeywordAnswer(
  answer: string,
  requiredKeywords: KeywordGroups,
): ExerciseCheckResult {
  const answerTokens = normalizeKeywordText(answer).split(" ").filter(Boolean);
  const answerNumberTokens = getNumberTokens(answer);
  const usedTokenIndexes = new Set<number>();
  const usedNumberTokenIndexes = new Set<number>();
  const missingKeywords: string[] = [];

  requiredKeywords.forEach((alternatives) => {
    let matchedRange: ReturnType<typeof findKeywordRange> = null;
    let matchedNumberRange: ReturnType<typeof findKeywordRange> = null;

    for (const keyword of alternatives) {
      const cleanedKeyword = cleanKeyword(keyword);
      const keywordTokens = normalizeKeywordText(cleanedKeyword)
        .split(" ")
        .filter(Boolean);
      matchedRange = findKeywordRange(
        answerTokens,
        keywordTokens,
        usedTokenIndexes,
      );

      if (matchedRange) {
        break;
      }

      const keywordNumberTokens = getNumberTokens(cleanedKeyword);

      if (keywordNumberTokens.length > 0) {
        matchedNumberRange = findKeywordRange(
          answerNumberTokens,
          keywordNumberTokens,
          usedNumberTokenIndexes,
        );
      }

      if (matchedNumberRange) {
        break;
      }
    }

    if (!matchedRange && !matchedNumberRange) {
      missingKeywords.push(alternatives.map(cleanKeyword).join(" / "));
      return;
    }

    if (matchedRange) {
      for (let index = matchedRange.start; index < matchedRange.end; index += 1) {
        usedTokenIndexes.add(index);
      }
    }

    if (matchedNumberRange) {
      for (
        let index = matchedNumberRange.start;
        index < matchedNumberRange.end;
        index += 1
      ) {
        usedNumberTokenIndexes.add(index);
      }
    }
  });

  return {
    answer,
    exerciseId: "",
    isCorrect: missingKeywords.length === 0 && requiredKeywords.length > 0,
    missingKeywords,
  };
}
