import { NextResponse } from "next/server";
import { renderMarkdownToHtml } from "@/lib/markdown";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { markdown?: unknown };
    const markdown =
      typeof body.markdown === "string" ? body.markdown.slice(0, 50000) : "";
    const html = await renderMarkdownToHtml(markdown);

    return NextResponse.json({ html });
  } catch {
    return NextResponse.json(
      { error: "Не вдалося згенерувати попередній перегляд." },
      { status: 400 },
    );
  }
}
