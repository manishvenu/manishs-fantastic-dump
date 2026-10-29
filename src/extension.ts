import * as vscode from 'vscode';
import * as path from 'path';
import {
	buildSummaryHtml, escapeHtml, findExecutable, renderHeader,
	runNcdump, runNcdumpKind, runNcdumpVariable, shellQuote
} from './ncdump';

const CONFIG_SECTION = 'manishsfantasticdump';
// Files being written fire several change events in a row, so wait for them to settle before re-running ncdump
const REFRESH_DELAY_MS = 300;
const LINES_PER_PAGE = 500;

function getSetting(key: 'ncdumpPath' | 'ncviewPath', fallback: string): string {
	return vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>(key)?.trim() || fallback;
}

export function activate(context: vscode.ExtensionContext) {
	const provider = new NetCDFViewer(context);

	for (const viewType of ['netcdf.viewer', 'netcdf.viewer.optional']) {
		context.subscriptions.push(
			vscode.window.registerCustomEditorProvider(viewType, provider, {
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: false
			})
		);
	}

	context.subscriptions.push(vscode.commands.registerCommand('extension.openInNcview', (uri: vscode.Uri) => {
		const ncview = getSetting('ncviewPath', 'ncview');
		const resolved = findExecutable(ncview);
		if (!resolved) {
			vscode.window.showErrorMessage(
				`Couldn't find ncview (looked for "${ncview}"). Install it or set "${CONFIG_SECTION}.ncviewPath" to its full path.`
			);
			return;
		}
		// Run it in a terminal so ncview's own errors (e.g. no X display) stay visible
		const terminal = vscode.window.createTerminal('ncview');
		terminal.show();
		terminal.sendText(`${shellQuote(resolved)} ${shellQuote(uri.fsPath)}`);
	}));
}

class NetCDFViewer implements vscode.CustomReadonlyEditorProvider {
	private context: vscode.ExtensionContext;
	// One panel per variable, so clicking the same variable again reuses its panel
	private variablePanels = new Map<string, vscode.WebviewPanel>();

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken
	): Promise<vscode.CustomDocument> {
		return { uri, dispose: () => { } };
	}

	async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		const srcUri = vscode.Uri.joinPath(this.context.extensionUri, 'src');
		const webview = webviewPanel.webview;
		webview.options = { enableScripts: true, localResourceRoots: [srcUri] };

		const filePath = document.uri.fsPath;
		const fileName = path.basename(filePath);
		let loaded = false;
		let renderId = 0;

		const updateWebview = async () => {
			const id = ++renderId;
			if (!loaded) {
				webview.html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:1rem;color:var(--vscode-editor-foreground,#ccc);">Loading...</body></html>`;
			}
			const ncdump = getSetting('ncdumpPath', 'ncdump');
			let rawOutput: string;
			let stat: vscode.FileStat;
			let kind: string;
			try {
				[rawOutput, stat, kind] = await Promise.all([
					runNcdump(ncdump, filePath),
					vscode.workspace.fs.stat(document.uri),
					runNcdumpKind(ncdump, filePath).catch(() => '')
				]);
			} catch (err) {
				if (id !== renderId) { return; }
				const msg = err instanceof Error ? err.message : String(err);
				if (loaded) {
					// Keep showing the last good output; the file is probably mid-write
					vscode.window.setStatusBarMessage(`MFD: couldn't refresh ${fileName}: ${msg}`, 5000);
					return;
				}
				webview.html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:1rem;">
<span style="color:var(--vscode-errorForeground,#f48771);font-weight:bold;">Failed to load file</span><br><br>
<code>${escapeHtml(msg)}</code><br><br>
Make sure <code>ncdump</code> is installed, or set <code>${CONFIG_SECTION}.ncdumpPath</code> in your settings.
</body></html>`;
				return;
			}
			if (id !== renderId) { return; }

			const header = renderHeader(rawOutput);
			const summaryHtml = buildSummaryHtml(header.variables.length, header.dimensions, stat.size, kind);

			if (loaded) {
				// Swap the content in place so scroll position and the search bar survive
				webview.postMessage({ command: 'update', summaryHtml, contentHtml: header.html });
				return;
			}

			const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(srcUri, name)).toString();
			const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};`;
			const template = (await vscode.workspace.fs.readFile(vscode.Uri.joinPath(srcUri, 'NetCDFViewer.html'))).toString();
			// Function replacements, so "$&" and friends in file metadata are inserted literally
			webview.html = template
				.replace('WEBVIEW_CSP_PLACEHOLDER', () => csp)
				.replace('<pre id="content"></pre>', () => `${summaryHtml}<pre id="content">${header.html}</pre>`)
				.replace('<script src="src/search.js"></script>', () => `<script src="${asset('search.js')}"></script>`)
				.replace('<script src="src/variableClick.js"></script>', () => `<script src="${asset('variableClick.js')}"></script>`)
				.replace('<link rel="stylesheet" href="src/style.css">', () => `<link rel="stylesheet" href="${asset('style.css')}">`);
			loaded = true;
			vscode.window.setStatusBarMessage(`Loaded: ${fileName}`, 1000);
		};

		updateWebview();

		let refreshTimer: NodeJS.Timeout | undefined;
		const scheduleRefresh = () => {
			if (refreshTimer) { clearTimeout(refreshTimer); }
			refreshTimer = setTimeout(updateWebview, REFRESH_DELAY_MS);
		};
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(filePath), fileName));
		watcher.onDidChange(scheduleRefresh);
		watcher.onDidCreate(scheduleRefresh);

		webviewPanel.onDidDispose(() => {
			if (refreshTimer) { clearTimeout(refreshTimer); }
			watcher.dispose();
		});

		webview.onDidReceiveMessage(async message => {
			if (message.command !== 'variableClick') { return; }
			const { variablePath, cdlName } = message as { variablePath: string; cdlName: string };
			try {
				const output = await runNcdumpVariable(getSetting('ncdumpPath', 'ncdump'), filePath, variablePath, cdlName);
				await this.showVariable(document.uri, variablePath, output);
			} catch (error) {
				console.error('Error handling variable click:', error);
				const msg = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`MFD Error: Failed to load variable "${variablePath}". ${msg}`);
			}
		});
	}

	private async showVariable(fileUri: vscode.Uri, variablePath: string, variableOutput: string): Promise<void> {
		const key = `${fileUri.toString()}::${variablePath}`;
		const srcUri = vscode.Uri.joinPath(this.context.extensionUri, 'src');
		let panel = this.variablePanels.get(key);
		if (panel) {
			panel.reveal(vscode.ViewColumn.Beside);
		} else {
			panel = vscode.window.createWebviewPanel(
				'netcdfVariableViewer',
				`Variable: ${variablePath}`,
				vscode.ViewColumn.Beside,
				{ enableScripts: true, localResourceRoots: [srcUri] }
			);
			this.variablePanels.set(key, panel);
			panel.onDidDispose(() => this.variablePanels.delete(key));
			panel.webview.onDidReceiveMessage(async message => {
				if (message.command === 'copy') {
					await vscode.env.clipboard.writeText(message.text);
					vscode.window.setStatusBarMessage(`Copied "${message.text}"`, 2000);
				}
			});
		}

		const lines = variableOutput.split('\n');
		const pages: string[] = [];
		for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
			pages.push(escapeHtml(lines.slice(i, i + LINES_PER_PAGE).join('\n')));
		}

		const webview = panel.webview;
		const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(srcUri, name)).toString();
		const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};`;
		const safeJson = JSON.stringify(pages).replace(/<\/script>/gi, '<\\/script>');
		const template = (await vscode.workspace.fs.readFile(vscode.Uri.joinPath(srcUri, 'VariableViewer.html'))).toString();
		webview.html = template
			.replace('WEBVIEW_CSP_PLACEHOLDER', () => csp)
			.replace(/VARIABLE_NAME_PLACEHOLDER/g, () => escapeHtml(variablePath))
			.replace('PAGES_JSON_PLACEHOLDER', () => safeJson)
			.replace('<link rel="stylesheet" href="src/variableViewer.css">', () => `<link rel="stylesheet" href="${asset('variableViewer.css')}">`)
			.replace('<script src="src/variableViewer.js"></script>', () => `<script src="${asset('variableViewer.js')}"></script>`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
