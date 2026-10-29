const pages = JSON.parse(document.getElementById('pages-data').textContent);
let current = 0;

const content = document.getElementById('content');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pagination = document.getElementById('pagination');

if (pages.length <= 1) {
    pagination.style.display = 'none';
}

function showPage(i) {
    current = i;
    content.innerHTML = pages[i];
    pageInfo.textContent = `Page ${i + 1} of ${pages.length}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === pages.length - 1;
    window.scrollTo(0, 0);
}

prevBtn.addEventListener('click', () => { if (current > 0) showPage(current - 1); });
nextBtn.addEventListener('click', () => { if (current < pages.length - 1) showPage(current + 1); });

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevBtn.click();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextBtn.click();
});

showPage(0);
