import type { QuestionType } from "@/lib/types";

export function normalizeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isAnswerCorrect(
  answer: string,
  correctAnswer: string,
  type: QuestionType,
) {
  if (type === "open_text") {
    return normalizeAnswer(answer) === normalizeAnswer(correctAnswer);
  }

  return answer.trim() === correctAnswer.trim();
}

export function formatAnswer(answer: string, type: QuestionType) {
  if (type === "true_false") {
    return answer === "true" ? "Правда" : "Хибно";
  }

  return answer || "Без відповіді";
}
