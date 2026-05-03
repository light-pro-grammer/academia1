"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteLessonAction,
  reorderLessonsAction,
} from "@/app/admin/actions";

export type ReorderableLesson = {
  id: string;
  title: string;
  slug: string;
  order_index: number;
};

export type LessonOrderGroup = {
  courseId: string | null;
  courseTitle: string;
  orderOffset: number;
  subjectTitle: string;
  lessons: ReorderableLesson[];
};

function SortableLessonRow({ lesson }: { lesson: ReorderableLesson }) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        isDragging ? "relative z-10 border-emerald-300 shadow-md" : ""
      }`}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Перетягнути урок"
          className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl font-bold leading-none text-slate-500 active:cursor-grabbing"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0">
          <Link
            className="block truncate font-bold text-slate-950 transition hover:text-emerald-700"
            href={`/lessons/${lesson.slug}`}
          >
            {lesson.title}
          </Link>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Порядок: {lesson.order_index}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Link
          className="btn-secondary h-10 px-3"
          href={`/lessons/${lesson.slug}/edit`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Редагувати
        </Link>
        <form action={deleteLessonAction}>
          <input name="lesson_id" type="hidden" value={lesson.id} />
          <button className="btn-danger h-10 w-full px-3 sm:w-auto" type="submit">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Видалити
          </button>
        </form>
      </div>
    </div>
  );
}

function LessonOrderGroupCard({ group }: { group: LessonOrderGroup }) {
  const [lessons, setLessons] = useState(group.lessons);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const lessonIds = useMemo(() => lessons.map((lesson) => lesson.id), [lessons]);

  useEffect(() => {
    setLessons(group.lessons);
  }, [group.lessons]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(null), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = lessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = lessons.findIndex((lesson) => lesson.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previousLessons = lessons;
    const nextLessons = arrayMove(lessons, oldIndex, newIndex).map(
      (lesson, index) => ({
        ...lesson,
        order_index: group.orderOffset + index,
      }),
    );

    setLessons(nextLessons);
    setMessage("Зберігаємо...");
    startTransition(() => {
      void reorderLessonsAction(
        group.courseId,
        nextLessons.map((lesson) => lesson.id),
        group.orderOffset,
      )
        .then(() => {
          setMessage("Збережено");
        })
        .catch(() => {
          setLessons(previousLessons);
          setMessage("Не вдалося зберегти порядок");
        });
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{group.courseTitle}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {group.subjectTitle} · {lessons.length} уроків
          </p>
        </div>
        {message ? (
          <span
            className={`status-pill ${
              message === "Не вдалося зберегти порядок"
                ? "bg-rose-100 text-rose-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isPending && message === "Зберігаємо..." ? "Зберігаємо..." : message}
          </span>
        ) : null}
      </div>

      {lessons.length > 0 ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext items={lessonIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {lessons.map((lesson) => (
                <SortableLessonRow key={lesson.id} lesson={lesson} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          У цьому курсі ще немає затверджених уроків.
        </p>
      )}
    </section>
  );
}

export function LessonOrderingList({ groups }: { groups: LessonOrderGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Затверджених уроків поки немає.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <LessonOrderGroupCard
          group={group}
          key={group.courseId ?? "without-course"}
        />
      ))}
    </div>
  );
}
