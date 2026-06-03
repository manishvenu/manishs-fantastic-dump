import * as vscode from 'vscode';
import * as path from 'path';
import { exec, execSync } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NetCDFViewer(context);

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('netcdf.viewer', provider, {
			webviewOptions: { retainContextWhenHidden: true },
			supportsMultipleEditorsPerDocument: false
		})
	);
	let disposable = vscode.commands.registerCommand('extension.openInNcview', async (uri: vscode.Uri) => {
		const filePath = uri.fsPath;

		try {
			// Check if ncview is installed
			execSync("which ncview", { encoding: "utf8" });

			// Open ncview in a VS Code terminal
			const terminal = vscode.window.createTerminal("ncview");
			terminal.show();
			terminal.sendText(`ncview "${filePath}"`);

			// Display a message to the user
		} catch (error) {
			// Handle errors gracefully
			console.error("Error launching ncview:", error);

			vscode.window.showErrorMessage(
				"Failed to launch ncview. Ensure that ncview is installed and properly configured to work in the terminal."
			);
		}
	});

	context.subscriptions.push(disposable);
}

class NetCDFViewer implements vscode.CustomReadonlyEditorProvider {
	private context: vscode.ExtensionContext;
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
		webviewPanel.webview.options = { enableScripts: true };
		const htmlUri = vscode.Uri.joinPath(
			this.context.extensionUri,
			'src',
			'NetCDFViewer.html'
		);

		const searchJsUri = vscode.Uri.joinPath(
			this.context.extensionUri,
			'src',
			'search.js'  // Ensure the correct path to your JavaScript file
		);
		const variableClickJsUri = vscode.Uri.joinPath(
			this.context.extensionUri,
			'src',
			'variableClick.js'  // Ensure the correct path to your JavaScript file
		);
		const cssUri = vscode.Uri.joinPath(
			this.context.extensionUri, // assuming the extension URI
			'src', // adjust to your folder structure
			'style.css' // your CSS file name
		);
		const updateWebview = async () => {
			webviewPanel.webview.html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:1rem;color:var(--vscode-editor-foreground,#ccc);">Loading...</body></html>`;
			let ncdumpOutput = escapeHtml(await runNcdump(document.uri.fsPath));
			const NC_TYPES = new Set(['byte', 'ubyte', 'char', 'short', 'ushort', 'int', 'uint', 'int64', 'uint64', 'float', 'real', 'double', 'string']);
			ncdumpOutput = ncdumpOutput.replace(/\b(\w+)\b(?=\()/g, (_: string, name: string) =>
				NC_TYPES.has(name) ? name : `<span class="variable">${name}</span>`
			);

			let htmlContent = (await vscode.workspace.fs.readFile(htmlUri)).toString();
			const csp = `default-src 'none'; style-src ${webviewPanel.webview.cspSource}; script-src ${webviewPanel.webview.cspSource};`;
			htmlContent = htmlContent.replace('WEBVIEW_CSP_PLACEHOLDER', csp);
			htmlContent = htmlContent.replace('<pre id="content"></pre>', `<pre id="content">${ncdumpOutput}</pre>`);
			htmlContent = htmlContent.replace(
				'<script src="src/search.js"></script>',
				`<script src="${webviewPanel.webview.asWebviewUri(searchJsUri)}"></script>`
			);
			htmlContent = htmlContent.replace(
				'<script src="src/variableClick.js"></script>',
				`<script src="${webviewPanel.webview.asWebviewUri(variableClickJsUri)}"></script>`
			);
			htmlContent = htmlContent.replace(
				'<link rel="stylesheet" href="src/style.css">',
				`<link rel="stylesheet" href="${webviewPanel.webview.asWebviewUri(cssUri)}">`
			);

			webviewPanel.webview.html = htmlContent;
			const fileName = path.basename(document.uri.fsPath);
			vscode.window.setStatusBarMessage(`Loaded: ${fileName}`, 1000);
		};

		// Run ncdump initially
		updateWebview();

		// Watch for file changes
		const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath);
		watcher.onDidChange(() => {
			console.log(`File changed on disk: ${document.uri.fsPath}`);
			updateWebview(); // Refresh the webview content
		});
		watcher.onDidCreate(() => {
			console.log(`File created: ${document.uri.fsPath}`);
			updateWebview();
		});

		watcher.onDidDelete(() => {
			console.log(`File deleted: ${document.uri.fsPath}`);
		});

		webviewPanel.onDidDispose(() => watcher.dispose());
		// Handle messages from the webview
		webviewPanel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'variableClick':
					try {
						const variableOutput = await runNcdumpVariable(document.uri.fsPath, message.variableName);
						await openVariablePanel(this.context.extensionUri, message.variableName, variableOutput);
					} catch (error) {
						console.error('Error handling variable click:', error);
						vscode.window.showErrorMessage(`MFD Error: Failed to load variable "${message.variableName}".`);
					}

					break;
			}
		});
	}

}

// Helper function to run ncdump -h
function runNcdump(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(`ncdump -h "${filePath}"`, (error, stdout, stderr) => {
			if (error) {
				reject(`Error: ${stderr}`);
			} else {
				resolve(stdout);
			}
		});
	});
}


function runNcdumpVariable(filePath: string, variableName: string): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(`ncdump -v "${variableName}" "${filePath}"`, { shell: '/bin/bash' }, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				reject(`Error: ${stderr}`);
			} else {
				resolve(stdout.split('data:')[1]?.trim() || '');
			}
		});
	});
}




const LINES_PER_PAGE = 500;

async function openVariablePanel(extensionUri: vscode.Uri, variableName: string, variableOutput: string): Promise<void> {
	const lines = variableOutput.split('\n');
	const pages: string[] = [];
	for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
		pages.push(escapeHtml(lines.slice(i, i + LINES_PER_PAGE).join('\n')));
	}

	const panel = vscode.window.createWebviewPanel(
		'netcdfVariableViewer',
		`Variable: ${variableName}`,
		vscode.ViewColumn.Beside,
		{ enableScripts: true }
	);

	const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'variableViewer.js'));
	const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'variableViewer.css'));
	const csp = `default-src 'none'; style-src ${panel.webview.cspSource}; script-src ${panel.webview.cspSource};`;
	const safeJson = JSON.stringify(pages).replace(/<\/script>/gi, '<\\/script>');

	const templateUri = vscode.Uri.joinPath(extensionUri, 'src', 'VariableViewer.html');
	let html = (await vscode.workspace.fs.readFile(templateUri)).toString();
	html = html
		.replace('WEBVIEW_CSP_PLACEHOLDER', csp)
		.replace('VARIABLE_NAME_PLACEHOLDER', escapeHtml(variableName))
		.replace('PAGES_JSON_PLACEHOLDER', safeJson)
		.replace('<link rel="stylesheet" href="src/variableViewer.css">', `<link rel="stylesheet" href="${cssUri}">`)
		.replace('<script src="src/variableViewer.js"></script>', `<script src="${jsUri}"></script>`);

	panel.webview.html = html;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// This method is called when your extension is deactivated
export function deactivate() { }
