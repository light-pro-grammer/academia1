import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { SubjectIcon } from "@/components/subject-icon";
import { createClient } from "@/lib/supabase/server";
import type { Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

const subjectOrder = [
  "matematyka",
  "fizyka",
  "khimiia",
  "biolohiia",
  "heohrafiia",
  "inozemni-movy",
  "anhliiska-mova",
  "istoriia",
  "istoriia-ukrainy",
] as const;

function sortSubjects(subjects: Subject[]) {
  return [...subjects].sort((first, second) => {
    const firstIndex = subjectOrder.indexOf(
      first.slug as (typeof subjectOrder)[number],
    );
    const secondIndex = subjectOrder.indexOf(
      second.slug as (typeof subjectOrder)[number],
    );
    const normalizedFirstIndex =
      firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex;
    const normalizedSecondIndex =
      secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex;

    if (normalizedFirstIndex !== normalizedSecondIndex) {
      return normalizedFirstIndex - normalizedSecondIndex;
    }

    return first.title.localeCompare(second.title, "uk");
  });
}

async function getSubjects() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("title", { ascending: true });

    if (error) {
      return { subjects: [] as Subject[], error: error.message };
    }

    return { subjects: sortSubjects((data ?? []) as Subject[]), error: null };
  } catch (error) {
    return {
      subjects: [] as Subject[],
      error: error instanceof Error ? error.message : "Невідома помилка.",
    };
  }
}

export default async function HomePage() {
  const { subjects, error } = await getSubjects();

  return (
    <section className="page-shell space-y-8">
      <div className="max-w-3xl space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Відкрита освітня платформа
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl">
            Навчання українською, урок за уроком
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Обирайте предмет, проходьте затверджені уроки та надсилайте власні
            матеріали на модерацію.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Предмети</h2>
            <p className="text-sm text-slate-600">
              Виберіть напрям і продовжуйте навчання.
            </p>
          </div>
        </div>

        {subjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Link
                className="panel group flex min-h-48 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                href={`/subjects/${subject.slug}`}
                key={subject.id}
              >
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <SubjectIcon name={subject.icon} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      {subject.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {subject.description}
                    </p>
                  </div>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  Переглянути уроки
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-sm text-slate-600">
            Поки що немає предметів. Додайте початкові предмети через SQL у
            Supabase.
          </div>
        )}
      </div>
    </section>
  );
}
