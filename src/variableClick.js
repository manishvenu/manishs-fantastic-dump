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

// Replace variable names with spans for highlighting and adding listeners
function recoverVariableClickWorkflow(content) {
    const NC_TYPES = new Set(['byte', 'ubyte', 'char', 'short', 'ushort', 'int', 'uint', 'int64', 'uint64', 'float', 'real', 'double', 'string']);
    content.innerHTML = content.innerHTML.replace(/\b(\w+)\b(?=\()/g, (_, name) =>
        NC_TYPES.has(name) ? name : `<span class="variable">${name}</span>`
    );
    addVariableClickListeners();
}