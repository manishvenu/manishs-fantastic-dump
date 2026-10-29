// search.js

const _searchBar = document.getElementById('search-bar');
const _searchInput = document.getElementById('search-input');
const _contentEl = document.getElementById('content');
let _originalInnerHTML = _contentEl.innerHTML;

_searchBar.style.display = 'none';

let currentIndex = 0;
let matches = [];

// Plain-text, case-insensitive match. Builds <mark> elements with the DOM rather than innerHTML,
// so text such as "<" in the file's metadata is never parsed as markup.
function _highlightTextNodes(node, needle) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const lower = text.toLowerCase();
        let index = lower.indexOf(needle);
        if (index === -1) {
            return;
        }
        const fragment = document.createDocumentFragment();
        let last = 0;
        while (index !== -1) {
            fragment.appendChild(document.createTextNode(text.slice(last, index)));
            const mark = document.createElement('mark');
            mark.className = 'highlight';
            mark.textContent = text.slice(index, index + needle.length);
            fragment.appendChild(mark);
            last = index + needle.length;
            index = lower.indexOf(needle, last);
        }
        fragment.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(fragment, node);
    } else {
        Array.from(node.childNodes).forEach(child => _highlightTextNodes(child, needle));
    }
}

function highlightMatches(query, scroll = true) {
    _contentEl.innerHTML = _originalInnerHTML;
    addVariableClickListeners();
    _highlightTextNodes(_contentEl, query.toLowerCase());

    matches = Array.from(document.querySelectorAll('.highlight'));
    currentIndex = 0;

    if (matches.length && scroll) {
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
    _contentEl.innerHTML = _originalInnerHTML;
    addVariableClickListeners();
    matches = [];
}

function step(direction) {
    if (matches.length) {
        currentIndex = (currentIndex + direction + matches.length) % matches.length;
        scrollToMatch();
    }
}

function closeSearch() {
    _searchBar.style.display = 'none';
    clearHighlights();
}

document.getElementById('next-btn').addEventListener('click', () => step(1));
document.getElementById('prev-btn').addEventListener('click', () => step(-1));
document.getElementById('close-btn').addEventListener('click', closeSearch);

_searchInput.addEventListener('input', (e) => {
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
        _searchBar.style.display = 'block';
        _searchInput.focus();
        _searchInput.select();
    }

    if (_searchBar.style.display === 'none') {
        return;
    }
    if (e.key === 'Escape') {
        closeSearch();
    }
    // Enter for next match, Shift+Enter for previous
    if (e.key === 'Enter' && _searchInput.value.trim()) {
        step(e.shiftKey ? -1 : 1);
    }
});

// The extension posts fresh output when the file changes on disk; swap it in without reloading the page
window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command !== 'update') {
        return;
    }
    const summary = document.querySelector('.file-summary');
    if (summary) {
        summary.outerHTML = message.summaryHtml;
    }
    _originalInnerHTML = message.contentHtml;
    const query = _searchInput.value.trim();
    if (query && _searchBar.style.display !== 'none') {
        highlightMatches(query, false);
    } else {
        clearHighlights();
    }
});
