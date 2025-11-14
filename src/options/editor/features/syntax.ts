import { linter, type Diagnostic } from "@codemirror/lint";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { stylelintConfig, BRACKET_NESTING_LEVELS } from "../core/editor";
import type { BracketStackItem } from "../types";

const stylelint = window.stylelint;

export const cssLinter = linter(async view => {
  const diagnostics: Diagnostic[] = [];
  const code = view.state.doc.toString();

  const getPosition = (line: number, column: number) => {
    const lines = code.split("\n");
    let offset = 0;
    for (let i = 0; i < line - 1; i++) {
      offset += lines[i].length + 1;
    }
    return offset + column - 1;
  };

  try {
    const result = await stylelint.lint({
      code,
      config: stylelintConfig,
    });

    if (result.results && result.results.length > 0) {
      const warnings = result.results[0].warnings;

      warnings.forEach((warning: any) => {
        const from = getPosition(warning.line, warning.column);
        const to = warning.endLine && warning.endColumn ? getPosition(warning.endLine, warning.endColumn) : from + 1;

        const cleanMessage = warning.text.replace(/\s*\([^)]+\)\s*$/, "").trim();

        diagnostics.push({
          from: Math.max(0, from),
          to: Math.max(from + 1, to),
          severity: warning.severity as "error" | "warning",
          message: cleanMessage,
        });
      });
    }
  } catch (error) {
    console.error("[BetterLyrics] Stylelint error:", error);
  }

  return diagnostics;
});

const bracketColors = ["#7186f0", "#56c8d8", "#cf6edf", "#6abf69", "#ffad42", "#ff6e40", "#ff5f52"];

const rainbowBracketsPlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view: EditorView) {
      this.decorations = this.getBracketDecorations(view);
    }

    update(update: any) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.getBracketDecorations(update.view);
      }
    }

    getBracketDecorations(view: EditorView) {
      const { doc } = view.state;
      const decorations = [];
      const stack: BracketStackItem[] = [];
      let inComment = false;

      for (let pos = 0; pos < doc.length; pos += 1) {
        const char = doc.sliceString(pos, pos + 1);
        const nextChar = pos + 1 < doc.length ? doc.sliceString(pos + 1, pos + 2) : "";

        if (!inComment && char === "/" && nextChar === "*") {
          inComment = true;
          pos += 1;
          continue;
        }

        if (inComment && char === "*" && nextChar === "/") {
          inComment = false;
          pos += 1;
          continue;
        }

        if (inComment) {
          continue;
        }

        if (char === "(" || char === "[" || char === "{") {
          stack.push({ type: char, from: pos });
        } else if (char === ")" || char === "]" || char === "}") {
          const open = stack.pop();
          if (open && open.type === this.getMatchingBracket(char)) {
            const level = stack.length % BRACKET_NESTING_LEVELS;
            decorations.push(
              Decoration.mark({ class: `rainbow-bracket-level-${level}` }).range(open.from, open.from + 1),
              Decoration.mark({ class: `rainbow-bracket-level-${level}` }).range(pos, pos + 1)
            );
          }
        }
      }

      decorations.sort((a, b) => a.from - b.from);

      return Decoration.set(decorations);
    }

    getMatchingBracket(closingBracket: ")" | "]" | "}"): string | null {
      switch (closingBracket) {
        case ")":
          return "(";
        case "]":
          return "[";
        case "}":
          return "{";
        default:
          return null;
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

// https://github.com/eriknewland/rainbowbrackets/blob/main/rainbowBrackets.js
// We have modified it to fit our use case
export function rainbowBrackets() {
  const themeStyles: Record<string, { color: string }> = {};

  for (let level = 0; level < BRACKET_NESTING_LEVELS; level++) {
    const color = bracketColors[level % bracketColors.length];
    themeStyles[`.rainbow-bracket-level-${level}`] = { color };
    themeStyles[`.rainbow-bracket-level-${level} > span`] = { color };
  }

  return [rainbowBracketsPlugin, EditorView.baseTheme(themeStyles)];
}
