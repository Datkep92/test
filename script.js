//1. Utility Functions (Hàm tiện ích chung)
const config = {
    corsProxy: 'https://api.allorigins.win/get?url=', // Proxy để tránh CORS
    imageProxy: 'https://images.weserv.nl/?url=', // Proxy tối ưu hóa hình ảnh
    defaultImage: 'https://cuacuondaiphucvinh.com/wp-content/uploads/2024/12/icon-loi.jpg', // Ảnh mặc định
    requestTimeout: 15000, // Thời gian chờ request (ms)
    maxLinks: 3000, // Số link tối đa
    maxUndoSteps: 20, // Số bước hoàn tác tối đa
    maxLogs: 100, // Số log tối đa
    scrollDuration: 1000, // Thời gian cuộn (ms)
    toastDuration: 3000, // Thời gian hiển thị toast (ms)
    githubToken: localStorage.getItem('githubToken') || 'chưa có', // Token GitHub
    debounceDelay: 500, // Độ trễ debounce (ms)
    fanpageGistUrl: 'https://api.github.com/gists/eaa7aafb85a6fe7546f6c6434b93810c', // Gist cho Jsonfanpage, Jsonalllink, Jsonlink
    backupUrl: 'http://127.0.0.1:10000', // URL WebDAV backup
    dataFile: '/var/mobile/new/data-fb.json', // File lưu trữ dữ liệu
    fanpagesPerPage: 20, // Số fanpage hiển thị mỗi trang
    maxRetries: 3, // Số lần thử lại
    retryDelay: 1000 // Delay giữa các lần thử lại (ms)
};
const state = {
    links: [],
    fanpages: [],
    logs: [],
    scrollPosition: 0,
    filterScrollPosition: 0,
    currentTab: 'all-link',
    lastActiveTab: 'all-link',
    currentFilter: 'all',
    dateFilter: { searchQuery: '', dateQuery: '' },
    fanpageFilter: { currentPage: 1 },
    filterKeywords: [],
    isLoading: false,
    disableRender: false,
    undoStack: [],
    scrollState: 0 // Thêm để theo dõi trạng thái cuộn (0: xuống, 1: lên)
};
// Các phần tử DOM
const elements = {
    mainContent: document.querySelector('.scroll-container'), // Container chính
    tabContainer: document.querySelector('.tab-container'), // Container các tab
    linkLists: { // Danh sách container tab
        'all-link': document.getElementById('all-link-tab'),
        'blacklist': document.getElementById('blacklist-tab'),
        'date-filter': document.getElementById('date-filter-tab'),
        'error': document.getElementById('error-tab'),
        'duplicate': document.getElementById('duplicate-tab'),
        'log': document.getElementById('log-tab'),
        'filter': document.getElementById('filter-tab'),
        'fanpage': document.getElementById('fanpage-tab') // Tab Fanpage
    },
    headerBtns: {
        add: document.getElementById('add-link-btn'),
        delete: document.getElementById('delete-btn'),
        undo: document.getElementById('undo-btn'),
        scroll: document.getElementById('scroll-btn'),
        log: document.getElementById('log-btn'),
        fanpage: document.getElementById('fanpage-btn') // Thêm nút Fanpage
    },
    statusCounters: { // Bộ đếm trạng thái
        all: document.querySelector('#all-counter .count'),
        filter: document.querySelector('#filter-counter .count')
    },
    selectAllCounter: { // Bộ đếm chọn tất cả
        btn: document.getElementById('select-all-counter-btn'),
        count: document.querySelector('#select-all-counter-btn .selected-count')
    },
    fanpageControls: null // Sẽ được khởi tạo trong renderFanpageTab
};
// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
function isLinkExists(url) {
    const baseUrl = url.split('?')[0];
    return state.links.some(link => link.url.split('?')[0] === baseUrl);
}
function updateCounters() {
    let total, selected;
    if (state.currentTab === 'filter' && state.lastActiveTab === 'fanpage') {
        const fanpages = getFilteredFanpages(state.currentFilter || 'all');
        total = fanpages.length;
        selected = fanpages.filter(f => f.checked).length;
    } else {
        const links = getLinksForCurrentTab();
        total = links.length;
        selected = links.filter(l => l.checked).length;
    }

    if (elements.statusCounters.all) {
        elements.statusCounters.all.textContent = total;
    }
    if (elements.statusCounters.filter) {
        elements.statusCounters.filter.textContent = total;
    }
    if (elements.selectAllCounter.count) {
        elements.selectAllCounter.count.textContent = selected || 0;
    }
}
function formatDateTime(date) {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}
function decodeHTMLEntities(text) {
    if (!text) return '';
    return text
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#([0-9]+);/g, (_, num) => String.fromCharCode(num));
}
function determinePostType(url) {
    if (url.includes('/groups/')) return 'group';
    if (url.includes('/reel/')) return 'reel';
    if (url.includes('/story/')) return 'story';
    if (url.includes('/videos/') || url.includes('/video/')) return 'video';
    if (url.includes('/photo/') || url.includes('/photos/')) return 'photo';
    if (url.includes('/posts/')) return 'post';
    if (url.match(/\/[0-9]+\/$/) || url.match(/\/[^\/]+\/$/)) return 'profile';
    return 'unknown';
}
// Hàm tạo popup chung
function createPopup(config) {
    // Tạo overlay
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay ${config.customClass || ''}`;

    // Tạo dialog
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    if (config.customStyle) dialog.style.cssText = config.customStyle;

    // Tạo header
    const header = document.createElement('div');
    header.className = 'modal-header';
    if (config.headerStyle) header.style.cssText = config.headerStyle;
    header.innerHTML = `
        <h3>${config.title}</h3>
        <button class="modal-close">×</button>
    `;

    // Tạo body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (config.bodyStyle) body.style.cssText = config.bodyStyle;
    body.innerHTML = config.content;

    // Tạo footer nếu có buttons
    let footer = null;
    if (config.buttons?.length > 0) {
        footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.innerHTML = config.buttons.map(btn => `
            <button id="${btn.id}" 
                    class="btn ${btn.class || ''}" 
                    ${btn.title ? `title="${btn.title}"` : ''}
                    style="${btn.style || ''}">
                ${btn.icon ? `<i class="${btn.icon}"></i>` : ''}
                ${btn.text}
            </button>
        `).join('');
    }

    // Lắp ráp popup
    dialog.append(header, body);
    if (footer) dialog.append(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Hàm đóng popup
    const closePopup = () => document.body.removeChild(overlay);

    // Xử lý sự kiện đóng
    overlay.querySelector('.modal-close').addEventListener('click', closePopup);

    return {
        element: overlay,
        close: closePopup,
        // Tham chiếu đến các phần tử quan trọng
        refs: {
            dialog,
            header,
            body,
            footer
        }
    };
}
function showNoteDialog(link) {
    const { close } = createPopup({
        title: 'Thêm ghi chú',
        content: `<input type="text" id="note-input" placeholder="Nhập ghi chú..." value="${link.note || ''}">`,
        buttons: [
            { id: 'note-confirm', text: 'Lưu', class: 'btn-primary' },
            { id: 'note-cancel', text: 'Hủy', class: 'btn-secondary' }
        ]
    });

    const input = document.getElementById('note-input');
    const confirmBtn = document.getElementById('note-confirm');
    const cancelBtn = document.getElementById('note-cancel');

    confirmBtn.addEventListener('click', () => {
        saveBackup('note', { linkId: link.id, note: link.note });
        link.note = input.value.trim();
        saveData({ links: true });
        updateLinkItem(link);
        showToast('Đã lưu ghi chú', 'success');
        addLog(`Đã thêm ghi chú cho link: ${link.url} (ID: ${link.id})`, 'info');
        close();
    });

    cancelBtn.addEventListener('click', close);
}
function filterByBlockedTitle(links) {
    const blockedKeywords = state.config.blockedKeywords || [];

    return links.filter(link => {
        const title = (link.title || '').toLowerCase();
        return !blockedKeywords.some(keyword => title.includes(keyword.toLowerCase()));
    });
}
function showAddLinkDialog() {
    const { element: dialog, close } = createPopup({
        title: 'Thêm Link hoặc Fanpage',
        customStyle: 'width: 400px; padding-top: 16px;',
        content: `
            <div class="input-row" style="margin-bottom: 8px;">
                <label style="font-size: 13px; margin-bottom: 4px;">Loại dữ liệu:</label>
                <select id="item-type" class="modal-select" style="width: 100%; padding: 5px; font-size: 13px;">
                    <option value="link">Link</option>
                    <option value="fanpage">Fanpage/Profile</option>
                </select>
            </div>

            <!-- Form cho Link -->
            <div id="link-form" class="item-form">
                <div class="input-row" style="margin-bottom: 8px;">
                    <textarea id="new-links-input" class="modal-textarea" 
                              placeholder="URL mỗi dòng..."
                              style="width: 100%; height: 60px; resize: none; padding: 5px; font-size: 13px;"></textarea>
                </div>
                <div class="config-row" style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <label style="width: 90px; font-size: 13px;">GitHub Token:</label>
                    <input type="text" id="github-token-input" value="${config.githubToken}" style="flex: 1; padding: 5px; font-size: 13px;">
                    <button id="confirm-token-btn" class="btn" style="width: 56px; padding: 5px 0; font-size: 13px;">Lưu</button>
                </div>
                <div class="config-row" style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <label style="width: 90px; font-size: 13px;">Gist ID:</label>
                    <input type="text" id="github-id-input" value="${config.fanpageGistUrl?.split('/').pop() || ''}" style="flex: 1; padding: 5px; font-size: 13px;">
                    <button id="confirm-id-btn" class="btn" style="width: 56px; padding: 5px 0; font-size: 13px;">Lưu</button>
                </div>
            </div>

            <!-- Form cho Fanpage -->
            <div id="fanpage-form" class="item-form" style="display: none;">
                <div class="add-fanpage-form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 13px;">Tìm kiếm Fanpage</label>
                    <input type="text" id="fanpage-search" placeholder="Nhập tên fanpage..." class="add-fanpage-form-control" style="width: 100%; padding: 5px; font-size: 13px;">
                    <div id="fanpage-search-results" class="search-results" style="max-height: 130px; overflow-y: auto; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; padding: 4px;"></div>
                </div>
                <div class="add-fanpage-form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 13px;">URL Fanpage/Profile</label>
                    <input type="text" id="fanpage-url" placeholder="Nhập URL" class="add-fanpage-form-control" style="width: 100%; padding: 5px; font-size: 13px;">
                </div>
                <div class="add-fanpage-form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 13px;">Tiêu đề</label>
                    <div class="title-input-group" style="display: flex; gap: 6px;">
                        <input type="text" id="fanpage-title" placeholder="Nhập tiêu đề" class="add-fanpage-form-control" style="flex: 1; padding: 5px; font-size: 13px;">
                        <button id="edit-title-btn" class="btn-edit" title="Sửa tiêu đề" style="width: 36px;">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="add-fanpage-form-group">
                    <label style="font-size: 13px;">Loại Profile</label>
                    <div class="profile-selector" style="display: flex; gap: 6px; margin-top: 6px;">
                        <button class="profile-btn active" data-type="fanpage">🌟 Fanpage</button>
                        <button class="profile-btn" data-type="profile">👤 Cá nhân</button>
                        <button class="profile-btn" data-type="profile-pro">⭐ Pro</button>
                    </div>
                </div>
            </div>

            <!-- Action buttons -->
            <div class="action-buttons" style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                <button id="add-item-confirm" class="btn btn-add">Thêm</button>
                <button id="import-json-lines" class="btn btn-item">Item</button>
                <button id="import-json-array" class="btn btn-all">All</button>
                <button id="filter-keyword-btn" class="btn btn-block">Block</button>
                <button id="import-fanpage-json" class="btn btn-secondary" style="display: none;">Nhập JSON</button>
                <button id="cancel-add-item" class="btn btn-cancel">Hủy</button>
            </div>

            <style>
                .modal-select, .modal-textarea, .add-fanpage-form-control {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .item-form { margin-bottom: 8px; }
                .search-results { max-height: 130px; overflow-y: auto; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; padding: 4px; }
                .search-result-item { padding: 4px; cursor: pointer; border-bottom: 1px solid #eee; }
                .search-result-item:hover { background: #f0f0f0; }
                .search-result-item:last-child { border-bottom: none; }
                .profile-selector { display: flex; gap: 6px; }
                .profile-btn { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; text-align: center; font-size: 12px; }
                .profile-btn.active { background: #007bff; color: white; border-color: #007bff; }
                .title-input-group { display: flex; gap: 6px; }
                .btn-edit { background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
                .btn-add { background-color: #28a745; color: white; }
                .btn-item { background-color: #17a2b8; color: white; }
                .btn-all { background-color: #007bff; color: white; }
                .btn-block { background-color: #ffc107; color: black; }
                .btn-cancel { background-color: #dc3545; color: white; }
                .btn-secondary { background-color: #6c757d; color: white; }
                .btn:hover { opacity: 0.9; }
            </style>
        `,
        buttons: []
    });

    let selectedType = 'link';
    let selectedProfileType = 'fanpage';

    // Toggle form dựa trên item-type
    const toggleForm = () => {
        const linkForm = dialog.querySelector('#link-form');
        const fanpageForm = dialog.querySelector('#fanpage-form');
        const importJsonBtn = dialog.querySelector('#import-fanpage-json');
        const linkActionButtons = ['import-json-lines', 'import-json-array', 'filter-keyword-btn'];

        if (selectedType === 'link') {
            linkForm.style.display = 'block';
            fanpageForm.style.display = 'none';
            importJsonBtn.style.display = 'none';
            linkActionButtons.forEach(id => dialog.querySelector(`#${id}`).style.display = 'inline-block');
        } else {
            linkForm.style.display = 'none';
            fanpageForm.style.display = 'block';
            importJsonBtn.style.display = 'inline-block';
            linkActionButtons.forEach(id => dialog.querySelector(`#${id}`).style.display = 'none');
        }
    };

    // Xử lý dropdown item-type
    dialog.querySelector('#item-type').addEventListener('change', (e) => {
        selectedType = e.target.value;
        toggleForm();
        // Reset input
        dialog.querySelector('#new-links-input').value = '';
        dialog.querySelector('#fanpage-search').value = '';
        dialog.querySelector('#fanpage-url').value = '';
        dialog.querySelector('#fanpage-title').value = '';
        dialog.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
        dialog.querySelector('.profile-btn[data-type="fanpage"]').classList.add('active');
        selectedProfileType = 'fanpage';
    });

    // Khởi tạo form
    toggleForm();

    // Debounced search cho fanpage
    const debouncedSearch = debounce((query) => {
        const resultsContainer = dialog.querySelector('#fanpage-search-results');
        resultsContainer.innerHTML = '';
        if (!query) return;

        const filteredFanpages = state.fanpages.filter(f =>
            removeVietnameseTones(f.name.toLowerCase()).includes(removeVietnameseTones(query.toLowerCase()))
        );

        if (filteredFanpages.length === 0) {
            resultsContainer.innerHTML = '<p>Không tìm thấy fanpage</p>';
        } else {
            filteredFanpages.forEach(f => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = f.name;
                resultItem.addEventListener('click', () => {
                    dialog.querySelector('#fanpage-url').value = f.url;
                    dialog.querySelector('#fanpage-title').value = f.name;
                    dialog.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
                    dialog.querySelector(`.profile-btn[data-type="${f.type}"]`).classList.add('active');
                    selectedProfileType = f.type;
                });
                resultsContainer.appendChild(resultItem);
            });
        }
    }, config.debounceDelay);

    // Xử lý sự kiện
    dialog.querySelector('#fanpage-search').addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim());
    });

    dialog.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            dialog.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedProfileType = this.dataset.type;
        });
    });

    dialog.querySelector('#edit-title-btn').addEventListener('click', () => {
        dialog.querySelector('#fanpage-title').focus();
    });

    dialog.querySelector('#confirm-token-btn').addEventListener('click', () => {
        const token = dialog.querySelector('#github-token-input').value.trim();
        if (token) {
            config.githubToken = token;
            localStorage.setItem('githubToken', token);
            showToast('Đã lưu token', 'success');
        }
    });

    dialog.querySelector('#confirm-id-btn').addEventListener('click', () => {
        const id = dialog.querySelector('#github-id-input').value.trim();
        if (id) {
            config.fanpageGistUrl = `https://api.github.com/gists/${id}`;
            localStorage.setItem('fanpageGistUrl', config.fanpageGistUrl);
            showToast('Đã lưu Gist ID', 'success');
        }
    });

    dialog.querySelector('#add-item-confirm').addEventListener('click', () => {
        if (selectedType === 'link') {
            const urls = dialog.querySelector('#new-links-input').value.trim().split('\n').map(l => l.trim()).filter(Boolean);
            const filteredUrls = filterByKeywords(urls);

            if (filteredUrls.length === 0) {
                showToast('Không có link nào sau lọc', 'warning');
                return;
            }

            const newLinks = filteredUrls
                .filter(url => !isLinkExists(url))
                .map(url => ({
                    id: generateId(),
                    url,
                    title: 'Đang xử lý...',
                    description: '',
                    image: '',
                    status: 'pending',
                    post_type: determinePostType(url),
                    date: new Date().toISOString(),
                    checked: false,
                    blacklistStatus: 'active',
                    note: ''
                }));

            if (newLinks.length > 0) {
                state.newItemId = newLinks[0].id; // Lưu ID của link đầu tiên để highlight
                state.links.unshift(...newLinks);
                saveBackup('addLinks', { links: newLinks });
                saveData({ links: true });
                updateCounters();
                state.currentTab = 'all-link';

                // Kích hoạt tab all-link trên giao diện
                const allLinkTabBtn = document.querySelector('#all-link');
                if (allLinkTabBtn) {
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    allLinkTabBtn.classList.add('active');
                }

                renderTabContent('all-link');
                highlightAndScrollToItem(newLinks[0].id);
                showToast(`Đã thêm ${newLinks.length} link`, 'success');
                newLinks.forEach(link => setTimeout(() => extractContent(link.url), 0));
            }
        } else {
            const url = dialog.querySelector('#fanpage-url').value.trim();
            const title = dialog.querySelector('#fanpage-title').value.trim();

            if (!isValidUrl(url)) return showToast('URL không hợp lệ', 'warning');
            if (!title) return showToast('Vui lòng nhập tiêu đề', 'warning');

            const newFanpage = {
                id: generateId(),
                url,
                name: title,
                description: '',
                type: selectedProfileType,
                date: new Date().toISOString(),
                checked: false,
                status: 'pending',
                thumbnail: config.defaultImage
            };

            state.newItemId = newFanpage.id; // Lưu ID để highlight
            state.fanpages.unshift(newFanpage);
            saveBackup('addFanpages', { fanpages: [newFanpage] });
            saveData({ fanpages: true });
            updateCounters();

            // Chuyển sang tab filter, hiển thị danh sách fanpage
            state.currentTab = 'filter';
            state.lastActiveTab = 'fanpage';
            state.currentFilter = 'all';

            // Kích hoạt tab filter trên giao diện
            const filterTabBtn = document.querySelector('#filter');
            if (filterTabBtn) {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                filterTabBtn.classList.add('active');
            } else {
                console.error('Không tìm thấy nút tab filter');
                addLog('Không tìm thấy nút tab filter', 'error');
                showToast('Lỗi chuyển tab filter', 'error');
            }

            // Render danh sách fanpage
            const container = elements.linkLists['filter'] || document.querySelector('#filter-results');
            if (container) {
                container.innerHTML = ''; // Xóa nội dung cũ
                renderFilteredResults(container, state.currentFilter, 'fanpages');
                setTimeout(() => highlightAndScrollToItem(newFanpage.id), 0); // Delay nhẹ để đảm bảo render hoàn tất
            } else {
                console.error('Không tìm thấy container cho tab filter');
                addLog('Không tìm thấy container cho tab filter', 'error');
                showToast('Lỗi hiển thị danh sách fanpage', 'error');
            }

            showToast(`Đã thêm ${selectedProfileType === 'fanpage' ? 'Fanpage' : 'Profile'} mới`, 'success');
            addLog(`Đã thêm fanpage: ${title} (ID: ${newFanpage.id})`, 'success');
        }
        close();
    });

    dialog.querySelector('#import-json-lines').addEventListener('click', () => {
        close();
        importLinksFromJsonLines();
    });

    dialog.querySelector('#import-json-array').addEventListener('click', () => {
        close();
        importFromJSON();
    });

    dialog.querySelector('#filter-keyword-btn').addEventListener('click', () => {
        close();
        showFilterKeywordsPopup();
    });

    dialog.querySelector('#import-fanpage-json').addEventListener('click', () => {
        close();
        importFanpagesFromJSON();
    });

    dialog.querySelector('#cancel-add-item').addEventListener('click', close);
}

// Hàm highlight và cuộn tới item
function highlightAndScrollToItem(itemId) {
    const itemEl = document.querySelector(`.link-item[data-id="${itemId}"]`);
    if (itemEl) {
        itemEl.classList.add('new-item');
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => itemEl.classList.remove('new-item'), 3000);
    } else {
        console.error(`Không tìm thấy item với ID: ${itemId}`);
        addLog(`Không tìm thấy item với ID: ${itemId}`, 'error');
    }
}
function showSelectionActionsDialog(count) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <h3>Đã chọn ${count} mục</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <button id="delete-selected" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                    ${state.currentTab !== 'fanpage' ? `
                    <button id="export-gist" class="btn btn-primary">
                        <i class="fas fa-code-branch"></i> Xuất Gist
                    </button>
                    <button id="export-url" class="btn btn-primary">
                        <i class="fas fa-link"></i> Xuất URL
                    </button>
                    ` : ''}
                    <button id="unselect-all" class="btn btn-secondary">
                        <i class="fas fa-times"></i> Bỏ chọn
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#delete-selected').addEventListener('click', () => {
        if (state.currentTab === 'fanpage') {
            deleteSelectedFanpages();
        } else {
            deleteSelected();
        }
        document.body.removeChild(dialog);
    });

    if (state.currentTab !== 'fanpage') {
        dialog.querySelector('#export-gist').addEventListener('click', () => {
            const selectedLinks = state.links.filter(l => l.checked);
            exportToGist(selectedLinks);
            document.body.removeChild(dialog);
        });

        dialog.querySelector('#export-url').addEventListener('click', () => {
            const selectedLinks = state.links.filter(l => l.checked);
            if (selectedLinks.length === 0) {
                showToast('Vui lòng chọn ít nhất một link để xuất URL', 'warning');
                return;
            }
            exportUrlsToGist(selectedLinks);
            document.body.removeChild(dialog);
        });
    }

    dialog.querySelector('#unselect-all').addEventListener('click', () => {
        if (state.currentTab === 'fanpage') {
            const fanpages = getFilteredFanpages(currentFilter);
            fanpages.forEach(f => f.checked = false);
            saveData({ fanpages: true });
        } else {
            const links = getLinksForCurrentTab();
            links.forEach(l => l.checked = false);
            saveData({ links: true });
        }
        renderTabContent(state.currentTab);
        document.body.removeChild(dialog);
    });

    dialog.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

function showAddFanpageDialog() {
    const { element: dialog, close } = createPopup({
        title: 'Thêm Fanpage/Profile',
        customClass: 'add-fanpage-modal',
        content: `
            <div class="add-fanpage-form-group">
                <label>Tìm kiếm Fanpage</label>
                <input type="text" id="fanpage-search" placeholder="Nhập tên fanpage để tìm..." class="add-fanpage-form-control">
                <div id="fanpage-search-results" class="search-results"></div>
            </div>
            <div class="add-fanpage-form-group">
                <label>URL Fanpage/Profile</label>
                <input type="text" id="fanpage-url" placeholder="Nhập URL" class="add-fanpage-form-control">
            </div>
            <div class="add-fanpage-form-group">
                <label>Tiêu đề</label>
                <div class="title-input-group">
                    <input type="text" id="fanpage-title" placeholder="Nhập tiêu đề" class="add-fanpage-form-control">
                    <button id="edit-title-btn" class="btn-edit" title="Sửa tiêu đề">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            <div class="add-fanpage-form-group">
                <label>Loại Profile</label>
                <div class="profile-selector">
                    <button class="profile-btn active" data-type="fanpage"><i class="fas fa-flag"></i> Fanpage</button>
                    <button class="profile-btn" data-type="profile"><i class="fas fa-user"></i> Cá nhân</button>
                    <button class="profile-btn" data-type="profile-pro"><i class="fas fa-star"></i> Pro</button>
                </div>
            </div>
            <style>
                .search-results {
                    max-height: 150px;
                    overflow-y: auto;
                    margin-top: 5px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 5px;
                }
                .search-result-item {
                    padding: 5px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                }
                .search-result-item:hover {
                    background: #f0f0f0;
                }
                .search-result-item:last-child {
                    border-bottom: none;
                }
                .profile-selector {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .profile-btn {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: center;
                }
                .profile-btn.active {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }
                .title-input-group {
                    display: flex;
                    gap: 8px;
                }
                .btn-edit {
                    background: #f8f9fa;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 40px;
                }
            </style>
        `,
        buttons: [
            { id: 'import-fanpage-json', text: 'Nhập JSON', class: 'btn-secondary' },
            { id: 'cancel-add-fanpage', text: 'Hủy', class: 'btn-secondary' },
            { id: 'confirm-add-fanpage', text: 'Thêm', class: 'btn-primary' }
        ]
    });

    let selectedType = 'fanpage';

    // Debounced search function
    const debouncedSearch = debounce((query) => {
        const resultsContainer = dialog.querySelector('#fanpage-search-results');
        resultsContainer.innerHTML = '';
        if (!query) return;

        const filteredFanpages = state.fanpages.filter(f =>
            removeVietnameseTones(f.name.toLowerCase()).includes(removeVietnameseTones(query.toLowerCase()))
        );

        if (filteredFanpages.length === 0) {
            resultsContainer.innerHTML = '<p>Không tìm thấy fanpage</p>';
        } else {
            filteredFanpages.forEach(f => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = f.name;
                resultItem.addEventListener('click', () => {
                    dialog.querySelector('#fanpage-url').value = f.url;
                    dialog.querySelector('#fanpage-title').value = f.name;
                    dialog.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
                    dialog.querySelector(`.profile-btn[data-type="${f.type}"]`).classList.add('active');
                    selectedType = f.type;
                });
                resultsContainer.appendChild(resultItem);
            });
        }
    }, config.debounceDelay);

    // Xử lý sự kiện
    dialog.querySelector('#fanpage-search').addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim());
    });

    dialog.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            dialog.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedType = this.dataset.type;
        });
    });

    dialog.querySelector('#edit-title-btn').addEventListener('click', () => {
        dialog.querySelector('#fanpage-title').focus();
    });

    dialog.querySelector('#confirm-add-fanpage').addEventListener('click', () => {
        const url = dialog.querySelector('#fanpage-url').value.trim();
        const title = dialog.querySelector('#fanpage-title').value.trim();

        if (!isValidUrl(url)) return showToast('URL không hợp lệ', 'warning');
        if (!title) return showToast('Vui lòng nhập tiêu đề', 'warning');

        const newFanpage = {
            id: generateId(),
            url,
            name: title,
            description: '',
            type: selectedType,
            date: new Date().toISOString(),
            checked: false,
            status: 'pending',
            thumbnail: config.defaultImage
        };

        state.fanpages.unshift(newFanpage);
        saveBackup('addFanpages', { fanpages: [newFanpage] });
        saveData({ fanpages: true });
        updateFanpageList();
        highlightAndScrollToFanpage(newFanpage.id);
        updateCounters();
        showToast(`Đã thêm ${selectedType === 'fanpage' ? 'Fanpage' : 'Profile'} mới`, 'success');
        addLog(`Đã thêm fanpage: ${title} (ID: ${newFanpage.id})`, 'success');
        close();
    });

    dialog.querySelector('#import-fanpage-json').addEventListener('click', () => {
        importFanpagesFromJSON();
        close();
    });

    dialog.querySelector('#cancel-add-fanpage').addEventListener('click', close);
};
function showEditFanpagePopup(fanpage) {
    const { element: popup, close } = createPopup({
        title: `🛠️ Sửa Fanpage`,
        customClass: 'edit-fanpage-modal',
        content: `
            <div class="edit-fanpage-form-row">
                <span>🔗</span>
                <input type="text" id="edit-fanpage-url" value="${fanpage.url}" 
                       class="edit-fanpage-form-control" placeholder="URL Fanpage">
            </div>
            <div class="edit-fanpage-form-row">
                <span>📝</span>
                <input type="text" id="edit-fanpage-title" value="${fanpage.name}" 
                       class="edit-fanpage-form-control" placeholder="Tên Fanpage">
            </div>
            <div class="edit-fanpage-form-row">
                <span>💬</span>
                <textarea id="edit-fanpage-description" class="edit-fanpage-form-control"
                          placeholder="Mô tả">${fanpage.description || ''}</textarea>
            </div>
            <div class="edit-fanpage-btn-group">
                <button class="edit-fanpage-type-btn ${fanpage.type === 'fanpage' ? 'active' : ''}" 
                        data-type="fanpage" title="Fanpage thông thường">
                    <i class="fas fa-flag"></i> Fanpage
                </button>
                <button class="edit-fanpage-type-btn ${fanpage.type === 'profile' ? 'active' : ''}" 
                        data-type="profile" title="Trang cá nhân">
                    <i class="fas fa-user"></i> Cá nhân
                </button>
                <button class="edit-fanpage-type-btn ${fanpage.type === 'profile-pro' ? 'active' : ''}" 
                        data-type="profile-pro" title="Trang cá nhân Pro">
                    <i class="fas fa-star"></i> Pro
                </button>
            </div>
           
        `,
        buttons: [
            {
                id: 'delete-fanpage',
                text: '<i class="fas fa-trash"></i> Xóa',
                class: 'btn-danger',
                style: 'margin-right: auto;'
            },
            { id: 'cancel-edit', text: '<i class="fas fa-times"></i> Hủy', class: 'btn-secondary' },
            { id: 'save-fanpage', text: '<i class="fas fa-save"></i> Lưu', class: 'btn-primary' }
        ]
    });

    // Xử lý sự kiện
    popup.querySelectorAll('.edit-fanpage-type-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            popup.querySelectorAll('.edit-fanpage-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    popup.querySelector('#save-fanpage').addEventListener('click', () => {
        const url = popup.querySelector('#edit-fanpage-url').value.trim();
        const name = popup.querySelector('#edit-fanpage-title').value.trim();
        const description = popup.querySelector('#edit-fanpage-description').value.trim();
        const type = popup.querySelector('.edit-fanpage-type-btn.active').dataset.type;

        if (!isValidUrl(url)) {
            showToast('URL không hợp lệ', 'warning');
            return;
        }

        if (!name) {
            showToast('Tiêu đề không được để trống', 'warning');
            return;
        }

        saveBackup('editFanpage', {
            fanpage: {
                ...fanpage,
                status: fanpage.status,
                lastChecked: fanpage.lastChecked
            }
        });

        Object.assign(fanpage, {
            url,
            name,
            description,
            type,
            status: 'pending',
            lastChecked: null
        });

        saveData({ fanpages: true });
        updateFanpageList();
        updateCounters();
        showToast(`Đã cập nhật fanpage ${name}`, 'success');
        addLog(`Cập nhật fanpage ${name} (ID: ${fanpage.id})`, 'info');
        close();
    });

    popup.querySelector('#delete-fanpage').addEventListener('click', () => {
        if (confirm(`Bạn có chắc muốn xóa fanpage "${fanpage.name}"?`)) {
            deleteFanpage(fanpage.id);
            close();
        }
    });

    popup.querySelector('#cancel-edit').addEventListener('click', close);

    // Auto focus
    setTimeout(() => {
        const urlInput = popup.querySelector('#edit-fanpage-url');
        if (urlInput) {
            urlInput.focus();
            urlInput.select();
        }
    }, 100);
}
// Ensure showFilterPopup is defined
function showFilterPopup() {
    console.log('showFilterPopup: opening popup, currentTab:', state.currentTab, 'lastActiveTab:', state.lastActiveTab);

    const { element: popup, close } = createPopup({
        title: 'Chọn Bộ Lọc',
        customClass: 'filter-modal',
        content: `
            <div class="filter-section">
                <input type="text" id="all-link-search" placeholder="Tìm kiếm theo tiêu đề hoặc mô tả..." class="add-fanpage-form-control">
                <div id="all-link-search-results" class="search-results"></div>
            </div>
            <div class="filter-section">
                <h4>Link Filters</h4>
                <div class="filter-buttons-container link-filters">
                    ${['group', 'photo', 'story', 'video', 'reel', 'post', 'iframe', 'duplicate', 'blacklist', 'note', 'success', 'image_scontent']
                .map(filter => `
                            <button class="filter-btn ${state.currentFilter === filter ? 'active' : ''} ${filter === 'image_scontent' ? 'image-scontent-filter' : ''}" 
                                    data-filter="${filter}">
                                ${getFilterLabel(filter)}
                            </button>`).join('')}
                </div>
            </div>
            <div class="filter-section">
                <input type="text" id="fanpage-search" placeholder="Nhập tên fanpage để tìm..." class="add-fanpage-form-control">
                <div id="fanpage-search-results" class="search-results"></div>
                <h4>Fanpage Filters</h4>
                <div class="filter-buttons-container fanpage-filters">
                    ${['all', 'fanpage', 'profile', 'profile-pro', 'fanpage_duplicate']
                .map(filter => `
                            <button class="filter-btn ${state.currentFilter === filter ? 'active' : ''}" 
                                    data-filter="${filter}">
                                ${getFilterLabel(filter)}
                            </button>`).join('')}
                </div>
            </div>
            <style>
                .filter-modal .popup-content { top: 10px !important; max-height: calc(100vh - 20px); overflow-y: auto; }
                .filter-section { margin-bottom: 10px; }
                .filter-section h4 { margin: 0 0 6px; font-size: 15px; color: #333; }
                .filter-buttons-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 6px; }
                .filter-btn { padding: 6px; border: 1px solid #ddd; background: #f9f9f9; border-radius: 4px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s ease; }
                .filter-btn.active { background: #007bff; color: white; border-color: #007bff; }
                .image-scontent-filter { position: relative; }
                .add-fanpage-form-group { margin-bottom: 8px; }
                .add-fanpage-form-group label { font-size: 13px; margin-bottom: 2px; display: block; }
                .add-fanpage-form-control { width: 100%; padding: 6px; font-size: 13px; border: 1px solid #ddd; border-radius: 4px; }
                .search-results { max-height: 120px; overflow-y: auto; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px; padding: 4px; font-size: 13px; }
                .search-result-item { padding: 4px; cursor: pointer; border-bottom: 1px solid #eee; }
                .search-result-item:hover { background: #f0f0f0; }
                .search-result-item:last-child { border-bottom: none; }
            </style>
        `
    });

    function getFilterLabel(filter) {
        const labels = {
            'group': 'Group', 'photo': 'Photo', 'story': 'Story', 'video': 'Video', 'reel': 'Reel', 'post': 'Post',
            'iframe': 'Iframe', 'duplicate': 'Trùng lặp', 'blacklist': 'Blacklist', 'note': 'Ghi chú', 'success': 'Thành công',
            'image_scontent': 'SContent', 'all': 'All', 'fanpage': 'Fanpage', 'profile': 'Cá nhân', 'profile-pro': 'Pro', 'fanpage_duplicate': 'Trùng'
        };
        return labels[filter] || filter;
    }

    function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    }

    // All Link Search
    const allLinkSearchInput = popup.querySelector('#all-link-search');
    const debouncedAllLinkSearch = debounce((query) => {
        const resultsContainer = popup.querySelector('#all-link-search-results');
        resultsContainer.innerHTML = '';
        if (!query) return;

        const filteredLinks = state.links.filter(l =>
            removeVietnameseTones((l.title || l.description || '').toLowerCase()).includes(
                removeVietnameseTones(query.toLowerCase())
            ) && l.blacklistStatus !== 'blacklisted'
        );

        if (filteredLinks.length === 0) {
            resultsContainer.innerHTML = '<p>Không tìm thấy link</p>';
        } else {
            filteredLinks.slice(0, 5).forEach(link => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = link.title || link.description || 'No title/description';
                resultItem.addEventListener('click', () => {
                    state.dateFilter.searchQuery = link.title || link.description || '';
                    state.currentFilter = 'all';
                    state.lastActiveTab = 'all-link';
                    console.log('Link search: lastActiveTab:', state.lastActiveTab, 'filter:', state.currentFilter, 'searchQuery:', state.dateFilter.searchQuery);
                    saveData({ dateFilter: true, currentFilter: true, lastActiveTab: true });
                    switchTab('filter');
                    close();
                });
                resultsContainer.appendChild(resultItem);
            });
        }
    }, 300);
    allLinkSearchInput.addEventListener('input', (e) => debouncedAllLinkSearch(e.target.value.trim()));

    // Fanpage Search
    const fanpageSearchInput = popup.querySelector('#fanpage-search');
    const debouncedFanpageSearch = debounce((query) => {
        const resultsContainer = popup.querySelector('#fanpage-search-results');
        resultsContainer.innerHTML = '';
        if (!query) return;

        const filteredFanpages = state.fanpages.filter(f =>
            removeVietnameseTones(f.name.toLowerCase()).includes(removeVietnameseTones(query.toLowerCase()))
        );

        if (filteredFanpages.length === 0) {
            resultsContainer.innerHTML = '<p>Không tìm thấy fanpage</p>';
        } else {
            filteredFanpages.forEach(f => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = f.name;
                resultItem.addEventListener('click', () => {
                    state.dateFilter.searchQuery = f.name;
                    state.currentFilter = 'fanpage';
                    state.lastActiveTab = 'fanpage';
                    console.log('Fanpage search: lastActiveTab:', state.lastActiveTab, 'filter:', state.currentFilter, 'searchQuery:', state.dateFilter.searchQuery);
                    saveData({ dateFilter: true, currentFilter: true, lastActiveTab: true });
                    switchTab('filter');
                    close();
                });
                resultsContainer.appendChild(resultItem);
            });
        }
    }, 300);
    fanpageSearchInput.addEventListener('input', (e) => debouncedFanpageSearch(e.target.value.trim()));

    // Filter Buttons
    popup.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const filter = this.dataset.filter;
            if (filter) {
                state.currentFilter = filter;
                state.dateFilter.searchQuery = '';
                state.lastActiveTab = ['all', 'fanpage', 'profile', 'profile-pro', 'fanpage_duplicate'].includes(filter) ? 'fanpage' : 'all-link';
                console.log('Filter button: lastActiveTab:', state.lastActiveTab, 'filter:', state.currentFilter);
                saveData({ currentFilter: true, dateFilter: true, lastActiveTab: true });
                switchTab('filter');
                close();
            }
        });
    });
}
//2. Local Storage / Database Functions 
// LocalStorage Backup
function saveToLocalStorage() {
    try {
        localStorage.setItem('data-fb', JSON.stringify({
            links: state.links,
            fanpages: state.fanpages,
            logs: state.logs,
            scrollPosition: state.scrollPosition,
            dateFilter: state.dateFilter,
            fanpageFilter: state.fanpageFilter
        }));
    } catch (e) {
        addLog(`Lỗi lưu localStorage: ${e.message}`, 'error');
    }
}
async function saveData(changes = {}) {
    if (!Object.keys(changes).length) return;
    const data = {
        links: state.links,
        fanpages: state.fanpages,
        logs: state.logs,
        scrollPosition: state.scrollPosition,
        filterScrollPosition: state.filterScrollPosition,
        dateFilter: state.dateFilter,
        fanpageFilter: state.fanpageFilter
    };
    try {
        const db = await openDatabase();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        store.put({ id: 1, data });
        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
        saveToLocalStorage();
    } catch (error) {
        addLog('Không thể lưu dữ liệu vào IndexedDB', 'error');
        saveToLocalStorage();
    }
}
function renderFilteredResults(container, filter, dataType) {
    if (!container) {
        console.error('Không tìm thấy container cho tab filter');
        addLog('Không tìm thấy container cho tab filter', 'error');
        return;
    }
    container.innerHTML = '';
    state.currentFilter = filter;

    let items = dataType === 'links' ? getFilteredLinksForFilterTab() : getFilteredFanpages(filter, state.dateFilter.searchQuery || '');

    console.log(`Rendering ${dataType} in filter tab, filter: ${filter}, searchQuery: ${state.dateFilter.searchQuery}, items found:`, items.length, items);

    if (!items.length) {
        container.innerHTML = `<p>Không có ${dataType === 'links' ? 'link' : 'fanpage'} nào phù hợp.</p>`;
        return;
    }

    const itemContainer = document.createElement('div');
    itemContainer.className = 'filter-items';
    items.forEach((item, index) => {
        try {
            const itemEl = dataType === 'links' ?
                createLinkItem(item, index, true) :
                createFanpageItem(item, index, true);
            const checkbox = itemEl.querySelector('.link-checkbox');
            checkbox.checked = item.checked; // Đồng bộ với item.checked
            checkbox.addEventListener('change', () => {
                item.checked = checkbox.checked;
                itemEl.classList.toggle('checked', checkbox.checked); // Thêm class hover
                saveData({ [dataType]: true });
                updateCounters();
            });
            itemEl.dataset.id = item.id;
            itemContainer.appendChild(itemEl);
            if (dataType === 'fanpages') {
                loadMiniIframe(itemEl.querySelector('.fanpage-iframe-mini'), item.url);
            }
        } catch (error) {
            console.error(`Lỗi khi tạo item ${dataType} ID: ${item.id}`, error);
            addLog(`Lỗi khi tạo item ${dataType} ID: ${item.id}: ${error.message}`, 'error');
        }
    });
    container.appendChild(itemContainer);

    updateCounters();
    if (elements.mainContent) {
        elements.mainContent.scrollTop = state.filterScrollPosition || 0;
        elements.mainContent.addEventListener('scroll', debounce(() => {
            state.filterScrollPosition = elements.mainContent.scrollTop;
            saveData({ filterScrollPosition: true });
        }, config.debounceDelay), { once: true });
    }
}
async function loadData() {
    const hideLoading = (() => {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Đang tải...';
        document.body.appendChild(loading);
        return () => document.body.removeChild(loading);
    })();
    try {
        const db = await openDatabase();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(1);
        const savedData = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject('Lỗi tải dữ liệu từ IndexedDB');
        });
        if (savedData) {
            state.links = savedData.links || [];
            state.fanpages = savedData.fanpages || [];
            state.logs = savedData.logs || [];
            state.scrollPosition = savedData.scrollPosition || 0;
            state.filterScrollPosition = savedData.filterScrollPosition || 0;
            state.dateFilter = savedData.dateFilter || { startDate: '', endDate: '', status: 'all', groupTitles: false, searchQuery: '' };
            state.fanpageFilter = savedData.fanpageFilter || { currentPage: 1 };
            state.links = state.links.map(link => ({
                ...link,
                post_type: link.post_type || 'unknown',
                blacklistStatus: link.blacklistStatus || 'active',
                checked: link.checked || false,
                note: link.note || ''
            }));
            state.fanpages = state.fanpages.map(fanpage => ({
                ...fanpage,
                id: fanpage.id || generateId(),
                url: fanpage.url || '',
                name: fanpage.name || '',
                status: fanpage.status || 'pending',
                thumbnail: fanpage.thumbnail || config.defaultImage,
                description: fanpage.description || '',
                checked: fanpage.checked || false
            }));
        } else {
            addLog('Không tìm thấy dữ liệu, sử dụng mặc định', 'warning');
        }
        updateCounters();
        switchTab('all-link');
        if (elements.mainContent) {
            elements.mainContent.scrollTop = state.scrollPosition;
        }
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        showToast('Không thể tải dữ liệu, sử dụng mặc định', 'danger');
        state.links = [];
        state.fanpages = [];
        updateCounters();
        switchTab('all-link');
    } finally {
        hideLoading();
    }
}
// Mở hoặc tạo cơ sở dữ liệu
const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        // Nếu cơ sở dữ liệu không tồn tại, tạo mới với một store
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Lỗi mở cơ sở dữ liệu");
    });
};
// Smooth Scroll
function smoothScroll(element, targetPosition, duration = config.scrollDuration) {
    const startPosition = element.scrollTop;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = easeInOutQuad(progress);
        element.scrollTop = startPosition + distance * ease;
        state.scrollPosition = element.scrollTop;
        if (progress < 1) requestAnimationFrame(animation);
        else saveData({ scrollPosition: true });
    }

    requestAnimationFrame(animation);
}
//4. Undo Management (Quản lý Undo)
// Undo Management
function saveBackup(type, data) {
    const backup = { type, scrollPosition: state.scrollPosition };
    switch (type) {
        case 'addLinks':
            backup.addedLinks = data.links.map(link => ({ ...link }));
            break;
        case 'deleteLinks':
            backup.deletedLinks = data.links.map(link => ({ ...link }));
            break;
        case 'checkbox':
            backup.linkId = data.linkId;
            backup.checked = data.checked;
            break;
        case 'note':
            backup.linkId = data.linkId;
            backup.note = data.note;
            break;
        case 'blacklist':
            backup.linkId = data.linkId;
            backup.blacklistStatus = data.blacklistStatus;
            break;
        case 'selectAll':
            backup.checkedLinks = data.links.map(link => ({
                id: link.id,
                checked: link.checked
            }));
            break;
        case 'retryLink':
            backup.linkId = data.linkId;
            backup.linkState = { ...data.link };
            break;
        case 'addFanpages':
            backup.addedFanpages = data.fanpages.map(fanpage => ({ ...fanpage }));
            break;
        case 'refreshFanpage':
            backup.fanpage = { ...data.fanpage };
            break;
    }
    state.undoStack.push(backup);
    if (state.undoStack.length > config.maxUndoSteps) {
        state.undoStack.shift();
        addLog('Undo stack đầy, xóa hành động cũ nhất', 'warning');
    }
    saveData({ undoStack: true });
}
function undoAction() {
    if (state.undoStack.length === 0) {
        showToast('Không có hành động để hoàn tác', 'warning');
        return;
    }
    const backup = state.undoStack.pop();
    let needsSaveData = false;
    let scrollToLinkId = null;
    let switchToAllLink = false;

    switch (backup.type) {
        case 'addLinks':
            state.links = state.links.filter(link => !backup.addedLinks.some(l => l.id === link.id));
            needsSaveData = true;
            switchToAllLink = true;
            showToast(`Hoàn tác: Thêm ${backup.addedLinks.length} link`, 'success');
            break;
        case 'deleteLinks':
            state.links.unshift(...backup.deletedLinks);
            needsSaveData = true;
            scrollToLinkId = backup.deletedLinks[0]?.id;
            switchToAllLink = true;
            showToast(`Hoàn tác: Xóa ${backup.deletedLinks.length} link`, 'success');
            break;
        case 'checkbox':
            const linkCheckbox = state.links.find(l => l.id === backup.linkId);
            if (linkCheckbox) {
                linkCheckbox.checked = backup.checked;
                scrollToLinkId = linkCheckbox.id;
                showToast(`Hoàn tác: Checkbox của link ${linkCheckbox.url.slice(0, 50)}...`, 'success');
                updateLinkItem(linkCheckbox);
            }
            break;
        case 'note':
            const noteLink = state.links.find(l => l.id === backup.linkId);
            if (noteLink) {
                noteLink.note = backup.note;
                scrollToLinkId = noteLink.id;
                switchToAllLink = true;
                showToast(`Hoàn tác: Ghi chú của link ${noteLink.url.slice(0, 50)}...`, 'success');
                updateLinkItem(noteLink);
            }
            break;
        case 'blacklist':
            const blacklistLink = state.links.find(l => l.id === backup.linkId);
            if (blacklistLink) {
                blacklistLink.blacklistStatus = backup.blacklistStatus;
                scrollToLinkId = blacklistLink.id;
                needsSaveData = true;
                showToast(`Hoàn tác: Trạng thái blacklist của link ${blacklistLink.url.slice(0, 50)}...`, 'success');
                updateLinkItem(blacklistLink);
            }
            break;
        case 'selectAll':
            backup.checkedLinks.forEach(({ id, checked }) => {
                const link = state.links.find(l => l.id === id);
                if (link) {
                    link.checked = checked;
                    updateLinkItem(link);
                }
            });
            showToast('Hoàn tác: Chọn/bỏ chọn tất cả', 'success');
            break;
        case 'retryLink':
            const retryLink = state.links.find(l => l.id === backup.linkId);
            if (retryLink) {
                Object.assign(retryLink, backup.linkState);
                scrollToLinkId = retryLink.id;
                needsSaveData = true;
                showToast(`Hoàn tác: Thử lại link ${retryLink.url.slice(0, 50)}...`, 'success');
                updateLinkItem(retryLink);
            }
            break;
        case 'addFanpages':
            state.fanpages = state.fanpages.filter(f => !backup.addedFanpages.some(f2 => f2.id === f.id));
            needsSaveData = true;
            showToast(`Hoàn tác: Thêm ${backup.addedFanpages.length} fanpage`, 'success');
            break;
        case 'refreshFanpage':
            const fanpage = state.fanpages.find(f => f.id === backup.fanpage.id);
            if (fanpage) {
                Object.assign(fanpage, backup.fanpage);
                needsSaveData = true;
                showToast(`Hoàn tác: Làm mới fanpage ${fanpage.name}`, 'success');
            }
            break;
        case 'editLink':
            const editedLink = state.links.find(l => l.id === backup.linkId);
            if (editedLink) {
                editedLink.url = backup.url;
                editedLink.image = backup.image;
                editedLink.post_type = determinePostType(backup.url);
                scrollToLinkId = editedLink.id;
                needsSaveData = true;
                showToast(`Hoàn tác: Chỉnh sửa link ${editedLink.url.slice(0, 50)}...`, 'success');
                updateLinkItem(editedLink);
            }
            break;
    }

    if (needsSaveData) saveData({ links: true, fanpages: true });
    updateCounters();
    addLog(`Hoàn tác hành động: ${backup.type}`, 'info');

    // Chuyển tab nếu cần
    if (switchToAllLink && state.currentTab !== 'all-link') {
        switchTab('all-link');
    } else {
        renderTabContent(state.currentTab);
    }

    // Cuộn đến link nếu có, phân biệt tab filter
    if (elements.mainContent && scrollToLinkId) {
        setTimeout(() => {
            const linkItem = document.querySelector(`.link-item[data-id="${scrollToLinkId}"]`);
            const scrollPosition = state.currentTab === 'filter' ? state.filterScrollPosition : state.scrollPosition;
            if (linkItem) {
                smoothScroll(elements.mainContent, linkItem.offsetTop);
            } else {
                elements.mainContent.scrollTop = backup.scrollPosition || scrollPosition || 0;
            }
            if (state.currentTab === 'filter') {
                state.filterScrollPosition = elements.mainContent.scrollTop;
                saveData({ filterScrollPosition: true });
            } else {
                state.scrollPosition = elements.mainContent.scrollTop;
                saveData({ scrollPosition: true });
            }
        }, 100);
    }
}

function updateFanpageList() {
    const container = elements.linkLists['fanpage'];
    if (!container) {
        addLog('Không tìm thấy container fanpage-tab', 'error');
        return;
    }
    const listContainer = container.querySelector('.fanpage-list');
    const currentFilter = container.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    renderFilteredResults(listContainer, currentFilter, 'fanpages');
}
// Thay thế verifyFanpageExistence, updateFanpageStatus, checkFanpageStatus bằng hàm mới
async function verifyFanpage(fanpage, container) {
    const iframe = container.querySelector('iframe');
    let status = 'error';

    if (iframe) {
        try {
            // Phát hiện nội dung bị chặn/xóa
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc.body.innerText.includes('content not found')) {
                status = 'not-exists';
            } else if (iframeDoc.body.innerText.includes('restricted') ||
                iframeDoc.body.innerText.includes('log in')) {
                status = 'restricted';
            } else {
                status = 'exists';
            }
        } catch (e) {
            status = 'exists'; // Giả định tồn tại nếu có iframe
        }
    }

    // Cập nhật trạng thái
    fanpage.status = status;
    fanpage.lastChecked = new Date().toISOString();
    saveData({ fanpages: true });

    // Cập nhật giao diện
    const statusElement = container.querySelector('.fanpage-status');
    if (statusElement) {
        statusElement.className = `fanpage-status ${status}`;
        statusElement.textContent = getStatusText(status);
    }
}
function updateSelectionBar(fanpages) {
    if (!elements.fanpageControls) return;

    const selectedCount = fanpages.filter(f => f.checked).length;
    const totalCount = fanpages.length;

    // Cập nhật số lượng đã chọn
    if (elements.fanpageControls.selectionCount) {
        elements.fanpageControls.selectionCount.textContent = `${selectedCount}/${totalCount}`;
    }

    // Cập nhật trạng thái nút xóa
    if (elements.fanpageControls.deleteSelectedBtn) {
        elements.fanpageControls.deleteSelectedBtn.disabled = selectedCount === 0;
    }

    // Cập nhật checkbox chọn tất cả
    if (elements.fanpageControls.selectAllCheckbox) {
        if (selectedCount === 0) {
            elements.fanpageControls.selectAllCheckbox.checked = false;
            elements.fanpageControls.selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalCount) {
            elements.fanpageControls.selectAllCheckbox.checked = true;
            elements.fanpageControls.selectAllCheckbox.indeterminate = false;
        } else {
            elements.fanpageControls.selectAllCheckbox.checked = false;
            elements.fanpageControls.selectAllCheckbox.indeterminate = true;
        }
    }
}
function getFilteredFanpages(filter, searchQuery = '') {
    let filtered = state.fanpages;

    console.log('getFilteredFanpages: filter:', filter, 'searchQuery:', searchQuery, 'fanpages:', state.fanpages);

    if (searchQuery) {
        // Chuẩn hóa searchQuery
        const normalizedQuery = removeVietnameseTones(searchQuery.toLowerCase().trim());
        filtered = filtered.filter(f => {
            if (!f.name) return false;
            const normalizedName = removeVietnameseTones(f.name.toLowerCase().trim());
            return normalizedName.includes(normalizedQuery);
        });
        // Khi có searchQuery, bỏ qua filter type, hiển thị tất cả kết quả khớp
        console.log('getFilteredFanpages: filtered (after search):', filtered);
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Nếu không có searchQuery, áp dụng filter
    switch (filter) {
        case 'fanpage':
            filtered = filtered.filter(f => f.type === 'fanpage');
            break;
        case 'profile':
            filtered = filtered.filter(f => f.type === 'profile');
            break;
        case 'profile-pro':
            filtered = filtered.filter(f => f.type === 'profile-pro');
            break;
        case 'fanpage_duplicate':
            filtered = findDuplicateFanpages();
            console.log('getFilteredFanpages: filtered (fanpage_duplicate):', filtered);
            return filtered; // Không sắp xếp lại
        case 'all':
        default:
            break;
    }

    console.log('getFilteredFanpages: filtered:', filtered);
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
}
// Hàm tìm fanpage trùng lặp (theo URL hoặc tiêu đề)
function findDuplicateFanpages() {
    const groups = [];
    const processed = new Set();

    // Hàm chuẩn hóa tiêu đề
    function normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // Hàm tính Levenshtein Distance
    function levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[b.length][a.length];
    }

    // Hàm kiểm tra tiêu đề tương đồng
    function isSimilarTitle(title1, title2) {
        const norm1 = normalizeTitle(title1);
        const norm2 = normalizeTitle(title2);
        const distance = levenshteinDistance(norm1, norm2);
        const maxLength = Math.max(norm1.length, norm2.length);
        return distance / maxLength < 0.3 || norm1 === norm2;
    }

    // Tìm các nhóm fanpage tương đồng
    state.fanpages.forEach((fanpage, index) => {
        if (processed.has(index)) return;

        const group = [fanpage];
        processed.add(index);

        for (let j = index + 1; j < state.fanpages.length; j++) {
            if (processed.has(j)) continue;
            const otherFanpage = state.fanpages[j];
            if (isSimilarTitle(fanpage.name, otherFanpage.name)) {
                group.push(otherFanpage);
                processed.add(j);
            }
        }

        if (group.length > 1) {
            group.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            groups.push(group);
        }
    });

    // Sắp xếp các nhóm
    groups.sort((groupA, groupB) => {
        const nameA = normalizeTitle(groupA[0].name);
        const nameB = normalizeTitle(groupB[0].name);
        return nameA.localeCompare(nameB);
    });

    // Trả về danh sách đã nhóm
    const duplicates = groups.flat();
    console.log("Duplicates from findDuplicateFanpages:", duplicates.map(f => f.name));
    return duplicates;
}
// Refactored getTypeLabel
function getTypeLabel(type) {
    return {
        'profile-pro': '⭐ Profile Pro',
        'profile': '👤 Trang cá nhân',
        'fanpage': '📌 Fanpage'
    }[type] || 'Không xác định';
}
function removeFanpageItem(fanpageId) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;

    saveBackup('deleteFanpage', { fanpage: { ...fanpage } });

    state.fanpages = state.fanpages.filter(f => f.id !== fanpageId);

    const container = elements.linkLists['filter'];
    const listContainer = container.querySelector('.fanpage-list');
    const item = listContainer.querySelector(`.link-item[data-id="${fanpageId}"]`);
    if (item) {
        item.remove();
    }

    const currentFilter = container.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const searchQuery = container.querySelector('#fanpage-filter-search')?.value.trim().toLowerCase() || '';
    updateSelectionBar(getFilteredFanpages(currentFilter, searchQuery));

    saveData({ fanpages: true });
    updateCounters();

    showToast(`Đã xóa fanpage ${fanpage.name}`, 'success');
    addLog(`Đã xóa fanpage ${fanpage.name} (ID: ${fanpage.id})`, 'info');
}
function highlightAndScrollToFanpage(fanpageId) {
    const container = elements.linkLists['filter'];
    const listContainer = container.querySelector('.fanpage-list');
    const item = listContainer.querySelector(`.link-item[data-id="${fanpageId}"]`);
    if (!item) return;

    item.classList.add('hovered');
    setTimeout(() => item.classList.remove('hovered'), 2000);

    smoothScroll(listContainer, item.offsetTop);
}
// Hàm chung xử lý nhập/xuất dữ liệu lên Gist
// Kiểm tra token GitHub
async function validateGithubToken(token) {
    try {
        const res = await fetchWithRetry('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        return res.ok;
    } catch {
        return false;
    }
}
async function handleGistOperation({ operation, fileName, dataType, data, processImport }) {
    const displayType = dataType === 'links' ? 'link' : 'fanpage';
    const showError = (message) => {
        showToast(`Lỗi khi ${operation === 'import' ? 'nhập' : 'xuất'} từ ${fileName}: ${message}`, 'danger');
        addLog(`Lỗi ${operation === 'import' ? 'nhập' : 'xuất'} ${displayType} từ ${fileName}: ${message}`, 'error');
    };

    try {
        state.isLoading = true;
        const { fanpageGistUrl: gistUrl, githubToken: token } = config;

        if (operation === 'export') {
            if (!data?.length) {
                showToast(`Không có ${displayType} nào để xuất!`, 'warning');
                return;
            }
            if (!token || token === 'YOUR_GITHUB_TOKEN_HERE' || !(await validateGithubToken(token))) {
                showError('Token GitHub không hợp lệ');
                return;
            }

            const content = JSON.stringify(data, null, 2);
            console.log(`Dữ liệu gửi lên ${fileName}:`, content);

            const response = await fetchWithRetry(gistUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: { [fileName]: { content } } })
            });

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 60;
                showToast(`Quá nhiều yêu cầu, thử lại sau ${retryAfter}s`, 'warning');
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return handleGistOperation({ operation, fileName, dataType, data });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.message || 'Không thể cập nhật Gist'}`);
            }

            console.log(`Phản hồi từ Gist khi xuất ${fileName}:`, await response.json());
            showToast(`Đã xuất ${data.length} ${displayType} lên ${fileName}`, 'success');
            addLog(`Đã xuất ${data.length} ${displayType} lên ${fileName}`, 'success');
        } else {
            showToast(`Đang tải dữ liệu từ ${fileName}...`, 'info');
            const response = await fetchWithRetry(gistUrl, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const gistData = await response.json();
            const fileContent = gistData.files?.[fileName]?.content;
            if (!fileContent) throw new Error(`Không tìm thấy nội dung trong '${fileName}'`);

            const items = fileName === 'Jsonlink'
                ? fileContent.split('\n').map(line => JSON.parse(line)).filter(Boolean)
                : JSON.parse(fileContent);

            if (!Array.isArray(items)) throw new Error('Dữ liệu JSON không hợp lệ');

            const validItems = items.filter(item =>
                item.url?.trim() && (dataType === 'links' ? item.image?.trim() : item.name?.trim())
            );

            if (!validItems.length) {
                showToast(`Không có ${displayType} hợp lệ trong ${fileName}`, 'warning');
                return;
            }

            if (!confirm(`Bạn có chắc muốn nhập ${validItems.length} ${displayType} từ ${fileName}?`)) {
                showToast('Đã hủy nhập dữ liệu', 'warning');
                return;
            }

            const newItems = await processImport(validItems);
            if (newItems.length) {
                saveBackup(`add${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`, { [dataType]: newItems });
                await saveData({ [dataType]: true });
                renderTabContent(dataType === 'links' ? 'all-link' : 'fanpage');
                updateCounters();
                showToast(`Đã thêm ${newItems.length} ${displayType} từ ${fileName}`, 'success');
                addLog(`Đã nhập ${newItems.length} ${displayType} từ ${fileName}`, 'success');
            } else {
                showToast(`Không có ${displayType} nào được thêm`, 'warning');
            }
        }
    } catch (error) {
        console.error(`Lỗi ${operation} ${dataType} từ ${fileName}:`, error);
        showError(error.message);
    } finally {
        state.isLoading = false;
    }
}
async function importLinksFromJsonLines() {
    try {
        state.isLoading = true;
        showToast('Đang nhập danh sách link từ Jsonlink...', 'info');

        const { fanpageGistUrl: gistUrl, githubToken: token } = config;
        if (!token || token === 'YOUR_GITHUB_TOKEN_HERE' || !(await validateGithubToken(token))) {
            showToast('Token GitHub không hợp lệ', 'danger');
            addLog('Lỗi token khi nhập Jsonlink', 'error');
            return;
        }

        const response = await fetch(gistUrl, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);

        const gistData = await response.json();
        const fileContent = gistData.files['Jsonlink']?.content;
        if (!fileContent) throw new Error("Không tìm thấy nội dung trong 'Jsonlink'");

        const lines = fileContent.trim().split('\n');
        const data = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(item => item);

        // Lọc bằng state.filterKeywords
        const keywords = (state.filterKeywords || []).map(normalize);
        const filteredData = data.filter(item => {
            const normStr = normalize(JSON.stringify({
                url: item.url || '',
                title: item.title || '',
                description: item.description || ''
            }));
            return !keywords.some(kw => normStr.includes(kw));
        });

        if (!filteredData.length) {
            showToast('Không có link nào phù hợp sau khi lọc từ khóa', 'warning');
            return;
        }

        if (!confirm(`Bạn có chắc muốn nhập ${filteredData.length} link từ Jsonlink?`)) {
            showToast('Đã hủy nhập dữ liệu', 'warning');
            return;
        }

        const newLinks = [];
        for (const item of filteredData) {
            const url = item.url?.trim() || '';
            const isErrorImage = !item.image || item.image === config.defaultImage || item.image.includes('facebook.com/plugins/');
            const newLink = {
                id: generateId(),
                url,
                title: item.title || 'Chưa xử lý',
                description: item.description || '',
                image: isErrorImage
                    ? `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=300&show_text=true`
                    : item.image,
                status: isErrorImage ? 'iframe' : 'success',
                post_type: item.post_type || determinePostType(url),
                date: new Date().toISOString(),
                checked: false,
                blacklistStatus: 'active',
                note: item.note || ''
            };
            state.links.unshift(newLink);
            newLinks.push(newLink);
        }

        if (newLinks.length) {
            saveBackup('addLinks', { links: newLinks });
            await saveData({ links: true });
            renderTabContent('all-link');
            updateCounters();
            showToast(`Đã thêm ${newLinks.length} link từ Jsonlink`, 'success');
            addLog(`Đã nhập ${newLinks.length} link từ Jsonlink`, 'success');
            await clearGistFileContent(gistData.id, 'Jsonlink');
        }
    } catch (error) {
        showToast(`Lỗi khi nhập Jsonlink: ${error.message}`, 'danger');
        addLog(`Lỗi khi nhập Jsonlink: ${error.message}`, 'error');
    } finally {
        state.isLoading = false;
    }
}
async function clearGistFileContent(gistId, fileName = "Jsonlink") {
    try {
        if (!gistId || !fileName) {
            console.warn("Thiếu gistId hoặc tên file cần xoá nội dung");
            return;
        }

        // Lấy thông tin gist để xác minh tồn tại file
        const getResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${config.githubToken}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!getResponse.ok) {
            const errText = await getResponse.text();
            console.error(`Không thể tải Gist: ${gistId}`, errText);
            showToast(`Không thể tải Gist: ${gistId}`, 'danger');
            return;
        }

        const gistData = await getResponse.json();
        if (!gistData.files || !gistData.files[fileName]) {
            console.warn(`Không tìm thấy file '${fileName}' trong Gist`);
            showToast(`Không tìm thấy file '${fileName}' trong Gist`, 'warning');
            return;
        }

        const patchResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${config.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [fileName]: {
                        content: ''
                    }
                }
            })
        });

        if (patchResponse.ok) {
            showToast(`Đã xoá nội dung file '${fileName}' trong Gist`, 'success');
            addLog(`Đã xoá nội dung file '${fileName}' trong Gist ID: ${gistId}`, 'info');
        } else {
            const errText = await patchResponse.text();
            console.warn(`Không thể xoá nội dung '${fileName}':`, errText);
            showToast(`Lỗi xoá nội dung '${fileName}': ${patchResponse.statusText}`, 'danger');
            addLog(`Lỗi xoá nội dung file '${fileName}' trong Gist: ${patchResponse.statusText}`, 'error');
        }

    } catch (error) {
        console.error(`Lỗi xoá nội dung file '${fileName}':`, error);
        showToast(`Lỗi khi xoá nội dung '${fileName}': ${error.message}`, 'danger');
        addLog(`Lỗi xoá nội dung '${fileName}' trong Gist: ${error.message}`, 'error');
    }
}
async function exportUrlsToGist(links) {
    try {
        state.isLoading = true;
        showToast('Đang xuất danh sách URL lên Gist...', 'info');

        const content = links.map(link => link.url).join('\n'); // mỗi dòng 1 url

        const { fanpageGistUrl: gistUrl, githubToken: token } = config;

        if (!token || token === 'YOUR_GITHUB_TOKEN_HERE' || !(await validateGithubToken(token))) {
            showToast('Token GitHub không hợp lệ', 'danger');
            addLog('Lỗi token khi export URL lên Gist', 'error');
            return;
        }

        const response = await fetchWithRetry(gistUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'linkitemmmm': { content } // 🔥 file đơn giản, thuần text
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.message || 'Không thể cập nhật Gist'}`);
        }

        showToast(`Đã xuất ${links.length} URL lên Gist (link_urls.txt)`, 'success');
        addLog(`Đã export ${links.length} URL lên Gist (link_urls.txt)`, 'success');
    } catch (error) {
        console.error('Lỗi export URL:', error);
        showToast(`Lỗi khi export URL: ${error.message}`, 'danger');
        addLog(`Lỗi khi export URL lên Gist: ${error.message}`, 'error');
    } finally {
        state.isLoading = false;
    }
}
async function exportToGist() {
    const linksToExport = state.links.filter(link => link.checked).length > 0
        ? state.links.filter(link => link.checked)
        : state.links;
    await handleGistOperation({
        operation: 'export',
        fileName: 'Jsonalllink',
        dataType: 'links',
        data: linksToExport
    });
}
async function importFanpagesFromJSON() {
    await handleGistOperation({
        operation: 'import',
        fileName: 'Jsonfanpage',
        dataType: 'fanpages',
        processImport: async (items) => {
            const newFanpages = [];
            for (const item of items) {
                const trimmedUrl = item.url.trim();
                if (!isValidUrl(trimmedUrl)) continue;
                const newFanpage = {
                    id: generateId(),
                    url: trimmedUrl,
                    name: item.name || 'Fanpage không tên',
                    description: item.description || '',
                    type: ['fanpage', 'profile', 'profile-pro'].includes(item.type) ? item.type : 'fanpage',
                    date: new Date().toISOString(),
                    checked: false,
                    status: 'pending',
                    thumbnail: item.thumbnail || config.defaultImage
                };
                state.fanpages.unshift(newFanpage);
                newFanpages.push(newFanpage);
                addLog(`Đã thêm fanpage từ Jsonfanpage: ${trimmedUrl}`, 'success');
            }
            return newFanpages;
        }
    });
}
async function exportFanpagesToJSON(fanpagesToExport = state.fanpages) {
    await handleGistOperation({
        operation: 'export',
        fileName: 'Jsonfanpage',
        dataType: 'fanpages',
        data: fanpagesToExport
    });
}
async function importFromJSON() {
    try {
        state.isLoading = true;
        showToast('Đang tải danh sách link từ Jsonalllink...', 'info');

        const response = await fetch(config.fanpageGistUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);

        const gistData = await response.json();
        const fileContent = gistData.files['Jsonalllink']?.content;
        if (!fileContent) throw new Error("Không tìm thấy nội dung trong 'Jsonalllink'");

        let data = JSON.parse(fileContent);
        if (!Array.isArray(data)) throw new Error('Dữ liệu JSON không hợp lệ (phải là mảng object)');

        // Lọc bằng state.filterKeywords
        const keywords = (state.filterKeywords || []).map(normalize);
        const filteredData = data.filter(item => {
            const normStr = normalize(JSON.stringify({
                url: item.url || '',
                title: item.title || '',
                description: item.description || ''
            }));
            return !keywords.some(kw => normStr.includes(kw));
        });

        if (!filteredData.length) {
            showToast('Không có link nào phù hợp sau khi lọc từ khóa', 'warning');
            return;
        }

        if (!confirm(`Bạn có chắc muốn nhập ${filteredData.length} link từ Jsonalllink?`)) {
            showToast('Đã hủy nhập dữ liệu', 'warning');
            return;
        }

        const newLinks = [];
        for (const item of filteredData) {
            const url = item.url?.trim() || '';
            const isErrorImage = !item.image || item.image === config.defaultImage || item.image.includes('facebook.com/plugins/');
            const newLink = {
                id: generateId(),
                url,
                title: item.title || 'Chưa xử lý',
                description: item.description || '',
                image: isErrorImage
                    ? `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=300&show_text=true`
                    : item.image,
                status: isErrorImage ? 'iframe' : 'success',
                post_type: item.post_type || determinePostType(url),
                date: new Date().toISOString(),
                checked: item.checked || false,
                blacklistStatus: item.blacklistStatus || 'active',
                note: item.note || ''
            };
            state.links.unshift(newLink);
            newLinks.push(newLink);
        }

        if (newLinks.length) {
            saveBackup('addLinks', { links: newLinks });
            await saveData({ links: true });
            renderTabContent('all-link');
            updateCounters();
            showToast(`Đã thêm ${newLinks.length} link từ Jsonalllink`, 'success');
            addLog(`Đã nhập ${newLinks.length} link từ Jsonalllink`, 'success');
        }
    } catch (error) {
        showToast(`Lỗi khi import: ${error.message}`, 'danger');
        addLog(`Lỗi khi nhập từ Jsonalllink: ${error.message}`, 'error');
    } finally {
        state.isLoading = false;
    }
}
//6. Link Management
function cacheIframeContent(url, content) {
    const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('iframe_'));
    if (cacheKeys.length >= 100) {
        localStorage.removeItem(cacheKeys[0]);
    }
    localStorage.setItem(`iframe_${url}`, content);
}
function getCachedIframeContent(url) {
    return localStorage.getItem(`iframe_${url}`);
}
function switchTab(tab) {
    console.log(`Switching to tab: ${tab}, previous tab: ${state.currentTab}`);
    if (state.currentTab === tab) {
        renderTabContent(tab);
        if (elements.mainContent) {
            elements.mainContent.scrollTop = tab === 'filter' ? state.filterScrollPosition : state.scrollPosition;
        }
        return;
    }

    Object.values(elements.linkLists).forEach(el => {
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.header-btn').forEach(btn => btn.classList.remove('active'));
    Object.values(elements.statusCounters).forEach(el => {
        if (el) el.classList.remove('active');
    });

    if (tab !== 'filter') {
        state.lastActiveTab = state.currentTab;
    }
    state.currentTab = tab;

    const tabContent = elements.linkLists[tab];
    if (tabContent) {
        tabContent.style.display = 'block';
        tabContent.classList.add('active');
    } else {
        console.warn(`Tab content not found for: ${tab}`);
        addLog(`Không tìm thấy nội dung tab: ${tab}`, 'warning');
    }

    const tabButton = elements.headerBtns[tab] || document.querySelector(`#${tab}-btn`);
    if (tabButton) {
        tabButton.classList.add('active');
    } else {
        console.warn(`Tab button not found for: ${tab}`);
        addLog(`Không tìm thấy nút tab: ${tab}`, 'warning');
    }

    if (tab === 'all-link') {
        elements.statusCounters.all?.classList.add('active');
    } else if (tab === 'filter') {
        elements.statusCounters.filter?.classList.add('active');
    }

    saveData({ currentTab: true, lastActiveTab: true });

    if (tab !== 'log') {
        const links = getLinksForCurrentTab();
        links.forEach(link => {
            if (link.status === 'iframe') {
                const cachedIframe = getCachedIframeContent(link.url);
                if (cachedIframe) {
                    const item = document.querySelector(`.link-item[data-id="${link.id}"] .link-thumbnail`);
                    if (item) item.innerHTML = cachedIframe;
                }
            }
        });
    }

    renderTabContent(tab);

    if (elements.mainContent) {
        elements.mainContent.scrollTop = tab === 'filter' ? state.filterScrollPosition : state.scrollPosition;
    }
}
function getLinksForCurrentTab() {
    switch (state.currentTab) {
        case 'all-link':
            return state.links; // Không lọc blacklist, hiển thị tất cả link
        case 'checked-link':
            return state.links.filter(link => link.checked && !link.blacklistStatus);
        case 'unchecked-link':
            return state.links.filter(link => !link.checked && !link.blacklistStatus);
        case 'blacklist':
            return state.links.filter(link => link.blacklistStatus);
        default:
            return state.links;
    }
}

function smartScroll() {
    if (!elements.mainContent) return;
    const maxScroll = elements.mainContent.scrollHeight - elements.mainContent.clientHeight;
    const targetPosition = state.scrollState === 0 ? maxScroll : 0;
    smoothScroll(elements.mainContent, targetPosition);
    state.scrollState = state.scrollState === 0 ? 1 : 0;

    // Cập nhật scroll position tùy tab
    if (state.currentTab === 'filter') {
        state.filterScrollPosition = targetPosition;
        saveData({ filterScrollPosition: true });
    } else {
        state.scrollPosition = targetPosition;
        saveData({ scrollPosition: true });
    }
}
// Hàm loại bỏ dấu tiếng Việt
function removeVietnameseTones(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D");
}

function toggleHandedness(isLeftHanded) {
    document.body.classList.toggle('left-handed', isLeftHanded);
    document.body.classList.toggle('right-handed', !isLeftHanded);
}
function init() {
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            await loadData();
            setupEventListeners();
            const isLeftHanded = localStorage.getItem('isLeftHanded') === 'true';
            toggleHandedness(isLeftHanded); // Áp dụng chế độ đã lưu
            renderTabContent('all-link');
        } catch (error) {
            console.error('Lỗi khởi tạo:', error);
            showToast('Lỗi khởi tạo ứng dụng', 'danger');
            addLog(`Lỗi khởi tạo: ${error.message}`, 'error');
        }
    });
}
// Helper functions
function getStatusIcon(status) {
    return {
        'exists': 'check-circle',
        'not-exists': 'times-circle',
        'restricted': 'ban',
        'pending': 'spinner fa-pulse'
    }[status] || 'question-circle';
}
function getStatusText(status) {
    const statusMap = {
        'exists': '✓ Tồn tại',
        'not-exists': '✗ Không tồn tại',
        'restricted': '⛔ Bị chặn',
        'pending': '⌛ Đang kiểm tra',
        'error': '⚠ Lỗi'
    };
    return statusMap[status] || '? Không xác định';
}
// Hàm fetch với retry
async function fetchWithRetry(url, options = {}, retries = config.maxRetries, delay = config.retryDelay) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), config.requestTimeout);
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res;
        } catch (err) {
            if (attempt === retries) {
                try {
                    const proxyRes = await fetch(`${config.corsProxy}${encodeURIComponent(url)}`, options);
                    if (!proxyRes.ok) throw new Error(`Proxy HTTP ${proxyRes.status}`);
                    return proxyRes;
                } catch (proxyErr) {
                    throw new Error(`Lỗi sau ${retries} lần thử: ${err.message}, Proxy: ${proxyErr.message}`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), config.toastDuration);
}
const dbName = "myAppData"; // Tên cơ sở dữ liệu
const storeName = "dataStore"; // Tên object store
// Refactored showLinkDetailsPopup
function showLinkDetailsPopup(link) {
    const popup = document.createElement('div');
    popup.className = 'modal-overlay';
    popup.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Chi tiết bài viết</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <input type="text" id="post-url-input" placeholder="Nhập URL bài viết mới..." value="${link.url}">
          <button id="copy-shortcuts-btn" class="btn btn-primary">Copy & Shortcuts</button>
        </div>
        <div class="form-row">
          <input type="text" id="image-url-input" placeholder="Nhập URL ảnh mới..." value="${link.image}">
          <button id="paste-image-btn" class="btn btn-primary">Dán & Cập nhật</button>
        </div>
        <div class="button-row">
          <button id="delete-btn" class="btn btn-danger">Xóa</button>
          <button id="close-btn" class="btn btn-secondary">Đóng</button>
        </div>
        <div class="fb-post-wrapper">
          <div class="fb-post-container">
            <div class="fb-post" data-href="${link.url}" data-width="500" data-show-text="true" data-adapt-container-width="true"></div>
          </div>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(popup);

    const adjustPostSize = () => {
        const wrapper = popup.querySelector('.fb-post-wrapper');
        const container = popup.querySelector('.fb-post-container');
        const iframe = popup.querySelector('.fb-post iframe');
        if (!iframe || !container || !wrapper) return;

        const wW = wrapper.clientWidth;
        const wH = wrapper.clientHeight;
        const iW = iframe.clientWidth || 600;
        const iH = iframe.clientHeight || 600;

        const scale = Math.min(wW / iW, wH / iH);
        container.style.transform = `scale(${scale})`;
        container.style.width = `${100 / scale}%`;
        container.style.height = `${100 / scale}%`;
    };

    const waitForIframe = () => {
        const iframe = popup.querySelector('.fb-post iframe');
        if (iframe) {
            iframe.onload = () => setTimeout(adjustPostSize, 300);
            adjustPostSize();
        } else {
            setTimeout(waitForIframe, 200);
        }
    };

    const resizeObserver = new ResizeObserver(adjustPostSize);
    resizeObserver.observe(popup.querySelector('.fb-post-wrapper'));

    const closePopup = () => {
        resizeObserver.disconnect();
        popup.remove();
    };

    // Nút Copy & Shortcuts
    popup.querySelector('#copy-shortcuts-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const shortcutsUrl = `shortcuts://run-shortcut?name=111&input=text&text=${encodeURIComponent(link.url)}`;
        window.open(shortcutsUrl, '_blank');
        navigator.clipboard.writeText(link.url);
    });

    // Nút Dán & Cập nhật
    popup.querySelector('#paste-image-btn').addEventListener('click', async () => {
        const imageInput = popup.querySelector('#image-url-input');
        let clipboardImageUrl = '';

        try {
            clipboardImageUrl = await navigator.clipboard.readText();
        } catch (err) {
            console.log('Clipboard error:', err.message);
        }

        imageInput.value = clipboardImageUrl;
        const newImageUrl = imageInput.value.trim();

        saveBackup('updateImage', {
            linkId: link.id,
            oldImage: link.image,
            newImage: newImageUrl
        });

        link.image = newImageUrl;
        saveData({ links: true });
        updateLinkItem(link);
        closePopup();
        showToast('Đã cập nhật ảnh', 'success');
    });

    // Nút Xóa
    popup.querySelector('#delete-btn').addEventListener('click', () => {
        if (confirm(`Xóa link: ${link.url}?`)) {
            saveBackup('deleteLinks', { links: [{ ...link }] });
            state.links = state.links.filter(l => l.id !== link.id);
            saveData({ links: true });
            updateCounters();
            showToast(`Đã xóa link ${link.url}`, 'success');
            addLog(`Đã xóa link ${link.url} (ID: ${link.id})`, 'info');
            closePopup();
        }
    });

    // Nút Đóng
    popup.querySelector('#close-btn').addEventListener('click', closePopup);
    popup.querySelector('.modal-close').addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    if (!window.FB) {
        const script = document.createElement('script');
        script.src = 'https://connect.facebook.net/vi_VN/sdk.js#xfbml=1&version=v12.0&appId=YOUR_APP_ID';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.FB.XFBML.parse(popup, () => setTimeout(waitForIframe, 500));
        };
        document.body.appendChild(script);
    } else {
        window.FB.XFBML.parse(popup, () => setTimeout(waitForIframe, 500));
    }
}
function toggleTheme(isDarkTheme) {
    document.body.classList.toggle('dark-theme', isDarkTheme);
    document.body.classList.toggle('light-theme', !isDarkTheme);
}
function renderLogs() {
    const container = elements.linkLists['log'];
    if (!container) {
        console.error('Không tìm thấy container cho tab log');
        return;
    }
    container.innerHTML = '';

    // Container cho các nút
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '10px';

    // Nút đổi tay trái/phải
    const handednessButton = document.createElement('button');
    handednessButton.id = 'toggle-handedness';
    handednessButton.textContent = 'Đổi tay trái/phải';
    handednessButton.className = 'btn';
    buttonContainer.appendChild(handednessButton);

    // Nút đổi chế độ sáng/tối
    const themeButton = document.createElement('button');
    themeButton.id = 'toggle-theme';
    themeButton.textContent = 'Chuyển sáng/tối';
    themeButton.className = 'btn';
    buttonContainer.appendChild(themeButton);

    container.appendChild(buttonContainer);

    // Sự kiện cho nút đổi tay trái/phải
    handednessButton.addEventListener('click', () => {
        const isLeftHanded = !localStorage.getItem('isLeftHanded') || localStorage.getItem('isLeftHanded') === 'false';
        localStorage.setItem('isLeftHanded', isLeftHanded);
        toggleHandedness(isLeftHanded);
        addLog(`Chuyển chế độ: ${isLeftHanded ? 'Tay trái' : 'Tay phải'}`, 'info');
    });

    // Sự kiện cho nút đổi sáng/tối
    themeButton.addEventListener('click', () => {
        const isDarkTheme = !localStorage.getItem('isDarkTheme') || localStorage.getItem('isDarkTheme') === 'false';
        localStorage.setItem('isDarkTheme', isDarkTheme);
        toggleTheme(isDarkTheme);
        addLog(`Chuyển chế độ: ${isDarkTheme ? 'Tối' : 'Sáng'}`, 'info');
    });

    // Hiển thị danh sách log
    if (state.logs.length === 0) {
        container.innerHTML += '<p>Không có log nào.</p>';
    } else {
        state.logs.forEach((log, index) => {
            const logItem = document.createElement('div');
            logItem.className = `log-item log-${log.type}`;
            logItem.innerHTML = `
                <span class="log-time">[${new Date(log.time).toLocaleString()}]</span>
                <span class="log-message">${log.message}</span>
            `;
            container.appendChild(logItem);
        });
    }

    // Khôi phục vị trí cuộn
    if (elements.mainContent) {
        elements.mainContent.scrollTop = state.scrollPosition || 0;
    }
}
function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')                // Tách dấu ra khỏi ký tự
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/[\s\-_.]/g, '');       // Bỏ khoảng trắng, gạch nối, gạch dưới, chấm
}
function showFilterKeywordsPopup() {
    const popup = document.createElement('div');
    popup.className = 'modal-overlay';
    popup.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <h3>Danh sách từ khóa lọc</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <input type="text" id="filter-keyword-input" placeholder="Nhập từ khóa mới..." style="width: 100%; margin-bottom: 10px;">
                <button id="save-filter-keyword" class="btn btn-primary">Lưu từ khóa</button>
                <div id="filter-keywords-list" style="margin-top: 15px;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const input = popup.querySelector('#filter-keyword-input');
    const saveBtn = popup.querySelector('#save-filter-keyword');
    const listEl = popup.querySelector('#filter-keywords-list');

    function renderKeywordList() {
        listEl.innerHTML = '';
        (state.filterKeywords || []).forEach((word, i) => {
            const el = document.createElement('div');
            el.innerHTML = `${word} <button data-index="${i}" class="btn btn-sm">X</button>`;
            el.querySelector('button').onclick = () => {
                state.filterKeywords.splice(i, 1);
                localStorage.setItem('filterKeywords', JSON.stringify(state.filterKeywords));
                renderKeywordList();
            };
            listEl.appendChild(el);
        });
    }

    saveBtn.onclick = () => {
        const newWord = input.value.trim();
        if (newWord && !state.filterKeywords.includes(newWord)) {
            state.filterKeywords.push(newWord);
            localStorage.setItem('filterKeywords', JSON.stringify(state.filterKeywords));
            input.value = '';
            renderKeywordList();
        }
    };

    popup.querySelector('.modal-close').onclick = () => document.body.removeChild(popup);
    popup.onclick = e => e.target === popup && document.body.removeChild(popup);

    state.filterKeywords = JSON.parse(localStorage.getItem('filterKeywords') || '[]');
    renderKeywordList();
}
function filterByKeywords(urlsOrItems) {
    const keywords = (state.filterKeywords || []).map(normalize);
    return urlsOrItems.filter(item => {
        const str = typeof item === 'string' ? item : JSON.stringify(item);
        const normStr = normalize(str);
        return !keywords.some(kw => normStr.includes(kw));
    });
}
function loadMiniIframe(container, url) {
    const cachedIframe = getCachedIframeContent(url);
    if (cachedIframe) {
        container.innerHTML = cachedIframe;
        return;
    }
    const iframeHtml = `<iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=60&height=60&show_text=false" width="60" height="60" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" loading="lazy"></iframe>`;
    container.innerHTML = iframeHtml;
    cacheIframeContent(url, iframeHtml);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            container.innerHTML = iframeHtml;
            observer.disconnect();
        }
    }, { rootMargin: '100px' });
    observer.observe(container);
}
function addLog(message, type) {
    const log = {
        id: Date.now(),
        message,
        type,
        timestamp: new Date().toLocaleString()
    };
    state.logs.unshift(log); // Thêm log mới vào đầu
    if (state.logs.length > 20) {
        state.logs = state.logs.slice(0, 20); // Giới hạn 20 log
    }
    saveData({ logs: true });
}
// Refactored renderTabContent to use update functions
function renderTabContent(tab) {
    if (state.disableRender) {
        console.log(`[renderTabContent] Bỏ qua render vì disableRender = true (tab: ${tab})`);
        return;
    }
    switch (tab) {
        case 'log':
            renderLogs();
            break;
        case 'filter':
            renderFilteredResults(elements.linkLists['filter'], state.currentFilter, state.lastActiveTab === 'fanpage' ? 'fanpages' : 'links');
            break;
        default:
            renderLinks(tab);
            break;
    }
}
// Refactored renderLinks to use 
function renderLinks(tab) {
    const container = elements.linkLists[tab];
    if (!container) {
        console.error(`Không tìm thấy tab: ${tab}`);
        return;
    }
    container.innerHTML = '';
    const links = getLinksForCurrentTab();
    links.forEach((link, index) => {
        const linkItem = createLinkItem(link, index);
        container.appendChild(linkItem);
    });
    updateCounters();
    if (elements.mainContent) {
        elements.mainContent.scrollTop = state.scrollPosition || 0;
    }
}
// Utility function to update the DOM for a single link
function updateLinkItem(link) {
    const item = document.querySelector(`.link-item[data-id="${link.id}"]`);
    if (!item) return;

    // Update checkbox
    const checkbox = item.querySelector('.link-checkbox');
    if (checkbox) checkbox.checked = link.checked;
    item.classList.toggle('checked', link.checked);

    // Update status if needed
    const statusElement = item.querySelector('.link-status');
    if (statusElement) {
        statusElement.className = `link-status status-${link.blacklistStatus === 'blacklisted' ? 'blacklist' : link.status}`;
        statusElement.innerHTML = link.blacklistStatus === 'blacklisted'
            ? '<span class="blacklist-text">Blacklist</span>'
            : link.status === 'success' ? 'Thành công'
                : link.status === 'iframe' ? 'Hiển thị iframe'
                    : link.status === 'login' ? 'Yêu cầu đăng nhập'
                        : link.status === 'link_hỏng' ? 'Link hỏng'
                            : link.status === 'error' ? 'Lỗi' : 'Không xác định';
    }

    // Update note if needed
    if (link.note) {
        const noteElement = item.querySelector('.note-text');
        if (noteElement) {
            noteElement.textContent = link.note;
        }
    }
}
// Refactored toggleCheckbox (keep as reference)
function toggleCheckbox(link) {
    saveBackup('checkbox', { linkId: link.id, checked: link.checked });
    link.checked = !link.checked;
    saveData({ links: true });
    updateLinkItem(link);
    updateCounters();
}
// Refactored extractContent
async function extractContent(url) {
    const link = state.links.find(l => l.url === url);
    if (!link) return;

    const tryExtract = async () => {
        try {
            const startTime = Date.now();
            const fetchUrl = `${config.corsProxy}${encodeURIComponent(url)}`;

            const response = await fetch(fetchUrl, {
                signal: AbortSignal.timeout(config.requestTimeout)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const proxyData = await response.json();
            const htmlContent = proxyData.contents;
            if (!htmlContent) throw new Error('Không có nội dung trả về');

            const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
            const title = doc.querySelector('title')?.textContent || '';
            const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
            const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
            const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

            return {
                title: decodeHTMLEntities(ogTitle || title || 'Bài viết lỗi'),
                description: decodeHTMLEntities(ogDesc || ''),
                image: ogImage || config.defaultImage,
                htmlContent,
                processingTime: Date.now() - startTime
            };
        } catch (err) {
            throw err;
        }
    };

    try {
        const result = await tryExtract();

        link.title = result.title;
        link.description = result.description;
        link.image = result.image;
        link.post_type = link.post_type && link.post_type !== 'unknown' ? link.post_type : determinePostType(url);
        link.processingTime = result.processingTime;

        const html = result.htmlContent.toLowerCase();

        if (link.image === config.defaultImage || link.image.includes('facebook.com/plugins/')) {
            link.status = 'iframe';
            link.image = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=300&show_text=true`;
        }
        else if (link.description || link.image !== config.defaultImage) {
            link.status = 'success';
        } else if (html.includes('login')) {
            link.status = 'login';
            link.title = 'Yêu cầu đăng nhập';
            link.description = 'Bài viết hạn chế yêu cầu đăng nhập để xem nội dung';
        } else if (html.includes('content not found') || html.includes('unavailable') || html.includes('removed')) {
            link.status = 'link_hỏng';
            link.title = 'Bài viết lỗi';
            link.description = 'Không có nội dung';
        } else {
            link.status = 'error';
            link.title = 'Bài viết lỗi';
            link.description = 'Không có nội dung';
        }

        addLog(`Đã trích xuất thành công: ${url} (ID: ${link.id})`, 'success');
    } catch (error) {
        link.title = 'Bài viết lỗi';
        link.description = 'Không có nội dung';
        link.image = config.defaultImage;
        link.status = 'iframe';
        link.post_type = link.post_type && link.post_type !== 'unknown' ? link.post_type : determinePostType(url);

        addLog(`Lỗi khi trích xuất qua proxy ${url} (ID: ${link.id}): ${error.message}`, 'error');
    } finally {
        saveData({ links: true });
        updateLinkItem(link);
    }
}
// Refactored toggleSelectAll
function toggleSelectAll() {
    if (state.currentTab === 'filter' && state.lastActiveTab === 'fanpage') {
        const fanpagesToToggle = getFilteredFanpages(state.currentFilter || 'all');
        const allChecked = fanpagesToToggle.every(f => f.checked);

        saveBackup('selectAllFanpages', { fanpages: fanpagesToToggle });
        fanpagesToToggle.forEach(f => f.checked = !allChecked);

        saveData({ fanpages: true });
        updateCounters();

        showToast(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} tất cả ${fanpagesToToggle.length} fanpage`, 'info');
        addLog(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} tất cả ${fanpagesToToggle.length} fanpage`, 'info');

        // Làm mới giao diện
        const container = elements.linkLists['filter'] || document.querySelector('#filter-results');
        renderFilteredResults(container, state.currentFilter || 'all', 'fanpages');

        if (!allChecked && fanpagesToToggle.length > 0) {
            showSelectionActionsDialog(fanpagesToToggle.length, 'fanpages');
        }
    } else {
        let linksToToggle;
        if (state.currentTab === 'filter') {
            linksToToggle = getFilteredLinksForFilterTab();
        } else {
            linksToToggle = getLinksForCurrentTab();
        }

        const allChecked = linksToToggle.every(l => l.checked);

        saveBackup('selectAll', { links: linksToToggle.map(l => ({ ...l })) });
        linksToToggle.forEach(link => {
            link.checked = !allChecked;
            updateLinkItem(link);
        });

        saveData({ links: true });
        updateCounters();

        showToast(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} ${linksToToggle.length} link`, 'info');
        addLog(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} ${linksToToggle.length} link trong tab ${state.currentTab}`, 'info');

        // Làm mới giao diện
        if (state.currentTab === 'filter') {
            const container = elements.linkLists['filter'] || document.querySelector('#filter-results');
            renderFilteredResults(container, state.currentFilter || 'all', 'links');
        } else {
            renderTabContent(state.currentTab);
        }

        if (!allChecked && linksToToggle.length > 0) {
            showSelectionActionsDialog(linksToToggle.length, 'links');
        }
    }
}

function getFilteredLinksForFilterTab() {
    let filteredLinks = [];
    const searchQuery = state.dateFilter.searchQuery.toLowerCase();
    const dateQuery = state.dateFilter.dateQuery;

    switch (state.currentFilter) {
        case 'group':
            filteredLinks = state.links.filter(l => l.post_type === 'group' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'photo':
            filteredLinks = state.links.filter(l => l.post_type === 'photo' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'story':
            filteredLinks = state.links.filter(l => l.post_type === 'story' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'video':
            filteredLinks = state.links.filter(l => l.post_type === 'video' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'reel':
            filteredLinks = state.links.filter(l => l.post_type === 'reel' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'post':
            filteredLinks = state.links.filter(l => l.post_type === 'post' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'iframe':
            filteredLinks = state.links.filter(l => l.status === 'iframe' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'duplicate':
            const urlGroups = {};
            state.links.forEach(l => {
                if (!urlGroups[l.url]) urlGroups[l.url] = [];
                urlGroups[l.url].push(l);
            });
            filteredLinks = Object.values(urlGroups)
                .filter(group => group.length > 1 && group.every(l => l.blacklistStatus !== 'blacklisted'))
                .flat();
            break;
        case 'blacklist':
            filteredLinks = state.links.filter(l => l.blacklistStatus === 'blacklisted');
            break;
        case 'note':
            filteredLinks = state.links.filter(l => l.note && l.note.trim() !== '');
            break;
        case 'success':
            filteredLinks = state.links.filter(l => l.status === 'success' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'image_scontent':
            filteredLinks = state.links.filter(l =>
                l.image && typeof l.image === 'string' &&
                l.image.includes('scontent') && l.image.includes('fbcdn.net') &&
                !l.image.includes('/ads/') && !l.image.includes('/adsarchive/') &&
                l.blacklistStatus !== 'blacklisted'
            );
            break;
        default:
            filteredLinks = state.links.filter(l => l.blacklistStatus !== 'blacklisted');
            break;
    }

    if (searchQuery) {
        filteredLinks = filteredLinks.filter(l =>
            (l.title && l.title.toLowerCase().includes(searchQuery)) ||
            (l.description && l.description.toLowerCase().includes(searchQuery))
        );
    }

    if (dateQuery) {
        filteredLinks = filteredLinks.filter(l =>
            l.date && l.date.includes(dateQuery)
        );
    }

    return filteredLinks;
}
function createItem({ item, index, type, templateFn, eventHandlers }) {
    const element = document.createElement('div');
    element.className = `link-item ${item.checked ? 'checked' : ''}`;
    element.dataset.id = item.id;
    element.innerHTML = templateFn(item, index);
    const checkbox = element.querySelector('.link-checkbox');
    checkbox?.addEventListener('change', () => eventHandlers.onCheckboxChange(item, checkbox.checked, element));
    element.addEventListener('click', (e) => eventHandlers.onItemClick(e, item, checkbox));
    element.querySelector('.link-index')?.addEventListener('click', () => eventHandlers.onDelete(item));
    element.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => eventHandlers.onActionClick(e, btn, item));
    });
    return element;
}
function createLinkItem(link, index, isFilterTab = false) {
    return createItem({
        item: link,
        index,
        type: 'link',
        templateFn: (link, index) => {
            const postTypeLabel = link.post_type ? `[${link.post_type.toUpperCase()}] ` : '';
            const displayTitle = link.title || link.url;
            const displayDescription = link.description || '';
            const indexStr = (index + 1).toString();
            const indexDigits = indexStr.split('').map(digit => `<span>${digit}</span>`).join('');
            return `
                <input type="checkbox" class="link-checkbox" ${link.checked && !isFilterTab ? 'checked' : ''}>
                <div class="link-row">
                    <button class="link-index" title="Xóa link này">${indexDigits}</button>
                    <div class="link-thumbnail">
                        <div class="thumbnail-wrapper">
                            ${link.status === 'iframe'
                    ? `<iframe src="${link.image}" width="100" height="100" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" loading="lazy"></iframe>`
                    : link.image
                        ? `<img src="${link.image}" alt="Thumbnail" loading="lazy">`
                        : `<i class="fas fa-link fa-icon"></i>`}
                            <div class="thumbnail-overlay"></div>
                        </div>
                    </div>
                    <div class="link-content">
                        <div class="link-title post-type-${link.post_type}">${postTypeLabel}${displayTitle}</div>
                        <div class="link-description">${displayDescription}</div>
                        <div class="link-meta">
                            <span class="link-time">${link.note ? `<span class="note-text">${link.note}</span>` : formatDateTime(link.date)}</span>
                            <span class="link-status status-${link.blacklistStatus === 'blacklisted' ? 'blacklist' : link.status}">
                                ${link.blacklistStatus === 'blacklisted' ? '<span class="blacklist-text">Blacklist</span>' :
                    link.status === 'success' ? 'Thành công' :
                        link.status === 'iframe' ? 'Hiển thị iframe' :
                            link.status === 'login' ? 'Yêu cầu đăng nhập' :
                                link.status === 'link_hỏng' ? 'Link hỏng' :
                                    link.status === 'error' ? 'Lỗi' : 'Không xác định'}
                            </span>
                        </div>
                    </div>
                    <div class="link-actions">
                        <button class="action-btn view-post" title="Xem bài viết"><i class="fas fa-eye"></i></button>
                        <button class="action-btn note" title="Ghi chú"><i class="fas fa-comment-alt"></i></button>
                        ${link.blacklistStatus === 'active' ? `<button class="action-btn block" title="Chặn"><i class="fas fa-ban"></i></button>` : `<button class="action-btn unblock" title="Khôi phục"><i class="fas fa-undo"></i></button>`}
                    </div>
                </div>
            `;
        },
        eventHandlers: {
            onCheckboxChange: (link, checked, element) => {
                if (!isFilterTab) {
                    toggleCheckbox(link);
                    element.classList.toggle('checked', link.checked);
                } else {
                    console.log(`Checkbox changed for link ID: ${link.id} in filter tab`);
                }
            },
            onItemClick: (e, link, checkbox) => {
                const isCheckbox = e.target.matches('.link-checkbox');
                const isInsideActions = e.target.closest('.link-actions');
                const isInsideIndex = e.target.closest('.link-index');
                const isInsideThumbnail = e.target.closest('.link-thumbnail'); // Thêm dòng này

                // Nếu click vào checkbox, action, index, hoặc thumbnail → không mở URL
                if (isCheckbox || isInsideActions || isInsideIndex || isInsideThumbnail) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                    return;
                }

                // Mặc định: toggle và mở URL nếu check
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));

                if (checkbox.checked && link.url) {
                    window.location.href = link.url;
                }
            },
            onDelete: (link) => {
                if (confirm(`Xóa link: ${link.url}?`)) {
                    saveBackup('deleteLinks', { links: [{ ...link }] });
                    state.links = state.links.filter(l => l.id !== link.id);
                    saveData({ links: true });
                    renderTabContent(state.currentTab);
                    updateCounters();
                    showToast(`Đã xóa link ${link.url}`, 'success');
                    addLog(`Đã xóa link ${link.url} (ID: ${link.id})`, 'info');
                }
            },
            onActionClick: (e, btn, link) => {
                e.stopPropagation();
                if (btn.classList.contains('view-post')) showLinkDetailsPopup(link);
                if (btn.classList.contains('note')) showNoteDialog(link);
                if (btn.classList.contains('block')) {
                    saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
                    link.blacklistStatus = 'blacklisted';
                    saveData({ links: true });
                    renderTabContent(state.currentTab);
                    updateCounters();
                    showToast(`Đã chặn link: ${link.url}`, 'success');
                    addLog(`Đã chặn link ${link.url} (ID: ${link.id})`, 'info');
                }
                if (btn.classList.contains('unblock')) {
                    saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
                    link.blacklistStatus = 'active';
                    saveData({ links: true });
                    renderTabContent(state.currentTab);
                    updateCounters();
                    showToast(`Đã khôi phục: ${link.url}`, 'success');
                    addLog(`Đã khôi phục link ${link.url} (ID: ${link.id})`, 'info');
                }
            }
        }
    });
}
function createFanpageItem(fanpage, index, isFilterTab = false) {
    return createItem({
        item: fanpage,
        index,
        type: 'fanpage',
        templateFn: (fanpage, index) => {
            const indexStr = (index + 1).toString();
            const indexDigits = indexStr.split('').map(digit => `<span>${digit}</span>`).join('');
            return `
                <input type="checkbox" class="link-checkbox" ${fanpage.checked && !isFilterTab ? 'checked' : ''}>
                <div class="link-row">
                    <button class="link-index" title="Xóa fanpage này">${indexDigits}</button>
                    <div class="link-thumbnail">
                        <div class="fanpage-iframe-mini" data-url="${fanpage.url}"></div>
                    </div>
                    <div class="link-content">
                        <div class="link-title">${fanpage.name}</div>
                        <div class="link-description">${fanpage.description || ''}</div>
                        <div class="link-meta">
                            <span class="link-time">${formatDateTime(fanpage.date)}</span>
                            <span class="link-status ${fanpage.type}">${getTypeLabel(fanpage.type)}</span>
                        </div>
                    </div>
                    <div class="link-actions">
                        <button class="action-btn edit" title="Sửa"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
            `;
        },
        eventHandlers: {
            onCheckboxChange: (fanpage, checked, element) => {
                if (!isFilterTab) {
                    fanpage.checked = checked;
                    updateSelectionBar(getFilteredFanpages(
                        elements.linkLists['fanpage'].querySelector('.filter-btn.active')?.dataset.filter || 'all',
                        elements.linkLists['fanpage'].querySelector('#fanpage-filter-search')?.value.trim().toLowerCase() || ''
                    ));
                    saveData({ fanpages: true });
                    element.classList.toggle('checked', fanpage.checked);
                } else {
                    console.log(`Checkbox changed for fanpage ID: ${fanpage.id} in filter tab`);
                }
            },
            onItemClick: (e, fanpage, checkbox) => {
                if (!e.target.closest('.link-checkbox') && !e.target.closest('.link-actions')) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            },
            onDelete: (fanpage) => {
                if (confirm(`Xóa fanpage: ${fanpage.url}?`)) {
                    removeFanpageItem(fanpage.id);
                }
            },
            onActionClick: (e, btn, fanpage) => {
                e.stopPropagation();
                if (btn.classList.contains('edit')) showEditFanpagePopup(fanpage);
            }
        }
    });
}
////DELETE/////
async function deleteItems({ items, type, confirmMessage, backupType, successMessage, renderFn }) {
    if (!items.length) {
        showToast('Không có mục nào được chọn', 'warning');
        return;
    }
    if (confirm(confirmMessage)) {
        saveBackup(backupType, { [type]: [...items] });
        if (type === 'links') {
            state.links = state.links.filter(l => !items.includes(l));
        } else {
            state.fanpages = state.fanpages.filter(f => !items.includes(f));
        }
        await saveData({ [type]: true });
        renderFn();
        updateCounters();
        showToast(successMessage, 'success');
        addLog(successMessage, 'info');
    }
}
function deleteSelected() {
    let selectedItems = [];
    let type = 'links';
    if (state.currentTab === 'filter') {
        type = state.lastActiveTab === 'fanpage' ? 'fanpages' : 'links';
        const container = elements.linkLists['filter'];
        const selectedIds = Array.from(container.querySelectorAll('.link-checkbox:checked'))
            .map(cb => cb.closest('.link-item').dataset.id);
        selectedItems = (type === 'links' ? state.links : state.fanpages).filter(item => selectedIds.includes(item.id));
    } else {
        selectedItems = getLinksForCurrentTab().filter(link => link.checked);
    }
    deleteItems({
        items: selectedItems,
        type,
        confirmMessage: `Bạn có chắc muốn xóa ${selectedItems.length} ${type === 'links' ? 'link' : 'fanpage'} đã chọn?`,
        backupType: `delete${type.charAt(0).toUpperCase() + type.slice(1)}`,
        successMessage: `Đã xóa ${selectedItems.length} ${type === 'links' ? 'link' : 'fanpage'}`,
        renderFn: () => {
            if (state.currentTab === 'filter') {
                renderFilteredResults(elements.linkLists['filter'], state.currentFilter, type);
            }
            if (type === 'links' && state.currentTab !== 'filter') {
                renderTabContent('all-link');
            } else if (type === 'fanpages' && state.currentTab !== 'filter') {
                renderTabContent('fanpage');
            }
        }
    });
}
function deleteSelected() {
    let selectedItems = [];
    let type = 'links';
    if (state.currentTab === 'filter') {
        type = state.lastActiveTab === 'fanpage' ? 'fanpages' : 'links';
        const container = elements.linkLists['filter'];
        const selectedIds = Array.from(container.querySelectorAll('.link-checkbox:checked'))
            .map(cb => cb.closest('.link-item').dataset.id);
        selectedItems = (type === 'links' ? state.links : state.fanpages).filter(item => selectedIds.includes(item.id));
    } else {
        selectedItems = getLinksForCurrentTab().filter(link => link.checked);
    }
    deleteItems({
        items: selectedItems,
        type,
        confirmMessage: `Bạn có chắc muốn xóa ${selectedItems.length} ${type === 'links' ? 'link' : 'fanpage'} đã chọn?`,
        backupType: `delete${type.charAt(0).toUpperCase() + type.slice(1)}`,
        successMessage: `Đã xóa ${selectedItems.length} ${type === 'links' ? 'link' : 'fanpage'}`,
        renderFn: () => {
            if (state.currentTab === 'filter') {
                renderFilteredResults(elements.linkLists['filter'], state.currentFilter, type);
            }
            if (type === 'links' && state.currentTab !== 'filter') {
                renderTabContent('all-link');
            }
        }
    });
}
function deleteFanpage(fanpageId) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;
    deleteItems({
        items: [fanpage],
        type: 'fanpages',
        confirmMessage: `Bạn có chắc muốn xóa fanpage "${fanpage.name}"?`,
        backupType: 'deleteFanpage',
        successMessage: `Đã xóa fanpage ${fanpage.name}`,
        renderFn: () => renderTabContent('fanpage')
    });
}
init();
function setupEventListeners() {
    console.log('Setting up event listeners');

    elements.statusCounters.all = document.querySelector('#all-counter');
    if (elements.statusCounters.all) {
        elements.statusCounters.all.addEventListener('click', () => switchTab('all-link'));
    } else {
        console.warn('Button all-counter not found');
        addLog('Không tìm thấy nút all-counter', 'warning');
    }

    elements.statusCounters.filter = document.querySelector('#filter-counter');
    if (elements.statusCounters.filter) {
        elements.statusCounters.filter.addEventListener('click', () => {
            console.log('Filter button clicked, opening popup');
            showFilterPopup();
        });
    } else {
        console.warn('Button filter-counter not found');
        addLog('Không tìm thấy nút filter-counter', 'warning');
    }

    elements.headerBtns.addLink = document.querySelector('#add-link-btn');
    if (elements.headerBtns.addLink) {
        elements.headerBtns.addLink.addEventListener('click', () => {
            if (state.currentTab === 'filter' && state.lastActiveTab === 'fanpage') {
                showAddFanpageDialog();
            } else {
                showAddLinkDialog();
            }
        });
    } else {
        console.warn('Button add-link not found');
        addLog('Không tìm thấy nút add-link', 'warning');
    }

    elements.headerBtns.log = document.querySelector('#log-btn');
    if (elements.headerBtns.log) {
        elements.headerBtns.log.addEventListener('click', () => switchTab('log'));
    } else {
        console.warn('Button log not found');
        addLog('Không tìm thấy nút log', 'warning');
    }

    elements.headerBtns.selectAll = document.querySelector('#select-all-counter-btn');
    if (elements.headerBtns.selectAll) {
        elements.headerBtns.selectAll.addEventListener('click', () => toggleSelectAll());
    } else {
        console.warn('Button select-all not found');
        addLog('Không tìm thấy nút select-all', 'warning');
    }

    elements.headerBtns.delete = document.querySelector('#delete-btn');
    if (elements.headerBtns.delete) {
        elements.headerBtns.delete.addEventListener('click', () => {
            if (state.currentTab === 'filter' && state.lastActiveTab === 'fanpage') {
                deleteSelectedFanpages();
            } else {
                deleteSelected();
            }
        });
    } else {
        console.warn('Button delete not found');
        addLog('Không tìm thấy nút delete', 'warning');
    }

    elements.headerBtns.undo = document.querySelector('#undo-btn');
    if (elements.headerBtns.undo) {
        elements.headerBtns.undo.addEventListener('click', () => undoAction());
    } else {
        console.warn('Button undo not found');
        addLog('Không tìm thấy nút undo', 'warning');
    }

    elements.headerBtns.scroll = document.querySelector('#scroll-btn');
    if (elements.headerBtns.scroll) {
        elements.headerBtns.scroll.addEventListener('click', () => smartScroll());
    } else {
        console.warn('Button scroll not found');
        addLog('Không tìm thấy nút scroll', 'warning');
    }

    if (elements.mainContent) {
        elements.mainContent.addEventListener('scroll', debounce(() => {
            if (state.currentTab === 'filter') {
                state.filterScrollPosition = elements.mainContent.scrollTop;
                saveData({ filterScrollPosition: true });
            } else {
                state.scrollPosition = elements.mainContent.scrollTop;
                saveData({ scrollPosition: true });
            }
        }, config.debounceDelay));
    } else {
        addLog('Không tìm thấy scroll-container', 'warning');
    }

    window.addEventListener('error', (event) => {
        addLog(`Lỗi hệ thống: ${event.message}`, 'error');
        showToast('Đã xảy ra lỗi hệ thống', 'danger');
    });
}
