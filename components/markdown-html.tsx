"use client";

import { useEffect, useRef } from "react";

type MarkdownHtmlProps = {
  html: string;
};

export function MarkdownHtml({ html }: MarkdownHtmlProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const solutions = container.querySelectorAll<HTMLElement>(".callout-solution");

    solutions.forEach((solution) => {
      const content = solution.querySelector<HTMLElement>(".callout-content");
      const title = solution.querySelector<HTMLElement>(".callout-title");

      if (!content || !title) {
        return;
      }

      function setOpen(isOpen: boolean) {
        if (!content || !title) {
          return;
        }

        solution.classList.toggle("is-open", isOpen);
        title.setAttribute("aria-expanded", String(isOpen));

        if (isOpen) {
          content.style.display = "block";
          window.requestAnimationFrame(() => {
            content.style.maxHeight = `${content.scrollHeight}px`;
            content.style.opacity = "1";
          });
          return;
        }

        content.style.maxHeight = "0px";
        content.style.opacity = "0";
      }

      function toggle() {
        setOpen(!solution.classList.contains("is-open"));
      }

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }

      function handleTransitionEnd(event: TransitionEvent) {
        if (
          event.propertyName === "max-height" &&
          !solution.classList.contains("is-open")
        ) {
          content!.style.display = "none";
        }
      }

      content.style.display = "none";
      content.style.maxHeight = "0px";
      content.style.opacity = "0";
      content.style.overflow = "hidden";
      content.style.transition = "max-height 180ms ease, opacity 180ms ease";
      title.style.cursor = "pointer";
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
      title.setAttribute("aria-expanded", "false");

      title.addEventListener("click", toggle);
      title.addEventListener("keydown", handleKeyDown);
      content.addEventListener("transitionend", handleTransitionEnd);

      cleanups.push(() => {
        title.removeEventListener("click", toggle);
        title.removeEventListener("keydown", handleKeyDown);
        content.removeEventListener("transitionend", handleTransitionEnd);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [html]);

  return (
    <article
      className="markdown-body prose"
      dangerouslySetInnerHTML={{ __html: html }}
      ref={containerRef}
    />
  );
}
