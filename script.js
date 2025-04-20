// Cấu hình ứng dụng
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
    githubToken: localStorage.getItem('githubToken') || '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', // Token GitHub
    debounceDelay: 500, // Độ trễ debounce (ms)
    fanpageGistUrl: 'https://api.github.com/gists/2cc79f453b3be62607c5ee8cb34e6cab', // Gist cho Jsonfanpage, Jsonalllink, Jsonlink
    backupUrl: 'http://127.0.0.1:10000', // URL WebDAV backup
    dataFile: '/var/mobile/new/data-fb.json', // File lưu trữ dữ liệu
    fanpagesPerPage: 20, // Số fanpage hiển thị mỗi trang
    maxRetries: 3, // Số lần thử lại
    retryDelay: 1000,
    dbName: 'FBLinkManagerDB',
    dbVersion: 1,
    storeNames: {
        links: 'links',
        fanpages: 'fanpages',
        logs: 'logs',
        settings: 'settings'
    }
};

// Hàm khởi tạo/mở cơ sở dữ liệu
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(config.dbName, config.dbVersion);

        request.onerror = (event) => {
            console.error('Lỗi mở IndexedDB:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Tạo các object store nếu chưa tồn tại
            if (!db.objectStoreNames.contains(config.storeNames.links)) {
                db.createObjectStore(config.storeNames.links, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(config.storeNames.fanpages)) {
                db.createObjectStore(config.storeNames.fanpages, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(config.storeNames.logs)) {
                db.createObjectStore(config.storeNames.logs, { keyPath: 'timestamp' });
            }
            if (!db.objectStoreNames.contains(config.storeNames.settings)) {
                db.createObjectStore(config.storeNames.settings, { keyPath: 'name' });
            }
        };
    });
}

// Hàm helper để thực hiện các thao tác với IndexedDB
async function dbOperation(storeName, operation, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        let request;
        switch (operation) {
            case 'get':
                request = store.get(data);
                break;
            case 'getAll':
                request = store.getAll();
                break;
            case 'add':
                request = store.add(data);
                break;
            case 'put':
                request = store.put(data);
                break;
            case 'delete':
                request = store.delete(data);
                break;
            case 'clear':
                request = store.clear();
                break;
            default:
                reject(new Error('Operation không hợp lệ'));
        }

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Thay thế hàm saveToFile và loadFromFile
async function saveToDB(dataType, data) {
    try {
        // Nếu là mảng, lưu từng item
        if (Array.isArray(data)) {
            const promises = data.map(item =>
                dbOperation(config.storeNames[dataType], 'put', item)
            );
            await Promise.all(promises);
        } else {
            // Lưu object đơn lẻ
            await dbOperation(config.storeNames[dataType], 'put', data);
        }
        return true;
    } catch (error) {
        addLog(`Lỗi khi lưu ${dataType}: ${error.message}`, 'error');
        return false;
    }
}

async function loadFromDB(dataType) {
    try {
        const data = await dbOperation(config.storeNames[dataType], 'getAll');
        return data || [];
    } catch (error) {
        addLog(`Lỗi khi đọc ${dataType}: ${error.message}`, 'error');
        return null;
    }
}

// Thay thế hàm saveData
async function saveData(changes = {}) {
    if (Object.keys(changes).length === 0) return;

    try {
        const promises = [];

        if (changes.links) {
            promises.push(saveToDB('links', state.links));
        }
        if (changes.fanpages) {
            promises.push(saveToDB('fanpages', state.fanpages));
        }
        if (changes.logs) {
            promises.push(saveToDB('logs', state.logs));
        }
        if (changes.scrollPosition) {
            promises.push(dbOperation(config.storeNames.settings, 'put', {
                name: 'scrollPosition',
                value: state.scrollPosition
            }));
        }
        if (changes.dateFilter) {
            promises.push(dbOperation(config.storeNames.settings, 'put', {
                name: 'dateFilter',
                value: state.dateFilter
            }));
        }
        if (changes.fanpageFilter) {
            promises.push(dbOperation(config.storeNames.settings, 'put', {
                name: 'fanpageFilter',
                value: state.fanpageFilter
            }));
        }
        if (changes.undoStack) {
            promises.push(dbOperation(config.storeNames.settings, 'put', {
                name: 'undoStack',
                value: state.undoStack
            }));
        }

        await Promise.all(promises);
    } catch (error) {
        addLog(`Lỗi khi lưu dữ liệu: ${error.message}`, 'error');
    }
}
// Trạng thái ứng dụng
const state = {
    links: [], // Danh sách link
    fanpages: [], // Danh sách fanpage
    logs: [], // Danh sách log
    currentFilter: 'all', // Bộ lọc hiện tại (cho tab filter)
    scrollPosition: 0, // Vị trí cuộn
    isLoading: false, // Trạng thái đang tải
    currentTab: 'all-link', // Tab hiện tại
    lastActiveTab: 'all-link', // Tab trước đó
    undoStack: [], // Ngăn xếp hoàn tác
    scrollState: 0, // Trạng thái cuộn
    dateFilter: { // Bộ lọc ngày
        startDate: '',
        endDate: '',
        status: 'all',
        groupTitles: false,
        searchQuery: ''
    },
    fanpageFilter: { // Bộ lọc fanpage
        currentPage: 1 // Trang hiện tại
    },
    version: '1.2.0' // Phiên bản ứng dụng
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
    }
};

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const debouncedSaveData = debounce(async (changes = {}) => {
    await saveData(changes);
}, config.debounceDelay);

async function backupData() {
    try {
        const data = {
            links: state.links,
            fanpages: state.fanpages,
            logs: state.logs,
            settings: {
                scrollPosition: state.scrollPosition,
                dateFilter: state.dateFilter,
                fanpageFilter: state.fanpageFilter,
                undoStack: state.undoStack
            }
        };

        // Tạo blob để tải xuống
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fb-link-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Đã tạo backup dữ liệu', 'success');
        addLog('Đã tạo backup dữ liệu', 'info');
    } catch (error) {
        showToast('Lỗi khi tạo backup', 'danger');
        addLog(`Lỗi khi tạo backup: ${error.message}`, 'error');
    }
}

async function restoreData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Xóa dữ liệu cũ
                await Promise.all([
                    dbOperation(config.storeNames.links, 'clear'),
                    dbOperation(config.storeNames.fanpages, 'clear'),
                    dbOperation(config.storeNames.logs, 'clear'),
                    dbOperation(config.storeNames.settings, 'clear')
                ]);

                // Lưu dữ liệu mới
                await Promise.all([
                    saveToDB('links', data.links || []),
                    saveToDB('fanpages', data.fanpages || []),
                    saveToDB('logs', data.logs || []),
                    dbOperation(config.storeNames.settings, 'put', {
                        name: 'scrollPosition',
                        value: data.settings?.scrollPosition || 0
                    }),
                    dbOperation(config.storeNames.settings, 'put', {
                        name: 'dateFilter',
                        value: data.settings?.dateFilter || {
                            startDate: '',
                            endDate: '',
                            status: 'all',
                            groupTitles: false,
                            searchQuery: ''
                        }
                    }),
                    dbOperation(config.storeNames.settings, 'put', {
                        name: 'fanpageFilter',
                        value: data.settings?.fanpageFilter || { currentPage: 1 }
                    }),
                    dbOperation(config.storeNames.settings, 'put', {
                        name: 'undoStack',
                        value: data.settings?.undoStack || []
                    })
                ]);

                // Tải lại ứng dụng
                await loadData();
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Lỗi đọc file'));
        reader.readAsText(file);
    });
}
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



function addLog(message, type = 'info') {
    state.logs.unshift({
        timestamp: Date.now(),
        message,
        type
    });
    if (state.logs.length > config.maxLogs) state.logs.pop();
    saveData({ logs: true });
    if (state.currentTab === 'log') renderTabContent('log');
}

function updateCounters() {
    const total = getLinksForCurrentTab().length;
    if (elements.statusCounters.all) elements.statusCounters.all.textContent = total;
    if (elements.statusCounters.filter) elements.statusCounters.filter.textContent = total;
    if (elements.selectAllCounter.count) elements.selectAllCounter.count.textContent = getLinksForCurrentTab().filter(l => l.checked).length || 0;
}

function formatDateTime(date) {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('vi-VN');
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

    switch (backup.type) {
        case 'addLinks':
            state.links = state.links.filter(link => !backup.addedLinks.some(l => l.id === link.id));
            needsSaveData = true;
            showToast(`Hoàn tác: Thêm ${backup.addedLinks.length} link`, 'success');
            break;
        case 'deleteLinks':
            state.links = [...state.links, ...backup.deletedLinks];
            needsSaveData = true;
            scrollToLinkId = backup.deletedLinks[0]?.id;
            showToast(`Hoàn tác: Xóa ${backup.deletedLinks.length} link`, 'success');
            break;
        case 'checkbox':
            const link = state.links.find(l => l.id === backup.linkId);
            if (link) {
                link.checked = backup.checked;
                scrollToLinkId = link.id;
                showToast(`Hoàn tác: Checkbox của link ${link.url.slice(0, 50)}...`, 'success');
            }
            break;
        case 'note':
            const noteLink = state.links.find(l => l.id === backup.linkId);
            if (noteLink) {
                noteLink.note = backup.note;
                scrollToLinkId = noteLink.id;
                showToast(`Hoàn tác: Ghi chú của link ${noteLink.url.slice(0, 50)}...`, 'success');
            }
            break;
        case 'blacklist':
            const blacklistLink = state.links.find(l => l.id === backup.linkId);
            if (blacklistLink) {
                blacklistLink.blacklistStatus = backup.blacklistStatus;
                scrollToLinkId = blacklistLink.id;
                showToast(`Hoàn tác: Trạng thái blacklist của link ${blacklistLink.url.slice(0, 50)}...`, 'success');
            }
            break;
        case 'selectAll':
            backup.checkedLinks.forEach(({ id, checked }) => {
                const link = state.links.find(l => l.id === id);
                if (link) link.checked = checked;
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
                editedLink.post_type = determinePostType(backup.url); // Recalculate post type
                scrollToLinkId = editedLink.id;
                needsSaveData = true;
                showToast(`Hoàn tác: Chỉnh sửa link ${editedLink.url.slice(0, 50)}...`, 'success');
            }
            break;
    }

    if (needsSaveData) saveData({ links: true, fanpages: true });
    renderTabContent(state.currentTab);
    if (elements.mainContent && scrollToLinkId) {
        setTimeout(() => {
            const linkItem = document.querySelector(`.link-item[data-id="${scrollToLinkId}"]`);
            if (linkItem) smoothScroll(elements.mainContent, linkItem.offsetTop);
            else elements.mainContent.scrollTop = backup.scrollPosition || 0;
        }, 100);
    }
    updateCounters();
    addLog(`Hoàn tác hành động: ${backup.type}`, 'info');
}

function filterPersonalFanpages(fanpages) {
    // Lọc fanpage có type: 'profile'
    const filtered = fanpages.filter(fanpage => {
        console.log('Checking fanpage for Personal filter:', { id: fanpage.id, type: fanpage.type, name: fanpage.name });
        return fanpage.type === 'profile';
    });

    // Sắp xếp theo tiêu đề
    return filtered.sort((a, b) => {
        const titleA = a.name.toLowerCase();
        const titleB = b.name.toLowerCase();
        const numA = parseInt(titleA.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(titleB.match(/\d+/)?.[0] || '0', 10);
        if (numA && numB) return numA - numB;
        return titleA.localeCompare(titleB);
    });
}
function switchTab(tab) {
    Object.values(elements.linkLists).forEach(el => {
        if (el) {
            el.style.display = 'none';
        }
    });

    if (elements.linkLists[tab]) {
        elements.linkLists[tab].style.display = 'block';
        state.lastActiveTab = state.currentTab;
        state.currentTab = tab;
        renderTabContent(tab);
    }
}

function getLinksForCurrentTab() {
    if (state.currentTab === 'all-link') return state.links;
    if (state.currentTab === 'blacklist') return state.links.filter(l => l.blacklistStatus === 'blacklisted');
    if (state.currentTab === 'error') return state.links.filter(l => ['error', 'login', 'link_hỏng'].includes(l.status) && l.blacklistStatus !== 'blacklisted');
    if (state.currentTab === 'duplicate') return state.links.filter((l, i) => state.links.findIndex(x => x.title === l.title) !== i);
    if (state.currentTab === 'date-filter') return state.links.filter(link => {
        const linkDate = new Date(link.date);
        const start = new Date(state.dateFilter.startDate);
        const end = new Date(state.dateFilter.endDate);
        const inDateRange = (!state.dateFilter.startDate || !state.dateFilter.endDate) || (linkDate >= start && linkDate <= end);
        const matchStatus = state.dateFilter.status === 'all' || link.status === state.dateFilter.status;
        const matchSearch = !state.dateFilter.searchQuery ||
            (link.title && link.title.toLowerCase().includes(state.dateFilter.searchQuery.toLowerCase())) ||
            (link.description && link.description.toLowerCase().includes(state.dateFilter.searchQuery.toLowerCase()));
        return inDateRange && matchStatus && matchSearch;
    });
    if (state.currentTab === 'filter') {
        switch (state.currentFilter) {
            case 'video':
                return state.links.filter(l => l.post_type === 'video' && l.blacklistStatus !== 'blacklisted');
            case 'login':
                return state.links.filter(l => l.status === 'login' && l.blacklistStatus !== 'blacklisted');
            case 'duplicate':
                return state.links.filter((l, i) => state.links.findIndex(x => x.title === l.title) !== i && l.blacklistStatus !== 'blacklisted');
            case 'blacklist':
                return state.links.filter(l => l.blacklistStatus === 'blacklisted');
            case 'note':
                return state.links.filter(l => l.note && l.note.trim() !== '');
            default:
                return state.links;
        }
    }
    return [];
}



function renderFilteredLinks(container, filter) {
    container.innerHTML = '';
    state.currentFilter = filter;
    let filteredLinks = [];

    switch (filter) {
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
        case 'profile':
            filteredLinks = state.links.filter(l => l.post_type === 'profile' && l.blacklistStatus !== 'blacklisted');
            break;
        case 'duplicate':
            // Nhóm các link theo URL đầy đủ
            const urlGroups = {};
            state.links.forEach(l => {
                if (!urlGroups[l.url]) urlGroups[l.url] = [];
                urlGroups[l.url].push(l);
            });
            // Lọc các nhóm có nhiều hơn 1 link và không bị blacklist
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
        default:
            filteredLinks = state.links;
    }

    const searchQuery = state.dateFilter.searchQuery.toLowerCase();
    if (searchQuery) {
        filteredLinks = filteredLinks.filter(l =>
            (l.title && l.title.toLowerCase().includes(searchQuery)) ||
            (l.description && l.description.toLowerCase().includes(searchQuery))
        );
    }

    if (filteredLinks.length === 0) {
        container.innerHTML = '<p>Không có link nào phù hợp.</p>';
    } else if (filter === 'duplicate') {
        // Nhóm lại để hiển thị cạnh nhau
        const urlGroups = {};
        filteredLinks.forEach(l => {
            if (!urlGroups[l.url]) urlGroups[l.url] = [];
            urlGroups[l.url].push(l);
        });

        Object.entries(urlGroups).forEach(([url, links]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'grouped-duplicates';
            groupDiv.innerHTML = `<h4>URL: ${url} (${links.length} link)</h4>`;
            const linksContainer = document.createElement('div');
            linksContainer.className = 'duplicates-container';
            links.forEach((link, index) => {
                const linkItem = createLinkItem(link, index);
                linksContainer.appendChild(linkItem);
            });
            groupDiv.appendChild(linksContainer);
            container.appendChild(groupDiv);
        });
    } else {
        filteredLinks.forEach((link, index) => {
            const linkItem = createLinkItem(link, index);
            container.appendChild(linkItem);
        });
    }
    updateCounters();
}

function renderLinks(tab) {
    const container = elements.linkLists[tab];
    if (!container) return;

    let linksToRender = [];
    if (tab === 'all-link') {
        switch (state.currentFilter || 'all') {
            case 'group':
                linksToRender = state.links.filter(l => l.post_type === 'group' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'photo':
                linksToRender = state.links.filter(l => l.post_type === 'photo' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'story':
                linksToRender = state.links.filter(l => l.post_type === 'story' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'video':
                linksToRender = state.links.filter(l => l.post_type === 'video' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'reel':
                linksToRender = state.links.filter(l => l.post_type === 'reel' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'post':
                linksToRender = state.links.filter(l => l.post_type === 'post' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'profile':
                linksToRender = state.links.filter(l => l.post_type === 'profile' && l.blacklistStatus !== 'blacklisted');
                break;
            case 'duplicate':
                const urlGroups = {};
                state.links.forEach(l => {
                    if (!urlGroups[l.url]) urlGroups[l.url] = [];
                    urlGroups[l.url].push(l);
                });
                linksToRender = Object.values(urlGroups)
                    .filter(group => group.length > 1 && group.every(l => l.blacklistStatus !== 'blacklisted'))
                    .flat();
                break;
            case 'blacklist':
                linksToRender = state.links.filter(l => l.blacklistStatus === 'blacklisted');
                break;
            case 'note':
                linksToRender = state.links.filter(l => l.note && l.note.trim() !== '');
                break;
            default:
                linksToRender = state.links;
        }
    } else if (tab === 'blacklist') {
        linksToRender = state.links.filter(l => l.blacklistStatus === 'blacklisted');
    } else if (tab === 'error') {
        linksToRender = state.links.filter(l => ['error', 'login', 'link_hỏng'].includes(l.status) && l.blacklistStatus !== 'blacklisted');
    } else if (tab === 'duplicate') {
        const urlGroups = {};
        state.links.forEach(l => {
            if (!urlGroups[l.url]) urlGroups[l.url] = [];
            urlGroups[l.url].push(l);
        });
        linksToRender = Object.values(urlGroups)
            .filter(group => group.length > 1 && group.every(l => l.blacklistStatus !== 'blacklisted'))
            .flat();
    }

    container.innerHTML = '';
    if (linksToRender.length === 0) {
        container.innerHTML = `<p>Không có link nào trong ${tab}</p>`;
        if (tab === 'error') {
            container.innerHTML += '<button class="retry-error-btn" style="margin: 10px;">Thử lại tất cả</button>';
            container.querySelector('.retry-error-btn')?.addEventListener('click', () => {
                linksToRender.forEach(link => retryLink(link.id));
                showToast(`Đang thử lại ${linksToRender.length} link lỗi`, 'info');
                addLog(`Đã thử lại ${linksToRender.length} link lỗi`, 'info');
            });
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    if (tab === 'duplicate' || (tab === 'all-link' && state.currentFilter === 'duplicate')) {
        const urlGroups = {};
        linksToRender.forEach(l => {
            if (!urlGroups[l.url]) urlGroups[l.url] = [];
            urlGroups[l.url].push(l);
        });

        Object.entries(urlGroups).forEach(([url, links]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'grouped-duplicates';
            groupDiv.innerHTML = `<h4>URL: ${url} (${links.length} link)</h4>`;
            const linksContainer = document.createElement('div');
            linksContainer.className = 'duplicates-container';
            links.forEach((link, index) => {
                const linkItem = createLinkItem(link, index);
                linksContainer.appendChild(linkItem);
            });
            groupDiv.appendChild(linksContainer);
            fragment.appendChild(groupDiv);
        });
    } else {
        linksToRender.forEach((link, index) => {
            const item = createLinkItem(link, index);
            fragment.appendChild(item);
        });
    }
    container.appendChild(fragment);
    updateCounters();
}



function createLinkItem(link, index) {
    const item = document.createElement('div');
    item.className = `link-item ${link.status} ${link.checked ? 'checked' : ''}`;
    item.dataset.id = link.id;

    const postTypeLabel = link.post_type ? `[${link.post_type.toUpperCase()}] ` : '';
    const displayTitle = link.status === 'login' ? 'Yêu cầu đăng nhập' : (link.title || link.url);
    const displayDescription = link.status === 'login' ? 'Bài viết hạn chế yêu cầu đăng nhập để xem nội dung' : (link.description || '');
    const indexStr = (index + 1).toString();
    const indexDigits = indexStr.split('').map(digit => `<span>${digit}</span>`).join('');

    item.innerHTML = `
            <input type="checkbox" class="link-checkbox" ${link.checked ? 'checked' : ''}>
            <div class="link-row">
                <button class="link-index" title="Xóa link này">
                    ${indexDigits}
                </button>
                <div class="link-thumbnail">
                    ${link.image ? `<img src="${link.image}" alt="Thumbnail" loading="lazy">` : `<i class="fas fa-link fa-icon"></i>`}
                </div>
                <div class="link-content">
                    <div class="link-title post-type-${link.post_type}">${postTypeLabel}${displayTitle}</div>
                    <div class="link-description">${displayDescription}</div>
                    <div class="link-meta">
                        <span class="link-time">${link.note ? `<span class="note-text">${link.note}</span>` : formatDateTime(link.date)}</span>
                        <span class="link-status status-${link.blacklistStatus === 'blacklisted' ? 'blacklist' : link.status}">
                            ${link.blacklistStatus === 'blacklisted' ? '<span class="blacklist-text">Blacklist</span>' :
            link.status === 'success' ? 'Thành công' :
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

    item.querySelector('.link-checkbox').addEventListener('change', () => toggleCheckbox(link));
    item.querySelector('.link-thumbnail').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCheckbox(link);
    });
    item.querySelector('.link-content').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!link.checked) {
            // Nếu checkbox chưa được chọn: Bật checkbox và mở URL
            toggleCheckbox(link);
            window.open(link.url, '_blank');
        } else {
            // Nếu checkbox đã được chọn: Tắt checkbox
            toggleCheckbox(link);
        }
    });
    item.querySelector('.link-index').addEventListener('click', () => {
        if (confirm(`Xóa link: ${link.url}?`)) {
            saveBackup('deleteLinks', { links: [{ ...link }] });
            state.links = state.links.filter(l => l.id !== link.id);
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã xóa link ${link.url}`, 'success');
            addLog(`Đã xóa link ${link.url} (ID: ${link.id})`, 'info');
        }
    });
    item.querySelector('.view-post').addEventListener('click', () => showLinkDetailsPopup(link));
    item.querySelector('.note').addEventListener('click', () => showNoteDialog(link));
    item.querySelector('.block')?.addEventListener('click', () => {
        saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
        link.blacklistStatus = 'blacklisted';
        saveData({ links: true });
        renderTabContent(state.currentTab);
        updateCounters();
        showToast(`Đã chặn link: ${link.url}`, 'success');
        addLog(`Đã chặn link ${link.url} (ID: ${link.id})`, 'info');
    });
    item.querySelector('.unblock')?.addEventListener('click', () => {
        saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
        link.blacklistStatus = 'active';
        saveData({ links: true });
        renderTabContent(state.currentTab);
        updateCounters();
        showToast(`Đã khôi phục: ${link.url}`, 'success');
        addLog(`Đã khôi phục link ${link.url} (ID: ${link.id})`, 'info');
    });

    return item;
}

function renderDateFilterTab() {
    const container = elements.linkLists['date-filter'];
    if (!container) return;

    container.innerHTML = `
            <div class="date-filter-header">
                <div class="filter-controls">
                    <label>Từ ngày:</label>
                    <input type="date" id="start-date-input" value="${state.dateFilter.startDate}">
                    <label>Đến ngày:</label>
                    <input type="date" id="end-date-input" value="${state.dateFilter.endDate}">
                    <label>Trạng thái:</label>
                    <select id="status-filter">
                        <option value="all" ${state.dateFilter.status === 'all' ? 'selected' : ''}>Tất cả</option>
                        <option value="pending" ${state.dateFilter.status === 'pending' ? 'selected' : ''}>Đang chờ</option>
                        <option value="login" ${state.dateFilter.status === 'login' ? 'selected' : ''}>Yêu cầu đăng nhập</option>
                        <option value="link_hỏng" ${state.dateFilter.status === 'link_hỏng' ? 'selected' : ''}>Link hỏng</option>
                        <option value="error" ${state.dateFilter.status === 'error' ? 'selected' : ''}>Lỗi</option>
                    </select>
                    <label>Nhóm tiêu đề:</label>
                    <input type="checkbox" id="group-titles" ${state.dateFilter.groupTitles ? 'checked' : ''}>
                    <label>Tìm kiếm:</label>
                    <input type="text" id="search-filter" placeholder="Tìm tiêu đề/nội dung..." value="${state.dateFilter.searchQuery}">
                    <button class="btn filter-btn" id="apply-date-filter"><i class="fas fa-filter"></i> Lọc</button>
                    <button class="btn reset-filter-btn" id="reset-date-filter"><i class="fas fa-times"></i> Xóa bộ lọc</button>
                </div>
                <div class="filter-result" id="filter-result">Đã lọc: 0 link</div>
            </div>
            <div class="filtered-links"></div>
        `;

    const startDateInput = container.querySelector('#start-date-input');
    const endDateInput = container.querySelector('#end-date-input');
    const statusFilter = container.querySelector('#status-filter');
    const groupTitlesCheckbox = container.querySelector('#group-titles');
    const searchInput = container.querySelector('#search-filter');
    const applyButton = container.querySelector('#apply-date-filter');
    const resetButton = container.querySelector('#reset-date-filter');
    const filteredContainer = container.querySelector('.filtered-links');
    const resultLabel = container.querySelector('#filter-result');

    function applyFilter() {
        saveBackup('dateFilter', { dateFilter: { ...state.dateFilter } });
        state.dateFilter.startDate = startDateInput.value;
        state.dateFilter.endDate = endDateInput.value;
        state.dateFilter.status = statusFilter.value;
        state.dateFilter.groupTitles = groupTitlesCheckbox.checked;
        state.dateFilter.searchQuery = searchInput.value.trim();

        if (state.dateFilter.startDate && state.dateFilter.endDate) {
            const start = new Date(state.dateFilter.startDate);
            const end = new Date(state.dateFilter.endDate);
            if (start > end) {
                showToast('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc', 'warning');
                return;
            }
        }

        let filteredLinks = getLinksForCurrentTab();
        if (state.dateFilter.groupTitles) {
            const grouped = {};
            filteredLinks.forEach(link => {
                const key = link.title || link.url;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(link);
            });
            filteredLinks = Object.values(grouped).map(group => group[0]);
        }

        filteredContainer.innerHTML = '';
        if (filteredLinks.length === 0) {
            filteredContainer.innerHTML = '<p>Không có link nào trong khoảng ngày này</p>';
        } else {
            const fragment = document.createDocumentFragment();
            filteredLinks.forEach((link, index) => {
                const item = createLinkItem(link, index);
                fragment.appendChild(item);
            });
            filteredContainer.appendChild(fragment);
        }
        resultLabel.textContent = `Đã lọc: ${filteredLinks.length} link`;
        updateCounters();
        saveData({ dateFilter: true });
        showToast(`Đã lọc ${filteredLinks.length} link`, 'info');
    }

    applyButton.addEventListener('click', applyFilter);
    resetButton.addEventListener('click', () => {
        saveBackup('dateFilter', { dateFilter: { ...state.dateFilter } });
        state.dateFilter.startDate = '';
        state.dateFilter.endDate = '';
        state.dateFilter.status = 'all';
        state.dateFilter.groupTitles = false;
        state.dateFilter.searchQuery = '';
        startDateInput.value = '';
        endDateInput.value = '';
        statusFilter.value = 'all';
        groupTitlesCheckbox.checked = false;
        searchInput.value = '';
        filteredContainer.innerHTML = '';
        resultLabel.textContent = 'Đã lọc: 0 link';
        updateCounters();
        saveData({ dateFilter: true });
        showToast('Đã xóa bộ lọc', 'info');
        addLog('Đã xóa bộ lọc', 'info');
    });

    if (state.dateFilter.startDate && state.dateFilter.endDate) applyFilter();
}

function renderLogs() {
    const container = elements.linkLists['log'];
    if (!container) return;

    container.innerHTML = '';
    if (state.logs.length === 0) {
        container.innerHTML = `
                <div class="empty-message" style="text-align: center; padding: 20px;">
                    <i class="fas fa-clipboard-list" style="font-size: 24px; color: #666;"></i>
                    <p>Không có log nào</p>
                </div>`;
    } else {
        container.innerHTML = '<button class="clear-log-btn btn btn-danger" style="margin: 10px;"><i class="fas fa-trash"></i> Xóa Log</button>';
        const fragment = document.createDocumentFragment();
        state.logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            logItem.innerHTML = `
                    <div class="log-message">${log.message}</div>
                    <div class="log-meta">
                        <span class="log-type ${log.type}">${log.type}</span>
                        <span>${formatDate(log.timestamp)}</span>
                    </div>
                `;
            fragment.appendChild(logItem);
        });
        container.appendChild(fragment);

        container.querySelector('.clear-log-btn').addEventListener('click', () => {
            if (confirm('Xóa toàn bộ log?')) {
                saveBackup('clearLogs', { logs: [...state.logs] });
                state.logs = [];
                saveData({ logs: true });
                renderLogs();
                showToast('Đã xóa log', 'success');
                addLog('Đã xóa toàn bộ log', 'info');
            }
        });
    }
}

// Link Actions
function toggleCheckbox(link) {
    saveBackup('checkbox', { linkId: link.id, checked: link.checked });
    link.checked = !link.checked;
    saveData({ links: true });
    renderTabContent(state.currentTab);
    updateCounters();
}

function toggleSelectAll() {
    if (state.currentTab === 'fanpage') {
        const fanpagesToToggle = getFilteredFanpages(currentFilter);
        const allChecked = fanpagesToToggle.every(f => f.checked);

        saveBackup('selectAllFanpages', { fanpages: fanpagesToToggle });
        fanpagesToToggle.forEach(f => f.checked = !allChecked);

        saveData({ fanpages: true });
        renderFanpageTab();
        updateCounters();

        showToast(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} tất cả ${fanpagesToToggle.length} fanpage`, 'info');
        addLog(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} tất cả ${fanpagesToToggle.length} fanpage`, 'info');
    } else {
        // Phần xử lý cho các tab khác giữ nguyên
        const linksToToggle = getLinksForCurrentTab();
        const allChecked = linksToToggle.every(l => l.checked);

        saveBackup('selectAll', { links: linksToToggle });
        linksToToggle.forEach(l => l.checked = !allChecked);
        saveData({ links: true });
        renderTabContent(state.currentTab);
        updateCounters();
        addLog(`Đã ${allChecked ? 'bỏ chọn' : 'chọn'} tất cả ${linksToToggle.length} link trong tab ${state.currentTab}`, 'info');

        if (!allChecked && linksToToggle.length > 0) {
            // Hiển thị dialog cho các hành động
            showSelectionActionsDialog(linksToToggle.length);
        }
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
            exportToGist();
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

function showNoteDialog(link) {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>Thêm ghi chú</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <input type="text" id="note-input" placeholder="Nhập ghi chú..." value="${link.note || ''}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                </div>
                <div class="modal-footer">
                    <button id="note-confirm" class="btn btn-primary">Lưu</button>
                    <button id="note-cancel" class="btn btn-secondary">Hủy</button>
                </div>
            </div>
        `;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('#note-input');
    const confirmBtn = dialog.querySelector('#note-confirm');
    const cancelBtn = dialog.querySelector('#note-cancel');
    const closeBtn = dialog.querySelector('.modal-close');

    confirmBtn.addEventListener('click', () => {
        saveBackup('note', { linkId: link.id, note: link.note });
        link.note = input.value.trim();
        saveData({ links: true });
        renderTabContent(state.currentTab);
        showToast('Đã lưu ghi chú', 'success');
        addLog(`Đã thêm ghi chú cho link: ${link.url} (ID: ${link.id})`, 'info');
        document.body.removeChild(dialog);
    });

    cancelBtn.addEventListener('click', () => document.body.removeChild(dialog));
    closeBtn.addEventListener('click', () => document.body.removeChild(dialog));
}

function showAddLinkDialog() {
    // Gắn CSS nếu chưa có
    if (!document.getElementById('add-link-dialog-style')) {
        const style = document.createElement('style');
        style.id = 'add-link-dialog-style';
        style.innerHTML = `
            .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start; /* Đưa popup sát trên */
            z-index: 9999;
            padding-top: 10px; /* Khoảng cách nhỏ phía trên */
        }

        .modal-dialog {
            background: #fff;
            border-radius: 8px;
            width: 500px;
            max-width: 90%;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            animation: fadeIn 0.3s ease;
            margin-top: 10px; /* đẩy xuống 1 chút nếu cần */
        }


            .modal-header {
                padding: 12px 16px;
                background: #f5f5f5;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #ddd;
            }

            .modal-header h3 {
                margin: 0;
                font-size: 18px;
            }

            .modal-close {
                background: transparent;
                border: none;
                font-size: 20px;
                cursor: pointer;
            }

            .modal-body {
                padding: 16px;
            }

            .modal-textarea {
                width: 100%;
                height: 150px;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #ccc;
                font-size: 14px;
                box-sizing: border-box;
                resize: vertical;
            }

            .modal-actions {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-top: 15px;
            }

            .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
            }

            .btn-primary {
                background-color: #007bff;
                color: white;
            }

            .btn-secondary {
                background-color: #e0e0e0;
                color: black;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Tạo hộp thoại
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <h3>Thêm danh sách link</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <textarea id="new-links-input" class="modal-textarea" placeholder="Nhập danh sách URL (mỗi URL trên một dòng)..."></textarea>
                <div class="modal-actions">
                    <button id="import-json-lines" class="btn btn-secondary"><i class="fas fa-file-import"></i> Item</button>
                    <button id="import-json-array" class="btn btn-secondary"><i class="fas fa-file-import"></i> All</button>
                    <button id="add-links-confirm" class="btn btn-primary">Thêm</button>
                    <button id="add-links-cancel" class="btn btn-secondary">Hủy</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const textarea = dialog.querySelector('#new-links-input');
    const confirmBtn = dialog.querySelector('#add-links-confirm');
    const cancelBtn = dialog.querySelector('#add-links-cancel');
    const closeBtn = dialog.querySelector('.modal-close');
    const importJsonLinesBtn = dialog.querySelector('#import-json-lines');
    const importJsonArrayBtn = dialog.querySelector('#import-json-array');

    confirmBtn.addEventListener('click', () => {
        const urls = textarea.value.trim().split('\n').map(url => url.trim()).filter(url => url);
        if (urls.length === 0) {
            showToast('Vui lòng nhập ít nhất một URL', 'warning');
            return;
        }

        let addedCount = 0;
        const newLinks = [];
        urls.forEach(url => {
            if (!isValidUrl(url)) {
                showToast(`URL không hợp lệ: ${url}`, 'warning');
                return;
            }
            if (isLinkExists(url)) {
                showToast(`Link đã tồn tại: ${url}`, 'warning');
                return;
            }

            const newLink = {
                id: generateId(),
                url,
                title: 'Đang trích xuất...',
                description: '',
                image: '',
                status: 'pending',
                post_type: determinePostType(url),
                date: new Date().toISOString(),
                checked: false,
                blacklistStatus: 'active',
                note: ''
            };
            state.links.unshift(newLink);
            newLinks.push(newLink);
            addedCount++;
            setTimeout(() => extractContent(url), 0);
            addLog(`Đã thêm link: ${url} (ID: ${newLink.id})`, 'info');
        });

        if (addedCount > 0) {
            saveBackup('addLinks', { links: newLinks });
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã thêm ${addedCount} link mới`, 'success');
        }
        document.body.removeChild(dialog);
    });

    importJsonLinesBtn.addEventListener('click', () => {
        importLinksFromJsonLines();
        document.body.removeChild(dialog);
    });

    importJsonArrayBtn.addEventListener('click', () => {
        importFromJSON();
        document.body.removeChild(dialog);
    });

    cancelBtn.addEventListener('click', () => document.body.removeChild(dialog));
    closeBtn.addEventListener('click', () => document.body.removeChild(dialog));
}


function deleteSelected() {
    const selectedLinks = getLinksForCurrentTab().filter(link => link.checked);
    if (selectedLinks.length > 0) {
        if (confirm(`Bạn có chắc muốn xóa ${selectedLinks.length} link đã chọn?`)) {
            saveBackup('deleteLinks', { links: selectedLinks });
            state.links = state.links.filter(link => !selectedLinks.includes(link));
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã xóa ${selectedLinks.length} link`, 'success');
            addLog(`Đã xóa ${selectedLinks.length} link`, 'info');
        }
        return;
    }

    // Xóa trùng lặp khi không có link được chọn
    const urlGroups = {};
    state.links.forEach(l => {
        if (!urlGroups[l.url]) urlGroups[l.url] = [];
        urlGroups[l.url].push(l);
    });

    const duplicateLinks = Object.values(urlGroups)
        .filter(group => group.length > 1)
        .flatMap(group => group.slice(1)); // Giữ link đầu tiên, xóa các link trùng sau

    if (duplicateLinks.length === 0) {
        showToast('Không tìm thấy link trùng lặp để xóa', 'warning');
        return;
    }

    if (confirm(`Tìm thấy ${duplicateLinks.length} link trùng lặp. Bạn có muốn xóa chúng không?`)) {
        saveBackup('deleteLinks', { links: duplicateLinks });
        state.links = state.links.filter(link => !duplicateLinks.includes(link));
        saveData({ links: true });
        renderTabContent(state.currentTab);
        updateCounters();
        showToast(`Đã xóa ${duplicateLinks.length} link trùng lặp`, 'success');
        addLog(`Đã xóa ${duplicateLinks.length} link trùng lặp`, 'info');
    }
}

function smartScroll() {
    if (!elements.mainContent) return;
    const maxScroll = elements.mainContent.scrollHeight - elements.mainContent.clientHeight;
    const targetPosition = state.scrollState === 0 ? maxScroll : 0;
    smoothScroll(elements.mainContent, targetPosition);
    state.scrollState = state.scrollState === 0 ? 1 : 0;
}

function retryLink(id) {
    const link = state.links.find(l => l.id === id);
    if (!link) return;

    saveBackup('retryLink', { linkId: id, link: { ...link } });
    link.status = 'pending';
    link.title = 'Đang trích xuất lại...';
    saveData({ links: true });
    renderTabContent(state.currentTab);
    setTimeout(() => extractContent(link.url), 0);
    addLog(`Đang thử lại link: ${link.url} (ID: ${link.id})`, 'info');
}

async function extractContent(url) {
    const link = state.links.find(l => l.url === url);
    if (!link) return;

    const tryExtract = async (useProxy = false) => {
        try {
            const startTime = Date.now();
            const fetchUrl = useProxy ? `${config.corsProxy}${encodeURIComponent(url)}` : url;
            const headers = useProxy ? {} : {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };

            const response = await fetch(fetchUrl, {
                headers,
                signal: AbortSignal.timeout(config.requestTimeout)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            let htmlContent;
            if (useProxy) {
                const proxyData = await response.json();
                htmlContent = proxyData.contents;
            } else {
                htmlContent = await response.text();
            }

            if (!htmlContent) throw new Error('Không có nội dung trả về');

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

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
        } catch (error) {
            throw error;
        }
    };

    try {
        const result = await tryExtract(false);

        link.title = result.title;
        link.description = result.description;
        link.image = result.image;
        link.post_type = link.post_type && link.post_type !== 'unknown' ? link.post_type : determinePostType(url);

        if (link.description || link.image !== config.defaultImage) {
            link.status = 'success';
        } else {
            if (result.htmlContent.toLowerCase().includes('login')) {
                link.status = 'login';
                link.title = 'Yêu cầu đăng nhập';
                link.description = 'Bài viết hạn chế yêu cầu đăng nhập để xem nội dung';
            } else if (result.htmlContent.toLowerCase().includes('content not found') ||
                result.htmlContent.toLowerCase().includes('unavailable') ||
                result.htmlContent.toLowerCase().includes('removed')) {
                link.status = 'link_hỏng';
                link.title = 'Bài viết lỗi';
                link.description = 'Không có nội dung';
            } else {
                link.status = 'error';
                link.title = 'Bài viết lỗi';
                link.description = 'Không có nội dung';
            }
        }

        link.processingTime = result.processingTime;
        addLog(`Đã trích xuất thành công: ${url} (ID: ${link.id})`, 'success');
    } catch (error) {
        addLog(`Lỗi khi trích xuất trực tiếp ${url} (ID: ${link.id}): ${error.message}, thử lại với proxy...`, 'warning');
        try {
            const result = await tryExtract(true);

            link.title = result.title;
            link.description = result.description;
            link.image = result.image;
            link.post_type = link.post_type && link.post_type !== 'unknown' ? link.post_type : determinePostType(url);

            if (link.description || link.image !== config.defaultImage) {
                link.status = 'success';
            } else {
                if (result.htmlContent.toLowerCase().includes('login')) {
                    link.status = 'login';
                    link.title = 'Yêu cầu đăng nhập';
                    link.description = 'Bài viết hạn chế yêu cầu đăng nhập để xem nội dung';
                } else if (result.htmlContent.toLowerCase().includes('content not found') ||
                    result.htmlContent.toLowerCase().includes('unavailable') ||
                    result.htmlContent.toLowerCase().includes('removed')) {
                    link.status = 'link_hỏng';
                    link.title = 'Bài viết lỗi';
                    link.description = 'Không có nội dung';
                } else {
                    link.status = 'error';
                    link.title = 'Bài viết lỗi';
                    link.description = 'Không có nội dung';
                }
            }

            link.processingTime = result.processingTime;
            addLog(`Đã trích xuất thành công qua proxy: ${url} (ID: ${link.id})`, 'success');
        } catch (proxyError) {
            link.title = 'Bài viết lỗi';
            link.description = 'Không có nội dung';
            link.image = config.defaultImage;
            link.status = 'error';
            link.post_type = link.post_type && link.post_type !== 'unknown' ? link.post_type : determinePostType(url);
            addLog(`Lỗi khi xử lý ${url} (ID: ${link.id}) qua proxy: ${proxyError.message}`, 'error');
        }
    } finally {
        saveData({ links: true });
        renderTabContent(state.currentTab);
    }
}
function deleteSelectedFanpages() {
    const selectedFanpages = state.fanpages.filter(f => f.checked);
    if (selectedFanpages.length === 0) {
        showToast('Không có fanpage nào được chọn', 'warning');
        return;
    }

    if (confirm(`Bạn có chắc muốn xóa ${selectedFanpages.length} fanpage đã chọn?`)) {
        saveBackup('deleteFanpages', { fanpages: [...selectedFanpages] });
        state.fanpages = state.fanpages.filter(f => !f.checked);

        // Reset tất cả checkbox
        state.fanpages.forEach(f => f.checked = false);

        saveData({ fanpages: true });
        renderFanpageTab();
        showToast(`Đã xóa ${selectedFanpages.length} fanpage`, 'success');
        addLog(`Đã xóa ${selectedFanpages.length} fanpage`, 'info');
    }
}

function showFilterPopup(callback) {
    console.log('Showing filter popup');
    const popup = document.createElement('div');
    popup.className = 'modal-overlay filter-popup';
    popup.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-header">
                <h3>Chọn Bộ Lọc</h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="filter-buttons">
                    <button class="filter-btn" data-filter="all">Tất cả</button>
                    <button class="filter-btn" data-filter="group">Group</button>
                    <button class="filter-btn" data-filter="photo">Photo</button>
                    <button class="filter-btn" data-filter="story">Story</button>
                    <button class="filter-btn" data-filter="video">Video</button>
                    <button class="filter-btn" data-filter="reel">Reel</button>
                    <button class="filter-btn" data-filter="post">Post</button>
                    <button class="filter-btn" data-filter="profile">Profile</button>
                    <button class="filter-btn" data-filter="duplicate">Trùng lặp</button>
                    <button class="filter-btn" data-filter="blacklist">Blacklist</button>
                    <button class="filter-btn" data-filter="note">Ghi chú</button>
                </div>
            </div>
        </div>
        <style>
            .modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .modal-dialog {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 400px;
                max-height: 80vh;
                overflow-y: auto;
            }
            .modal-header {
                padding: 12px 16px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
            }
            .modal-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
            }
            .modal-body {
                padding: 16px;
            }
            .filter-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .filter-btn {
                flex: 1 0 30%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #f5f5f5;
                cursor: pointer;
                text-align: center;
            }
            .filter-btn:hover {
                background: #e0e0e0;
            }
        </style>
    `;

    try {
        document.body.appendChild(popup);
        console.log('Popup appended to body');
    } catch (error) {
        console.error('Error appending popup:', error);
        addLog('Lỗi khi hiển thị popup lọc', 'error');
    }

    const closePopup = () => {
        try {
            document.body.removeChild(popup);
            console.log('Popup removed');
        } catch (error) {
            console.error('Error removing popup:', error);
        }
    };

    popup.querySelector('.modal-close').addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    popup.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            console.log('Filter selected:', filter);
            callback(filter);
            closePopup();
        });
    });
}

function setupEventListeners() {
    console.log('Setting up event listeners');
    Object.entries(elements.headerBtns).forEach(([key, btn]) => {
        if (!btn) {
            console.warn(`Button ${key} not found`);
            addLog(`Không tìm thấy nút ${key}`, 'warning');
            return;
        }
        switch (key) {
            case 'add':
                btn.addEventListener('click', () => {
                    if (state.currentTab === 'fanpage') {
                        showAddFanpageDialog();
                    } else {
                        showAddLinkDialog();
                    }
                });
                break;
            case 'delete':
                btn.addEventListener('click', deleteSelected);
                break;
            case 'undo':
                btn.addEventListener('click', undoAction);
                break;
            case 'scroll':
                btn.addEventListener('click', smartScroll);
                break;
            case 'log':
                btn.addEventListener('click', () => switchTab('log'));
                break;
            case 'fanpage':
                btn.addEventListener('click', () => switchTab('fanpage'));
                break;
        }
    });

    if (elements.headerBtns.delete) {
        elements.headerBtns.delete.addEventListener('click', () => {
            if (state.currentTab === 'fanpage') {
                deleteSelectedFanpages();
            } else {
                deleteSelected();
            }
        });
    }

    if (elements.statusCounters.all?.parentElement) {
        elements.statusCounters.all.parentElement.addEventListener('click', () => switchTab('all-link'));
    }

    if (elements.statusCounters.filter?.parentElement) {
        elements.statusCounters.filter.parentElement.addEventListener('click', () => {
            console.log('Filter button clicked');
            showFilterPopup((filter) => {
                state.currentFilter = filter;
                switchTab('all-link');
                saveData({ currentFilter: true });
            });
        });
    }

    if (elements.selectAllCounter.btn) {
        elements.selectAllCounter.btn.addEventListener('click', toggleSelectAll);
    }

    if (elements.mainContent) {
        elements.mainContent.addEventListener('scroll', debounce(() => {
            state.scrollPosition = elements.mainContent.scrollTop;
            saveData({ scrollPosition: true });
        }, config.debounceDelay));
    } else {
        addLog('Không tìm thấy scroll-container', 'warning');
    }

    window.addEventListener('error', (event) => {
        addLog(`Lỗi hệ thống: ${event.message}`, 'error');
        showToast('Đã xảy ra lỗi hệ thống', 'danger');
    });
}

function renderTabContent(tab) {
    const container = elements.linkLists[tab];
    if (!container) {
        console.error(`Không tìm thấy tab: ${tab}`);
        return;
    }

    container.innerHTML = '';

    if (tab === 'all-link') {
        let filteredLinks = [];
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
            case 'profile':
                filteredLinks = state.links.filter(l => l.post_type === 'profile' && l.blacklistStatus !== 'blacklisted');
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
            default:
                filteredLinks = state.links;
        }

        if (filteredLinks.length === 0) {
            container.innerHTML = '<p>Không có link nào phù hợp.</p>';
        } else if (state.currentFilter === 'duplicate') {
            const urlGroups = {};
            filteredLinks.forEach(l => {
                if (!urlGroups[l.url]) urlGroups[l.url] = [];
                urlGroups[l.url].push(l);
            });

            Object.entries(urlGroups).forEach(([url, links]) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'grouped-duplicates';
                groupDiv.innerHTML = `<h4>URL: ${url} (${links.length} link)</h4>`;
                const linksContainer = document.createElement('div');
                linksContainer.className = 'duplicates-container';
                links.forEach((link, index) => {
                    const linkItem = createLinkItem(link, index);
                    linksContainer.appendChild(linkItem);
                });
                groupDiv.appendChild(linksContainer);
                container.appendChild(groupDiv);
            });
        } else {
            filteredLinks.forEach((link, index) => {
                const linkItem = createLinkItem(link, index);
                container.appendChild(linkItem);
            });
        }
        updateCounters();
    } else if (tab === 'filter') {
        const filterButtons = document.createElement('div');
        filterButtons.className = 'filter-buttons';
        filterButtons.innerHTML = `
                <style>
                    .counter-badge {
                        padding: 6px 12px;
                        margin: 4px;
                        border: 1px solid #ccc;
                        border-radius: 6px;
                        background-color: #f5f5f5;
                        color: #333;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        min-width: 80px;
                        text-align: center;
                    }
                    .counter-badge:hover {
                        background-color: #e0e0e0;
                        border-color: #888;
                    }
                    .search-filter {
                        display: flex;
                        margin-top: 10px;
                        gap: 8px;
                    }
                    .search-filter input {
                        flex: 1;
                        padding: 6px 10px;
                        border-radius: 4px;
                        border: 1px solid #ccc;
                    }
                    .search-filter button {
                        padding: 6px 12px;
                        border: none;
                        border-radius: 4px;
                        background-color: #007bff;
                        color: white;
                        cursor: pointer;
                    }
                    .search-filter button:hover {
                        background-color: #0056b3;
                    }
                </style>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="counter-badge group" data-filter="group">Group</button>
                    <button class="counter-badge photo" data-filter="photo">Photo</button>
                    <button class="counter-badge story" data-filter="story">Story</button>
                    <button class="counter-badge video" data-filter="video">Video</button>
                    <button class="counter-badge reel" data-filter="reel">Reel</button>
                    <button class="counter-badge post" data-filter="post">Post</button>
                    <button class="counter-badge profile" data-filter="profile">Profile</button>
                    <button class="counter-badge duplicate" data-filter="duplicate">Trùng lặp</button>
                    <button class="counter-badge blacklist" data-filter="blacklist">Blacklist</button>
                    <button class="counter-badge note" data-filter="note">Ghi chú</button>
                </div>
                <div class="search-filter">
                    <input type="text" id="search-filter" placeholder="Tìm tiêu đề/nội dung...">
                    <button id="apply-search" class="btn">Tìm</button>
                </div>
            `;
        container.appendChild(filterButtons);

        const filteredList = document.createElement('div');
        filteredList.className = 'filtered-list';
        container.appendChild(filteredList);

        filterButtons.querySelectorAll('.counter-badge').forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.querySelectorAll('.counter-badge').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                state.currentFilter = button.dataset.filter;
                renderFilteredLinks(filteredList, state.currentFilter);
            });
        });

        const searchInput = filterButtons.querySelector('#search-filter');
        const applySearch = filterButtons.querySelector('#apply-search');
        applySearch.addEventListener('click', () => {
            state.dateFilter.searchQuery = searchInput.value.trim();
            saveData({ dateFilter: true });
            renderFilteredLinks(filteredList, state.currentFilter);
        });

        filterButtons.querySelector(`[data-filter="${state.currentFilter}"]`)?.classList.add('active');
        renderFilteredLinks(filteredList, state.currentFilter);
    } else if (tab === 'date-filter') {
        renderDateFilterTab();
    } else if (tab === 'log') {
        renderLogs();
    } else if (tab === 'fanpage') {
        renderFanpageTab();
    } else {
        renderLinks(tab);
    }
}


// Khởi tạo
function init() {
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            await loadData();
            setupEventListeners();
            renderTabContent('all-link');
        } catch (error) {
            console.error('Lỗi khởi tạo:', error);
            showToast('Lỗi khởi tạo ứng dụng', 'danger');
            addLog(`Lỗi khởi tạo: ${error.message}`, 'error');
        }
    });
}






// Hàm kiểm tra trực tiếp
function checkFanpageImmediately(fanpage, iframeContainer) {
    iframeContainer.innerHTML = `
        <div class="fb-post" 
             data-href="${fanpage.url}" 
             data-width="100%"
             data-show-text="true"
             data-lazy="false"></div>
    `;

    // Xử lý khi SDK đã sẵn sàng
    if (window.FB) {
        window.FB.XFBML.parse(iframeContainer, () => {
            setTimeout(() => {
                verifyFanpageStatus(fanpage, iframeContainer);
            }, 2000); // Chờ 2 giây để iframe tải
        });
    } else {
        // Fallback nếu SDK chưa sẵn sàng
        setTimeout(() => {
            verifyFanpageStatus(fanpage, iframeContainer);
        }, 3000);
    }
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



// Hàm hỗ trợ
function getActualStatus(fanpage) {
    if (fanpage.errorCount >= 3) return 'not-exists';
    if (fanpage.lastError === 'content_restricted') return 'restricted';
    return fanpage.status;
}



function resetFanpageStatus(fanpageId) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;

    // Reset trạng thái
    fanpage.status = 'pending';
    fanpage.errorCount = 0;
    delete fanpage.lastError;

    saveData({ fanpages: true });
    renderFanpageTab();
    showToast(`Đã reset trạng thái fanpage ${fanpage.name}`, 'info');
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



// Hàm kiểm tra trạng thái thực tế
function checkActualFanpageStatus(fanpage) {
    // Nếu bài viết đã bị xóa hoặc hạn chế
    if (fanpage.errorCount > 2) { // Ngưỡng lỗi
        return {
            status: 'not-exists',
            icon: 'times-circle',
            text: 'Bài viết không khả dụng'
        };
    }

    // Trạng thái bình thường
    return {
        status: fanpage.status,
        icon: fanpage.status === 'exists' ? 'check-circle'
            : fanpage.status === 'not-exists' ? 'times-circle'
                : 'spinner fa-pulse',
        text: fanpage.status === 'exists' ? 'Tồn tại'
            : fanpage.status === 'not-exists' ? 'Không tồn tại'
                : 'Đang kiểm tra'
    };
}
function deleteFanpage(fanpageId) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;

    saveBackup('deleteFanpage', { fanpage: { ...fanpage } });
    state.fanpages = state.fanpages.filter(f => f.id !== fanpageId);
    saveData({ fanpages: true });
    renderFanpageTab();
    showToast(`Đã xóa fanpage ${fanpage.name}`, 'success');
    addLog(`Đã xóa fanpage ${fanpage.name} (ID: ${fanpage.id})`, 'info');
}


function isFanpageExists(url) {
    const baseUrl = url.split('?')[0];
    return state.fanpages.some(fanpage => fanpage.url.split('?')[0] === baseUrl);
}


function refreshFanpage(fanpageId) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;

    saveBackup('refreshFanpage', { fanpage: { ...fanpage } });
    fanpage.status = 'pending';
    fanpage.lastChecked = null;
    saveData({ fanpages: true });
    renderTabContent('fanpage');
    addLog(`Làm mới fanpage: ${fanpage.name}`, 'info');
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



function forceCheckFanpage(fanpageId, itemElement) {
    const fanpage = state.fanpages.find(f => f.id === fanpageId);
    if (!fanpage) return;

    // Reset trạng thái
    fanpage.status = 'pending';
    fanpage.lastChecked = null;
    saveData({ fanpages: true });

    // Hiển thị loading
    const statusElement = itemElement.querySelector('.fanpage-status-overlay');
    statusElement.className = 'fanpage-status-overlay pending';
    statusElement.textContent = '⌛ Đang kiểm tra...';

    // Tải lại iframe
    const iframeContainer = itemElement.querySelector('.fanpage-iframe-container');
    iframeContainer.innerHTML = '';
    iframeContainer.dataset.loaded = 'false';
    loadFanpageIframe(fanpage, iframeContainer);
}

function loadFanpageIframe(fanpage, container) {
    if (fanpage.status !== 'pending' && fanpage.lastChecked) return;

    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>';

    // Sử dụng Facebook SDK nếu có
    if (window.FB) {
        container.innerHTML = `
            <div class="fb-post" 
                 data-href="${fanpage.url}" 
                 data-width="300"
                 data-show-text="true"
                 data-lazy="true"></div>
        `;
        window.FB.XFBML.parse(container);
    } else {
        // Fallback sử dụng iframe thông thường
        container.innerHTML = `
            <iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(fanpage.url)}&width=300&show_text=true" 
                    width="300" height="200" 
                    style="border:none;overflow:hidden" 
                    scrolling="no" 
                    frameborder="0" 
                    allowfullscreen="true"></iframe>
        `;
    }

    // Cập nhật trạng thái sau khi tải
    setTimeout(() => {
        fanpage.status = 'exists'; // Giả định tải thành công
        fanpage.lastChecked = new Date().toISOString();
        saveData({ fanpages: true });
    }, 2000);
}


function updateSelectionBar(fanpages) {
    const container = elements.linkLists['fanpage'];
    if (!container) return;

    const selectedCount = fanpages.filter(f => f.checked).length;
    const totalCount = fanpages.length;

    container.querySelector('.selection-count').textContent = `${selectedCount}/${totalCount}`;
    container.querySelector('.delete-selected-btn').disabled = selectedCount === 0;

    const selectAllCheckbox = container.querySelector('#select-all-fanpages');
    if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedCount === totalCount) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}



// Cập nhật hàm getFilteredFanpages để hỗ trợ lọc trùng lặp
function getFilteredFanpages(filter) {
    let fanpages = [...state.fanpages];

    // Áp dụng bộ lọc
    switch (filter) {
        case 'fanpage':
            fanpages = fanpages.filter(f => f.type === 'fanpage');
            break;
        case 'profile':
            fanpages = fanpages.filter(f => f.type === 'profile');
            break;
        case 'profile-pro':
            fanpages = fanpages.filter(f => f.type === 'profile-pro');
            break;
        case 'duplicate':
            fanpages = findDuplicateFanpages();
            break;
    }

    // Sắp xếp
    return fanpages.sort((a, b) => {
        const typeOrder = {
            'profile-pro': 1,
            'profile': 2,
            'fanpage': 3
        };
        const typeA = typeOrder[a.type] || 3;
        const typeB = typeOrder[b.type] || 3;
        if (typeA !== typeB) return typeA - typeB;

        const titleA = a.name.toLowerCase();
        const titleB = b.name.toLowerCase();
        const numA = parseInt(titleA.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(titleB.match(/\d+/)?.[0] || '0', 10);
        if (numA && numB) return numA - numB;
        return titleA.localeCompare(titleB);
    });
}

// Hàm tìm fanpage trùng lặp (theo URL hoặc tiêu đề)
function findDuplicateFanpages() {
    const urlMap = {};
    const titleMap = {};
    const duplicates = new Set();

    state.fanpages.forEach(fanpage => {
        // Kiểm tra trùng URL
        const baseUrl = fanpage.url.split('?')[0];
        if (urlMap[baseUrl]) {
            duplicates.add(fanpage);
            duplicates.add(urlMap[baseUrl]);
        } else {
            urlMap[baseUrl] = fanpage;
        }

        // Kiểm tra trùng tiêu đề (không phân biệt hoa thường)
        const lowerTitle = fanpage.name.toLowerCase();
        if (titleMap[lowerTitle]) {
            duplicates.add(fanpage);
            duplicates.add(titleMap[lowerTitle]);
        } else {
            titleMap[lowerTitle] = fanpage;
        }
    });

    return Array.from(duplicates);
}

function renderFanpageList(container, fanpages) {
    container.innerHTML = ''; // Xóa toàn bộ nội dung cũ trong container

    // Chỉ render danh sách fanpage, không render fanpage-list-header
    fanpages.forEach((fanpage, index) => {
        const item = document.createElement('div');
        item.className = `link-item ${fanpage.checked ? 'checked' : ''}`;
        item.dataset.id = fanpage.id;

        const indexStr = (index + 1).toString();
        const indexDigits = indexStr.split('').map(digit => `<span>${digit}</span>`).join('');

        item.innerHTML = `
            <input type="checkbox" class="link-checkbox" ${fanpage.checked ? 'checked' : ''}>
            <div class="link-row">
                <button class="link-index" title="Xóa fanpage này">
                    ${indexDigits}
                </button>
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

        container.appendChild(item);
        loadMiniIframe(item.querySelector('.fanpage-iframe-mini'), fanpage.url);

        // Sự kiện checkbox
        const checkbox = item.querySelector('.link-checkbox');
        checkbox.addEventListener('change', () => {
            fanpage.checked = checkbox.checked;
            updateSelectionBar(fanpages); // Cập nhật selection-bar
            saveData({ fanpages: true });
            item.classList.toggle('checked', fanpage.checked);
        });

        // Sự kiện click vào item (toggle checkbox)
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.link-checkbox') && !e.target.closest('.link-actions')) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        // Sự kiện nút chỉnh sửa
        item.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            showEditFanpagePopup(fanpage);
        });

        // Sự kiện nút STT (Xóa fanpage)
        item.querySelector('.link-index').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Xóa fanpage: ${fanpage.url}?`)) {
                deleteFanpage(fanpage.id);
            }
        });
    });
}



function loadMiniIframe(container, url) {
    container.innerHTML = `
        <iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=60&height=60&show_text=false" 
                width="60" 
                height="60" 
                style="border:none;overflow:hidden" 
                scrolling="no" 
                frameborder="0" 
                allowfullscreen="true"
                loading="lazy"></iframe>
    `;
}


function groupFanpagesByType(fanpages) {
    const groups = {
        'profile-pro': { title: '⭐ Profile Pro', items: [] },
        'profile': { title: '👤 Trang cá nhân', items: [] },
        'fanpage': { title: '📌 Fanpage', items: [] }
    };

    fanpages.forEach(f => {
        if (groups[f.type]) {
            groups[f.type].items.push(f);
        } else {
            groups.profile.items.push(f);
        }
    });

    return Object.values(groups).filter(g => g.items.length > 0);
}



function loadFanpageIframe(container, fanpage) {
    if (fanpage.status === 'exists' && fanpage.lastChecked) {
        // Đã kiểm tra rồi thì không cần tải lại
        return;
    }

    container.innerHTML = `
        <iframe src="https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(fanpage.url)}&tabs&width=280&height=130&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false" 
                width="280" height="130" style="border:none;overflow:hidden" 
                scrolling="no" frameborder="0" allowfullscreen="true" 
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share">
        </iframe>
    `;

    // Kiểm tra sau khi tải
    setTimeout(() => verifyFanpage(fanpage, container), 2000);
}



function getTypeColor(type) {
    return {
        'profile-pro': '#ff9500',
        'profile': '#42b72a',
        'fanpage': '#1877f2'
    }[type] || '#65676b';
}

function getTypeLabel(type) {
    return {
        'profile-pro': '⭐ Profile Pro',
        'profile': '👤 Trang cá nhân',
        'fanpage': '📌 Fanpage'
    }[type] || 'Không xác định';
}




function findDuplicateTitles() {
    const titleMap = {};
    const duplicates = [];

    state.fanpages.forEach(fanpage => {
        if (!titleMap[fanpage.name]) {
            titleMap[fanpage.name] = [];
        }
        titleMap[fanpage.name].push(fanpage);
    });

    for (const name in titleMap) {
        if (titleMap[name].length > 1) {
            duplicates.push(...titleMap[name]);
        }
    }

    return duplicates;
}


function setupFanpageEvents() {
    // Sự kiện chỉnh sửa
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', function () {
            const item = this.closest('.link-item');
            const fanpage = state.fanpages.find(f => f.id === item.dataset.id);
            const field = this.classList.contains('link-title') ? 'name' : 'description';

            if (fanpage) {
                fanpage[field] = this.textContent.trim();
                saveData({ fanpages: true });
            }
        });
    });

    // Sự kiện xóa
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function () {
            const item = this.closest('.link-item');
            const fanpageId = item.dataset.id;

            if (confirm('Xóa fanpage này?')) {
                state.fanpages = state.fanpages.filter(f => f.id !== fanpageId);
                saveData({ fanpages: true });
                renderFanpageTab();
            }
        });
    });

    // Sự kiện sửa
    document.querySelectorAll('.action-btn.edit').forEach(btn => {
        btn.addEventListener('click', function () {
            const item = this.closest('.link-item');
            const title = item.querySelector('.link-title');
            title.focus();

            // Di chuyển con trỏ đến cuối văn bản
            const range = document.createRange();
            range.selectNodeContents(title);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
    });
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



async function extractImageFromUrl(url) {
    try {
        // Sử dụng proxy để lấy nội dung HTML
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`Lỗi HTTP: ${response.status}`);
        }

        const data = await response.json();
        const htmlContent = data.contents;

        if (!htmlContent) {
            throw new Error('Không có nội dung HTML trả về');
        }

        // Phương pháp trích xuất ảnh cũ từ HTML
        const imageRegex = /"image":{"uri":"([^"]+)"/g;
        const matches = imageRegex.exec(htmlContent);

        if (!matches || !matches[1]) {
            throw new Error('Không tìm thấy ảnh trong HTML');
        }

        let imageUrl = matches[1].replace(/\\\//g, '/');

        // Xử lý URL tương đối thành URL tuyệt đối nếu cần
        if (imageUrl.startsWith('/')) {
            imageUrl = new URL(imageUrl, new URL(url).origin).href;
        }

        return imageUrl;
    } catch (error) {
        console.error('Lỗi khi trích xuất ảnh:', error);
        addLog(`Lỗi trích xuất ảnh từ ${url}: ${error.message}`, 'error');
        return null;
    }
}

async function reloadImage(linkId) {
    const link = state.links.find(l => l.id === linkId);
    if (!link) return;

    try {
        showToast('Đang tải lại ảnh...', 'info');
        const newImage = await extractImageFromUrl(link.url);

        if (newImage) {
            // Lưu trạng thái cũ để undo
            saveBackup('updateImage', {
                linkId: link.id,
                oldImage: link.image,
                newImage: newImage
            });

            // Cập nhật ảnh mới
            link.image = newImage;
            saveData({ links: true });
            renderTabContent(state.currentTab);

            showToast('Đã cập nhật ảnh mới', 'success');
            addLog(`Đã cập nhật ảnh cho link ${link.url}`, 'info');
        } else {
            showToast('Không thể tải ảnh mới', 'warning');
        }
    } catch (error) {
        showToast('Lỗi khi tải ảnh mới', 'danger');
        addLog(`Lỗi khi tải ảnh mới cho link ${link.url}: ${error.message}`, 'error');
    }
}

/**
 * Hàm chung xử lý nhập/xuất dữ liệu lên Gist
 */

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
    await handleGistOperation({
        operation: 'import',
        fileName: 'Jsonlink',
        dataType: 'links',
        processImport: async (items) => {
            const newLinks = [];
            for (const item of items) {
                if (!isValidUrl(item.url)) continue;
                const isErrorImage = item.image === config.defaultImage;
                const newLink = {
                    id: generateId(),
                    url: item.url,
                    title: isErrorImage ? 'Cần login để hiển thị' : (item.title || 'Chưa xử lý'),
                    description: isErrorImage ? 'Yêu cầu đăng nhập bằng token' : (item.description || ''),
                    image: item.image,
                    status: isErrorImage ? 'login' : 'success',
                    post_type: item.post_type || determinePostType(item.url),
                    date: new Date().toISOString(),
                    checked: item.checked || false,
                    blacklistStatus: item.blacklistStatus || 'active',
                    note: item.note || ''
                };
                state.links.unshift(newLink);
                newLinks.push(newLink);
                addLog(`Đã thêm link từ Jsonlink: ${item.url}`, 'success');
            }
            return newLinks;
        }
    });
}

async function importFromJSON() {
    await handleGistOperation({
        operation: 'import',
        fileName: 'Jsonalllink',
        dataType: 'links',
        processImport: async (items) => {
            const newLinks = [];
            for (const item of items) {
                const trimmedUrl = item.url.trim();
                if (!isValidUrl(trimmedUrl)) continue;
                const isErrorImage = item.image === config.defaultImage;
                const newLink = {
                    id: generateId(),
                    url: trimmedUrl,
                    title: isErrorImage ? 'Cần login để hiển thị' : (item.title || 'Chưa xử lý'),
                    description: isErrorImage ? 'Yêu cầu đăng nhập bằng token' : (item.description || ''),
                    image: item.image,
                    status: isErrorImage ? 'login' : 'success',
                    post_type: item.post_type || determinePostType(trimmedUrl),
                    date: new Date().toISOString(),
                    checked: item.checked || false,
                    blacklistStatus: item.blacklistStatus || 'active',
                    note: item.note || ''
                };
                state.links.unshift(newLink);
                newLinks.push(newLink);
                addLog(`Đã thêm link từ Jsonalllink: ${trimmedUrl}`, 'success');
            }
            return newLinks;
        }
    });
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

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), config.toastDuration);
}

async function loadData() {
    const showLoading = () => {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Đang tải...';
        document.body.appendChild(loading);
        return () => document.body.removeChild(loading);
    };

    const hideLoading = showLoading();
    try {
        // Load dữ liệu từ IndexedDB
        const [links, fanpages, logs, scrollPos, dateFilter, fanpageFilter, undoStack] = await Promise.all([
            loadFromDB('links'),
            loadFromDB('fanpages'),
            loadFromDB('logs'),
            dbOperation(config.storeNames.settings, 'get', 'scrollPosition'),
            dbOperation(config.storeNames.settings, 'get', 'dateFilter'),
            dbOperation(config.storeNames.settings, 'get', 'fanpageFilter'),
            dbOperation(config.storeNames.settings, 'get', 'undoStack')
        ]);

        // Cập nhật state
        state.links = links || [];
        state.fanpages = fanpages || [];
        state.logs = logs || [];
        state.scrollPosition = scrollPos?.value || 0;
        state.dateFilter = dateFilter?.value || {
            startDate: '',
            endDate: '',
            status: 'all',
            groupTitles: false,
            searchQuery: ''
        };
        state.fanpageFilter = fanpageFilter?.value || { currentPage: 1 };
        state.undoStack = undoStack?.value || [];

        // Đảm bảo dữ liệu hợp lệ
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
            description: fanpage.description || ''
        }));

        updateCounters();
        switchTab('all-link');
        if (elements.mainContent) {
            elements.mainContent.scrollTop = state.scrollPosition;
        }

        addLog('Đã tải dữ liệu từ IndexedDB', 'info');
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        showToast('Không thể tải dữ liệu, sử dụng mặc định', 'danger');
        state.links = [];
        state.fanpages = [];
        state.logs = [];
        updateCounters();
        switchTab('all-link');
        addLog(`Lỗi tải dữ liệu: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function showLinkDetailsPopup(link) {
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
                    <input type="text" id="image-url-input" placeholder="Nhập URL ảnh mới..." value="">
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

    const resizeObserver = new ResizeObserver(() => {
        const wrapper = popup.querySelector('.fb-post-wrapper');
        const container = popup.querySelector('.fb-post-container');
        const iframe = popup.querySelector('.fb-post iframe');
        if (!iframe || !container || !wrapper) return;
        const scale = Math.min(wrapper.clientWidth / (iframe.clientWidth || 600), wrapper.clientHeight / (iframe.clientHeight || 600));
        container.style.transform = `scale(${scale})`;
        container.style.width = `${100 / scale}%`;
        container.style.height = `${100 / scale}%`;
    });
    resizeObserver.observe(popup.querySelector('.fb-post-wrapper'));

    const closePopup = () => {
        resizeObserver.disconnect();
        popup.remove();
    };

    // Copy link + mở Shortcuts
    popup.querySelector('#copy-shortcuts-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(link.url);
        window.open(`shortcuts://run-shortcut?name=111&input=text&text=${encodeURIComponent(link.url)}`, '_blank');
    });

    // Paste ảnh + cập nhật + đóng popup
    popup.querySelector('#paste-image-btn').addEventListener('click', async () => {
        const imageUrl = await navigator.clipboard.readText();
        popup.querySelector('#image-url-input').value = imageUrl;

        const linkIndex = state.links.findIndex(l => l.id === link.id);
        if (linkIndex !== -1) {
            state.links[linkIndex].image = imageUrl;
            link.image = imageUrl;
            saveData({ links: true });
            renderTabContent(state.currentTab);
        }

        closePopup();
    });

    // Nút Xóa
    popup.querySelector('#delete-btn').addEventListener('click', () => {
        if (confirm(`Xóa link: ${link.url}?`)) {
            saveBackup('deleteLinks', { links: [{ ...link }] });
            state.links = state.links.filter(l => l.id !== link.id);
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã xóa link ${link.url}`, 'success');
            addLog(`Đã xóa link ${link.url} (ID: ${link.id})`, 'info');
            closePopup();
        }
    });

    // Đóng popup
    popup.querySelector('#close-btn').addEventListener('click', closePopup);
    popup.querySelector('.modal-close').addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closePopup();
    });

    const waitForIframe = () => {
        const iframe = popup.querySelector('.fb-post iframe');
        if (iframe) {
            iframe.onload = () => setTimeout(() => resizeObserver.observe(popup.querySelector('.fb-post-wrapper')), 300);
        } else {
            setTimeout(waitForIframe, 200);
        }
    };

    if (!window.FB) {
        const script = document.createElement('script');
        script.src = 'https://connect.facebook.net/vi_VN/sdk.js#xfbml=1&version=v12.0&appId=YOUR_APP_ID';
        script.async = true;
        script.defer = true;
        script.onload = () => window.FB.XFBML.parse(popup, waitForIframe);
        document.body.appendChild(script);
    } else {
        window.FB.XFBML.parse(popup, waitForIframe);
    }
}


function showSettingsDialog(link) {
    const dialog = document.createElement('div');
    dialog.className = 'settings-modal-overlay';
    dialog.innerHTML = `
        <div class="settings-modal-dialog">
            <div class="settings-modal-header">
                <h3>Cài đặt Link</h3>
                <button class="settings-modal-close">×</button>
            </div>
            <div class="settings-modal-body">
                <div class="form-group">
                    <label>URL bài viết:</label>
                    <input type="text" id="link-url-input" value="${link.url}" class="form-control">
                </div>
                <div class="form-group">
                    <label>URL ảnh:</label>
                    <input type="text" id="link-image-input" value="${link.image}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Ghi chú hiện tại:</label>
                    <p>${link.note || 'Không có ghi chú'}</p>
                </div>
                <div class="form-group">
                    <label>Trạng thái:</label>
                    <p>${link.blacklistStatus === 'blacklisted' ? 'Đang trong blacklist' : 'Bình thường'}</p>
                </div>
            </div>
            <div class="settings-modal-footer">
                <button id="settings-save" class="settings-btn btn-primary">Lưu</button>
                <button id="settings-cancel" class="settings-btn btn-secondary">Hủy</button>
                <button id="settings-note" class="settings-btn btn-secondary">Ghi chú</button>
                ${link.blacklistStatus === 'active' ?
            '<button id="settings-blacklist" class="settings-btn btn-danger">Blacklist</button>' :
            '<button id="settings-unblacklist" class="settings-btn btn-success">Gỡ Blacklist</button>'}
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const urlInput = dialog.querySelector('#link-url-input');
    const imageInput = dialog.querySelector('#link-image-input');
    const saveBtn = dialog.querySelector('#settings-save');
    const cancelBtn = dialog.querySelector('#settings-cancel');
    const noteBtn = dialog.querySelector('#settings-note');
    const blacklistBtn = dialog.querySelector('#settings-blacklist');
    const unblacklistBtn = dialog.querySelector('#settings-unblacklist');
    const closeBtn = dialog.querySelector('.settings-modal-close');

    saveBtn.addEventListener('click', () => {
        const newUrl = urlInput.value.trim();
        const newImage = imageInput.value.trim();

        if (!isValidUrl(newUrl)) {
            showToast('URL bài viết không hợp lệ', 'warning');
            return;
        }
        if (newImage && !isValidUrl(newImage)) {
            showToast('URL ảnh không hợp lệ', 'warning');
            return;
        }

        saveBackup('editLink', { linkId: link.id, url: link.url, image: link.image });

        link.url = newUrl;
        link.image = newImage || config.defaultImage;
        link.post_type = determinePostType(newUrl);

        saveData({ links: true });
        renderTabContent(state.currentTab);
        updateCounters();

        showToast('Đã cập nhật link', 'success');
        addLog(`Đã cập nhật link: ${link.url} (ID: ${link.id})`, 'info');
        document.body.removeChild(dialog);
    });

    cancelBtn.addEventListener('click', () => document.body.removeChild(dialog));
    closeBtn.addEventListener('click', () => document.body.removeChild(dialog));

    noteBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
        showNoteDialog(link);
    });

    if (blacklistBtn) {
        blacklistBtn.addEventListener('click', () => {
            saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
            link.blacklistStatus = 'blacklisted';
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã chặn link: ${link.url}`, 'success');
            addLog(`Đã chặn link ${link.url} (ID: ${link.id})`, 'info');
            document.body.removeChild(dialog);
        });
    }

    if (unblacklistBtn) {
        unblacklistBtn.addEventListener('click', () => {
            saveBackup('blacklist', { linkId: link.id, blacklistStatus: link.blacklistStatus });
            link.blacklistStatus = 'active';
            saveData({ links: true });
            renderTabContent(state.currentTab);
            updateCounters();
            showToast(`Đã gỡ chặn link: ${link.url}`, 'success');
            addLog(`Đã gỡ chặn link ${link.url} (ID: ${link.id})`, 'info');
            document.body.removeChild(dialog);
        });
    }
}

function showAddFanpageDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'add-fanpage-modal-overlay';
    dialog.innerHTML = `
        <div class="add-fanpage-modal-dialog">
            <div class="add-fanpage-modal-header">
                <h3>Thêm Fanpage/Profile</h3>
                <button class="add-fanpage-modal-close">×</button>
            </div>
            <div class="add-fanpage-modal-body">
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
            </div>
            <div class="add-fanpage-modal-footer">
                <button id="import-fanpage-json" class="add-fanpage-btn btn-secondary">Nhập JSON</button>
                <button id="cancel-add-fanpage" class="add-fanpage-btn btn-secondary">Hủy</button>
                <button id="confirm-add-fanpage" class="add-fanpage-btn btn-primary">Thêm</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    let selectedType = 'fanpage';

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
        if (isFanpageExists(url)) {
            if (!confirm(`Fanpage ${url} đã tồn tại. Ghi đè?`)) return showToast('Đã hủy thêm fanpage', 'warning');
            state.fanpages = state.fanpages.filter(f => f.url.split('?')[0] !== url.split('?')[0]);
        }

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
        renderFanpageTab();
        const newItem = document.querySelector(`.link-item[data-id="${newFanpage.id}"]`);
        if (newItem && elements.mainContent) {
            smoothScroll(elements.mainContent, newItem.offsetTop);
            newItem.classList.add('highlight');
            setTimeout(() => newItem.classList.remove('highlight'), 2000);
        }
        showToast(`Đã thêm ${selectedType === 'fanpage' ? 'Fanpage' : 'Profile'} mới`, 'success');
        addLog(`Đã thêm fanpage: ${title} (ID: ${newFanpage.id})`, 'success');
        document.body.removeChild(dialog);
    });

    dialog.querySelector('#import-fanpage-json').addEventListener('click', () => {
        importFanpagesFromJSON();
        document.body.removeChild(dialog);
    });

    dialog.querySelector('#cancel-add-fanpage').addEventListener('click', () => document.body.removeChild(dialog));
    dialog.querySelector('.add-fanpage-modal-close').addEventListener('click', () => document.body.removeChild(dialog));
}

function showEditFanpagePopup(fanpage) {
    const popup = document.createElement('div');
    popup.className = 'edit-fanpage-modal-overlay';
    popup.innerHTML = `
        <div class="edit-fanpage-modal-dialog">
            <div class="edit-fanpage-modal-header">
                <span>🛠️ Sửa Fanpage</span>
                <button class="edit-fanpage-modal-close">×</button>
            </div>
            <div class="edit-fanpage-modal-body">
                <div class="edit-fanpage-form-row">
                    <span>🔗</span>
                    <input type="text" id="edit-fanpage-url" value="${fanpage.url}" class="edit-fanpage-form-control">
                </div>
                <div class="edit-fanpage-form-row">
                    <span>📝</span>
                    <input type="text" id="edit-fanpage-title" value="${fanpage.name}" class="edit-fanpage-form-control">
                </div>
                <div class="edit-fanpage-form-row">
                    <span>💬</span>
                    <textarea id="edit-fanpage-description" class="edit-fanpage-form-control">${fanpage.description || ''}</textarea>
                </div>
                <div class="edit-fanpage-btn-group">
                    <button class="edit-fanpage-type-btn ${fanpage.type === 'fanpage' ? 'active' : ''}" data-type="fanpage">Fanpage</button>
                    <button class="edit-fanpage-type-btn ${fanpage.type === 'profile' ? 'active' : ''}" data-type="profile">Cá nhân</button>
                    <button class="edit-fanpage-type-btn ${fanpage.type === 'profile-pro' ? 'active' : ''}" data-type="profile-pro">Pro</button>
                </div>
            </div>
            <div class="edit-fanpage-modal-footer">
                <button id="delete-fanpage" class="edit-fanpage-btn btn-danger">🗑️</button>
                <div class="edit-fanpage-action-buttons">
                    <button id="cancel-edit" class="edit-fanpage-btn btn-secondary">Hủy</button>
                    <button id="save-fanpage" class="edit-fanpage-btn btn-primary">Lưu</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

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

        if (!isValidUrl(url)) return showToast('URL không hợp lệ', 'warning');
        if (!name) return showToast('Tiêu đề không được để trống', 'warning');

        saveBackup('editFanpage', { fanpage: { ...fanpage } });

        Object.assign(fanpage, {
            url, name, description, type,
            status: 'pending', lastChecked: null
        });

        saveData({ fanpages: true });
        renderFanpageTab();
        showToast(`Đã cập nhật fanpage ${name}`, 'success');
        addLog(`Cập nhật fanpage ${name} (ID: ${fanpage.id})`, 'info');
        document.body.removeChild(popup);
    });

    popup.querySelector('#delete-fanpage').addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa fanpage này?')) {
            deleteFanpage(fanpage.id);
            document.body.removeChild(popup);
        }
    });

    popup.querySelector('#cancel-edit').addEventListener('click', () => document.body.removeChild(popup));
    popup.querySelector('.edit-fanpage-modal-close').addEventListener('click', () => document.body.removeChild(popup));
}

function renderFanpageTab() {
    const container = elements.linkLists['fanpage'];
    if (!container) {
        addLog('Không tìm thấy container fanpage-tab', 'error');
        return;
    }

    container.innerHTML = `
        <div class="fanpage-controls">
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="fanpage">Fanpage</button>
                <button class="filter-btn" data-filter="profile">Cá nhân</button>
                <button class="filter-btn" data-filter="profile-pro">Pro</button>
                <button class="filter-btn" data-filter="duplicate">Trùng</button>
            </div>
            <div class="action-buttons">
                <button class="export-btn" id="export-fanpage-json">Xuất</button>
            </div>
        </div>
        <div class="selection-bar">
            <input type="checkbox" id="select-all-fanpages">
            <span class="selection-info">All</span>
            <span class="selection-count">0/${state.fanpages.length}</span>
            <button class="delete-selected-btn" disabled>Xóa</button>
        </div>
        <div class="fanpage-list"></div>
    `;

    const listContainer = container.querySelector('.fanpage-list');
    let currentFilter = 'all';

    renderFanpageList(listContainer, getFilteredFanpages(currentFilter));

    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;

            const filteredFanpages = getFilteredFanpages(currentFilter);
            renderFanpageList(listContainer, filteredFanpages);
            updateSelectionBar(filteredFanpages);
        });
    });

    container.querySelector('#export-fanpage-json').addEventListener('click', () => {
        const filteredFanpages = getFilteredFanpages(currentFilter);
        exportFanpagesToJSON(filteredFanpages);
    });

    container.querySelector('#select-all-fanpages').addEventListener('change', function () {
        const filteredFanpages = getFilteredFanpages(currentFilter);
        const isChecked = this.checked;

        filteredFanpages.forEach(fanpage => {
            fanpage.checked = isChecked;
        });

        saveData({ fanpages: true });
        renderFanpageList(listContainer, filteredFanpages);
        updateSelectionBar(filteredFanpages);
    });

    container.querySelector('.delete-selected-btn').addEventListener('click', () => {
        const filteredFanpages = getFilteredFanpages(currentFilter);
        const selectedFanpages = filteredFanpages.filter(f => f.checked);

        if (selectedFanpages.length === 0) return;

        if (confirm(`Bạn có chắc muốn xóa ${selectedFanpages.length} fanpage đã chọn?`)) {
            saveBackup('deleteFanpages', { fanpages: [...selectedFanpages] });
            state.fanpages = state.fanpages.filter(f => !selectedFanpages.includes(f));

            saveData({ fanpages: true });
            const newFiltered = getFilteredFanpages(currentFilter);
            renderFanpageList(listContainer, newFiltered);
            updateSelectionBar(newFiltered);

            showToast(`Đã xóa ${selectedFanpages.length} fanpage`, 'success');
            addLog(`Đã xóa ${selectedFanpages.length} fanpage`, 'info');
        }
    });

    updateSelectionBar(getFilteredFanpages(currentFilter));
}

init();