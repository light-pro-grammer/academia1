"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  createLessonExerciseAction,
  deleteLessonExerciseAction,
  submitLessonExercisesAction,
} from "@/app/lessons/[slug]/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import type {
  ExerciseSubmissionState,
  LessonExercise,
} from "@/lib/exercises";

const INITIAL_STATE: ExerciseSubmissionState = {
  completedLesson: false,
  correctCount: 0,
  passed: false,
  results: [],
  score: 0,
  submitted: false,
  total: 0,
};

type LessonExercisesProps = {
  canManageExercises: boolean;
  exercises: LessonExercise[];
  isCompleted: boolean;
  isLoggedIn: boolean;
  loadError?: string;
  lessonId: string;
  lessonSlug: string;
};

function formatKeywordGroups(groups: string[][]) {
  return groups
    .map((group) => group.join(" / "))
    .filter(Boolean)
    .join(", ");
}

function AddExerciseForm({
  lessonId,
  lessonSlug,
}: {
  lessonId: string;
  lessonSlug: string;
}) {
  return (
    <details className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-emerald-800">
        Додати вправу
      </summary>
      <form action={createLessonExerciseAction} className="mt-4 space-y-4">
        <input name="lesson_id" type="hidden" value={lessonId} />
        <input name="lesson_slug" type="hidden" value={lessonSlug} />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="field-label" htmlFor="exercise-title">
              Назва вправи
            </label>
            <input
              className="field-input"
              id="exercise-title"
              name="title"
              placeholder="Наприклад, Знайди суміжний кут"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="field-label" htmlFor="exercise-keywords">
              Ключові відповіді
            </label>
            <textarea
              className="field-input min-h-28"
              id="exercise-keywords"
              name="required_keywords"
              placeholder={"140\n67\n165\n75\n90\n139"}
              required
            />
            <p className="text-xs leading-5 text-slate-600">
              Кожен обов&apos;язковий ключ пишіть з нового рядка. Альтернативи в
              одному рядку розділяйте символом |, наприклад: Так | правда.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="field-label" htmlFor="exercise-prompt">
            Текст завдання
          </label>
          <textarea
            className="field-input min-h-32"
            id="exercise-prompt"
            name="prompt"
            placeholder="Опишіть умову вправи..."
            required
          />
        </div>

        <div className="space-y-2">
          <label className="field-label" htmlFor="exercise-explanation">
            Пояснення після перевірки
          </label>
          <textarea
            className="field-input min-h-24"
            id="exercise-explanation"
            name="explanation"
            placeholder="Поясніть правильний хід розв'язання..."
          />
        </div>

        <div className="max-w-xs">
          <SubmitButton
            label="Зберегти вправу"
            pendingLabel="Зберігаємо..."
          />
        </div>
      </form>
    </details>
  );
}

function ExerciseAttemptForm({
  exercises,
  isCompleted,
  lessonId,
  lessonSlug,
  onRestart,
}: {
  exercises: LessonExercise[];
  isCompleted: boolean;
  lessonId: string;
  lessonSlug: string;
  onRestart: () => void;
}) {
  const [state, formAction] = useFormState(
    submitLessonExercisesAction,
    INITIAL_STATE,
  );
  const resultByExerciseId = useMemo(
    () =>
      new Map(
        state.results.map((result) => [result.exerciseId, result]),
      ),
    [state.results],
  );
  const hasSubmitted = state.submitted;
  const completedNow = isCompleted || state.completedLesson;

  return (
    <form action={formAction} className="space-y-4">
      <input name="lesson_id" type="hidden" value={lessonId} />
      <input name="lesson_slug" type="hidden" value={lessonSlug} />

      {completedNow ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Урок завершено. Вправи можна пройти ще раз для повторення.
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.error}
        </div>
      ) : null}

      {hasSubmitted ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.passed
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="font-bold">
            Результат: {state.correctCount} з {state.total} вправ, {state.score}
            %
          </p>
          <p className="mt-1">
            {state.passed
              ? "Вітаю, урок автоматично позначено як завершений."
              : "Потрібно щонайменше 70%, щоб урок зарахувався."}
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {exercises.map((exercise, index) => {
          const result = resultByExerciseId.get(exercise.id);

          return (
            <article
              className={`rounded-lg border p-4 ${
                !result
                  ? "border-slate-200 bg-white"
                  : result.isCorrect
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-rose-200 bg-rose-50/50"
              }`}
              key={exercise.id}
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="status-pill mb-2 bg-slate-100 text-slate-700">
                    Вправа {index + 1}
                  </span>
                  <h3 className="text-lg font-bold text-slate-950">
                    {exercise.title}
                  </h3>
                </div>
                {result ? (
                  <span
                    className={`status-pill ${
                      result.isCorrect
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {result.isCorrect ? "Зараховано" : "Не зараховано"}
                  </span>
                ) : null}
              </div>

              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {exercise.prompt}
              </p>

              <div className="mt-4 space-y-2">
                <label
                  className="field-label"
                  htmlFor={`exercise-answer-${exercise.id}`}
                >
                  Ваша відповідь
                </label>
                <textarea
                  className="field-input min-h-28"
                  defaultValue={result?.answer ?? ""}
                  disabled={hasSubmitted}
                  id={`exercise-answer-${exercise.id}`}
                  name={`answer_${exercise.id}`}
                  placeholder="Введіть відповідь. Наприклад: 140, 67, 165..."
                />
              </div>

              {result ? (
                <div className="mt-4 space-y-2 rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                  {result.missingKeywords.length > 0 ? (
                    <p className="text-rose-800">
                      Не знайдено: {result.missingKeywords.join(", ")}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-semibold">Очікувані ключі:</span>{" "}
                    {formatKeywordGroups(exercise.required_keywords)}
                  </p>
                  {exercise.explanation ? (
                    <p className="whitespace-pre-wrap">
                      <span className="font-semibold">Пояснення:</span>{" "}
                      {exercise.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {hasSubmitted ? (
          <button className="btn-secondary" onClick={onRestart} type="button">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Пройти ще раз
          </button>
        ) : (
          <SubmitButton
            label="Перевірити вправи"
            pendingLabel="Перевіряємо..."
          />
        )}
      </div>
    </form>
  );
}

export function LessonExercises({
  canManageExercises,
  exercises,
  isCompleted,
  isLoggedIn,
  lessonId,
  lessonSlug,
  loadError,
}: LessonExercisesProps) {
  const [attemptKey, setAttemptKey] = useState(0);

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
            <ClipboardCheck className="h-6 w-6 text-emerald-700" aria-hidden="true" />
            Вправи до уроку
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Урок зараховується автоматично після результату від 70%.
          </p>
        </div>
        {exercises.length > 0 ? (
          <span className="status-pill bg-emerald-50 text-emerald-800">
            {exercises.length} вправ
          </span>
        ) : null}
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CircleAlert className="mr-2 inline h-4 w-4" aria-hidden="true" />
          {loadError}
        </div>
      ) : null}

      {canManageExercises ? (
        <div className="mb-5 space-y-3">
          <AddExerciseForm lessonId={lessonId} lessonSlug={lessonSlug} />

          {exercises.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-2 text-sm font-bold text-slate-900">
                Керування вправами
              </h3>
              <div className="space-y-2">
                {exercises.map((exercise, index) => (
                  <div
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={exercise.id}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        {index + 1}. {exercise.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ключі: {formatKeywordGroups(exercise.required_keywords)}
                      </p>
                    </div>
                    <form action={deleteLessonExerciseAction}>
                      <input name="exercise_id" type="hidden" value={exercise.id} />
                      <input name="lesson_slug" type="hidden" value={lessonSlug} />
                      <button className="btn-danger h-9 px-3" type="submit">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Видалити
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {exercises.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          {canManageExercises
            ? "Додайте першу вправу, щоб учні могли завершувати урок через практику."
            : "До цього уроку ще не додано інтерактивні вправи."}
        </div>
      ) : isLoggedIn ? (
        <ExerciseAttemptForm
          exercises={exercises}
          isCompleted={isCompleted}
          key={attemptKey}
          lessonId={lessonId}
          lessonSlug={lessonSlug}
          onRestart={() => setAttemptKey((value) => value + 1)}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-700">
          <p className="font-semibold">
            Увійдіть, щоб пройти вправи й зберегти прогрес.
          </p>
          <Link className="btn-secondary mt-4" href="/auth/login">
            Увійти
          </Link>
        </div>
      )}
    </section>
  );
}
