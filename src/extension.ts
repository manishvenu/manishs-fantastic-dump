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
						const variableOutput = await runNcdumpVariable(document.uri.fsPath, message.variableName, false);
						const newPanel = vscode.window.createWebviewPanel(
							'netcdfVariableViewer',
							`Variable: ${message.variableName}`,
							vscode.ViewColumn.Beside,
							{ enableScripts: true }
						);
						newPanel.webview.html = `
								<!DOCTYPE html>
								<html lang="en">
								<head>
									<meta charset="UTF-8">
									<meta name="viewport" content="width=device-width, initial-scale=1.0">
									<title>Variable: ${message.variableName}</title>
									<style>
										pre { white-space: pre-wrap; }
									</style>
								</head>
								<body>
									<pre>${variableOutput}</pre>
								</body>
								</html>
							`;
					} catch (error) {
						try {
							vscode.window.showWarningMessage(`MFD Warning: Large Variable -> Only ~500 lines loaded!`);
							const variableOutput = await runNcdumpVariable(document.uri.fsPath, message.variableName, true);
							const newPanel = vscode.window.createWebviewPanel(
								'netcdfVariableViewer',
								`Variable: ${message.variableName}`,
								vscode.ViewColumn.Beside,
								{ enableScripts: true }
							);
							newPanel.webview.html = `
									<!DOCTYPE html>
									<html lang="en">
									<head>
										<meta charset="UTF-8">
										<meta name="viewport" content="width=device-width, initial-scale=1.0">
										<title>Variable: ${message.variableName}</title>
										<style>
											pre { white-space: pre-wrap; }
										</style>
									</head>
									<body>
										<pre>${variableOutput}</pre>
									</body>
									</html>
								`;
						} catch (error) {
							console.error('Error handling variable click:', error);
							vscode.window.showErrorMessage(`MFD Error: Too slow to load!`);
							webviewPanel.webview.postMessage({ command: 'showError', message: 'The variable output is too large to load.' });
						}
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


async function runNcdumpVariable(
	filePath: string,
	variableName: string,
	limitOutput: boolean = false
): Promise<string> {
	return new Promise((resolve, reject) => {
		const baseCommand = `ncdump -v "${variableName}" "${filePath}"`;
		const bigFileBaseCommand = `ncdump -v "${variableName}" "${filePath}" | head -n 500`;
		const command = limitOutput ? bigFileBaseCommand : baseCommand;

		exec(command, { shell: '/bin/bash' }, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				reject(`Error: ${stderr}`);
			} else {
				const dataSection = stdout.split('data:')[1]?.trim() || '';
				resolve(dataSection);
			}
		});
	});
}




function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// This method is called when your extension is deactivated
export function deactivate() { }
