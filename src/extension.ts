// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';



import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NetCDFViewer();

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('netcdf.viewer', provider, {
			webviewOptions: { retainContextWhenHidden: true },
			supportsMultipleEditorsPerDocument: false,
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
			const ncdumpOutput = await runNcdump(document.uri.fsPath);
			webviewPanel.webview.html = `<pre>${ncdumpOutput}</pre>`;
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

// This method is called when your extension is deactivated
export function deactivate() { }
