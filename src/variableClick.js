const vscode = acquireVsCodeApi();

function addVariableClickListeners() {
    document.querySelectorAll('.variable').forEach(element => {
        element.addEventListener('click', () => {
            // data-var holds the real (group-qualified) name; the text is the name as ncdump prints it
            const cdlName = element.textContent.trim();
            const variablePath = element.dataset.var || cdlName;
            vscode.postMessage({ command: 'variableClick', variablePath, cdlName });
        });
    });
}

addVariableClickListeners();
