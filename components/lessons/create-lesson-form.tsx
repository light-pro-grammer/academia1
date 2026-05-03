"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Image as ImageIcon,
  Italic,
  List,
  Loader2,
  Video,
} from "lucide-react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createLessonAction } from "@/app/lessons/create/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { MarkdownHtml } from "@/components/markdown-html";
import { createClient } from "@/lib/supabase/client";
import type { Course, Subject } from "@/lib/types";

const starterContent = `# Вступ

Коротко поясніть тему уроку.

Формула прикладу: $a^2 + b^2 = c^2$.

## Приклад коду

\`\`\`ts
const message = "Навчаймося українською";
console.log(message);
\`\`\`
`;

const IMAGE_BUCKET = "lesson-images";

type LessonFormAction = (formData: FormData) => void | Promise<void>;

type CreateLessonFormProps = {
  adminHint?: boolean;
  courses: Course[];
  formAction?: LessonFormAction;
  helperText?: string;
  initialLesson?: {
    id: string;
    title: string;
    subject_id: string;
    course_id: string | null;
    content: string;
    slug?: string;
  };
  pendingLabel?: string;
  subjects: Subject[];
  submitLabel?: string;
};

export function CreateLessonForm({
  adminHint = false,
  courses,
  formAction = createLessonAction,
  helperText = "Урок буде опубліковано одразу.",
  initialLesson,
  pendingLabel = "Публікуємо...",
  subjects,
  submitLabel = "Опублікувати урок",
}: CreateLessonFormProps) {
  const initialContent = initialLesson?.content ?? starterContent;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(initialContent);
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialLesson?.subject_id ?? "",
  );
  const [selectedCourseId, setSelectedCourseId] = useState(
    initialLesson?.course_id ?? "",
  );
  const availableCourses = useMemo(
    () =>
      courses
        .filter((course) => course.subject_id === selectedSubjectId)
        .sort((first, second) => first.order_index - second.order_index),
    [courses, selectedSubjectId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image,
      Markdown,
      Placeholder.configure({
        placeholder: "Почніть писати урок...",
      }),
    ],
    content: initialContent,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor min-h-[620px] w-full bg-white p-4 text-sm leading-6 text-slate-900 outline-none",
      },
    },
    onUpdate({ editor: activeEditor }) {
      setContent(activeEditor.getMarkdown());
    },
  });

  useEffect(() => {
    if (
      selectedCourseId &&
      !availableCourses.some((course) => course.id === selectedCourseId)
    ) {
      setSelectedCourseId("");
    }
  }, [availableCourses, selectedCourseId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await fetch("/api/markdown/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: content }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          html?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error ?? "Помилка попереднього перегляду.",
          );
        }

        setPreviewHtml(payload.html ?? "");
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewError(
            error instanceof Error
              ? error.message
              : "Не вдалося оновити попередній перегляд.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [content]);

  function insertMarkdown(markdown: string) {
    editor
      ?.chain()
      .focus()
      .insertContent(markdown, { contentType: "markdown" })
      .run();
  }

  function isCursorInsideBlockquoteMarkdown() {
    if (!editor) {
      return false;
    }

    if (editor.isActive("blockquote")) {
      return true;
    }

    const textBeforeCursor = editor.state.doc.textBetween(
      0,
      editor.state.selection.from,
      "\n",
      "\n",
    );
    const lines = textBeforeCursor.split(/\r?\n/);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]?.trimEnd() ?? "";

      if (line.trim() === "") {
        continue;
      }

      return line.trimStart().startsWith(">");
    }

    return false;
  }

  function formatImageMarkdown(altText: string, publicUrl: string) {
    const escapedAltText = altText.replace(/[\\[\]]/g, "\\$&");
    const imageMarkdown = `![${escapedAltText}](${publicUrl})`;

    if (isCursorInsideBlockquoteMarkdown()) {
      return `\n> ${imageMarkdown}\n>\n`;
    }

    return `\n${imageMarkdown}\n`;
  }

  function getSafeImageName(fileName: string) {
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const baseName = fileName
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    return `${baseName || "image"}.${extension}`;
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageUploadError("Оберіть файл зображення.");
      return;
    }

    setIsImageUploading(true);
    setImageUploadError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Увійдіть в акаунт, щоб додавати зображення.");
      }

      const imagePath = `${user.id}/${crypto.randomUUID()}-${getSafeImageName(
        file.name,
      )}`;
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(imagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(imagePath);
      const altText =
        file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() ||
        "Зображення";

      insertMarkdown(formatImageMarkdown(altText, data.publicUrl));
    } catch (error) {
      setImageUploadError(
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити зображення.",
      );
    } finally {
      setIsImageUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {initialLesson ? (
        <>
          <input name="lesson_id" type="hidden" value={initialLesson.id} />
          <input name="lesson_slug" type="hidden" value={initialLesson.slug ?? ""} />
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px_260px]">
        <div className="space-y-2">
          <label className="field-label" htmlFor="title">
            Назва уроку
          </label>
          <input
            className="field-input"
            defaultValue={initialLesson?.title ?? ""}
            id="title"
            name="title"
            placeholder="Наприклад, Теорема Піфагора"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="field-label" htmlFor="subject_id">
            Предмет
          </label>
          <select
            className="field-input"
            id="subject_id"
            name="subject_id"
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            required
            value={selectedSubjectId}
          >
            <option value="">Оберіть предмет</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="field-label" htmlFor="course_id">
            Курс
          </label>
          <select
            className="field-input"
            disabled={!selectedSubjectId || availableCourses.length === 0}
            id="course_id"
            name="course_id"
            onChange={(event) => setSelectedCourseId(event.target.value)}
            value={selectedCourseId}
          >
            <option value="">
              {selectedSubjectId ? "Оберіть курс" : "Спочатку оберіть предмет"}
            </option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-950">Редактор</h2>
            <div className="flex flex-wrap items-center gap-1">
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Жирний текст"
                type="button"
              >
                <Bold className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Курсив"
                type="button"
              >
                <Italic className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                title="Блок коду"
                type="button"
              >
                <Code2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Список"
                type="button"
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                disabled={isImageUploading}
                onClick={() => imageInputRef.current?.click()}
                title="Зображення"
                type="button"
              >
                {isImageUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <input
                ref={imageInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                type="file"
              />
              <button
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-950"
                onClick={() =>
                  insertMarkdown("\nhttps://www.youtube.com/watch?v=ysz5S6PUM-U\n")
                }
                title="YouTube"
                type="button"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <input name="content" type="hidden" value={content} />
          <EditorContent editor={editor} />
          {imageUploadError ? (
            <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
              {imageUploadError}
            </div>
          ) : null}
          {adminHint ? (
            <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
              <p className="font-bold">Підказка для вправ:</p>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-amber-200 bg-white p-3 font-mono text-[11px] text-slate-800">
{`> [!exercise] Назва вправи
> Текст завдання
>
> [!solution] Розв'язок
> Текст розв'язку (буде прихований до кліку)`}
              </pre>
            </div>
          ) : null}
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-950">
              Попередній перегляд
            </h2>
            {isPreviewLoading ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Оновлення
              </span>
            ) : null}
          </div>

          <div className="min-h-[620px] bg-white p-4">
            {previewError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {previewError}
              </div>
            ) : (
              <MarkdownHtml html={previewHtml} />
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{helperText}</p>
        <div className="w-full sm:w-auto">
          <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        </div>
      </div>
    </form>
  );
}
