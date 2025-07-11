// =============================================
// 1. KHAI BÁO HẰNG SỐ VÀ BIẾN TOÀN CỤC
// =============================================
const headers = [
    'STT', 'NgayHoaDon', 'MaKhachHang', 'TenKhachHang', 'TenNguoiMua', 'MaSoThue', 'DiaChiKhachHang', 'DienThoaiKhachHang', 'SoTaiKhoan', 'NganHang', 'HinhThucTT',
    'MaSanPham', 'SanPham', 'DonViTinh', 'Extra1SP', 'Extra2SP', 'SoLuong', 'DonGia', 'TyLeChietKhau', 'SoTienChietKhau', 'ThanhTien', 'TienBan', 'ThueSuat', 'TienThueSanPham',
    'TienThue', 'TongSoTienChietKhau', 'TongCong', 'TinhChatHangHoa', 'DonViTienTe', 'TyGia', 'Fkey', 'Extra1', 'Extra2', 'EmailKhachHang', 'VungDuLieu', 'Extra3', 'Extra4',
    'Extra5', 'Extra6', 'Extra7', 'Extra8', 'Extra9', 'Extra10', 'Extra11', 'Extra12', 'LDDNBo', 'HDSo', 'HVTNXHang', 'TNVChuyen', 'PTVChuyen', 'HDKTNgay', 'HDKTSo', 'CCCDan', '', '', 'mau_01'
];

let businesses = [];
let invoices = [];
let inventory = [];
let exportedInvoices = [];
let manualNetEdit = false;
let allowDuplicates = false;
let lastActiveBusinessId = null; // Thêm biến này
let activityLogs = []; // Thêm mảng lưu log hoạt động
// Thêm biến lưu trữ lịch sử
let sessionHistory = [];
let undoStack = [];
const MAX_UNDO_STEPS = 20;
const SESSION_HISTORY_KEY = 'lastSessionState';
const DEFAULT_BUSINESS_ID = 'default-business-id';
const DEFAULT_BUSINESS_NAME = 'HKD Mặc Định (Hóa đơn lỗi)';

// =============================================
function setActiveBusiness(businessId) {
    lastActiveBusinessId = businessId;
    localStorage.setItem('lastActiveBusinessId', businessId);
}
// 2. HÀM TIỆN ÍCH CHUNG
// =============================================
function saveCurrentState() {
    const currentState = {
        businesses: JSON.parse(JSON.stringify(businesses)),
        invoices: JSON.parse(JSON.stringify(invoices)),
        inventory: JSON.parse(JSON.stringify(inventory)),
        exportedInvoices: JSON.parse(JSON.stringify(exportedInvoices)),
        lastActiveBusinessId: lastActiveBusinessId,
        timestamp: new Date().toISOString()
    };

    // Lưu vào localStorage để khôi phục sau này
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(currentState));
    localStorage.setItem('lastActiveBusinessId', lastActiveBusinessId); // Lưu riêng lastActiveBusinessId

    // Thêm vào undo stack (giới hạn 20 bước)
    undoStack.unshift(currentState);
    if (undoStack.length > MAX_UNDO_STEPS) {
        undoStack.pop();
    }

    return currentState;
}

function restorePreviousSession() {
    try {
        if (confirm('Bạn có chắc muốn khôi phục trạng thái phiên làm việc trước? Mọi thay đổi chưa lưu sẽ bị mất.')) {
            const savedState = localStorage.getItem(SESSION_HISTORY_KEY);
            if (!savedState) {
                alert('Không tìm thấy dữ liệu phiên làm việc trước!');
                return;
            }

            const previousState = JSON.parse(savedState);
            businesses = previousState.businesses;
            invoices = previousState.invoices;
            inventory = previousState.inventory;
            exportedInvoices = previousState.exportedInvoices;
            lastActiveBusinessId = previousState.lastActiveBusinessId;

            // Cập nhật localStorage
            localStorage.setItem('businesses', JSON.stringify(businesses));
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('inventory', JSON.stringify(inventory));
            localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

            // Cập nhật giao diện
            updateBusinessList();
            if (lastActiveBusinessId) {
                showBusinessDetails(lastActiveBusinessId);
            } else if (businesses.length > 0) {
                showBusinessDetails(businesses[0].id);
            }

            alert('Đã khôi phục trạng thái phiên làm việc trước!');

            // Ghi log
            logActivity('system', 'Khôi phục phiên làm việc trước');
        }
    } catch (e) {
        console.error('Lỗi restorePreviousSession:', e);
        alert('Lỗi khi khôi phục phiên làm việc trước: ' + e.message);
    }
}

function undoLastAction() {
    try {
        if (undoStack.length === 0) {
            alert('Không có thao tác nào để hoàn tác!');
            return;
        }

        const previousState = undoStack[0]; // Xem trước trạng thái
        const businessNames = previousState.businesses.map(b => b.name).join(', ');

        if (confirm(`Bạn có chắc muốn hoàn tác thao tác gần nhất?\nTrạng thái trước đó có ${previousState.businesses.length} HKD: ${businessNames}`)) {
            const stateToRestore = undoStack.shift();

            // Khôi phục từng phần dữ liệu
            businesses = stateToRestore.businesses;
            invoices = stateToRestore.invoices;
            inventory = stateToRestore.inventory;
            exportedInvoices = stateToRestore.exportedInvoices;
            lastActiveBusinessId = stateToRestore.lastActiveBusinessId;

            // Cập nhật localStorage
            localStorage.setItem('businesses', JSON.stringify(businesses));
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('inventory', JSON.stringify(inventory));
            localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

            // Cập nhật giao diện
            updateBusinessList();
            if (lastActiveBusinessId) {
                showBusinessDetails(lastActiveBusinessId);
            } else if (businesses.length > 0) {
                showBusinessDetails(businesses[0].id);
            }

            alert(`Đã hoàn tác thành công! Còn ${undoStack.length} lần hoàn tác.`);

            logActivity('system', 'Hoàn tác thao tác', {
                restoredBusinesses: businesses.length,
                restoredInvoices: invoices.length
            });
        }
    } catch (e) {
        console.error('Lỗi undoLastAction:', e);
        alert('Lỗi khi hoàn tác: ' + e.message);
    }
}

//ghi log
function exportLogsToExcel() {
    try {
        const filteredLogs = selectedBusinessId
            ? activityLogs.filter(log => log.businessId === selectedBusinessId)
            : activityLogs;

        if (filteredLogs.length === 0) {
            alert('Không có dữ liệu log để xuất!');
            return;
        }

        const rows = [
            ['Thời gian', 'Hành động', 'Chi tiết', 'Mã HKD']
        ].concat(
            filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString('vi-VN'),
                getActionDescription(log.action),
                JSON.stringify(log.details),
                log.businessId || ''
            ])
        );

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LichSuHoatDong');
        XLSX.writeFile(wb, `LichSuHoatDong_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        console.error('Lỗi khi xuất log:', e);
        alert('Lỗi khi xuất file Excel: ' + e.message);
    }
}

function clearActivityLogs() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử hoạt động?')) {
        activityLogs = [];
        localStorage.setItem('activityLogs', JSON.stringify(activityLogs));
        showActivityLogTab();
        alert('Đã xóa toàn bộ lịch sử hoạt động!');
    }
}
// =============================================
// 2. HÀM TIỆN ÍCH CHUNG - Thêm hàm này
// =============================================
function logActivity(action, details = {}) {
    const logEntry = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        action,
        details,
        businessId: selectedBusinessId || null
    };

    activityLogs.unshift(logEntry); // Thêm vào đầu mảng để mới nhất lên đầu
    localStorage.setItem('activityLogs', JSON.stringify(activityLogs));

    // Nếu tab log đang mở thì cập nhật UI
    if (document.getElementById('activityLogTab') && !document.getElementById('activityLogTab').classList.contains('hidden')) {
        showActivityLogTab();
    }
}

// Khởi tạo dữ liệu từ localStorage
try {
    businesses = JSON.parse(localStorage.getItem('businesses')) || [];
    invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    inventory = JSON.parse(localStorage.getItem('inventory')) || [];
    exportedInvoices = JSON.parse(localStorage.getItem('exportedInvoices')) || [];
    activityLogs = JSON.parse(localStorage.getItem('activityLogs')) || [];

    // Khôi phục HKD đang làm việc gần nhất từ localStorage
    lastActiveBusinessId = localStorage.getItem('lastActiveBusinessId');

    // Nếu không có lastActiveBusinessId, lấy HKD đầu tiên
    if (!lastActiveBusinessId && businesses.length > 0) {
        lastActiveBusinessId = businesses[0].id;
    }

    // Lưu trạng thái ban đầu
    saveCurrentState();

    // Cập nhật giao diện nếu có HKD đang làm việc
    if (lastActiveBusinessId) {
        updateBusinessList(lastActiveBusinessId);
        showBusinessDetails(lastActiveBusinessId);
        showPriceList(lastActiveBusinessId);
        showExportHistory(lastActiveBusinessId);
    }
} catch (e) {
    console.error('Lỗi khi đọc localStorage:', e);
}

// Khởi tạo thư viện PDF.js
if (!window.pdfjsLib) {
    console.error('Thư viện pdfjs-dist không được tải. Vui lòng thêm <script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.min.js"></script> vào HTML.');
}
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js';


// =============================================
// 2. HÀM TIỆN ÍCH CHUNG
// =============================================
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// =============================================
// 10. TAB LỊCH SỬ LÀM VIỆC
// =============================================
function showActivityLogTab() {
    const logTab = document.getElementById('activityLogTab');
    if (!logTab) return;

    // Lọc log theo business đang chọn (nếu có)
    const filteredLogs = selectedBusinessId
        ? activityLogs.filter(log => log.businessId === selectedBusinessId)
        : activityLogs;

    logTab.innerHTML = `
        <div class="section">
            <h4>Lịch sử hoạt động (${filteredLogs.length} bản ghi)</h4>
            <div class="log-controls">
                <button onclick="exportLogsToExcel()">📤 Xuất Excel</button>
                <button onclick="clearActivityLogs()">🗑️ Xóa lịch sử</button>
            </div>
            <table class="log-table">
                <thead>
                    <tr>
                        <th>Thời gian</th>
                        <th>Hành động</th>
                        <th>Chi tiết</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredLogs.map(log => `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString('vi-VN')}</td>
                            <td>${getActionDescription(log.action)}</td>
                            <td>${getActionDetails(log.details)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Hàm hỗ trợ hiển thị
function getActionDescription(action) {
    const actions = {
        'invoice_upload': 'Tải hóa đơn',
        'invoice_edit': 'Sửa hóa đơn',
        'invoice_delete': 'Xóa hóa đơn',
        'export_create': 'Tạo phiếu xuất',
        'inventory_update': 'Cập nhật kho',
        'business_add': 'Thêm HKD',
        'business_delete': 'Xóa HKD',
        'error': 'Lỗi hệ thống'
    };
    return actions[action] || action;
}

function getActionDetails(details) {
    if (!details) return '';

    if (typeof details === 'string') return details;

    return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
}
function normalizeNumber(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    try {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } catch (e) {
        console.error('Lỗi normalizeNumber:', e);
        return 0;
    }
}

function formatMoney(number) {
    try {
        const n = Math.floor(normalizeNumber(number));
        return n.toLocaleString('vi-VN');
    } catch (e) {
        console.error('Lỗi formatMoney:', e);
        return '0';
    }
}

function getTodayDDMMYYYY() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
}
function extractInvoiceInfoFromHTML(html, businessId) { // Thêm businessId để kiểm tra theo doanh nghiệp
    try {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const rawText = dom.body.innerText.replace(/\r\n|\r|\n/g, '\n');
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);

        const getValueAfter = (label, lines, { exact = false, offset = 1 } = {}) => {
            const idx = lines.findIndex(line => exact ? line.trim() === label : line.includes(label));
            if (idx >= 0 && lines[idx + offset]) {
                return lines[idx + offset].trim();
            }
            return '';
        };

        const getDate = () => {
            const match = rawText.match(/Ngày\s+(\d{2})\s+tháng\s+(\d{2})\s+năm\s+(\d{4})/i);
            if (match) return `${match[1]}/${match[2]}/${match[3]}`;
            const fallback = rawText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            return fallback ? fallback[0] : 'Không rõ';
        };

        const getByLabelRegex = (label) => {
            const regex = new RegExp(`${label}\\s*[:：]?\\s*(.+)`, 'i');
            const match = rawText.match(regex);
            return match ? match[1].trim() : '';
        };

        // Trích xuất totalAmount với fallback
        const totalAmount = (() => {
            const tables = dom.querySelectorAll('table');
            for (const table of tables) {
                const rows = table.querySelectorAll('tr');
                for (const row of rows) {
                    if (row.textContent.includes('Tổng tiền thanh toán bằng số')) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            return normalizeNumber(cells[1].textContent.trim());
                        }
                    }
                }
            }
            const totalMatch = rawText.match(/Tổng tiền thanh toán bằng số.+?([\d.,]+)/i) ||
                rawText.match(/Tổng cộng:.+?([\d.,]+)/i);
            return totalMatch ? normalizeNumber(totalMatch[1]) : 0;
        })();

        const mccqt = getByLabelRegex('MCCQT');

        // Kiểm tra trùng lặp MCCQT ngay từ trích xuất, giới hạn theo businessId
        if (invoices.some(i => i.mccqt === mccqt && i.businessId === businessId)) {
            console.warn(`Hóa đơn với MCCQT ${mccqt} đã tồn tại trong doanh nghiệp ${businessId}, bỏ qua.`);
            //alert(`Hóa đơn với MCCQT ${mccqt} đã tồn tại, bỏ qua.`);
            return null; // Trả về null để bỏ qua hóa đơn này
        }

        return {
            mccqt: mccqt,
            so: (() => {
                const soLine = lines.find(line =>
                    line.startsWith('Số:') &&
                    !line.toLowerCase().includes('mẫu') &&
                    line.match(/\d{5,}/)
                );
                if (soLine) {
                    const match = soLine.match(/Số:\s*(\d{5,})/);
                    return match ? match[1] : 'Không rõ';
                }
                const fallback = rawText.match(/Số:\s*(\d{5,})/);
                return fallback ? fallback[1] : 'Không rõ';
            })(),
            kyhieu: getByLabelRegex('Ký hiệu'),
            date: getDate(),

            tenBan: getValueAfter('Tên người bán:', lines),
            mstBan: getValueAfter('Mã số thuế:', lines),
            diachiBan: getValueAfter('Địa chỉ:', lines),

            tenMua: getValueAfter('Tên người mua:', lines),
            mstMua: (() => {
                const idx = lines.findIndex(l => l.includes('Tên người mua:'));
                if (idx >= 0) {
                    const nextMst = lines.slice(idx).find(l => l.match(/^\d{10}$/));
                    return nextMst || 'Không rõ';
                }
                return getValueAfter('Mã số thuế:', lines, { offset: 2 });
            })(),
            diachiMua: (() => {
                const start = lines.findIndex(l => l.includes('Tên người mua:'));
                if (start >= 0) {
                    const addr = lines.slice(start).find(l => l.startsWith('Địa chỉ:'));
                    return addr ? addr.replace('Địa chỉ:', '').trim() : '';
                }
                return '';
            })(),

            totalTax: (() => {
                const match = rawText.match(/Tổng tiền thuế.+?([\d.,]+)/i);
                return match ? normalizeNumber(match[1]) : 0;
            })(),

            totalAmount: totalAmount,
            taxRate: (() => {
                const match = rawText.match(/(\d+)%/);
                return match ? match[1] : '10';
            })()
        };
    } catch (e) {
        console.error('Lỗi extractInvoiceInfoFromHTML:', e);
        return null;
    }
}


const htmlInput = document.getElementById('htmlInput');
if (htmlInput) {
    htmlInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files.length) return;

        const file = files[0];
        const htmlText = await file.text();
        const parser = new DOMParser();
        const dom = parser.parseFromString(htmlText, 'text/html');

        // Trích xuất thông tin hóa đơn từ HTML
        const info = extractInvoiceInfoFromHTML(htmlText);

        if (!info.mstMua || info.mstMua === 'Không rõ') {
            console.warn('Không tìm thấy MST người mua. Bỏ qua.');
            alert('⚠️ Không tìm thấy Mã số thuế người mua trong hóa đơn HTML.');
            return;
        }

        // Tìm hoặc tạo hộ kinh doanh
        let business = businesses.find(b => b.taxCode === info.mstMua);
        if (!business) {
            business = {
                id: generateUUID(),
                name: info.tenMua || 'Không rõ tên',
                taxCode: info.mstMua,
                address: info.diachiMua || 'Không rõ địa chỉ',
                isDefault: false
            };
            businesses.push(business);
        }

        // Trích xuất các dòng hàng hóa từ bảng, loại bỏ dòng tổng hợp
        const itemRows = [...dom.querySelectorAll('table.res-tb tbody tr')];
        const lines = itemRows
            .map(tr => {
                const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim().replace(/\s+/g, ' '));
                // Chỉ lấy dòng có STT (số thứ tự) và đủ các cột hàng hóa
                if (cells[0] && !isNaN(cells[0]) && cells.length >= 8) { // Giả định ít nhất 8 cột: STT, Tính chất, Tên, Đơn vị, Số lượng, Đơn giá, Chiết khấu, Thuế suất, Thành tiền
                    return cells.join('\t');
                }
                return null;
            })
            .filter(line => line !== null);

        // Gán vào textarea ẩn để parse như PDF
        const pdfTextArea = document.getElementById('pdfTextArea');
        if (pdfTextArea) {
            pdfTextArea.value = lines.join('\n');
        } else {
            console.warn('Không tìm thấy #pdfTextArea trong DOM');
        }

        // Gọi lại hàm xử lý bảng hàng hóa
        parseToTable(business.id, file, info, 'input');

        // Hiển thị lên giao diện
        updateBusinessList();
        showBusinessDetails(business.id);
        showPriceList?.(business.id);
        showExportHistory?.(business.id);

        const status = document.getElementById('status');
        if (status) status.innerText = `✅ Đã xử lý hóa đơn HTML: ${file.name}`;
    });
}

// Hàm hiển thị thông báo toast
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: type === 'error' ? "#ff4444" : type === 'success' ? "#00C851" : "#2196F3",
        stopOnFocus: true,
    }).showToast();
}

function parseToTable(businessId, file, info, direction) {
    // Kiểm tra trùng lặp MCCQT trước khi xử lý
    if (invoices.some(i => i.mccqt === info.mccqt && i.businessId === businessId)) {
        //showToast(`Hóa đơn với MCCQT ${info.mccqt} đã tồn tại trong doanh nghiệp ${businessId}, bỏ qua.`, 'error');
        return;
    }

    if (!info) return;

    const pdfTextArea = document.getElementById('pdfTextArea');
    if (!pdfTextArea) return;

    const rawText = pdfTextArea.value.trim();
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const rows = [];
    const uploadDate = new Date().toISOString();

    const invoice = {
        id: generateUUID(),
        businessId,
        mccqt: info.mccqt,
        number: info.so,
        series: info.kyhieu,
        date: info.date,
        seller: { name: info.tenBan, taxCode: info.mstBan, address: info.diachiBan },
        file: URL.createObjectURL(file),
        items: [],
        direction,
        uploadDate,
        netTotal: 0,
        totalTax: info.totalTax,
        totalDiscount: 0,
        totalAmount: info.totalAmount,
        validation: {}
    };

    logActivity('invoice_upload', {
        mccqt: info.mccqt,
        invoiceNumber: info.so,
        itemCount: invoice.items.length,
        direction: direction,
        fileName: file.name
    });

    for (const line of lines) {
        const tokens = line.trim().split(/\s+/);
        const stt = tokens.shift();
        const typeToken = tokens.slice(0, 3).join(' ');
        const isDiscount = /Chiết khấu/i.test(typeToken);
        let type = isDiscount ? 'Chiết khấu thương mại' : 'Hàng hóa, dịch vụ';
        tokens.splice(0, 3);

        let name = '', qty = '0', price = '0', discount = '0', vat = info.taxRate + '%', total = '0', unit = '';

        if (isDiscount) {
            total = tokens.pop() || '0';
            vat = tokens.pop() || info.taxRate + '%';
            const lastThree = tokens.splice(-3);
            discount = lastThree[0] || '0';
            price = lastThree[1] || '0';
            qty = lastThree[2] || '0';
            name = tokens.join(' ');
        } else {
            const reversed = tokens.reverse();
            total = reversed.shift() || '0';
            vat = reversed.shift() || info.taxRate + '%';
            discount = reversed.shift() || '0';
            price = reversed.shift() || '0';
            qty = reversed.shift() || '0';

            for (let i = 0; i < reversed.length; i++) {
                if (/[a-zA-ZÀ-Ỵ]+/.test(reversed[i])) {
                    unit = reversed[i];
                    reversed.splice(i, 1);
                    break;
                }
            }
            name = reversed.reverse().join(' ');
        }

        name = name.replace(/^mại\s*/i, '').replace(/^vụ\s*/i, '');

        const quantity = normalizeNumber(qty);
        const unitPrice = normalizeNumber(price);
        const discountAmount = normalizeNumber(discount);
        const itemTotal = (quantity * unitPrice) - discountAmount;
        const vatRate = parseFloat(vat.replace('%', '')) / 100;
        const itemTax = itemTotal * vatRate;

        const item = {
            stt,
            type,
            name,
            unit,
            qty,
            price,
            discount,
            vat,
            total: formatMoney(itemTotal)
        };

        rows.push(item);
        invoice.items.push(item);

        if (type === 'Hàng hóa, dịch vụ') {
            updateInventory(businessId, item, direction, itemTotal, invoice.totalAmount);
        }
        if (direction === 'input') {
            invoice.netTotal += itemTotal;
            invoice.totalTax += itemTax;
            invoice.totalDiscount += discountAmount;
        }
    }

    invoice.items.sort((a, b) => normalizeNumber(a.stt) - normalizeNumber(b.stt));

    const calculatedTotal = invoice.netTotal + invoice.totalTax - invoice.totalDiscount;
    if (Math.abs(calculatedTotal - invoice.totalAmount) > 0.01) {
        const adjustment = invoice.totalAmount - calculatedTotal;
        invoice.netTotal += adjustment;
        console.warn(`Điều chỉnh netTotal cho invoice ${invoice.id} với sai số: ${adjustment}`);
    }

    invoice.validation = compareInvoiceTotals(invoice, info);

    invoices.push(invoice);
    invoices.sort((a, b) => a.mccqt.localeCompare(b.mccqt));

    localStorage.setItem('invoices', JSON.stringify(invoices));

    const invoiceInfo = document.getElementById('invoiceInfo');
    if (invoiceInfo) {
        invoiceInfo.innerText = `
            🧾 HÓA ĐƠN: ${info.kyhieu} - ${info.so}
            🔐 Mã MCCQT: ${info.mccqt}
            📅 Ngày: ${info.date}
            💰 Thuế suất: ${info.taxRate}% | Tổng thuế: ${formatMoney(info.totalTax)}
            Tổng hóa đơn: ${formatMoney(invoice.totalAmount)}

            👤 NGƯỜI MUA:
            - Tên: ${info.tenMua}
            - MST: ${info.mstMua}
            - Địa chỉ: ${info.diachiMua}

            🏢 NGƯỜI BÁN:
            - Tên: ${info.tenBan}
            - MST: ${info.mstBan}
            - Địa chỉ: ${info.diachiBan}
        `;
    }

    //showToast(`Đã xử lý thành công hóa đơn MCCQT ${info.mccqt}`, 'success');
}

async function processZipFile(zipFile, businessId, direction) {
    try {
        const zip = new JSZip();
        const files = await zip.loadAsync(zipFile);
        let successCount = 0;
        let skipCount = 0;

        for (const [fileName, file] of Object.entries(files.files)) {
            if (fileName.endsWith('.html')) {
                console.log(`[${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] Xử lý file: ${fileName}`);
                const htmlContent = await file.async('string');
                const info = extractInvoiceInfoFromHTML(htmlContent, businessId);

                if (!info) {
                    skipCount++;
                    continue;
                }

                if (invoices.some(i => i.mccqt === info.mccqt && i.businessId === businessId)) {
                    //showToast(`Hóa đơn với MCCQT ${info.mccqt} trong ${fileName} đã tồn tại, bỏ qua.`, 'error');
                    skipCount++;
                    continue;
                }

                parseToTable(businessId, new File([htmlContent], fileName, { type: 'text/html' }), info, direction);
                successCount++;
            }
        }

        //showToast(`Hoàn tất xử lý file ZIP: ${successCount} hóa đơn thành công, ${skipCount} hóa đơn bị bỏ qua.`, successCount > 0 ? 'success' : 'info');
        console.log(`[${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] Hoàn tất xử lý file ZIP: ${successCount} thành công, ${skipCount} bỏ qua.`);
    } catch (e) {
        console.error(`[${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] Lỗi xử lý file ZIP:`, e);
        //showToast(`Lỗi khi xử lý file ZIP: ${e.message}`, 'error');
    }
}




// =============================================
function classifyBusinesses() {
    try {
        // Tách HKD mặc định và HKD thường
        const defaultBusiness = businesses.find(b => b.id === DEFAULT_BUSINESS_ID);
        const normalBusinesses = businesses.filter(b => b.id !== DEFAULT_BUSINESS_ID);

        // Sắp xếp HKD thường theo tên
        normalBusinesses.sort((a, b) => a.name.localeCompare(b.name, 'vi-VN'));

        // Kết hợp lại: HKD mặc định đầu tiên (nếu có), sau đó là các HKD thường
        businesses = defaultBusiness ? [defaultBusiness, ...normalBusinesses] : normalBusinesses;

        localStorage.setItem('businesses', JSON.stringify(businesses));
        updateBusinessList();

        return businesses;
    } catch (e) {
        console.error('Lỗi classifyBusinesses:', e);
        return businesses;
    }
}

function moveBusinessToTop(businessId) {
    try {
        const index = businesses.findIndex(b => b.id === businessId);
        if (index > -1) {
            const [business] = businesses.splice(index, 1);
            businesses.unshift(business);
            localStorage.setItem('businesses', JSON.stringify(businesses));
        }
    } catch (e) {
        console.error('Lỗi moveBusinessToTop:', e);
    }
}

function showBusinessInventory(businessId) {
    try {
        const inventoryTab = document.getElementById('inventoryTab');
        if (!inventoryTab) {
            console.error('Không tìm thấy #inventoryTab trong DOM');
            return;
        }

        const inv = inventory.filter(i => i.businessId === businessId);
        inv.sort((a, b) => a.name.localeCompare(b.name, 'vi-VN'));

        let totalQty = 0, totalMoney = 0;
        inv.forEach(i => {
            i.vat = i.vat || '10%';
            const vatRate = parseFloat(i.vat.replace('%', '')) / 100;
            const price = normalizeNumber(i.price);
            const qty = normalizeNumber(i.qty);
            const taxAmount = price * vatRate * qty;
            i.total = formatMoney(qty * price);
            i.taxAmount = formatMoney(taxAmount);
            i.totalAfterTax = formatMoney((price * qty) + taxAmount);
            totalQty += qty;
            totalMoney += (price * qty) + taxAmount;
            console.log('Hiển thị item:', { id: i.id, name: i.name, price: i.price, giaBan: i.giaBan });
        });

        const warnings = checkInventoryWarnings(inv);

        inventoryTab.innerHTML = `
            <div class="section">
                <h4>Tồn kho (${inv.length} sản phẩm)</h4>
                <div class="summary">
                    <p>${formatMoney(totalMoney)} VND | ${formatMoney(totalQty)} đơn vị</p>
                    <div class="warnings ${warnings.includes('⚠️') ? 'warning' : 'success'}">
                        ${warnings}
                    </div>
                </div>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>STT</th><th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng</th>
                            <th>Đơn giá</th><th>Giá bán</th><th>Thuế suất</th>
                            <th>Thành tiền</th><th>ST thuế</th><th>TT sau thuế</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.map((i, index) => `
                            <tr data-item-id="${i.id}" class="${i.isEditing ? 'editing' : ''}">
                                <td>${index + 1}</td>
                                <td data-field="name" ${i.isEditing ? 'contenteditable="true"' : ''}>${i.name}</td>
                                <td data-field="unit" ${i.isEditing ? 'contenteditable="true"' : ''}>${i.unit}</td>
                                <td data-field="qty" ${i.isEditing ? 'contenteditable="true"' : ''}>${i.qty}</td>
                                <td data-field="price" ${i.isEditing ? 'contenteditable="true"' : ''}>${formatMoney(i.price)}</td>
                                <td data-field="giaBan" ${i.isEditing ? 'contenteditable="true"' : ''}>${i.giaBan || formatMoney(calculateSellingPrice(normalizeNumber(i.price)))}</td>
                                <td data-field="vat" ${i.isEditing ? 'contenteditable="true"' : ''}>${i.vat}</td>
                                <td>${i.total}</td>
                                <td>${i.taxAmount}</td>
                                <td>${i.totalAfterTax}</td>
                                <td>
                                    ${i.isEditing ? `
                                        <button onclick="saveOrCancelInventoryItem('${i.id}', '${businessId}', 'save')">💾</button>
                                        <button onclick="saveOrCancelInventoryItem('${i.id}', '${businessId}', 'cancel')">❌</button>
                                    ` : `
                                        <button onclick="editInventoryItem('${i.id}', '${businessId}')">✏️</button>
                                        <button onclick="insertInventoryItem('${businessId}', '${i.id}')">➕</button>
                                        <button onclick="deleteInventoryItem('${i.id}', '${businessId}')">🗑️</button>
                                    `}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Lỗi showBusinessInventory:', e);
    }
}

function updateBusinessList(selectedId = null) {
    const businessList = document.getElementById('businessList');
    if (!businessList) {
        console.error('Không tìm thấy #businessList trong DOM');
        return;
    }

    try {
        // Sắp xếp: HKD đang làm việc lên đầu, các HKD khác theo thứ tự bình thường
        const sortedBusinesses = [...businesses].sort((a, b) => {
            if (a.id === lastActiveBusinessId) return -1;
            if (b.id === lastActiveBusinessId) return 1;
            return 0;
        });

        businessList.innerHTML = '<ul>' + sortedBusinesses.map(b => `
            <li class="${b.id === lastActiveBusinessId ? 'active' : ''}" 
                onclick="showBusinessDetails('${b.id}'); updateSelectedBusinessId('${b.id}')">
                ${b.name} (MST: ${b.taxCode}) 
                <button onclick="deleteBusiness('${b.id}', event)">Xóa</button>
            </li>
        `).join('') + '</ul>';

        localStorage.setItem('businesses', JSON.stringify(businesses));
    } catch (e) {
        console.error('Lỗi updateBusinessList:', e);
    }
}
function updateSelectedBusiness(invoiceId) {
    const select = document.getElementById('businessSelect');
    const selectedBusinessId = select.value;
    if (selectedBusinessId) {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (invoice && invoice.businessId !== selectedBusinessId) {
            transferInvoice(invoiceId, invoice.businessId, selectedBusinessId);
        }
    }
}
function updateSelectedBusinessId(businessId) {
    selectedBusinessId = businessId;
    console.log('Selected business ID updated to:', selectedBusinessId); // For debugging
}

// xóa hkd
function deleteBusiness(businessId, event) {
    event.stopPropagation();
    try {
        if (confirm('Bạn có chắc muốn xóa Hộ Kinh Doanh này? Tất cả dữ liệu liên quan (hóa đơn, tồn kho) cũng sẽ bị xóa.')) {
            // LƯU TRẠNG THÁI HIỆN TẠI TRƯỚC KHI XÓA
            const currentState = saveCurrentState();

            // Xóa tất cả dữ liệu liên quan
            invoices = invoices.filter(i => i.businessId !== businessId);
            inventory = inventory.filter(i => i.businessId !== businessId);
            exportedInvoices = exportedInvoices.filter(i => i.businessId !== businessId);

            // Xóa HKD khỏi danh sách
            businesses = businesses.filter(b => b.id !== businessId);

            // Cập nhật localStorage
            localStorage.setItem('businesses', JSON.stringify(businesses));
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('inventory', JSON.stringify(inventory));
            localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

            // Cập nhật giao diện
            updateBusinessList();
            document.getElementById('businessDetails').innerHTML = '<h4>Quản lý Hộ Kinh Doanh</h4>';
            alert('Đã xóa Hộ Kinh Doanh và tất cả dữ liệu liên quan!');

            // GHI LOG
            logActivity('business_delete', {
                businessId: businessId,
                businessName: businesses.find(b => b.id === businessId)?.name || 'Đã xóa'
            });
        }
    } catch (e) {
        console.error('Lỗi deleteBusiness:', e);
        alert('Lỗi khi xóa Hộ Kinh Doanh: ' + e.message);
    }
}

function showActivityLogPopup() {
    try {
        const existingPopup = document.getElementById('activityLogPopup');
        if (existingPopup) {
            existingPopup.remove();
            return;
        }
        const filteredLogs = selectedBusinessId
            ? activityLogs.filter(log => log.businessId === selectedBusinessId)
            : activityLogs;
        const popupContent = `
            <div class="popup-content" style="background: #fff; padding: 20px; border-radius: 8px; max-width: 90%; max-height: 90%; overflow: auto; position: relative; margin: 0 auto;">
                <span class="close-popup" style="position: absolute; top: 10px; right: 10px; background: #ff4444; color: #fff; border: none; border-radius: 3px; cursor: pointer; padding: 5px 10px; font-size: 16px; line-height: 1;" onclick="closePopup('activityLogPopup')">×</span>
                <h3>Lịch sử hoạt động</h3>
                <div class="log-controls" style="margin-bottom: 10px;">
                    <button onclick="exportLogsToExcel()">📤 Xuất Excel</button>
                    <button onclick="clearActivityLogs()">🗑️ Xóa lịch sử</button>
                </div>
                <div class="log-container" style="max-height: 70vh; overflow-y: auto;">
                    <table class="log-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">Thời gian</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">Hành động</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredLogs.map(log => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${new Date(log.timestamp).toLocaleString('vi-VN')}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${getActionDescription(log.action)}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${getActionDetails(log.details)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.id = 'activityLogPopup';
        popup.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 999; display: flex; justify-content: center; align-items: center;';
        popup.innerHTML = popupContent;
        document.body.appendChild(popup);
        popup.addEventListener('click', function (e) {
            if (e.target === popup) {
                closePopup('activityLogPopup');
            }
        });
    } catch (e) {
        console.error('Lỗi showActivityLogPopup:', e);
        alert('Lỗi khi hiển thị lịch sử hoạt động: ' + e.message);
    }
}
function closePopup() {
    const popup = document.getElementById('activityLogPopup');
    if (popup) {
        popup.remove();
    }
}

// =============================================
// 5. QUẢN LÝ TỒN KHO (INVENTORY)
// =============================================
function updateInventory(businessId, item, direction) {
    try {
        const invItem = inventory.find(i => i.businessId === businessId && i.name === item.name);
        const qtyChange = normalizeNumber(item.qty) * (direction === 'input' ? 1 : -1);
        const vat = item.vat || '10%';
        const vatRate = parseFloat(vat.replace('%', '')) / 100;

        const percentage = parseFloat(localStorage.getItem('sellingPricePercentage')) || 0.10;
        const fixedAmount = parseFloat(localStorage.getItem('sellingPriceFixedAmount')) || 3000;
        console.log('updateInventory:', { businessId, itemName: item.name, direction, percentage, fixedAmount });

        if (invItem) {
            invItem.qty = normalizeNumber(invItem.qty) + qtyChange;
            invItem.price = item.price;
            invItem.discount = item.discount || '0';
            invItem.vat = vat;

            const price = normalizeNumber(invItem.price);
            const qty = normalizeNumber(invItem.qty);
            const taxAmount = price * vatRate * qty;

            invItem.total = formatMoney(qty * price);
            invItem.taxAmount = formatMoney(taxAmount);
            invItem.totalAfterTax = formatMoney((price * qty) + taxAmount);
            invItem.giaBan = formatMoney(calculateSellingPrice(price));
            invItem.lastUpdated = new Date().toISOString();
            console.log('Cập nhật item tồn kho:', { id: invItem.id, name: invItem.name, giaBan: invItem.giaBan });

            if (invItem.qty <= 0) {
                inventory = inventory.filter(i => i.id !== invItem.id);
            }
        } else if (qtyChange > 0) {
            const basePrice = normalizeNumber(item.price);
            const qty = qtyChange;
            const taxAmount = basePrice * vatRate * qty;

            const newItem = {
                id: generateUUID(),
                businessId,
                stt: item.stt || (inventory.length + 1).toString(),
                type: item.type || 'Hàng hóa, dịch vụ',
                name: item.name,
                unit: item.unit,
                qty: qty.toString(),
                price: item.price,
                discount: item.discount || '0',
                vat: vat,
                total: formatMoney(qty * basePrice),
                taxAmount: formatMoney(taxAmount),
                totalAfterTax: formatMoney((basePrice * qty) + taxAmount),
                giaBan: formatMoney(calculateSellingPrice(basePrice)),
                lastUpdated: new Date().toISOString()
            };
            inventory.push(newItem);
            console.log('Thêm item mới vào tồn kho:', { id: newItem.id, name: newItem.name, giaBan: newItem.giaBan });
        }

        localStorage.setItem('inventory', JSON.stringify(inventory));

        logActivity('inventory_update', {
            businessId,
            itemName: item.name,
            direction,
            qtyChange,
            percentage,
            fixedAmount
        });
    } catch (e) {
        console.error('Lỗi updateInventory:', e);
    }
}

function checkInventoryWarnings(inventory) {
    try {
        const warnings = [];
        inventory.forEach(item => {
            if (item.qty < 0) {
                warnings.push(`⚠️ ${item.name} tồn kho âm (${item.qty})`);
            } else if (item.qty < 5) {
                warnings.push(`⚠️ ${item.name} sắp hết (còn ${item.qty})`);
            }
        });
        return warnings.length ? warnings.join('<br>') : '🟢 Tồn kho ổn định';
    } catch (e) {
        console.error('Lỗi checkInventoryWarnings:', e);
        return 'Lỗi kiểm tra tồn kho';
    }
}

function deleteInventoryItem(itemId, businessId) {
    try {
        if (confirm('Bạn có chắc muốn xóa mục tồn kho này?')) {
            inventory = inventory.filter(i => i.id !== itemId);
            localStorage.setItem('inventory', JSON.stringify(inventory));
            console.log('Đã xóa mục tồn kho:', itemId);
            showBusinessDetails(businessId);
            showPriceList(businessId);
            showExportHistory(businessId);
        }
    } catch (e) {
        console.error('Lỗi deleteInventoryItem:', e);
        alert('Lỗi khi xóa mục tồn kho: ' + e.message);
    }
}

function editInventoryItem(itemId, businessId) {
    try {
        saveCurrentState();
        // Reset trạng thái chỉnh sửa cho tất cả items trước
        inventory.forEach(item => {
            item.isEditing = item.id === itemId;
        });

        localStorage.setItem('inventory', JSON.stringify(inventory));

        // Cập nhật giao diện
        showBusinessInventory(businessId);

        // Tự động focus vào ô đầu tiên có thể chỉnh sửa
        setTimeout(() => {
            const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
            if (row) {
                const firstEditableCell = row.querySelector('[contenteditable="true"]');
                if (firstEditableCell) {
                    firstEditableCell.focus();
                }
            }
        }, 100);
    } catch (e) {
        console.error('Lỗi editInventoryItem:', e);
        alert('Lỗi khi chỉnh sửa mục tồn kho: ' + e.message);
    }
}

function saveOrCancelInventoryItem(itemId, businessId, action) {
    try {
        const item = inventory.find(i => i.id === itemId);
        if (!item) {
            console.error(`Không tìm thấy mục tồn kho với ID ${itemId}`);
            return;
        }
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        if (!row) {
            console.error(`Không tìm thấy hàng với data-item-id ${itemId}`);
            return;
        }
        if (action === 'save') {
            const fields = {
                name: row.querySelector('td[data-field="name"]').textContent.trim() || 'Hàng hóa mới',
                unit: row.querySelector('td[data-field="unit"]').textContent.trim() || 'Cái',
                qty: row.querySelector('td[data-field="qty"]').textContent.trim() || '0',
                price: row.querySelector('td[data-field="price"]').textContent.trim() || '0',
                vat: row.querySelector('td[data-field="vat"]').textContent.trim() || '10%'
            };

            if (!fields.name || isNaN(normalizeNumber(fields.qty)) || isNaN(normalizeNumber(fields.price))) {
                alert('Vui lòng nhập đầy đủ Tên hàng hóa, Số lượng và Đơn giá hợp lệ!');
                return;
            }

            fields.vat = fields.vat.includes('%') ? fields.vat : `${fields.vat}%`;
            fields.price = normalizeNumber(fields.price).toString();

            const oldQty = normalizeNumber(item.qty);
            const qtyChange = normalizeNumber(fields.qty) - oldQty;
            const vatRate = parseFloat(fields.vat.replace('%', '')) / 100;
            const price = normalizeNumber(fields.price);
            const qty = normalizeNumber(fields.qty);
            const taxAmount = price * vatRate * qty;

            Object.assign(item, fields);
            item.total = formatMoney(qty * price);
            item.taxAmount = formatMoney(taxAmount);
            item.totalAfterTax = formatMoney((price * qty) + taxAmount);
            item.isEditing = false;
            item.lastUpdated = new Date().toISOString();

            logActivity('inventory_update', {
                itemId: itemId,
                businessId: businessId,
                action: 'edit',
                name: fields.name,
                oldQty: oldQty,
                newQty: fields.qty,
                price: fields.price
            });

            localStorage.setItem('inventory', JSON.stringify(inventory));

        } else {
            item.isEditing = false;
        }
        showBusinessDetails(businessId);
    } catch (e) {
        console.error('Lỗi saveOrCancelInventoryItem:', e);
        alert('Lỗi khi lưu mục tồn kho: ' + e.message);
    }
}
function insertInventoryItem(businessId, afterId) {
    try {
        const afterItem = inventory.find(i => i.id === afterId);
        const index = inventory.findIndex(i => i.id === afterId);
        const newItem = {
            id: generateUUID(),
            businessId,
            stt: (parseInt(afterItem?.stt || '0') + 1).toString(),
            type: 'Hàng hóa, dịch vụ',
            name: afterItem?.name || 'Hàng mới',
            unit: afterItem?.unit || 'Cái',
            qty: afterItem?.qty || '0',
            price: afterItem?.price || '0',
            discount: '0',
            vat: afterItem?.vat || '10%',
            total: afterItem?.total || '0',
            isEditing: true,
            lastUpdated: new Date().toISOString()
        };
        inventory.splice(index + 1, 0, newItem);
        inventory.forEach((item, idx) => item.stt = (idx + 1).toString());
        localStorage.setItem('inventory', JSON.stringify(inventory));
        showBusinessDetails(businessId);
        setTimeout(() => {
            const newRow = document.querySelector(`tr[data-item-id="${newItem.id}"]`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newRow.classList.add('new-item');
                setTimeout(() => newRow.classList.remove('new-item'), 2000);
            }
        }, 0);
    } catch (e) {
        console.error('Lỗi insertInventoryItem:', e);
        alert('Lỗi khi thêm mục tồn kho: ' + e.message);
    }
}



// Cập nhật hàm editInvoiceItem để hỗ trợ focus tốt hơn
function editInvoiceItem(invoiceId, itemIndex) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) return;

        // Reset trạng thái chỉnh sửa
        invoice.items.forEach(item => {
            item.isEditing = false;
        });

        // Bật chế độ chỉnh sửa cho item được chọn
        invoice.items[itemIndex].isEditing = true;
        localStorage.setItem('invoices', JSON.stringify(invoices));

        // Hiển thị lại
        showInvoiceDetails(invoiceId);

        // Focus vào ô đầu tiên có thể chỉnh sửa (cải tiến)
        setTimeout(() => {
            const popup = document.querySelector('.popup');
            if (popup) {
                const editableCell = popup.querySelector(`tr[data-item-index="${itemIndex}"] [contenteditable="true"]`);
                if (editableCell) {
                    editableCell.focus();

                    // Chọn toàn bộ nội dung để dễ sửa
                    const range = document.createRange();
                    range.selectNodeContents(editableCell);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }, 100);
    } catch (e) {
        console.error('Lỗi editInvoiceItem:', e);
    }
}
function restoreInvoiceToSuccess(invoiceId) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }

        // Đặt trạng thái thành công (white) bằng cách sửa dữ liệu nếu cần
        // Hiện tại, chỉ cập nhật giao diện, không thay đổi dữ liệu thực tế
        const popup = document.querySelector('.popup');
        if (popup) {
            const rows = popup.querySelectorAll('tr.error-row, tr.warning-row');
            rows.forEach(row => {
                row.classList.remove('error-row', 'warning-row');
            });

            alert('Hóa đơn đã được khôi phục sang trạng thái thành công!');
        }

        console.log(`Hóa đơn ${invoiceId} đã được khôi phục sang trạng thái thành công.`);
    } catch (e) {
        console.error('Lỗi restoreInvoiceToSuccess:', e);
        alert('Lỗi khi khôi phục hóa đơn: ' + e.message);
    }
}
// Các hàm xử lý action
function editInvoiceItem(invoiceId, itemIndex) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }
        invoice.items.forEach((item, idx) => {
            item.isEditing = idx === itemIndex;
        });
        console.log('Set isEditing for item at index:', itemIndex, 'Invoice:', invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        showInvoiceDetails(invoiceId);
    } catch (e) {
        console.error('Lỗi editInvoiceItem:', e);
        alert('Lỗi khi chỉnh sửa mục hóa đơn: ' + e.message);
    }
}

function insertInvoiceItem(invoiceId, afterIndex) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }
        const afterItem = invoice.items[afterIndex];
        const newItem = {
            id: generateUUID(),
            stt: (parseInt(afterItem?.stt || '0') + 1).toString(),
            type: 'Hàng hóa, dịch vụ',
            name: afterItem?.name || 'Hàng mới',
            unit: afterItem?.unit || 'Cái',
            qty: afterItem?.qty || '0',
            price: afterItem?.price || '0',
            discount: afterItem?.discount || '0',
            vat: afterItem?.vat || invoice.taxRate + '%',
            total: afterItem?.total || '0',
            isEditing: true,
            lastUpdated: new Date().toISOString()
        };

        invoice.items.splice(afterIndex + 1, 0, newItem);
        invoice.items.forEach((item, idx) => item.stt = (idx + 1).toString());

        if (invoice.direction === 'input') {
            updateInventory(invoice.businessId, newItem, invoice.direction);
        }

        invoice.netTotal = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            return sum + (qty * price - discount);
        }, 0);

        invoice.totalTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            return sum + ((qty * price - discount) * vatRate);
        }, 0);

        invoice.totalDiscount = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.discount || '0'), 0);

        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('inventory', JSON.stringify(inventory));

        showInvoiceDetails(invoiceId);

        setTimeout(() => {
            const newRow = document.querySelector(`tr[data-item-index="${afterIndex + 1}"]`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newRow.classList.add('new-item');
                setTimeout(() => newRow.classList.remove('new-item'), 2000);
            } else {
                console.error(`Không tìm thấy hàng mới với data-item-index="${afterIndex + 1}"`);
            }
        }, 100);
    } catch (e) {
        console.error('Lỗi insertInvoiceItem:', e);
        alert('Lỗi khi thêm mục hóa đơn: ' + e.message);
    }
}

function addInvoiceItem(invoiceId) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }

        const newItem = {
            id: generateUUID(),
            stt: (invoice.items.length + 1).toString(),
            type: 'Hàng hóa, dịch vụ',
            name: 'Hàng mới',
            unit: 'Cái',
            qty: '1',
            price: '0',
            discount: '0',
            vat: invoice.taxRate + '%',
            total: '0',
            isEditing: true,
            lastUpdated: new Date().toISOString()
        };

        invoice.items.push(newItem);

        if (invoice.direction === 'input') {
            updateInventory(invoice.businessId, newItem, invoice.direction);
        }

        invoice.netTotal = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            return sum + (qty * price - discount);
        }, 0);

        invoice.totalTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            return sum + ((qty * price - discount) * vatRate);
        }, 0);

        invoice.totalDiscount = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.discount || '0'), 0);

        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('inventory', JSON.stringify(inventory));

        showInvoiceDetails(invoiceId);

        setTimeout(() => {
            const newRow = document.querySelector(`tr[data-item-index="${invoice.items.length - 1}"]`);
            if (newRow) {
                newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newRow.classList.add('new-item');
                setTimeout(() => newRow.classList.remove('new-item'), 2000);
            } else {
                console.error(`Không tìm thấy hàng mới với data-item-index="${invoice.items.length - 1}"`);
            }
        }, 100);
    } catch (e) {
        console.error('Lỗi addInvoiceItem:', e);
        alert('Lỗi khi thêm mục hóa đơn: ' + e.message);
    }
}



function deleteInvoiceItem(invoiceId, itemIndex) {
    try {
        if (!confirm('Bạn có chắc muốn xóa mục hóa đơn này?')) return;

        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            return;
        }

        const item = invoice.items[itemIndex];
        if (!item) {
            console.error(`Không tìm thấy mục hóa đơn tại index ${itemIndex}`);
            return;
        }

        if (item.type === 'Hàng hóa, dịch vụ') {
            updateInventory(invoice.businessId, {
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                price: item.price,
                discount: item.discount,
                vat: item.vat,
                total: item.total
            }, invoice.direction === 'input' ? 'output' : 'input');
        }

        invoice.items.splice(itemIndex, 1);
        invoice.items.forEach((item, idx) => item.stt = (idx + 1).toString());

        // Tính toán lại tổng
        invoice.netTotal = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            return sum + (qty * price - discount);
        }, 0);

        invoice.totalTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            return sum + ((qty * price - discount) * vatRate);
        }, 0);

        invoice.totalDiscount = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.discount || '0'), 0);

        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('inventory', JSON.stringify(inventory));

        showInvoiceDetails(invoiceId);
        showBusinessDetails(invoice.businessId);
        showPriceList(invoice.businessId);
        showExportHistory(invoice.businessId);
    } catch (e) {
        console.error('Lỗi deleteInvoiceItem:', e);
        alert('Lỗi khi xóa mục hóa đơn: ' + e.message);
    }
}



function setupMagnifier() {
    const pdfContainer = document.querySelector('.pdf-container');
    const iframe = pdfContainer.querySelector('iframe');
    const magnifier = pdfContainer.querySelector('.magnifier');
    if (!pdfContainer || !iframe || !magnifier) return;

    pdfContainer.addEventListener('mousemove', (e) => {
        const rect = iframe.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            magnifier.style.display = 'block';
            magnifier.style.left = `${x - 50}px`;
            magnifier.style.top = `${y - 50}px`;
            magnifier.style.backgroundImage = `url(${iframe.src})`;
            magnifier.style.backgroundSize = `${rect.width * 2}px ${rect.height * 2}px`;
            magnifier.style.backgroundPosition = `-${x * 2 - 50}px -${y * 2 - 50}px`;
        } else {
            magnifier.style.display = 'none';
        }
    });

    pdfContainer.addEventListener('mouseleave', () => {
        magnifier.style.display = 'none';
    });
}
function filterInvoices(filterType, businessId) {
    try {
        let filtered = invoices.filter(i => i.businessId === businessId);

        if (filterType === 'input') {
            filtered = filtered.filter(i => i.direction === 'input');
        } else if (filterType === 'output') {
            filtered = filtered.filter(i => i.direction === 'output');
        }

        filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        const invoicesTab = document.getElementById('invoicesTab');
        if (!invoicesTab) return;

        const tbody = invoicesTab.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = filtered.map(invoice => {
                const statusColor = checkInvoice(invoice);
                const totalQuantity = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0);
                const totalCost = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.total), 0);
                const totalSelling = invoice.items.reduce((sum, item) => {
                    const sellingPrice = calculateSellingPrice(normalizeNumber(item.price));
                    return sum + (normalizeNumber(item.qty) * sellingPrice);
                }, 0);

                return `
                    <tr style="background-color: ${statusColor}">
                        <td>${invoice.series}-${invoice.number}</td>
                        <td>${invoice.mccqt}</td>
                        <td>${formatMoney(totalQuantity)}</td>
                        <td>${formatMoney(totalCost)}</td>
                        <td>${formatMoney(totalSelling)}</td>
                        <td>${getStatusIcon(statusColor)}</td>
                        <td class="actions">
                            <button onclick="showInvoiceDetails('${invoice.id}')">📄 Xem</button>
                            <button onclick="deleteInvoice('${invoice.id}', event)">🗑️ Xóa</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (e) {
        console.error('Lỗi filterInvoices:', e);
    }
}

// Thêm nút vào HTML (nếu chưa có)
document.getElementById('invoicesTab').innerHTML = `
  <div class="section">
    <div class="filter-buttons">
      <button onclick="filterInvoices('error')">Hóa đơn lỗi</button>
      <button onclick="filterInvoices('zero')">Hóa đơn 0đ</button>
      <button onclick="filterInvoices('all')">Tất cả</button>
    </div>
    <!-- Nội dung bảng sẽ được showInvoicesTab hoặc filterInvoices lấp đầy -->
  </div>
` + document.getElementById('invoicesTab').innerHTML;

// Biến toàn cục
let currentFilterType = 'all';


// Hàm hiển thị chi tiết hóa đơn, thêm nút Cập nhật cho Số hóa đơn và MCCQT

function updateMismatchFilter() {
    try {
        const mismatchList = document.getElementById('mismatchList');
        if (mismatchList) {
            const mismatchedInvoices = invoices.filter(i => !i.validation.isMatch);
            mismatchList.innerHTML = `
                <h4>Hóa đơn có chênh lệch</h4>
                ${mismatchedInvoices.map(i => `
                    <div class="mismatch-item ${i.validation.colorClass}" onclick="showInvoiceDetails('${i.id}')">
                        ${i.series} - ${i.number}: Chênh lệch ${formatMoney(i.validation.difference)}
                    </div>
                `).join('')}
            `;
        }
    } catch (e) {
        console.error('Lỗi updateMismatchFilter:', e);
    }
}
// Hàm lưu thay đổi Số hóa đơn và MCCQT
// Hàm lưu thay đổi hóa đơn - chỉ chỉnh sửa MCCQT


// Hàm tải danh sách hóa đơn
function loadInvoiceList(businessId, filterType = 'all') {
    try {
        let filtered = invoices.filter(i => i.businessId === businessId);

        // Áp dụng bộ lọc
        switch (filterType) {
            case 'valid':
                filtered = filtered.filter(inv => checkInvoiceStatus(inv) === 'valid');
                break;
            case 'warning':
                filtered = filtered.filter(inv => checkInvoiceStatus(inv) === 'warning');
                break;
            case 'error':
                filtered = filtered.filter(inv => checkInvoiceStatus(inv) === 'error');
                break;
            case 'unknown':
                filtered = filtered.filter(inv => checkInvoiceStatus(inv) === 'unknown');
                break;
            case 'mismatch':
                filtered = filtered.filter(inv => checkInvoiceStatus(inv) === 'mismatch');
                break;
            // 'all' không lọc
        }

        // Sắp xếp theo ngày mới nhất
        filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        // Hiển thị kết quả
        const container = document.getElementById('invoiceListContainer');
        if (container) {
            container.innerHTML = renderInvoiceList(filtered);
        }
    } catch (e) {
        console.error('Lỗi loadInvoiceList:', e);
    }
}

function filterInvoicesByType(type, businessId) {
    try {
        currentFilterType = type;
        loadInvoiceList(businessId, type);
        const buttons = document.querySelectorAll('.filter-buttons button');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === getButtonText(type)) {
                btn.classList.add('active');
            }
        });
        logActivity('filter_invoices', { businessId, filterType: type });
    } catch (e) {
        console.error('Lỗi filterInvoicesByType:', e);
    }
}


// Các hàm khác (giữ nguyên)
function showInvoicesTab(businessId) {
    try {
        const invoicesTab = document.getElementById('invoicesTab');
        if (!invoicesTab) return;

        invoicesTab.innerHTML = `
            <div class="section">
                <h4>Danh sách hóa đơn</h4>
                <div class="invoice-controls">
                    <div class="filter-buttons">
                        <button class="${currentFilterType === 'all' ? 'active' : ''}" onclick="filterInvoicesByType('all', '${businessId}')">Tất cả</button>
                        <button class="${currentFilterType === 'valid' ? 'active' : ''}" onclick="filterInvoicesByType('valid', '${businessId}')">HĐ hợp lệ</button>
                        <button class="${currentFilterType === 'warning' ? 'active' : ''}" onclick="filterInvoicesByType('warning', '${businessId}')">HĐ cảnh báo</button>
                        <button class="${currentFilterType === 'error' ? 'active' : ''}" onclick="filterInvoicesByType('error', '${businessId}')">HĐ lỗi</button>
                        <button class="${currentFilterType === 'unknown' ? 'active' : ''}" onclick="filterInvoicesByType('unknown', '${businessId}')">HĐ không rõ</button>
                        <button class="${currentFilterType === 'mismatch' ? 'active' : ''}" onclick="filterInvoicesByType('mismatch', '${businessId}')">Lệch</button>
                    </div>
                    <div class="search-box">
                        <input type="text" id="invoiceSearchInput" placeholder="Tìm theo số HĐ, MCCQT...">
                        <button onclick="searchInvoices('${businessId}')">🔍 Tìm kiếm</button>
                        <button onclick="showAdvancedSearch('${businessId}')">🎚️ Tìm nâng cao</button>
                    </div>
                </div>
                <div id="invoiceListContainer">
                    <!-- Nội dung hóa đơn sẽ được tải ở đây -->
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .valid-row { background-color: #e6ffe6; }
            .warning-row { background-color: #fff3cd; }
            .error-row { background-color: #ffcccc; }
            .unknown-row { background-color: #ffe6e6; }
            .mismatch-row { background-color: #fff0f0; border: 2px solid #ff9999; } /* Màu nhạt đỏ cho "Lệch" */
            .filter-buttons button {
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                background-color: #4CAF50;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                margin-right: 5px;
            }
            .filter-buttons button.active {
                background-color: #2196F3;
            }
            .filter-buttons button:hover {
                background-color: #45a049;
            }
            .filter-buttons button.active:hover {
                background-color: #1976D2;
            }
            .invoice-controls {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            .search-box {
                display: flex;
                gap: 10px;
            }
        `;
        document.head.appendChild(style);

        loadInvoiceList(businessId, currentFilterType);
    } catch (e) {
        console.error('Lỗi showInvoicesTab:', e);
    }
}


// Hàm kiểm tra trạng thái hóa đơn - đã sửa
function checkInvoiceStatus(invoice) {
    try {
        // Kiểm tra "Lệch": chênh lệch ≥ 5 đồng giữa totalAmount và tổng trích xuất
        const info = { totalAmount: invoice.totalAmount, taxRate: invoice.taxRate };
        const comparison = compareInvoiceTotals(invoice, info);
        if (comparison.difference >= 5) {
            return 'mismatch';
        }

        // Kiểm tra "Lỗi": DVT rỗng hoặc chứa số, số lượng rỗng hoặc không phải định dạng số
        if (invoice.items.some(item => {
            const hasNumberInUnit = !item.unit || /\d/.test(item.unit.trim()); // DVT rỗng hoặc chứa số
            const hasInvalidQty = !item.qty || !/^\d+(?:,\d+)?$/.test(item.qty.toString().replace(/\s/g, '')); // Số lượng rỗng hoặc không hợp lệ
            const hasLetterInQty = item.qty && /[a-zA-ZÀ-Ỵ]/.test(item.qty); // Số lượng chứa chữ
            return hasNumberInUnit || hasInvalidQty || hasLetterInQty;
        })) {
            return 'red';
        }

        // Kiểm tra "Cảnh báo": giá bán hoặc thành tiền bằng 0
        if (invoice.items.some(item => {
            const price = normalizeNumber(item.price); // Chuẩn hóa giá bán
            const total = normalizeNumber(item.total); // Chuẩn hóa thành tiền
            return price === 0 || total === 0;
        })) {
            return 'yellow';
        }

        // Kiểm tra "Thiếu": cả mccqt và seller.taxCode đều thiếu hoặc là "Không rõ"
        if ((invoice.mccqt === 'Không rõ' || !invoice.mccqt) && (invoice.seller.taxCode === 'Không rõ' || !invoice.seller.taxCode)) {
            return 'unknown';
        }

        // Trạng thái "Hợp lệ": nếu không có lỗi, thiếu, lệch, hoặc cảnh báo
        return 'white';
    } catch (e) {
        console.error('Lỗi checkInvoiceStatus:', e);
        return 'red';
    }
}
function checkInvoiceItem(item) {
    if (!item.unit || /\d/.test(item.unit.trim())) return true;
    if (!item.qty || !/^\d+(?:,\d+)?$/.test(item.qty.toString().replace(/\s/g, ''))) return true;
    if (normalizeNumber(item.total) === 0) return true;
    return false;
}

function getStatusIcon(statusColor) {
    switch (statusColor) {
        case 'white': return '✅';
        case 'yellow': return '⚠️';
        case 'red': return '❌';
        default: return '🔘';
    }
}

// Hàm render danh sách hóa đơn
function renderInvoiceList(invoices) {
    if (invoices.length === 0) return '<p>Không tìm thấy hóa đơn nào</p>';

    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    invoices.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA; // Mới nhất trước
    });

    return `
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>STT</th>
                    <th>Số HĐ</th>
                    <th>Ngày</th>
                    <th>MCCQT</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                ${invoices.map((invoice, index) => {
        const status = checkInvoiceStatus(invoice); // Thay checkInvoice bằng checkInvoiceStatus
        return `
                        <tr class="invoice-row ${status === 'valid' ? 'valid-row' :
                status === 'warning' ? 'warning-row' :
                    status === 'error' ? 'error-row' :
                        status === 'unknown' ? 'unknown-row' :
                            status === 'mismatch' ? 'mismatch-row' : ''}">
                            <td>${index + 1}</td>
                            <td>${invoice.series}-${invoice.number}</td>
                            <td>${invoice.date}</td>
                            <td>${invoice.mccqt}</td>
                            <td>${invoice.direction === 'input' ? 'Nhập' : 'Xuất'}</td>
                            <td>${formatMoney(calculateInvoiceTotal(invoice))}</td>
                            <td>${getStatusBadge(status)}</td>
                            <td class="actions">
                                <button onclick="showInvoiceDetails('${invoice.id}')">Xem</button>
                                <button onclick="deleteInvoice('${invoice.id}', '${invoice.businessId}')">Xóa</button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Hàm tìm kiếm nâng cao
function showAdvancedSearch(businessId) {
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
            <h4>Tìm kiếm nâng cao</h4>
            <div class="advanced-search-form">
                <div>
                    <label>Từ ngày:</label>
                    <input type="date" id="searchFromDate">
                </div>
                <div>
                    <label>Đến ngày:</label>
                    <input type="date" id="searchToDate">
                </div>
                <div>
                    <label>Loại hóa đơn:</label>
                    <select id="searchInvoiceType">
                        <option value="all">Tất cả</option>
                        <option value="input">Nhập hàng</option>
                        <option value="output">Xuất hàng</option>
                    </select>
                </div>
                <div>
                    <label>Giá trị từ:</label>
                    <input type="number" id="searchMinAmount" placeholder="VND">
                </div>
                <div>
                    <label>đến:</label>
                    <input type="number" id="searchMaxAmount" placeholder="VND">
                </div>
                <button onclick="applyAdvancedSearch('${businessId}')">Áp dụng tìm kiếm</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
}

// Hàm áp dụng tìm kiếm nâng cao
function applyAdvancedSearch(businessId) {
    const fromDate = document.getElementById('searchFromDate').value;
    const toDate = document.getElementById('searchToDate').value;
    const type = document.getElementById('searchInvoiceType').value;
    const minAmount = normalizeNumber(document.getElementById('searchMinAmount').value) || 0;
    const maxAmount = normalizeNumber(document.getElementById('searchMaxAmount').value) || Infinity;

    let filtered = invoices.filter(i => i.businessId === businessId);

    // Áp dụng các điều kiện lọc
    if (fromDate) {
        filtered = filtered.filter(i => new Date(i.uploadDate) >= new Date(fromDate));
    }
    if (toDate) {
        filtered = filtered.filter(i => new Date(i.uploadDate) <= new Date(toDate));
    }
    if (type !== 'all') {
        filtered = filtered.filter(i => i.direction === type);
    }
    filtered = filtered.filter(i => {
        const total = calculateInvoiceTotal(i);
        return total >= minAmount && total <= maxAmount;
    });

    // Hiển thị kết quả
    const container = document.getElementById('invoiceListContainer');
    if (container) {
        container.innerHTML = renderInvoiceList(filtered);
    }

    // Đóng popup
    document.querySelector('.popup')?.remove();
}

// Hàm hỗ trợ - tạo badge trạng thái
function getStatusBadge(status) {
    const badges = {
        white: '<span class="badge valid">✅ Hợp lệ</span>',
        yellow: '<span class="badge warning">⚠️ HĐ cảnh báo</span>',
        red: '<span class="badge error">❌ Lỗi</span>',
        unknown: '<span class="badge unknown">❓ Thiếu</span>',
        mismatch: '<span class="badge mismatch">🔄 Lệch</span>'
    };
    return badges[status] || '<span class="badge unknown">❓ Thiếu</span>';
}

// Hàm tính tổng giá trị hóa đơn
function calculateInvoiceTotal(invoice) {
    let total = 0;
    invoice.items.forEach(item => {
        const qty = normalizeNumber(item.qty);
        const price = normalizeNumber(item.price);
        const discount = normalizeNumber(item.discount || '0');
        const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;

        total += (qty * price - discount) * (1 + vatRate);
    });
    return total;
}

function searchInvoices() {
    try {
        const searchInput = document.getElementById('searchInvoiceInput')?.value.trim().toLowerCase();
        if (!searchInput) {
            alert('Vui lòng nhập MCCQT hoặc số hóa đơn để tìm kiếm!');
            return;
        }

        const results = invoices.filter(i =>
            i.mccqt.toLowerCase().includes(searchInput) ||
            i.number.toLowerCase().includes(searchInput)
        );

        const searchResults = document.getElementById('searchResults');
        if (!searchResults) {
            console.error('Không tìm thấy #searchResults trong DOM');
            return;
        }

        if (results.length === 0) {
            searchResults.innerHTML = '<p>Không tìm thấy hóa đơn nào.</p>';
            return;
        }

        searchResults.innerHTML = `
            <div class="section">
                <h4>Kết quả tìm kiếm (${results.length})</h4>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>Số HĐ</th><th>MCCQT</th><th>Ngày lập</th><th>Loại</th><th>Thuế</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(i => `
                            <tr>
                                <td>${i.series}-${i.number}</td>
                                <td>${i.mccqt}</td>
                                <td>${i.date}</td>
                                <td>${i.direction === 'input' ? 'Nhập' : 'Xuất'}</td>
                                <td>${formatMoney(i.totalTax || 0)} (${i.taxRate}%)</td>
                                <td>
                                    <button onclick="showInvoiceDetails('${i.id}')">📄 Xem</button>
                                    <a onclick="deleteInvoice('${i.id}', event)" style="color:#666">🗑️</a>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Lỗi searchInvoices:', e);
        alert('Lỗi khi tìm kiếm hóa đơn: ' + e.message);
    }
}

function deleteInvoice(id, event) {
    event.stopPropagation();
    try {
        const invoice = invoices.find(i => i.id === id);
        if (!invoice) return;

        if (confirm('Bạn có chắc muốn xóa hóa đơn này?')) {
            logActivity('invoice_delete', {
                invoiceId: id,
                invoiceNumber: `${invoice.series}-${invoice.number}`,
                businessId: invoice.businessId,
                itemCount: invoice.items.length
            });
            const invoice = invoices.find(i => i.id === id);
            if (invoice) {
                if (invoice.direction === 'input') {
                    invoice.items.forEach(item => {
                        if (item.type === 'Hàng hóa, dịch vụ') {
                            updateInventory(invoice.businessId, item, 'output');
                        }
                    });
                } else {
                    invoice.items.forEach(item => {
                        if (item.type === 'Hàng hóa, dịch vụ') {
                            updateInventory(invoice.businessId, item, 'input');
                        }
                    });
                }
                invoices = invoices.filter(i => i.id !== id);
                exportedInvoices = exportedInvoices.filter(i => i.id !== id);
                localStorage.setItem('invoices', JSON.stringify(invoices));
                localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));
                showBusinessDetails(invoice.businessId);
                showPriceList(invoice.businessId);
                showExportHistory(invoice.businessId);
            }
        }
    } catch (e) {
        console.error('Lỗi deleteInvoice:', e);
    }
}

function checkInvoice(invoice) {
    let hasError = false;
    let hasWarning = false; // Thêm biến cảnh báo riêng
    let totalInvoice = 0;

    invoice.items.forEach(item => {
        // Kiểm tra lỗi nghiêm trọng (giữ nguyên)
        if (item.unit && /\d/.test(item.unit.trim())) {
            hasError = true;
        }
        if (!/^\d+(?:,\d+)?$/.test(item.qty.toString().replace(/\s/g, ''))) {
            hasError = true;
        }

        // Tính toán giá trị
        const qty = normalizeNumber(item.qty);
        const price = normalizeNumber(item.price);
        const discount = normalizeNumber(item.discount || '0');
        const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;

        const itemTotalBeforeTax = qty * price - discount;
        const itemTax = itemTotalBeforeTax * vatRate;
        const itemTotal = itemTotalBeforeTax + itemTax;

        // PHÁT HIỆN CẢNH BÁO MỚI
        if (qty > 0 && itemTotal <= 0) {
            hasWarning = true; // Số lượng >0 nhưng thành tiền <=0
        }

        totalInvoice += itemTotal;
    });

    // Thêm điều kiện cảnh báo nếu có dòng hàng = 0
    if (totalInvoice === 0 || hasWarning) {
        hasWarning = true;
    }

    return hasError ? 'red' : hasWarning ? 'yellow' : 'white';
}

// =============================================
// 7. QUẢN LÝ XUẤT HÀNG (EXPORT)
// =============================================
// =============================================
// 7. QUẢN LÝ XUẤT HÀNG (EXPORT) - Sửa lại toàn bộ
// =============================================
// Hàm tạo tên khách hàng ngẫu nhiên
function randomCustomerName() {
    const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
    const middleNames = ['Văn', 'Thị', 'Hữu', 'Minh', 'Ngọc', 'Quốc', 'Thành', 'Hoài', 'Đức', ''];
    const lastNames = ['Hùng', 'Lan', 'Anh', 'Dũng', 'Hương', 'Nam', 'Mai', 'Bình', 'Tâm', 'Phúc'];
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const middle = middleNames[Math.floor(Math.random() * middleNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${first} ${middle} ${last}`.trim();
}

// Hàm tạo địa chỉ ngẫu nhiên tại Ninh Thuận
function randomAddressNinhThuan() {
    const streets = ['Lê Lợi', 'Nguyễn Trãi', 'Trần Hưng Đạo', 'Hùng Vương', 'Ngô Gia Tự'];
    const wards = ['Phước Mỹ', 'Tấn Tài', 'Kinh Dinh', 'Mỹ Hải', 'Phủ Hà'];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const ward = wards[Math.floor(Math.random() * wards.length)];
    return `Đường ${street}, ${ward}, Ninh Thuận`;
}

function exportManualInvoice(businessId) {
    try {
        const customerName = document.getElementById('manualCustomerName')?.value || 'Khách lẻ';
        const customerAddress = document.getElementById('manualCustomerAddress')?.value || '';
        const customerPhone = document.getElementById('manualCustomerPhone')?.value || '';
        const customerTaxCode = document.getElementById('manualCustomerTaxCode')?.value || '';

        const tbody = document.getElementById('manualInvoiceItemsBody');
        if (!tbody) throw new Error('Không tìm thấy danh sách hàng hóa');

        const items = Array.from(tbody.querySelectorAll('tr')).map(row => {
            const select = row.querySelector('.item-select');
            const qtyInput = row.querySelector('.item-qty');
            if (!select?.value || !qtyInput?.value) return null;

            const invItem = inventory.find(i => i.id === select.value);
            if (!invItem) return null;

            const qty = normalizeNumber(qtyInput.value);
            const price = normalizeNumber(select.selectedOptions[0].dataset.price);
            const vat = invItem.vat || '10%';

            return {
                id: invItem.id,
                name: invItem.name,
                unit: invItem.unit,
                qty: qty.toString(),
                price: price.toString(),
                total: (qty * price).toString(),
                vat: vat
            };
        }).filter(item => item !== null);

        if (items.length === 0) {
            alert('Không có hàng hóa hợp lệ để xuất Excel!');
            return;
        }

        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.total), 0);
        const rows = [headers];

        // Dòng đầu tiên (thông tin chung)
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon
        headerRow[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerName; // TenKhachHang
        headerRow[4] = customerName; // TenNguoiMua
        headerRow[5] = customerTaxCode; // MaSoThue
        headerRow[6] = customerAddress; // DiaChiKhachHang
        headerRow[7] = customerPhone; // DienThoaiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT
        if (items.length > 0) {
            headerRow[11] = items[0].id; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].price; // DonGia
            headerRow[20] = items[0].total; // ThanhTien
            headerRow[22] = items[0].vat; // ThueSuat
            headerRow[23] = formatMoney(normalizeNumber(items[0].total) * (parseFloat(items[0].vat.replace('%', '')) / 100)); // TienThueSanPham
        }
        headerRow[24] = formatMoney(items.reduce((sum, item) =>
            sum + (normalizeNumber(item.total) * (parseFloat(item.vat.replace('%', '')) / 100)), 0)); // TienThue
        headerRow[26] = formatMoney(grandTotal); // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rows.push(headerRow);

        // Các dòng sản phẩm
        items.forEach((item, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 2; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.id; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.price; // DonGia
            rowData[20] = item.total; // ThanhTien
            rowData[22] = item.vat; // ThueSuat
            rowData[23] = formatMoney(normalizeNumber(item.total) * (parseFloat(item.vat.replace('%', '')) / 100)); // TienThueSanPham
            rowData[26] = item.total; // TongCong
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDonThuCong');
        XLSX.writeFile(wb, `HoaDonThuCong_${businessId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportManualInvoice:', e);
        alert('Lỗi khi xuất Excel: ' + e.message);
    }
}

function autoExport(businessId) {
    try {
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            alert('Không có hàng hóa trong tồn kho để xuất!');
            return;
        }

        // Chọn ngẫu nhiên 1-3 mặt hàng
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const selectedItems = [];
        const shuffledInv = inv.sort(() => Math.random() - 0.5).slice(0, itemCount);

        const items = shuffledInv.map((invItem, index) => {
            const maxQty = normalizeNumber(invItem.qty);
            const qty = Math.floor(Math.random() * maxQty) + 1; // Số lượng ngẫu nhiên từ 1 đến maxQty
            const price = normalizeNumber(invItem.price);
            const vat = invItem.vat || '10%';
            const vatRate = parseFloat(vat.replace('%', '')) / 100;
            const itemTotal = qty * price;
            const taxAmount = itemTotal * vatRate;

            return {
                stt: (index + 1).toString(),
                name: invItem.name,
                unit: invItem.unit,
                qty: qty.toString(),
                price: price.toString(),
                discount: '0',
                vat,
                total: formatMoney(itemTotal),
                taxAmount: formatMoney(taxAmount),
                totalAfterTax: formatMoney(itemTotal + taxAmount),
                giaBan: invItem.giaBan || formatMoney(calculateSellingPrice(price)),
                itemId: invItem.id
            };
        });

        const customerName = randomCustomerName();
        const customerAddress = randomAddressNinhThuan();
        const customerPhone = '';
        const customerTaxCode = '';

        // Tạo và xuất Excel
        const rows = [headers];
        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.totalAfterTax), 0);

        // Dòng đầu tiên (thông tin chung)
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon
        headerRow[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerName; // TenKhachHang
        headerRow[4] = customerName; // TenNguoiMua
        headerRow[5] = customerTaxCode; // MaSoThue
        headerRow[6] = customerAddress; // DiaChiKhachHang
        headerRow[7] = customerPhone; // DienThoaiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT
        if (items.length > 0) {
            headerRow[11] = items[0].itemId; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].price; // DonGia
            headerRow[20] = items[0].total; // ThanhTien
            headerRow[22] = items[0].vat; // ThueSuat
            headerRow[23] = items[0].taxAmount; // TienThueSanPham
        }
        headerRow[24] = formatMoney(items.reduce((sum, item) => sum + normalizeNumber(item.taxAmount), 0)); // TienThue
        headerRow[26] = formatMoney(grandTotal); // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rows.push(headerRow);

        // Các dòng sản phẩm
        items.forEach((item, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 2; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.itemId; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.price; // DonGia
            rowData[20] = item.total; // ThanhTien
            rowData[22] = item.vat; // ThueSuat
            rowData[23] = item.taxAmount; // TienThueSanPham
            rowData[26] = item.totalAfterTax; // TongCong
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDonTuDong');
        XLSX.writeFile(wb, `HoaDonTuDong_${businessId}_${Date.now()}.xlsx`);

        // Lưu trạng thái
        saveCurrentState();

        // Tạo hóa đơn mới
        const invoiceId = generateUUID();
        const invoice = {
            id: invoiceId,
            businessId,
            series: 'A' + Date.now().toString().slice(-6),
            number: Math.floor(1000 + Math.random() * 9000).toString(),
            direction: 'output',
            uploadDate: new Date().toISOString(),
            mccqt: '',
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items,
            taxRate: '10%',
            totalTax: items.reduce((sum, item) => sum + normalizeNumber(item.taxAmount), 0),
            netTotal: items.reduce((sum, item) => sum + normalizeNumber(item.total), 0),
            totalDiscount: 0
        };

        // Cập nhật tồn kho
        items.forEach(item => {
            updateInventory(businessId, item, 'output');
        });

        // Lưu vào invoices
        invoices.push(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));

        // Lưu vào lịch sử xuất hàng
        const exportRecord = {
            id: generateUUID(),
            businessId,
            exportCode: 'EXP-' + Date.now(),
            exportDate: new Date().toISOString(),
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items: items.map(item => ({
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                price: item.price,
                total: item.total
            })),
            grandTotal: formatMoney(invoice.netTotal + invoice.totalTax),
            type: 'auto'
        };
        exportedInvoices.push(exportRecord);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        // Ghi log hoạt động
        logActivity('invoice_auto_add', {
            invoiceId,
            businessId,
            invoiceNumber: invoice.series + '-' + invoice.number,
            customerName
        });
        logActivity('export_auto', {
            exportId: exportRecord.id,
            businessId,
            invoiceId,
            totalAmount: exportRecord.grandTotal
        });

        alert('Xuất hàng tự động và lưu hóa đơn thành công!');
        showBusinessDetails(businessId);
    } catch (e) {
        console.error('Lỗi autoExport:', e);
        alert('Lỗi khi xuất tự động: ' + e.message);
    }
}

function showManualSalesExportPopup(businessId) {
    try {
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            alert('Không có hàng hóa trong tồn kho để xuất!');
            return;
        }

        // Chọn ngẫu nhiên 1-3 mặt hàng
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const selectedItems = inv.sort(() => Math.random() - 0.5).slice(0, itemCount).map((invItem, index) => {
            const maxQty = normalizeNumber(invItem.qty);
            const qty = Math.floor(Math.random() * maxQty) + 1;
            const price = normalizeNumber(invItem.price);
            const vat = invItem.vat || '10%';
            const vatRate = parseFloat(vat.replace('%', '')) / 100;
            const itemTotal = qty * price;
            const taxAmount = itemTotal * vatRate;

            return {
                stt: (index + 1).toString(),
                name: invItem.name,
                unit: invItem.unit,
                qty: qty.toString(),
                price: price.toString(),
                discount: '0',
                vat,
                total: formatMoney(itemTotal),
                taxAmount: formatMoney(taxAmount),
                totalAfterTax: formatMoney(itemTotal + taxAmount),
                giaBan: invItem.giaBan || formatMoney(calculateSellingPrice(price)),
                itemId: invItem.id
            };
        });

        // Tạo popup
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <div class="popup-content" style="max-width: 1260px;">
                <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
                <h4>Xuất bán thủ công</h4>
                
                <div class="customer-info">
                    <div class="form-group">
                        <label>Họ tên khách hàng:</label>
                        <input type="text" id="manualSalesCustomerName" placeholder="Nhập họ tên">
                    </div>
                    <div class="form-group">
                        <label>Địa chỉ:</label>
                        <input type="text" id="manualSalesCustomerAddress" placeholder="Nhập địa chỉ">
                    </div>
                    <div class="form-group">
                        <label>Số điện thoại:</label>
                        <input type="text" id="manualSalesCustomerPhone" placeholder="Nhập số điện thoại">
                    </div>
                    <div class="form-group">
                        <label>Mã số thuế (nếu có):</label>
                        <input type="text" id="manualSalesCustomerTaxCode" placeholder="Nhập MST">
                    </div>
                </div>
                
                <div class="invoice-items">
                    <h5>Bảng kê hàng hóa (tự động chọn)</h5>
                    <table class="compact-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Tên hàng hóa</th>
                                <th>Đơn vị</th>
                                <th>Số lượng tồn</th>
                                <th>Số lượng xuất</th>
                                <th>Đơn giá</th>
                                <th>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody id="manualSalesItemsBody">
                            ${selectedItems.map(item => `
                                <tr>
                                    <td>${item.stt}</td>
                                    <td>${item.name}</td>
                                    <td>${item.unit}</td>
                                    <td>${inv.find(i => i.id === item.itemId).qty}</td>
                                    <td>${item.qty}</td>
                                    <td>${formatMoney(item.price)}</td>
                                    <td>${item.total}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="invoice-summary">
                    <div>Tổng tiền: <span id="manualSalesTotal">${formatMoney(selectedItems.reduce((sum, item) => sum + normalizeNumber(item.totalAfterTax), 0))}</span> VND</div>
                </div>
                
                <div class="form-actions">
                    <button onclick="saveManualSalesExport('${businessId}')" class="primary">💾 Lưu và xuất Excel</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
    } catch (e) {
        console.error('Lỗi showManualSalesExportPopup:', e);
        alert('Lỗi khi tạo popup xuất bán thủ công: ' + e.message);
    }
}

function saveManualSalesExport(businessId) {
    try {
        const customerNameInput = document.getElementById('manualSalesCustomerName');
        const customerAddressInput = document.getElementById('manualSalesCustomerAddress');
        const customerPhoneInput = document.getElementById('manualSalesCustomerPhone');
        const customerTaxCodeInput = document.getElementById('manualSalesCustomerTaxCode');

        if (!customerNameInput || !customerAddressInput || !customerPhoneInput || !customerTaxCodeInput) {
            throw new Error('Không tìm thấy các trường thông tin khách hàng trong DOM');
        }

        const customerName = customerNameInput.value.trim() || 'Khách hàng lẻ';
        const customerAddress = customerAddressInput.value.trim() || '';
        const customerPhone = customerPhoneInput.value.trim() || '';
        const customerTaxCode = customerTaxCodeInput.value.trim() || '';

        const tbody = document.getElementById('manualSalesItemsBody');
        if (!tbody) {
            throw new Error('Không tìm thấy #manualSalesItemsBody');
        }

        const items = Array.from(tbody.querySelectorAll('tr')).map((row, index) => {
            const name = row.cells[1].textContent;
            const invItem = inventory.find(i => i.businessId === businessId && i.name === name);
            if (!invItem) return null;

            const qty = normalizeNumber(row.cells[4].textContent);
            const price = normalizeNumber(row.cells[5].textContent);
            const vat = invItem.vat || '10%';
            const vatRate = parseFloat(vat.replace('%', '')) / 100;
            const itemTotal = qty * price;
            const taxAmount = itemTotal * vatRate;

            return {
                stt: (index + 1).toString(),
                name: invItem.name,
                unit: invItem.unit,
                qty: qty.toString(),
                price: price.toString(),
                discount: '0',
                vat,
                total: formatMoney(itemTotal),
                taxAmount: formatMoney(taxAmount),
                totalAfterTax: formatMoney(itemTotal + taxAmount),
                giaBan: invItem.giaBan || formatMoney(calculateSellingPrice(price)),
                itemId: invItem.id
            };
        }).filter(item => item !== null);

        if (items.length === 0) {
            alert('Không có hàng hóa hợp lệ để xuất!');
            return;
        }

        // Kiểm tra số lượng tồn kho
        for (const item of items) {
            const invItem = inventory.find(i => i.businessId === businessId && i.name === item.name);
            if (!invItem || normalizeNumber(invItem.qty) < normalizeNumber(item.qty)) {
                alert(`Số lượng xuất cho ${item.name} vượt quá tồn kho!`);
                return;
            }
        }

        // Xuất Excel trước
        const rows = [headers];
        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.totalAfterTax), 0);

        // Dòng đầu tiên (thông tin chung)
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon
        headerRow[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerName; // TenKhachHang
        headerRow[4] = customerName; // TenNguoiMua
        headerRow[5] = customerTaxCode; // MaSoThue
        headerRow[6] = customerAddress; // DiaChiKhachHang
        headerRow[7] = customerPhone; // DienThoaiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT
        if (items.length > 0) {
            headerRow[11] = items[0].itemId; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].price; // DonGia
            headerRow[20] = items[0].total; // ThanhTien
            headerRow[22] = items[0].vat; // ThueSuat
            headerRow[23] = items[0].taxAmount; // TienThueSanPham
        }
        headerRow[24] = formatMoney(items.reduce((sum, item) => sum + normalizeNumber(item.taxAmount), 0)); // TienThue
        headerRow[26] = formatMoney(grandTotal); // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rows.push(headerRow);

        // Các dòng sản phẩm
        items.forEach((item, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 2; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.itemId; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.price; // DonGia
            rowData[20] = item.total; // ThanhTien
            rowData[22] = item.vat; // ThueSuat
            rowData[23] = item.taxAmount; // TienThueSanPham
            rowData[26] = item.totalAfterTax; // TongCong
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDonBanThuCong');
        XLSX.writeFile(wb, `HoaDonBanThuCong_${businessId}_${Date.now()}.xlsx`);

        // Lưu trạng thái
        saveCurrentState();

        // Tạo hóa đơn mới
        const invoiceId = generateUUID();
        const invoice = {
            id: invoiceId,
            businessId,
            series: 'S' + Date.now().toString().slice(-6),
            number: Math.floor(1000 + Math.random() * 9000).toString(),
            direction: 'output',
            uploadDate: new Date().toISOString(),
            mccqt: '',
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items,
            taxRate: '10%',
            totalTax: items.reduce((sum, item) => sum + normalizeNumber(item.taxAmount), 0),
            netTotal: items.reduce((sum, item) => sum + normalizeNumber(item.total), 0),
            totalDiscount: 0
        };

        // Cập nhật tồn kho
        items.forEach(item => {
            updateInventory(businessId, item, 'output');
        });

        // Lưu vào invoices
        invoices.push(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));

        // Lưu vào lịch sử xuất hàng
        const exportRecord = {
            id: generateUUID(),
            businessId,
            exportCode: 'EXP-' + Date.now(),
            exportDate: new Date().toISOString(),
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items: items.map(item => ({
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                price: item.price,
                total: item.total
            })),
            grandTotal: formatMoney(invoice.netTotal + invoice.totalTax),
            type: 'manual_sales'
        };
        exportedInvoices.push(exportRecord);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        // Ghi log hoạt động
        logActivity('invoice_manual_sales_add', {
            invoiceId,
            businessId,
            invoiceNumber: invoice.series + '-' + invoice.number,
            customerName
        });
        logActivity('export_manual_sales', {
            exportId: exportRecord.id,
            businessId,
            invoiceId,
            totalAmount: exportRecord.grandTotal
        });

        alert('Xuất bán thủ công và lưu hóa đơn thành công!');
        document.querySelector('.popup').remove();
        showBusinessDetails(businessId);
    } catch (e) {
        console.error('Lỗi saveManualSalesExport:', e);
        alert('Lỗi khi xuất bán thủ công: ' + e.message);
    }
}

function showExportHistory(businessId) {
    try {
        const exportHistoryTab = document.getElementById('exportHistoryTab');
        if (!exportHistoryTab) return;

        const exports = exportedInvoices
            .filter(i => i.businessId === businessId)
            .sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate));

        exportHistoryTab.innerHTML = `
            <div class="section">
                <h4>Lịch sử xuất hàng (${exports.length})</h4>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Ngày</th>
                            <th>Mã xuất</th>
                            <th>Khách hàng</th>
                            <th>Địa chỉ</th>
                            <th>SL hàng</th>
                            <th>Giá hóa đơn</th>
                            <th>Tồn kho còn lại</th>
                            <th>Giá bán còn lại</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exports.map(exp => {
            const customerName = exp.customerName || 'Khách lẻ';
            const customerAddress = exp.customerAddress || 'Ninh Thuận';
            const totalQuantity = exp.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0);
            const totalCost = exp.totalAmount || exp.items.reduce((sum, item) => sum + normalizeNumber(item.price) * normalizeNumber(item.qty), 0); // Sử dụng totalAmount nếu có

            const remaining = calculateRemainingStockAfterExport(businessId, exp);

            return `
                                <tr>
                                    <td>${new Date(exp.exportDate).toLocaleDateString('vi-VN')}</td>
                                    <td>${exp.exportCode}</td>
                                    <td>${customerName}</td>
                                    <td>${customerAddress}</td>
                                    <td>${formatMoney(totalQuantity)}</td>
                                    <td>${formatMoney(totalCost)}</td>
                                    <td>${formatMoney(remaining.totalCost)}</td>
                                    <td>${formatMoney(remaining.totalSelling)}</td>
                                    <td class="actions">
                                        <button onclick="showExportDetails('${exp.id}')">📄 Xem</button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Lỗi showExportHistory:', e);
    }
}


function validateTargetAmount(businessId) {
    try {
        const amountInput = document.getElementById('targetAmount');
        if (!amountInput) return;
        let value = normalizeNumber(amountInput.value);
        const minAmount = 1000;
        if (value < minAmount) {
            amountInput.value = minAmount;
            value = minAmount;
        }
        // Cập nhật lại danh sách nếu đang hiển thị
        if (document.getElementById('exportItemsBodyContent') || document.getElementById('autoInvoiceItemsBody')) {
            generateExportItems(businessId); // Tái tạo danh sách với giá trị mới
        }
    } catch (e) {
        console.error('Lỗi validateTargetAmount:', e);
    }
}

function generateExportItems(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0 && normalizeNumber(i.price) > 0);
        if (inv.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Không có sản phẩm để xuất.</td></tr>';
            updateExportTotal(businessId);
            return;
        }

        const targetAmount = normalizeNumber(document.getElementById('targetAmount').value) || 1000000;
        const tolerance = targetAmount * 0.10;
        const minAmount = targetAmount - tolerance;
        const maxAmount = targetAmount + tolerance;

        let totalAmount = 0;
        const items = [];
        const availableItems = [...inv].sort((a, b) => calculateSellingPrice(normalizeNumber(b.price)) - calculateSellingPrice(normalizeNumber(a.price)));

        while (availableItems.length > 0 && totalAmount < maxAmount) {
            const item = availableItems[0];
            const maxQty = normalizeNumber(item.qty);
            const sellingPrice = calculateSellingPrice(normalizeNumber(item.price));
            const qty = Math.min(Math.floor((maxAmount - totalAmount) / sellingPrice), maxQty);
            if (qty > 0 && totalAmount + (qty * sellingPrice) <= maxAmount) {
                items.push({ ...item, qty, sellingPrice, itemTotal: qty * sellingPrice });
                totalAmount += qty * sellingPrice;
                availableItems.shift();
            } else {
                availableItems.shift();
            }
        }

        if (items.length === 0 || totalAmount < minAmount) {
            tbody.innerHTML = '<tr><td colspan="8">Không thể tạo danh sách với số tiền mục tiêu.</td></tr>';
        } else {
            tbody.innerHTML = items.map((item, index) => `
                <tr data-item-id="${item.id}">
                    <td><input type="checkbox" class="export-checkbox" checked onchange="updateExportTotal('${businessId}')"></td>
                    <td>${item.name}</td>
                    <td>${item.unit}</td>
                    <td>${item.qty}</td>
                    <td><input type="number" class="export-qty" value="${item.qty}" min="1" max="${item.qty}" onchange="updateExportTotal('${businessId}')"></td>
                    <td>${formatMoney(item.sellingPrice)} VND</td>
                    <td><span class="export-total">${formatMoney(item.itemTotal)} VND</span></td>
                    <td><button onclick="removeExportItem('${item.id}', '${businessId}')">❌</button></td>
                </tr>
            `).join('');
        }
        updateExportTotal(businessId);
    } catch (e) {
        console.error('Lỗi generateExportItems:', e);
        alert('Lỗi khi tạo danh sách xuất: ' + e.message);
    }
}

function updateExportTotal(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }
        let total = 0;
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            const qtyInput = row.querySelector('.export-qty');
            if (checkbox && qtyInput && checkbox.checked) {
                const qty = normalizeNumber(qtyInput.value) || 0;
                const maxQty = normalizeNumber(row.cells[3].innerText);
                if (qty > maxQty) {
                    qtyInput.value = maxQty;
                }
                const price = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
                const totalCell = row.querySelector('.export-total');
                totalCell.innerText = `${formatMoney(qty * price)} VND`;
                total += qty * price;
            } else {
                row.querySelector('.export-total').innerText = '0 VND';
            }
        });
        const exportTotal = document.getElementById('exportTotal');
        if (exportTotal) {
            exportTotal.innerText = `Tổng tiền: ${formatMoney(total)} VND`;
        }
    } catch (e) {
        console.error('Lỗi updateExportTotal:', e);
    }
}

function removeExportItem(itemId, businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }
        const row = tbody.querySelector(`tr[data-item-id="${itemId}"]`);
        if (row) row.remove();
        updateExportTotal(businessId);
    } catch (e) {
        console.error('Lỗi removeExportItem:', e);
    }
}

function saveExport(businessId) {
    try {
        saveCurrentState(); // Lưu trạng thái hiện tại trước khi thay đổi

        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            alert('Vui lòng tạo danh sách xuất trước khi lưu!');
            return;
        }

        const customerName = document.getElementById('customerName')?.value || 'Khách lẻ';
        const customerAddress = document.getElementById('customerAddress')?.value || '';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const customerTaxCode = document.getElementById('customerTaxCode')?.value || '';

        const items = [];
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            if (checkbox && checkbox.checked) {
                const itemId = row.getAttribute('data-item-id');
                const item = inventory.find(i => i.id === itemId && i.businessId === businessId);
                const qty = normalizeNumber(row.querySelector('.export-qty')?.value) || 0;
                const price = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;

                if (item && qty > 0) {
                    if (qty > normalizeNumber(item.qty)) {
                        alert(`Số lượng xuất (${qty}) vượt quá tồn kho (${item.qty}) cho ${item.name}!`);
                        throw new Error('Số lượng xuất không hợp lệ');
                    }

                    items.push({
                        id: itemId,
                        name: item.name,
                        unit: item.unit,
                        qty: qty.toString(),
                        price: price.toString(),
                        total: (qty * price).toString(),
                        vat: item.vat || '10%'
                    });
                }
            }
        });

        if (items.length === 0) {
            alert('Vui lòng chọn ít nhất một sản phẩm để xuất!');
            return;
        }

        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.total), 0);

        // Tạo hồ sơ xuất hàng
        const exportRecord = {
            id: generateUUID(),
            businessId,
            exportCode: 'EXP-' + Date.now().toString().slice(-6),
            exportDate: new Date().toISOString(),
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items,
            grandTotal: grandTotal.toString(),
            type: 'auto'
        };

        // Cập nhật tồn kho
        items.forEach(item => {
            updateInventory(businessId, item, 'output');
        });

        // Lưu vào lịch sử
        exportedInvoices.push(exportRecord);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        // Tạo hóa đơn
        const invoice = {
            id: generateUUID(),
            businessId,
            series: 'A' + Date.now().toString().slice(-6),
            number: Math.floor(1000 + Math.random() * 9000).toString(),
            direction: 'output',
            uploadDate: new Date().toISOString(),
            customerName,
            customerAddress,
            customerPhone,
            customerTaxCode,
            items,
            taxRate: '10%',
            totalTax: items.reduce((sum, item) => {
                const vatRate = parseFloat(item.vat.replace('%', '')) / 100;
                return sum + (normalizeNumber(item.total) * vatRate);
            }, 0),
            netTotal: grandTotal,
            totalDiscount: 0
        };

        invoices.push(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));

        // Ghi log
        logActivity('export_auto', {
            exportId: exportRecord.id,
            businessId,
            invoiceId: invoice.id,
            totalAmount: grandTotal,
            itemCount: items.length
        });

        alert('Xuất hàng tự động thành công!');
        showExportHistory(businessId);
    } catch (e) {
        console.error('Lỗi saveExport:', e);
        alert('Lỗi khi xuất hàng: ' + e.message);
    }
}


function exportToExcel(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            console.error('Không tìm thấy #exportItemsBodyContent hoặc bảng trống');
            alert('Vui lòng tạo danh sách xuất trước khi xuất Excel!');
            return;
        }

        const rows = [headers];
        const customerNameInput = document.getElementById('customerName')?.value || randomCustomerName();
        const customerAddressInput = document.getElementById('customerAddress')?.value || randomAddressNinhThuan();
        let grandTotal = 0;
        const items = [];

        // Thu thập dữ liệu từ bảng và tính tổng
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            if (checkbox && checkbox.checked) {
                const itemId = row.getAttribute('data-item-id') || '';
                const name = row.cells[1].innerText || '';
                const unit = row.cells[2].innerText || '';
                const qty = normalizeNumber(row.querySelector('.export-qty')?.value) || 0;
                const sellingPrice = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
                const itemTotal = qty * sellingPrice;
                grandTotal += itemTotal;
                items.push({ itemId, name, unit, qty, sellingPrice, itemTotal });
            }
        });

        // Dòng đầu tiên: Thông tin khách hàng và sản phẩm đầu tiên + TongCong
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon (03/07/2025)
        headerRow[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerNameInput; // TenKhachHang
        headerRow[4] = customerNameInput; // TenNguoiMua
        headerRow[6] = customerAddressInput; // DiaChiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT
        if (items.length > 0) {
            headerRow[11] = items[0].itemId; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].sellingPrice; // DonGia
            headerRow[20] = formatMoney(items[0].itemTotal); // ThanhTien
        }
        headerRow[26] = formatMoney(grandTotal); // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rows.push(headerRow);

        // Các dòng tiếp theo: Thông tin sản phẩm
        items.forEach((item, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 2; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.itemId; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.sellingPrice; // DonGia
            rowData[20] = formatMoney(item.itemTotal); // ThanhTien
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        if (rows.length <= 1) {
            alert('Không có dữ liệu để xuất!');
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDon');
        XLSX.writeFile(wb, `HoaDonXuat_${businessId}_${Date.now()}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportToExcel:', e);
        alert('Lỗi khi xuất file Excel: ' + e.message);
    }
}

function generateAutoInvoice(businessId) {
    try {
        const tbody = document.getElementById('autoInvoiceItemsBody');
        if (!tbody) {
            console.error('Không tìm thấy #autoInvoiceItemsBody trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0 && normalizeNumber(i.price) > 0);
        if (inv.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Không có sản phẩm để xuất.</td></tr>';
            updateAutoInvoiceTotal(businessId);
            return;
        }

        const targetAmount = normalizeNumber(document.getElementById('targetAmount').value) || 1000;
        const tolerance = targetAmount * 0.10;
        const minAmount = targetAmount - tolerance;
        const maxAmount = targetAmount + tolerance;

        let totalAmount = 0;
        const items = [];
        const availableItems = [...inv].sort((a, b) => calculateSellingPrice(normalizeNumber(b.price)) - calculateSellingPrice(normalizeNumber(a.price)));

        while (availableItems.length > 0 && totalAmount < maxAmount) {
            const item = availableItems[0];
            const maxQty = normalizeNumber(item.qty);
            const sellingPrice = calculateSellingPrice(normalizeNumber(item.price));
            const qty = Math.min(Math.floor((maxAmount - totalAmount) / sellingPrice), maxQty);
            if (qty > 0 && totalAmount + (qty * sellingPrice) <= maxAmount) {
                items.push({ ...item, qty, sellingPrice, itemTotal: qty * sellingPrice });
                totalAmount += qty * sellingPrice;
                availableItems.shift();
            } else {
                availableItems.shift();
            }
        }

        if (items.length === 0 || totalAmount < minAmount) {
            tbody.innerHTML = '<tr><td colspan="8">Không thể tạo hóa đơn với số tiền mục tiêu.</td></tr>';
        } else {
            tbody.innerHTML = items.map((item, index) => `
                <tr data-item-id="${item.id}">
                    <td><input type="checkbox" class="export-checkbox" checked onchange="updateAutoInvoiceTotal('${businessId}')"></td>
                    <td>${item.name}</td>
                    <td>${item.unit}</td>
                    <td>${item.qty}</td>
                    <td><input type="number" class="auto-qty" value="${item.qty}" min="1" max="${item.qty}" onchange="updateAutoInvoiceTotal('${businessId}')"></td>
                    <td>${formatMoney(item.sellingPrice)} VND</td>
                    <td><span class="auto-total">${formatMoney(item.itemTotal)} VND</span></td>
                    <td><button onclick="removeAutoInvoiceItem('${item.id}', '${businessId}')">❌</button></td>
                </tr>
            `).join('');
        }
        updateAutoInvoiceTotal(businessId);
    } catch (e) {
        console.error('Lỗi generateAutoInvoice:', e);
        alert('Lỗi khi tạo hóa đơn: ' + e.message);
    }
}

function updateAutoInvoiceTotal(businessId) {
    try {
        const tbody = document.getElementById('autoInvoiceItemsBody');
        if (!tbody) {
            console.error('Không tìm thấy #autoInvoiceItemsBody trong DOM');
            return;
        }
        let total = 0;
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            const qtyInput = row.querySelector('.auto-qty');
            if (checkbox && qtyInput && checkbox.checked) {
                const qty = normalizeNumber(qtyInput.value) || 0;
                const maxQty = normalizeNumber(row.cells[3].innerText);
                if (qty > maxQty) {
                    qtyInput.value = maxQty;
                }
                const price = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
                const totalCell = row.querySelector('.auto-total');
                totalCell.innerText = `${formatMoney(qty * price)} VND`;
                total += qty * price;
            } else {
                row.querySelector('.auto-total').innerText = '0 VND';
            }
        });
        const autoInvoiceTotal = document.getElementById('autoInvoiceTotal');
        if (autoInvoiceTotal) {
            autoInvoiceTotal.innerText = `Tổng tiền: ${formatMoney(total)} VND`;
        }
    } catch (e) {
        console.error('Lỗi updateAutoInvoiceTotal:', e);
    }
}

function removeAutoInvoiceItem(itemId, businessId) {
    try {
        const tbody = document.getElementById('autoInvoiceItemsBody');
        if (!tbody) {
            console.error('Không tìm thấy #autoInvoiceItemsBody trong DOM');
            return;
        }
        const row = tbody.querySelector(`tr[data-item-id="${itemId}"]`);
        if (row) row.remove();
        updateAutoInvoiceTotal(businessId);
    } catch (e) {
        console.error('Lỗi removeAutoInvoiceItem:', e);
    }
}

function saveAutoInvoice(businessId) {
    try {
        const tbody = document.getElementById('autoInvoiceItemsBody');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            alert('Vui lòng tạo hóa đơn trước khi lưu!');
            return;
        }

        const items = [];
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            const itemId = row.getAttribute('data-item-id');
            const item = inventory.find(i => i.id === itemId && i.businessId === businessId);
            const qtyInput = row.querySelector('.auto-qty');
            const qty = normalizeNumber(qtyInput.value) || 0;
            if (item && checkbox && checkbox.checked && qty > 0) {
                if (qty > normalizeNumber(item.qty)) {
                    alert(`Số lượng xuất (${qty}) vượt quá tồn kho (${item.qty}) cho ${item.name}!`);
                    throw new Error('Số lượng xuất không hợp lệ');
                }
                items.push({
                    id: itemId,
                    name: item.name,
                    unit: item.unit,
                    qty: qty.toString(),
                    price: calculateSellingPrice(normalizeNumber(item.price)).toString(),
                    total: (qty * calculateSellingPrice(normalizeNumber(item.price))).toString()
                });
            }
        });

        if (items.length === 0) {
            alert('Vui lòng chọn ít nhất một sản phẩm để xuất!');
            return;
        }

        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.total), 0);
        const invoice = {
            id: generateUUID(),
            businessId,
            invoiceCode: `INV-AUTO-${Date.now()}`,
            invoiceDate: getTodayDDMMYYYY(),
            items,
            grandTotal: grandTotal.toString()
        };

        exportedInvoices.push(invoice);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        items.forEach(item => {
            const invItem = inventory.find(i => i.id === item.id && i.businessId === businessId);
            if (invItem) {
                invItem.qty = (normalizeNumber(invItem.qty) - normalizeNumber(item.qty)).toString();
                invItem.lastUpdated = new Date().toISOString();
                if (normalizeNumber(invItem.qty) <= 0) {
                    inventory = inventory.filter(i => i.id !== invItem.id);
                }
            }
        });
        localStorage.setItem('inventory', JSON.stringify(inventory));

        document.getElementById('autoInvoiceTab').innerHTML = '';
        showAutoInvoiceTab(businessId); // Cập nhật lại giao diện
        alert('Đã xuất hóa đơn tự động thành công!');
    } catch (e) {
        console.error('Lỗi saveAutoInvoice:', e);
        if (e.message !== 'Số lượng xuất không hợp lệ') {
            alert('Lỗi khi xuất hóa đơn: ' + e.message);
        }
    }
}

function exportAutoInvoiceToExcel(businessId) {
    try {
        const tbody = document.getElementById('autoInvoiceItemsBody');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            alert('Vui lòng tạo hóa đơn trước khi xuất Excel!');
            return;
        }

        const rows = [headers];
        Array.from(tbody.querySelectorAll('tr')).forEach((row, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 1; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[3] = 'Khách lẻ'; // TenKhachHang
            rowData[4] = 'Khách lẻ'; // TenNguoiMua
            rowData[11] = row.getAttribute('data-item-id') || ''; // MaSanPham
            rowData[12] = row.cells[1].innerText || ''; // SanPham
            rowData[13] = row.cells[2].innerText || ''; // DonViTinh
            rowData[16] = normalizeNumber(row.querySelector('.auto-qty')?.value) || 0; // SoLuong
            rowData[17] = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0; // DonGia
            rowData[26] = normalizeNumber(row.querySelector('.auto-total')?.innerText.replace(/[^\d.,]/g, '')) || 0; // TongCong
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        if (rows.length <= 1) {
            alert('Không có dữ liệu để xuất!');
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDonTuDong');
        XLSX.writeFile(wb, `HoaDonTuDong_${businessId}_${Date.now()}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportAutoInvoiceToExcel:', e);
        alert('Lỗi khi xuất file Excel: ' + e.message);
    }
}

// =============================================
// 8. GIAO DIỆN HIỂN THỊ
// =============================================
function showPriceList(businessId) {
    try {
        const priceListTab = document.getElementById('priceListTab');
        if (!priceListTab) {
            console.error('Không tìm thấy #priceListTab trong DOM');
            return;
        }

        const inv = inventory.filter(i => i.businessId === businessId);
        inv.sort((a, b) => a.name.localeCompare(b.name, 'vi-VN'));

        priceListTab.innerHTML = `
            <div class="section">
                <h4>Bảng giá bán (${inv.length} sản phẩm)</h4>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>STT</th><th>Tên hàng hóa</th><th>Đơn vị</th><th>Giá bán</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.map((i, index) => {
            console.log('Hiển thị giá bán:', { id: i.id, name: i.name, giaBan: i.giaBan });
            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${i.name}</td>
                                    <td>${i.unit}</td>
                                    <td>${i.giaBan || formatMoney(calculateSellingPrice(normalizeNumber(i.price)))}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Lỗi showPriceList:', e);
    }
}

function showExportHistory(businessId) {
    try {
        const exportHistoryTab = document.getElementById('exportHistoryTab');
        if (!exportHistoryTab) return;

        const exports = exportedInvoices
            .filter(i => i.businessId === businessId)
            .sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate));

        exportHistoryTab.innerHTML = `
            <div class="section">
                <h4>Lịch sử xuất hàng (${exports.length})</h4>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Ngày</th>
                            <th>Mã xuất</th>
                            <th>Khách hàng</th>
                            <th>Địa chỉ</th>
                            <th>SL hàng</th>
                            <th>Giá hóa đơn</th>
                            <th>Tồn kho còn lại</th>
                            <th>Giá bán còn lại</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exports.map(exp => {
            // Sử dụng customerName từ dữ liệu, chỉ dùng random nếu không có
            const customerName = exp.customerName || (typeof randomCustomerName === 'function' ? randomCustomerName() : 'Khách lẻ');
            const customerAddress = exp.customerAddress || (typeof randomAddressNinhThuan === 'function' ? randomAddressNinhThuan() : 'Ninh Thuận');
            const totalQuantity = exp.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0);
            const totalCost = exp.items.reduce((sum, item) =>
                sum + normalizeNumber(item.price) * normalizeNumber(item.qty), 0);

            // Tính tồn kho sau xuất
            const remaining = calculateRemainingStockAfterExport(businessId, exp);

            return `
                                <tr>
                                    <td>${new Date(exp.exportDate).toLocaleDateString('vi-VN')}</td>
                                    <td>${exp.exportCode}</td>
                                    <td>${customerName}</td>
                                    <td>${customerAddress}</td>
                                    <td>${formatMoney(totalQuantity)}</td>
                                    <td>${formatMoney(totalCost)}</td>
                                    <td>${formatMoney(remaining.totalCost)}</td>
                                    <td>${formatMoney(remaining.totalSelling)}</td>
                                    <td class="actions">
                                        <button onclick="showExportDetails('${exp.id}')">📄 Xem</button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Lỗi showExportHistory:', e);
    }
}

// Hàm helper tính tồn kho sau xuất
function calculateRemainingStockAfterExport(businessId, exportRecord) {
    const currentInventory = inventory.filter(i => i.businessId === businessId);
    let totalCost = 0;
    let totalSelling = 0;

    currentInventory.forEach(item => {
        const qty = normalizeNumber(item.qty);
        const cost = normalizeNumber(item.price);
        const selling = calculateSellingPrice(cost);

        totalCost += qty * cost;
        totalSelling += qty * selling;
    });

    return { totalCost, totalSelling };
}
function showExportDetails(exportId) {
    try {
        const exportRecord = exportedInvoices.find(i => i.id === exportId);
        if (!exportRecord) {
            console.error(`Không tìm thấy bản ghi xuất với ID ${exportId}`);
            alert('Bản ghi xuất không tồn tại!');
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
                <h4>Chi tiết xuất hàng - ${exportRecord.exportCode}</h4>
                <p>Ngày xuất: ${new Date(exportRecord.exportDate).toLocaleDateString('vi-VN')}</p>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exportRecord.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.unit}</td>
                                <td>${item.qty}</td>
                                <td>${formatMoney(item.price)}</td>
                                <td>${formatMoney(normalizeNumber(item.qty) * normalizeNumber(item.price))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p>Tổng tiền: ${formatMoney(exportRecord.items.reduce((sum, item) => sum + normalizeNumber(item.qty) * normalizeNumber(item.price), 0))}</p>
            </div>
        `;
        document.body.appendChild(popup);
    } catch (e) {
        console.error('Lỗi showExportDetails:', e);
        alert('Lỗi khi hiển thị chi tiết xuất hàng: ' + e.message);
    }
}

function showTab(tabId, button, businessId) {
    try {
        if (!businessId) {
            businessId = selectedBusinessId;
            if (!businessId) return;
        }

        // Ẩn tất cả các tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });

        // Cập nhật active tab button
        document.querySelectorAll('.horizontal-tabs .tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        if (button) button.classList.add('active');

        // Hiển thị tab được chọn
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.classList.remove('hidden');

            switch (tabId) {
                case 'inventoryTab':
                    showBusinessInventory(businessId);
                    break;
                case 'invoicesTab':
                    showInvoicesTab(businessId);
                    break;
                case 'priceListTab':
                    showPriceList(businessId);
                    break;
                case 'exportHistoryTab':
                    showExportHistory(businessId);
                    break;
                case 'exportTab':
                    showExportTab(businessId);
                    break;
            }
        }
    } catch (e) {
        console.error('Lỗi showTab:', e);
    }
}

function showExportTab(businessId) {
    try {
        const exportTab = document.getElementById('exportTab');
        if (!exportTab) {
            console.error('Không tìm thấy #exportTab trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            exportTab.innerHTML = `
                <div class="section">
                    <h4>Xuất hàng hóa</h4>
                    <p>Không có sản phẩm nào trong tồn kho để xuất.</p>
                </div>
            `;
            return;
        }

        exportTab.innerHTML = `
            <div class="section">
                <h4>Xuất hàng hóa</h4>
                <div class="export-controls">
                    <div class="customer-info">
                        <div>
                            <label>Tên khách hàng:</label>
                            <input type="text" id="customerName" placeholder="Nhập tên khách hàng">
                        </div>
                        <div>
                            <label>Địa chỉ:</label>
                            <input type="text" id="customerAddress" placeholder="Nhập địa chỉ">
                        </div>
                    </div>
                    
                    <div class="amount-controls">
                        <label>Số tiền mục tiêu (VND):</label>
                        <input type="number" id="targetAmount" min="10" value="1000000" oninput="validateTargetAmount('${businessId}')">
                        <button onclick="generateRandomExportItems('${businessId}')">🎲 Tạo ngẫu nhiên</button>
                        <button onclick="saveExport('${businessId}')">💾 Lưu xuất hàng</button>
                        <button onclick="exportToExcel('${businessId}')">📤 Xuất Excel</button>
                    </div>
                </div>
                
                <table class="compact-table" id="exportItemsBody">
                    <thead>
                        <tr>
                            <th>Chọn</th>
                            <th>Tên hàng hóa</th>
                            <th>Đơn vị</th>
                            <th>Số lượng tồn</th>
                            <th>Số lượng xuất</th>
                            <th>Giá bán</th>
                            <th>Thành tiền</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="exportItemsBodyContent"></tbody>
                </table>
                <div id="exportTotal">Tổng tiền: 0 VND</div>
            </div>
        `;

        // Tự động tạo danh sách ngẫu nhiên ban đầu
        generateRandomExportItems(businessId);
    } catch (e) {
        console.error('Lỗi showExportTab:', e);
    }
}

function generateRandomExportItems(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }

        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0 && normalizeNumber(i.price) > 0);
        if (inv.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Không có sản phẩm để xuất.</td></tr>';
            updateExportTotal(businessId);
            return;
        }

        const targetAmount = normalizeNumber(document.getElementById('targetAmount').value) || 1000000;
        if (targetAmount < 1000) {
            document.getElementById('targetAmount').value = 0;
            return;
        }

        // Làm trống bảng trước khi tạo mới
        tbody.innerHTML = '';

        // Sắp xếp ngẫu nhiên danh sách hàng hóa
        const shuffledItems = [...inv].sort(() => Math.random() - 0.5);

        let totalAmount = 0;
        const itemsToExport = [];
        const tolerance = targetAmount * 0.1; // Cho phép sai số 10%

        for (const item of shuffledItems) {
            if (totalAmount >= targetAmount + tolerance) break;

            const maxQty = normalizeNumber(item.qty);
            const sellingPrice = calculateSellingPrice(normalizeNumber(item.price));
            const maxPossibleQty = Math.min(
                maxQty,
                Math.floor((targetAmount + tolerance - totalAmount) / sellingPrice)
            );

            if (maxPossibleQty <= 0) continue;

            // Chọn số lượng ngẫu nhiên từ 1 đến maxPossibleQty
            const qty = Math.max(1, Math.floor(Math.random() * maxPossibleQty) + 1);
            const itemTotal = qty * sellingPrice;

            itemsToExport.push({
                ...item,
                qty,
                sellingPrice,
                itemTotal
            });

            totalAmount += itemTotal;
        }

        // Đảm bảo đạt ít nhất 90% giá trị mục tiêu
        if (totalAmount < targetAmount * 0.9 && itemsToExport.length > 0) {
            // Tăng số lượng của item cuối cùng để đạt mục tiêu
            const lastItem = itemsToExport[itemsToExport.length - 1];
            const neededAmount = targetAmount * 0.9 - totalAmount;
            const additionalQty = Math.min(
                normalizeNumber(lastItem.qty) - lastItem.qty, // Số lượng còn lại trong kho
                Math.ceil(neededAmount / lastItem.sellingPrice)
            );

            if (additionalQty > 0) {
                lastItem.qty += additionalQty;
                lastItem.itemTotal = lastItem.qty * lastItem.sellingPrice;
                totalAmount += additionalQty * lastItem.sellingPrice;
            }
        }

        if (itemsToExport.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Không thể tạo danh sách với số tiền mục tiêu.</td></tr>';
        } else {
            // Hiển thị danh sách hàng hóa
            tbody.innerHTML = itemsToExport.map((item, index) => `
                <tr data-item-id="${item.id}">
                    <td><input type="checkbox" class="export-checkbox" checked onchange="updateExportTotal('${businessId}')"></td>
                    <td>${item.name}</td>
                    <td>${item.unit}</td>
                    <td>${item.qty}</td>
                    <td><input type="number" class="export-qty" value="${item.qty}" min="1" max="${normalizeNumber(item.qty)}" onchange="updateExportTotal('${businessId}')"></td>
                    <td>${formatMoney(item.sellingPrice)} VND</td>
                    <td><span class="export-total">${formatMoney(item.itemTotal)} VND</span></td>
                    <td><button onclick="removeExportItem('${item.id}', '${businessId}')">❌</button></td>
                </tr>
            `).join('');
        }

        updateExportTotal(businessId);
    } catch (e) {
        console.error('Lỗi generateRandomExportItems:', e);
        alert('Lỗi khi tạo danh sách xuất ngẫu nhiên: ' + e.message);
    }
}

// Thêm hàm mới để thực hiện cả 2 hành động
function saveExportAndExportExcel(businessId) {
    exportToExcel(businessId);
    saveExport(businessId);

}

// Hàm mới - Xuất hàng rồi mới xuất Excel
function saveExportAndExportExcel(businessId) {
    exportToExcel(businessId);  // Sau đó xuất Excel
    saveExport(businessId);  // Thực hiện xuất hàng trước
}
function showAutoInvoiceTab(businessId) {
    try {
        const autoInvoiceTab = document.getElementById('autoInvoiceTab');
        if (!autoInvoiceTab) {
            console.error('Không tìm thấy #autoInvoiceTab trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId);
        if (inv.length === 0) {
            autoInvoiceTab.innerHTML = `
                <div class="section">
                    <h4>Xuất hóa đơn tự động</h4>
                    <p>Không có sản phẩm nào trong tồn kho để xuất.</p>
                </div>
            `;
            return;
        }

        autoInvoiceTab.innerHTML = `
            <div class="section">
                <h4>Xuất hóa đơn tự động</h4>
                <div class="controls">
                    <label>Số tiền mục tiêu (VND):</label>
                    <input type="number" id="targetAmount" min="1000" value="1000" onchange="validateTargetAmount('${businessId}')">
                    <button onclick="generateAutoInvoice('${businessId}')">🎲 Tạo hóa đơn ngẫu nhiên</button>
                    <button onclick="saveAutoInvoice('${businessId}')">💾 Xuất hóa đơn</button>
                    <button onclick="exportAutoInvoiceToExcel('${businessId}')">📊 Xuất Excel</button>
                </div>
                <table class="compact-table" id="autoInvoiceTable">
                    <thead>
                        <tr>
                            <th>Chọn</th><th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng tồn</th><th>Số lượng xuất</th><th>Giá bán</th><th>Thành tiền</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="autoInvoiceItemsBody"></tbody>
                </table>
                <div id="autoInvoiceTotal">Tổng tiền: 0 VND</div>
            </div>
        `;
        validateTargetAmount(businessId);
    } catch (e) {
        console.error('Lỗi showAutoInvoiceTab:', e);
    }
}

function showRandomExportTab(businessId) {
    try {
        const exportTab = document.getElementById('exportTab');
        if (!exportTab) {
            console.error('Không tìm thấy #exportTab trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId);
        if (inv.length === 0) {
            exportTab.innerHTML = `
                <div class="section">
                    <h4>Xuất hàng random</h4>
                    <p>Không có sản phẩm nào trong tồn kho để xuất.</p>
                </div>
            `;
            return;
        }

        exportTab.innerHTML = `
            <div class="section">
                <h4>Xuất hàng random</h4>
                <div class="controls">
                    <label>Số lượng sản phẩm xuất (tối đa ${inv.length}):</label>
                    <input type="number" id="randomExportCount" min="1" max="${inv.length}" value="1" onchange="validateRandomExportCount('${businessId}')">
                    <button onclick="generateRandomExport('${businessId}')">🎲 Tạo danh sách xuất ngẫu nhiên</button>
                    <button onclick="saveRandomExport('${businessId}')">💾 Xuất hàng</button>
                </div>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>Chọn</th><th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng tồn</th><th>Số lượng xuất</th><th>Đơn giá</th><th>Thành tiền</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="randomExportItemsBody"></tbody>
                </table>
                <div id="randomExportTotal">Tổng tiền: 0 VND</div>
            </div>
        `;
        validateRandomExportCount(businessId);
    } catch (e) {
        console.error('Lỗi showRandomExportTab:', e);
    }
}

// =============================================
// 9. HÀM XỬ LÝ SỰ KIỆN VÀ KHỞI TẠO
// =============================================
async function clearAllData() {
    try {
        if (!confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu (HKD, hóa đơn, tồn kho) và các Gist liên quan trên GitHub?')) {
            return;
        }

        // Xóa toàn bộ localStorage
        localStorage.clear();

        // Xóa các Gist có tên file invoice.html của tài khoản Datkep92
        const token = getGitHubToken();
        if (token) {
            try {
                let page = 1;
                let allGists = [];
                let hasMore = true;

                // Lấy danh sách tất cả Gist của Datkep92
                while (hasMore) {
                    const response = await fetch(`https://api.github.com/users/Datkep92/gists?page=${page}&per_page=100`, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`Lỗi khi lấy danh sách Gist: ${response.statusText}`);
                    }
                    const gists = await response.json();
                    allGists = allGists.concat(gists);
                    hasMore = gists.length === 100; // Tiếp tục nếu trang đầy (100 Gist)
                    page++;
                }

                // Lọc và xóa Gist có file invoice.html
                const deletePromises = allGists
                    .filter(gist => Object.keys(gist.files).includes('invoice.html'))
                    .map(gist => {
                        return fetch(`https://api.github.com/gists/${gist.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `token ${token}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }).then(response => {
                            if (!response.ok) {
                                console.error(`Lỗi khi xóa Gist ${gist.id}: ${response.statusText}`);
                            }
                            return response;
                        });
                    });

                // Chờ tất cả yêu cầu xóa hoàn tất
                await Promise.all(deletePromises);
                console.log('Đã xóa các Gist có file invoice.html');
            } catch (e) {
                console.error('Lỗi khi xóa Gist:', e);
                alert('Không thể xóa một số Gist: ' + e.message);
            }
        } else {
            console.warn('Không có token GitHub, không thể xóa Gist');
            alert('Không tìm thấy token GitHub, chỉ xóa dữ liệu localStorage');
        }

        // Cập nhật giao diện
        businesses = [];
        invoices = [];
        inventory = [];
        exportedInvoices = [];
        updateBusinessList();
        const businessDetails = document.getElementById('businessDetails');
        if (businessDetails) {
            businessDetails.innerHTML = '<h4>Quản lý Hộ Kinh Doanh</h4>';
        }
        const priceListSection = document.getElementById('priceListSection');
        if (priceListSection) priceListSection.remove();
        alert('Đã xóa toàn bộ dữ liệu và các Gist liên quan!');
    } catch (e) {
        console.error('Lỗi clearAllData:', e);
        alert('Lỗi khi xóa dữ liệu: ' + e.message);
    }
}

// Hàm giả lập để lấy token
function getGitHubToken() {
    return localStorage.getItem('githubToken') || null;
}

// Hàm giả lập để cập nhật danh sách doanh nghiệp
function updateBusinessList() {
    console.log('Cập nhật danh sách doanh nghiệp');
}

function toggleDuplicateCheck() {
    try {
        allowDuplicates = !allowDuplicates;
        const toggle = document.getElementById('duplicateToggle');
        if (toggle) {
            toggle.classList.toggle('active');
            toggle.title = `Tắt Trùng Hóa đơn: ${allowDuplicates ? 'TẮT' : 'BẬT'}`;
        } else {
            console.error('Không tìm thấy #duplicateToggle trong DOM');
        }
    } catch (e) {
        console.error('Lỗi toggleDuplicateCheck:', e);
    }
}

function suggestItemName(input) {
    try {
        const text = input.innerText.trim().toLowerCase();
        const inv = inventory.filter(i => i.businessId === selectedBusinessId);
        const suggestions = inv.filter(i => i.name.toLowerCase().includes(text)).map(i => i.name);
        if (suggestions.length > 0 && !suggestions.includes(input.innerText)) {
            input.innerText = suggestions[0];
        }
    } catch (e) {
        console.error('Lỗi suggestItemName:', e);
    }
}


function addUtilityButtons() {
    const controls = document.createElement('div');
    controls.id = 'utilityControls';
    controls.className = 'utility-controls';

    controls.innerHTML = `
        <div class="utility-section">
            <div class="utility-buttons-container">
                <button onclick="undoLastAction()" class="undo-btn" title="Hoàn tác (Ctrl+Z)">
                    ↩ Undo (${undoStack.length}/${MAX_UNDO_STEPS})
                </button>
                <button onclick="restorePreviousSession()" class="restore-btn" title="Khôi phục phiên trước">
                    ↻ Khôi phục
                </button>
<button class="tab-button" onclick="showUpdateSellingPricePopup()">🔄 Cập nhật giá bán</button>
                <button class="tab-button" onclick="showActivityLogPopup()">📝 Lịch sử</button>
                <button onclick="clearAllData()">🗑️ Deletel All</button>
                <button class="tab-button active" onclick="showTab('inventoryTab', this, selectedBusinessId)">Tồn kho</button>
                <button class="tab-button" onclick="showTab('invoicesTab', this, selectedBusinessId)">Hóa đơn</button>
                <button class="tab-button" onclick="showTab('priceListTab', this, selectedBusinessId)">Giá bán</button>
                <button class="tab-button" onclick="showTab('exportHistoryTab', this, selectedBusinessId)">Lịch sử xuất hàng</button>
                <button class="tab-button" onclick="showTab('exportTab', this, selectedBusinessId)">Xuất hàng hóa</button>
                <button class="tab-button" onclick="showExportJsonPopup()">📤 Lưu GIST</button>
                <button class="tab-button" onclick="importFromGist()">📥 Nhập GIST</button>
                <input type="file" id="jsonInput" accept=".json" style="display: none;" onchange="importFromJSON(event)">
            </div>
        </div>
    `;

    document.body.prepend(controls);

    // Phím tắt và cập nhật tự động
    document.addEventListener('keydown', (e) => e.ctrlKey && e.key === 'z' && (e.preventDefault(), undoLastAction()));

    const updateCounter = () => {
        const btn = document.querySelector('.undo-btn');
        if (btn) btn.textContent = `↩ Undo (${undoStack.length}/${MAX_UNDO_STEPS})`;
    };

    const originalPush = Array.prototype.push;
    Array.prototype.push = function () {
        const result = originalPush.apply(this, arguments);
        updateCounter();
        return result;
    };
}


// Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', () => {
    addUtilityButtons();
    updateBusinessList();

    // Nếu có lastActiveBusinessId, hiển thị tab inventory mặc định
    if (lastActiveBusinessId) {
        showTab('inventoryTab', null, lastActiveBusinessId);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const results = businesses.filter(b => b.name.toLowerCase().includes(query) || b.taxCode.includes(query));
            const searchResults = document.getElementById('searchResults');
            if (searchResults) {
                searchResults.innerHTML = results.length ? `
                    <ul>${results.map(b => `<li onclick="showBusinessDetails('${b.id}'); showPriceList('${b.id}'); showExportHistory('${b.id}')">${b.name} (MST: ${b.taxCode})</li>`).join('')}</ul>
                ` : '<p>Không tìm thấy kết quả.</p>';
            }
        });
    }
});



function saveAndExportToGist() {
    const token = document.getElementById('gistTokenInput').value.trim();
    if (token) {
        localStorage.setItem('githubToken', token);
        exportToGist(token);
        closeExportJsonPopup();
    } else {
        alert('Vui lòng nhập GitHub Token!');
    }
}


function importFromGist() {
    try {
        const gistId = 'e8d0145f86b7f95f0d4e10d3b152d9c9';
        fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.github+json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const fileContent = data.files && data.files['data.json'] && data.files['data.json'].content;
                if (!fileContent) {
                    throw new Error('Gist không chứa file data.json hoặc file rỗng!');
                }
                let parsedData;
                try {
                    parsedData = JSON.parse(fileContent);
                } catch (e) {
                    throw new Error('Nội dung JSON không hợp lệ: ' + e.message);
                }
                if (!Array.isArray(parsedData.businesses) ||
                    !Array.isArray(parsedData.invoices) ||
                    !Array.isArray(parsedData.inventory) ||
                    !Array.isArray(parsedData.exportedInvoices)) {
                    throw new Error('Dữ liệu JSON không đúng định dạng! Các trường businesses, invoices, inventory, exportedInvoices phải là mảng.');
                }
                const hasValidBusinesses = parsedData.businesses.every(b => b.id && b.name && b.taxCode && b.address);
                const hasValidInvoices = parsedData.invoices.every(i => i.id && i.businessId && i.mccqt && i.number && i.series && i.date && i.seller && i.items);
                const hasValidInventory = parsedData.inventory.every(i => i.id && i.businessId && i.name && i.unit && i.qty && i.price);
                const hasValidExportedInvoices = parsedData.exportedInvoices.every(e => e.id && e.businessId && e.exportCode && e.exportDate && e.items);
                if (!hasValidBusinesses || !hasValidInvoices || !hasValidInventory || !hasValidExportedInvoices) {
                    throw new Error('Dữ liệu trong JSON không hợp lệ! Vui lòng kiểm tra cấu trúc dữ liệu.');
                }
                const businessIds = new Set(parsedData.businesses.map(b => b.id));
                const invalidInvoices = parsedData.invoices.some(i => !businessIds.has(i.businessId));
                const invalidInventory = parsedData.inventory.some(i => !businessIds.has(i.businessId));
                const invalidExportedInvoices = parsedData.exportedInvoices.some(e => !businessIds.has(e.businessId));
                if (invalidInvoices || invalidInventory || invalidExportedInvoices) {
                    throw new Error('JSON chứa businessId không hợp lệ! Vui lòng đảm bảo tất cả businessId đều tồn tại trong danh sách businesses.');
                }
                saveCurrentState();
                businesses = [...parsedData.businesses];
                invoices = [...parsedData.invoices];
                inventory = [...parsedData.inventory];
                exportedInvoices = [...parsedData.exportedInvoices];
                lastActiveBusinessId = parsedData.lastActiveBusinessId || parsedData.businesses[0]?.id || null;
                localStorage.setItem('businesses', JSON.stringify(businesses));
                localStorage.setItem('invoices', JSON.stringify(invoices));
                localStorage.setItem('inventory', JSON.stringify(inventory));
                localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));
                localStorage.setItem('lastActiveBusinessId', lastActiveBusinessId);
                updateBusinessList(lastActiveBusinessId);
                if (lastActiveBusinessId) {
                    showBusinessDetails(lastActiveBusinessId);
                    showPriceList(lastActiveBusinessId);
                    showExportHistory(lastActiveBusinessId);
                } else {
                    document.getElementById('businessDetails').innerHTML = '';
                    document.getElementById('priceList').innerHTML = '';
                    document.getElementById('exportHistory').innerHTML = '';
                }
                logActivity('import_json_gist', {
                    importedRecords: {
                        businesses: parsedData.businesses.length,
                        invoices: parsedData.invoices.length,
                        inventory: parsedData.inventory.length,
                        exportedInvoices: parsedData.exportedInvoices.length
                    },
                    gistId: gistId,
                    gistUrl: data.html_url
                });
                alert('Đã nhập dữ liệu từ GitHub Gist thành công! URL: ' + data.html_url);
            })
            .catch(error => {
                console.error('Lỗi importFromGist:', error);
                alert('Lỗi khi nhập dữ liệu từ Gist: ' + error.message);
            });
    } catch (e) {
        console.error('Lỗi importFromGist:', e);
        alert('Lỗi khi nhập dữ liệu từ Gist: ' + e.message);
    }
}
// =============================================
// 7. QUẢN LÝ XUẤT HÀNG (EXPORT) - Bổ sung các hàm còn thiếu
// =============================================
/*
// 🎲 Tạo danh sách xuất ngẫu nhiên
function generateExportItems(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0 && normalizeNumber(i.price) > 0);
        if (inv.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Không có sản phẩm để xuất.</td></tr>';
            updateExportTotal(businessId);
            return;
        }

        const targetAmount = normalizeNumber(document.getElementById('targetAmount').value) || 1000000;
        if (targetAmount < 1000) {
            //alert('Số tiền mục tiêu phải lớn hơn hoặc bằng 1,000 VND!');
            document.getElementById('targetAmount').value = 0;
            return;
        }
        const tolerance = targetAmount * 0.10;
        const minAmount = targetAmount - tolerance;
        const maxAmount = targetAmount + tolerance;

        let totalAmount = 0;
        const items = [];
        const availableItems = [...inv].sort((a, b) => calculateSellingPrice(normalizeNumber(b.price)) - calculateSellingPrice(normalizeNumber(a.price)));

        while (availableItems.length > 0 && totalAmount < maxAmount) {
            const item = availableItems[0];
            const maxQty = normalizeNumber(item.qty);
            const sellingPrice = calculateSellingPrice(normalizeNumber(item.price));
            const qty = Math.min(Math.floor((maxAmount - totalAmount) / sellingPrice), maxQty);
            if (qty > 0 && totalAmount + (qty * sellingPrice) <= maxAmount) {
                items.push({ ...item, qty, sellingPrice, itemTotal: qty * sellingPrice });
                totalAmount += qty * sellingPrice;
                availableItems.shift();
            } else {
                availableItems.shift();
            }
        }

        if (items.length === 0 || totalAmount < minAmount) {
            tbody.innerHTML = '<tr><td colspan="8">Không thể tạo danh sách với số tiền mục tiêu.</td></tr>';
        } else {
            tbody.innerHTML = items.map((item, index) => `
                <tr data-item-id="${item.id}">
                    <td><input type="checkbox" class="export-checkbox" checked onchange="updateExportTotal('${businessId}')"></td>
                    <td>${item.name}</td>
                    <td>${item.unit}</td>
                    <td>${item.qty}</td>
                    <td><input type="number" class="export-qty" value="${item.qty}" min="1" max="${item.qty}" onchange="updateExportTotal('${businessId}')"></td>
                    <td>${formatMoney(item.sellingPrice)} VND</td>
                    <td><span class="export-total">${formatMoney(item.itemTotal)} VND</span></td>
                    <td><button onclick="removeExportItem('${item.id}')">❌</button></td>
                </tr>
            `).join('');
        }
        updateExportTotal(businessId);
    } catch (e) {
        console.error('Lỗi generateExportItems:', e);
        alert('Lỗi khi tạo danh sách xuất: ' + e.message);
    }
}
*/
function showPreviewModal(businessId) {
    const tbody = document.getElementById('exportItemsBodyContent');
    if (!tbody || tbody.querySelectorAll('tr').length === 0) {
        alert('Vui lòng tạo danh sách xuất trước khi xem trước!');
        return;
    }

    const modal = document.getElementById('exportPreviewModal');
    const previewBody = document.getElementById('previewBody');
    previewBody.innerHTML = '';

    const customerNameInput = document.getElementById('customerName')?.value || randomCustomerName();
    const customerAddressInput = document.getElementById('customerAddress')?.value || randomAddressNinhThuan();
    document.getElementById('previewCustomerName').value = customerNameInput;
    document.getElementById('previewCustomerAddress').value = customerAddressInput;

    let grandTotal = 0;
    const items = [];

    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
        const checkbox = row.querySelector('.export-checkbox');
        if (checkbox && checkbox.checked) {
            const itemId = row.getAttribute('data-item-id') || '';
            const name = row.cells[1].innerText || '';
            const unit = row.cells[2].innerText || '';
            const qty = normalizeNumber(row.querySelector('.export-qty')?.value) || 0;
            const sellingPrice = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
            const itemTotal = qty * sellingPrice;
            grandTotal += itemTotal;
            items.push({ itemId, name, unit, qty, sellingPrice, itemTotal });
        }
    });

    // Dòng đầu tiên
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <td contenteditable="true">1</td>
        <td contenteditable="true">${getTodayDDMMYYYY()}</td>
        <td contenteditable="true">KH${Math.floor(Math.random() * 1000) + 1000}</td>
        <td contenteditable="true">${customerNameInput}</td>
        <td contenteditable="true">${customerNameInput}</td>
        <td contenteditable="true">${customerAddressInput}</td>
        <td contenteditable="true">TM</td>
        <td contenteditable="true">${items.length > 0 ? items[0].itemId : ''}</td>
        <td contenteditable="true">${items.length > 0 ? items[0].name : ''}</td>
        <td contenteditable="true">${items.length > 0 ? items[0].unit : ''}</td>
        <td contenteditable="true">${items.length > 0 ? items[0].qty : ''}</td>
        <td contenteditable="true">${items.length > 0 ? items[0].sellingPrice : ''}</td>
        <td contenteditable="true">${items.length > 0 ? formatMoney(items[0].itemTotal) : ''}</td>
        <td contenteditable="true">${formatMoney(grandTotal)}</td>
        <td contenteditable="true">VND</td>
        <td contenteditable="true">mau_01</td>
    `;
    previewBody.appendChild(headerRow);

    // Các dòng sản phẩm
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td contenteditable="true">${index + 2}</td>
            <td contenteditable="true">${getTodayDDMMYYYY()}</td>
            <td contenteditable="true">KH${Math.floor(Math.random() * 1000) + 1000}</td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true">TM</td>
            <td contenteditable="true">${item.itemId}</td>
            <td contenteditable="true">${item.name}</td>
            <td contenteditable="true">${item.unit}</td>
            <td contenteditable="true">${item.qty}</td>
            <td contenteditable="true">${item.sellingPrice}</td>
            <td contenteditable="true">${formatMoney(item.itemTotal)}</td>
            <td contenteditable="true"></td>
            <td contenteditable="true">VND</td>
            <td contenteditable="true">mau_01</td>
        `;
        previewBody.appendChild(row);
    });

    modal.style.display = 'block';
}

function closePreviewModal() {
    document.getElementById('exportPreviewModal').style.display = 'none';
}

function saveAndExport(businessId) {
    const previewBody = document.getElementById('previewBody');
    const rows = [];
    const customerName = document.getElementById('previewCustomerName').value || randomCustomerName();
    const customerAddress = document.getElementById('previewCustomerAddress').value || randomAddressNinhThuan();
    let grandTotal = 0;

    Array.from(previewBody.querySelectorAll('tr')).forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('td'));
        const rowData = cells.map(cell => {
            const dataValue = cell.getAttribute('data-value');
            let value = dataValue !== null ? dataValue : cell.innerText.trim();
            const colIndex = cells.indexOf(cell);
            // Xử lý các cột số (SoLuong, DonGia, ThanhTien, TongCong) thành số nguyên
            if ([10, 11, 12, 13].includes(colIndex)) { // Cột SoLuong, DonGia, ThanhTien, TongCong
                value = parseInt(value.replace(/[^\d]/g, '')) || 0; // Loại bỏ ký tự không phải số
            }
            return value;
        });
        if (index === 0) {
            rowData[3] = customerName; // TenKhachHang
            rowData[4] = customerName; // TenNguoiMua
            rowData[6] = customerAddress; // DiaChiKhachHang
            grandTotal = parseInt(rowData[13].replace(/[^\d]/g, '')) || 0; // TongCong dòng 1
        } else {
            const qty = parseInt(rowData[10].replace(/[^\d]/g, '')) || 0; // SoLuong
            const price = parseInt(rowData[11].replace(/[^\d]/g, '')) || 0; // DonGia
            rowData[12] = qty * price; // ThanhTien
            rowData[13] = qty * price; // TongCong cho dòng sản phẩm
            grandTotal += qty * price; // Cộng dồn vào tổng
        }
        rows.push(rowData);
    });

    // Cập nhật TongCong cho dòng 1 với tổng của tất cả sản phẩm
    if (rows.length > 1) {
        rows[0][13] = grandTotal; // Đảm bảo TongCong dòng 1 là tổng
    }

    console.log('Dữ liệu xuất:', rows); // Debug để kiểm tra
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HoaDon');
    XLSX.writeFile(wb, `HoaDonXuat_${businessId}_${Date.now()}.xlsx`);
    closePreviewModal();
}

// Thay nút xuất Excel gọi showPreviewModal
document.querySelector('button[onclick*="exportToExcel"]').setAttribute('onclick', `showPreviewModal('${businessId}')`);
// 💾 Lưu xuất hàng hóa
function saveExport(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            console.error('Không tìm thấy #exportItemsBodyContent hoặc bảng trống');
            alert('Vui lòng tạo danh sách xuất trước khi lưu!');
            return;
        }

        // Thực hiện xuất Excel trước
        exportToExcel(businessId);

        // Sau khi xuất Excel thành công, tiếp tục lưu dữ liệu xuất hàng
        const items = [];
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            const itemId = row.getAttribute('data-item-id');
            const item = inventory.find(i => i.id === itemId && i.businessId === businessId);
            const qtyInput = row.querySelector('.export-qty');
            const qty = normalizeNumber(qtyInput?.value) || 0;
            const sellingPrice = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
            const totalCell = row.querySelector('.export-total');

            if (item && checkbox && checkbox.checked && qty > 0) {
                if (qty > normalizeNumber(item.qty)) {
                    alert(`Số lượng xuất (${qty}) vượt quá tồn kho (${item.qty}) cho ${item.name}!`);
                    throw new Error('Số lượng xuất không hợp lệ');
                }
                items.push({
                    id: itemId,
                    name: item.name,
                    unit: item.unit,
                    qty: qty.toString(),
                    price: sellingPrice.toString(),
                    total: normalizeNumber(totalCell?.innerText.replace(/[^\d.,]/g, '') || (qty * sellingPrice)).toString()
                });
            }
        });

        if (items.length === 0) {
            alert('Vui lòng chọn ít nhất một sản phẩm để xuất!');
            return;
        }

        const grandTotal = items.reduce((sum, item) => sum + normalizeNumber(item.total), 0);
        logActivity('export_create', {
            businessId: businessId,
            itemCount: items.length,
            totalAmount: grandTotal,
            customerName: document.getElementById('customerName')?.value || 'Không xác định'
        });
        const exportRecord = {
            id: generateUUID(),
            businessId,
            exportCode: 'EXP-' + Date.now(),
            exportDate: new Date().toISOString(),
            items,
            grandTotal: grandTotal.toString()
        };

        exportedInvoices.push(exportRecord);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        items.forEach(item => {
            const invItem = inventory.find(i => i.id === item.id && i.businessId === businessId);
            if (invItem) {
                invItem.qty = (normalizeNumber(invItem.qty) - normalizeNumber(item.qty)).toString();
                invItem.lastUpdated = new Date().toISOString();
                if (normalizeNumber(invItem.qty) <= 0) {
                    inventory = inventory.filter(i => i.id !== invItem.id);
                }
            }
        });
        localStorage.setItem('inventory', JSON.stringify(inventory));

        document.getElementById('exportTab').innerHTML = '';
        alert('Đã xuất hàng hóa và lưu dữ liệu thành công!');
    } catch (e) {
        console.error('Lỗi saveExport:', e);
        if (e.message !== 'Số lượng xuất không hợp lệ') {
            alert('Lỗi khi xuất hàng hóa: ' + e.message);
        }
    }
}
// 📤 Xuất hóa đơn Excel
function exportToExcel(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody || tbody.querySelectorAll('tr').length === 0) {
            alert('Vui lòng tạo danh sách xuất trước khi xuất Excel!');
            return;
        }

        // Lấy thông tin khách hàng từ input hoặc random nếu không nhập
        const customerNameInput = document.getElementById('customerName');
        const customerAddressInput = document.getElementById('customerAddress');
        const customerName = customerNameInput.value.trim() || randomCustomerName();
        const customerAddress = customerAddressInput.value.trim() || randomAddressNinhThuan();

        const rows = [headers];
        let grandTotal = 0;
        const items = [];

        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            if (checkbox && checkbox.checked) {
                const itemId = row.getAttribute('data-item-id') || '';
                const name = row.cells[1].innerText || '';
                const unit = row.cells[2].innerText || '';
                const qty = normalizeNumber(row.querySelector('.export-qty')?.value) || 0;
                const sellingPrice = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
                const itemTotal = qty * sellingPrice;
                grandTotal += itemTotal;
                items.push({ itemId, name, unit, qty, sellingPrice, itemTotal });
            }
        });

        // Dòng đầu tiên (thông tin chung)
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon
        headerRow[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerName; // TenKhachHang
        headerRow[4] = customerName; // TenNguoiMua
        headerRow[6] = customerAddress; // DiaChiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT
        if (items.length > 0) {
            headerRow[11] = items[0].itemId; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].sellingPrice; // DonGia
            headerRow[20] = items[0].itemTotal; // ThanhTien
        }
        headerRow[26] = grandTotal; // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rows.push(headerRow);

        // Các dòng sản phẩm
        items.forEach((item, index) => {
            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 2; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.itemId; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.sellingPrice; // DonGia
            rowData[20] = item.itemTotal; // ThanhTien
            rowData[26] = item.itemTotal; // TongCong (cho từng dòng)
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rows.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDon');
        XLSX.writeFile(wb, `HoaDonXuat_${businessId}_${Date.now()}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportToExcel:', e);
        alert('Lỗi khi xuất file Excel: ' + e.message);
    }
}
// =============================================
// 5. QUẢN LÝ TỒN KHO (INVENTORY) - Bổ sung các hàm còn thiếu
// =============================================

// ➕ Thêm tồn kho thủ công
function showManualInventoryForm() {
    try {
        const manualInventoryForm = document.getElementById('manualInventoryForm');
        if (manualInventoryForm) {
            manualInventoryForm.classList.remove('hidden');
            addManualInventoryItem();
        } else {
            console.error('Không tìm thấy #manualInventoryForm trong DOM');
        }
    } catch (e) {
        console.error('Lỗi showManualInventoryForm:', e);
    }
}

function hideManualInventoryForm() {
    try {
        const manualInventoryForm = document.getElementById('manualInventoryForm');
        if (manualInventoryForm) {
            manualInventoryForm.classList.add('hidden');
        }
        const manualInventoryItemsBody = document.getElementById('manualInventoryItemsBody');
        if (manualInventoryItemsBody) {
            manualInventoryItemsBody.innerHTML = '';
        }
    } catch (e) {
        console.error('Lỗi hideManualInventoryForm:', e);
    }
}

function addManualInventoryItem() {
    try {
        const tbody = document.getElementById('manualInventoryItemsBody');
        if (!tbody) {
            console.error('Không tìm thấy #manualInventoryItemsBody trong DOM');
            return;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td contenteditable="true" oninput="suggestItemName(this)"></td>
            <td contenteditable="true">Cái</td>
            <td contenteditable="true">1</td>
            <td contenteditable="true">0</td>
            <td contenteditable="true">10%</td>
            <td>0</td>
            <td><button onclick="this.parentNode.parentNode.remove()">❌</button></td>
        `;
        tbody.appendChild(row);
        row.querySelectorAll('td[contenteditable="true"]').forEach(td => {
            td.addEventListener('input', function () {
                if (td.cellIndex === 2 || td.cellIndex === 3) {
                    const qty = normalizeNumber(row.cells[2].innerText);
                    const price = normalizeNumber(row.cells[3].innerText);
                    row.cells[5].innerText = formatMoney(qty * price);
                }
            });
        });
        row.classList.add('new-item');
        setTimeout(() => row.classList.remove('new-item'), 2000);
    } catch (e) {
        console.error('Lỗi addManualInventoryItem:', e);
    }
}

function calculateSellingPrice(cost) {
    const percentage = parseFloat(localStorage.getItem('sellingPricePercentage')) || 0.10;
    const fixedAmount = parseFloat(localStorage.getItem('sellingPriceFixedAmount')) || 3000;
    console.log('calculateSellingPrice:', { cost, percentage, fixedAmount });
    const price = cost * (1 + percentage) + fixedAmount;
    return Math.ceil(price / 500) * 500;
}

function saveManualInventory(businessId) {
    try {
        const form = document.getElementById('manualInventoryForm');
        const name = form.querySelector('#inventoryName').value.trim();
        const unit = form.querySelector('#inventoryUnit').value.trim();
        const qty = form.querySelector('#inventoryQty').value.trim();
        const price = form.querySelector('#inventoryPrice').value.trim();
        const vat = form.querySelector('#inventoryVat').value.trim() || '10%';

        if (!name || !unit || !qty || !price) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        const basePrice = normalizeNumber(price);
        const qtyNum = normalizeNumber(qty);
        const vatRate = parseFloat(vat.replace('%', '')) / 100;

        if (isNaN(basePrice) || isNaN(qtyNum) || qtyNum <= 0) {
            alert('Số lượng và giá phải là số hợp lệ!');
            return;
        }

        const taxAmount = basePrice * vatRate * qtyNum;
        const newItem = {
            id: generateUUID(),
            businessId,
            stt: (inventory.length + 1).toString(),
            type: 'Hàng hóa, dịch vụ',
            name,
            unit,
            qty: qtyNum.toString(),
            price,
            discount: '0',
            vat,
            total: formatMoney(qtyNum * basePrice),
            taxAmount: formatMoney(taxAmount),
            totalAfterTax: formatMoney((basePrice * qtyNum) + taxAmount),
            giaBan: formatMoney(calculateSellingPrice(basePrice)),
            lastUpdated: new Date().toISOString()
        };

        console.log('saveManualInventory:', { businessId, name, price, giaBan: newItem.giaBan });

        saveCurrentState();
        inventory.push(newItem);
        localStorage.setItem('inventory', JSON.stringify(inventory));

        logActivity('manual_inventory_add', {
            businessId,
            name,
            qty: qtyNum,
            price: basePrice,
            giaBan: newItem.giaBan
        });

        showBusinessInventory(businessId);
        form.reset();
        alert('Đã thêm mặt hàng vào tồn kho!');
    } catch (e) {
        console.error('Lỗi saveManualInventory:', e);
        alert('Lỗi khi thêm mặt hàng: ' + e.message);
    }
}


// 📊 Xuất Excel Tồn kho
function exportInventoryToExcel(businessId) {
    try {
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            alert('Không có sản phẩm nào trong tồn kho để xuất!');
            return;
        }

        const rows = [];
        const headers = ['STT', 'MaSanPham', 'TenSanPham', 'DonViTinh', 'SoLuongTon', 'DonGia', 'DiaChi', 'TenKhachHang'];
        rows.push(headers);

        inv.forEach((item, index) => {
            const rowData = [];
            rowData[0] = index + 1; // STT
            rowData[1] = item.id; // MaSanPham
            rowData[2] = item.name; // TenSanPham
            rowData[3] = item.unit; // DonViTinh
            rowData[4] = item.qty; // SoLuongTon
            rowData[5] = item.price; // DonGia
            rowData[6] = `Địa chỉ ${Math.floor(Math.random() * 1000) + 1}, Ninh Thuận`; // DiaChi random
            rowData[7] = `Khách ${Math.floor(Math.random() * 1000) + 1}`; // TenKhachHang random
            rows.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DanhMucHangHoa');
        XLSX.writeFile(wb, `DanhMucHangHoa_${businessId}_${Date.now()}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportInventoryToExcel:', e);
        alert('Lỗi khi xuất danh mục: ' + e.message);
    }
}

// 📊 Xuất Excel Bảng giá
function exportPriceListToExcel(businessId) {
    try {
        const inv = inventory.filter(i => i.businessId === businessId);
        if (inv.length === 0) {
            alert('Không có sản phẩm nào trong tồn kho để xuất bảng giá!');
            return;
        }

        const wb = XLSX.utils.book_new();
        const wsData = inv.map(i => {
            const taxRate = parseFloat(i.vat.replace('%', '')) / 100 || 0.1;
            const giaSanPham = normalizeNumber(i.price) * (1 + taxRate) + 2000;
            return {
                'Mã sản phẩm': generateUUID().substring(0, 8),
                'Tên sản phẩm': i.name,
                'Giá sản phẩm': giaSanPham,
                'Đơn vị tính': i.unit,
                'Mô tả': i.name
            };
        });
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Bảng giá');
        XLSX.writeFile(wb, `bang_gia_${businessId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        console.error('Lỗi exportPriceListToExcel:', e);
        alert('Lỗi khi xuất Excel bảng giá: ' + e.message);
    }
}


// =============================================
// 10. CẬP NHẬT HÀM XỬ LÝ SỰ KIỆN VÀ KHỞI TẠO
// =============================================

// Thêm các sự kiện vào hàm khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    updateBusinessList();

    // Sự kiện tìm kiếm
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const results = businesses.filter(b => b.name.toLowerCase().includes(query) || b.taxCode.includes(query));
            const searchResults = document.getElementById('searchResults');
            if (searchResults) {
                searchResults.innerHTML = results.length ? `
                    <ul>${results.map(b => `<li onclick="showBusinessDetails('${b.id}'); showPriceList('${b.id}'); showExportHistory('${b.id}')">${b.name} (MST: ${b.taxCode})</li>`).join('')}</ul>
                ` : '<p>Không tìm thấy kết quả.</p>';
            }
        });
    }

    // Thêm nút vào giao diện
    const inventoryControls = document.getElementById('inventoryControls');
    if (inventoryControls) {
        inventoryControls.innerHTML += `
            <button onclick="showManualInventoryForm()">➕ Tồn kho thủ công</button>
            <button onclick="exportInventoryToExcel(selectedBusinessId)">📊 Xuất Excel Tồn kho</button>
            <button onclick="exportPriceListToExcel(selectedBusinessId)">📊 Xuất Excel Bảng giá</button>
        `;
    }

    // Thêm form tồn kho thủ công vào HTML (nếu chưa có)
    if (!document.getElementById('manualInventoryForm')) {
        const form = document.createElement('div');
        form.id = 'manualInventoryForm';
        form.className = 'hidden';
        form.innerHTML = `
            <div class="form-container">
                <h4>Nhập tồn kho thủ công</h4>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế suất</th><th>Thành tiền</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="manualInventoryItemsBody"></tbody>
                </table>
                <div class="form-actions">
                    <button onclick="addManualInventoryItem()">➕ Thêm dòng</button>
                    <button onclick="saveManualInventory()">💾 Lưu</button>
                    <button onclick="hideManualInventoryForm()">❌ Hủy</button>
                </div>
            </div>
        `;
        document.body.appendChild(form);
    }
});

// Cập nhật tổng tiền xuất hàng
function updateExportTotal(businessId) {
    try {
        const tbody = document.getElementById('exportItemsBodyContent');
        if (!tbody) {
            console.error('Không tìm thấy #exportItemsBodyContent trong DOM');
            return;
        }
        let total = 0;
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
            const checkbox = row.querySelector('.export-checkbox');
            const qtyInput = row.querySelector('.export-qty');
            if (checkbox && qtyInput && checkbox.checked) {
                const qty = normalizeNumber(qtyInput.value) || 0;
                const sellingPrice = normalizeNumber(row.cells[5].innerText.replace(/[^\d.,]/g, '')) || 0;
                const totalCell = row.querySelector('.export-total');
                const itemTotal = qty * sellingPrice;
                totalCell.innerText = `${formatMoney(itemTotal)} VND`;
                total += itemTotal;
            } else {
                row.querySelector('.export-total').innerText = '0 VND';
            }
        });
        const exportTotal = document.getElementById('exportTotal');
        if (exportTotal) {
            exportTotal.innerText = `Tổng tiền: ${formatMoney(total)} VND`;
        }
    } catch (e) {
        console.error('Lỗi updateExportTotal:', e);
    }
}

function getBusinessInventorySummary(businessId) {
    try {
        const inv = inventory.filter(i => i.businessId === businessId);
        let totalItems = inv.length;
        let totalQuantity = 0;
        let totalCostValue = 0;
        let totalSellingValue = 0;

        inv.forEach(i => {
            const qty = normalizeNumber(i.qty);
            const price = normalizeNumber(i.price);
            const giaBan = normalizeNumber(i.giaBan || calculateSellingPrice(price));
            const vatRate = parseFloat((i.vat || '10%').replace('%', '')) / 100;
            const taxAmount = price * vatRate * qty;

            totalQuantity += qty;
            totalCostValue += (price * qty) + taxAmount;
            totalSellingValue += giaBan * qty;
            console.log('Tính tổng hợp:', { id: i.id, name: i.name, qty, price, giaBan });
        });

        return {
            totalItems,
            totalQuantity,
            totalCostValue,
            totalSellingValue
        };
    } catch (e) {
        console.error('Lỗi getBusinessInventorySummary:', e);
        return { totalItems: 0, totalQuantity: 0, totalCostValue: 0, totalSellingValue: 0 };
    }
}

function getRecentImportHistory(businessId, limit = 3) {
    const businessInvoices = invoices
        .filter(i => i.businessId === businessId && i.direction === 'input')
        .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
        .slice(0, limit);

    return businessInvoices.map(invoice => {
        const totalBeforeTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            return sum + (qty * price); // Không trừ chiết khấu
        }, 0);
        const totalTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            return sum + (qty * price * vatRate); // Thuế trên giá trị chưa trừ chiết khấu
        }, 0);
        const totalDiscount = invoice.items.reduce((sum, item) => {
            return sum + normalizeNumber(item.discount || '0');
        }, 0);
        const totalCost = totalBeforeTax + totalTax - totalDiscount; // Trừ chiết khấu một lần

        const totalSelling = invoice.items.reduce((sum, item) => {
            const cost = normalizeNumber(item.price);
            const selling = calculateSellingPrice(cost);
            return sum + (normalizeNumber(item.qty) * selling);
        }, 0);

        return {
            date: invoice.uploadDate,
            invoiceNumber: `${invoice.series}-${invoice.number}`,
            itemCount: invoice.items.length,
            totalQuantity: invoice.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0),
            totalCost,
            totalSelling
        };
    });
}


function renderImportHistory(imports) {
    if (imports.length === 0) return '<p>Chưa có lịch sử nhập hàng</p>';

    return `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Số HĐ</th>
                    <th>SL hàng</th>
                    <th>Giá trị nhập</th>
                    <th>Giá trị bán</th>
                    <th>Tồn kho sau nhập</th>
                    <th>Giá bán tồn</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                ${imports.map(imp => {
        const statusColor = checkInvoice(imp.invoice);
        const remainingStock = calculateRemainingStock(imp.invoice);
        const remainingValue = remainingStock.totalCost;
        const remainingSellingValue = remainingStock.totalSelling;

        return `
                        <tr style="background-color: ${statusColor}">
                            <td>${new Date(imp.date).toLocaleDateString('vi-VN')}</td>
                            <td>${imp.invoiceNumber}</td>
                            <td>${formatMoney(imp.totalQuantity)}</td>
                            <td>${formatMoney(imp.totalCost)}</td>
                            <td>${formatMoney(imp.totalSelling)}</td>
                            <td>${formatMoney(remainingValue)}</td>
                            <td>${formatMoney(remainingSellingValue)}</td>
                            <td class="actions">
                                <button onclick="showInvoiceDetails('${imp.invoiceId}')">📄 Xem</button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function renderImportHistory(imports) {
    if (imports.length === 0) return '<p>Chưa có lịch sử nhập hàng</p>';

    return `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Số HĐ</th>
                    <th>SL hàng</th>
                    <th>Giá trị nhập</th>
                    <th>Giá trị bán</th>
                    <th>Tồn kho sau nhập</th>
                    <th>Giá bán tồn</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                ${imports.map(imp => {
        const statusColor = checkInvoice(imp.invoice);
        const remainingStock = calculateRemainingStock(imp.invoice);
        const remainingValue = remainingStock.totalCost;
        const remainingSellingValue = remainingStock.totalSelling;

        return `
                        <tr style="background-color: ${statusColor}">
                            <td>${new Date(imp.date).toLocaleDateString('vi-VN')}</td>
                            <td>${imp.invoiceNumber}</td>
                            <td>${formatMoney(imp.totalQuantity)}</td>
                            <td>${formatMoney(imp.totalCost)}</td>
                            <td>${formatMoney(imp.totalSelling)}</td>
                            <td>${formatMoney(remainingValue)}</td>
                            <td>${formatMoney(remainingSellingValue)}</td>
                            <td class="actions">
                                <button onclick="showInvoiceDetails('${imp.invoiceId}')">📄 Xem</button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Hàm helper tính tồn kho sau nhập
function calculateRemainingStock(invoice) {
    const currentInventory = inventory.filter(i => i.businessId === invoice.businessId);
    let totalCost = 0;
    let totalSelling = 0;

    currentInventory.forEach(item => {
        const qty = normalizeNumber(item.qty);
        const cost = normalizeNumber(item.price);
        const selling = calculateSellingPrice(cost);

        totalCost += qty * cost;
        totalSelling += qty * selling;
    });

    return { totalCost, totalSelling };
}

function renderExportHistory(exports) {
    if (exports.length === 0) return '<p>Chưa có lịch sử xuất hàng</p>';

    return `
        <table class="compact-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Khách hàng</th>
                    <th>SL hàng</th>
                    <th>Giá trị xuất</th>
                    <th>Giá trị bán</th>
                </tr>
            </thead>
            <tbody>
                ${exports.map(exp => `
                    <tr>
                        <td>${new Date(exp.date).toLocaleDateString('vi-VN')}</td>
                        <td>${exp.customerName}</td>
                        <td>${formatMoney(exp.totalQuantity)}</td>
                        <td>${formatMoney(exp.totalCost)}</td>
                        <td>${formatMoney(exp.totalSelling)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showMoreImportHistory(businessId) {
    const allImports = getRecentImportHistory(businessId, 100); // Lấy tất cả
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
            <h4>Toàn bộ lịch sử nhập hàng</h4>
            ${renderImportHistory(allImports)}
        </div>
    `;
    document.body.appendChild(popup);
}

function showMoreExportHistory(businessId) {
    const allExports = getRecentExportHistory(businessId, 100); // Lấy tất cả
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
            <h4>Toàn bộ lịch sử xuất hàng</h4>
            ${renderExportHistory(allExports)}
        </div>
    `;
    document.body.appendChild(popup);
}
// Hàm mới
function getBusinessInventorySummary(businessId) {
    const inv = inventory.filter(i => i.businessId === businessId);
    let totalItems = 0;
    let totalQuantity = 0;
    let totalCostValue = 0; // Giá trị nhập đã bao gồm thuế
    let totalSellingValue = 0;

    inv.forEach(item => {
        totalItems++;
        const qty = normalizeNumber(item.qty);
        const price = normalizeNumber(item.price);
        const discount = normalizeNumber(item.discount || '0');
        const vatRate = parseFloat((item.vat || '10%').replace('%', '')) / 100;

        // Tính toán giống như trong hóa đơn
        const itemTotalBeforeTax = qty * price - discount;
        const itemTax = itemTotalBeforeTax * vatRate;
        const itemTotal = itemTotalBeforeTax + itemTax;

        totalQuantity += qty;
        totalCostValue += itemTotal;
        totalSellingValue += qty * calculateSellingPrice(price);
    });

    return {
        totalItems,
        totalQuantity,
        totalCostValue,
        totalSellingValue
    };
}
function getRecentImportHistory(businessId, limit = 3) {
    const businessInvoices = invoices
        .filter(i => i.businessId === businessId && i.direction === 'input')
        .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
        .slice(0, limit);

    return businessInvoices.map(invoice => {
        // Tính tổng tiền bao gồm thuế và trừ chiết khấu
        const netTotal = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            return sum + (qty * price - discount);
        }, 0);
        const totalTax = invoice.items.reduce((sum, item) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            return sum + ((qty * price - discount) * vatRate);
        }, 0);
        const totalCost = netTotal + totalTax;

        const totalSelling = invoice.items.reduce((sum, item) => {
            const cost = normalizeNumber(item.price);
            const selling = calculateSellingPrice(cost);
            return sum + (normalizeNumber(item.qty) * selling);
        }, 0);

        return {
            date: invoice.uploadDate,
            invoiceNumber: `${invoice.series}-${invoice.number}`,
            itemCount: invoice.items.length,
            totalQuantity: invoice.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0),
            totalCost, // Bây giờ bao gồm thuế và trừ chiết khấu
            totalSelling
        };
    });
}
function renderImportHistory(imports) {
    if (imports.length === 0) return '<p>Chưa có lịch sử nhập hàng</p>';

    return `
        <table class="compact-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Số HĐ</th>
                    <th>SL hàng</th>
                    <th>Giá trị nhập</th>
                    <th>Giá trị bán</th>
                </tr>
            </thead>
            <tbody>
                ${imports.map(imp => `
                    <tr>
                        <td>${new Date(imp.date).toLocaleDateString('vi-VN')}</td>
                        <td>${imp.invoiceNumber}</td>
                        <td>${formatMoney(imp.totalQuantity)}</td>
                        <td>${formatMoney(imp.totalCost)}</td>
                        <td>${formatMoney(imp.totalSelling)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderExportHistory(exports) {
    if (exports.length === 0) return '<p>Chưa có lịch sử xuất hàng</p>';

    return `
        <table class="compact-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Khách hàng</th>
                    <th>SL hàng</th>
                    <th>Giá trị xuất</th>
                    <th>Giá trị bán</th>
                </tr>
            </thead>
            <tbody>
                ${exports.map(exp => `
                    <tr>
                        <td>${new Date(exp.date).toLocaleDateString('vi-VN')}</td>
                        <td>${exp.customerName}</td>
                        <td>${formatMoney(exp.totalQuantity)}</td>
                        <td>${formatMoney(exp.totalCost)}</td>
                        <td>${formatMoney(exp.totalSelling)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showMoreImportHistory(businessId) {
    const allImports = getRecentImportHistory(businessId, 100); // Lấy tất cả
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
            <h4>Toàn bộ lịch sử nhập hàng</h4>
            ${renderImportHistory(allImports)}
        </div>
    `;
    document.body.appendChild(popup);
}

function showMoreExportHistory(businessId) {
    const allExports = getRecentExportHistory(businessId, 100); // Lấy tất cả
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
            <h4>Toàn bộ lịch sử xuất hàng</h4>
            ${renderExportHistory(allExports)}
        </div>
    `;
    document.body.appendChild(popup);
}
function getRecentExportHistory(businessId, limit = 3) {
    try {
        const exportRecords = exportedInvoices
            .filter(i => i.businessId === businessId)
            .sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate))
            .slice(0, limit);

        return exportRecords.map(record => {
            const totalCost = record.items.reduce((sum, item) => sum + normalizeNumber(item.price) * normalizeNumber(item.qty), 0);
            const totalSelling = record.items.reduce((sum, item) => {
                const selling = calculateSellingPrice(normalizeNumber(item.price));
                return sum + (normalizeNumber(item.qty) * selling);
            }, 0);

            return {
                date: record.exportDate,
                customerName: record.customerName || 'Khách lẻ', // Fallback if customerName is undefined
                itemCount: record.items.length,
                totalQuantity: record.items.reduce((sum, item) => sum + normalizeNumber(item.qty), 0),
                totalCost,
                totalSelling
            };
        });
    } catch (e) {
        console.error('Lỗi getRecentExportHistory:', e);
        return [];
    }
}


// =============================================
// 11. HÓA ĐƠN THỦ CÔNG (MANUAL INVOICE)
// =============================================

function showManualInvoicePopup(businessId) {
    try {
        // Kiểm tra tồn kho
        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            alert('Không có hàng hóa trong tồn kho để xuất!');
            return;
        }

        // Tạo popup
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <div class="popup-content" style="max-width: 1260px;">
                <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
                <h4>Nhập hóa đơn thủ công</h4>
                
                <div class="customer-info">
                    <div class="form-group">
                        <label>Họ tên khách hàng:</label>
                        <input type="text" id="manualCustomerName" placeholder="Nhập họ tên">
                    </div>
                    <div class="form-group">
                        <label>Địa chỉ:</label>
                        <input type="text" id="manualCustomerAddress" placeholder="Nhập địa chỉ">
                    </div>
                    <div class="form-group">
                        <label>Số điện thoại:</label>
                        <input type="text" id="manualCustomerPhone" placeholder="Nhập số điện thoại">
                    </div>
                    <div class="form-group">
                        <label>Mã số thuế (nếu có):</label>
                        <input type="text" id="manualCustomerTaxCode" placeholder="Nhập MST">
                    </div>
                </div>
                
                <div class="invoice-items">
                    <h5>Bảng kê hàng hóa</h5>
                    <table class="compact-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Tên hàng hóa</th>
                                <th>Đơn vị</th>
                                <th>Số lượng tồn</th>
                                <th>Số lượng xuất</th>
                                <th>Đơn giá</th>
                                <th>Thành tiền</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody id="manualInvoiceItemsBody"></tbody>
                    </table>
                    <button onclick="addManualInvoiceItem('${businessId}')">➕ Thêm hàng hóa</button>
                </div>
                
                <div class="invoice-summary">
                    <div>Tổng tiền: <span id="manualInvoiceTotal">0</span> VND</div>
                </div>
                
                <div class="form-actions">
                    <button onclick="saveManualInvoice('${businessId}')" class="primary">💾 Lưu hóa đơn</button>
                    <button onclick="exportManualInvoice('${businessId}')" class="secondary">📤 Xuất Excel</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Thêm 1 dòng hàng hóa mặc định
        addManualInvoiceItem(businessId);

    } catch (e) {
        console.error('Lỗi showManualInvoicePopup:', e);
        alert('Lỗi khi tạo popup hóa đơn thủ công: ' + e.message);
    }
}

function addManualInvoiceItem(businessId) {
    try {
        const tbody = document.getElementById('manualInvoiceItemsBody');
        if (!tbody) {
            console.error('Không tìm thấy #manualInvoiceItemsBody trong DOM');
            return;
        }

        const inv = inventory.filter(i => i.businessId === businessId && normalizeNumber(i.qty) > 0);
        if (inv.length === 0) {
            alert('Không có hàng hóa trong tồn kho!');
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tbody.querySelectorAll('tr').length + 1}</td>
            <td>
                <select class="item-select" onchange="updateManualInvoiceItem(this, '${businessId}')">
                    <option value="">-- Chọn hàng hóa --</option>
                    ${inv.map(item => `<option value="${item.id}" data-unit="${item.unit}" data-price="${item.price}" data-qty="${item.qty}">${item.name}</option>`).join('')}
                </select>
            </td>
            <td class="item-unit"></td>
            <td class="item-stock"></td>
            <td><input type="number" class="item-qty" min="1" value="1" onchange="updateManualInvoiceTotal('${businessId}')"></td>
            <td class="item-price"></td>
            <td class="item-total"></td>
            <td><button onclick="this.parentNode.parentNode.remove(); updateManualInvoiceNumbers(); updateManualInvoiceTotal('${businessId}')">❌</button></td>
        `;

        tbody.appendChild(row);
        updateManualInvoiceNumbers();
    } catch (e) {
        console.error('Lỗi addManualInvoiceItem:', e);
    }
}

function updateManualInvoiceItem(select, businessId) {
    try {
        const row = select.closest('tr');
        if (!row) return;

        const selectedOption = select.options[select.selectedIndex];
        const unit = selectedOption.getAttribute('data-unit') || 'Cái';
        const price = formatMoney(selectedOption.getAttribute('data-price') || '0');
        const stock = selectedOption.getAttribute('data-qty') || '0';

        row.querySelector('.item-unit').textContent = unit;
        row.querySelector('.item-stock').textContent = stock;
        row.querySelector('.item-price').textContent = price;

        // Đặt giá trị tối đa cho input số lượng
        const qtyInput = row.querySelector('.item-qty');
        qtyInput.max = stock;
        if (normalizeNumber(qtyInput.value) > normalizeNumber(stock)) {
            qtyInput.value = stock;
        }

        updateManualInvoiceTotal(businessId);
    } catch (e) {
        console.error('Lỗi updateManualInvoiceItem:', e);
    }
}

function updateManualInvoiceNumbers() {
    const rows = document.querySelectorAll('#manualInvoiceItemsBody tr');
    rows.forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });
}

function updateManualInvoiceTotal(businessId) {
    try {
        let total = 0;
        const rows = document.querySelectorAll('#manualInvoiceItemsBody tr');

        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            if (select && select.value) {
                const price = normalizeNumber(select.options[select.selectedIndex].getAttribute('data-price') || '0');
                const qty = normalizeNumber(row.querySelector('.item-qty').value) || 0;
                const itemTotal = price * qty;
                row.querySelector('.item-total').textContent = formatMoney(itemTotal);
                total += itemTotal;
            }
        });

        document.getElementById('manualInvoiceTotal').textContent = formatMoney(total);
    } catch (e) {
        console.error('Lỗi updateManualInvoiceTotal:', e);
    }
}

// =============================================
// 11. HÓA ĐƠN THỦ CÔNG (MANUAL INVOICE) - ĐÃ SỬA
// =============================================

function saveManualInvoice(businessId) {
    try {
        // Thực hiện xuất Excel trước
        exportManualInvoice(businessId);

        // Lấy thông tin từ form
        const customerName = document.getElementById('manualCustomerName')?.value.trim() || 'Khách lẻ';
        const customerAddress = document.getElementById('manualCustomerAddress')?.value.trim() || 'Ninh Thuận';
        const customerPhone = document.getElementById('manualCustomerPhone')?.value.trim() || '';
        const customerTaxCode = document.getElementById('manualCustomerTaxCode')?.value.trim() || '';

        const items = [];
        let grandTotal = 0;
        const rows = document.querySelectorAll('#manualInvoiceItemsBody tr');

        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            if (select?.value) {
                const item = inventory.find(i => i.id === select.value);
                if (item) {
                    const qty = parseInt(row.querySelector('.item-qty')?.value) || 0;
                    const price = calculateSellingPrice(normalizeNumber(item.price));
                    const total = qty * price;
                    grandTotal += total;

                    items.push({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        qty: qty,
                        price: price,
                        total: total
                    });
                }
            }
        });

        if (items.length === 0) {
            alert('Không có sản phẩm nào để lưu!');
            return;
        }

        // Tạo bản ghi xuất hàng với customerName và customerAddress cố định
        const exportRecord = {
            id: generateUUID(),
            businessId,
            exportCode: 'EXP-MAN-' + Date.now(),
            exportDate: new Date().toISOString(),
            customerName: customerName, // Đảm bảo lưu giá trị từ input
            customerAddress: customerAddress, // Đảm bảo lưu giá trị từ input
            customerPhone: customerPhone,
            customerTaxCode: customerTaxCode,
            items: items,
            grandTotal: grandTotal.toString()
        };

        exportedInvoices.push(exportRecord);
        localStorage.setItem('exportedInvoices', JSON.stringify(exportedInvoices));

        // Cập nhật tồn kho
        items.forEach(item => {
            const invItem = inventory.find(i => i.id === item.id && i.businessId === businessId);
            if (invItem) {
                invItem.qty = (normalizeNumber(invItem.qty) - item.qty).toString();
                invItem.lastUpdated = new Date().toISOString();
                if (normalizeNumber(invItem.qty) <= 0) {
                    inventory = inventory.filter(i => i.id !== invItem.id);
                }
            }
        });
        localStorage.setItem('inventory', JSON.stringify(inventory));

        // Đóng popup và cập nhật giao diện
        document.querySelector('.popup')?.remove();
        showBusinessDetails(businessId);
        showExportHistory(businessId);

        alert('Đã xuất file Excel và lưu hóa đơn thủ công thành công!');
    } catch (e) {
        console.error('Lỗi saveManualInvoice:', e);
        alert('Lỗi khi lưu hóa đơn thủ công: ' + e.message);
    }
}

function exportManualInvoice(businessId) {
    try {
        // Lấy thông tin từ form
        const customerName = document.getElementById('manualCustomerName')?.value.trim() || 'Khách lẻ';
        const customerAddress = document.getElementById('manualCustomerAddress')?.value.trim() || 'Ninh Thuận';
        const customerPhone = document.getElementById('manualCustomerPhone')?.value.trim() || '';
        const customerTaxCode = document.getElementById('manualCustomerTaxCode')?.value.trim() || '';

        // Thu thập items từ bảng
        const items = [];
        let grandTotal = 0;
        const rows = document.querySelectorAll('#manualInvoiceItemsBody tr');

        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            if (select?.value) {
                const item = inventory.find(i => i.id === select.value);
                if (item) {
                    const qty = parseInt(row.querySelector('.item-qty')?.value) || 0;
                    const price = calculateSellingPrice(normalizeNumber(item.price));
                    const total = qty * price;
                    grandTotal += total;

                    items.push({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        qty: qty,
                        price: price,
                        total: total
                    });
                }
            }
        });

        if (items.length === 0) {
            alert('Không có sản phẩm nào để xuất Excel!');
            return;
        }

        // Tạo dữ liệu Excel theo chuẩn
        const rowsExcel = [headers];

        // Dòng đầu tiên (thông tin chung + sản phẩm đầu)
        const headerRow = Array(headers.length).fill('');
        headerRow[0] = 1; // STT
        headerRow[1] = getTodayDDMMYYYY(); // NgayHoaDon
        headerRow[2] = customerTaxCode || `KH${Math.floor(Math.random() * 1000) + 1000}`; // MaKhachHang
        headerRow[3] = customerName; // TenKhachHang
        headerRow[4] = customerName; // TenNguoiMua
        headerRow[5] = customerTaxCode || ''; // MaSoThue (để trống nếu không có)
        headerRow[6] = customerAddress; // DiaChiKhachHang
        headerRow[7] = customerPhone; // DienThoaiKhachHang
        headerRow[10] = 'TM'; // HinhThucTT

        // Thông tin sản phẩm đầu tiên
        if (items[0]) {
            headerRow[11] = items[0].id; // MaSanPham
            headerRow[12] = items[0].name; // SanPham
            headerRow[13] = items[0].unit; // DonViTinh
            headerRow[16] = items[0].qty; // SoLuong
            headerRow[17] = items[0].price; // DonGia (đã tính giá bán)
            headerRow[20] = items[0].total; // ThanhTien
        }

        headerRow[26] = grandTotal; // TongCong
        headerRow[28] = 'VND'; // DonViTienTe
        headerRow[55] = 'mau_01'; // mau_01
        rowsExcel.push(headerRow);

        // Các dòng sản phẩm tiếp theo
        items.forEach((item, index) => {
            if (index === 0) return; // Bỏ qua sản phẩm đầu đã ghi ở header

            const rowData = Array(headers.length).fill('');
            rowData[0] = index + 1; // STT
            rowData[1] = getTodayDDMMYYYY(); // NgayHoaDon
            rowData[2] = headerRow[2]; // MaKhachHang (giống dòng đầu)
            rowData[5] = customerTaxCode || ''; // MaSoThue (để trống nếu không có)
            rowData[10] = 'TM'; // HinhThucTT
            rowData[11] = item.id; // MaSanPham
            rowData[12] = item.name; // SanPham
            rowData[13] = item.unit; // DonViTinh
            rowData[16] = item.qty; // SoLuong
            rowData[17] = item.price; // DonGia
            rowData[20] = item.total; // ThanhTien
            rowData[26] = item.total; // TongCong (cho từng dòng)
            rowData[28] = 'VND'; // DonViTienTe
            rowData[55] = 'mau_01'; // mau_01
            rowsExcel.push(rowData);
        });

        // Xuất file Excel
        const ws = XLSX.utils.aoa_to_sheet(rowsExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDon');
        XLSX.writeFile(wb, `HoaDon_${businessId}_${Date.now()}.xlsx`);

    } catch (e) {
        console.error('Lỗi khi xuất file:', e);
        alert('Lỗi xuất file: ' + e.message);
        throw e;
    }
}

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function () {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(this.dataset.target).classList.remove('hidden');
    });
});
////////////////////////////////////////////////////////////// XEM HÓA ĐƠN - POPUP HÓA ĐƠN
// In the section for managing invoices (assumed to be part of showBusinessDetails)
// Modify the invoice table rendering to replace the export Excel button with a delete invoice button
function showBusinessDetails(businessId) {
    try {
        // Cập nhật lastActiveBusinessId
        lastActiveBusinessId = businessId;
        selectedBusinessId = businessId;
        localStorage.setItem('lastActiveBusinessId', businessId);

        const business = businesses.find(b => b.id === businessId);
        if (!business) {
            console.error('Không tìm thấy HKD với ID:', businessId);
            return;
        }

        updateBusinessList(businessId); // Cập nhật danh sách HKD với trạng thái active

        const inventorySummary = getBusinessInventorySummary(businessId);

        businessDetails.innerHTML = `
            <div class="business-header">
                <h3>${business.name}</h3>
                <div class="business-info">
                    <span><strong>MST:</strong> ${business.taxCode}</span>
                    <span><strong>Địa chỉ:</strong> ${business.address}</span>
                </div>
                <div class="business-actions">
                    <button class="tab-button active" data-target="inventoryTab" onclick="showTab('inventoryTab', this, '${businessId}')">Tồn kho</button>
                    <button class="tab-button" data-target="invoicesTab" onclick="showTab('invoicesTab', this, '${businessId}')">Hóa đơn</button>
                    <button class="tab-button" data-target="priceListTab" onclick="showTab('priceListTab', this, '${businessId}')">Giá bán</button>
                    <button class="tab-button" data-target="exportHistoryTab" onclick="showTab('exportHistoryTab', this, '${businessId}')">Lịch sử xuất hàng</button>
                    <button class="tab-button" data-target="exportTab" onclick="showTab('exportTab', this, '${businessId}')">Xuất hàng tự động</button>
                    <button onclick="showManualInvoicePopup('${businessId}')" class="btn-manual-invoice">
                        <span class="icon">📝</span> Xuất hàng thủ công
                    </button>
                    <button class="tab-button" onclick="showExportJsonPopup()">📤 Lưu GIST</button>
                    <button class="tab-button" onclick="importFromGist()">📥 Nhập GIST</button>
                    <input type="file" id="jsonInput" accept=".json" style="display: none;" onchange="importFromJSON(event)">
                </div>
            </div>
            <div class="summary-cards">
                <div class="summary-card">
                    <div class="card-icon">📦</div>
                    <div>
                        <div class="card-title">Tồn kho</div>
                        <div class="card-value">${inventorySummary.totalItems} mặt hàng</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">🧮</div>
                    <div>
                        <div class="card-title">Tổng số lượng</div>
                        <div class="card-value">${formatMoney(inventorySummary.totalQuantity)}</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">💰</div>
                    <div>
                        <div class="card-title">Giá trị nhập</div>
                        <div class="card-value">${formatMoney(inventorySummary.totalCostValue)}</div>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="card-icon">🏷️</div>
                    <div>
                        <div class="card-title">Giá trị bán</div>
                        <div class="card-value">${formatMoney(inventorySummary.totalSellingValue)}</div>
                    </div>
                </div>
            </div>
        `;

        // Ẩn tất cả các tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });

        // Hiển thị tab mặc định (Tồn kho)
        const inventoryTab = document.getElementById('inventoryTab');
        if (inventoryTab) {
            inventoryTab.classList.remove('hidden');
            showBusinessInventory(businessId);
        }

        // Đặt trạng thái active cho nút tab Tồn kho
        const firstTabButton = document.querySelector('.tab-button[data-target="inventoryTab"]');
        if (firstTabButton) {
            firstTabButton.classList.add('active');
        }
    } catch (e) {
        console.error('Lỗi showBusinessDetails:', e);
    }
}
// New function to handle invoice deletion
function deleteInvoice(invoiceId, businessId) {
    try {
        if (confirm('Bạn có chắc muốn xóa hóa đơn này?')) {
            saveCurrentState();
            const invoice = invoices.find(i => i.id === invoiceId);
            if (!invoice) {
                throw new Error('Hóa đơn không tồn tại');
            }

            // Reverse inventory changes based on invoice direction
            invoice.items.forEach(item => {
                if (item.type === 'Hàng hóa, dịch vụ') {
                    const qtyChange = normalizeNumber(item.qty) * (invoice.direction === 'input' ? -1 : 1);
                    const invItem = inventory.find(i => i.businessId === businessId && i.name === item.name);
                    if (invItem) {
                        invItem.qty = (normalizeNumber(invItem.qty) + qtyChange).toString();
                        if (normalizeNumber(invItem.qty) <= 0) {
                            inventory = inventory.filter(i => i.id !== invItem.id);
                        }
                    }
                }
            });

            // Remove the invoice
            invoices = invoices.filter(i => i.id !== invoiceId);
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('inventory', JSON.stringify(inventory));

            // Log the activity
            logActivity('invoice_delete', {
                invoiceId,
                businessId,
                invoiceNumber: invoice.series + '-' + invoice.number
            });

            // Refresh UI
            showBusinessDetails(businessId);
            alert('Đã xóa hóa đơn thành công!');
        }
    } catch (e) {
        console.error('Lỗi deleteInvoice:', e);
        alert('Lỗi khi xóa hóa đơn: ' + e.message);
    }
}
function updateInvoiceMST(invoiceId) {
    try {
        saveCurrentState();

        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error('Hóa đơn không tồn tại');
        }

        const select = document.getElementById('businessSelect');
        if (!select) {
            throw new Error('Không tìm thấy danh sách HKD');
        }
        const newBusinessId = select.value;

        if (!newBusinessId) {
            alert('Vui lòng chọn một HKD!');
            return;
        }

        // Cập nhật businessId của hóa đơn nếu cần
        if (invoice.businessId !== newBusinessId) {
            transferInvoice(invoiceId, invoice.businessId, newBusinessId);
        }

        // Đồng bộ thông tin người mua với HKD mới
        const newBusiness = businesses.find(b => b.id === newBusinessId);
        if (newBusiness) {
            invoice.seller = {
                name: newBusiness.name,
                taxCode: newBusiness.taxCode,
                address: newBusiness.address
            };
        }

        // Cập nhật localStorage
        localStorage.setItem('invoices', JSON.stringify(invoices));

        // Ghi log
        logActivity('invoice_mst_update', {
            invoiceId,
            oldBusinessId: invoice.businessId,
            newBusinessId,
            newMST: newBusiness.taxCode
        });

        // Cập nhật giao diện
        showInvoiceDetails(invoiceId);
        updateBusinessList(newBusinessId);
        showBusinessDetails(newBusinessId);
        alert('Đã cập nhật HKD thành công!');
    } catch (e) {
        console.error('Lỗi updateInvoiceMST:', e);
        alert('Lỗi khi cập nhật HKD: ' + e.message);
    }
}

function transferInvoice(invoiceId, fromBusinessId, toBusinessId) {
    try {
        // Lưu trạng thái hiện tại
        saveCurrentState();

        // Tìm hóa đơn
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error('Hóa đơn không tồn tại');
        }

        // Kiểm tra HKD nguồn và đích
        const fromBusiness = businesses.find(b => b.id === fromBusinessId);
        const toBusiness = businesses.find(b => b.id === toBusinessId);
        if (!fromBusiness || !toBusiness) {
            throw new Error('HKD nguồn hoặc đích không tồn tại');
        }

        // Cập nhật businessId của hóa đơn
        invoice.businessId = toBusinessId;

        // Cập nhật tồn kho
        invoice.items.forEach(item => {
            if (item.type === 'Hàng hóa, dịch vụ') {
                // Xóa hoặc giảm tồn kho từ HKD nguồn
                const qtyChange = normalizeNumber(item.qty) * (invoice.direction === 'input' ? -1 : 1);
                const fromInvItem = inventory.find(i => i.businessId === fromBusinessId && i.name === item.name);
                if (fromInvItem) {
                    fromInvItem.qty = (normalizeNumber(fromInvItem.qty) + qtyChange).toString();
                    if (normalizeNumber(fromInvItem.qty) <= 0) {
                        inventory = inventory.filter(i => i.id !== fromInvItem.id);
                    }
                }

                // Thêm hoặc tăng tồn kho cho HKD đích
                const qtyUpdate = normalizeNumber(item.qty) * (invoice.direction === 'input' ? 1 : -1);
                const toInvItem = inventory.find(i => i.businessId === toBusinessId && i.name === item.name);
                if (toInvItem) {
                    toInvItem.qty = (normalizeNumber(toInvItem.qty) + qtyUpdate).toString();
                    if (normalizeNumber(toInvItem.qty) <= 0) {
                        inventory = inventory.filter(i => i.id !== toInvItem.id);
                    }
                } else if (qtyUpdate > 0) {
                    const vat = item.vat || '10%';
                    const vatRate = parseFloat(vat.replace('%', '')) / 100;
                    const basePrice = normalizeNumber(item.price);
                    const qty = qtyUpdate;
                    const taxAmount = basePrice * vatRate * qty;
                    inventory.push({
                        id: generateUUID(),
                        businessId: toBusinessId,
                        stt: (inventory.length + 1).toString(),
                        type: item.type,
                        name: item.name,
                        unit: item.unit,
                        qty: qty.toString(),
                        price: item.price,
                        discount: item.discount || '0',
                        vat: vat,
                        total: formatMoney(qty * basePrice),
                        taxAmount: formatMoney(taxAmount),
                        totalAfterTax: formatMoney((basePrice * qty) + taxAmount),
                        giaBan: formatMoney(calculateSellingPrice(basePrice)),
                        lastUpdated: new Date().toISOString()
                    });
                }
            }
        });

        // Cập nhật localStorage
        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('inventory', JSON.stringify(inventory));

        // Ghi log hoạt động
        logActivity('invoice_transfer', {
            invoiceId,
            fromBusinessId,
            toBusinessId,
            invoiceNumber: `${invoice.series}-${invoice.number}`,
            fromBusinessName: fromBusiness.name,
            toBusinessName: toBusiness.name
        });

        // Cập nhật giao diện
        updateBusinessList(toBusinessId);
        showBusinessDetails(toBusinessId);
        showPriceList(toBusinessId);
        showExportHistory(toBusinessId);
    } catch (e) {
        console.error('Lỗi transferInvoice:', e);
        alert('Lỗi khi chuyển hóa đơn: ' + e.message);
    }
}


// Ensure navigateInvoice function exists for navigation buttons
function navigateInvoice(invoiceId) {
    if (invoiceId) {
        showInvoiceDetails(invoiceId);
    }
}

//popup Giá Bán
function showUpdateSellingPricePopup() {
    const popup = document.createElement('div');
    popup.id = 'updateSellingPricePopup';
    popup.className = 'popup';
    popup.innerHTML = `
        <style>
            .popup {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .popup-content {
                background: #ffffff;
                padding: 24px;
                border-radius: 10px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            }
            .popup-content h3 {
                margin: 0 0 12px;
                font-size: 20px;
                color: #1a1a1a;
                font-weight: 600;
            }
            .popup-content label {
                display: block;
                margin-bottom: 8px;
                font-size: 15px;
                color: #1a1a1a;
                font-weight: 500;
            }
            .popup-content input[type="number"] {
                width: 100%;
                padding: 10px;
                margin-bottom: 20px;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
                transition: border-color 0.3s;
            }
            .popup-content input[type="number"]:focus {
                border-color: #4CAF50;
                outline: none;
            }
            .popup-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            .popup-actions button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.3s, transform 0.1s;
            }
            .popup-actions button:first-child {
                background-color: #4CAF50;
                color: #ffffff;
            }
            .popup-actions button:first-child:hover {
                background-color: #45a049;
                transform: translateY(-1px);
            }
            .popup-actions button:last-child {
                background-color: #f44336;
                color: #ffffff;
            }
            .popup-actions button:last-child:hover {
                background-color: #d32f2f;
                transform: translateY(-1px);
            }
        </style>
        <div class="popup-content">
            <h3>Cập nhật giá bán tồn kho</h3>
            <label for="percentageInput">Phần trăm tăng (%):</label>
            <input type="number" id="percentageInput" placeholder="VD: 10" step="0.1" min="0" value="${localStorage.getItem('sellingPricePercentage') || '10'}">
            <label for="fixedAmountInput">Số tiền cố định (VNĐ):</label>
            <input type="number" id="fixedAmountInput" placeholder="VD: 3000" step="100" min="0" value="${localStorage.getItem('sellingPriceFixedAmount') || '3000'}">
            <div class="popup-actions">
                <button onclick="updateSellingPrice()">💾 Áp dụng</button>
                <button onclick="closeUpdateSellingPricePopup()">❌ Hủy</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    document.getElementById('percentageInput').focus();
}

function updateSellingPrice() {
    try {
        const businessId = document.querySelector('.sidebar li.active')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (!businessId) {
            alert('Vui lòng chọn Hộ Kinh Doanh trước khi cập nhật giá bán!');
            return;
        }

        const percentage = parseFloat(document.getElementById('percentageInput').value) / 100 || 0.10;
        const fixedAmount = parseFloat(document.getElementById('fixedAmountInput').value) || 3000;

        if (isNaN(percentage) || isNaN(fixedAmount) || percentage < 0 || fixedAmount < 0) {
            alert('Vui lòng nhập phần trăm và số tiền cố định hợp lệ!');
            return;
        }

        console.log('updateSellingPrice:', { businessId, percentage, fixedAmount });

        localStorage.setItem('sellingPricePercentage', percentage);
        localStorage.setItem('sellingPriceFixedAmount', fixedAmount);

        console.log('localStorage:', {
            sellingPricePercentage: localStorage.getItem('sellingPricePercentage'),
            sellingPriceFixedAmount: localStorage.getItem('sellingPriceFixedAmount')
        });

        saveCurrentState();

        let updatedItems = 0;
        inventory = inventory.map(item => {
            if (item.businessId === businessId) {
                const price = normalizeNumber(item.price);
                if (isNaN(price)) {
                    console.warn(`Giá không hợp lệ cho item ${item.name}:`, item.price);
                    return item;
                }
                const giaBan = calculateSellingPrice(price);
                console.log('Cập nhật item:', { id: item.id, name: item.name, price, giaBan });
                updatedItems++;
                return {
                    ...item,
                    giaBan: formatMoney(giaBan),
                    lastUpdated: new Date().toISOString()
                };
            }
            return item;
        });

        localStorage.setItem('inventory', JSON.stringify(inventory));

        logActivity('update_selling_price', {
            businessId,
            updatedItems,
            percentage,
            fixedAmount
        });

        showBusinessDetails(businessId);
        showPriceList(businessId);
        showExportHistory(businessId);
        closeUpdateSellingPricePopup();
        alert(`Đã cập nhật giá bán cho ${updatedItems} mặt hàng thành công!`);
    } catch (e) {
        console.error('Lỗi updateSellingPrice:', e);
        alert('Lỗi khi cập nhật giá bán: ' + e.message);
    }
}


function closeUpdateSellingPricePopup() {
    const popup = document.getElementById('updateSellingPricePopup');
    if (popup) popup.remove();
}
///////////////////////////////

function compareInvoiceTotals(invoice, info) {
    try {
        let extractedTotal = 0;
        invoice.items.forEach(item => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat(item.vat.replace('%', '')) / 100 || 0.1;
            const itemTotal = (qty * price - discount) * (1 + vatRate);
            extractedTotal += itemTotal;
        });

        const totalAmount = normalizeNumber(info.totalAmount);
        extractedTotal = parseFloat(extractedTotal.toFixed(2));

        const difference = Math.abs(totalAmount - extractedTotal);
        const mismatchThreshold = 5; // Ngưỡng "Lệch" là ≥ 5 đồng
        const colorThreshold = 5; // Ngưỡng màu sắc là > 5 đồng

        let colorClass = '';
        if (difference > colorThreshold) {
            colorClass = 'highlight-error'; // Gán màu khi chênh lệch > 5 đồng
        }

        return {
            isMatch: difference <= mismatchThreshold, // "Lệch" nếu ≥ 5 đồng
            difference: difference,
            colorClass: colorClass,
            message: difference > colorThreshold ?
                `Chênh lệch: ${formatMoney(difference)}. Tổng hóa đơn: ${formatMoney(totalAmount)}, Tổng trích xuất: ${formatMoney(extractedTotal)}` :
                ''
        };
    } catch (e) {
        console.error('Lỗi compareInvoiceTotals:', e);
        return { isMatch: false, difference: 0, colorClass: 'highlight-error', message: 'Lỗi khi so sánh tổng tiền.' };
    }
}
////////////////////////////////////////////
// Hàm cập nhật số lượng trên nút phân loại
function updateFilterButtons(invoices) {
    const statusCounts = {
        white: 0,
        yellow: 0,
        red: 0,
        unknown: 0,
        mismatch: 0,
        all: invoices.length
    };

    // Đếm số hóa đơn theo trạng thái
    invoices.forEach(invoice => {
        const status = checkInvoiceStatus(invoice);
        if (statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        } else {
            statusCounts.unknown++;
        }
    });

    // Cập nhật số lượng trên các nút phân loại
    const filterButtons = {
        'filter-valid': { count: statusCounts.white, label: 'Hợp lệ' },
        'filter-warning': { count: statusCounts.yellow, label: 'HĐ cảnh báo' },
        'filter-error': { count: statusCounts.red, label: 'Lỗi' },
        'filter-unknown': { count: statusCounts.unknown, label: 'Thiếu' },
        'filter-mismatch': { count: statusCounts.mismatch, label: 'Lệch' },
        'filter-all': { count: statusCounts.all, label: 'Tất cả' }
    };

    Object.entries(filterButtons).forEach(([id, { count, label }]) => {
        const button = document.getElementById(id);
        if (button) {
            button.innerText = `${label} (${count})`;
        }
    });
}



// Hàm kiểm tra trạng thái hóa đơn - đã sửa
function checkInvoiceStatus(invoice) {
    try {
        // Kiểm tra "Lệch": chênh lệch ≥ 5 đồng giữa totalAmount và tổng trích xuất
        const info = { totalAmount: invoice.totalAmount, taxRate: invoice.taxRate };
        const comparison = compareInvoiceTotals(invoice, info);
        if (comparison.difference >= 5) {
            return 'mismatch';
        }

        // Kiểm tra "Lỗi": DVT rỗng hoặc chứa số, số lượng rỗng hoặc không phải định dạng số
        if (invoice.items.some(item => {
            const hasNumberInUnit = !item.unit || /\d/.test(item.unit.trim()); // DVT rỗng hoặc chứa số
            const hasInvalidQty = !item.qty || !/^\d+(?:,\d+)?$/.test(item.qty.toString().replace(/\s/g, '')); // Số lượng rỗng hoặc không hợp lệ
            const hasLetterInQty = item.qty && /[a-zA-ZÀ-Ỵ]/.test(item.qty); // Số lượng chứa chữ
            return hasNumberInUnit || hasInvalidQty || hasLetterInQty;
        })) {
            return 'error';
        }

        // Kiểm tra "Cảnh báo": giá bán hoặc thành tiền bằng 0
        if (invoice.items.some(item => {
            const price = normalizeNumber(item.price); // Chuẩn hóa giá bán
            const total = normalizeNumber(item.total); // Chuẩn hóa thành tiền
            return price === 0 || total === 0;
        })) {
            return 'warning';
        }

        // Kiểm tra "Thiếu": cả mccqt và seller.taxCode đều thiếu hoặc là "Không rõ"
        if (!invoice.mccqt || invoice.mccqt === 'Không rõ') {
            return 'unknown';
        }

        // Trạng thái "Hợp lệ": nếu không có lỗi, thiếu, lệch, hoặc cảnh báo
        return 'valid';
    } catch (e) {
        console.error('Lỗi checkInvoiceStatus:', e);
        return 'error';
    }
}


// Hàm cập nhật số lượng trên nút phân loại
function updateFilterButtons(invoices) {
    const statusCounts = {
        white: 0,
        yellow: 0,
        red: 0,
        unknown: 0,
        mismatch: 0,
        all: invoices.length
    };

    // Đếm số hóa đơn theo trạng thái
    invoices.forEach(invoice => {
        const status = checkInvoiceStatus(invoice);
        if (statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        } else {
            statusCounts.unknown++;
        }
    });

    // Cập nhật số lượng trên các nút phân loại
    const filterButtons = {
        'filter-valid': { count: statusCounts.white, label: 'Hợp lệ' },
        'filter-warning': { count: statusCounts.yellow, label: 'HĐ cảnh báo' },
        'filter-error': { count: statusCounts.red, label: 'Lỗi' },
        'filter-unknown': { count: statusCounts.unknown, label: 'Thiếu' },
        'filter-mismatch': { count: statusCounts.mismatch, label: 'Lệch' },
        'filter-all': { count: statusCounts.all, label: 'Tất cả' }
    };

    Object.entries(filterButtons).forEach(([id, { count, label }]) => {
        const button = document.getElementById(id);
        if (button) {
            button.innerText = `${label} (${count})`;
        }
    });
}


function getButtonText(type) {
    switch (type) {
        case 'all': return 'Tất cả';
        case 'valid': return 'HĐ hợp lệ';
        case 'warning': return 'HĐ cảnh báo';
        case 'error': return 'HĐ lỗi';
        case 'unknown': return 'HĐ không rõ';
        case 'mismatch': return 'Lệch';
        default: return 'Tất cả';
    }
}
// Hàm hỗ trợ - tạo badge trạng thái
function getStatusBadge(status) {
    const badges = {
        valid: '<span class="badge valid">✅ Hợp lệ</span>',
        warning: '<span class="badge warning">⚠️ HĐ cảnh báo</span>',
        error: '<span class="badge error">❌ Lỗi</span>',
        unknown: '<span class="badge unknown">❓ Thiếu</span>',
        mismatch: '<span class="badge mismatch">🔄 Lệch</span>'
    };
    return badges[status] || '<span class="badge error">❌ Lỗi</span>';

}
// Hàm render danh sách hóa đơn
function renderInvoiceList(invoices) {
    if (invoices.length === 0) {
        updateFilterButtons(invoices); // Cập nhật số lượng dù danh sách rỗng
        return '<p>Không tìm thấy hóa đơn nào</p>';
    }

    // Sắp xếp theo ngày giảm dần (mới nhất trước)
    invoices.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA; // Mới nhất trước
    });

    // Cập nhật số lượng trên các nút phân loại
    updateFilterButtons(invoices);

    return `
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>STT</th>
                    <th>Số HĐ</th>
                    <th>Ngày</th>
                    <th>MCCQT</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
                ${invoices.map((invoice, index) => {
        const status = checkInvoiceStatus(invoice) || 'unknown'; // Đảm bảo trạng thái luôn có giá trị
        const rowClass = {
            white: 'valid-row',
            yellow: 'warning-row',
            red: 'error-row',
            unknown: 'unknown-row',
            mismatch: 'mismatch-row'
        }[status] || 'unknown-row';
        return `
                        <tr class="invoice-row ${rowClass}">
                            <td>${index + 1}</td>
                            <td>${invoice.series}-${invoice.number}</td>
                            <td>${invoice.date}</td>
                            <td>${invoice.mccqt || 'Không rõ'}</td>
                            <td>${invoice.direction === 'input' ? 'Nhập' : 'Xuất'}</td>
                            <td>${formatMoney(calculateInvoiceTotal(invoice))}</td>
                            <td>${getStatusBadge(status)}</td>
                            <td class="actions">
                                <button onclick="showInvoiceDetails('${invoice.id}')">Xem</button>
                                <button onclick="deleteInvoice('${invoice.id}', '${invoice.businessId}')">Xóa</button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}



//////////////////////
// Updated helper to get GitHub Gist token from localStorage
function getGitHubToken() {
    return localStorage.getItem('githubToken') || null;
}



// Export all business + invoice data to fixed Gist
function exportToGist(token) {
    try {
        const githubToken = token || localStorage.getItem('githubToken') || '';
        if (!githubToken) {
            alert('Vui lòng nhập GitHub Token!');
            return;
        }

        const data = {
            businesses: businesses,
            invoices: invoices,
            inventory: inventory,
            exportedInvoices: exportedInvoices,
            lastActiveBusinessId: lastActiveBusinessId
        };
        const jsonString = JSON.stringify(data, null, 2);

        const gistId = 'e8d0145f86b7f95f0d4e10d3b152d9c9';
        const gistData = {
            description: `Data Export All ${new Date().toISOString()}`,
            public: false,
            files: {
                'data.json': {
                    content: jsonString
                }
            }
        };

        fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gistData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                logActivity('export_json_gist', {
                    exportedRecords: {
                        businesses: data.businesses.length,
                        invoices: data.invoices.length,
                        inventory: data.inventory.length,
                        exportedInvoices: data.exportedInvoices.length
                    },
                    gistId: gistId,
                    gistUrl: result.html_url
                });

                alert('Đã xuất dữ liệu lên GitHub Gist thành công! URL: ' + result.html_url);
            })
            .catch(error => {
                console.error('Lỗi exportToGist:', error);
                alert('Lỗi khi xuất dữ liệu lên Gist: ' + error.message);
            });
    } catch (e) {
        console.error('Lỗi exportToGist:', e);
        alert('Lỗi khi xuất dữ liệu lên Gist: ' + e.message);
    }
}

// Function to show token popup
function showExportJsonPopup() {
    const popup = document.createElement('div');
    popup.id = 'exportJsonPopup';
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h3>GitHub Gist Token</h3>
            <input type="text" id="gistTokenInput" placeholder="Nhập GitHub Token" value="${getGitHubToken() || ''}">
            <div class="popup-actions">
                <button onclick="saveGistToken()">💾 Lưu Token</button>
                <button onclick="closeExportJsonPopup()">❌ Hủy</button>
            </div>
        </div>`;
    document.body.appendChild(popup);
    document.getElementById('gistTokenInput').focus();
}

function saveGistToken() {
    const input = document.getElementById('gistTokenInput');
    const token = input.value.trim();
    if (token) {
        localStorage.setItem('githubToken', token);
        alert('Đã lưu token GitHub thành công!');
        closeExportJsonPopup();
    }
}

function closeExportJsonPopup() {
    const popup = document.getElementById('exportJsonPopup');
    if (popup) popup.remove();
}

// Inject iframe preview when called from parseToTable
async function injectInvoiceIframePreview(file, fileName) {
    const text = await file.text();
    const rawUrl = await uploadToGist(text, fileName);
    if (rawUrl) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://htmlpreview.github.io/?${rawUrl}`;
        iframe.width = '100%';
        iframe.height = '500';
        iframe.style.border = '1px solid #ccc';

        const previewArea = document.getElementById('previewArea') || document.createElement('div');
        previewArea.id = 'previewArea';
        previewArea.innerHTML = '';
        previewArea.appendChild(iframe);
        document.body.appendChild(previewArea);
    }
}

// Fully integrated ZIP upload + Gist + parse
async function handleZipUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    const status = document.getElementById('status');
    if (status) status.innerText = `📦 Đang xử lý ${files.length} file ZIP...\n`;

    let total = files.length;
    let success = 0;
    let error = 0;
    let skip = 0;

    // Tìm hoặc tạo HKD mặc định
    let defaultBusiness = businesses.find(b => b.isDefault === true);
    if (!defaultBusiness) {
        defaultBusiness = {
            id: generateUUID(),
            name: 'Hộ Kinh Doanh Mặc Định',
            taxCode: 'DEFAULT',
            address: 'Không xác định',
            isDefault: true
        };
        businesses.push(defaultBusiness);
        updateBusinessList();
    }

    try {
        for (let i = 0; i < files.length; i++) {
            const zipFile = files[i];
            if (status) status.innerText = `📦 Đang xử lý ${i + 1} / ${total}: ${zipFile.name}`;

            try {
                const zip = await JSZip.loadAsync(zipFile);
                const htmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.html'));

                if (htmlFiles.length === 0) {
                    error++;
                    alert(`File ZIP ${zipFile.name} không chứa file HTML nào.`);
                    continue;
                }

                let fileSuccess = 0;
                let fileSkip = 0;

                for (const htmlFile of htmlFiles) {
                    const fileContent = await zip.file(htmlFile).async('string');
                    const blob = new Blob([fileContent], { type: 'text/html' });
                    const file = new File([blob], htmlFile, { type: 'text/html' });

                    const info = extractInvoiceInfoFromHTML(fileContent, null);

                    // Kiểm tra MST và MCCQT
                    if (!info || !info.mstMua || info.mstMua === 'Không rõ' || !info.mccqt) {
                        // Gán vào HKD mặc định nếu thiếu MST hoặc MCCQT
                        if (invoices.some(i => i.mccqt === info.mccqt && i.businessId === defaultBusiness.id)) {
                            fileSkip++;
                            continue;
                        }

                        const itemRows = [...new DOMParser().parseFromString(fileContent, 'text/html').querySelectorAll('table.res-tb tbody tr')];
                        const lines = itemRows
                            .map(tr => {
                                const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim().replace(/\s+/g, ' '));
                                return cells[0] && !isNaN(cells[0]) && cells.length >= 5 ? cells.join('\t') : null;
                            })
                            .filter(line => line !== null);

                        const pdfTextArea = document.getElementById('pdfTextArea');
                        if (pdfTextArea) pdfTextArea.value = lines.join('\n');

                        await parseToTableAndUploadGist(defaultBusiness.id, file, info, 'input');
                        updateBusinessList();
                        showBusinessDetails(defaultBusiness.id);
                        fileSuccess++;
                        continue;
                    }

                    let business = businesses.find(b => b.taxCode === info.mstMua);
                    if (!business) {
                        business = {
                            id: generateUUID(),
                            name: info.tenMua || 'Không rõ tên',
                            taxCode: info.mstMua,
                            address: info.diachiMua || 'Không rõ địa chỉ',
                            isDefault: false
                        };
                        businesses.push(business);
                    }

                    if (invoices.some(i => i.mccqt === info.mccqt && i.businessId === business.id)) {
                        fileSkip++;
                        continue;
                    }

                    const itemRows = [...new DOMParser().parseFromString(fileContent, 'text/html').querySelectorAll('table.res-tb tbody tr')];
                    const lines = itemRows
                        .map(tr => {
                            const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim().replace(/\s+/g, ' '));
                            return cells[0] && !isNaN(cells[0]) && cells.length >= 5 ? cells.join('\t') : null;
                        })
                        .filter(line => line !== null);

                    const pdfTextArea = document.getElementById('pdfTextArea');
                    if (pdfTextArea) pdfTextArea.value = lines.join('\n');

                    await parseToTableAndUploadGist(business.id, file, info, 'input');
                    updateBusinessList();
                    showBusinessDetails(business.id);
                    fileSuccess++;
                }

                success += fileSuccess;
                skip += fileSkip;
            } catch (innerError) {
                error++;
                console.error(`❌ Lỗi file ${zipFile.name}:`, innerError);
                alert(`Lỗi xử lý file ${zipFile.name}: ${innerError.message}`);
            }
        }

        if (status) {
            status.innerText = `✅ Hoàn tất xử lý ${total} ZIP\n🟢 Thành công: ${success}\n🔴 Lỗi: ${error}\n⚠️ Bỏ qua: ${skip}`;
        }
        alert(`Hoàn tất xử lý ${total} ZIP: ${success} thành công, ${error} lỗi, ${skip} bỏ qua.`);
    } catch (e) {
        console.error('Lỗi xử lý ZIP:', e);
        if (status) status.innerText = `❌ Lỗi xử lý ZIP: ${e.message}`;
        alert(`Lỗi xử lý ZIP: ${e.message}`);
    }
}


// Updated helper to get GitHub Gist token from localStorage
function getGitHubToken() {
    return localStorage.getItem('githubToken') || null;
}

// Upload HTML content as Gist and return raw_url
async function uploadToGist(content, filename) {
    const token = getGitHubToken();
    if (!token) {
        alert('GitHub token chưa được cấu hình!');
        return null;
    }
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                description: `Invoice HTML: ${filename}`,
                public: true,
                files: {
                    [filename]: {
                        content
                    }
                }
            })
        });
        if (!response.ok) throw new Error(`Gist error: ${response.statusText}`);
        const result = await response.json();
        return result.files[filename].raw_url;
    } catch (e) {
        console.error('uploadToGist failed:', e);
        return null;
    }
}

// Updated helper to get GitHub Gist token from localStorage
function getGitHubToken() {
    return localStorage.getItem('githubToken') || null;
}

// Upload HTML content as Gist and return raw_url
async function uploadToGist(content, filename) {
    const token = getGitHubToken();
    if (!token) {
        alert('GitHub token chưa được cấu hình!');
        return null;
    }
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                description: `Invoice HTML: ${filename}`,
                public: true,
                files: {
                    [filename]: {
                        content
                    }
                }
            })
        });
        if (!response.ok) throw new Error(`Gist error: ${response.statusText}`);
        const result = await response.json();
        return result.files[filename].raw_url;
    } catch (e) {
        console.error('uploadToGist failed:', e);
        return null;
    }
}

async function parseToTableAndUploadGist(businessId, file, info, direction) {
    try {
        const token = getGitHubToken();
        if (!token) {
            alert('Vui lòng cấu hình GitHub Token trước khi tải lên Gist!');
            parseToTable(businessId, file, info, direction); // Vẫn xử lý parseToTable
            return;
        }

        const htmlContent = await file.text();
        const gistUrl = await uploadToGist(htmlContent, file.name);
        if (gistUrl) {
            info.gist = gistUrl;
        }

        parseToTable(businessId, file, info, direction);

        const lastInvoice = invoices[invoices.length - 1];
        if (lastInvoice && gistUrl) {
            lastInvoice.file = `https://htmlpreview.github.io/?${gistUrl}`;
            localStorage.setItem('invoices', JSON.stringify(invoices)); // <-- thêm dòng này
        }

    } catch (e) {
        console.error('Lỗi parseToTableAndUploadGist:', e);
        throw e;
    }
}





async function downloadInvoicePDF(invoiceId) {
    try {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            alert('Hóa đơn không tồn tại!');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(`Hóa đơn ${invoice.series}-${invoice.number}`, 10, 10);
        doc.save(`HoaDon_${invoice.series}-${invoice.number}.pdf`);

        logActivity('download_pdf', { invoiceId, invoiceNumber: `${invoice.series}-${invoice.number}` });
    } catch (e) {
        console.error('Lỗi downloadInvoicePDF:', e);
        alert('Lỗi khi tải PDF: ' + e.message);
    }
}

function viewOnGISPortal(invoiceId) {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) {
        alert('Hóa đơn không tồn tại!');
        return;
    }

    const gisUrl = invoice.file || 'https://gis.example.com/invoice/' + invoiceId;
    window.open(gisUrl, '_blank');

    logActivity('view_gis_portal', { invoiceId, invoiceNumber: `${invoice.series}-${invoice.number}` });
}

function formatDate(dateStr) {
    try {
        if (!dateStr) return 'Không rõ';
        const date = new Date(dateStr);
        if (isNaN(date)) {
            return dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/) ? dateStr : 'Không rõ';
        }
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        console.error('Lỗi formatDate:', e);
        return 'Không rõ';
    }
}



// Hàm phụ trợ giả lập (thay thế bằng API thực tế nếu có)
async function fetchInvoiceFromGIS(invoiceId) {
    try {
        // Giả lập: Sử dụng invoices từ localStorage nếu API chưa có
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
        }
        return invoice;
    } catch (e) {
        console.error('Lỗi fetchInvoiceFromGIS:', e);
        throw e;
    }
}

async function fetchBusinessInvoicesFromGIS(businessId) {
    try {
        // Giả lập: Sử dụng invoices từ localStorage nếu API chưa có
        return invoices.filter(i => i.businessId === businessId);
    } catch (e) {
        console.error('Lỗi fetchBusinessInvoicesFromGIS:', e);
        throw e;
    }
}

function getGISViewerUrl(invoiceId) {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice && invoice.file) {
        return invoice.file; // URL Gist hoặc HTML từ localStorage
    }
    return 'about:blank'; // URL mặc định nếu không tìm thấy
}

// Hàm định dạng số lượng
function formatNumber(value) {
    return new Intl.NumberFormat('vi-VN').format(value);
}

async function updateInvoiceToGIS(invoiceId, updatedInvoice) {
    try {
        const token = getGitHubToken(); // Hoặc token GIS
        if (!token) throw new Error('Chưa cấu hình token GIS');
        const response = await fetch(`https://api.gis.example.com/invoices/${invoiceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedInvoice)
        });
        if (!response.ok) throw new Error(`Lỗi cập nhật GIS: ${response.statusText}`);
        const updated = await response.json();
        // Đồng bộ localStorage
        const index = invoices.findIndex(i => i.id === invoiceId);
        if (index !== -1) {
            invoices[index] = updated;
            localStorage.setItem('invoices', JSON.stringify(invoices));
        }
        return updated;
    } catch (e) {
        console.error('Lỗi updateInvoiceToGIS:', e);
        throw e;
    }
}

function saveInvoiceChanges(invoiceId, businessId) {
    try {
        let invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            alert('Không tìm thấy hóa đơn!');
            return;
        }

        const newMCCQT = document.getElementById('editMCCQT').value.trim();

        if (!newMCCQT) {
            alert('MCCQT không được để trống!');
            return;
        }

        // Lưu trạng thái trước khi thay đổi để hỗ trợ undo
        saveCurrentState();

        // Cập nhật MCCQT
        const oldMCCQT = invoice.mccqt;
        invoice.mccqt = newMCCQT || 'Không rõ';

        // Gửi cập nhật lên GIS API
        updateInvoiceToGIS(invoiceId, invoice)
            .then(updatedInvoice => {
                // Đồng bộ localStorage
                invoice = updatedInvoice;
                localStorage.setItem('invoices', JSON.stringify(invoices));

                // Ghi log hoạt động
                logActivity('edit_invoice', {
                    invoiceId,
                    businessId,
                    oldMCCQT,
                    newMCCQT
                });

                // Cập nhật tiêu đề hóa đơn và làm mới danh sách
                const title = document.querySelector('.invoice-details-table h4');
                if (title) {
                    title.textContent = `Trích xuất hóa đơn ${invoice.series}-${invoice.number}`;
                }
                loadInvoiceList(businessId, currentFilterType);
                alert('Đã cập nhật MCCQT thành công!');
            })
            .catch(e => {
                console.error('Lỗi khi cập nhật GIS API:', e);
                alert('Lỗi khi lưu MCCQT lên GIS: ' + e.message);
                // Khôi phục trạng thái nếu cần
                invoice.mccqt = oldMCCQT;
            });
    } catch (e) {
        console.error('Lỗi saveInvoiceChanges:', e);
        alert('Lỗi khi lưu thay đổi: ' + e.message);
    }
}

function saveOrCancelInvoiceItem(invoiceId, itemIndex, action) {
    try {
        let invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }

        const item = invoice.items[itemIndex];
        if (!item) {
            console.error(`Không tìm thấy mục hóa đơn tại index ${itemIndex}`);
            alert('Mục hóa đơn không tồn tại!');
            return;
        }

        if (action === 'save') {
            const row = document.querySelector(`tr[data-item-index="${itemIndex}"]`);
            if (!row) {
                console.error(`Không tìm thấy hàng với data-item-index ${itemIndex}`);
                alert('Không tìm thấy hàng để lưu!');
                return;
            }

            const fields = {
                name: row.querySelector('td[data-field="name"]').textContent.trim() || 'Hàng hóa mới',
                unit: row.querySelector('td[data-field="unit"]').textContent.trim() || 'Cái',
                qty: row.querySelector('td[data-field="qty"]').textContent.trim() || '0',
                price: row.querySelector('td[data-field="price"]').textContent.trim() || '0',
                discount: row.querySelector('td[data-field="discount"]').textContent.trim() || '0',
                vat: row.querySelector('td[data-field="vat"]').textContent.trim() || invoice.taxRate + '%'
            };

            if (!fields.name || isNaN(normalizeNumber(fields.qty)) || isNaN(normalizeNumber(fields.price))) {
                alert('Vui lòng nhập đầy đủ Tên hàng hóa, Số lượng và Đơn giá hợp lệ!');
                return;
            }

            fields.vat = fields.vat.includes('%') ? fields.vat : `${fields.vat}%`;
            fields.price = normalizeNumber(fields.price).toString();
            fields.discount = normalizeNumber(fields.discount).toString();

            const oldQty = normalizeNumber(item.qty);
            const qtyChange = normalizeNumber(fields.qty) - oldQty;
            const vatRate = parseFloat(fields.vat.replace('%', '')) / 100;
            const price = normalizeNumber(fields.price);
            const qty = normalizeNumber(fields.qty);
            const discount = normalizeNumber(fields.discount);
            const itemTotalBeforeTax = qty * price - discount;
            const itemTax = itemTotalBeforeTax * vatRate;
            const itemTotal = itemTotalBeforeTax + itemTax;

            const oldItem = { ...item }; // Lưu trạng thái cũ để khôi phục nếu lỗi

            Object.assign(item, {
                ...fields,
                total: formatMoney(itemTotal),
                isEditing: false,
                lastUpdated: new Date().toISOString()
            });

            // Tính lại tổng
            invoice.netTotal = invoice.items.reduce((sum, item) => {
                const qty = normalizeNumber(item.qty);
                const price = normalizeNumber(item.price);
                const discount = normalizeNumber(item.discount || '0');
                return sum + (qty * price - discount);
            }, 0);

            invoice.totalTax = invoice.items.reduce((sum, item) => {
                const qty = normalizeNumber(item.qty);
                const price = normalizeNumber(item.price);
                const discount = normalizeNumber(item.discount || '0');
                const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
                return sum + ((qty * price - discount) * vatRate);
            }, 0);

            invoice.totalDiscount = invoice.items.reduce((sum, item) => sum + normalizeNumber(item.discount || '0'), 0);

            // Gửi cập nhật lên GIS API
            updateInvoiceToGIS(invoiceId, invoice)
                .then(updatedInvoice => {
                    // Đồng bộ localStorage
                    invoice = updatedInvoice;
                    localStorage.setItem('invoices', JSON.stringify(invoices));

                    // Cập nhật kho nếu cần
                    if (item.type === 'Hàng hóa, dịch vụ' && qtyChange !== 0) {
                        updateInventory(invoice.businessId, {
                            name: fields.name,
                            unit: fields.unit,
                            qty: qtyChange.toString(),
                            price: fields.price,
                            discount: fields.discount,
                            vat: fields.vat,
                            total: itemTotal.toString()
                        }, invoice.direction);
                        localStorage.setItem('inventory', JSON.stringify(inventory));
                    }

                    // Cập nhật giao diện
                    showInvoiceDetails(invoiceId);
                    showBusinessDetails(invoice.businessId);
                    showPriceList(invoice.businessId);
                    showExportHistory(invoice.businessId);
                    alert('Đã lưu mục hóa đơn thành công!');
                })
                .catch(e => {
                    console.error('Lỗi khi cập nhật GIS API:', e);
                    alert('Lỗi khi lưu mục hóa đơn lên GIS: ' + e.message);
                    // Khôi phục trạng thái nếu lỗi
                    Object.assign(item, oldItem);
                });
        } else if (action === 'cancel') {
            // Trường hợp hủy chỉnh sửa
            if (!item.id && item.isEditing) {
                // Nếu là dòng mới, xác nhận trước khi xóa
                const isEmpty =
                    !item.name?.trim() &&
                    !item.unit?.trim() &&
                    normalizeNumber(item.qty) === 0 &&
                    normalizeNumber(item.price) === 0;

                if (isEmpty || confirm('Bạn có chắc muốn xóa dòng mới này không?')) {
                    invoice.items.splice(itemIndex, 1);
                    invoice.items.forEach((item, idx) => item.stt = (idx + 1).toString());
                    // Gửi cập nhật lên GIS API
                    updateInvoiceToGIS(invoiceId, invoice)
                        .then(updatedInvoice => {
                            invoice = updatedInvoice;
                            localStorage.setItem('invoices', JSON.stringify(invoices));
                            showInvoiceDetails(invoiceId);
                            showBusinessDetails(invoice.businessId);
                            showPriceList(invoice.businessId);
                            showExportHistory(invoice.businessId);
                        })
                        .catch(e => {
                            console.error('Lỗi khi cập nhật GIS API:', e);
                            alert('Lỗi khi hủy mục hóa đơn lên GIS: ' + e.message);
                        });
                } else {
                    item.isEditing = false;
                    showInvoiceDetails(invoiceId);
                }
            } else {
                item.isEditing = false;
                showInvoiceDetails(invoiceId);
            }
        }
    } catch (e) {
        console.error('Lỗi saveOrCancelInvoiceItem:', e);
        alert('Lỗi khi lưu mục hóa đơn: ' + e.message);
    }
}

async function showInvoiceDetails(invoiceId) {
    try {
        let invoice;
        try {
            // Lấy dữ liệu từ GIS API
            invoice = await fetchInvoiceFromGIS(invoiceId);
        } catch (apiError) {
            console.warn('Không thể lấy dữ liệu từ GIS API, sử dụng dữ liệu cục bộ:', apiError);
            invoice = invoices.find(i => i.id === invoiceId);
        }

        if (!invoice) {
            console.error(`Không tìm thấy hóa đơn với ID ${invoiceId}`);
            alert('Hóa đơn không tồn tại!');
            return;
        }

        let businessInvoices;
        try {
            // Lấy danh sách hóa đơn từ GIS API
            businessInvoices = await fetchBusinessInvoicesFromGIS(invoice.businessId);
        } catch (apiError) {
            console.warn('Không thể lấy danh sách hóa đơn từ GIS, sử dụng dữ liệu cục bộ:', apiError);
            businessInvoices = invoices.filter(i => i.businessId === invoice.businessId);
        }

        const sortedInvoices = businessInvoices.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        const currentIndex = sortedInvoices.findIndex(i => i.id === invoiceId);
        const prevInvoiceId = currentIndex > 0 ? sortedInvoices[currentIndex - 1].id : null;
        const nextInvoiceId = currentIndex < sortedInvoices.length - 1 ? sortedInvoices[currentIndex + 1].id : null;

        let totalBeforeTax = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        let totalPayment = 0;
        let totalSelling = 0;

        invoice.items.forEach(item => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;

            const itemTotalBeforeTax = qty * price - discount;
            const itemTax = itemTotalBeforeTax * vatRate;
            const itemTotal = itemTotalBeforeTax + itemTax;

            totalBeforeTax += itemTotalBeforeTax;
            totalTax += itemTax;
            totalDiscount += discount;
            totalPayment += itemTotal;
            totalSelling += qty * calculateSellingPrice(price);
        });

        // So sánh tổng tiền
        const info = {
            totalAmount: invoice.totalAmount,
            taxRate: invoice.taxRate
        };
        const comparison = compareInvoiceTotals(invoice, info);
        const colorClass = comparison.colorClass;

        const invoiceTable = `
            <style>
                .invoice-details-table {
                    flex: 1;
                    padding: 20px;
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .invoice-details-table h4 {
                    margin: 0 0 15px;
                    font-size: 18px;
                    color: #1a1a1a;
                }
                .compact-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                .compact-table th, .compact-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                .compact-table th {
                    background-color: #f2f2f2;
                    font-weight: 600;
                }
                .invoice-info p {
                    margin: 5px 0;
                }
                .invoice-navigation {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    display: flex;
                    gap: 10px;
                }
                .invoice-navigation button {
                    padding: 8px 12px;
                    border: none;
                    border-radius: 4px;
                    background-color: #4CAF50;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                }
                .invoice-navigation button:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }
                .business-select {
                    width: 200px;
                    padding: 5px;
                    font-size: 14px;
                }
                .form-group {
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .form-group label {
                    width: 100px;
                    font-weight: bold;
                }
                .form-group input {
                    padding: 5px;
                    width: 200px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .form-group button {
                    padding: 5px 10px;
                    border: none;
                    border-radius: 4px;
                    background-color: #4CAF50;
                    color: #fff;
                    cursor: pointer;
                }
                .form-group button:hover {
                    background-color: #45a049;
                }
                .highlight-error {
                    background-color: #ffcccc;
                    border: 2px solid #ff0000;
                    padding: 10px;
                }
                .error-message {
                    color: #ff0000;
                    font-weight: bold;
                }
            </style>
            <div class="invoice-details-table ${colorClass}">
                <h4>Trích xuất hóa đơn ${invoice.series}-${invoice.number}</h4>
                <div class="invoice-navigation">
                    <button ${!prevInvoiceId ? 'disabled' : ''} onclick="navigateInvoice('${prevInvoiceId}')">⬅️ Hóa đơn trước</button>
                    <button ${!nextInvoiceId ? 'disabled' : ''} onclick="navigateInvoice('${nextInvoiceId}')">Hóa đơn tiếp theo ➡️</button>
                </div>
                
                <div class="invoice-info">
                    <p>MST: 
                        <select id="businessSelect" class="business-select" onchange="updateSelectedBusiness('${invoiceId}')">
                            <option value="">-- Chọn HKD --</option>
                            ${businesses.map(b => `
                                <option value="${b.id}" ${b.id === invoice.businessId ? 'selected' : ''}>
                                    ${b.name} (MST: ${b.taxCode})
                                </option>
                            `).join('')}
                        </select>
                    </p>
                    <p>Địa chỉ: ${invoice.seller?.address || 'Không rõ'}</p>
                    <button onclick="updateInvoiceMST('${invoiceId}')">💾 Cập nhật HKD</button>
                </div>
                <div class="form-group">
                    <label>MCCQT:</label>
                    <input type="text" id="editMCCQT" value="${invoice.mccqt || ''}">
                    <button onclick="saveInvoiceChanges('${invoiceId}', '${invoice.businessId}')">Cập nhật</button>
                </div>
                <table class="compact-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Tên hàng hóa</th>
                            <th>Đơn vị</th>
                            <th>Số lượng</th>
                            <th>Đơn giá</th>
                            <th>Chiết khấu</th>
                            <th>Thuế suất</th>
                            <th>Tiền thuế</th>
                            <th>Thành tiền</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoice.items.map((item, index) => {
            const qty = normalizeNumber(item.qty);
            const price = normalizeNumber(item.price);
            const discount = normalizeNumber(item.discount || '0');
            const vatRate = parseFloat((item.vat || invoice.taxRate || '10').replace('%', '')) / 100;
            const itemTotalBeforeTax = qty * price - discount;
            const itemTax = itemTotalBeforeTax * vatRate;
            const itemTotal = itemTotalBeforeTax + itemTax;
            return `
                                <tr data-item-index="${index}" class="${item.isEditing ? 'editing' : ''}">
                                    <td>${item.stt || index + 1}</td>
                                    <td data-field="name" ${item.isEditing ? 'contenteditable="true"' : ''}>${item.name || 'Không rõ'}</td>
                                    <td data-field="unit" ${item.isEditing ? 'contenteditable="true"' : ''}>${item.unit || 'Không rõ'}</td>
                                    <td data-field="qty" ${item.isEditing ? 'contenteditable="true"' : ''}>${formatNumber(qty)}</td>
                                    <td data-field="price" ${item.isEditing ? 'contenteditable="true"' : ''}>${formatMoney(price)}</td>
                                    <td data-field="discount" ${item.isEditing ? 'contenteditable="true"' : ''}>${formatMoney(discount)}</td>
                                    <td data-field="vat" ${item.isEditing ? 'contenteditable="true"' : ''}>${(vatRate * 100).toFixed(2)}%</td>
                                    <td>${formatMoney(itemTax)}</td>
                                    <td>${formatMoney(itemTotal)}</td>
                                    <td>
                                        ${item.isEditing ? `
                                            <button onclick="saveOrCancelInvoiceItem('${invoiceId}', ${index}, 'save')">💾</button>
                                            <button onclick="saveOrCancelInvoiceItem('${invoiceId}', ${index}, 'cancel')">❌</button>
                                        ` : `
                                            <button onclick="editInvoiceItem('${invoiceId}', ${index})">✏️</button>
                                            <button onclick="insertInvoiceItem('${invoiceId}', ${index})">➕</button>
                                            <button onclick="deleteInvoiceItem('${invoiceId}', ${index})">🗑️</button>
                                        `}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                <div class="invoice-summary">
                    <div class="summary-row">
                        <span>Tổng tiền chưa thuế:</span>
                        <span>${formatMoney(totalBeforeTax)} VND</span>
                    </div>
                    <div class="summary-row">
                        <span>Tổng cộng tiền thuế:</span>
                        <span>${formatMoney(totalTax)} VND</span>
                    </div>
                    <div class="summary-row">
                        <span>Tổng tiền chiết khấu:</span>
                        <span>${formatMoney(totalDiscount)} VND</span>
                    </div>
                    <div class="summary-row">
                        <span>Tổng giá trị bán:</span>
                        <span>${formatMoney(totalSelling)} VND</span>
                    </div>
                    <div class="summary-row total">
                        <span>Tổng tiền thanh toán:</span>
                        <span>${formatMoney(totalPayment)} VND</span>
                    </div>
                    ${comparison.message ? `<div class="error-message">${comparison.message}</div>` : ''}
                </div>
                <button onclick="addInvoiceItem('${invoiceId}')">➕ Thêm dòng hàng hóa</button>
            </div>
        `;

        const existingPopup = document.querySelector('.popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <style>
                .popup {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 999;
                }
                .popup-content {
                    background: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow: auto;
                    display: flex;
                    gap: 20px;
                }
                .invoice-comparison {
                    display: flex;
                    gap: 20px;
                    width: 100%;
                }
                .invoice-pdf {
                    flex: 1;
                    max-width: 50%;
                }
                .close-popup {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #ff4444;
                    color: #fff;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    padding: 5px 10px;
                    font-size: 16px;
                }
            </style>
            <div class="popup-content">
                <span class="close-popup" onclick="this.parentElement.parentElement.remove()">❌</span>
                <div class="invoice-comparison">
                    <div class="invoice-pdf">
                        <h4>Hóa đơn PDF</h4>
                        <div class="pdf-container">
                            <iframe src="${getGISViewerUrl(invoiceId)}" width="100%" height="1000px"></iframe>
                            <div class="magnifier"></div>
                        </div>
                    </div>
                    ${invoiceTable}
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        setupMagnifier();

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });
    } catch (e) {
        console.error('Lỗi showInvoiceDetails:', e);
        alert('Lỗi khi hiển thị hóa đơn: ' + e.message);
    }
}

