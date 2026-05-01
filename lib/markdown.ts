import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { bundledLanguages, codeToHtml } from "shiki";
import { unified } from "unified";
import { visit } from "unist-util-visit";

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
};

const calloutConfig = {
  danger: {
    icon: "🚨",
    label: "Danger",
  },
  example: {
    icon: "📝",
    label: "Example",
  },
  exercise: {
    icon: "❓",
    label: "Exercise",
  },
  info: {
    icon: "ℹ️",
    label: "Info",
  },
  note: {
    icon: "📝",
    label: "Note",
  },
  question: {
    icon: "❓",
    label: "Question",
  },
  solution: {
    icon: "✓",
    label: "Solution",
  },
  success: {
    icon: "✅",
    label: "Success",
  },
  tip: {
    icon: "💡",
    label: "Tip",
  },
  warning: {
    icon: "⚠️",
    label: "Warning",
  },
} as const;

type CalloutType = keyof typeof calloutConfig;

type CalloutTitleToken = {
  markdown: string;
  token: string;
};

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: {
    className?: string | string[];
    [key: string]: unknown;
  };
  children?: HastNode[];
};

function getYouTubeId(value: string) {
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );

  return match?.[1] ?? null;
}

function paragraphText(node: MarkdownNode) {
  return (node.children ?? [])
    .map((child) => {
      if (child.type === "link" && child.url) {
        return child.url;
      }

      return child.value ?? "";
    })
    .join("")
    .trim();
}

function isCalloutType(value: string): value is CalloutType {
  return value in calloutConfig;
}

const escapedCalloutBlockquotePattern =
  /^(?:\\?>|&gt;)[ \t]+\\?\[!(info|warning|danger|success|tip|note|example|question|exercise|solution)\\?\]/i;

function normalizeEscapedCalloutBlockquotes(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const normalized: string[] = [];
  let insideEscapedCallout = false;

  for (const line of lines) {
    const isCalloutStart = escapedCalloutBlockquotePattern.test(line);
    const isBlockquoteLine = /^(?:\\?>|&gt;)/.test(line);
    const isBlankLine = line.trim() === "";

    if (isCalloutStart) {
      insideEscapedCallout = true;
    } else if (insideEscapedCallout && !isBlockquoteLine && !isBlankLine) {
      insideEscapedCallout = false;
    }

    if (insideEscapedCallout && isBlockquoteLine) {
      normalized.push(
        line
          .replace(/^\\>/, ">")
          .replace(/^&gt;/, ">")
          .replace(/\\\[/g, "[")
          .replace(/\\\]/g, "]"),
      );
    } else {
      normalized.push(line);
    }
  }

  return normalized.join("\n");
}

function decodeMarkdownEntities(markdown: string) {
  const entityPattern = /&(#\d+|#x[\da-fA-F]+|lt|gt|amp|quot|apos|nbsp);/g;
  let decoded = markdown;

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(entityPattern, (entity, value: string) => {
      const normalized = value.toLowerCase();

      if (normalized === "lt") {
        return "<";
      }

      if (normalized === "gt") {
        return ">";
      }

      if (normalized === "amp") {
        return "&";
      }

      if (normalized === "quot") {
        return '"';
      }

      if (normalized === "apos") {
        return "'";
      }

      if (normalized === "nbsp") {
        return "\u00a0";
      }

      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);

      if (!Number.isFinite(codePoint)) {
        return entity;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    });

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  return decoded;
}

function preprocessCallouts(markdown: string) {
  const calloutLinePattern =
    /^> \[!(info|warning|danger|success|tip|note|example|question|exercise|solution)\][ \t]*(.*)$/i;
  const blockquoteLinePattern = /^> ?(.*)$/;
  const blankLinePattern = /^[ \t]*$/;
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  const titleTokens: CalloutTitleToken[] = [];

  for (let index = 0; index < lines.length; ) {
    if (!blockquoteLinePattern.test(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const blockLines: string[] = [];
    let cursor = index;

    while (cursor < lines.length) {
      const line = lines[cursor];

      if (blockquoteLinePattern.test(line)) {
        if (blockLines.length > 0 && calloutLinePattern.test(line)) {
          break;
        }

        blockLines.push(line);
        cursor += 1;
        continue;
      }

      if (
        blankLinePattern.test(line) &&
        cursor + 1 < lines.length &&
        blockquoteLinePattern.test(lines[cursor + 1])
      ) {
        if (calloutLinePattern.test(lines[cursor + 1])) {
          break;
        }

        blockLines.push(">");
        cursor += 1;
        continue;
      }

      break;
    }

    const block = blockLines.join("\n");
    const firstLine = blockLines[0] ?? "";
    const match = firstLine.match(calloutLinePattern);

    if (!match) {
      output.push(block);
      index = cursor;
      continue;
    }

    const type = match[1].toLowerCase();

    if (!isCalloutType(type)) {
      output.push(block);
      index = cursor;
      continue;
    }

    const title = match[2].trim() || calloutConfig[type].label;
    const content = blockLines
      .slice(1)
      .map((line) => {
        if (blankLinePattern.test(line)) {
          return "";
        }

        return line.replace(blockquoteLinePattern, "$1");
      })
      .join("\n");
    const icon = calloutConfig[type].icon;
    const titleToken = `__CALLOUT_TITLE_${titleTokens.length}__`;
    titleTokens.push({
      markdown: `${icon} ${title}`,
      token: titleToken,
    });

    output.push(
      [
        `<div class="callout callout-${type}">`,
        `<div class="callout-title">${titleToken}</div>`,
        `<div class="callout-content">`,
        "",
        content,
        "",
        "</div>",
        "</div>",
      ].join("\n"),
    );
    index = cursor;
  }

  return {
    markdown: output.join("\n"),
    titleTokens,
  };
}

function isMarkdownTableRow(line: string) {
  const trimmed = line.trim();

  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function normalizeLooseTables(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const normalized: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previousLine = normalized.at(-1) ?? "";
    const nextLine = lines[index + 1] ?? "";

    if (
      line.trim() === "" &&
      isMarkdownTableRow(previousLine) &&
      isMarkdownTableRow(nextLine)
    ) {
      continue;
    }

    normalized.push(line);
  }

  return normalized.join("\n");
}

function remarkYouTubeEmbeds() {
  return (tree: MarkdownNode) => {
    visit(tree, "paragraph", (node: MarkdownNode) => {
      const text = paragraphText(node);
      const videoId = getYouTubeId(text);

      if (!videoId || text.length > 120) {
        return;
      }

      node.children = [];
      node.data = {
        hName: "div",
        hProperties: { className: "youtube-embed" },
        hChildren: [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src: `https://www.youtube.com/embed/${videoId}`,
              title: "Відео YouTube",
              loading: "lazy",
              allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
              allowFullScreen: true,
            },
            children: [],
          },
        ],
      };
    });
  };
}

function textContent(node: HastNode): string {
  if (node.type === "text") {
    return node.value ?? "";
  }

  return (node.children ?? []).map(textContent).join("");
}

function getCodeLanguage(codeNode: HastNode) {
  const className = codeNode.properties?.className;
  const classes = Array.isArray(className)
    ? className
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  const languageClass = classes.find((name) => name.startsWith("language-"));

  return languageClass?.replace("language-", "") || "text";
}

async function highlightCode(code: string, language: string) {
  const lang = language in bundledLanguages ? language : "text";

  return codeToHtml(code, {
    lang,
    theme: "github-light",
  });
}

function rehypeShikiCodeBlocks() {
  return async (tree: HastNode) => {
    const tasks: Promise<void>[] = [];

    visit(tree, "element", (node: HastNode, index, parent: HastNode) => {
      if (
        node.tagName !== "pre" ||
        typeof index !== "number" ||
        !parent?.children?.[index]
      ) {
        return;
      }

      const codeNode = node.children?.find(
        (child) => child.type === "element" && child.tagName === "code",
      );

      if (!codeNode) {
        return;
      }

      tasks.push(
        highlightCode(textContent(codeNode), getCodeLanguage(codeNode)).then(
          (html) => {
            parent.children![index] = {
              type: "raw",
              value: html,
            };
          },
        ),
      );
    });

    await Promise.all(tasks);
  };
}

async function renderInlineMarkdownToHtml(markdown: string) {
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  const html = processed.toString().trim();
  const paragraphMatch = html.match(/^<p>([\s\S]*)<\/p>$/);

  return paragraphMatch?.[1] ?? html;
}

export async function renderMarkdownToHtml(markdown: string) {
  const decodedMarkdown = decodeMarkdownEntities(markdown);
  const preprocessedCallouts = preprocessCallouts(
    normalizeEscapedCalloutBlockquotes(decodedMarkdown),
  );
  const normalizedMarkdown = normalizeLooseTables(
    preprocessedCallouts.markdown,
  );
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkYouTubeEmbeds)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeShikiCodeBlocks)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(normalizedMarkdown);

  let html = processed.toString();

  for (const titleToken of preprocessedCallouts.titleTokens) {
    const renderedTitle = await renderInlineMarkdownToHtml(titleToken.markdown);
    html = html.split(titleToken.token).join(renderedTitle);
  }

  return html;
}
