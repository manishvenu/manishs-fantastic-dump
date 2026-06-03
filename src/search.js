// search.js

document.getElementById('search-bar').style.display = 'none';

const _contentEl = document.getElementById('content');
const _originalInnerHTML = _contentEl.innerHTML;

let currentIndex = 0;
let matches = [];

function _highlightTextNodes(node, regex) {
    if (node.nodeType === Node.TEXT_NODE) {
        regex.lastIndex = 0;
        if (regex.test(node.textContent)) {
            regex.lastIndex = 0;
            const wrapper = document.createElement('span');
            wrapper.innerHTML = node.textContent.replace(regex, m => `<mark class="highlight">${m}</mark>`);
            node.parentNode.replaceChild(wrapper, node);
        }
    } else {
        Array.from(node.childNodes).forEach(child => _highlightTextNodes(child, regex));
    }
}

function highlightMatches(query) {
    const content = document.getElementById('content');
    content.innerHTML = _originalInnerHTML;
    addVariableClickListeners();
    let regex;
    try { regex = new RegExp(query, 'gi'); } catch { return; }
    _highlightTextNodes(content, regex);

    matches = Array.from(document.querySelectorAll('.highlight'));
    currentIndex = 0;

    if (matches.length) {
        scrollToMatch();
    }
}

function scrollToMatch() {
    if (matches.length) {
        matches.forEach((el) => el.classList.remove('current-highlight'));
        const currentMatch = matches[currentIndex];
        currentMatch.classList.add('current-highlight');
        currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearHighlights() {
    const content = document.getElementById('content');
    content.innerHTML = _originalInnerHTML;
    addVariableClickListeners();
    matches = [];
}

document.getElementById('next-btn').addEventListener('click', () => {
    if (matches.length) {
        currentIndex = (currentIndex + 1) % matches.length;
        scrollToMatch();
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    if (matches.length) {
        currentIndex = (currentIndex - 1 + matches.length) % matches.length;
        scrollToMatch();
    }
});

document.getElementById('close-btn').addEventListener('click', () => {
    document.getElementById('search-bar').style.display = 'none';
    clearHighlights();
});

document.getElementById('search-input').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query) {
        highlightMatches(query);
    } else {
        clearHighlights();
    }
});

window.addEventListener('keydown', (e) => {
    // Check for Ctrl (Windows/Linux) or Command (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('search-bar').style.display = 'block';
        document.getElementById('search-input').focus();
    }

    // Add Enter key listener to go to the next match
    if (e.key === 'Enter' && document.getElementById('search-input').value.trim()) {
        if (matches.length) {
            currentIndex = (currentIndex + 1) % matches.length;
            scrollToMatch();
        }
    }
});

