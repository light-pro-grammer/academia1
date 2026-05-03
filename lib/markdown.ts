import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { bundledLanguages, codeToHtml } from "shiki";
import type { Schema } from "hast-util-sanitize";
import { unified } from "unified";
import { visit } from "unist-util-visit";

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      [
        "className",
        "callout",
        "callout-content",
        "callout-danger",
        "callout-example",
        "callout-exercise",
        "callout-info",
        "callout-media",
        "callout-note",
        "callout-question",
        "callout-solution",
        "callout-success",
        "callout-tip",
        "callout-title",
        "callout-warning",
      ],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "src",
      "alt",
      "title",
      "width",
      "height",
    ],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https"],
  },
};

function getYouTubeId(value: string) {
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );

  return match?.[1] ?? null;
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

const calloutOpeningPattern =
  /^\[!(info|warning|danger|success|tip|note|example|question|exercise|solution)\][ \t]*(.*)$/i;
const blockquoteLinePattern = /^> ?(.*)$/;
const blockquoteCalloutLinePattern =
  /^> ?\[!(info|warning|danger|success|tip|note|example|question|exercise|solution)\][ \t]*(.*)$/i;
const mediaUrlPattern =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i;

function normalizeLooseCalloutBlockquotes(markdown: string) {
  const blankLinePattern = /^[ \t]*$/;
  const imageOnlyLinePattern =
    /^[ \t]*(?:!\[[^\]]*\]\([^)]+\)|<img\b[^>]*>)[ \t]*$/i;
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];

  for (let index = 0; index < lines.length; ) {
    if (!blockquoteCalloutLinePattern.test(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const blockLines: string[] = [];
    let cursor = index;

    while (cursor < lines.length) {
      const line = lines[cursor];

      if (blockquoteLinePattern.test(line)) {
        if (blockLines.length > 0 && blockquoteCalloutLinePattern.test(line)) {
          break;
        }

        blockLines.push(line);
        cursor += 1;
        continue;
      }

      if (
        blankLinePattern.test(line) &&
        cursor + 1 < lines.length &&
        (blockquoteLinePattern.test(lines[cursor + 1]) ||
          (blockquoteCalloutLinePattern.test(blockLines[0] ?? "") &&
            imageOnlyLinePattern.test(lines[cursor + 1])))
      ) {
        if (blockquoteCalloutLinePattern.test(lines[cursor + 1])) {
          break;
        }

        blockLines.push(">");
        cursor += 1;
        continue;
      }

      if (
        blockquoteCalloutLinePattern.test(blockLines[0] ?? "") &&
        imageOnlyLinePattern.test(line)
      ) {
        blockLines.push(`> ${line.trim()}`);
        cursor += 1;
        continue;
      }

      break;
    }

    output.push(blockLines.join("\n"));
    index = cursor;
  }

  return output.join("\n");
}

function cloneMarkdownNode(node: MarkdownNode): MarkdownNode {
  const clone: MarkdownNode = { ...node };

  if (node.children) {
    clone.children = node.children.map(cloneMarkdownNode);
  } else {
    delete clone.children;
  }

  if (node.data) {
    clone.data = { ...node.data };
  } else {
    delete clone.data;
  }

  return clone;
}

function splitFirstMarkdownLine(value: string) {
  const match = value.match(/\r?\n/);

  if (!match || typeof match.index !== "number") {
    return {
      firstLine: value,
      rest: null as string | null,
    };
  }

  return {
    firstLine: value.slice(0, match.index),
    rest: value.slice(match.index + match[0].length),
  };
}

function markdownNodeHasMedia(node: MarkdownNode): boolean {
  if (node.type === "image") {
    return true;
  }

  if (node.type === "html" && /<img\b/i.test(node.value ?? "")) {
    return true;
  }

  if (node.type === "text" && mediaUrlPattern.test(node.value ?? "")) {
    return true;
  }

  return (node.children ?? []).some(markdownNodeHasMedia);
}

function getCalloutParts(firstParagraph: MarkdownNode) {
  const children = firstParagraph.children ?? [];
  const firstChild = children[0];

  if (!firstChild || firstChild.type !== "text") {
    return null;
  }

  const { firstLine, rest } = splitFirstMarkdownLine(firstChild.value ?? "");
  const match = firstLine.match(calloutOpeningPattern);

  if (!match) {
    return null;
  }

  const type = match[1].toLowerCase();

  if (!isCalloutType(type)) {
    return null;
  }

  const icon = calloutConfig[type].icon;
  const titleText = match[2] ?? "";
  const titleHasInlineChildren = children.length > 1;
  const title = titleText.trim() || calloutConfig[type].label;
  const titleChildren =
    rest === null
      ? [
          {
            ...firstChild,
            value: `${icon} ${
              titleText.trim() || titleHasInlineChildren ? titleText : title
            }`,
          },
          ...children.slice(1).map(cloneMarkdownNode),
        ]
      : [
          {
            ...firstChild,
            value: `${icon} ${title}`,
          },
        ];
  const contentFirstParagraph =
    rest === null
      ? null
      : ({
          ...firstParagraph,
          children: [
            ...(rest.length > 0 ? [{ ...firstChild, value: rest }] : []),
            ...children.slice(1).map(cloneMarkdownNode),
          ],
          data: firstParagraph.data ? { ...firstParagraph.data } : undefined,
        } satisfies MarkdownNode);

  return {
    contentFirstParagraph:
      contentFirstParagraph && contentFirstParagraph.children?.length
        ? contentFirstParagraph
        : null,
    titleChildren,
    type,
  };
}

function remarkCallouts() {
  return (tree: MarkdownNode) => {
    visit(tree, "blockquote", (node: MarkdownNode) => {
      const firstChild = node.children?.[0];

      if (!firstChild || firstChild.type !== "paragraph") {
        return;
      }

      const calloutParts = getCalloutParts(firstChild);

      if (!calloutParts) {
        return;
      }

      const contentChildren = [
        ...(calloutParts.contentFirstParagraph
          ? [calloutParts.contentFirstParagraph]
          : []),
        ...(node.children ?? []).slice(1).map(cloneMarkdownNode),
      ];
      const hasMedia = contentChildren.some(markdownNodeHasMedia);
      const className = [
        "callout",
        `callout-${calloutParts.type}`,
        hasMedia ? "callout-media" : "",
      ]
        .filter(Boolean)
        .join(" ");

      node.data = {
        ...(node.data ?? {}),
        hName: "div",
        hProperties: { className },
      };
      node.children = [
        {
          type: "paragraph",
          data: {
            hName: "div",
            hProperties: { className: "callout-title" },
          },
          children: calloutParts.titleChildren,
        },
        {
          type: "blockquote",
          data: {
            hName: "div",
            hProperties: { className: "callout-content" },
          },
          children: contentChildren,
        },
      ];
    });
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

function textContent(node: HastNode): string {
  if (node.type === "text") {
    return node.value ?? "";
  }

  return (node.children ?? []).map(textContent).join("");
}

function rehypeYouTubeEmbeds() {
  return (tree: HastNode) => {
    visit(tree, "element", (node: HastNode, index, parent: HastNode) => {
      if (
        node.tagName !== "p" ||
        typeof index !== "number" ||
        !parent?.children?.[index]
      ) {
        return;
      }

      const text = textContent(node).trim();
      const videoId = getYouTubeId(text);

      if (!videoId || text.length > 120) {
        return;
      }

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: "youtube-embed" },
        children: [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              src: `https://www.youtube.com/embed/${videoId}`,
              title: "YouTube video",
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

export async function renderMarkdownToHtml(markdown: string) {
  const decodedMarkdown = decodeMarkdownEntities(markdown);
  const normalizedMarkdown = normalizeLooseTables(
    normalizeLooseCalloutBlockquotes(
      normalizeEscapedCalloutBlockquotes(decodedMarkdown),
    ),
  );
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkCallouts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeYouTubeEmbeds)
    .use(rehypeKatex)
    .use(rehypeShikiCodeBlocks)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(normalizedMarkdown);

  return processed.toString();
}
