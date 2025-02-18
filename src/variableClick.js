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
    // Replace variable names with clickable spans
    content.innerHTML = content.innerHTML.replace(/(\b\w+\b)(?=\()/g, '<span class="variable">$1</span>');

    // Add click listeners to the variable spans
    addVariableClickListeners();
}