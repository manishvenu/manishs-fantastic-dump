// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';


import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NetCDFViewer();

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('netcdf.viewer', provider, {
			webviewOptions: { retainContextWhenHidden: true },
			supportsMultipleEditorsPerDocument: false
		})
	);
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
            ncdumpOutput = ncdumpOutput.replace(/(\b\w+\b)(?=\s*\(\w+\)\s*;)/g, '<span class="variable">$1</span>');
			        // Read the HTML file
        const htmlFilePath = "/Users/manishrv/manishs-fantastic-dump/src/NetCDFViewer.html";
        let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

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
						const variableOutput = await runNcdumpVariable(document.uri.fsPath, message.variableName);
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


async function runNcdumpVariable(filePath: string, variableName: string): Promise<string> {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec(`ncdump -v ${variableName} ${filePath}`, (error: any, stdout: string, stderr: string) => {
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
