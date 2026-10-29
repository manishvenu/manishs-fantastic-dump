# Manish's Fantastic Dump — VSCode Extension

A VSCode custom editor that shows NetCDF file metadata inline using the system `ncdump`, with a file summary card, clickable variables with attribute tooltips (opening a paginated data panel), in-page search, live refresh, and optional ncview integration.

## Architecture

The extension registers one `CustomReadonlyEditorProvider` under two view types: `netcdf.viewer` (default for `*.nc`, `*.nc3`, `*.nc4`, `*.netcdf`) and `netcdf.viewer.optional` (`priority: option` for `*.cdf`, `*.h5`, `*.hdf5`, `*.he5`, which other tools also claim). Opening a file runs `ncdump` and renders the output into a webview.

**Key files:**
- [src/extension.ts](src/extension.ts) — VSCode glue: activation, settings, the `NetCDFViewer` provider (render, refresh, messages), the `extension.openInNcview` command, variable panels
- [src/ncdump.ts](src/ncdump.ts) — Everything that doesn't need `vscode`: running `ncdump` (always via `execFile`/`spawn` with argument arrays, never a shell), `renderHeader` (parses CDL, links declarations), `extractVariableData`, summary formatting, escaping, `findExecutable`, `shellQuote`. Keep it free of `vscode` imports so the tests can load it
- [src/NetCDFViewer.html](src/NetCDFViewer.html) — Main webview template
- [src/VariableViewer.html](src/VariableViewer.html) — Variable data panel template
- [src/variableClick.js](src/variableClick.js) — Defines `addVariableClickListeners()`; posts `{ command: 'variableClick', variablePath, cdlName }`. Owns the main view's single `acquireVsCodeApi()` call
- [src/search.js](src/search.js) — Cmd/Ctrl+F plain-text search (marks built with DOM nodes, never `innerHTML` from text) and the `update` message handler for live refresh; must load after `variableClick.js` because it calls `addVariableClickListeners()` after resetting `innerHTML`
- [src/variableViewer.js](src/variableViewer.js) — Pagination (prev/next buttons, arrow and PageUp/PageDown keys)
- [src/style.css](src/style.css), [src/variableViewer.css](src/variableViewer.css) — Styles, dark mode via `prefers-color-scheme`
- [src/test/ncdump.test.ts](src/test/ncdump.test.ts) — Unit tests for parsing, extraction and helpers; [src/test/extension.test.ts](src/test/extension.test.ts) checks activation

**Templating:** HTML templates are read from disk and filled with `String.replace` on exact strings, always with a function as the replacement so `$&`-style patterns in file metadata are inserted literally. `WEBVIEW_CSP_PLACEHOLDER`, `VARIABLE_NAME_PLACEHOLDER` and `PAGES_JSON_PLACEHOLDER` are substituted, and each `src="src/..."` / `href="src/..."` tag is swapped for its `asWebviewUri` equivalent. If you edit a `<script>`/`<link>` tag in a template, update the matching replace in `extension.ts` or the asset silently stops loading. Each webview sets a strict CSP (`default-src 'none'`, scripts and styles only from `cspSource`), so no inline scripts or `style` attributes from the host side.

**Data flow:**
1. `resolveCustomEditor()` shows "Loading...", then runs `ncdump -h`, `ncdump -k` and a file `stat` in parallel
2. `renderHeader()` walks the CDL line by line, tracking `variables:`/`dimensions:` sections and `group: x {` nesting. Only declaration lines in `variables:` sections are linked, as `<span class="variable" data-var="/group/path" title="declaration + attributes">`. Everything else is HTML-escaped
3. A summary card (format, variable count, dimension count, size) is prepended and the page is set as `webview.html`
4. A variable click posts `variablePath` (real, group-qualified name for `ncdump -v`) and `cdlName` (name as printed, with backslash escapes)
5. `runNcdumpVariable()` spawns `ncdump -v <path> <file>`, streams stdout and stops at `MAX_VARIABLE_BYTES` (10 MB). `extractVariableData()` finds the `<cdlName> =` line after the first `data:` line, since ncdump prints a `data:` section in every group
6. `NetCDFViewer.showVariable()` splits it into `LINES_PER_PAGE` (500) line pages and embeds them as JSON. Panels are kept in a map keyed by file + variable and reused on repeat clicks

A `FileSystemWatcher` (a `RelativePattern` so it works outside the workspace) schedules a refresh 300 ms after the last change. After the first successful load, refreshes post `{ command: 'update', summaryHtml, contentHtml }` instead of replacing `webview.html`, so scroll and search survive. A refresh that fails keeps the old content; stale renders are dropped via `renderId`.

**Settings:** `manishsfantasticdump.ncdumpPath` and `manishsfantasticdump.ncviewPath` (both accept `~`), read on every use so changes apply without reloading.

## Build & Run

```bash
npm install            # First time only
npm run compile        # TypeScript → out/
npm run watch          # Incremental compile on save
npm run lint           # ESLint
npm test               # VSCode integration tests (requires display)
npm run package        # Build .vsix for Marketplace upload
```

**Debug:** Open in VSCode → `F5` launches an Extension Development Host.

**Publish:**
```bash
npm version patch --no-git-tag-version   # Bump version in package.json
npm run package                          # Build manishsfantasticdump-<version>.vsix
```
Then upload the `.vsix` by hand at https://marketplace.visualstudio.com/manage (publisher → ⋯ → Update). `vsce publish` is not used: it needs an Azure DevOps PAT, and creating an Azure DevOps organization requires an Azure subscription. Add a `CHANGELOG.md` entry for every release. See [DeployExtension.md](DeployExtension.md).

## Runtime Requirements

These must be on the `PATH` that VSCode itself sees, or set in the settings above. When VSCode is launched from the Dock, that path may not include conda environments.
- `ncdump` — NetCDF-C (`brew install netcdf` / `conda install netcdf4`)
- `ncview` — optional, for the Explorer context menu "Open in Ncview" (`brew install ncview`)

## Known Bugs & Sharp Edges

- **Tests need a display**: `npm test` launches a real VSCode via `@vscode/test-cli`. Running mocha directly fails on Node 26 (an old yargs inside mocha), so there's no quick headless unit-test command yet.
- **Variable names with commas**: `ncdump -v` takes a comma-separated list, so a variable whose name contains a comma can't be opened.
- **Multi-line attribute values**: tooltips only show the first line of an attribute that ncdump wraps over several lines.
- **Case-insensitive search uses `toLowerCase()`**, which can change string length for a few Unicode characters and shift a highlight.

## Repository Layout

```
src/                  Extension source (TypeScript + webview assets)
out/                  Compiled JS (git-ignored, generated by tsc)
.vscode/              Debug launch config, build tasks, recommended extensions
package.json          Extension manifest (viewType, commands, menus, selectors)
tsconfig.json         TypeScript config
CHANGELOG.md          Version history (update every release)
DeployExtension.md    Release steps (build .vsix, upload via Marketplace website)
```
