import { renderMarkdownToHtml } from "@/lib/markdown";
import { MarkdownHtml } from "@/components/markdown-html";

type MarkdownRendererProps = {
  content: string;
};

export async function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = await renderMarkdownToHtml(content);

  return <MarkdownHtml html={html} />;
}
