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
const chatItems = document.querySelectorAll('.chat');

/* other sidebar controls (picked from your existing HTML, no ids needed) */
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

let userName = store.get('userName', 'Kdn');

let settings = store.get('settings', {
    style: 'Normal',
    instructions: '',
    memory: true,
    suggestions: true
});

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

function saveAll() {
    store.set('userName', userName);
    store.set('settings', settings);
    store.set('projects', projects);
    store.set('tasks', tasks);
    store.set('designs', designs);
    refreshSidebar();
}

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
        [JSON.stringify({ userName, settings, projects, tasks, designs }, null, 2)],
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
    if (!confirm('Reset all saved projects, tasks, designs and settings?')) return;
    store.clear();
    location.reload();
}

function chatList() {
    return Array.from(chatItems).map(el => ({
        key: el.dataset.chat,
        title: el.textContent.trim()
    }));
}

/* ===================== home screens ===================== */

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

        <div class="input-card">
            <div class="input-placeholder">Type / for skills</div>

            <div class="input-controls">
                <div class="left-controls">
                    <span class="add-icon">+</span>
                    <div class="mode-toggle">
                        <button class="toggle-btn active">Chat</button>
                        <button class="toggle-btn">Cowork</button>
                    </div>
                </div>

                <div class="right-controls">
                    <span>Opus 5 High</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="8.78" y="2.42" width="6.44" height="11.43" rx="3.22"/>
                        <path d="M19.06 9.51V10.79a7.06 7.06 0 0 1-14.12 0V9.51"/>
                        <path d="M12 17.85V22.32"/>
                    </svg>
                    <span>∨</span>
                </div>
            </div>
        </div>
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round">
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
    playToken++;                     /* stops any conversation that is playing */
    searchHandler = null;
    mainContent.classList.remove('chat-mode', 'page-mode');
}

function showHome() {
    resetMain();
    mainContent.innerHTML = mode === 'chat' ? chatHTML() : codeHTML();
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
    chatItems.forEach(item => item.classList.remove('active'));
    VIEWS[view]();
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

/* ===================== sidebar: profile, pinned projects ===================== */

function refreshSidebar() {
    avatar.innerHTML = `
        <div class="profile-picture">${escapeHTML(userName.charAt(0).toUpperCase())}</div>
        ${escapeHTML(userName)}
    `;
    renderPinned();
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
    chatItems.forEach(item => item.classList.remove('active'));
    renderProjectDetail(index);

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

/* ===================== sidebar: chats header icons ===================== */

const originalChatOrder = Array.from(chatItems);

allChatsIcon.addEventListener('click', () => go('chats'));

sortChatsIcon.addEventListener('click', () => {
    chatSort = chatSort === 'recent' ? 'az' : 'recent';

    const ordered = chatSort === 'az'
        ? [...originalChatOrder].sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()))
        : originalChatOrder;

    ordered.forEach(item => chatsBox.appendChild(item));
    sortChatsIcon.classList.toggle('on', chatSort === 'az');
    toast(chatSort === 'az' ? 'Sorted A to Z' : 'Sorted by most recent');
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

/* account menu (click the avatar / name) */

function closeAccountMenu() {
    const menu = document.getElementById('account-menu');
    if (menu) menu.remove();
}

userInfo.addEventListener('click', () => {
    if (document.getElementById('account-menu')) return closeAccountMenu();

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
        else go(choice);
    });
});

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

    showPage(`
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Customize</h1>
            </div>
            <div class="form">
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
                        <span class="row-sub">Name, response style and instructions</span>
                    </div>
                </div>
                <div class="row clickable" data-action="export">
                    <div class="row-main">
                        <span class="row-title">Export data</span>
                        <span class="row-sub">Download your projects, tasks and settings as JSON</span>
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
                        <span class="row-sub">Clear saved projects, tasks and settings</span>
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

function chatRows(list) {
    return list.map(chat => `
        <div class="row clickable" data-action="open-chat" data-chat="${escapeHTML(chat.key)}">
            <div class="row-main">
                <span class="row-title">${escapeHTML(chat.title)}</span>
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

    const term = query.trim().toLowerCase();
    const matches = chatList().filter(chat => !term || chat.title.toLowerCase().includes(term));

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

    const chats = chatList().filter(chat => chat.title.toLowerCase().includes(term));
    const found = projects
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => (project.name + ' ' + project.desc).toLowerCase().includes(term));

    if (!chats.length && !found.length) {
        results.innerHTML = `<div class="empty-state">Nothing matches "${escapeHTML(query)}".</div>`;
        return;
    }

    results.innerHTML = `
        ${chats.length ? `
            <p class="results-label">Chats</p>
            <div class="row-list">${chatRows(chats)}</div>` : ''}
        ${found.length ? `
            <p class="results-label">Projects</p>
            <div class="row-list">
                ${found.map(({ project, index }) => `
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

/* ===================== page actions (one delegated listener) ===================== */

mainContent.addEventListener('input', event => {
    if (event.target.id === 'page-search' && searchHandler) {
        searchHandler(event.target.value);
    }
});

mainContent.addEventListener('click', event => {
    /* Chat / Cowork toggle inside the composer (re-rendered, so delegated) */
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

        case 'new-project':
            if (createProject(false) !== null) renderProjects();
            break;

        case 'open-project':
            setActiveNav(projectsBtn);
            renderProjectDetail(index);
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

        case 'open-chat': {
            const item = originalChatOrder.find(chat => chat.dataset.chat === el.dataset.chat);
            if (item) item.click();
            break;
        }

        case 'export':
            exportData();
            break;

        case 'about':
            toast(`${ASSISTANT_NAME}: ${projects.length} projects, ${tasks.length} tasks, ${designs.length} designs saved`);
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

/* ===================== scripted conversation playback ===================== */

const ABORT = Symbol('aborted');
let playToken = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function renderInline(text) {
    return escapeHTML(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderMarkdown(md) {
    const lines = md.split('\n');
    const blocks = [];
    let i = 0;

    const isBreak = line =>
        line.trim() === '' || line.startsWith('```') || line.startsWith('### ') || /^[-*] /.test(line);

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
        else if (line.startsWith('### ')) {
            blocks.push(`<h3>${renderInline(line.slice(4))}</h3>`);
            i++;
        }
        else if (/^[-*] /.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*] /.test(lines[i])) {
                items.push(`<li>${renderInline(lines[i].slice(2))}</li>`);
                i++;
            }
            blocks.push(`<ul>${items.join('')}</ul>`);
        }
        else {
            const buffer = [];
            while (i < lines.length && !isBreak(lines[i])) {
                buffer.push(lines[i]);
                i++;
            }
            blocks.push(`<p>${renderInline(buffer.join(' '))}</p>`);
        }
    }

    return blocks.join('');
}

function guard(state) {
    if (state.token !== playToken) throw ABORT;
}

async function wait(ms, state) {
    let waited = 0;
    while (waited < ms) {
        if (state.skip) return;
        await sleep(Math.min(40, ms - waited));
        guard(state);
        waited += 40;
    }
}

function place(parent, node, state) {
    parent.appendChild(node);
    parent.appendChild(state.caret);
}

async function streamNode(dest, src, state) {
    if (src.nodeType === Node.TEXT_NODE) {
        const full = src.nodeValue;
        const node = document.createTextNode('');
        place(dest, node, state);

        let shown = 0;
        while (shown < full.length && !state.skip) {
            shown = Math.min(full.length, shown + state.chars);
            node.nodeValue = full.slice(0, shown);
            state.scroll();
            await sleep(18);
            guard(state);
        }

        node.nodeValue = full;
        state.scroll();
        return;
    }

    if (src.nodeType !== Node.ELEMENT_NODE) return;

    const el = src.cloneNode(false);
    place(dest, el, state);

    const previousChars = state.chars;
    if (el.tagName === 'PRE') state.chars = 7;

    for (const child of Array.from(src.childNodes)) {
        await streamNode(el, child, state);
    }

    state.chars = previousChars;
}

async function typeIntoComposer(text, state) {
    state.composer.classList.remove('empty');
    state.composer.textContent = '';
    state.composer.appendChild(state.caret);

    for (let i = 0; i < text.length; i++) {
        if (state.skip) break;
        state.composer.textContent = text.slice(0, i + 1);
        state.composer.appendChild(state.caret);
        await sleep(26 + Math.random() * 34);
        guard(state);
    }

    state.composer.textContent = text;
    state.composer.appendChild(state.caret);
}

function resetComposer(state) {
    state.caret.remove();
    state.composer.classList.add('empty');
    state.composer.textContent = `Reply to ${ASSISTANT_NAME}...`;
}

/* ---------- file operation cards ---------- */

const TOOL_META = {
    write: { verb: 'Write', running: 'Writing\u2026' },
    edit:  { verb: 'Edit',  running: 'Editing\u2026' },
    bash:  { verb: 'Run',   running: 'Running\u2026' }
};

const TOOL_ICONS = {
    write: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.2 1.6H3.6A1.6 1.6 0 0 0 2 3.2v9.6a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V6.4z"/>
                <path d="M9.2 1.6v4.8H14"/>
            </svg>`,
    edit:  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11.4 2.2 13.8 4.6 6 12.4l-3.1.7.7-3.1z"/>
                <path d="M10 3.6 12.4 6"/>
            </svg>`,
    bash:  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 4.5 6.2 8 3 11.5"/>
                <line x1="8.2" y1="11.6" x2="13" y2="11.6"/>
            </svg>`
};

const PREVIEW_LIMIT = 120;
const COLLAPSE_ROWS = 14;

function toolRows(part) {
    const rows = [];

    if (part.type === 'bash') {
        (part.out || '').split('\n').forEach(line => rows.push({ cls: 'out', text: line }));
        return rows;
    }

    if (part.type === 'write') {
        const lines = (part.code || '').split('\n');
        lines.slice(0, PREVIEW_LIMIT).forEach(line => rows.push({ cls: 'ctx', text: line }));

        const hidden = (part.lines || lines.length) - Math.min(lines.length, PREVIEW_LIMIT);
        if (hidden > 0) rows.push({ cls: 'more', text: '\u2026 ' + hidden + ' more lines' });
        return rows;
    }

    (part.diff || []).forEach(line => {
        const mark = line.charAt(0);
        rows.push({
            cls: mark === '+' ? 'add' : mark === '-' ? 'del' : 'ctx',
            text: line
        });
    });
    return rows;
}

function toolDoneLabel(part) {
    if (part.type === 'write') {
        return '<span class="stat add">+' + (part.lines || 0) + '</span> lines';
    }
    if (part.type === 'edit') {
        return '<span class="stat add">+' + (part.add || 0) + '</span>' +
               '<span class="stat del">\u2212' + (part.del || 0) + '</span>';
    }
    return 'Done';
}

async function playToolPart(body, part, state) {
    const meta = TOOL_META[part.type];
    if (!meta) return;

    const card = document.createElement('div');
    card.className = 'tool-card running ' + part.type;
    card.innerHTML = `
        <div class="tool-head">
            ${TOOL_ICONS[part.type]}
            <span class="tool-verb">${meta.verb}</span>
            <span class="tool-file">${escapeHTML(part.file || part.cmd || '')}</span>
            <span class="tool-status"><span class="tool-dot"></span>${meta.running}</span>
        </div>
        <div class="tool-body"></div>
    `;
    body.appendChild(card);
    state.scroll();

    await wait(part.think || 700, state);

    const rows = toolRows(part);
    const target = card.querySelector('.tool-body');
    const delay = Math.max(16, Math.min(55, 900 / Math.max(1, rows.length)));

    for (const row of rows) {
        const line = document.createElement('div');
        line.className = 'dl ' + row.cls;
        line.textContent = row.text === '' ? ' ' : row.text;
        target.appendChild(line);
        state.scroll();

        if (!state.skip) {
            await sleep(delay);
            guard(state);
        }
    }

    card.classList.remove('running');
    card.classList.add('done');
    card.querySelector('.tool-status').innerHTML = toolDoneLabel(part);

    target.scrollTop = 0;

    if (rows.length > COLLAPSE_ROWS) {
        const toggle = document.createElement('button');
        toggle.className = 'tool-more';
        toggle.textContent = 'Show all ' + rows.length + ' lines';

        toggle.addEventListener('click', event => {
            event.stopPropagation();
            const open = card.classList.toggle('expanded');
            toggle.textContent = open ? 'Show less' : 'Show all ' + rows.length + ' lines';
        });

        card.appendChild(toggle);
    }

    state.scroll();
}

async function playMessage(message, state) {
    await wait(message.pause || 400, state);

    if (message.role === 'user') {
        await typeIntoComposer(message.text, state);
        await wait(320, state);
        resetComposer(state);

        const bubble = document.createElement('div');
        bubble.className = 'msg user';
        bubble.innerHTML = `<div class="msg-body"></div>`;
        bubble.querySelector('.msg-body').textContent = message.text;
        state.list.appendChild(bubble);
        state.scroll();
        await wait(420, state);
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    wrap.innerHTML = `
        <div class="msg-head">
            <img src="assets/claude.png" alt="${ASSISTANT_NAME}" width="18" height="18">
            ${ASSISTANT_NAME}
        </div>
        <div class="msg-body"><div class="thinking"><span></span><span></span><span></span></div></div>
    `;
    state.list.appendChild(wrap);
    state.scroll();

    await wait(900, state);

    const body = wrap.querySelector('.msg-body');
    body.innerHTML = '';

    const parts = message.parts || [{ type: 'text', text: message.text }];

    for (const part of parts) {
        if (part.type === 'text') {
            const source = document.createElement('div');
            source.innerHTML = renderMarkdown(part.text);

            state.chars = part.speed || message.speed || 2;
            for (const child of Array.from(source.childNodes)) {
                await streamNode(body, child, state);
            }
            state.caret.remove();
        }
        else {
            await playToolPart(body, part, state);
        }
    }

    state.caret.remove();
    state.scroll();
}

async function playConversation(conversation, state) {
    try {
        for (const message of conversation.messages) {
            await playMessage(message, state);
        }
        resetComposer(state);
        state.scroll();
        state.hint.textContent = 'End of conversation — hit Replay to watch it again.';
    }
    catch (error) {
        if (error !== ABORT) throw error;
    }
}

function openConversation(key) {
    const conversation = CONVERSATIONS[key];
    if (!conversation) return;

    resetMain();
    applyMode('chat');
    mainContent.classList.add('chat-mode');
    mainContent.innerHTML = `
        <div class="chat-view">
            <div class="chat-topbar">
                <span>${conversation.title}</span>
                <button class="replay-btn" id="replay-btn">↻ Replay</button>
            </div>

            <div class="transcript" id="transcript">
                <div class="transcript-inner" id="transcript-inner"></div>
            </div>

            <div class="composer-area">
                <div class="input-card">
                    <div class="composer-text empty" id="composer-text">Reply to ${ASSISTANT_NAME}...</div>

                    <div class="input-controls">
                        <div class="left-controls">
                            <span class="add-icon">+</span>
                            <div class="mode-toggle">
                                <button class="toggle-btn active">Chat</button>
                                <button class="toggle-btn">Cowork</button>
                            </div>
                        </div>

                        <div class="right-controls">
                            <span>Opus 5 High</span>
                            <span>∨</span>
                        </div>
                    </div>
                </div>
                <div class="skip-hint" id="skip-hint">Click anywhere to skip ahead</div>
            </div>
        </div>
    `;

    const transcript = document.getElementById('transcript');
    const caret = document.createElement('span');
    caret.className = 'caret';

    const state = {
        token: playToken,
        skip: false,
        chars: 2,
        caret: caret,
        list: document.getElementById('transcript-inner'),
        composer: document.getElementById('composer-text'),
        hint: document.getElementById('skip-hint'),
        scroll: () => { transcript.scrollTop = transcript.scrollHeight; }
    };

    mainContent.querySelector('.chat-view').addEventListener('click', event => {
        if (event.target.closest('#replay-btn')) return;
        state.skip = true;
        state.hint.textContent = '';
    });

    document.getElementById('replay-btn').addEventListener('click', () => openConversation(key));

    playConversation(conversation, state);
}

chatItems.forEach(item => {
    item.addEventListener('click', () => {
        chatItems.forEach(other => other.classList.remove('active'));
        item.classList.add('active');
        setActiveNav(null);
        openConversation(item.dataset.chat);
    });
});

/* ===================== start up ===================== */

document.title = document.title.replace(/Claude/g, ASSISTANT_NAME);
applyMode('chat');
setActiveNav(newChatBtn);
refreshSidebar();
showHome();
