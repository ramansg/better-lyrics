# Contributing to Better Lyrics

Thanks for your interest in contributing! This guide covers both code and translation contributions.

## Issue-First Policy

**Open an issue before submitting a PR.** Discuss proposed changes first to ensure alignment with project direction. PRs without prior discussion may be closed.

Exception: Typo fixes and small documentation updates can be submitted directly.

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Getting Started

```bash
git clone https://github.com/better-lyrics/better-lyrics.git
cd better-lyrics
npm install
npm run build
```

For loading the extension in your browser, see [Manual Installation](README.md#manual-installation) in the README.

### Development Commands

```bash
npm run dev      # Watch mode with hot reload
npm run build    # Production build
npm run lint     # Run ESLint
npm run format   # Format with Prettier
```

## Code Guidelines

### Imports

- Use path aliases: `@core/*`, `@constants`, `@utils`, `@modules/*`
- Named imports only: `import { foo } from "module"` (no `import * as`)
- Never import from `@/index` (causes content script execution in wrong context)

### DOM & Security

- Never use `innerHTML` - use `createElement`, `textContent`, `replaceChildren`
- No empty catch blocks - always log errors with context

### Error Logging

- Content scripts: Use `log()` from `@utils` with constants from `@constants`
- Options/extension pages: Use `console.error()` with log prefix constants

### Style

- No inline comments unless essential
- Section dividers format: `// -- Section Name --------------------------`

## Pull Request Process

1. Open an issue first (unless trivial fix)
2. Fork and create a feature branch
3. Follow code guidelines above
4. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Ensure builds pass (`npm run build`)

### Review Expectations

- PRs are reviewed for code quality, security, and alignment with project patterns
- Be prepared for feedback and iteration
- Large changes may require multiple rounds of review

## Translation Guide

Better Lyrics uses Chrome's native i18n system. All strings are in `_locales/`.

### Adding a New Language

1. Create folder: `_locales/<language-code>/messages.json`
   - Use [BCP 47 language tags](https://en.wikipedia.org/wiki/IETF_language_tag) (e.g., `fr`, `de`, `ja`, `zh_CN`)

2. Copy from English: `cp _locales/en/messages.json _locales/<code>/messages.json`

3. Translate the `"message"` values (keep keys and `"description"` in English)

```json
{
  "extensionName": {
    "message": "Better Lyrics (Paroles pour YouTube Music)",
    "description": "The name of the extension"
  }
}
```

4. Test locally by loading the extension and changing browser language

### Updating Existing Translations

- Check for missing keys by comparing with `_locales/en/messages.json`
- Keep translations concise - UI space is limited

### Key Naming Convention

Keys follow `<area>_<component>_<element>` pattern:
- `options_tab_general` - Options page, tab, general
- `marketplace_install` - Marketplace, install button
- `lyrics_source` - Lyrics display, source label

## Questions?

- Open a [discussion](https://github.com/better-lyrics/better-lyrics/discussions)
- Join our [Discord](https://discord.gg/UsHE3d5fWF)
