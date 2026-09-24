const chatToggle = document.getElementById('chat-toggle');
const codeToggle = document.getElementById('code-toggle');
const mainContent = document.querySelector('.main-content');
const claudeTxt = document.querySelector('#claude-txt');
const newChatBtn = document.querySelector('#new-chat-btn');
const projectsBtn = document.querySelector('#projects-btn');
const artifactsBtn = document.querySelector('#artifacts-btn');
const scheduledBtn = document.querySelector('#scheduled-btn');
const customizeBtn = document.querySelector('#customize-btn');
const moreBtn = document.querySelector('#more-btn');

const sidebar = document.querySelector('.sidebar');
const newProjectPlus = document.querySelector('.section-header span:last-child');
const pinHint = document.querySelector('.subtext');
const [allChatsIcon, sortChatsIcon] = document.querySelectorAll('.chats-header .right svg');
const chatsBox = document.querySelector('.chats');
const designBtn = document.querySelector('.sidebar-bottom .nav-item');
const userInfo = document.querySelector('.user-info');
const avatar = document.querySelector('.avatar');
const [downloadIcon, searchIcon, collapseIcon] = document.querySelectorAll('.menu-buttons svg');

/* ===================== names & saved state ===================== */

const ASSISTANT_NAME = 'Kayden';
const DEFAULT_MODEL = 'gpt-6-astra';

const MODEL_OPTIONS = [
    ['gpt-6-astra',  'GPT-6 Astra: most capable, slower, most expensive'],
    ['gpt-5.6-sol',  'GPT-5.6 Sol: strong all-rounder, cheaper'],
    ['gpt-5.6-luna', 'GPT-5.6 Luna: fastest and cheapest']
];
const CHAT_URL = '/api/chat';          /* Vercel function that holds OPENAI_API_KEY */
const DAY = 864e5;

const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem('kayden:' + key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try { localStorage.setItem('kayden:' + key, JSON.stringify(value)); } catch {}
    },
    clear() {
        try {
            Object.keys(localStorage)
                .filter(k => k.startsWith('kayden:'))
                .forEach(k => localStorage.removeItem(k));
        } catch {}
    }
};

let mode = 'chat';
let artifactTab = 'mine';
let searchHandler = null;
let chatSort = 'recent';
let currentChatId = null;
let activeRequest = null;        /* { controller } while a reply is streaming */

let userName = store.get('userName', 'Kdn');
let appPassword = store.get('appPassword', '');

let settings = Object.assign({
    style: 'Normal',
    instructions: '',
    memory: true,
    suggestions: true,
    model: DEFAULT_MODEL,
    theme: 'system'
}, store.get('settings', {}));

/* one-time switch from the old default model to the new one */
if (!store.get('modelUpgraded', false)) {
    if (settings.model === 'gpt-5.6-luna') settings.model = DEFAULT_MODEL;
    store.set('settings', settings);
    store.set('modelUpgraded', true);
}

let chats = store.get('chats', []);

/* a reply that was still streaming when the page closed can't finish now */
chats.forEach(chat => chat.messages.forEach(message => {
    if (message.pending) {
        delete message.pending;
        if (!message.content) message.stopped = true;
    }
}));

let projects = store.get('projects', [
    { name: 'Bounce Dodge',    desc: 'Arcade game where you dodge bouncing balls', updated: Date.now() - 1 * DAY,  pinned: false },
    { name: 'Nullfield',       desc: 'Experimental game prototype',                updated: Date.now() - 4 * DAY,  pinned: false },
    { name: 'Chicken Clicker', desc: 'Idle clicker game',                          updated: Date.now() - 9 * DAY,  pinned: false },
    { name: 'WRO Codes',       desc: 'Robotics competition programs',              updated: Date.now() - 20 * DAY, pinned: false }
]);

let tasks = store.get('tasks', [
    { name: 'Morning brief',       when: 'Weekdays at 8:00 AM', on: true },
    { name: 'Weekly repo summary', when: 'Fridays at 5:00 PM',  on: false }
]);

let designs = store.get('designs', [
    { name: 'Bounce Dodge poster', kind: 'Poster',   updated: Date.now() - 2 * DAY },
    { name: 'Game landing page',   kind: 'Web page', updated: Date.now() - 7 * DAY }
]);

const artifacts = [
    { icon: '🎮', title: 'Bounce Dodge',      desc: 'Dodge the bouncing balls for as long as you can', kind: 'mine',        updated: Date.now() - 1 * DAY },
    { icon: '🐔', title: 'Chicken Clicker',   desc: 'Idle clicker with upgrades',                      kind: 'mine',        updated: Date.now() - 6 * DAY },
    { icon: '📊', title: 'Study planner',     desc: 'Weekly revision timetable',                       kind: 'mine',        updated: Date.now() - 12 * DAY },
    { icon: '🧮', title: 'Unit converter',    desc: 'Convert length, mass and temperature',            kind: 'inspiration', updated: Date.now() - 2 * DAY },
    { icon: '🎨', title: 'Palette generator', desc: 'Make colour palettes from a single hex value',    kind: 'inspiration', updated: Date.now() - 3 * DAY },
    { icon: '⏱️', title: 'Pomodoro timer',    desc: 'Focus timer with short and long breaks',          kind: 'inspiration', updated: Date.now() - 5 * DAY }
];

const DESIGN_ICONS = { 'Poster': '🖼️', 'Web page': '🖥️', 'Graphic': '✏️' };

const STYLE_HINTS = {
    Normal: '',
    Concise: 'Keep answers short and to the point.',
    Explanatory: 'Explain things clearly and step by step, like a patient teacher.',
    Formal: 'Use a formal, professional tone.'
};

function saveAll() {
    store.set('userName', userName);
    store.set('settings', settings);
    store.set('projects', projects);
    store.set('tasks', tasks);
    store.set('designs', designs);
    store.set('chats', chats);
    refreshSidebar();
}

/* ===================== light / dark theme ===================== */

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && darkQuery.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/* follow the computer's setting live when the theme is "System" */
darkQuery.addEventListener('change', () => {
    if (settings.theme === 'system') applyTheme();
});

applyTheme();

/* ===================== helpers ===================== */

function escapeHTML(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
    const days = Math.floor((Date.now() - ts) / DAY);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    return new Date(ts).toLocaleDateString();
}

function greetingWord() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
    }, 1800);
}

function exportData() {
    const blob = new Blob(
        [JSON.stringify({ userName, settings, chats, projects, tasks, designs }, null, 2)],
        { type: 'application/json' }
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'kayden-data.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Data exported');
}

function resetAll() {
    if (!confirm('Reset all chats, projects, tasks, designs and settings in this browser?')) return;
    store.clear();
    location.reload();
}

function makeTitle(text) {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > 40 ? line.slice(0, 40) + '…' : line;
}

/* ===================== markdown for replies ===================== */

function renderInline(text) {
    return escapeHTML(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(md) {
    const lines = md.split('\n');
    const blocks = [];
    let i = 0;

    const isHeading = line => /^#{1,6} /.test(line);
    const isBullet  = line => /^\s*[-*] /.test(line);
    const isNumber  = line => /^\s*\d+[.)] /.test(line);
    const isBreak   = line =>
        line.trim() === '' || line.startsWith('```') || isHeading(line) || isBullet(line) || isNumber(line);

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('```')) {
            const buffer = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                buffer.push(lines[i]);
                i++;
            }
            i++;
            blocks.push(`<pre><code>${escapeHTML(buffer.join('\n'))}</code></pre>`);
        }
        else if (line.trim() === '') {
            i++;
        }
        else if (isHeading(line)) {
            const [, hashes, text] = line.match(/^(#{1,6}) (.*)$/);
            const tag = hashes.length <= 2 ? 'h2' : 'h3';
            blocks.push(`<${tag}>${renderInline(text)}</${tag}>`);
            i++;
        }
        else if (isBullet(line)) {
            const items = [];
            while (i < lines.length && isBullet(lines[i])) {
                items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*] /, ''))}</li>`);
                i++;
            }
            blocks.push(`<ul>${items.join('')}</ul>`);
        }
        else if (isNumber(line)) {
            const items = [];
            while (i < lines.length && isNumber(lines[i])) {
                items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+[.)] /, ''))}</li>`);
                i++;
            }
            blocks.push(`<ol>${items.join('')}</ol>`);
        }
        else {
            const buffer = [];
            while (i < lines.length && !isBreak(lines[i])) {
                buffer.push(renderInline(lines[i]));
                i++;
            }
            blocks.push(`<p>${buffer.join('<br>')}</p>`);
        }
    }

    return blocks.join('');
}

/* ===================== composer & home screens ===================== */

const SEND_ICON = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
    </svg>`;

const STOP_ICON = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
        <rect x="5" y="5" width="14" height="14" rx="2"/>
    </svg>`;

const composerHTML = placeholder => `
    <div class="input-card composer">
        <textarea class="composer-input" id="composer-input" rows="1"
                  placeholder="${escapeHTML(placeholder)}"></textarea>

        <div class="input-controls">
            <div class="left-controls">
                <span class="add-icon">+</span>
                <div class="mode-toggle">
                    <button class="toggle-btn active">Chat</button>
                    <button class="toggle-btn">Cowork</button>
                </div>
            </div>

            <div class="right-controls">
                <button class="model-btn" data-action="nav" data-view="customize" title="Change model">
                    ${escapeHTML(settings.model)} ∨
                </button>
                <button class="send-btn" id="send-btn" aria-label="Send message" disabled>${SEND_ICON}</button>
            </div>
        </div>
    </div>
`;

const chatHTML = () => `
    <div class="wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
                fill="none" stroke="currentColor" stroke-width="1"
                stroke-linecap="round" stroke-linejoin="round">
            <path d="M0.5 12a11.5 11.5 0 0 1 23 0v11.5q-4-8-8 0q-3.5-8-7 0q-4-8-8 0z"/>
            <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/>
            <circle cx="16.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/>
        </svg>
    </div>

    <div class="container">
        <div class="welcome-container">
            <img src="assets/claude.png" alt="${ASSISTANT_NAME}" width="40" height="40">
            <p class="welcome-msg">${greetingWord()}, ${escapeHTML(userName)}</p>
        </div>

        ${composerHTML('How can I help you today?')}
    </div>
`;

const codeHTML = () => `
    <div class="code-container">
        <div class="greeting-header">
            <div class="greeting">
                <img src="assets/claude.png" alt="${ASSISTANT_NAME}" width="30" height="30">
                <span class="greeting-text">What's up next, ${escapeHTML(userName)}?</span>
            </div>
        </div>
        <div class="code-content">

        </div>
        <div class="select-panel">
            <div class="menu-wrapper">
                <button class="open-menu-button" id="open-location-menu-button">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.915 11.625
                                A2.525 2.525 0 0 1 2.901 6.981
                                A3.7 3.7 0 0 1 9.663 4.824
                                A2.4 2.4 0 0 1 12.400 7.193
                                A2.425 2.425 0 0 1 11.889 11.625
                                Z"
                                stroke="currentColor" stroke-width="0.75"
                                stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Default
                </button>

                <ul class="main-menu" id="locationMenu">
                    <li>
                        <div class="left align-center">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2.25" y="2.5" width="10.5" height="7.75" rx="1"
                                        stroke="currentColor" stroke-width="0.75"/>
                                <rect x="0.75" y="10.25" width="13.5" height="2.25" rx="1.125"
                                        stroke="currentColor" stroke-width="0.75"/>
                            </svg>
                            Local
                        </div>
                        <div class="right align-center">
                            <div class="badge">Download</div>
                            <span class="badge badge-no-bg">Desktop only</span>
                        </div>
                    </li>

                    <li class="has-submenu">
                        <div class="left align-center">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.915 11.625
                                        A2.525 2.525 0 0 1 2.901 6.981
                                        A3.7 3.7 0 0 1 9.663 4.824
                                        A2.4 2.4 0 0 1 12.400 7.193
                                        A2.425 2.425 0 0 1 11.889 11.625
                                        Z"
                                        stroke="currentColor" stroke-width="0.75"
                                        stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>Cloud</span>
                        </div>

                        <div class="right align-center">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.75 3.75 L9.5 7.5 L5.75 11.25" stroke="currentColor" stroke-width="0.75"
                                        stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>

                        <ul class="submenu">
                            <li class="selected">
                                Default
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.5 12.5 L10 17 L18.5 7.5" stroke="#0080ff" stroke-width="1.8"
                                        stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </li>
                            <li class="divider"></li>
                            <li class="action">+ Add cloud environment...</li>
                        </ul>
                    </li>

                    <li class="has-submenu">
                        <div class="left align-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 2.5 L5 17.5 L8.7 14 L11 19.5 L13.5 18.5 L11.2 13.2 L16 13.2 Z"
                                        stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                            </svg>
                            <span>Remote Control</span>
                        </div>

                        <div class="right align-center">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.75 3.75 L9.5 7.5 L5.75 11.25" stroke="currentColor" stroke-width="0.75"
                                        stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </li>
                </ul>

                <div class="menu-wrapper">
                    <button class="open-menu-button" id="open-github-repos-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="8 7 3 12 8 17"/>
                            <line x1="15" y1="3.5" x2="9" y2="20.5"/>
                            <polyline points="16 7 21 12 16 17"/>
                        </svg>
                        bounce-dodge
                    </button>

                    <ul class="main-menu" id="github-repos">
                        <li class="selected">261494l-alt/bounce-dodge</li>
                        <li>261494l-alt/nullfield</li>
                        <li>261494l-alt/chicken-clicker</li>
                        <li>261494l-alt/wro-codes</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
`;

/* ===================== view switching ===================== */

function resetMain() {
    if (activeRequest) activeRequest.controller.abort();   /* leaving stops a reply mid-stream */
    searchHandler = null;
    currentChatId = null;
    mainContent.classList.remove('chat-mode', 'page-mode');
}

function focusComposer() {
    const input = document.getElementById('composer-input');
    if (input) input.focus();
}

function showHome() {
    resetMain();
    mainContent.innerHTML = mode === 'chat' ? chatHTML() : codeHTML();
    focusComposer();
}

function showPage(html) {
    resetMain();
    mainContent.classList.add('page-mode');
    mainContent.innerHTML = html;
    mainContent.scrollTop = 0;

    const search = document.getElementById('page-search');
    if (search && search.hasAttribute('data-autofocus')) search.focus();
}

function applyMode(newMode) {
    mode = newMode;
    const isChat = mode === 'chat';

    chatToggle.classList.toggle('active', isChat);
    codeToggle.classList.toggle('active', !isChat);
    claudeTxt.textContent = isChat ? ASSISTANT_NAME : ASSISTANT_NAME + ' Code';

    projectsBtn.style.display  = isChat ? 'flex' : 'none';
    artifactsBtn.style.display = 'flex';
    scheduledBtn.style.display = isChat ? 'flex' : 'none';
    customizeBtn.style.display = 'flex';
    moreBtn.style.display      = isChat ? 'none' : 'flex';
}

const NAV = [
    [newChatBtn,   'home'],
    [projectsBtn,  'projects'],
    [artifactsBtn, 'artifacts'],
    [scheduledBtn, 'scheduled'],
    [customizeBtn, 'customize'],
    [moreBtn,      'more'],
    [designBtn,    'design']
];

const navButtons = NAV.map(([btn]) => btn);

function setActiveNav(activeBtn) {
    navButtons.forEach(btn => btn.classList.toggle('active', btn === activeBtn));
    document.querySelectorAll('#pinned-list .nav-item').forEach(item => item.classList.remove('active'));
}

const VIEWS = {
    home:      showHome,
    projects:  renderProjects,
    artifacts: renderArtifacts,
    scheduled: renderScheduled,
    customize: renderCustomize,
    more:      renderMore,
    design:    renderDesign,
    chats:     renderChats,
    search:    renderSearch
};

function go(view) {
    const entry = NAV.find(([, name]) => name === view);
    setActiveNav(entry ? entry[0] : null);
    VIEWS[view]();
    renderChatList();
}

NAV.forEach(([btn, view]) => {
    btn.addEventListener('click', () => go(view));
});

chatToggle.addEventListener('click', () => {
    applyMode('chat');
    go('home');
});

codeToggle.addEventListener('click', () => {
    applyMode('code');
    go('home');
});

/* ===================== sidebar: chats list ===================== */

const DOT_SVG = `
    <svg width="6" height="6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10.7" fill="none" stroke="currentColor" stroke-width="2.7"/>
    </svg>`;

function renderChatList() {
    const list = [...chats];

    if (chatSort === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => b.updated - a.updated);

    chatsBox.innerHTML = list.map(chat => `
        <div class="chat ${chat.id === currentChatId ? 'active' : ''}" data-id="${chat.id}" title="${escapeHTML(chat.title)}">
            ${DOT_SVG}
            <span class="chat-title">${escapeHTML(chat.title)}</span>
        </div>
    `).join('');
}

chatsBox.addEventListener('click', event => {
    const item = event.target.closest('.chat');
    if (item) openChat(item.dataset.id);
});

allChatsIcon.addEventListener('click', () => go('chats'));

sortChatsIcon.addEventListener('click', () => {
    chatSort = chatSort === 'recent' ? 'az' : 'recent';
    sortChatsIcon.classList.toggle('on', chatSort === 'az');
    renderChatList();
    toast(chatSort === 'az' ? 'Sorted A to Z' : 'Sorted by most recent');
});

/* ===================== sidebar: profile, pinned projects ===================== */

function refreshSidebar() {
    avatar.innerHTML = `
        <div class="profile-picture">${escapeHTML(userName.charAt(0).toUpperCase())}</div>
        ${escapeHTML(userName)}
    `;
    renderPinned();
    renderChatList();
}

function renderPinned() {
    let list = document.getElementById('pinned-list');

    if (!list) {
        list = document.createElement('ul');
        list.id = 'pinned-list';
        list.className = 'nav-list pinned-list';
        pinHint.after(list);

        list.addEventListener('click', event => {
            const item = event.target.closest('[data-index]');
            if (item) openProjectFromSidebar(Number(item.dataset.index));
        });
    }

    const pinned = projects
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => project.pinned);

    pinHint.style.display = pinned.length ? 'none' : 'flex';

    list.innerHTML = pinned.map(({ project, index }) => `
        <li class="nav-item" data-index="${index}">
            <span class="pin-dot"></span>
            ${escapeHTML(project.name)}
        </li>
    `).join('');
}

function openProjectFromSidebar(index) {
    if (mode !== 'chat') applyMode('chat');
    setActiveNav(null);
    renderProjectDetail(index);
    renderChatList();

    const item = document.querySelector(`#pinned-list [data-index="${index}"]`);
    if (item) item.classList.add('active');
}

function createProject(pinned) {
    const name = prompt('Project name');
    if (!name || !name.trim()) return null;
    const desc = prompt('Short description (optional)') || '';
    projects.unshift({ name: name.trim(), desc: desc.trim(), updated: Date.now(), pinned });
    saveAll();
    toast(pinned ? 'Project created and pinned' : 'Project created');
    return 0;
}

newProjectPlus.addEventListener('click', () => {
    const index = createProject(true);
    if (index !== null) openProjectFromSidebar(index);
});

/* ===================== sidebar: bottom icons ===================== */

downloadIcon.addEventListener('click', exportData);
searchIcon.addEventListener('click', () => go('search'));

const openSidebarBtn = document.createElement('button');
openSidebarBtn.className = 'sidebar-open';
openSidebarBtn.setAttribute('aria-label', 'Open sidebar');
openSidebarBtn.innerHTML = collapseIcon.outerHTML;
document.body.appendChild(openSidebarBtn);

function setSidebar(open) {
    sidebar.classList.toggle('collapsed', !open);
    openSidebarBtn.classList.toggle('show', !open);
}

collapseIcon.addEventListener('click', () => setSidebar(false));
openSidebarBtn.addEventListener('click', () => setSidebar(true));

function closeAccountMenu() {
    const menu = document.getElementById('account-menu');
    if (menu) menu.remove();
}

userInfo.addEventListener('click', () => {
    if (document.getElementById('account-menu')) return closeAccountMenu();

    const dark = document.documentElement.dataset.theme === 'dark';

    const menu = document.createElement('div');
    menu.id = 'account-menu';
    menu.className = 'account-menu';
    menu.innerHTML = `
        <div class="account-head">
            <div class="profile-picture">${escapeHTML(userName.charAt(0).toUpperCase())}</div>
            <div>
                <div class="row-title">${escapeHTML(userName)}</div>
                <div class="row-sub">Pro plan</div>
            </div>
        </div>
        <button data-menu="customize">Settings</button>
        <button data-menu="theme">${dark ? 'Switch to light mode' : 'Switch to dark mode'}</button>
        <button data-menu="search">Search</button>
        <button data-menu="export">Export data</button>
        <button data-menu="reset" class="danger">Reset everything</button>
    `;

    const box = userInfo.getBoundingClientRect();
    menu.style.left = box.left + 'px';
    menu.style.bottom = (window.innerHeight - box.top + 8) + 'px';
    document.body.appendChild(menu);

    menu.addEventListener('click', event => {
        const btn = event.target.closest('[data-menu]');
        if (!btn) return;
        closeAccountMenu();

        const choice = btn.dataset.menu;
        if (choice === 'export') exportData();
        else if (choice === 'reset') resetAll();
        else if (choice === 'theme') setTheme(dark ? 'light' : 'dark');
        else go(choice);
    });
});

function setTheme(theme) {
    settings.theme = theme;
    applyTheme();
    saveAll();

    /* keep the Customize buttons in sync if that page is open */
    document.querySelectorAll('.theme-option').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.theme === theme));
}

/* ===================== chatting through /api/chat ===================== */

function openChat(id) {
    const chat = chats.find(c => c.id === id);
    if (chat) openChatView(chat);
}

function openChatView(chat) {
    resetMain();
    applyMode('chat');
    setActiveNav(null);
    currentChatId = chat.id;

    mainContent.classList.add('chat-mode');
    mainContent.innerHTML = `
        <div class="chat-view">
            <div class="chat-topbar">
                <span class="chat-topbar-title" id="chat-title">${escapeHTML(chat.title)}</span>
                <div class="chat-topbar-actions">
                    <button class="topbar-btn" data-action="rename-chat">Rename</button>
                    <button class="topbar-btn danger" data-action="delete-chat">Delete</button>
                </div>
            </div>

            <div class="transcript" id="transcript">
                <div class="transcript-inner" id="transcript-inner"></div>
            </div>

            <div class="composer-area">
                ${composerHTML(`Reply to ${ASSISTANT_NAME}...`)}
                <div class="skip-hint">${ASSISTANT_NAME} can make mistakes. Check important info.</div>
            </div>
        </div>
    `;

    renderTranscript(chat);
    renderChatList();
    focusComposer();
}

function messageBodyHTML(message) {
    if (message.error) {
        return `
            <div class="msg-error">${escapeHTML(message.content)}</div>
            <button class="ghost-btn" data-action="nav" data-view="customize">Open Customize</button>
        `;
    }
    if (message.content) {
        return renderMarkdown(message.content) +
            (message.stopped ? `<p class="msg-note">Stopped</p>` : '');
    }
    if (message.pending) {
        return `<div class="thinking"><span></span><span></span><span></span></div>`;
    }
    return `<p class="msg-note">Stopped before replying.</p>`;
}

function renderTranscript(chat) {
    const inner = document.getElementById('transcript-inner');
    if (!inner) return;

    inner.innerHTML = chat.messages.map(message => message.role === 'user'
        ? `<div class="msg user"><div class="msg-body">${escapeHTML(message.content)}</div></div>`
        : `<div class="msg assistant">
               <div class="msg-head">
                   <img src="assets/claude.png" alt="${ASSISTANT_NAME}" width="18" height="18">
                   ${ASSISTANT_NAME}
               </div>
               <div class="msg-body">${messageBodyHTML(message)}</div>
           </div>`
    ).join('');

    scrollTranscript();
}

function scrollTranscript() {
    const transcript = document.getElementById('transcript');
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
}

function autosize(input) {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
}

function setSendState() {
    const btn = document.getElementById('send-btn');
    const input = document.getElementById('composer-input');
    if (!btn) return;

    const streaming = !!activeRequest;
    btn.classList.toggle('stop', streaming);
    btn.innerHTML = streaming ? STOP_ICON : SEND_ICON;
    btn.setAttribute('aria-label', streaming ? 'Stop reply' : 'Send message');
    btn.disabled = !streaming && !(input && input.value.trim());
}

function buildMessages(chat) {
    const system = [
        `You are ${ASSISTANT_NAME}, a friendly and helpful AI assistant.`,
        `The user's name is ${userName}.`,
        STYLE_HINTS[settings.style] || '',
        settings.instructions.trim()
            ? `Follow these instructions from the user: ${settings.instructions.trim()}`
            : ''
    ].filter(Boolean).join(' ');

    return [
        { role: 'system', content: system },
        ...chat.messages
            .filter(message => !message.error && message.content)
            .map(message => ({ role: message.role, content: message.content }))
    ];
}

async function describeError(response) {
    let detail = '';
    try {
        const data = await response.json();
        detail = (data && data.error && data.error.message) || '';
    } catch {}

    switch (response.status) {
        case 401: return (detail || 'Not authorized.') + ' (401) Check the app password in Customize, or OPENAI_API_KEY in Vercel.';
        case 403: return 'Your OpenAI key is not allowed to use this model (403). ' + detail;
        case 404: return detail
            ? `${detail} (404) Check the model name in Customize.`
            : 'The chat server was not found (404). Run the app on Vercel or with "vercel dev", not by opening index.html directly.';
        case 429: return 'Rate limit reached or no credits left (429). Check your usage and billing on the OpenAI platform.';
        default:  return `Server error ${response.status}${detail ? ': ' + detail : ''}`;
    }
}

async function sendMessage() {
    const input = document.getElementById('composer-input');
    if (!input || activeRequest) return;

    const text = input.value.trim();
    if (!text) return;

    let chat = chats.find(c => c.id === currentChatId);
    const isNewChat = !chat;

    if (isNewChat) {
        chat = { id: 'c' + Date.now(), title: makeTitle(text), messages: [], updated: Date.now() };
        chats.unshift(chat);
    }

    chat.messages.push({ role: 'user', content: text });
    const reply = { role: 'assistant', content: '', pending: true };
    chat.messages.push(reply);
    chat.updated = Date.now();
    saveAll();

    if (isNewChat) {
        openChatView(chat);
    } else {
        input.value = '';
        autosize(input);
        renderTranscript(chat);
        renderChatList();
    }

    const bodies = document.querySelectorAll('#transcript-inner .msg.assistant .msg-body');
    await streamReply(chat, reply, bodies[bodies.length - 1]);
}

async function streamReply(chat, reply, body) {
    const controller = new AbortController();
    activeRequest = { controller };
    setSendState();

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (appPassword) headers['x-app-password'] = appPassword;

        const response = await fetch(CHAT_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: settings.model,
                messages: buildMessages(chat)
            }),
            signal: controller.signal
        });

        if (!response.ok) throw new Error(await describeError(response));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;

                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                    if (delta) {
                        reply.content += delta;
                        if (body) body.innerHTML = renderMarkdown(reply.content) + '<span class="caret"></span>';
                        scrollTranscript();
                    }
                } catch {
                    /* ignore keep-alive or partial lines */
                }
            }
        }
    }
    catch (error) {
        if (error.name === 'AbortError') {
            reply.stopped = true;
        }
        else if (error instanceof TypeError) {
            reply.error = true;
            reply.content = "Couldn't reach the server. Check your internet connection and try again.";
        }
        else {
            reply.error = true;
            reply.content = error.message;
        }
    }
    finally {
        delete reply.pending;
        activeRequest = null;
        chat.updated = Date.now();
        saveAll();

        if (body) body.innerHTML = messageBodyHTML(reply);
        setSendState();
        scrollTranscript();
    }
}

/* ===================== projects ===================== */

function renderProjects() {
    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Projects</h1>
                <button class="primary-btn" data-action="new-project">+ New project</button>
            </div>
            <input class="page-search" id="page-search" placeholder="Search projects" autocomplete="off">
            <div class="card-grid" id="card-grid"></div>
        </div>
    `);
    searchHandler = fillProjects;
    fillProjects('');
}

function fillProjects(query) {
    const grid = document.getElementById('card-grid');
    if (!grid) return;

    const term = query.trim().toLowerCase();
    const matches = projects
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => !term || (project.name + ' ' + project.desc).toLowerCase().includes(term));

    if (!projects.length) {
        grid.innerHTML = `<div class="empty-state">No projects yet. Create one to keep related chats together.</div>`;
        return;
    }

    if (!matches.length) {
        grid.innerHTML = `<div class="empty-state">No projects match "${escapeHTML(query)}".</div>`;
        return;
    }

    grid.innerHTML = matches.map(({ project, index }) => `
        <div class="page-card" data-action="open-project" data-index="${index}">
            <div class="card-title">${project.pinned ? '📌 ' : ''}${escapeHTML(project.name)}</div>
            <div class="card-desc">${escapeHTML(project.desc || 'No description')}</div>
            <div class="card-meta">Updated ${timeAgo(project.updated)}</div>
        </div>
    `).join('');
}

function renderProjectDetail(index) {
    const project = projects[index];
    if (!project) return renderProjects();

    showPage(`
        <div class="page">
            <button class="back-btn" data-action="nav" data-view="projects">← All projects</button>
            <div class="page-header">
                <div>
                    <h1 class="page-title">${escapeHTML(project.name)}</h1>
                    <p class="page-sub">${escapeHTML(project.desc || 'No description')}</p>
                </div>
            </div>
            <p class="page-sub">Updated ${timeAgo(project.updated)}</p>
            <div class="detail-actions">
                <button class="primary-btn" data-action="project-chat" data-index="${index}">Start a chat in this project</button>
                <button class="ghost-btn" data-action="pin-project" data-index="${index}">${project.pinned ? 'Unpin' : 'Pin to sidebar'}</button>
                <button class="ghost-btn" data-action="rename-project" data-index="${index}">Rename</button>
                <button class="ghost-btn danger" data-action="delete-project" data-index="${index}">Delete</button>
            </div>
        </div>
    `);
}

/* ===================== artifacts ===================== */

function renderArtifacts() {
    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Artifacts</h1>
            </div>
            <div class="tabs">
                <button class="tab ${artifactTab === 'mine' ? 'active' : ''}" data-action="tab" data-tab="mine">Your artifacts</button>
                <button class="tab ${artifactTab === 'inspiration' ? 'active' : ''}" data-action="tab" data-tab="inspiration">Inspiration</button>
            </div>
            <input class="page-search" id="page-search" placeholder="Search artifacts" autocomplete="off">
            <div class="card-grid" id="card-grid"></div>
        </div>
    `);
    searchHandler = fillArtifacts;
    fillArtifacts('');
}

function fillArtifacts(query) {
    const grid = document.getElementById('card-grid');
    if (!grid) return;

    const term = query.trim().toLowerCase();
    const matches = artifacts
        .map((artifact, index) => ({ artifact, index }))
        .filter(({ artifact }) => artifact.kind === artifactTab)
        .filter(({ artifact }) => !term || (artifact.title + ' ' + artifact.desc).toLowerCase().includes(term));

    grid.innerHTML = matches.length
        ? matches.map(({ artifact, index }) => `
            <div class="page-card" data-action="open-artifact" data-index="${index}">
                <div class="card-icon">${artifact.icon}</div>
                <div class="card-title">${escapeHTML(artifact.title)}</div>
                <div class="card-desc">${escapeHTML(artifact.desc)}</div>
                <div class="card-meta">Updated ${timeAgo(artifact.updated)}</div>
            </div>
        `).join('')
        : `<div class="empty-state">No artifacts found.</div>`;
}

function renderArtifactDetail(index) {
    const artifact = artifacts[index];
    if (!artifact) return renderArtifacts();

    showPage(`
        <div class="page">
            <button class="back-btn" data-action="nav" data-view="artifacts">← All artifacts</button>
            <div class="artifact-preview">${artifact.icon}</div>
            <div>
                <h1 class="page-title">${escapeHTML(artifact.title)}</h1>
                <p class="page-sub">${escapeHTML(artifact.desc)}</p>
            </div>
            <div class="detail-actions">
                <button class="primary-btn" data-action="artifact-chat" data-index="${index}">
                    ${artifact.kind === 'mine' ? 'Keep editing' : 'Customize this'}
                </button>
            </div>
        </div>
    `);
}

/* ===================== scheduled ===================== */

function renderScheduled() {
    const rows = tasks.map((task, index) => `
        <div class="row">
            <div class="row-main">
                <span class="row-title">${escapeHTML(task.name)}</span>
                <span class="row-sub">${escapeHTML(task.when)}</span>
            </div>
            <button class="switch ${task.on ? 'on' : ''}" data-action="toggle-task" data-index="${index}"
                    aria-label="Turn ${escapeHTML(task.name)} ${task.on ? 'off' : 'on'}"></button>
            <button class="icon-btn" data-action="delete-task" data-index="${index}" aria-label="Delete task">×</button>
        </div>
    `).join('');

    showPage(`
        <div class="page">
            <div class="page-header">
                <div>
                    <h1 class="page-title">Scheduled</h1>
                    <p class="page-sub">Tasks ${ASSISTANT_NAME} runs for you on a schedule.</p>
                </div>
                <button class="primary-btn" data-action="new-task">+ New task</button>
            </div>
            ${tasks.length
                ? `<div class="row-list">${rows}</div>`
                : `<div class="empty-state">No scheduled tasks. Create one to have ${ASSISTANT_NAME} run it automatically.</div>`}
        </div>
    `);
}

/* ===================== customize ===================== */

function renderCustomize() {
    const styles = ['Normal', 'Concise', 'Explanatory', 'Formal'];
    const themes = [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']];

    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Customize</h1>
            </div>
            <div class="form">
                <div class="field">
                    <span class="field-label">Appearance</span>
                    <span class="field-hint">System follows your computer's light or dark setting.</span>
                    <div class="theme-options" role="group" aria-label="Appearance">
                        ${themes.map(([value, label]) => `
                            <button class="theme-option ${settings.theme === value ? 'active' : ''}"
                                    data-action="set-theme" data-theme="${value}">
                                <span class="theme-swatch ${value}"></span>
                                ${label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="field">
                    <label for="set-password">App password</label>
                    <span class="field-hint">Only needed if you set APP_PASSWORD in Vercel. Saved only in this browser.</span>
                    <input id="set-password" type="password" value="${escapeHTML(appPassword)}" autocomplete="off" spellcheck="false">
                </div>
                <div class="field">
                    <label for="set-model">Model</label>
                    <span class="field-hint">The OpenAI model ${ASSISTANT_NAME} uses. Stronger models cost more per message.</span>
                    <select id="set-model">
                        ${MODEL_OPTIONS
                            .concat(MODEL_OPTIONS.some(([id]) => id === settings.model) ? [] : [[settings.model, settings.model]])
                            .map(([id, label]) => `<option value="${escapeHTML(id)}" ${id === settings.model ? 'selected' : ''}>${escapeHTML(label)}</option>`)
                            .join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="set-name">What should ${ASSISTANT_NAME} call you?</label>
                    <input id="set-name" value="${escapeHTML(userName)}" maxlength="30">
                </div>
                <div class="field">
                    <label for="set-style">Response style</label>
                    <select id="set-style">
                        ${styles.map(s => `<option ${s === settings.style ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="set-instructions">Instructions</label>
                    <span class="field-hint">Anything ${ASSISTANT_NAME} should keep in mind in every chat.</span>
                    <textarea id="set-instructions">${escapeHTML(settings.instructions)}</textarea>
                </div>
                <div class="row-list">
                    <div class="row">
                        <div class="row-main">
                            <span class="row-title">Memory</span>
                            <span class="row-sub">Let ${ASSISTANT_NAME} remember details between chats</span>
                        </div>
                        <button class="switch ${settings.memory ? 'on' : ''}" data-action="toggle-setting" data-key="memory" aria-label="Memory"></button>
                    </div>
                    <div class="row">
                        <div class="row-main">
                            <span class="row-title">Suggestions</span>
                            <span class="row-sub">Show follow-up suggestions after replies</span>
                        </div>
                        <button class="switch ${settings.suggestions ? 'on' : ''}" data-action="toggle-setting" data-key="suggestions" aria-label="Suggestions"></button>
                    </div>
                </div>
                <div class="detail-actions">
                    <button class="primary-btn" data-action="save-settings">Save changes</button>
                </div>
            </div>
        </div>
    `);
}

/* ===================== more ===================== */

function renderMore() {
    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">More</h1>
            </div>
            <div class="row-list">
                <div class="row clickable" data-action="nav" data-view="customize">
                    <div class="row-main">
                        <span class="row-title">Settings</span>
                        <span class="row-sub">Appearance, model, name and instructions</span>
                    </div>
                </div>
                <div class="row clickable" data-action="export">
                    <div class="row-main">
                        <span class="row-title">Export data</span>
                        <span class="row-sub">Download your chats, projects and settings as JSON</span>
                    </div>
                </div>
                <div class="row clickable" data-action="about">
                    <div class="row-main">
                        <span class="row-title">About ${ASSISTANT_NAME}</span>
                        <span class="row-sub">What's saved in this browser</span>
                    </div>
                </div>
                <div class="row clickable" data-action="reset">
                    <div class="row-main">
                        <span class="row-title danger">Reset everything</span>
                        <span class="row-sub">Clear all chats, projects, tasks and settings in this browser</span>
                    </div>
                </div>
            </div>
        </div>
    `);
}

/* ===================== design ===================== */

function renderDesign() {
    const cards = designs.map((design, index) => `
        <div class="page-card" data-action="open-design" data-index="${index}">
            <div class="card-icon">${DESIGN_ICONS[design.kind] || '🎨'}</div>
            <div class="card-title">${escapeHTML(design.name)}</div>
            <div class="card-desc">${escapeHTML(design.kind)}</div>
            <div class="card-meta">Updated ${timeAgo(design.updated)}</div>
        </div>
    `).join('');

    showPage(`
        <div class="page">
            <div class="page-header">
                <div>
                    <h1 class="page-title">Design</h1>
                    <p class="page-sub">Posters, web pages and graphics.</p>
                </div>
                <button class="primary-btn" data-action="new-design">+ New design</button>
            </div>
            <div class="card-grid">
                ${cards || `<div class="empty-state">No designs yet. Create one to get started.</div>`}
            </div>
        </div>
    `);
}

function renderDesignDetail(index) {
    const design = designs[index];
    if (!design) return renderDesign();

    showPage(`
        <div class="page">
            <button class="back-btn" data-action="nav" data-view="design">← All designs</button>
            <div class="artifact-preview">${DESIGN_ICONS[design.kind] || '🎨'}</div>
            <div>
                <h1 class="page-title">${escapeHTML(design.name)}</h1>
                <p class="page-sub">${escapeHTML(design.kind)}, updated ${timeAgo(design.updated)}</p>
            </div>
            <div class="detail-actions">
                <button class="ghost-btn" data-action="rename-design" data-index="${index}">Rename</button>
                <button class="ghost-btn danger" data-action="delete-design" data-index="${index}">Delete</button>
            </div>
        </div>
    `);
}

/* ===================== all chats & search ===================== */

function chatMatches(chat, term) {
    return chat.title.toLowerCase().includes(term) ||
        chat.messages.some(message => message.content.toLowerCase().includes(term));
}

function chatRows(list) {
    return list.map(chat => `
        <div class="row clickable" data-action="open-chat" data-chat="${chat.id}">
            <div class="row-main">
                <span class="row-title">${escapeHTML(chat.title)}</span>
                <span class="row-sub">Updated ${timeAgo(chat.updated)}</span>
            </div>
        </div>
    `).join('');
}

function renderChats() {
    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Chats and tasks</h1>
                <button class="primary-btn" data-action="nav" data-view="home">+ New chat</button>
            </div>
            <input class="page-search" id="page-search" placeholder="Search chats" autocomplete="off">
            <div id="results"></div>
        </div>
    `);
    searchHandler = fillChats;
    fillChats('');
}

function fillChats(query) {
    const results = document.getElementById('results');
    if (!results) return;

    if (!chats.length) {
        results.innerHTML = `<div class="empty-state">No chats yet. Start one from New.</div>`;
        return;
    }

    const term = query.trim().toLowerCase();
    const matches = [...chats]
        .sort((a, b) => b.updated - a.updated)
        .filter(chat => !term || chatMatches(chat, term));

    results.innerHTML = matches.length
        ? `<div class="row-list">${chatRows(matches)}</div>`
        : `<div class="empty-state">No chats match "${escapeHTML(query)}".</div>`;
}

function renderSearch() {
    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Search</h1>
            </div>
            <input class="page-search" id="page-search" placeholder="Search chats and projects" autocomplete="off" data-autofocus>
            <div id="results"></div>
        </div>
    `);
    searchHandler = fillSearch;
    fillSearch('');
}

function fillSearch(query) {
    const results = document.getElementById('results');
    if (!results) return;

    const term = query.trim().toLowerCase();
    if (!term) {
        results.innerHTML = `<div class="empty-state">Type to search your chats and projects.</div>`;
        return;
    }

    const foundChats = chats.filter(chat => chatMatches(chat, term));
    const foundProjects = projects
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => (project.name + ' ' + project.desc).toLowerCase().includes(term));

    if (!foundChats.length && !foundProjects.length) {
        results.innerHTML = `<div class="empty-state">Nothing matches "${escapeHTML(query)}".</div>`;
        return;
    }

    results.innerHTML = `
        ${foundChats.length ? `
            <p class="results-label">Chats</p>
            <div class="row-list">${chatRows(foundChats)}</div>` : ''}
        ${foundProjects.length ? `
            <p class="results-label">Projects</p>
            <div class="row-list">
                ${foundProjects.map(({ project, index }) => `
                    <div class="row clickable" data-action="open-project" data-index="${index}">
                        <div class="row-main">
                            <span class="row-title">${escapeHTML(project.name)}</span>
                            <span class="row-sub">${escapeHTML(project.desc || 'No description')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>` : ''}
    `;
}

/* ===================== main area events (delegated) ===================== */

mainContent.addEventListener('input', event => {
    if (event.target.id === 'page-search' && searchHandler) {
        searchHandler(event.target.value);
    }
    if (event.target.id === 'composer-input') {
        autosize(event.target);
        setSendState();
    }
});

mainContent.addEventListener('keydown', event => {
    if (event.target.id !== 'composer-input') return;

    /* Enter sends, Shift+Enter makes a new line */
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage();
    }
});

mainContent.addEventListener('click', event => {
    if (event.target.closest('#send-btn')) {
        if (activeRequest) activeRequest.controller.abort();
        else sendMessage();
        return;
    }

    const toggleBtn = event.target.closest('.mode-toggle .toggle-btn');
    if (toggleBtn) {
        toggleBtn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        toggleBtn.classList.add('active');
        return;
    }

    const el = event.target.closest('[data-action]');
    if (!el) return;

    const index = Number(el.dataset.index);

    switch (el.dataset.action) {
        case 'nav':
            go(el.dataset.view);
            break;

        case 'set-theme':
            setTheme(el.dataset.theme);
            break;

        case 'open-chat':
            openChat(el.dataset.chat);
            break;

        case 'rename-chat': {
            const chat = chats.find(c => c.id === currentChatId);
            if (!chat) return;
            const title = prompt('Rename chat', chat.title);
            if (!title || !title.trim()) return;
            chat.title = title.trim();
            saveAll();
            document.getElementById('chat-title').textContent = chat.title;
            toast('Chat renamed');
            break;
        }

        case 'delete-chat': {
            const chat = chats.find(c => c.id === currentChatId);
            if (!chat || !confirm(`Delete "${chat.title}"?`)) return;
            chats = chats.filter(c => c.id !== chat.id);
            go('home');
            saveAll();
            toast('Chat deleted');
            break;
        }

        case 'new-project':
            if (createProject(false) !== null) renderProjects();
            break;

        case 'open-project':
            setActiveNav(projectsBtn);
            renderProjectDetail(index);
            renderChatList();
            break;

        case 'pin-project':
            projects[index].pinned = !projects[index].pinned;
            saveAll();
            renderProjectDetail(index);
            toast(projects[index].pinned ? 'Pinned to sidebar' : 'Unpinned');
            break;

        case 'rename-project': {
            const name = prompt('New name', projects[index].name);
            if (!name || !name.trim()) return;
            projects[index].name = name.trim();
            projects[index].updated = Date.now();
            saveAll();
            renderProjectDetail(index);
            toast('Project renamed');
            break;
        }

        case 'delete-project':
            if (!confirm(`Delete "${projects[index].name}"?`)) return;
            projects.splice(index, 1);
            saveAll();
            go('projects');
            toast('Project deleted');
            break;

        case 'project-chat':
            projects[index].updated = Date.now();
            saveAll();
            go('home');
            toast('New chat in ' + projects[index].name);
            break;

        case 'tab':
            artifactTab = el.dataset.tab;
            renderArtifacts();
            break;

        case 'open-artifact':
            renderArtifactDetail(index);
            break;

        case 'artifact-chat':
            go('home');
            toast('New chat about ' + artifacts[index].title);
            break;

        case 'new-task': {
            const name = prompt('Task name');
            if (!name || !name.trim()) return;
            const when = prompt('When should it run?', 'Weekdays at 9:00 AM');
            if (!when || !when.trim()) return;
            tasks.push({ name: name.trim(), when: when.trim(), on: true });
            saveAll();
            renderScheduled();
            toast('Task scheduled');
            break;
        }

        case 'toggle-task':
            tasks[index].on = !tasks[index].on;
            saveAll();
            renderScheduled();
            toast(tasks[index].name + (tasks[index].on ? ' turned on' : ' turned off'));
            break;

        case 'delete-task':
            if (!confirm(`Delete "${tasks[index].name}"?`)) return;
            tasks.splice(index, 1);
            saveAll();
            renderScheduled();
            toast('Task deleted');
            break;

        case 'toggle-setting': {
            const key = el.dataset.key;
            settings[key] = !settings[key];
            el.classList.toggle('on', settings[key]);
            saveAll();
            break;
        }

        case 'save-settings':
            appPassword = document.getElementById('set-password').value.trim();
            store.set('appPassword', appPassword);
            settings.model = document.getElementById('set-model').value.trim() || DEFAULT_MODEL;
            userName = document.getElementById('set-name').value.trim() || 'Kdn';
            settings.style = document.getElementById('set-style').value;
            settings.instructions = document.getElementById('set-instructions').value;
            saveAll();
            toast('Changes saved');
            break;

        case 'new-design': {
            const name = prompt('Design name');
            if (!name || !name.trim()) return;
            const kind = prompt('What kind? (Poster, Web page, Graphic)', 'Poster') || 'Graphic';
            designs.unshift({ name: name.trim(), kind: kind.trim(), updated: Date.now() });
            saveAll();
            renderDesign();
            toast('Design created');
            break;
        }

        case 'open-design':
            renderDesignDetail(index);
            break;

        case 'rename-design': {
            const name = prompt('New name', designs[index].name);
            if (!name || !name.trim()) return;
            designs[index].name = name.trim();
            designs[index].updated = Date.now();
            saveAll();
            renderDesignDetail(index);
            toast('Design renamed');
            break;
        }

        case 'delete-design':
            if (!confirm(`Delete "${designs[index].name}"?`)) return;
            designs.splice(index, 1);
            saveAll();
            renderDesign();
            toast('Design deleted');
            break;

        case 'export':
            exportData();
            break;

        case 'about':
            toast(`${ASSISTANT_NAME}: ${chats.length} chats, ${projects.length} projects, ${tasks.length} tasks saved`);
            break;

        case 'reset':
            resetAll();
            break;
    }
});

/* ===================== outside clicks: dropdowns & account menu ===================== */

document.addEventListener('click', (event) => {
    if (!event.target.closest('#account-menu') && !event.target.closest('.user-info')) {
        closeAccountMenu();
    }

    const menuButton = event.target.closest('#open-location-menu-button');
    const locationMenu = document.getElementById('locationMenu');
    const githubReposButton = event.target.closest('#open-github-repos-button');
    const gitHubReposMenu = document.getElementById('github-repos');

    if (menuButton) {
        if (locationMenu) {
            const isCurrentlyVisible = locationMenu.style.display === "flex";
            locationMenu.style.display = isCurrentlyVisible ? "none" : "flex";
        }
    }
    else if (locationMenu && locationMenu.style.display === "flex") {
        if (!event.target.closest('#locationMenu')) {
            locationMenu.style.display = "none";
        }
    }

    if (githubReposButton) {
        if (gitHubReposMenu) {
            const isCurrentlyVisible = gitHubReposMenu.style.display === "flex";
            gitHubReposMenu.style.display = isCurrentlyVisible ? "none" : "flex";
        }
    }
    else if (gitHubReposMenu && gitHubReposMenu.style.display === "flex") {
        if (!event.target.closest('#github-repos')) {
            gitHubReposMenu.style.display = "none";
        }
    }
});

/* ===================== start up ===================== */

applyMode('chat');
setActiveNav(newChatBtn);
refreshSidebar();
showHome();
