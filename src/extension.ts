// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';


import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NetCDFViewer();

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
			child_process.execSync("which ncview", { encoding: "utf8" });

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

		const updateWebview = async () => {
			let ncdumpOutput = await runNcdump(document.uri.fsPath);
			// Wrap variable names in spans with the class 'variable'
			ncdumpOutput = ncdumpOutput.replace(/(\b\w+\b)(?=\()/g, '<span class="variable">$1</span>');
			// Read the HTML file

			//const htmlFilePath = path.join(__dirname, '..', 'src', 'NetCDFViewer.html');
			//let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
			let htmlContent = `<!DOCTYPE html>
								<html lang="en">

								<head>
									<meta charset="UTF-8">
									<meta name="viewport" content="width=device-width, initial-scale=1.0">
									<title>NetCDF Viewer</title>
									<style>
										pre {
											white-space: pre-wrap;
										}

										.variable {
											cursor: pointer;
											color: #007acc;
											/* Text color */
											text-decoration: underline;
											/* Underline text to resemble a link */
											background-color: transparent;
											/* No background color */
											border-radius: 0;
											/* No border radius */
											padding: 0;
											/* No padding */
											font-size: inherit;
											/* Inherit font size from parent */
										}
									</style>
								</head>

								<body>
									<pre id="content"></pre>
									<script>
										const vscode = acquireVsCodeApi();


										function addVariableClickListeners() {
											document.querySelectorAll('.variable').forEach(element => {
												element.addEventListener('click', (event) => {
													const variableName = event.target.textContent.trim();
													vscode.postMessage({ command: 'variableClick', variableName });
												});
											});
										}

										addVariableClickListeners(); // Initial attachment of event listeners
									</script>
								</body>

								</html>`;
			// Replace the placeholder with the actual content
			htmlContent = htmlContent.replace('<pre id="content"></pre>', `<pre id="content">${ncdumpOutput}</pre>`);

			webviewPanel.webview.html = htmlContent;
			// Get the file name from the document URI without the full path
			const fileName = path.basename(document.uri.fsPath); // This gives you just the file name
			const statusBarMessage = vscode.window.setStatusBarMessage(`Loaded: ${fileName}`, 1000); // Show for 2 seconds
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
	const { exec } = require('child_process');
	return new Promise((resolve, reject) => {
		// Adjust the command to include piping correctly
		const baseCommand = `ncdump -v ${variableName} ${filePath}`;
		const bigFileBaseCommand = `ncdump -v ${variableName} ${filePath} | head -n 500`;
		// const command = limitOutput ? `${baseCommand} | head -n 100` : baseCommand;
		const command = limitOutput ? bigFileBaseCommand : baseCommand;

		exec(command, { shell: '/bin/bash' }, (error: any, stdout: string, stderr: string) => {
			if (error) {
				reject(`Error: ${stderr}`);
			} else {
				const dataSection = stdout.split('data:')[1]?.trim() || '';
				resolve(dataSection);
			}
		});
	});
}




// This method is called when your extension is deactivated
export function deactivate() { }
