# Manish's Fantastic Dump — VSCode Extension

A VSCode custom editor that shows NetCDF file metadata inline using the system `ncdump`, with a file summary card, clickable variables (opening a paginated data panel), in-page search, and optional ncview integration.

## Architecture

The extension registers a `CustomReadonlyEditorProvider` (`netcdf.viewer`) for `*.nc` and `*.nc4` files. Opening a file shells out to `ncdump` and renders the output into a webview.

**Key files:**
- [src/extension.ts](src/extension.ts) — Everything host-side: activation, the `NetCDFViewer` provider, the `extension.openInNcview` command, `ncdump` wrappers, the variable panel, summary parsing, `escapeHtml`
- [src/NetCDFViewer.html](src/NetCDFViewer.html) — Main webview template
- [src/VariableViewer.html](src/VariableViewer.html) — Variable data panel template
- [src/variableClick.js](src/variableClick.js) — Defines `addVariableClickListeners()`; posts `variableClick` messages. Owns the single `acquireVsCodeApi()` call
- [src/search.js](src/search.js) — Cmd/Ctrl+F search; must load after `variableClick.js` because it calls `addVariableClickListeners()` after resetting `innerHTML`
- [src/variableViewer.js](src/variableViewer.js) — Pagination (prev/next buttons, arrow and PageUp/PageDown keys)
- [src/style.css](src/style.css), [src/variableViewer.css](src/variableViewer.css) — Styles, dark mode via `prefers-color-scheme`
- [src/test/extension.test.ts](src/test/extension.test.ts) — Still the generator's sample test; nothing real is tested

**Templating:** HTML templates are read from disk and filled with plain `String.replace` on exact strings. `WEBVIEW_CSP_PLACEHOLDER`, `VARIABLE_NAME_PLACEHOLDER` and `PAGES_JSON_PLACEHOLDER` are substituted, and each `src="src/..."` / `href="src/..."` tag is swapped for its `asWebviewUri` equivalent. If you edit a `<script>`/`<link>` tag in a template, update the matching replace in `extension.ts` or the asset silently stops loading. Each webview sets a strict CSP (`default-src 'none'`, scripts and styles only from `cspSource`), so no inline scripts or `style` attributes from the host side.

**Data flow:**
1. `resolveCustomEditor()` shows "Loading...", then runs `ncdump -h`, `ncdump -k` and a file `stat` in parallel
2. Output is HTML-escaped; `word(` patterns that aren't NetCDF type keywords (`NC_TYPES`) are wrapped in `<span class="variable">`
3. A summary card (format, variable count, dimension count, size) is prepended and the page is set as `webview.html`
4. A variable click posts `{ command: 'variableClick', variableName }`
5. `runNcdumpVariable()` spawns `ncdump -v <var> <path>` (no shell), streams stdout and stops at `MAX_VARIABLE_BYTES` (10 MB), keeping only the text after `data:`
6. `openVariablePanel()` splits it into `LINES_PER_PAGE` (500) line pages, escapes each one, and embeds them as JSON in a new side panel

A `FileSystemWatcher` re-runs the whole render on `onDidChange` / `onDidCreate`.

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

These must be on the `PATH` that VSCode itself sees. When VSCode is launched from the Dock, that path may not include conda environments.
- `ncdump` — NetCDF-C (`brew install netcdf` / `conda install netcdf4`)
- `ncview` — optional, for the Explorer context menu "Open in Ncview" (`brew install ncview`)

## Known Bugs & Sharp Edges

- **Shell strings for `ncdump -h` / `-k`**: `runNcdump` and `runNcdumpKind` use `exec` with the path in double quotes. A filename containing `"`, `$` or a backtick breaks out of the quotes. Use `execFile`/`spawn` with an argument array, as `runNcdumpVariable` does. The ncview command's `terminal.sendText` has the same problem.
- **Search re-injects unescaped text**: `search.js` sets `wrapper.innerHTML` from `node.textContent`, which has already decoded `&lt;`/`&gt;`. A match in metadata containing `<` is parsed as markup. The query is also used as a raw regex, so `.` or `(` behave unexpectedly.
- **`data:` split is fragile**: `runNcdumpVariable` takes the text after the first `data:`. An attribute value containing `data:` returns the wrong slice.
- **Variable regex**: `\b(\w+)\b(?=\()` also matches `word(` inside attribute strings and misses names with characters outside `\w`. Variables inside NetCDF-4 groups need a group path for `ncdump -v`.
- **Watcher**: no debounce, so a file being written can trigger several overlapping renders. Each render resets the page to "Loading...", losing scroll position and search state.
- **ncview check**: uses `which`, which doesn't exist on Windows.
- **Each variable click opens a new panel**: panels aren't reused per variable.

## Repository Layout

```
src/                  Extension source (TypeScript + webview assets)
out/                  Compiled JS (git-ignored, generated by tsc)
.vscode/              Debug launch config, build tasks, recommended extensions
package.json          Extension manifest (viewType, commands, menus, selectors)
tsconfig.json         TypeScript config
CHANGELOG.md          Version history (update every release)
DeployExtension.md    Release steps (build .vsix, upload via Marketplace website)
vsc-extension-quickstart.md   Generator boilerplate, safe to delete
```
