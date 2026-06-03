const vscode = acquireVsCodeApi();

function addVariableClickListeners() {
    document.querySelectorAll('.variable').forEach(element => {
        element.addEventListener('click', () => {
            const variableName = element.textContent.trim();
            vscode.postMessage({ command: 'variableClick', variableName });
        });
    });
}

addVariableClickListeners();
