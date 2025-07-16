// Data storage
let hkdData = {};
let actionHistory = [];
let currentTaxCode = null;
let isLoggingStorage = false;
let hkdOrder = [];
let exportDraft = null;
let currentTonKhoTab = 'main'; // theo dõi tab tồn kho đang mở

// DOM elements
const zipFileInput = document.getElementById('zipFile');
const businessList = document.getElementById('businessList');
const mainContent = document.getElementById('mainContent');

// Storage handler
const storageHandler = {
    save: function (key, data) {
        try {
            const dataString = JSON.stringify(data);
            localStorage.setItem(key, dataString);
            if (!isLoggingStorage) {
                isLoggingStorage = true;
                logAction('storage_save', { key, dataSize: dataString.length });
                isLoggingStorage = false;
            }
            showToast('Lưu dữ liệu thành công', 'success');
        } catch (error) {
            logAction('storage_error', { error: error.message });
            showToast('Lỗi khi lưu dữ liệu: ' + error.message, 'error');
        }
    },
    load: function (key) {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                if (!isLoggingStorage) {
                    isLoggingStorage = true;
                    logAction('storage_load', { key, dataSize: data.length });
                    isLoggingStorage = false;
                }
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            logAction('storage_error', { error: error.message });
            showToast('Lỗi khi tải dữ liệu: ' + error.message, 'error');
            return null;
        }
    },
    clear: function (key) {
        try {
            localStorage.removeItem(key);
            if (!isLoggingStorage) {
                isLoggingStorage = true;
                logAction('storage_clear', { key });
                isLoggingStorage = false;
            }
            showToast('Xóa dữ liệu lưu trữ thành công', 'success');
        } catch (error) {
            logAction('storage_error', { error: error.message });
            showToast('Lỗi khi xóa dữ liệu: ' + error.message, 'error');
        }
    }
};

// Logging function
function logAction(action, details) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        details
    };
    console.log('LOG:', logEntry);
    let logs = storageHandler.load('app_logs') || [];
    logs.push(logEntry);
    if (logs.length > 1000) {
        logs = logs.slice(-1000);
    }
    isLoggingStorage = true;
    storageHandler.save('app_logs', logs);
    isLoggingStorage = false;
}

// Toast notification
function showToast(message, type = 'info') {
    try {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    } catch (error) {
        console.error('Toast error:', error.message);
        console.log(`Fallback: ${message} (${type})`);
    }
}

// Initialize data from storage
function initData() {
    const savedData = storageHandler.load('hkd_data');
    if (savedData) {
        Object.keys(savedData).forEach(taxCode => {
            savedData[taxCode].invoices = savedData[taxCode].invoices || [];
            savedData[taxCode].inventory = savedData[taxCode].inventory || [];
            savedData[taxCode].exportHistory = savedData[taxCode].exportHistory || [];
            savedData[taxCode].deleteHistory = savedData[taxCode].deleteHistory || [];
            savedData[taxCode].tag = savedData[taxCode].tag || '';
            savedData[taxCode].color = savedData[taxCode].color || '';
            savedData[taxCode].lastInteracted = savedData[taxCode].lastInteracted || 0;
        });

        // ✅ Giữ nguyên object gốc
        Object.assign(hkdData, savedData);

        hkdOrder = storageHandler.load('hkd_order') || Object.keys(hkdData);
        updateBusinessList();

        if (currentTaxCode) {
            showBusinessDetails(currentTaxCode);
        }
    }
}
function saveData() {
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
}

// File input change event
function handleFiles() {
    if (!zipFileInput.files.length) return;

    for (const file of zipFileInput.files) {
        if (!file.name.endsWith('.zip')) {
            showToast('Vui lòng chọn file ZIP', 'error');
            continue;
        }

        extractInvoiceFromZip(file).then(invoiceData => {
    processInvoiceData(invoiceData);
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    updateBusinessList();
    if (currentTaxCode) {
        showBusinessDetails(currentTaxCode);
    }
}).catch(error => {
    const errorMsg = `Lỗi khi xử lý file ${file.name}: ${error.message}`;
    showToast(errorMsg, 'error');
    console.error(errorMsg, error);

    // ✅ Ghi log chi tiết
    logAction('invoice_parse_error', {
        filename: file.name,
        message: error.message,
        stack: error.stack || 'No stack trace',
        time: new Date().toISOString()
    });
});
    }
}



// Parse XML with precise extraction
function parseXmlInvoice(xmlContent) {
  // Tạo parser để phân tích XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Hàm hỗ trợ lấy nội dung văn bản từ node XML
  const getText = (path, parent = xmlDoc) => {
    const node = parent.querySelector(path);
    return node ? node.textContent.trim() : '';
  };

  // Hàm hỗ trợ lấy thông tin bổ sung (ví dụ: trạng thái thanh toán)
  const getAdditionalInfo = (fieldName) => {
    const ttKhacNode = xmlDoc.querySelector('HDon > DLHDon > NDHDon > TToan > TTKhac');
    if (ttKhacNode) {
      const nodes = ttKhacNode.querySelectorAll('TTin');
      for (const node of nodes) {
        const field = node.querySelector('TTruong');
        if (field && field.textContent.trim() === fieldName) {
          return node.querySelector('DLieu')?.textContent.trim() || '';
        }
      }
    }
    return '';
  };

  // Trích xuất thông tin hóa đơn
  const invoiceInfo = {
    title: getText('HDon > DLHDon > TTChung > THDon'),
    template: getText('HDon > DLHDon > TTChung > KHHDon'),
    symbol: getText('HDon > DLHDon > TTChung > KHMSHDon'),
    number: getText('HDon > DLHDon > TTChung > SHDon'),
    date: getText('HDon > DLHDon > TTChung > NLap'),
    paymentMethod: getText('HDon > DLHDon > TTChung > HTTToan'),
    paymentStatus: getAdditionalInfo('Trạng thái thanh toán'),
    amountInWords: getAdditionalInfo('TotalAmountInWordsByENG') || '',
    mccqt: getText('HDon > MCCQT')?.trim().toUpperCase() || ''
  };

  // Trích xuất thông tin người bán
  const sellerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NBan > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NBan > MST'),
    address: getText('HDon > DLHDon > NDHDon > NBan > DChi'),
    phone: getText('HDon > DLHDon > NDHDon > NBan > SDThoai'),
    email: getText('HDon > DLHDon > NDHDon > NBan > DCTDTu')
  };

  // Trích xuất thông tin người mua
  const buyerInfo = {
    name: getText('HDon > DLHDon > NDHDon > NMua > Ten'),
    taxCode: getText('HDon > DLHDon > NDHDon > NMua > MST'),
    address: getText('HDon > DLHDon > NDHDon > NMua > DChi'),
    customerCode: getText('HDon > DLHDon > NDHDon > NMua > MKHang'),
    idNumber: getText('HDon > DLHDon > NDHDon > NMua > CCCDan')
  };

  // Trích xuất danh sách sản phẩm
  const products = [];
  const productNodes = xmlDoc.querySelectorAll('HHDVu');
  let totalManual = 0;

  productNodes.forEach((node, index) => {
    const stt = getText('STT', node) || (index + 1).toString();
    const code = getText('MHHDVu', node) || `UNKNOWN_${index}`;
    const name = getText('THHDVu', node) || 'Không xác định';
    const unit = getText('DVTinh', node) || 'N/A';
    const quantity = parseFloat(getText('SLuong', node)) || 0;
    const price = parseFloat(getText('DGia', node)) || 0;
    const discount = parseFloat(getText('STCKhau', node)) || 0;
    const taxRate = parseFloat(getText('TSuat', node)) || 0;
    const tchat = parseInt(getText('TChat', node) || '1');
    const xmlThTien = parseFloat(getText('ThTien', node)) || 0;

    let amount = Math.round(xmlThTien);
    if (tchat === 3) amount *= -1; // Xử lý chiết khấu (giá trị âm)

    totalManual += amount;

    const category = (tchat === 3 || name.toLowerCase().includes('chiết khấu')) ? 'chiet_khau'
                : (price === 0 || name.toLowerCase().includes('khuyến mại')) ? 'KM'
                : 'hang_hoa';


    products.push({
      stt,
      code,
      name,
      unit,
      quantity: quantity.toString(),
      price: price.toString(),
      discount: discount.toString(),
      amount,
      taxRate: taxRate.toString(),
      category,
      tchat,
      __diff: Math.abs(amount - xmlThTien) >= 1,
      xmlAmount: Math.round(xmlThTien),
      isFree: price === 0
    });
  });

  // Trích xuất tổng cộng từ XML
 const ttCKTMai = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TTCKTMai') || '0');
const tgTThue  = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTThue') || '0');
const tgTTTBSo = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTTTBSo') || '0');
const tgTCThue = parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTCThue') || '0');



  const totals = {
  beforeTax: totalManual,
  tax: Math.round(tgTThue),
  fee: 0,
  discount: Math.round(ttCKTMai),
  total: Math.round(totalManual + tgTThue),
  xmlDeclared: Math.round(tgTTTBSo),
  TgTCThue: Math.round(tgTCThue) // ✅ Tổng tiền chưa thuế từ XML
};


  // Trả về đối tượng chứa toàn bộ thông tin hóa đơn
  return { invoiceInfo, sellerInfo, buyerInfo, products, totals };
}
// Process invoice data and group by MST
// REPLACE with:

// Calculate selling price
function calculateSellingPrice(cost) {
    const percentage = 0.1;
    const fixedAmount = 3000;
    const sellingPrice = cost * (1 + percentage) + fixedAmount;
    logAction('calculate_price', { cost, percentage, fixedAmount, result: sellingPrice });
    return sellingPrice.toFixed(2);
}

// Show tag and color form
function showTagColorForm(taxCode) {
    const hkd = hkdData[taxCode];
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Gán Tag và Màu sắc</h3>
            <form id="tagColorForm">
                <input type="text" id="hkdTag" value="${hkd.tag || ''}" placeholder="Nhập tag" maxlength="50">
                <select id="hkdColor" required>
                    <option value="" ${!hkd.color ? 'selected' : ''}>Không màu</option>
                    <option value="#ffcccc" ${hkd.color === '#ffcccc' ? 'selected' : ''}>Hồng nhạt</option>
                    <option value="#ccffcc" ${hkd.color === '#ccffcc' ? 'selected' : ''}>Xanh nhạt</option>
                    <option value="#ccccff" ${hkd.color === '#ccccff' ? 'selected' : ''}>Tím nhạt</option>
                    <option value="#ffffcc" ${hkd.color === '#ffffcc' ? 'selected' : ''}>Vàng nhạt</option>
                </select>
                <button type="submit">Lưu</button>
                <button type="button" onclick="this.closest('.modal').remove()">Hủy</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById('tagColorForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        updateTagColor(taxCode);
        modal.remove();
    });
}

// Update tag and color
function updateTagColor(taxCode) {
    const tag = document.getElementById('hkdTag').value.trim();
    const color = document.getElementById('hkdColor').value;
    const oldTag = hkdData[taxCode].tag;
    const oldColor = hkdData[taxCode].color;

    hkdData[taxCode].tag = tag;
    hkdData[taxCode].color = color;
    hkdData[taxCode].lastInteracted = Date.now();
    hkdOrder = hkdOrder.filter(code => code !== taxCode);
    hkdOrder.unshift(taxCode);

    actionHistory.push({
        type: 'update_tag_color',
        oldData: { tag: oldTag, color: oldColor },
        newData: { tag, color },
        taxCode
    });
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    updateBusinessList();
    showBusinessDetails(taxCode);
    showToast('Cập nhật tag và màu sắc thành công', 'success');
    logAction('update_tag_color', { taxCode, tag, color });
}

// Update HKD list
function updateBusinessList() {
    if (!businessList) {
        logAction('error', { message: 'Không tìm thấy #businessList trong DOM' });
        showToast('Lỗi: Không tìm thấy danh sách doanh nghiệp', 'error');
        return;
    }
    businessList.innerHTML = '';
    hkdOrder.forEach(taxCode => {
        const hkd = hkdData[taxCode];
        if (!hkd) return;
        const li = document.createElement('li');
        li.textContent = `${hkd.tag ? `[${hkd.tag}] ` : ''}${hkd.name} (${taxCode}) - ${hkd.invoices.length} hóa đơn`;
        li.dataset.taxCode = taxCode;
        if (hkd.color) {
            li.style.backgroundColor = hkd.color;
            li.style.color = '#000000';
        }
        li.addEventListener('click', () => {
            currentTaxCode = taxCode;
            hkdData[taxCode].lastInteracted = Date.now();
            hkdOrder = hkdOrder.filter(code => code !== taxCode);
            hkdOrder.unshift(taxCode);
            storageHandler.save('hkd_order', hkdOrder);
            showBusinessDetails(taxCode);
            document.querySelectorAll('.sidebar li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
        });
        businessList.appendChild(li);
    });
    if (!currentTaxCode && hkdOrder.length > 0) {
        const firstTaxCode = hkdOrder[0];
        currentTaxCode = firstTaxCode;
        showBusinessDetails(firstTaxCode);
        businessList.querySelector(`li[data-tax-code="${firstTaxCode}"]`).classList.add('active');
    }
}




function deleteInvoice(invoiceNumber, mccqt, taxCode) {
    const invoices = hkdData[taxCode].invoices;
    const index = invoices.findIndex(i => i.invoiceInfo.number === invoiceNumber && i.invoiceInfo.mccqt === mccqt);

    if (index !== -1) {
        const inv = invoices[index];
        const htmlUrl = inv.invoiceInfo?.htmlUrl;

        // Xoá file HTML nếu có
        if (htmlUrl) {
            const filename = htmlUrl.split('/').pop();
            deleteFileFromGitHub(filename);
        }

        // Xoá khỏi danh sách
        invoices.splice(index, 1);
        storageHandler.save('hkd_data', hkdData);
        showBusinessDetails(taxCode);
        showToast(`✅ Đã xoá hóa đơn ${invoiceNumber}`, 'success');
    } else {
        showToast(`❌ Không tìm thấy hóa đơn để xoá`, 'error');
    }
}

async function deleteFileFromGitHub(filename) {
    const token = getGitHubToken();
    if (!token) {
        showToast('❌ Chưa có GitHub Token', 'error');
        return;
    }

    const apiUrl = `https://api.github.com/repos/Datkep92/test/contents/invoices/${filename}`;

    try {
        const getRes = await fetch(apiUrl, {
            headers: { Authorization: `token ${token}` }
        });
        const fileInfo = await getRes.json();

        if (!fileInfo.sha) {
            console.warn('⚠️ Không tìm thấy SHA của file:', filename);
            return;
        }

        const deleteRes = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `delete ${filename}`,
                sha: fileInfo.sha
            })
        });

        if (deleteRes.ok) {
            console.log(`✅ Đã xóa file ${filename} khỏi GitHub`);
            showToast(`✅ File HTML đã xoá khỏi GitHub`, 'success');
        } else {
            const err = await deleteRes.json();
            console.error('❌ Xóa thất bại:', err);
            showToast('❌ Không thể xoá file trên GitHub', 'error');
        }
    } catch (err) {
        console.error('❌ Lỗi GitHub API:', err);
        showToast('❌ Lỗi khi kết nối GitHub', 'error');
    }
}


function updatePopupProduct(invoiceIdx, productIdx, field, value, taxCode) {
    const p = hkdData[taxCode].invoices[invoiceIdx].products[productIdx];
    p[field] = parseFloat(value) || 0;
    p.amount = (p.quantity * p.price - (parseFloat(p.discount || 0))).toFixed(2);
    p.tax = (p.quantity * p.price * (parseFloat(p.taxRate || 0)) / 100).toFixed(2);
    showToast('Đã cập nhật tạm thời', 'info');
}

function calculateTotalFromProducts(products) {
    return products.reduce((sum, p) => sum + parseFloat(p.amount || 0) + parseFloat(p.tax || 0), 0);
}


// Product management functions
function showAddProductForm(taxCode, item = null, index = null) {
  const isEdit = !!item;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${isEdit ? 'Sửa dòng hàng hóa' : 'Thêm sản phẩm mới'}</h3>
      <form id="addProductForm">
        <input type="text" id="productName" placeholder="Tên sản phẩm" required value="${item?.name || ''}">
        <input type="text" id="productCode" placeholder="Mã sản phẩm" required value="${item?.code || ''}">
        <input type="text" id="productUnit" placeholder="Đơn vị tính" required value="${item?.unit || ''}">
        <select id="productCategory" required>
          <option value="hang_hoa" ${item?.category === 'hang_hoa' ? 'selected' : ''}>Hàng hóa</option>
          <option value="KM" ${item?.category === 'KM' ? 'selected' : ''}>Khuyến mại</option>
          <option value="chiet_khau" ${item?.category === 'chiet_khau' ? 'selected' : ''}>Chiết khấu</option>
        </select>
        <input type="number" id="productQuantity" placeholder="Số lượng" required min="0" step="0.01" value="${item?.quantity || ''}">
        <input type="number" id="productPrice" placeholder="Đơn giá" required min="0" step="0.01" value="${item?.price || ''}">
        <input type="number" id="productTaxRate" placeholder="Thuế suất (%)" required min="0" step="0.01" value="${item?.taxRate || ''}">
        <button type="submit">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
        <button type="button" onclick="this.closest('.modal').remove()">Hủy</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('addProductForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('productName').value,
      code: document.getElementById('productCode').value,
      unit: document.getElementById('productUnit').value,
      category: document.getElementById('productCategory').value,
      quantity: parseFloat(document.getElementById('productQuantity').value),
      price: parseFloat(document.getElementById('productPrice').value),
      taxRate: parseFloat(document.getElementById('productTaxRate').value),
    };
    data.amount = data.quantity * data.price;

    const hkd = hkdData[taxCode];
    if (isEdit && index != null) {
      hkd.inventory[index] = data;
    } else {
      hkd.inventory.push(data);
    }

    modal.remove();
    switchTonKhoTab(currentTonKhoTab); // reload lại tab hiện tại
  });
}

function addProduct(taxCode) {
    const name = document.getElementById('productName').value.trim();
    const code = document.getElementById('productCode').value.trim();
    const unit = document.getElementById('productUnit').value.trim();
    const category = document.getElementById('productCategory').value;
    const quantity = parseFloat(document.getElementById('productQuantity').value);
    const price = parseFloat(document.getElementById('productPrice').value);
    const taxRate = parseFloat(document.getElementById('productTaxRate').value);

    if (!name || !code || !unit || !category) {
        showToast('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }
    if (isNaN(quantity) || isNaN(price) || isNaN(taxRate) || quantity < 0 || price < 0 || taxRate < 0) {
        showToast('Vui lòng nhập số hợp lệ (không âm)', 'error');
        return;
    }
    if (!['hang_hoa', 'KM', 'chiet_khau'].includes(category)) {
        showToast('Phân loại không hợp lệ', 'error');
        return;
    }

    const product = {
        code,
        name,
        unit,
        category,
        quantity: quantity.toString(),
        price: price.toString(),
        taxRate: taxRate.toString(),
        tax: (quantity * price * taxRate / 100).toString(),
        amount: (quantity * price).toString(),
        type: 'Nhập',
        sellingPrice: calculateSellingPrice(price)
    };

    hkdData[taxCode].inventory.push(product);
    hkdData[taxCode].lastInteracted = Date.now();
    hkdOrder = hkdOrder.filter(code => code !== taxCode);
    hkdOrder.unshift(taxCode);
    actionHistory.push({
        type: 'add_product',
        data: { ...product },
        taxCode
    });
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    showBusinessDetails(taxCode);
    showToast('Thêm sản phẩm thành công', 'success');
    logAction('add_product', { taxCode, productCode: code });
}

function editProduct(taxCode, code, unit) {
    const item = hkdData[taxCode].inventory.find(item => item.code === code && item.unit === unit);
    if (!item) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Sửa sản phẩm</h3>
            <form id="editProductForm">
                <input type="text" id="productName" value="${item.name}" required>
                <input type="text" id="productCode" value="${item.code}" readonly>
                <input type="text" id="productUnit" value="${item.unit}" readonly>
                <select id="productCategory" required>
                    <option value="hang_hoa" ${item.category === 'hang_hoa' ? 'selected' : ''}>Hàng hóa</option>
                    <option value="KM" ${item.category === 'KM' ? 'selected' : ''}>Khuyến mại</option>
                    <option value="chiet_khau" ${item.category === 'chiet_khau' ? 'selected' : ''}>Chiết khấu</option>
                </select>
                <input type="number" id="productQuantity" value="${item.quantity}" required min="0" step="0.01">
                <input type="number" id="productPrice" value="${item.price}" required min="0" step="0.01">
                <input type="number" id="productTaxRate" value="${item.taxRate}" required min="0" step="0.01">
                <button type="submit">Lưu</button>
                <button type="button" onclick="this.closest('.modal').remove()">Hủy</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById('editProductForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        updateProduct(taxCode, code, unit);
        modal.remove();
    });
}

function updateProduct(taxCode, code, unit) {
    const itemIndex = hkdData[taxCode].inventory.findIndex(item => item.code === code && item.unit === unit);
    if (itemIndex === -1) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const quantity = parseFloat(document.getElementById('productQuantity').value);
    const price = parseFloat(document.getElementById('productPrice').value);
    const taxRate = parseFloat(document.getElementById('productTaxRate').value);

    if (!name || !category) {
        showToast('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }
    if (isNaN(quantity) || isNaN(price) || isNaN(taxRate) || quantity < 0 || price < 0 || taxRate < 0) {
        showToast('Vui lòng nhập số hợp lệ (không âm)', 'error');
        return;
    }
    if (!['hang_hoa', 'KM', 'chiet_khau'].includes(category)) {
        showToast('Phân loại không hợp lệ', 'error');
        return;
    }

    const oldItem = { ...hkdData[taxCode].inventory[itemIndex] };
    const updatedItem = {
        code,
        unit,
        name,
        category,
        quantity: quantity.toString(),
        price: price.toString(),
        taxRate: taxRate.toString(),
        tax: (quantity * price * taxRate / 100).toString(),
        amount: (quantity * price).toString(),
        type: 'Nhập',
        sellingPrice: calculateSellingPrice(price)
    };

    hkdData[taxCode].inventory[itemIndex] = updatedItem;
    hkdData[taxCode].lastInteracted = Date.now();
    hkdOrder = hkdOrder.filter(code => code !== taxCode);
    hkdOrder.unshift(taxCode);
    actionHistory.push({
        type: 'edit_product',
        oldData: oldItem,
        newData: { ...updatedItem },
        taxCode
    });
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    showBusinessDetails(taxCode);
    showToast('Cập nhật sản phẩm thành công', 'success');
    logAction('edit_product', { taxCode, productCode: code });
}

function deleteProduct(taxCode, code, unit) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

    const itemIndex = hkdData[taxCode].inventory.findIndex(item => item.code === code && item.unit === unit);
    if (itemIndex === -1) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const deletedItem = hkdData[taxCode].inventory.splice(itemIndex, 1)[0];
    hkdData[taxCode].lastInteracted = Date.now();
    hkdOrder = hkdOrder.filter(code => code !== taxCode);
    hkdOrder.unshift(taxCode);
    actionHistory.push({
        type: 'delete_product',
        data: deletedItem,
        taxCode
    });
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    showBusinessDetails(taxCode);
    showToast('Xóa sản phẩm thành công', 'success');
    logAction('delete_product', { taxCode, productCode: code });
}

// Delete HKD
function deleteHKD(taxCode) {
    if (!confirm(`Bạn có chắc muốn xóa HKD ${taxCode}?`)) return;

    const hkd = hkdData[taxCode];
    if (!hkd) {
        showToast('Không tìm thấy HKD', 'error');
        return;
    }

    Object.keys(hkdData).forEach(key => {
        if (key !== taxCode) {
            hkdData[key].deleteHistory = hkdData[key].deleteHistory || [];
            hkdData[key].deleteHistory.push({
                timestamp: new Date().toISOString(),
                taxCode,
                name: hkd.name
            });
        }
    });

    actionHistory.push({
        type: 'delete_hkd',
        data: { taxCode, hkd: { ...hkd } }
    });
    delete hkdData[taxCode];
    hkdOrder = hkdOrder.filter(code => code !== taxCode);
    if (currentTaxCode === taxCode) {
        currentTaxCode = null;
        mainContent.innerHTML = '<div id="hkdInfo">Chưa chọn HKD</div>';
    }
    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    updateBusinessList();
    showToast(`Xóa HKD ${taxCode} thành công`, 'success');
    logAction('delete_hkd', { taxCode });
}

// Product action handler
function productAction(select, taxCode, code, unit) {
    const action = select.value;
    select.value = '';
    if (action === 'add') {
        showAddProductForm(taxCode);
    } else if (action === 'edit') {
        editProduct(taxCode, code, unit);
    } else if (action === 'delete') {
        deleteProduct(taxCode, code, unit);
    }
}

// Format currency
function formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '0';
    return parseFloat(amount).toLocaleString('vi-VN') + ' đ';
}

// Format number
function formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return parseFloat(num).toLocaleString('vi-VN');
}

function openTab(event, tabId) {
  const tabElement = document.getElementById(tabId);
  if (!tabElement) return;

  const tabContentContainer = tabElement.parentElement;
  if (!tabContentContainer) return;

  const tabContent = tabContentContainer.querySelectorAll('.tab-content');
  const tabs = event.currentTarget?.parentElement?.querySelectorAll('.tab') || [];

  // Ẩn tất cả nội dung và xóa active tab
  tabContent.forEach(content => content.classList.remove('active'));
  tabs.forEach(tab => tab.classList.remove('active'));

  // Hiện tab mới
  tabElement.classList.add('active');
  event.currentTarget?.classList.add('active');

  // ✅ Khi vào tab tồn kho → tự động hiển thị tab chính
  if (tabId.endsWith('-tonkho')) {
    switchTonKhoTab('main');
  }
}

// Clear all data
function clearAll() {
    actionHistory.push({
        type: 'clear_all',
        data: { hkdData: { ...hkdData }, hkdOrder: [...hkdOrder] }
    });
    hkdData = {};
    hkdOrder = [];
    currentTaxCode = null;
    storageHandler.clear('hkd_data');
    storageHandler.clear('hkd_order');
    updateBusinessList();
    mainContent.innerHTML = '<div id="hkdInfo">Chưa chọn HKD</div>';
    showToast('Xóa toàn bộ dữ liệu thành công', 'success');
    logAction('clear_all', {});
}

// Undo action
function undoAction() {
    const lastAction = actionHistory.pop();
    if (!lastAction) {
        showToast('Không có hành động để hoàn tác', 'info');
        return;
    }

    if (lastAction.type === 'clear_all') {
        hkdData = { ...lastAction.data.hkdData };
        hkdOrder = [...lastAction.data.hkdOrder];
    } else if (lastAction.type === 'add_invoice') {
        const taxCode = lastAction.taxCode;
        hkdData[taxCode].invoices = hkdData[taxCode].invoices.filter(
            inv => inv.invoiceInfo.number !== lastAction.data.invoiceInfo.number
        );
        hkdData[taxCode].inventory = [];
        hkdData[taxCode].invoices.forEach(invoice => {
            invoice.products.forEach(product => {
                const existingItem = hkdData[taxCode].inventory.find(item =>
                    item.code === product.code && item.unit === product.unit
                );
                if (existingItem) {
                    existingItem.quantity = (parseFloat(existingItem.quantity) + parseFloat(product.quantity)).toString();
                    existingItem.amount = (parseFloat(existingItem.quantity) * parseFloat(existingItem.price)).toString();
                    existingItem.tax = (parseFloat(existingItem.quantity) * parseFloat(existingItem.price) * parseFloat(existingItem.taxRate) / 100).toString();
                    existingItem.sellingPrice = calculateSellingPrice(parseFloat(existingItem.price));
                } else {
                    hkdData[taxCode].inventory.push({
                        code: product.code,
                        name: product.name,
                        unit: product.unit,
                        quantity: product.quantity,
                        price: product.price,
                        amount: product.amount,
                        type: 'Nhập',
                        sellingPrice: calculateSellingPrice(parseFloat(product.price)),
                        category: product.category,
                        taxRate: product.taxRate,
                        tax: product.tax
                    });
                }
            });
        });
        if (hkdData[taxCode].invoices.length === 0) {
            delete hkdData[taxCode];
            hkdOrder = hkdOrder.filter(code => code !== taxCode);
            if (currentTaxCode === taxCode) {
                currentTaxCode = null;
                mainContent.innerHTML = '<div id="hkdInfo">Chưa chọn HKD</div>';
            }
        }
    } else if (lastAction.type === 'add_product') {
        const taxCode = lastAction.taxCode;
        hkdData[taxCode].inventory = hkdData[taxCode].inventory.filter(
            item => item.code !== lastAction.data.code || item.unit !== lastAction.data.unit
        );
        hkdData[taxCode].lastInteracted = Date.now();
        hkdOrder = hkdOrder.filter(code => code !== taxCode);
        hkdOrder.unshift(taxCode);
    } else if (lastAction.type === 'edit_product') {
        const taxCode = lastAction.taxCode;
        const itemIndex = hkdData[taxCode].inventory.findIndex(
            item => item.code === lastAction.oldData.code && item.unit === lastAction.oldData.unit
        );
        if (itemIndex !== -1) {
            hkdData[taxCode].inventory[itemIndex] = { ...lastAction.oldData };
            hkdData[taxCode].lastInteracted = Date.now();
            hkdOrder = hkdOrder.filter(code => code !== taxCode);
            hkdOrder.unshift(taxCode);
        }
    } else if (lastAction.type === 'delete_product') {
        const taxCode = lastAction.taxCode;
        hkdData[taxCode].inventory.push(lastAction.data);
        hkdData[taxCode].lastInteracted = Date.now();
        hkdOrder = hkdOrder.filter(code => code !== taxCode);
        hkdOrder.unshift(taxCode);
    } else if (lastAction.type === 'delete_hkd') {
        const taxCode = lastAction.data.taxCode;
        hkdData[taxCode] = { ...lastAction.data.hkd };
        hkdOrder.unshift(taxCode);
        Object.keys(hkdData).forEach(key => {
            if (key !== taxCode) {
                hkdData[key].deleteHistory = hkdData[key].deleteHistory.filter(
                    entry => entry.taxCode !== taxCode
                );
            }
        });
    } else if (lastAction.type === 'update_tag_color') {
        const taxCode = lastAction.taxCode;
        hkdData[taxCode].tag = lastAction.oldData.tag;
        hkdData[taxCode].color = lastAction.oldData.color;
        hkdData[taxCode].lastInteracted = Date.now();
        hkdOrder = hkdOrder.filter(code => code !== taxCode);
        hkdOrder.unshift(taxCode);
    }

    storageHandler.save('hkd_data', hkdData);
    storageHandler.save('hkd_order', hkdOrder);
    updateBusinessList();
    if (currentTaxCode) {
        showBusinessDetails(currentTaxCode);
    }
    showToast('Hoàn tác hành động thành công', 'success');
    logAction('undo_action', { type: lastAction.type });
}

// Summarize (placeholder)
function summarize() {
    showToast('Chức năng tổng kết đang được phát triển', 'info');
    logAction('summarize_attempt', {});
}

// Upload to GitHub (placeholder)
function uploadToGitHub() {
    showToast('Chức năng đẩy lên GitHub đang được phát triển', 'info');
    logAction('github_upload_attempt', {});
}

// Search HKD (placeholder)
function searchHKD() {
    showToast('Chức năng tìm kiếm đang được phát triển', 'info');
    logAction('search_hkd_attempt', {});
}

// Export data (placeholder)
function exportData() {
    showToast('Chức năng xuất dữ liệu đang được phát triển', 'info');
    logAction('export_data_attempt', {});
}

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    if (!zipFileInput) console.error('zipFileInput not found');
    if (!businessList) console.error('businessList not found');
    if (!mainContent) console.error('mainContent not found');
    zipFileInput.addEventListener('change', handleFiles);
    initData();
});

//


function generateRandomExport(taxCode) {
    const buyerInfo = {
        buyer: randomCustomerName(),
        address: randomAddressNinhThuan(),
        requestedAmount: amount
    };
    const input = document.getElementById(`exportAmount-${taxCode}`);
    const amount = parseFloat(input.value.replace(/[^\d.-]/g, ''));
    if (isNaN(amount) || amount <= 0) {
        showToast('⚠️ Vui lòng nhập số tiền cần xuất!', 'warning');
        return;
    }

    generateOptimizedExport(taxCode, amount);
}
function renderExportProductRows(products, hkd) {
    let total = 0;
    const rows = products.map((p, i) => {
        const item = hkd.inventory.find(it => it.code === p.code && it.unit === p.unit);
        const maxQty = parseFloat(item?.quantity || 0);
        const price = parseFloat(p.sellingPrice || 0);
        const qty = parseFloat(p.quantity || 0);
        const lineTotal = qty * price;
        total += lineTotal;

        return `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${p.code}</td>
                <td><input type="number" value="${qty}" min="1" max="${maxQty}" onchange="updateExportQty(event, ${i})" /></td>
                <td class="text-right">${formatCurrency(price)}</td>
                <td class="text-right">${formatCurrency(lineTotal)}</td>
            </tr>`;
    }).join('');

    return `
        <table>
            <thead>
                <tr><th>STT</th><th>Tên</th><th>Mã</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="text-align:right; margin-top:10px;">
            <b>Tổng tiền xuất: ${formatCurrency(total)}</b>
        </div>
    `;
}

function showExportPopup(mode, taxCode, buyerInfo, products) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    // Lưu tạm để sử dụng lại khi random lại
    exportDraft = { taxCode, buyerInfo, productList: products, mode };

    const html = `
        <h3>📤 Xuất hàng (${mode.toUpperCase()})</h3>
        <div style="display: flex; flex-wrap: wrap; margin-bottom:10px; gap: 20px;">
            <label>👤 Họ tên người mua: <input id="exportBuyerName" value="${buyerInfo.name || ''}" /></label>
            <label>🏠 Địa chỉ: <input id="exportBuyerAddress" value="${buyerInfo.address || ''}" /></label>
            <label>💵 Số tiền yêu cầu: <b>${formatCurrency(buyerInfo.requestedAmount || 0)}</b></label>
        </div>

        <div id="exportProductTable">
            ${renderExportProductRows(products, hkd)}
        </div>

        <div style="margin-top:15px; text-align:right;">
            <button onclick="generateOptimizedExport('${taxCode}', ${buyerInfo.requestedAmount})">🔁 Random lại</button>
            <button onclick="confirmExport('${taxCode}', getExportBuyerInfo(), getExportProductList(), '${mode}')">✅ Xuất hàng</button>
            <button onclick="printExportInvoice('${taxCode}')">🖨️ In hóa đơn</button>
            <button onclick="closePopup()">❌ Đóng</button>
        </div>
    `;

    showPopup(html);
}

function randomCustomerName() {
    const names = [
        "Nguyễn Văn A", "Trần Thị B", "Lê Văn C", "Phạm Thị D",
        "Võ Văn E", "Hoàng Thị F", "Đặng Văn G", "Bùi Thị H",
        "Phan Văn I", "Ngô Thị K"
    ];
    return names[Math.floor(Math.random() * names.length)];
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = (c === 'x') ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function randomAddressVN() {
    const addresses = [
        "01 Trần Hưng Đạo, Hà Nội", "22 Lê Lợi, TP.HCM", "77 Hai Bà Trưng, Đà Nẵng",
        "15 Nguyễn Huệ, Huế", "99 Phan Đình Phùng, Cần Thơ", "03 Lý Thường Kiệt, Bình Dương"
    ];
    return addresses[Math.floor(Math.random() * addresses.length)];
}

function updateExportQty(event, index) {
    const qty = parseFloat(event.target.value);
    if (isNaN(qty) || qty <= 0) return;
    exportDraft.productList[index].quantity = qty;
    showExportPopup(exportDraft.mode, exportDraft.taxCode, exportDraft.buyerInfo, exportDraft.productList);
}




function confirmExport(taxCode, buyerInfo, productList, mode) {
    if (!productList || productList.length === 0) {
        showToast("❌ Chưa chọn hàng hóa để xuất", "error");
        return;
    }
    const invalidItem = productList.find(p => {
        const inv = hkdData[taxCode].inventory.find(i => i.code === p.code);
        return !inv || inv.quantity < p.quantity;
    });

    if (invalidItem) {
        showToast(`❌ Sản phẩm "${invalidItem.name}" không đủ tồn kho để xuất`, "error");
        return;
    }

    const total = productList.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0);
    if (total <= 0) {
        showToast("❌ Tổng tiền không hợp lệ", "error");
        return;
    }

    const record = {
        buyerName: buyerInfo.name || randomCustomerName(),
        buyerAddress: buyerInfo.address || randomAddressVN(),
        buyerPhone: buyerInfo.phone || '',
        buyerTaxCode: buyerInfo.taxCode || '',
        mode: mode,
        items: productList
    };

    // ✅ Xuất Excel & xử lý lưu/lịch sử/tồn kho bên trong 1 lần duy nhất
    downloadExportExcel(taxCode, record);

    // ✅ Không gọi lại thêm gì ở đây để tránh trùng
}

// lịch sử xuất hàng
function renderExportHistory(taxCode) {
    const hkd = hkdData[taxCode];
    if (!hkd || !Array.isArray(hkd.exportHistory)) return '<p>Chưa có lịch sử xuất hàng</p>';

    const sorted = hkd.exportHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return `
        <table>
            <thead>
                <tr>
                    <th>STT</th><th>Người mua</th><th>MST</th><th>Thời gian</th><th>Số lượng SP</th><th>Tổng tiền</th><th>Chế độ</th><th>Xem</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((e, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${e.buyerName || 'N/A'}</td>
                        <td>${e.buyerTaxCode || 'N/A'}</td>
                        <td>${new Date(e.timestamp).toLocaleString('vi-VN')}</td>
                        <td>${e.productList?.length || 0}</td>
                        <td class="text-right">${formatCurrency(e.totalAmount)}</td>
                        <td>${e.mode || 'unknown'}</td>
                        <td><button onclick="viewExportDetail('${taxCode}', ${i})">📄 Xem</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}


function viewExportDetail(exportId, taxCode) {
    const hkd = hkdData[taxCode];
    const record = hkd?.exportHistory?.find(r => r.id === exportId);
    if (!record) {
        showToast("Không tìm thấy bản ghi xuất hàng!", "error");
        return;
    }

    const rows = record.productList.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.code || ''}</td>
            <td>${p.unit}</td>
            <td>${p.quantity}</td>
            <td>${formatCurrency(p.sellingPrice)}</td>
            <td>${formatCurrency(p.quantity * p.sellingPrice)}</td>
        </tr>
    `).join('');

    const html = `
        <h3>📄 Chi tiết xuất hàng - ${record.exportCode}</h3>
        <p><b>👤 Người mua:</b> ${record.customerName}</p>
        <p><b>📍 Địa chỉ:</b> ${record.customerAddress}</p>
        <p><b>🕒 Thời gian:</b> ${new Date(record.exportDate).toLocaleString('vi-VN')}</p>
        <p><b>📦 Loại xuất:</b> ${record.mode}</p>
        <table>
            <thead>
                <tr><th>STT</th><th>Tên</th><th>Mã</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="text-align:right"><b>🧾 Tổng tiền: ${formatCurrency(record.total)}</b></p>
        <div style="text-align:right; margin-top:15px;">
            <button onclick="printExportInvoice('${taxCode}', '${exportId}')">🖨️ In hóa đơn</button>
            <button onclick="closePopup()">❌ Đóng</button>
        </div>
    `;
    showPopup(html);
}


function getExportBuyerInfo() {
    return {
        name: document.getElementById('exportBuyerName')?.value || '',
        address: document.getElementById('exportBuyerAddress')?.value || '',
        phone: document.getElementById('exportBuyerPhone')?.value || '',
        taxCode: document.getElementById('exportBuyerTaxCode')?.value || '',
        requestedAmount: exportDraft?.buyerInfo?.requestedAmount || 0
    };
}


function getExportProductList() {
    return exportDraft.productList.map((p, i) => {
        const qtyInput = document.querySelector(`#exportProductList tbody tr:nth-child(${i + 1}) input`);
        const qty = parseFloat(qtyInput?.value || p.quantity || 1);
        return { ...p, quantity: qty };
    });
}



function getRandomProducts(taxCode, maxAmount, excludeDiscount = false) {
    const hkd = hkdData[taxCode];
    if (!hkd || !hkd.inventory) return [];

    // ✅ Chỉ lấy hàng hóa và KM có SL
    let items = [...hkd.inventory].filter(i =>
        parseFloat(i.quantity) > 0 &&
        (i.category === 'hang_hoa' || i.category === 'KM')
    );

    if (excludeDiscount) {
        items = items.filter(i => i.category !== 'chiet_khau');
    }

    const result = [];
    let total = 0;

    while (items.length && total < maxAmount * 1.1) {
        const i = Math.floor(Math.random() * items.length);
        const item = items.splice(i, 1)[0];

        const qty = Math.min(parseFloat(item.quantity), Math.ceil(Math.random() * 3));
        const price = parseFloat(item.sellingPrice || 0);
        const lineTotal = qty * price;

        total += lineTotal;

        result.push({
            name: item.name,
            code: item.code,
            unit: item.unit,
            quantity: qty,
            price: item.price,
            sellingPrice: price,
            category: item.category
        });
    }

    exportDraft = {
        taxCode,
        buyerInfo: {}, // có thể gán sau
        productList: result,
        mode: 'auto'
    };

    return result;
}


function getRandomName() {
    const list = ['Nguyễn Văn A', 'Trần Thị B', 'Phạm Văn C', 'Lê Thị D'];
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomAddress() {
    const list = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Cần Thơ', 'Bình Dương'];
    return list[Math.floor(Math.random() * list.length)];
}
///



const exportRecord = {
    buyerName: buyer.name,
    buyerAddress: buyer.address,
    buyerPhone: buyer.phone || '',
    buyerTaxCode: buyer.taxCode || '',
    mode, // 'manual' | 'semi' | 'auto'
    items: selectedItems, // từ popup thủ công, random bán tự động hoặc tự động
    totalAmount: calculateTotalAmount(selectedItems)
};

function downloadExportExcel(taxCode, record) {
    const buyer = getBuyerInfo(record.mode || 'manual');

    const items = record.items;
    if (!record || !items || items.length === 0) {
        showToast('❌ Không có dữ liệu để xuất Excel', 'error');
        return;
    }

    const headers = [
        'STT', 'NgayHoaDon', 'MaKhachHang', 'TenKhachHang', 'TenNguoiMua', 'MaSoThue', 'DiaChiKhachHang', 'DienThoaiKhachHang',
        'SoTaiKhoan', 'NganHang', 'HinhThucTT', 'MaSanPham', 'SanPham', 'DonViTinh', 'Extra1SP', 'Extra2SP',
        'SoLuong', 'DonGia', 'TyLeChietKhau', 'SoTienChietKhau', 'ThanhTien', 'TienBan', 'ThueSuat',
        'TienThueSanPham', 'TienThue', 'TongSoTienChietKhau', 'TongCong', 'TinhChatHangHoa', 'DonViTienTe', 'TyGia',
        'Fkey', 'Extra1', 'Extra2', 'EmailKhachHang', 'VungDuLieu', 'Extra3', 'Extra4', 'Extra5', 'Extra6', 'Extra7',
        'Extra8', 'Extra9', 'Extra10', 'Extra11', 'Extra12', 'LDDNBo', 'HDSo', 'HVTNXHang', 'TNVChuyen', 'PTVChuyen',
        'HDKTNgay', 'HDKTSo', 'CCCDan', '', '', 'mau_01'
    ];

    const today = new Date();
    const dateStr = today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const khCode = `KH${Math.floor(1000 + Math.random() * 9000)}`;
    const rows = [headers];

    let totalTongCong = 0;
    items.forEach(item => {
        totalTongCong += item.quantity * item.sellingPrice;
    });

    const first = items[0];
    const row1 = Array(headers.length).fill('');
    row1[0] = 1;
    row1[1] = dateStr;
    row1[2] = khCode;
    row1[3] = record.buyerName || 'Khách lẻ';
    row1[4] = record.buyerName || 'Khách lẻ';
    row1[5] = record.buyerTaxCode || '';
    row1[6] = record.buyerAddress || 'Ninh Thuận';
    row1[7] = record.buyerPhone || '';
    row1[10] = 'TM';

    if (first) {
        row1[11] = first.code || '';
        row1[12] = first.name || '';
        row1[13] = first.unit || '';
        row1[16] = first.quantity;
        row1[17] = first.sellingPrice;
        row1[20] = first.quantity * first.sellingPrice;
        row1[23] = 0; // TienThueSanPham = 0
        row1[26] = totalTongCong;
    }

    row1[28] = 'VND';
    row1[55] = 'mau_01';
    rows.push(row1);

    items.slice(1).forEach((item, i) => {
        const line = Array(headers.length).fill('');
        line[0] = i + 2;
        line[1] = dateStr;
        line[2] = khCode;
        line[10] = 'TM';
        line[11] = item.code || '';
        line[12] = item.name || '';
        line[13] = item.unit || '';
        line[16] = item.quantity;
        line[17] = item.sellingPrice;
        const lineTotal = item.quantity * item.sellingPrice;
        line[20] = lineTotal;
        line[23] = 0;
        line[28] = 'VND';
        line[55] = 'mau_01';
        rows.push(line);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HoaDonXuatHang');
    XLSX.writeFile(wb, `HoaDonXuat_${taxCode}_${Date.now()}.xlsx`);

    // ✅ Sau khi xuất Excel: cập nhật lịch sử và tồn kho
    const hkd = hkdData[taxCode];
    if (!hkd.exportHistory) hkd.exportHistory = [];
    hkd.exportHistory.push({
        timestamp: new Date().toISOString(),
        buyerName: record.buyerName,
        buyerAddress: record.buyerAddress,
        buyerPhone: record.buyerPhone,
        buyerTaxCode: record.buyerTaxCode,
        productList: record.items,
        totalAmount: totalTongCong,
        mode: record.mode || 'unknown'
    });

    // Trừ tồn kho và cập nhật lại thành tiền tồn kho
    record.items.forEach(item => {
    const exist = hkd.inventory.find(i =>
        i.code === item.code && i.unit === item.unit
    );
    if (exist) {
        const itemQty = parseFloat(item.quantity || 0);
        exist.quantity = parseFloat(exist.quantity || 0) - itemQty;

        if (exist.quantity <= 0) {
            hkd.inventory = hkd.inventory.filter(i =>
                !(i.code === item.code && i.unit === item.unit)
            );
        } else {
            const price = parseFloat(exist.price || 0);
            const taxRate = parseFloat(exist.taxRate || 0);

            exist.amount = Math.round(exist.quantity * price);
            exist.tax = Math.round(exist.amount * taxRate / 100);
            exist.sellingPrice = Math.round(price * 1.1); // nếu muốn tính lại giá bán
        }
    }
});



    saveData();
    showToast('✅ Đã xuất hàng và lưu Excel');
    showBusinessDetails(taxCode);
}

function formatDateDDMMYYYY(date) {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}



function showPopup(contentHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.id = 'popupOverlay';
    overlay.innerHTML = `<div class="popup">${contentHtml}</div>`;
    document.body.appendChild(overlay);
}

function closePopup() {
    const overlay = document.getElementById('popupOverlay');
    if (overlay) overlay.remove();
}

function printExportInvoice(taxCode) {
    const record = hkdData[taxCode].exportHistory.slice(-1)[0]; // Lấy bản ghi cuối
    if (!record) return alert('Chưa có bản ghi xuất hàng!');

    let html = `
        <html><head><title>Hóa đơn xuất</title>
        <style>
            body { font-family: Arial; padding: 20px; }
            h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background: #f0f0f0; }
        </style></head><body>
        <h2>HÓA ĐƠN XUẤT HÀNG</h2>
        <p><b>Mã số thuế:</b> ${taxCode}</p>
        <p><b>Người mua:</b> ${record.buyer}</p>
        <p><b>Địa chỉ:</b> ${record.address}</p>
        <p><b>Thời gian:</b> ${new Date(record.timestamp).toLocaleString('vi-VN')}</p>
        <table>
            <thead><tr><th>STT</th><th>Tên</th><th>Mã</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>
            ${record.products.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.name}</td>
                    <td>${p.code}</td>
                    <td>${p.quantity}</td>
                    <td>${formatCurrency(p.sellingPrice)}</td>
                    <td>${formatCurrency(p.quantity * p.sellingPrice)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <p style="text-align:right"><b>Tổng tiền: ${formatCurrency(record.total)}</b></p>
        </body></html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
}
function downloadInventoryExcel(taxCode) {
    const hkd = hkdData[taxCode];
const hasMain = hkd?.inventory?.length > 0;
const hasMisc = hkd?.miscInventory?.length > 0;

if (!hasMain && !hasMisc) {
    showToast('❌ Không có dữ liệu tồn kho để xuất Excel', 'error');
    return;
}


    const headers = ['STT', 'Tên hàng', 'Mã', 'Phân loại', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Giá bán', 'Thành tiền', 'Thuế suất'];
    const rows = [headers];

   hkd.inventory
  .filter(i => i.category === 'hang_hoa' && parseFloat(i.quantity || 0) > 0)
  .forEach((item, index) => {
    rows.push([
      index + 1,
      item.name || '',
      item.code || '',
      item.category || '',
      item.unit || '',
      parseFloat(item.quantity || 0),
      parseFloat(item.price || 0),
      parseFloat(item.sellingPrice || 0),
      parseFloat(item.amount || 0),
      item.taxRate ? `${Math.round(item.taxRate)}%` : '0%'
    ]);
});



    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TonKho');
    XLSX.writeFile(wb, `TonKho_${taxCode}_${Date.now()}.xlsx`);
}

function applyHKDReportFilter(taxCode) {
    const from = document.getElementById(`reportFrom-${taxCode}`).value;
    const to = document.getElementById(`reportTo-${taxCode}`).value;
    showBusinessDetails(taxCode, from, to); // gọi lại giao diện chính theo khoảng lọc
}


// ✅ Hàm showBusinessDetails hoàn chỉnh đã tích hợp hiển thị tổng tồn kho chính đúng và bố cục đẹp

// ✅ Hàm tính tổng tồn kho chính
function calculateInventoryTotals(inventory) {
  let totalQuantity = 0;
  let totalAmount = 0;

  inventory.forEach(item => {
    const qty = parseFloat(item.quantity || 0);
    const amount = parseFloat(item.amount || 0); // ⚠️ Lấy trực tiếp từ XML
    totalQuantity += qty;
    totalAmount += amount;
  });

  return { totalQuantity, totalAmount };
}

function filterExportHistory(taxCode) {
    const fromDate = document.getElementById(`filterFrom-${taxCode}`).value;
    const toDate = document.getElementById(`filterTo-${taxCode}`).value;
    const hkd = hkdData[taxCode];
    if (!hkd || !hkd.exportHistory) return;

    let filtered = hkd.exportHistory;

    if (fromDate) {
        filtered = filtered.filter(r => new Date(r.timestamp) >= new Date(fromDate));
    }
    if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => new Date(r.timestamp) <= end);
    }

    const table = document.getElementById(`${taxCode}-exportHistoryTable`);
    if (table) table.innerHTML = renderExportHistory(taxCode, filtered);
}


function resetHKDReport(taxCode) {
    document.getElementById(`reportFrom-${taxCode}`).value = '';
    document.getElementById(`reportTo-${taxCode}`).value = '';
    showBusinessDetails(taxCode); // gọi lại toàn bộ không lọc
}

function formatCurrency(val) {
  return (+val || 0).toLocaleString('vi-VN') + ' đ';
}

function printHKDSummary(taxCode) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const name = hkd.name || 'Chưa rõ';
    const address = hkd.address || 'Chưa có';
    const tag = hkd.tag || 'Chưa gán';
    const html = document.querySelector('.hkd-summary-grid');

    const from = document.getElementById(`reportFrom-${taxCode}`).value;
    const to = document.getElementById(`reportTo-${taxCode}`).value;
    const fromStr = from ? new Date(from).toLocaleDateString('vi-VN') : '';
    const toStr = to ? new Date(to).toLocaleDateString('vi-VN') : '';
    const filterRange = (from || to) ? `<p><b>Khoảng thời gian:</b> ${fromStr || '...'} - ${toStr || '...'}</p>` : '';

    if (!html) {
        alert('Không tìm thấy bảng thống kê');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Báo cáo ${name}</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .summary-header { margin-bottom: 20px; }
                .summary-header h2 { margin: 0 0 10px 0; }
                .summary-box { display: inline-block; width: 48%; margin-bottom: 10px; }
                .summary-box .label { font-weight: bold; }
                .summary-box .value { font-size: 1.1em; }
            </style>
        </head>
        <body>
            <div class="summary-header">
                <h2>BÁO CÁO DOANH NGHIỆP</h2>
                <p><b>Tên:</b> ${name}</p>
                <p><b>MST:</b> ${taxCode}</p>
                <p><b>Địa chỉ:</b> ${address}</p>
                <p><b>Tag:</b> ${tag}</p>
                ${filterRange}
            </div>
            ${html.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}
function updateExportProductList(taxCode, amount) {
   if (!hkd || !Array.isArray(hkd.inventory)) return;
if (typeof amount !== 'number' || isNaN(amount)) return;

const deviation = amount * 0.1;
const minAmount = amount - deviation;
const maxAmount = amount + deviation;

const excludeDiscount = document.getElementById('boHangChietKhau')?.checked;

let items = hkd.inventory.filter(item => {
  const qty = parseFloat(item.quantity || 0);
  if (isNaN(qty) || qty <= 0) return false;
  if (excludeDiscount && item.category === 'chiet_khau') return false;
  return true;
});


    items.sort(() => Math.random() - 0.5);

    const selected = [];
    let total = 0;

    for (let item of items) {
        const price = parseFloat(item.sellingPrice || 0);
        const qtyMax = Math.floor(item.quantity);
        const qty = Math.min(qtyMax, Math.floor((maxAmount - total) / price));

        if (qty > 0) {
            const subTotal = qty * price;
            selected.push({
                ...item,
                exportQty: qty,
                exportTotal: subTotal
            });
            total += subTotal;
        }

        if (total >= minAmount && total <= maxAmount) break;
    }

    if (total < minAmount) {
        showToast('Không đủ hàng để random theo số tiền yêu cầu.', 'error');
        return;
    }

    // Cập nhật nội dung bảng popup
    const tableBody = document.getElementById('exportProductListBody');
    if (!tableBody) return;

    tableBody.innerHTML = selected.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.unit}</td>
            <td>${item.exportQty}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.exportTotal)}</td>
        </tr>
    `).join('');

    // Gán lại biến tạm để nút "Xác nhận xuất" lấy đúng dữ liệu mới
    window.currentExportProducts = selected;
}
//

function renderExportTab(hkd, taxCode) {
    return `
        <h4>📤 Xuất hàng hóa</h4>
        <div class="export-input-group">
    <label for="${taxCode}-exportAmount" class="export-label">💵 Số tiền cần xuất:</label>
    <input type="number" id="${taxCode}-exportAmount" placeholder="VD: 500000" class="export-input" />
    
    <label class="export-checkbox">
        <input type="checkbox" id="${taxCode}-boHangChietKhau" checked />
        Không xuất hàng chiết khấu
    </label>
</div>

        <div class="export-mode-buttons">
  <button class="export-mode-btn" onclick="handleExportMode('manual', '${taxCode}')">🛠️ Thủ công</button>
  <button class="export-mode-btn" onclick="handleExportMode('semi', '${taxCode}')">⚙️ Bán tự động</button>
  <button class="export-mode-btn" onclick="handleExportMode('auto', '${taxCode}')">🤖 Tự động</button>
</div>

        <div id="${taxCode}-exportResultBox"></div>
    `;
}

function updateExportPopup(productList, buyerInfo, requestedAmount) {
    let total = 0;
    const rows = productList.map((p, i) => {
        const lineTotal = p.quantity * p.sellingPrice;
        total += lineTotal;
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${p.code}</td>
                <td><input type="number" value="${p.quantity}" min="1" max="${Math.floor(p.quantity)}" onchange="updateExportQty(event, ${i})" /></td>
                <td class="text-right">${formatCurrency(p.sellingPrice)}</td>
                <td class="text-right">${formatCurrency(lineTotal)}</td>
            </tr>`;
    }).join('');

    const html = `
        <h3>📤 Xuất hàng (${exportDraft.mode.toUpperCase()})</h3>
        <div style="margin-bottom:10px">
            <label>👤 Họ tên người mua: <input id="exportBuyerName" value="${buyerInfo.name || ''}" /></label>
            <label style="margin-left: 20px">🏠 Địa chỉ: <input id="exportBuyerAddress" value="${buyerInfo.address || ''}" /></label>
            <label style="margin-left: 20px">💵 Số tiền yêu cầu: <b>${formatCurrency(requestedAmount || 0)}</b></label>
        </div>

        <table>
            <thead>
                <tr><th>STT</th><th>Tên</th><th>Mã</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div style="text-align:right; margin-top:10px;">
            <b>🧾 Tổng tiền xuất: ${formatCurrency(total)}</b>
        </div>

        <div style="margin-top:15px; text-align:right;">
            <button onclick="generateOptimizedExport('${exportDraft.taxCode}', ${requestedAmount}, '${exportDraft.mode}')">🔁 Random lại</button>
            <button onclick="confirmExport('${exportDraft.taxCode}', getExportBuyerInfo(), getExportProductList(), '${exportDraft.mode}')">✅ Xuất hàng</button>
            <button onclick="printExportInvoice('${exportDraft.taxCode}')">🖨️ In hóa đơn</button>
            <button onclick="closePopup()">❌ Đóng</button>
        </div>
    `;

    const popup = document.getElementById('popup');
    if (popup) {
        popup.innerHTML = html;
    } else {
        showPopup(html);
    }
}

function generateOptimizedExport(taxCode, amount, mode = 'auto') {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const maxDeviation = amount * 0.1;
    const min = amount - maxDeviation;
    const max = amount + maxDeviation;

   const excludeDiscount = document.getElementById("boHangChietKhau")?.checked;

if (!hkd || !Array.isArray(hkd.inventory)) {
  showToast("❌ Không có dữ liệu tồn kho", "error");
  return [];
}

let products = hkd.inventory.filter(item => {
  const qty = parseFloat(item.quantity);
  if (isNaN(qty) || qty <= 0) return false;
  if (excludeDiscount && item.category === "chiet_khau") return false;
  return true;
});



    products.sort(() => Math.random() - 0.5);

    const selected = [];
    let total = 0;

    for (let item of products) {
        const price = parseFloat(item.sellingPrice || 0);
        const maxQty = Math.floor(item.quantity);
        const qty = Math.min(maxQty, Math.floor((max - total) / price));
        if (qty <= 0) continue;

        const line = qty * price;
        total += line;
        selected.push({ ...item, quantity: qty });

        if (total >= min && total <= max) break;
    }

    if (total < min) {
        showToast("❌ Không tìm đủ hàng phù hợp với số tiền yêu cầu", "error");
        return;
    }

    const buyerInfo = {
        name: document.getElementById("exportBuyerName")?.value || randomCustomerName(),
        address: document.getElementById("exportBuyerAddress")?.value || randomAddressVN(),
        requestedAmount: amount
    };

    exportDraft = { taxCode, buyerInfo, productList: selected, mode };
    updateExportPopup(selected, buyerInfo, amount); // ✅ dùng popup cũ, không mở lại
}
function handleParsedInvoice(parsed, taxCode) {
    const { products, buyerInfo, sellerInfo, invoiceInfo, totals, hasSuspicious } = parsed;
    if (!taxCode) return;

    let business = hkdData[taxCode];
    if (!business) {
        business = {
            name: buyerInfo.name || 'Chưa rõ',
            taxCode,
            buyer: buyerInfo.name || '',
            invoices: [],
            tonkhoMain: [],
            tonkhoKM: [],
            tonkhoCK: [],
            tags: [],
            deleted: false
        };
        hkdData[taxCode] = business;
        hkdOrder.push(taxCode);
    }

    if (!business.tonkhoMain) business.tonkhoMain = [];
    if (!business.tonkhoKM) business.tonkhoKM = [];
    if (!business.tonkhoCK) business.tonkhoCK = [];

    products.forEach(product => {
        if (product.category === 'chiet_khau') business.tonkhoCK.push(product);
        else if (product.category === 'KM') business.tonkhoKM.push(product);
        else business.tonkhoMain.push(product);
    });

    const invoiceId = invoiceInfo.invoiceId;
    const existed = business.invoices.find(i => i.invoiceId === invoiceId);
    if (!existed) {
        business.invoices.push({
            invoiceId,
            date: invoiceInfo.date,
            seller: sellerInfo.name,
            buyer: buyerInfo.name,
            products,
            totals,
            hasSuspicious,
            deleted: false
        });
    }
}

function renderTonkhoTable(taxCode, type) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const map = {
        main: { title: '📦 Hàng hóa', data: hkd.tonkhoMain || [] },
        km:   { title: '🎁 Khuyến mại', data: hkd.tonkhoKM || [] },
        ck:   { title: '🔻 Chiết khấu', data: hkd.tonkhoCK || [] }
    };

    const { title, data } = map[type] || {};
    if (!data) return;

    const container = document.getElementById(`tonKho-${type}`);
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `
            <div style="margin-bottom:10px;">
                <button onclick="addProduct('${taxCode}', '${type}')">➕ Thêm dòng</button>
            </div>
            <p>📭 Không có hàng trong kho này.</p>`;
        return;
    }

    let totalQty = 0;
    let totalAmount = 0;

    const rows = data.map((item, i) => {
        const qty = parseFloat(item.quantity || 0);
        const amount = parseFloat(item.amount || 0);
        totalQty += qty;
        totalAmount += amount;

        return `
        <tr>
            <td>${i + 1}</td>
            <td>${item.name || ''}</td>
            <td>${item.code || ''}</td>
            <td>${item.unit || ''}</td>
            <td class="text-right">${formatNumber(qty)}</td>
            <td class="text-right">${formatCurrency(item.price)}</td>
            <td class="text-right">${formatCurrency(amount)}</td>
            <td class="text-right">${item.taxRate || '0'}%</td>
            <td>
                <select onchange="productAction(this, '${taxCode}', '${type}', ${i})">
                    <option value="">⋮</option>
                    <option value="edit">✏️ Sửa</option>
                    <option value="delete">❌ Xoá</option>
                    <option value="move">🔁 Chuyển kho</option>
                </select>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="margin-bottom:10px; display:flex; justify-content:space-between;">
            <h4 style="margin:0;">${title}</h4>
            <div>
                <button onclick="addProduct('${taxCode}', '${type}')">➕ Thêm dòng</button>
                <button onclick="downloadTonkhoExcel('${taxCode}', '${type}')">📥 Xuất Excel</button>
            </div>
        </div>

        <table class="tonkho-table">
            <thead>
                <tr>
                    <th>STT</th><th>Tên hàng</th><th>Mã</th><th>ĐVT</th><th>SL</th>
                    <th>Đơn giá</th><th>Thành tiền</th><th>Thuế</th><th>⋮</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                <tr style="font-weight:bold;background:#f0f0f0;">
                    <td colspan="4" style="text-align:right;">Tổng cộng:</td>
                    <td class="text-right">${formatNumber(totalQty)}</td>
                    <td></td>
                    <td class="text-right">${formatCurrency(totalAmount)}</td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
        </table>
    `;
}

function productAction(select, taxCode, type, index) {
    const action = select.value;
    select.value = ''; // reset lại sau chọn

    switch (action) {
        case 'edit':
            editProduct(taxCode, type, index);
            break;
        case 'delete':
            deleteProduct(taxCode, type, index);
            break;
        case 'move':
            showMoveProductPopup(taxCode, type, index);
            break;
    }
}

function editProduct(taxCode, type, index) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const khoMap = {
        main: hkd.tonkhoMain,
        km: hkd.tonkhoKM,
        ck: hkd.tonkhoCK
    };

    const list = khoMap[type];
    const product = list?.[index];
    if (!product) return;

    // Tạo popup chỉnh sửa
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-content small-modal">
        <h3>✏️ Sửa sản phẩm</h3>
        <label>Tên: <input id="editName" value="${product.name || ''}"></label>
        <label>Mã: <input id="editCode" value="${product.code || ''}"></label>
        <label>ĐVT: <input id="editUnit" value="${product.unit || ''}"></label>
        <label>Số lượng: <input type="number" id="editQty" value="${product.quantity || 0}"></label>
        <label>Đơn giá: <input type="number" id="editPrice" value="${product.price || 0}"></label>
        <label>Thuế (%): <input type="number" id="editTax" value="${product.taxRate || 0}"></label>
        <div style="text-align:right; margin-top:10px;">
            <button onclick="document.body.removeChild(this.closest('.modal'))">❌ Hủy</button>
            <button onclick="confirmEditProduct('${taxCode}', '${type}', ${index})">💾 Lưu</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

function confirmEditProduct(taxCode, type, index) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const khoMap = {
        main: hkd.tonkhoMain,
        km: hkd.tonkhoKM,
        ck: hkd.tonkhoCK
    };

    const list = khoMap[type];
    const product = list?.[index];
    if (!product) return;

    const qty = parseFloat(document.getElementById('editQty').value) || 0;
    const price = parseFloat(document.getElementById('editPrice').value) || 0;
    const taxRate = parseFloat(document.getElementById('editTax').value) || 0;

    product.name = document.getElementById('editName').value.trim();
    product.code = document.getElementById('editCode').value.trim();
    product.unit = document.getElementById('editUnit').value.trim();
    product.quantity = qty.toString();
    product.price = price.toString();
    product.amount = Math.round(qty * price);
    product.taxRate = taxRate;
    product.tax = Math.round(product.amount * taxRate / 100);

    storageHandler.save('hkd_data', hkdData);
    document.querySelector('.modal')?.remove();
    renderTonkhoTable(taxCode, type);
}

function deleteProduct(taxCode, type, index) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const khoMap = {
        main: hkd.tonkhoMain,
        km: hkd.tonkhoKM,
        ck: hkd.tonkhoCK
    };

    const list = khoMap[type];
    const product = list?.[index];
    if (!product) return;

    const confirmDelete = confirm(`Bạn có chắc muốn xóa sản phẩm: "${product.name}"?`);
    if (!confirmDelete) return;

    list.splice(index, 1);
    storageHandler.save('hkd_data', hkdData);
    renderTonkhoTable(taxCode, type);
}

function showMoveProductPopup(taxCode, fromType, index) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const product =
        fromType === 'main' ? hkd.tonkhoMain?.[index] :
        fromType === 'km'   ? hkd.tonkhoKM?.[index] :
        fromType === 'ck'   ? hkd.tonkhoCK?.[index] :
        null;

    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-content small-modal">
        <h3>🔁 Chuyển sản phẩm sang kho khác</h3>
        <p><b>${product.name}</b> (Mã: ${product.code}, SL: ${product.quantity})</p>
        <label>Chuyển sang kho:
            <select id="moveTargetType">
                ${fromType !== 'main' ? '<option value="main">📦 Hàng hóa</option>' : ''}
                ${fromType !== 'km' ? '<option value="km">🎁 Khuyến mại</option>' : ''}
                ${fromType !== 'ck' ? '<option value="ck">🔻 Chiết khấu</option>' : ''}
            </select>
        </label>
        <div style="text-align:right; margin-top:10px;">
            <button onclick="document.body.removeChild(this.closest('.modal'))">❌ Hủy</button>
            <button onclick="moveProductToOtherStock('${taxCode}', '${fromType}', ${index})">✅ Chuyển</button>
        </div>
    </div>
    `;
    document.body.appendChild(modal);
}

function moveProductToOtherStock(taxCode, fromType, index) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const toType = document.getElementById('moveTargetType')?.value;
    if (!toType || toType === fromType) return;

    const fromMap = {
        main: hkd.tonkhoMain,
        km: hkd.tonkhoKM,
        ck: hkd.tonkhoCK
    };

    const listFrom = fromMap[fromType];
    const listTo = fromMap[toType];

    const product = listFrom?.[index];
    if (!product) return;

    // ❌ Tránh trùng: nếu sản phẩm cùng mã & ĐVT đã có ở kho đích
    const isDuplicate = listTo.some(p =>
        p.code === product.code && p.unit === product.unit
    );

    if (isDuplicate) {
        alert("❌ Kho đích đã có sản phẩm cùng mã và đơn vị. Vui lòng sửa trước.");
        return;
    }

    // Xóa khỏi kho hiện tại và đưa vào kho đích
    listFrom.splice(index, 1);
    listTo.push(product);

    storageHandler.save('hkd_data', hkdData);
    document.querySelector('.modal')?.remove();
    renderTonkhoTable(taxCode, fromType);
    renderTonkhoTable(taxCode, toType);
}

function addProduct(taxCode, type) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-content small-modal">
      <h3>➕ Thêm sản phẩm mới</h3>
      <label>Tên: <input id="newName"></label>
      <label>Mã: <input id="newCode"></label>
      <label>ĐVT: <input id="newUnit"></label>
      <label>Số lượng: <input type="number" id="newQty" value="1"></label>
      <label>Đơn giá: <input type="number" id="newPrice" value="0"></label>
      <label>Thuế (%): <input type="number" id="newTax" value="0"></label>
      <div style="text-align:right; margin-top:10px;">
        <button onclick="document.body.removeChild(this.closest('.modal'))">❌ Hủy</button>
        <button onclick="confirmAddProduct('${taxCode}', '${type}')">✅ Thêm</button>
      </div>
    </div>
    `;
    document.body.appendChild(modal);
}

function confirmAddProduct(taxCode, type) {
    const name = document.getElementById('newName').value.trim();
    const code = document.getElementById('newCode').value.trim();
    const unit = document.getElementById('newUnit').value.trim();
    const qty = parseFloat(document.getElementById('newQty').value) || 0;
    const price = parseFloat(document.getElementById('newPrice').value) || 0;
    const taxRate = parseFloat(document.getElementById('newTax').value) || 0;

    const product = {
        name, code, unit,
        quantity: qty.toString(),
        price: price.toString(),
        amount: Math.round(qty * price),
        taxRate,
        tax: Math.round(qty * price * taxRate / 100),
        category: type === 'main' ? 'hang_hoa' : (type === 'km' ? 'KM' : 'chiet_khau')
    };

    const hkd = hkdData[taxCode];
    const map = {
        main: hkd.tonkhoMain,
        km: hkd.tonkhoKM,
        ck: hkd.tonkhoCK
    };

    map[type].push(product);

    storageHandler.save('hkd_data', hkdData);
    document.querySelector('.modal')?.remove();
    renderTonkhoTable(taxCode, type);
}

function downloadTonkhoExcel(taxCode, type) {
    const hkd = hkdData[taxCode];
    const map = {
        main: { title: 'Tồn kho Hàng hóa', data: hkd.tonkhoMain },
        km: { title: 'Tồn kho Khuyến mại', data: hkd.tonkhoKM },
        ck: { title: 'Tồn kho Chiết khấu', data: hkd.tonkhoCK }
    };

    const { title, data } = map[type];
    if (!data || data.length === 0) {
        alert('Không có dữ liệu để xuất Excel.');
        return;
    }

    const rows = data.map((p, i) => ({
        STT: i + 1,
        'Tên hàng': p.name,
        'Mã': p.code,
        'ĐVT': p.unit,
        'Số lượng': parseFloat(p.quantity || 0),
        'Đơn giá': parseFloat(p.price || 0),
        'Thành tiền': parseFloat(p.amount || 0),
        'Thuế suất': p.taxRate + '%',
        'Thuế': parseFloat(p.tax || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TonKho");

    const filename = `${taxCode}_${type}_tonkho.xlsx`;
    XLSX.writeFile(wb, filename);
}



function handleExportMode(mode, taxCode) {
    const input = document.getElementById(`${taxCode}-exportAmount`);
    const amount = parseFloat(input?.value || '0');
    if ((mode === 'semi' || mode === 'auto') && (!amount || amount < 10000)) {
        showToast('⚠️ Vui lòng nhập số tiền cần xuất!', 'warning');
        return;
    }
    if (mode === 'manual') return showManualExportPopup(taxCode);
    if (mode === 'semi') return showSemiExportPopup(taxCode, amount);
    if (mode === 'auto') return showAutoExportPopup(taxCode, amount);
}

function updateManualExportSummary() {
    let totalQty = 0;
    let totalMoney = 0;

    exportDraft.manualSelections.forEach(item => {
        const qty = parseInt(item.quantity || 0);
        const price = parseFloat(item.sellingPrice || 0);
        totalQty += qty;
        totalMoney += qty * price;
    });

    // ✅ Cập nhật lên giao diện
    const qtyElem = document.getElementById('manual-total-qty');
    const moneyElem = document.getElementById('manual-total-money');

    if (qtyElem) qtyElem.innerText = formatNumber(totalQty);
    if (moneyElem) moneyElem.innerText = formatCurrency(totalMoney);
}

function getBuyerInfo(mode) {
    if (mode === 'manual') {
        return {
            name: document.getElementById('exportBuyerName')?.value.trim() || 'Khách lẻ',
            address: document.getElementById('exportBuyerAddress')?.value.trim() || 'Ninh Thuận',
            phone: document.getElementById('exportBuyerPhone')?.value.trim() || '',
            taxCode: document.getElementById('exportBuyerTaxCode')?.value.trim() || ''
        };
    } else if (mode === 'semi') {
        return {
            name: document.getElementById('exportBuyerName')?.value.trim() || randomCustomerName(),
            address: document.getElementById('exportBuyerAddress')?.value.trim() || randomAddressVN(),
            phone: '',
            taxCode: ''
        };
    } else {
        // auto mode
        return {
            name: randomCustomerName(),
            address: randomAddressVN(),
            phone: '',
            taxCode: ''
        };
    }
}

function updateManualQty(index, value) {
    value = parseInt(value);
    if (isNaN(value) || value < 0) value = 0;

    const item = exportDraft.manualSelections[index];
    item.quantity = value;

    const lineTotal = value * parseFloat(item.sellingPrice);
    document.getElementById(`manual-line-${index}`).innerText = formatCurrency(lineTotal);

    updateManualExportSummary(); // 👉 Tính lại tổng ngay sau mỗi thay đổi
}

function getManualExportProducts() {
    if (!exportDraft?.manualSelections) return [];

    return exportDraft.manualSelections
        .filter(p => p.quantity > 0)
        .map(p => ({
            code: p.code,
            name: p.name,
            unit: p.unit,
            quantity: p.quantity,
            sellingPrice: p.sellingPrice || 0,
            taxRate: p.taxRate || '10%'
        }));
}
function viewExportDetail(taxCode, index) {
    const hkd = hkdData[taxCode];
    if (!hkd || !hkd.exportHistory || !hkd.exportHistory[index]) return;

    const record = hkd.exportHistory[index];
    const rows = record.productList.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.code}</td>
            <td>${p.unit}</td>
            <td class="text-right">${formatNumber(p.quantity)}</td>
            <td class="text-right">${formatCurrency(p.sellingPrice)}</td>
            <td class="text-right">${formatCurrency(p.quantity * p.sellingPrice)}</td>
        </tr>
    `).join('');

    const html = `
        <h3>📄 Chi tiết hóa đơn xuất hàng</h3>
        <p>👤 <b>Người mua:</b> ${record.buyerName}</p>
        <p>📍 <b>Địa chỉ:</b> ${record.buyerAddress}</p>
        <p>📞 <b>SĐT:</b> ${record.buyerPhone || '—'}</p>
        <p>💼 <b>MST:</b> ${record.buyerTaxCode || '—'}</p>
        <p>🧾 <b>Loại xuất:</b> ${record.mode.toUpperCase()}</p>
        <p>⏰ <b>Thời gian:</b> ${new Date(record.timestamp).toLocaleString('vi-VN')}</p>

        <table border="1" style="width:100%; border-collapse: collapse; margin-top:10px;">
            <thead style="background:#1e90ff; color:white;">
                <tr><th>STT</th><th>Tên</th><th>Mã</th><th>ĐVT</th><th>SL</th><th>Giá bán</th><th>Thành tiền</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div style="text-align:right; margin-top:10px; font-weight:bold;">
            🧮 Tổng tiền: ${formatCurrency(record.totalAmount || 0)}
        </div>

        <div style="margin-top:15px; text-align:right;">
<button onclick="printExportInvoice('${taxCode}', ${index})">🖨️ In hóa đơn</button>
            <button onclick="closePopup()">❌ Đóng</button>
        </div>
    `;

    showPopup(html);
}

function printExportInvoice(taxCode, index = 0) {
    const hkd = hkdData[taxCode];
    if (!hkd || !hkd.exportHistory || !hkd.exportHistory[index]) {
        alert("Không tìm thấy dữ liệu để in.");
        return;
    }

    const record = hkd.exportHistory[index];

    // ✅ Thông tin bên bán (lấy từ hkd)
    const sellerInfo = {
        name: hkd.name || '—',
        address: hkd.address || '—',
        phone: hkd.phone || '—',
        taxCode: taxCode || '—',
        bank: hkd.bank || '—'
    };

    // ✅ Thông tin bên mua
    const buyerInfo = {
        name: record.buyerName || '—',
        address: record.buyerAddress || '—',
        phone: record.buyerPhone || '—',
        taxCode: record.buyerTaxCode || '—'
    };

    const items = record.productList || [];
    const htmlRows = items.map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${item.name}</td>
            <td>${item.unit}</td>
            <td class="text-right">${formatNumber(item.quantity)}</td>
            <td class="text-right">${formatCurrency(item.sellingPrice)}</td>
            <td class="text-right">${formatCurrency(item.quantity * item.sellingPrice)}</td>
        </tr>
    `).join('');

    const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.sellingPrice, 0);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head>
            <title>Hóa đơn xuất hàng</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ccc; padding: 8px; }
                .text-right { text-align: right; }
                .section-title { margin-top: 20px; font-weight: bold; }
            </style>
        </head><body>
            <h2>HÓA ĐƠN XUẤT HÀNG</h2>

            <div class="section-title">🔸 BÊN BÁN</div>
            <p>🏢 <b>Tên:</b> ${sellerInfo.name}</p>
            <p>📍 <b>Địa chỉ:</b> ${sellerInfo.address}</p>
            <p>📞 <b>Điện thoại:</b> ${sellerInfo.phone}</p>
            <p>💼 <b>Mã số thuế:</b> ${sellerInfo.taxCode}</p>
            <p>🏦 <b>Tài khoản:</b> ${sellerInfo.bank}</p>

            <div class="section-title">🔹 BÊN MUA</div>
            <p>👤 <b>Tên:</b> ${buyerInfo.name}</p>
            <p>📍 <b>Địa chỉ:</b> ${buyerInfo.address}</p>
            <p>📞 <b>Điện thoại:</b> ${buyerInfo.phone}</p>
            <p>💼 <b>MST:</b> ${buyerInfo.taxCode}</p>

            <div class="section-title">📦 DANH SÁCH HÀNG HÓA</div>
            <table>
                <thead>
                    <tr>
                        <th>STT</th><th>Tên hàng</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                    <tr>
                        <td colspan="3"><b>TỔNG CỘNG</b></td>
                        <td class="text-right"><b>${formatNumber(totalQty)}</b></td>
                        <td></td>
                        <td class="text-right"><b>${formatCurrency(totalAmount)}</b></td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                <div><b>Người lập hóa đơn</b><br><br><br>....................</div>
                <div><b>Người nhận hàng</b><br><br><br>....................</div>
            </div>

            <script>window.print();</script>
        </body></html>
    `);
}



function getManualProductList() {
    return exportDraft.productList.filter(p => p && p.quantity > 0);
}
// Thủ công
function showManualExportPopup(taxCode) {
    const hkd = hkdData[taxCode];
    if (!hkd) return;

    const buyerInfo = {
        name: "",
        address: "",
        phone: "",
        taxCode: ""
    };

    if (!hkd || !Array.isArray(hkd.inventory)) {
  showToast("❌ Không có dữ liệu tồn kho", "error");
  return;
}

exportDraft = {
  taxCode,
  buyerInfo,
  mode: 'manual',
  manualSelections: hkd.inventory
    .filter(item => {
      const qty = parseFloat(item.quantity);
      return !isNaN(qty) && qty > 0;
    })
    .map(item => ({
      ...item,
      _originalQuantity: parseFloat(item.quantity),
      quantity: 0
    }))
};


    const rows = exportDraft.manualSelections.map((p, i) => `
    <tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.code}</td>
        <td>${p.unit}</td>
        <td class="text-right">${formatNumber(p._originalQuantity || p.quantity)}</td> <!-- ✅ Tồn kho -->
        <td>
            <input type="number" min="0" max="${Math.floor(p.quantity)}" value="0"
                onchange="updateManualQty(${i}, this.value)" style="width: 60px;" />
        </td>
        <td class="text-right">${formatCurrency(p.sellingPrice)}</td>
        <td class="text-right" id="manual-line-${i}">0</td>
    </tr>
`).join('');


    const html = `
        <h3>🛠️ Xuất hàng thủ công</h3>
        <div style="margin-bottom:10px; display: flex; flex-wrap: wrap; gap: 15px;">
            <label>👤 Họ tên: <input id="exportBuyerName" value="" /></label>
            <label>📍 Địa chỉ: <input id="exportBuyerAddress" value="" /></label>
            <label>📞 SĐT: <input id="exportBuyerPhone" value="" /></label>
            <label>💼 MST: <input id="exportBuyerTaxCode" value="" /></label>
        </div>

        <div style="text-align:right; margin-top:10px; font-weight:bold;">
            🧮 Tổng số lượng: <span id="manual-total-qty">0</span> |
            💰 Tổng tiền: <span id="manual-total-money">0 đ</span>
        </div>

        <table border="1" style="width:100%; border-collapse: collapse; margin-top:10px;">
            <thead style="background:#1e90ff;color:white;">
                <tr>
                    <th>STT</th>
                    <th>Tên</th>
                    <th>Mã</th>
                    <th>ĐVT</th>
                    <th>Tồn kho</th>
                    <th>SL xuất</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div style="text-align:right; margin-top:15px;">
            <button onclick="confirmExport('${taxCode}', getExportBuyerInfo(), getManualExportProducts(), 'manual')">✅ Xuất hàng</button>
            <button onclick="closePopup()">❌ Đóng</button>
        </div>
    `;

    showPopup(html);
    updateManualExportSummary();
}
function updateManualQty(index, value) {
    value = parseInt(value);
    if (isNaN(value) || value < 0) value = 0;

    const item = exportDraft.manualSelections[index];
    item.quantity = value;

    const price = parseFloat(item.sellingPrice || 0);
    const lineTotal = value * price;

    document.getElementById(`manual-line-${index}`).innerText = formatCurrency(lineTotal);

    updateManualExportSummary(); // ✅ Cập nhật tổng sau khi thay đổi số lượng
}

// Bán tự động
function showSemiExportPopup(taxCode, amount) {
    const buyerInfo = {
        name: '',
        address: '',
        requestedAmount: amount
    };
    const excludeDiscount = document.getElementById(`${taxCode}-boHangChietKhau`)?.checked;
    const products = getOptimizedProducts(taxCode, amount, excludeDiscount);

    if (!products.length) {
        showToast('❌ Không tìm được hàng phù hợp', 'error');
        return;
    }

    showExportPopup('semi', taxCode, buyerInfo, products);
}
// Tự động
function showAutoExportPopup(taxCode, amount) {
    const buyerInfo = {
        name: randomCustomerName(),
        address: randomAddressVN(),
        requestedAmount: amount
    };
    const excludeDiscount = document.getElementById(`${taxCode}-boHangChietKhau`)?.checked;
    const products = getOptimizedProducts(taxCode, amount, excludeDiscount);

    if (!products.length) {
        showToast('❌ Không tìm được hàng phù hợp', 'error');
        return;
    }

    showExportPopup('auto', taxCode, buyerInfo, products);
}

function getOptimizedProducts(taxCode, amount, excludeDiscount = false) {
    const hkd = hkdData[taxCode];
let items = hkd.inventory.filter(i =>
  parseFloat(i.quantity) > 0 &&
  i.category !== 'chiet_khau' &&
  i.category !== 'KM'
);
    if (excludeDiscount) items = items.filter(i => i.category !== 'chiet_khau');

    items.sort((a, b) => parseFloat(b.sellingPrice) - parseFloat(a.sellingPrice));
    let selected = [];
    let total = 0;
    for (let item of items) {
        const price = parseFloat(item.sellingPrice);
        const maxQty = parseInt(item.quantity);
        let qty = Math.floor((amount - total) / price);
        if (qty <= 0) continue;
        qty = Math.min(qty, maxQty);
        const line = qty * price;
        total += line;
        selected.push({ ...item, quantity: qty });
        if (total >= amount * 0.95) break;
    }
    return selected;
}

// Github
// Viết lại toàn bộ các hàm liên quan tới GitHub để xử lý upload HTML vào repo Datkep92/test/invoices và lấy URL tĩnh

function showGitHubTokenPopup() {
    const currentToken = getGitHubToken();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h3>🔐 Nhập GitHub Token</h3>
            <p style="font-size: 13px; color: gray;">Lưu ý: Token sẽ chỉ lưu trong trình duyệt của bạn.</p>
            <input type="password" id="githubTokenInput" value="${currentToken}" style="width: 100%; padding: 8px;" placeholder="ghp_...">
            <div style="margin-top: 15px; text-align: right;">
                <button onclick="saveGitHubTokenFromPopup()">✅ Lưu</button>
                <button onclick="closePopup()">❌ Đóng</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function isValidGitHubToken(token) {
    return /^gh[pasru]_/.test(token) || token.startsWith('github_pat_');
}

function saveGitHubTokenFromPopup() {
    const token = document.getElementById('githubTokenInput').value.trim();
    if (!isValidGitHubToken(token)) {
        showToast('❌ Token GitHub không hợp lệ', 'error');
        return;
    }

    const settings = storageHandler.load('app_settings') || {};
    settings.githubToken = token;
    storageHandler.save('app_settings', settings);
    showToast('✅ Token đã được lưu');
    closePopup();
}

function getGitHubToken() {
    const settings = storageHandler.load('app_settings') || {};
    return settings.githubToken || '';
}

function closePopup() {
    document.querySelectorAll('.modal').forEach(el => el.remove());
}

// Hàm dùng để upload file HTML vào GitHub repo Datkep92/test/invoices
async function uploadToGitHub(blob, filename) {
    const token = getGitHubToken();
    if (!token) {
        showToast('❌ Bạn chưa nhập GitHub Token', 'error');
        return null;
    }

    const base64Content = await blobToBase64(blob);
    const url = `https://api.github.com/repos/Datkep92/test/contents/invoices/${filename}`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `upload ${filename}`,
            content: base64Content
        })
    });

    const data = await res.json();
    if (res.ok && data.content?.path) {
        const staticUrl = `https://datkep92.github.io/test/invoices/${filename}`;
        return staticUrl;
    } else {
        console.error('❌ Upload thất bại:', data);
        showToast('❌ Upload lên GitHub thất bại', 'error');
        return null;
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}



function showInvoicePopup(invoiceNumber, mccqt, index, taxCode) {
  const hkd = hkdData[taxCode];
  const inv = hkd?.invoices?.[index];
  if (!inv) return showToast('Không tìm thấy hóa đơn', 'error');

  const htmlInvoice = inv.invoiceInfo?.htmlUrl || '';

  // Dùng lại dữ liệu đã parse chuẩn kế toán
  const products = inv.products || [];
  const totals = inv.totals || { beforeTax: 0, tax: 0, discount: 0, total: 0 };

  const productRows = products.map((p, i) => {
    const quantity = parseFloat(p.quantity || 0);
    const price = parseFloat(p.price || 0);
    const discount = parseFloat(p.discount || 0);
    const amount = parseFloat(p.amount || 0);
    const tax = parseFloat(p.tax || 0);
    const totalLine = amount + tax;

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name || ''}</td>
        <td>${p.unit || ''}</td>
        <td class="text-right">${formatNumber(quantity)}</td>
        <td class="text-right">${formatCurrency(price)}</td>
        <td class="text-right">${formatCurrency(discount)}</td>
        <td class="text-right">${p.taxRate || '0'}%</td>
        <td class="text-right">${formatCurrency(amount)}</td>
        <td class="text-right">${formatCurrency(tax)}</td>
        <td class="text-right">${formatCurrency(totalLine)}</td>
      </tr>
    `;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="width:90vw; max-height:95vh; overflow:auto;">
      <h3>📄 Xem hóa đơn ${invoiceNumber}</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="padding-right: 10px;">
          <h4>📦 Bảng kê hàng hóa</h4>
          <table style="width:100%; border-collapse: collapse;" border="1">
            <thead>
              <tr style="background:#eee;">
                <th>STT</th>
                <th>Tên hàng</th>
                <th>ĐVT</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Chiết khấu</th>
                <th>Thuế suất</th>
                <th>Thành tiền</th>
                <th>Thuế</th>
                <th>Tổng</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
              <tr style="font-weight: bold; background: #f0f0f0;">
                <td colspan="7" style="text-align:right;">Tổng cộng:</td>
                <td class="text-right">${formatCurrency(totals.beforeTax)}</td>
                <td class="text-right">${formatCurrency(totals.tax)}</td>
                <td class="text-right">${formatCurrency(totals.beforeTax + totals.tax)}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td colspan="7" style="text-align:right;">Chiết khấu thương mại:</td>
                <td colspan="3" class="text-right">${formatCurrency(totals.discount)}</td>
              </tr>
              <tr style="font-weight: bold; background: #e6f7ff;">
                <td colspan="7" style="text-align:right;">Tổng thanh toán:</td>
                <td colspan="3" class="text-right">${formatCurrency(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="padding-left: 10px;">
          <h4>🧾 Hóa đơn gốc</h4>
          ${htmlInvoice ? `<iframe src="${htmlInvoice}" width="100%" height="500px" style="border:1px solid #ddd"></iframe>` : '<p>Không có file HTML</p>'}
        </div>
      </div>
      <div style="margin-top: 10px; text-align:right;">
        <button onclick="showInvoicePopupNav(${index - 1}, '${taxCode}')">⬅️ Trước</button>
        <button onclick="showInvoicePopupNav(${index + 1}, '${taxCode}')">➡️ Tiếp</button>
        <button onclick="this.closest('.modal').remove()">❌ Đóng</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateInvoiceField(taxCode, invoiceIndex, rowIndex, field, value) {
    const inv = hkdData[taxCode].invoices[invoiceIndex];
    if (!inv || !inv.products[rowIndex]) return;
    inv.products[rowIndex][field] = field === 'quantity' || field === 'price' ? parseFloat(value) : value;
    inv.products[rowIndex].amount = inv.products[rowIndex].price * inv.products[rowIndex].quantity;
    storageHandler.save('hkd_data', hkdData);
    document.querySelectorAll('.modal').forEach(el => el.remove());
    showInvoicePopup(inv.invoiceInfo.number, inv.invoiceInfo.mccqt, invoiceIndex, taxCode);
}
function addInvoiceRow(taxCode, invoiceIndex) {
    const inv = hkdData[taxCode].invoices[invoiceIndex];
    inv.products.push({ name: '', unit: '', quantity: 1, price: 0, amount: 0 });
    storageHandler.save('hkd_data', hkdData);
    document.querySelectorAll('.modal').forEach(el => el.remove());
    showInvoicePopup(inv.invoiceInfo.number, inv.invoiceInfo.mccqt, invoiceIndex, taxCode);
}
function deleteInvoiceRow(taxCode, invoiceIndex, rowIndex) {
    const inv = hkdData[taxCode].invoices[invoiceIndex];
    inv.products.splice(rowIndex, 1);
    storageHandler.save('hkd_data', hkdData);
    document.querySelectorAll('.modal').forEach(el => el.remove());
    showInvoicePopup(inv.invoiceInfo.number, inv.invoiceInfo.mccqt, invoiceIndex, taxCode);
}

function showInvoicePopupNav(newIndex, taxCode) {
    const hkd = hkdData[taxCode];
    if (!hkd || !hkd.invoices[newIndex]) {
        showToast("Không còn hóa đơn!", "info");
        return;
    }

    document.querySelectorAll('.modal').forEach(el => el.remove());
    const inv = hkd.invoices[newIndex];
    showInvoicePopup(inv.invoiceInfo.number, inv.invoiceInfo.mccqt, newIndex, taxCode);
}
async function gitbu() {
    const token = localStorage.getItem('github_token');

    if (!token) {
        alert('❌ Chưa có GitHub token trong localStorage! Hãy lưu token trước.');
        return;
    }

    const owner = 'Datkep92';
    const repo = 'test';
    const folderPath = 'invoices';

    if (!confirm(`Bạn có chắc chắn muốn xoá TẤT CẢ file trong GitHub repo: ${owner}/${repo}/${folderPath}?`)) {
        return;
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${folderPath}`, {
            headers: {
                Authorization: `token ${token}`
            }
        });

        if (!res.ok) {
            throw new Error(`Không thể truy cập thư mục: ${folderPath}`);
        }

        const files = await res.json();

        if (!Array.isArray(files)) {
            alert('📁 Không có file nào trong thư mục hoặc sai định dạng trả về.');
            return;
        }

        for (const file of files) {
            const deleteRes = await fetch(file.url, {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `delete ${file.name}`,
                    sha: file.sha
                })
            });

            if (deleteRes.ok) {
                console.log(`✅ Đã xoá: ${file.name}`);
            } else {
                const errText = await deleteRes.text();
                console.error(`❌ Lỗi xoá ${file.name}:`, errText);
            }
        }

        alert('🗑️ Đã xoá toàn bộ file trong thư mục GitHub.');

    } catch (err) {
        console.error('❌ Lỗi khi xoá file:', err);
        alert('⚠️ Lỗi khi xoá file GitHub. Kiểm tra console để biết chi tiết.');
    }
}

document.getElementById('deleteAllBtn').addEventListener('click', async () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu và file trên GitHub?')) {
        

        // 2. Gọi hàm xóa file GitHub
         deleteAllFilesInGitHubFolder();
// 1. Xóa localStorage
        await localStorage.clear();
        alert('Đã xóa toàn bộ dữ liệu.');
        location.reload();
    }
});

// ✅ Hàm trích xuất hóa đơn từ file ZIP, xử lý HTML nếu có và gọi xử lý tồn kho
// Extract invoice from ZIP
async function extractInvoiceFromZip(zipFile) {
    const zip = await JSZip.loadAsync(zipFile);
    if (!zip || !zip.files) throw new Error('❌ File ZIP không hợp lệ');

    const xmlFile = Object.values(zip.files).find(f => f.name.endsWith('.xml'));
    if (!xmlFile) throw new Error('❌ Không tìm thấy file XML trong ZIP');

    const xmlContent = await xmlFile.async('text');
    const invoice = parseXmlInvoice(xmlContent);

    // ✅ Gán MST người mua để xử lý đúng HKD
    invoice._taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';

    return invoice;
}
// ✅ Hiển thị tồn kho: bảng chính + bảng phụ chiết khấu + KM không SL
function renderInventoryTable(list, title) {
  if (!list || list.length === 0) return `<p>Không có dữ liệu ${title}</p>`;

  let totalQty = 0;
  let totalAmount = 0;

  const rows = list.map((item, i) => {
    const qty = parseFloat(item.quantity || 0);
    const amount = parseFloat(item.amount || 0);
    const price = parseFloat(item.price || 0);

    // ✅ Cộng tất cả hàng có SL > 0, kể cả KM (giá 0) và chiết khấu (âm)
    if (qty > 0) {
      totalQty += qty;
      totalAmount += amount;
    }

    return `
    <tr>
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.code}</td>
      <td>${item.category}</td>
      <td>${item.unit}</td>
      <td class="text-right">${formatNumber(qty)}</td>
      <td class="text-right">${formatCurrency(price)}</td>
      <td class="text-right">${formatCurrency(amount)}</td>
      <td class="text-right">${item.taxRate || '0'}%</td>
    </tr>`;
  }).join('');

  const footer = `
    <tr class="total-row" style="font-weight:bold; background:#f0f0f0;">
      <td colspan="5" style="text-align:right">Tổng cộng</td>
      <td class="text-right">${formatNumber(totalQty)}</td>
      <td></td>
      <td class="text-right">${formatCurrency(totalAmount)}</td>
      <td></td>
    </tr>`;

  return `
    <h4>${title}</h4>
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th>STT</th><th>Tên hàng</th><th>Mã</th><th>Phân loại</th><th>ĐVT</th>
          <th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Thuế suất</th>
        </tr>
      </thead>
      <tbody>${rows}${footer}</tbody>
    </table>
  `;
}
// ✅ Cập nhật bảng quản lý hóa đơn với tổng tính toán lại từ tồn kho
function renderInvoiceManagementTable(hkd) {
  if (!hkd.invoices || hkd.invoices.length === 0) return '<p>Chưa có hóa đơn nào.</p>';

  let html = `<table><thead><tr>
    <th>STT</th><th>Mã hóa đơn</th><th>Ngày</th><th>Tiền từ XML (TgTCThue)</th><th>Tính lại từ bảng kê</th>
    <th>Tồn kho trước</th><th>Tồn kho sau</th><th>Trạng thái</th><th>Xem</th><th>Xoá</th>
  </tr></thead><tbody>`;

  let totalInventory = 0;

  hkd.invoices.forEach((inv, idx) => {
    // ✅ Dùng đúng <TgTCThue> làm tổng tiền chưa thuế
    const xmlSubtotal = parseFloat(inv.totals.TgTCThue || '0');

    // ✅ Tính lại từ bảng kê: chỉ tính tiền hàng chưa thuế (amount)
    const calcSubtotal = inv.products.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

    const diff = Math.abs(xmlSubtotal - calcSubtotal);
    const isCorrect = diff <= 100;
    const statusColor = isCorrect ? 'green' : 'red';

    const inventoryBefore = totalInventory;
    const inventoryAfter = totalInventory + calcSubtotal;
    totalInventory = inventoryAfter;

    html += `<tr>
      <td>${idx + 1}</td>
      <td>${inv.invoiceInfo.number || 'N/A'}</td>
      <td>${inv.invoiceInfo.date || 'N/A'}</td>
      <td class="text-right">${formatCurrency(xmlSubtotal)}</td>
      <td class="text-right">${formatCurrency(calcSubtotal)}</td>
      <td class="text-right">${formatCurrency(inventoryBefore)}</td>
      <td class="text-right">${formatCurrency(inventoryAfter)}</td>
      <td style="color:${statusColor}; font-weight:bold">${isCorrect ? '✅ Đúng' : '❌ Sai lệch'}</td>
      <td><button onclick="showInvoicePopup('${inv.invoiceInfo.number}', '${inv.invoiceInfo.mccqt}', '${hkd.invoices.indexOf(inv)}', '${currentTaxCode}')">📄 Xem</button></td>
      <td><button onclick="deleteInvoice('${inv.invoiceInfo.number}', '${inv.invoiceInfo.mccqt}', '${currentTaxCode}')">❌ Xoá</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

// ✅ Tính tổng tồn kho từ bảng chính
function getTotalTonKho(hkd) {
  if (!hkd?.inventory) return 0;
  
  return hkd.inventory.reduce((sum, item) => {
    // Chỉ tính các mục hàng hóa thông thường (không phải chiết khấu/KM)
    if (item.category === 'hang_hoa') {
      return sum + (parseFloat(item.amount || 0));
    }
    return sum;
  }, 0);
}

function getTotalMisc(hkd) {
  if (!hkd?.miscInventory) return 0;
  
  return hkd.miscInventory.reduce((sum, item) => {
    return sum + (parseFloat(item.amount || 0));
  }, 0);
}

function getTotalFromList(list) {
  return list.reduce((sum, item) => sum + (parseFloat(item.amount || 0)), 0);
}

// ✅ Giao diện tách bảng tồn kho và tổng riêng biệt
function renderTonKhoWithToggles(taxCode) {
  const hkd = hkdData[taxCode];
  if (!hkd || !hkd.inventory) return '<p>Không có dữ liệu tồn kho.</p>';

  // Hàm tính tổng dựa trên danh sách và category
  const getTotalByCategory = (category) => {
    return hkd.inventory
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + Math.round(parseFloat(item.amount || 0)), 0);
  };

  // Tính các tổng từ bảng
  const tongChinh = getTotalByCategory('hang_hoa'); // Tổng hàng hóa chính
  const tongChietKhau = getTotalByCategory('chiet_khau'); // Tổng chiết khấu (âm nếu chiết khấu)
  const tongKM = getTotalByCategory('km'); // Tổng khuyến mãi
  const tongThucTe = tongChinh + tongChietKhau - tongKM; // Tổng tồn kho thực tế

  return `
    <div>
      <div style="margin-bottom:10px">
        <button onclick="switchTonKhoTab('main')">📦 Tồn kho chính</button>
        <button onclick="switchTonKhoTab('misc')">🎁 Chiết khấu / KM</button>
      </div>
      <div id="tonKhoTogglesSummary">
        <ul>
          <li>📦 Tổng hàng hóa: <b>${formatCurrency(tongChinh)}</b></li>
          <li>💸 Tổng chiết khấu: <b>${formatCurrency(tongChietKhau)}</b></li>
          <li>🎁 Tổng khuyến mãi: <b>${formatCurrency(tongKM)}</b></li>
          <li>✅ Tổng tồn kho thực tế: <b>${formatCurrency(tongThucTe)}</b></li>
        </ul>
      </div>
      <div id="tonKhoTogglesContainer"></div>
      <script>
        switchTonKhoTab('main');
      </script>
    </div>
  `;
}

function switchTonKhoTab(tab) {
  currentTonKhoTab = tab;

  const hkd = hkdData[currentTaxCode];
  if (!hkd) return;

  const inventory = hkd.inventory || [];
  let list = [], title = '', hideChietKhau = false;

  if (tab === 'main') {
    list = inventory.filter(i => i.category === 'hang_hoa' || i.category === 'chiet_khau');
    title = '📦 Tồn kho chính';
    hideChietKhau = true;
  } else {
    list = inventory.filter(i =>
      i.category === 'KM' || parseFloat(i.quantity || 0) === 0 || i.category === 'chiet_khau'
    );
    title = '🎁 Chiết khấu / KM';
    hideChietKhau = false;
  }

  // ✅ Cập nhật nút active
  document.querySelectorAll('#tonkho-tab-buttons button').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`#tonkho-tab-buttons button[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  document.getElementById('tonKhoTogglesContainer').innerHTML = renderInventoryTable(list, title, hideChietKhau);
}


function renderInventoryTable(list, title, hideChietKhau = false) {
  if (!list || list.length === 0) return `<p>Không có dữ liệu ${title}</p>`;

  let totalQty = 0;
  let totalAmount = 0;

  const rows = list.map((item, i) => {
    const qty = parseFloat(item.quantity || 0);
    const amount = parseFloat(item.amount || 0);
    const cat = item.category;

    if (cat === 'hang_hoa') totalQty += qty;
    if (cat === 'hang_hoa' || cat === 'chiet_khau') totalAmount += amount;

    const rowStyle = hideChietKhau && cat === 'chiet_khau' ? 'style="display:none"' : '';

    return `
    <tr ${rowStyle}>
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.code}</td>
      <td>${cat}</td>
      <td>${item.unit}</td>
      <td class="text-right">${formatNumber(qty)}</td>
      <td class="text-right">${formatCurrency(item.price)}</td>
      <td class="text-right">${formatCurrency(amount)}</td>
      <td class="text-right">${item.taxRate || '0'}%</td>
      <td>
        <button onclick='showAddProductForm(currentTaxCode, ${JSON.stringify(item)}, ${i})'>✏️</button>
        <button onclick='deleteInventoryRow(${i})'>🗑️</button>
      </td>
    </tr>`;
  }).join('');

  const footer = `
    <tr class="total-row" style="font-weight:bold; background:#f0f0f0;">
      <td colspan="5" style="text-align:right">Tổng cộng</td>
      <td class="text-right">${formatNumber(totalQty)}</td>
      <td></td>
      <td class="text-right">${formatCurrency(totalAmount)}</td>
      <td></td>
      <td></td>
    </tr>`;

  return `
    <h4>${title}</h4>
    <div style="margin-bottom:10px">
      <button onclick="showAddProductForm(currentTaxCode)">➕ Thêm dòng</button>
    </div>
    <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th>STT</th><th>Tên hàng</th><th>Mã</th><th>Phân loại</th><th>ĐVT</th>
          <th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Thuế suất</th><th>Thao tác</th>
        </tr>
      </thead>
      <tbody>${rows}${footer}</tbody>
    </table>
  `;
}
function deleteInventoryRow(index) {
  if (!confirm('Bạn có chắc chắn muốn xóa dòng này không?')) return;
  const hkd = hkdData[currentTaxCode];
  if (!hkd || !hkd.inventory) return;

  hkd.inventory.splice(index, 1); // Xóa dòng khỏi danh sách
  switchTonKhoTab(currentTonKhoTab); // Cập nhật lại bảng hiện tại
}
function editInventoryRow(index) {
  const hkd = hkdData[currentTaxCode];
  if (!hkd || !hkd.inventory || !hkd.inventory[index]) return;

  const item = hkd.inventory[index];
  showAddProductForm(currentTaxCode, item, index); // mở modal sửa
}

// ✅ Hàm xử lý hóa đơn và phân loại hàng vào tồn kho chính và tồn kho phụ (logic dựa trên tchat + từ khóa)
function processInvoiceData(invoice) {
    const taxCode = invoice?.buyerInfo?.taxCode?.trim() || 'UNKNOWN';
    if (!taxCode) return;

    let hkd = hkdData[taxCode];
    if (!hkd) {
        hkd = {
            name: invoice.buyerInfo?.name || 'Không rõ tên',
            taxCode,
            address: invoice.buyerInfo?.address || '',
            invoices: [],
            exportHistory: [],
            deleteHistory: [],
            inventory: [],
            tag: '',
            color: ''
        };
        hkdData[taxCode] = hkd;
        hkdOrder.unshift(taxCode);
    }

    const exist = hkd.invoices.find(inv => inv.invoiceInfo?.number === invoice.invoiceInfo?.number);
    if (!exist) {
        hkd.invoices.push(invoice);
    }

    invoice.products.forEach(p => {
        hkd.inventory.push({
            ...p,
            type: 'Nhập',
            sellingPrice: calculateSellingPrice(p.price)
        });
    });
}
function showBusinessDetails(taxCode, from, to) {
    currentTaxCode = taxCode;
    const hkd = hkdData[taxCode];
    if (!hkd) {
        showToast('Không tìm thấy doanh nghiệp', 'error');
        mainContent.innerHTML = '<div id="hkdInfo">Chưa chọn HKD</div>';
        return;
    }

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const filteredInvoices = (hkd.invoices || []).filter(inv => {
        const d = new Date(inv.date || inv.invoiceInfo?.date);
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    const filteredExports = (hkd.exportHistory || []).filter(e => {
        const d = new Date(e.date);
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });

    const relatedCodes = new Set();
    filteredInvoices.forEach(inv => {
        (inv.products || []).forEach(p => relatedCodes.add(`${p.code}__${p.unit}`));
    });

    const allInventory = hkd.inventory || [];

    const filterByRelatedCodes = (list) => list.filter(item => {
        const code = item.code || 'UNKNOWN';
        const unit = item.unit || 'N/A';
        return relatedCodes.has(`${code}__${unit}`);
    });

    const filteredInventory = filterByRelatedCodes(allInventory);

    const inventoryMain = filteredInventory.filter(i => i.category === 'hang_hoa');
    const inventoryKM = filteredInventory.filter(i => i.category === 'KM');
    const inventoryCK = filteredInventory.filter(i => i.category === 'chiet_khau');

    const totalAmountMain = inventoryMain.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

    const name = hkd.name || 'Chưa rõ';
    const f = from ? new Date(from).toLocaleDateString('vi-VN') : 'đầu kỳ';
    const t = to ? new Date(to).toLocaleDateString('vi-VN') : 'nay';

    let totalInvoiceAmount = 0, totalInvoiceTax = 0, totalInvoiceFee = 0, totalInvoiceDiscount = 0;
    filteredInvoices.forEach(inv => {
        totalInvoiceAmount += parseFloat(inv.totals?.total || 0);
        totalInvoiceTax += parseFloat(inv.totals?.tax || 0);
        totalInvoiceFee += parseFloat(inv.totals?.fee || 0);
        totalInvoiceDiscount += parseFloat(inv.totals?.discount || 0);
    });

    let totalExportRevenue = 0, totalExportCost = 0;
    filteredExports.forEach(r => {
        (r.productList || []).forEach(p => {
            const qty = parseFloat(p.quantity || 0);
            const cost = parseFloat(p.price || 0);
            const sell = parseFloat(p.sellingPrice || 0);
            totalExportRevenue += sell * qty;
            totalExportCost += cost * qty;
        });
    });

    const totalProfit = totalExportRevenue - totalExportCost;

    mainContent.innerHTML = `
      <div class="hkd-wrapper">
        <div class="hkd-report-filters">
          <label>Từ ngày: <input type="date" id="reportFrom-${taxCode}" value="${from || ''}"></label>
          <label>Đến ngày: <input type="date" id="reportTo-${taxCode}" value="${to || ''}"></label>
          <button onclick="applyHKDReportFilter('${taxCode}')">📊 Áp dụng</button>
          <button onclick="resetHKDReport('${taxCode}')">🔄 Xem toàn bộ</button>
          <button onclick="printHKDSummary('${taxCode}')">🖨️ In báo cáo</button>
        </div>

        <h2 style="font-size:25px; font-weight:bold; color:red; margin:10px 0;">🧾 ${name}</h2>
        <div style="margin-bottom:12px;">
          📅 Đang lọc từ <b>${f}</b> đến <b>${t}</b>: ${filteredInvoices.length} hóa đơn, ${filteredExports.length} lần xuất hàng
        </div>

        <div class="hkd-summary-grid hkd-section">
          <div class="summary-box"><div class="label">📥 Tổng HĐ đầu vào</div><div class="value">${filteredInvoices.length}</div></div>
          <div class="summary-box"><div class="label">🧾 Tổng HDST đã T.Toán</div><div class="value">${formatCurrency(totalInvoiceAmount)}</div></div>
          <div class="summary-box"><div class="label">💸 Thuế GTGT đã trả</div><div class="value">${formatCurrency(totalInvoiceTax)}</div></div>
          <div class="summary-box"><div class="label">📦 Phí</div><div class="value">${formatCurrency(totalInvoiceFee)}</div></div>
          <div class="summary-box"><div class="label">🎁 Chiết khấu</div><div class="value">${formatCurrency(totalInvoiceDiscount)}</div></div>
          <div class="summary-box"><div class="label">📤 Tổng HĐ xuất hàng</div><div class="value">${filteredExports.length}</div></div>
          <div class="summary-box"><div class="label">📤 Tổng tiền xuất hàng</div><div class="value">${formatCurrency(totalExportRevenue)}</div></div>
          <div class="summary-box"><div class="label">📈 Tổng lợi nhuận tạm tính</div><div class="value">${formatCurrency(totalProfit)}</div></div>
          <div class="summary-box"><div class="label">💼 Tổng tồn kho hiện tại</div><div class="value">${formatCurrency(totalAmountMain)}</div></div>
        </div>

        <div class="tabs">
          <div class="tab active" onclick="openTab(event, '${taxCode}-tonkho')">📦 Tồn kho</div>
          <div class="tab" onclick="openTab(event, '${taxCode}-qlyhoadon')">📥 Quản lý Hóa đơn đầu vào</div>
          <div class="tab" onclick="openTab(event, '${taxCode}-xuathang')">📤 Xuất hàng hóa</div>
          <div class="tab" onclick="openTab(event, '${taxCode}-lichsu')">📜 Lịch sử xuất hàng</div>
        </div>

        <div id="${taxCode}-tonkho" class="tab-content active hkd-section">
          <h4>📦 Danh sách tồn kho</h4>
          <button onclick="renderTonkhoTable('${taxCode}', 'main')">📦 Hàng hóa</button>
          <button onclick="renderTonkhoTable('${taxCode}', 'km')">🎁 Khuyến mại</button>
          <button onclick="renderTonkhoTable('${taxCode}', 'ck')">🔻 Chiết khấu</button>
          <div id="tonKho-main"></div>
          <div id="tonKho-km" style="display:none;"></div>
          <div id="tonKho-ck" style="display:none;"></div>
        </div>

        <div id="${taxCode}-qlyhoadon" class="tab-content hkd-section">
          <div id="${taxCode}-invoiceTablePlaceholder"></div>
        </div>

        <div id="${taxCode}-xuathang" class="tab-content hkd-section">
          <div id="${taxCode}-exportTabPlaceholder"></div>
          <div style="margin-top:20px;">
            <h4>📜 Lịch sử xuất hàng</h4>
            <div id="${taxCode}-exportHistoryTable"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById(`${taxCode}-invoiceTablePlaceholder`).innerHTML =
      renderInvoiceManagementTable({ ...hkd, invoices: filteredInvoices });

    document.getElementById(`${taxCode}-exportTabPlaceholder`).innerHTML =
      renderExportTab(hkd, taxCode);

    document.getElementById(`${taxCode}-exportHistoryTable`).innerHTML =
      renderExportHistory(taxCode, filteredExports);

    renderTonkhoTable(taxCode, 'main');
}
function showLogHistory() {
    const logs = JSON.parse(localStorage.getItem('logs') || '[]');
    if (logs.length === 0) {
        alert('✅ Không có log lỗi nào');
        return;
    }

    const last10 = logs.slice(-10).reverse();
    const logText = last10.map((log, i) =>
        `${i + 1}. [${log.type}] ${log.data.filename || ''}\n→ ${log.data.message}\n`
    ).join('\n');

    alert(`🧾 Log lỗi gần đây:\n\n${logText}`);
}