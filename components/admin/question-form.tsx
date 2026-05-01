"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  createExamQuestionAction,
  updateExamQuestionAction,
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ExamQuestion, QuestionType } from "@/lib/types";

type QuestionFormProps = {
  examId: string;
  kind: "exam-question";
  question?: ExamQuestion;
};

const typeLabels = {
  multiple_choice: "Тест з варіантами",
  true_false: "Правда / Хибно",
};

function getInitialOptions(item?: ExamQuestion) {
  if (item?.type === "multiple_choice" && item.options?.length) {
    return item.options;
  }

  return ["", ""];
}

export function QuestionForm({ examId, question }: QuestionFormProps) {
  const [type, setType] = useState<Exclude<QuestionType, "open_text">>(
    question?.type ?? "multiple_choice",
  );
  const [options, setOptions] = useState<string[]>(getInitialOptions(question));
  const [correctAnswer, setCorrectAnswer] = useState(
    question?.correct_answer ?? "",
  );
  const availableOptions = useMemo(
    () => options.map((option) => option.trim()).filter(Boolean),
    [options],
  );
  const action = question ? updateExamQuestionAction : createExamQuestionAction;
  const submitLabel = question ? "Зберегти зміни" : "Додати";
  const itemId = question?.id ?? "new";

  return (
    <form action={action} className="space-y-4">
      <input name="exam_id" type="hidden" value={examId} />
      {question ? (
        <input name="question_id" type="hidden" value={question.id} />
      ) : null}

      <div className="space-y-2">
        <label className="field-label" htmlFor={`question-${itemId}`}>
          Питання
        </label>
        <textarea
          className="field-input min-h-24 resize-y"
          defaultValue={question?.question ?? ""}
          id={`question-${itemId}`}
          name="question"
          placeholder="Сформулюйте питання"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="field-label" htmlFor={`type-${itemId}`}>
            Тип
          </label>
          <select
            className="field-input"
            id={`type-${itemId}`}
            name="type"
            onChange={(event) => {
              const nextType = event.target.value as Exclude<
                QuestionType,
                "open_text"
              >;
              setType(nextType);
              setCorrectAnswer(nextType === "true_false" ? "true" : "");
            }}
            value={type}
          >
            <option value="multiple_choice">{typeLabels.multiple_choice}</option>
            <option value="true_false">{typeLabels.true_false}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="field-label" htmlFor={`order-${itemId}`}>
            Порядок
          </label>
          <input
            className="field-input"
            defaultValue={question?.order_index ?? 0}
            id={`order-${itemId}`}
            min={0}
            name="order_index"
            type="number"
          />
        </div>
      </div>

      {type === "multiple_choice" ? (
        <div className="space-y-3">
          <input name="options_json" type="hidden" value={JSON.stringify(options)} />
          <input name="correct_answer" type="hidden" value={correctAnswer} />
          <div className="flex items-center justify-between gap-3">
            <span className="field-label">Варіанти відповідей</span>
            <button
              className="btn-secondary h-9 px-3"
              onClick={() => setOptions((current) => [...current, ""])}
              type="button"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Додати
            </button>
          </div>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" key={index}>
                <input
                  className="field-input"
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = event.target.value;
                    setOptions(next);
                    if (correctAnswer === option) {
                      setCorrectAnswer(event.target.value);
                    }
                  }}
                  placeholder={`Варіант ${index + 1}`}
                  value={option}
                />
                <label className="btn-secondary h-10 px-3">
                  <input
                    checked={correctAnswer === option && option.trim().length > 0}
                    className="sr-only"
                    disabled={!option.trim()}
                    onChange={() => setCorrectAnswer(option)}
                    type="radio"
                  />
                  Правильна
                </label>
                <button
                  className="btn-secondary h-10 px-3"
                  disabled={options.length <= 2}
                  onClick={() => {
                    const next = options.filter(
                      (_, optionIndex) => optionIndex !== index,
                    );
                    setOptions(next);
                    if (correctAnswer === option) {
                      setCorrectAnswer("");
                    }
                  }}
                  title="Видалити варіант"
                  type="button"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {availableOptions.length > 0 && !availableOptions.includes(correctAnswer) ? (
            <p className="text-xs text-amber-700">
              Позначте правильний варіант.
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "true_false" ? (
        <div className="space-y-2">
          <input name="options_json" type="hidden" value={JSON.stringify(["true", "false"])} />
          <label className="field-label" htmlFor={`correct-${itemId}`}>
            Правильна відповідь
          </label>
          <select
            className="field-input"
            id={`correct-${itemId}`}
            name="correct_answer"
            onChange={(event) => setCorrectAnswer(event.target.value)}
            value={correctAnswer || "true"}
          >
            <option value="true">Правда</option>
            <option value="false">Хибно</option>
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="field-label" htmlFor={`explanation-${itemId}`}>
          Пояснення
        </label>
        <textarea
          className="field-input min-h-20 resize-y"
          defaultValue={question?.explanation ?? ""}
          id={`explanation-${itemId}`}
          name="explanation"
          placeholder="Необов'язкова підказка після перевірки"
        />
      </div>

      <SubmitButton label={submitLabel} pendingLabel="Зберігаємо..." />
    </form>
  );
}
