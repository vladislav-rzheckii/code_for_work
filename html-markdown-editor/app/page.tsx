"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TextAlign } from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

type OutputMode = "html" | "markdown";
type ThemeMode = "light" | "dark";
type LinkPreviewState = {
  isOpen: boolean;
  href: string;
  text: string;
  from: number;
  to: number;
  x: number;
  y: number;
};

const defaultHtml = "<h2>Welcome to HTML/Markdown EDITOR</h2><p>Start typing...</p>";

function formatHtmlReadable(input: string): string {
  if (!input.trim()) {
    return "";
  }

  const withBreaks = input
    .replace(/>\s*</g, ">\n<")
    .replace(/(<\/(p|div|section|article|ul|ol|li|table|thead|tbody|tr|th|td|h1|h2|h3|h4|h5|h6|blockquote)>)/g, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = withBreaks.split("\n").map((line) => line.trim()).filter(Boolean);
  let indentLevel = 0;

  return lines
    .map((line) => {
      if (/^<\//.test(line)) {
        indentLevel = Math.max(indentLevel - 1, 0);
      }

      const formatted = `${"  ".repeat(indentLevel)}${line}`;
      const isOpeningTag = /^<[^/!][^>]*[^/]?>$/.test(line);
      const isSingleLinePair = /^<([a-z0-9-]+)(\s[^>]*)?>.*<\/\1>$/.test(line);

      if (isOpeningTag && !isSingleLinePair) {
        indentLevel += 1;
      }

      return formatted;
    })
    .join("\n");
}

function cleanHtml(input: string): string {
  if (typeof window === "undefined") {
    return input;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll("script, iframe").forEach((node) => node.remove());

  doc.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.removeAttribute("style");
    node.removeAttribute("class");
    node.removeAttribute("id");
    if (node.tagName.toLowerCase() === "span" && node.attributes.length === 0) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  });

  doc.querySelectorAll("*").forEach((node) => {
    const hasElementChildren = node.children.length > 0;
    const text = node.textContent?.trim() ?? "";
    if (!hasElementChildren && text === "" && node.tagName.toLowerCase() !== "br") {
      node.remove();
    }
  });

  return doc.body.innerHTML.trim();
}

function escapeMdTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function parseHtmlTableToMarkdown(tableHtml: string): string {
  if (typeof window === "undefined") {
    return tableHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(tableHtml, "text/html");
  const table = doc.querySelector("table");
  if (!table) {
    return tableHtml;
  }

  const rowElements = Array.from(table.querySelectorAll("tr"));
  if (rowElements.length === 0) {
    return "";
  }

  const matrix = rowElements.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) => escapeMdTableCell(cell.textContent ?? ""))
  );

  const columnCount = Math.max(...matrix.map((row) => row.length));
  if (columnCount === 0) {
    return "";
  }

  const normalized = matrix.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
  const header = normalized[0];
  const bodyRows = normalized.slice(1);
  const divider = Array.from({ length: columnCount }, () => "---");

  const lines = [`| ${header.join(" | ")} |`, `| ${divider.join(" | ")} |`, ...bodyRows.map((row) => `| ${row.join(" | ")} |`)];
  return lines.join("\n");
}

function htmlToMarkdownWithTables(html: string, turndown: TurndownService): string {
  const baseMarkdown = turndown.turndown(html);
  let tableIndex = 0;
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];

  if (tableMatches.length === 0) {
    return baseMarkdown;
  }

  return baseMarkdown.replace(/<table[\s\S]*?<\/table>/gi, () => {
    const sourceTable = tableMatches[tableIndex] ?? "";
    tableIndex += 1;
    return `\n\n${parseHtmlTableToMarkdown(sourceTable)}\n\n`;
  });
}

export default function Home() {
  const [outputMode, setOutputMode] = useState<OutputMode>("html");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [notification, setNotification] = useState("");
  const [liveHtml, setLiveHtml] = useState(defaultHtml);
  const [rightPaneInput, setRightPaneInput] = useState(defaultHtml);
  const [topbarStickyHeight, setTopbarStickyHeight] = useState(66);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewState>({
    isOpen: false,
    href: "",
    text: "",
    from: 0,
    to: 0,
    x: 0,
    y: 0
  });
  const turndown = useMemo(() => {
    const service = new TurndownService({
      headingStyle: "atx"
    });
    service.use(gfm);
    return service;
  }, []);
  const outputModeRef = useRef<OutputMode>(outputMode);
  const topbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    outputModeRef.current = outputMode;
  }, [outputMode]);

  useEffect(() => {
    const topbarNode = topbarRef.current;
    if (!topbarNode) {
      return;
    }

    const updateHeight = () => {
      setTopbarStickyHeight(Math.ceil(topbarNode.getBoundingClientRect().height));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(topbarNode);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow"
        }
      })
    ],
    content: defaultHtml,
    onCreate: ({ editor: instance }) => {
      const html = instance.getHTML();
      setLiveHtml(html);
      setRightPaneInput(outputModeRef.current === "html" ? formatHtmlReadable(html) : htmlToMarkdownWithTables(html, turndown));
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      setLiveHtml(html);
      setRightPaneInput(outputModeRef.current === "html" ? formatHtmlReadable(html) : htmlToMarkdownWithTables(html, turndown));
    },
    editorProps: {
      attributes: {
        class: "editor"
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a");

        if (!anchor) {
          setLinkPreview((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
          return false;
        }

        event.preventDefault();
        const linkMark = view.state.schema.marks.link;
        const range = getMarkRange(view.state.doc.resolve(pos), linkMark);
        if (!range) {
          return true;
        }

        const panelWidth = 360;
        const panelHeight = 230;
        const viewportPadding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let nextX = event.clientX - 180;
        let nextY = event.clientY + 12;

        if (nextX + panelWidth > viewportWidth - viewportPadding) {
          nextX = viewportWidth - panelWidth - viewportPadding;
        }
        if (nextX < viewportPadding) {
          nextX = viewportPadding;
        }

        if (nextY + panelHeight > viewportHeight - viewportPadding) {
          nextY = event.clientY - panelHeight - 12;
        }
        if (nextY < viewportPadding) {
          nextY = viewportPadding;
        }

        setLinkPreview({
          isOpen: true,
          href: anchor.getAttribute("href") ?? "",
          text: anchor.textContent ?? "",
          from: range.from,
          to: range.to,
          x: nextX,
          y: nextY
        });
        return true;
      }
    }
  });

  const currentHtml = liveHtml;
  const currentMarkdown = useMemo(() => htmlToMarkdownWithTables(currentHtml, turndown), [currentHtml, turndown]);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    window.setTimeout(() => setNotification(""), 1800);
  }, []);

  const onCopy = useCallback(async () => {
    if (!rightPaneInput) {
      return;
    }

    await navigator.clipboard.writeText(rightPaneInput);
    showNotification(`Copied ${outputMode.toUpperCase()} to clipboard`);
  }, [outputMode, rightPaneInput, showNotification]);

  const onCleanHtml = useCallback(() => {
    if (!editor) {
      return;
    }

    const cleaned = cleanHtml(editor.getHTML());
    editor.commands.setContent(cleaned || "<p></p>");
    showNotification("HTML cleaned");
  }, [editor, showNotification]);

  const onLoadMarkdown = useCallback(
    async (value: string) => {
      if (!editor) {
        return;
      }
      const rendered = await marked.parse(value);
      editor.commands.setContent(rendered);
    },
    [editor]
  );

  const onLoadSampleMarkdown = useCallback(() => {
    const sample = [
      "# Markdown Demo",
      "",
      "This template shows the main formatting options in one place.",
      "",
      "## Headings",
      "### H3 Example",
      "",
      "## Text styles",
      "- **Bold text**",
      "- *Italic text*",
      "- ~~Strikethrough text~~",
      "- `Inline code`",
      "",
      "## Lists",
      "1. Ordered item one",
      "2. Ordered item two",
      "",
      "- Bullet item one",
      "- Bullet item two",
      "  - Nested bullet item",
      "",
      "## Quote",
      "> This is a blockquote used to highlight an important note.",
      "",
      "## Code block",
      "```html",
      "<section>",
      "  <h2>Sample HTML block</h2>",
      "  <p>Useful for testing code formatting.</p>",
      "</section>",
      "```",
      "",
      "## Table",
      "| Feature | Status |",
      "| --- | --- |",
      "| Headings | Ready |",
      "| Lists | Ready |",
      "| Tables | Ready |",
      "",
      "---",
      "",
      "## Link",
      "[Open project docs](https://www.markdownguide.org/basic-syntax/)"
    ].join("\n");
    void onLoadMarkdown(sample);
    showNotification("Sample Markdown loaded");
  }, [onLoadMarkdown, showNotification]);

  const applyRightPaneChanges = useCallback(async () => {
    if (!editor) {
      return;
    }

    if (outputMode === "html") {
      editor.commands.setContent(rightPaneInput || "<p></p>");
      showNotification("HTML applied to Visual editor");
      return;
    }

    const rendered = await marked.parse(rightPaneInput);
    editor.commands.setContent(rendered || "<p></p>");
    showNotification("Markdown applied to Visual editor");
  }, [editor, outputMode, rightPaneInput, showNotification]);

  const applyBlockFormat = useCallback(
    (value: string) => {
      if (!editor) {
        return;
      }

      if (value === "paragraph") {
        editor.chain().focus().setParagraph().run();
        return;
      }

      if (value.startsWith("h")) {
        const level = Number(value.slice(1));
        if ([1, 2, 3, 4].includes(level)) {
          editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run();
        }
      }
    },
    [editor]
  );

  const applyLink = useCallback(() => {
    if (!editor) {
      return;
    }

    const currentHref = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", currentHref ?? "https://");

    if (url === null) {
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmedUrl }).run();
  }, [editor]);

  const applyLinkPreviewChanges = useCallback(() => {
    if (!editor || !linkPreview.isOpen) {
      return;
    }

    const safeText = linkPreview.text.trim() || linkPreview.href.trim() || "link";
    const safeHref = linkPreview.href.trim();

    editor.chain().focus().setTextSelection({ from: linkPreview.from, to: linkPreview.to }).insertContent(safeText).run();
    const newTo = linkPreview.from + safeText.length;
    editor.chain().focus().setTextSelection({ from: linkPreview.from, to: newTo }).unsetLink().run();

    if (safeHref) {
      editor.chain().focus().setTextSelection({ from: linkPreview.from, to: newTo }).setLink({ href: safeHref }).run();
    }

    setLinkPreview((prev) => ({ ...prev, isOpen: false }));
    showNotification("Link updated");
  }, [editor, linkPreview, showNotification]);

  const copyLinkUrl = useCallback(async () => {
    if (!linkPreview.href.trim()) {
      return;
    }

    await navigator.clipboard.writeText(linkPreview.href.trim());
    showNotification("Link URL copied");
  }, [linkPreview.href, showNotification]);

  const currentFormat = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : editor?.isActive("heading", { level: 4 })
          ? "h4"
          : "paragraph";

  return (
    <main className={`page ${theme}`} style={{ "--topbar-sticky-height": `${topbarStickyHeight}px` } as CSSProperties}>
      <header className="topbar" ref={topbarRef}>
        <h1>HTML - Markdown EDITOR</h1>
        <div className="actions">
          <button
            onClick={() => {
              setOutputMode("html");
              setRightPaneInput(formatHtmlReadable(currentHtml));
            }}
            className={outputMode === "html" ? "active" : ""}
          >
            HTML
          </button>
          <button
            onClick={() => {
              setOutputMode("markdown");
              setRightPaneInput(currentMarkdown);
            }}
            className={outputMode === "markdown" ? "active" : ""}
          >
            Markdown
          </button>
          <button onClick={onCopy}>Copy</button>
          <button onClick={onCleanHtml}>Clean HTML</button>
          <button onClick={onLoadSampleMarkdown}>Load MD sample</button>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label={theme === "light" ? "Enable dark theme" : "Enable light theme"}
          title={theme === "light" ? "Enable dark theme" : "Enable light theme"}
        >
          <span aria-hidden="true">{theme === "light" ? "🌙" : "☀️"}</span>
        </button>
      </header>

      <section className="workspace">
        <div className="left-pane">
          <div className="pane-sticky">
            <div className="editor-panel-header">
              <span className="panel-title">Visual editor</span>
            </div>
            <div className="toolbar compact">
              <select value={currentFormat} onChange={(event) => applyBlockFormat(event.target.value)} aria-label="Format">
                <option value="paragraph">Format</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="paragraph">Paragraph</option>
              </select>
              <button
                className={editor?.isActive("bold") ? "active" : ""}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Bold"
                aria-label="Bold"
              >
                <span className="tool-icon text-bold">B</span>
              </button>
              <button
                className={editor?.isActive("italic") ? "active" : ""}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Italic"
                aria-label="Italic"
              >
                <span className="tool-icon text-italic">I</span>
              </button>
              <button
                className={editor?.isActive("strike") ? "active" : ""}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                title="Strike"
                aria-label="Strike"
              >
                <span className="tool-icon text-strike">S</span>
              </button>
              <button
                className={editor?.isActive("bulletList") ? "active" : ""}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Bullet list"
                aria-label="Bullet list"
              >
                <span className="tool-icon icon-list-bullet" />
              </button>
              <button
                className={editor?.isActive("orderedList") ? "active" : ""}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title="Ordered list"
                aria-label="Ordered list"
              >
                <span className="tool-icon icon-list-ordered" />
              </button>
              <span className="toolbar-divider" aria-hidden="true" />
              <button
                className={editor?.isActive("link") ? "active" : ""}
                onClick={applyLink}
                title="Insert link"
                aria-label="Insert link"
              >
                <span className="tool-icon icon-link" />
              </button>
              <span className="toolbar-divider" aria-hidden="true" />
              <button
                className={`align-btn ${editor?.isActive({ textAlign: "left" }) ? "active" : ""}`}
                onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                title="Align left"
                aria-label="Align left"
              >
                <span className="align-lines left" />
              </button>
              <button
                className={`align-btn ${editor?.isActive({ textAlign: "center" }) ? "active" : ""}`}
                onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                title="Align center"
                aria-label="Align center"
              >
                <span className="align-lines center" />
              </button>
              <button
                className={`align-btn ${editor?.isActive({ textAlign: "right" }) ? "active" : ""}`}
                onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                title="Align right"
                aria-label="Align right"
              >
                <span className="align-lines right" />
              </button>
              <button
                onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="Insert table"
                aria-label="Insert table"
              >
                <span className="tool-icon icon-table" />
              </button>
              <button onClick={() => editor?.chain().focus().addRowAfter().run()} title="Add row" aria-label="Add row">
                <span className="tool-icon icon-add-row" />
              </button>
              <button onClick={() => editor?.chain().focus().addColumnAfter().run()} title="Add column" aria-label="Add column">
                <span className="tool-icon icon-add-col" />
              </button>
              <button onClick={() => editor?.chain().focus().deleteTable().run()} title="Delete table" aria-label="Delete table">
                <span className="tool-icon icon-delete-table" />
              </button>
            </div>
          </div>
          <EditorContent editor={editor} />
        </div>

        <div className="right-pane">
          <div className="pane-sticky">
            <div className="editor-panel-header">
              <span className="panel-title">{outputMode === "html" ? "HTML" : "Markdown"}</span>
            </div>
            <div className="toolbar compact right-toolbar">
              <button onClick={() => void applyRightPaneChanges()}>Apply to Visual</button>
            </div>
          </div>
          <textarea
            className="output-code"
            value={rightPaneInput}
            onChange={(event) => setRightPaneInput(event.target.value)}
            placeholder={`Paste or edit ${outputMode.toUpperCase()} here...`}
          />
        </div>
      </section>
      {linkPreview.isOpen ? (
        <div className="link-preview" style={{ top: linkPreview.y, left: linkPreview.x }}>
          <div className="link-preview-title">Link preview</div>
          <label>
            Anchor text
            <input
              value={linkPreview.text}
              onChange={(event) => setLinkPreview((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="Anchor text"
            />
          </label>
          <label>
            URL
            <input
              value={linkPreview.href}
              onChange={(event) => setLinkPreview((prev) => ({ ...prev, href: event.target.value }))}
              placeholder="https://..."
            />
          </label>
          <div className="link-preview-actions">
            <button onClick={() => void copyLinkUrl()}>Copy URL</button>
            <button onClick={applyLinkPreviewChanges}>Save</button>
            <button onClick={() => setLinkPreview((prev) => ({ ...prev, isOpen: false }))}>Close</button>
          </div>
        </div>
      ) : null}
      {notification ? <div className="toast">{notification}</div> : null}
    </main>
  );
}
