// Enhanced Revenue-Expense Report System
const reportConfig = {
  sortField: 'date',
  sortOrder: 'desc',
  itemsPerPage: 10
};

// MAIN FUNCTIONS (preserved with enhancements)
function submitReport() {
  const openingBalance = parseFloat(document.getElementById("opening-balance")?.value) || 0;
  const revenue = parseFloat(document.getElementById("revenue")?.value) || 0;
  const expenseInput = document.getElementById("expense-input")?.value || "";
  const transferAmount = parseFloat(document.getElementById("transfer-amount")?.value) || 0;
  const closingBalance = parseFloat(document.getElementById("closing-balance")?.value) || 0;
  
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);
  const products = getReportProducts();

  // ENHANCED VALIDATION
  if (!validateReportData({
    openingBalance,
    revenue,
    expenseAmount,
    transferAmount,
    closingBalance,
    products
  })) return;

  const remaining = openingBalance + revenue - expenseAmount - closingBalance;
  const cashActual = remaining - transferAmount;

  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!", 'error');
      return;
    }

    const reportData = {
      date: new Date().toISOString(),
      openingBalance,
      revenue,
      expenseAmount,
      expenseNote: expenseAmount > 0 ? expenseNote : "",
      transferAmount,
      transferTimestamp: transferAmount > 0 ? new Date().toISOString() : null,
      closingBalance,
      remaining,
      cashActual,
      products,
      employeeId: user.uid,
      employeeName: getEmployeeName(user.uid),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    db.ref("reports").push(reportData)
      .then(() => {
        showToastNotification("Báo cáo đã được gửi!", 'success');
        resetReportForm();
        renderReportProductList();
        renderFilteredReports(getReportData());
        logReportAction('submit', reportData);
      })
      .catch(err => {
        console.error("Lỗi khi gửi báo cáo:", err);
        showToastNotification("Lỗi khi gửi báo cáo: " + err.message, 'error');
      });
  });
}

// NEW: Enhanced validation
function validateReportData(data) {
  if (data.openingBalance < 0) {
    showToastNotification("Số dư đầu kỳ không được âm!", 'error');
    return false;
  }
  if (data.revenue < 0) {
    showToastNotification("Doanh thu không được âm!", 'error');
    return false;
  }
  if (data.expenseAmount < 0) {
    showToastNotification("Chi phí không được âm!", 'error');
    return false;
  }
  if (data.transferAmount < 0) {
    showToastNotification("Số tiền chuyển khoản không được âm!", 'error');
    return false;
  }
  if (data.closingBalance < 0) {
    showToastNotification("Số dư cuối kỳ không được âm!", 'error');
    return false;
  }

  // Check product inventory
  for (const product of data.products) {
    const inventoryItem = getInventoryData().find(item => item.id === product.productId);
    if (!inventoryItem) {
      showToastNotification(`Sản phẩm ${product.name} không tồn tại trong kho!`, 'error');
      return false;
    }
    if (product.quantity > inventoryItem.quantity) {
      showToastNotification(`Không đủ ${product.name} trong kho (chỉ còn ${inventoryItem.quantity})!`, 'error');
      return false;
    }
  }

  return true;
}

// NEW: Get products from report form
function getReportProducts() {
  return Array.from(document.querySelectorAll("#report-product-list .product-item"))
    .map(item => {
      const productId = item.dataset.productId;
      const name = item.querySelector(".product-name")?.textContent.split('(')[0].trim();
      const quantity = parseInt(item.querySelector(".quantity")?.textContent) || 0;
      return quantity > 0 ? { productId, name, quantity } : null;
    })
    .filter(p => p);
}

// NEW: Reset report form
function resetReportForm() {
  document.getElementById("opening-balance").value = "";
  document.getElementById("revenue").value = "";
  document.getElementById("expense-input").value = "";
  document.getElementById("transfer-amount").value = "";
  document.getElementById("closing-balance").value = "";
  
  // Reset product quantities
  document.querySelectorAll("#report-product-list .quantity").forEach(el => {
    el.textContent = "0";
  });
}

// ENHANCED REPORT DISPLAY
function renderFilteredReports(filteredReports, options = {}) {
  const {
    dateRange = 'today', // 'today' | 'week' | 'month' | 'custom'
    customStartDate = null,
    customEndDate = null,
    page = 1
  } = options;

  // Filter reports by date range
  let displayReports = filterReportsByDate(filteredReports, dateRange, customStartDate, customEndDate);
  
  // Sort reports
  displayReports = sortReports(displayReports, reportConfig.sortField, reportConfig.sortOrder);
  
  // Paginate reports
  const totalPages = Math.ceil(displayReports.length / reportConfig.itemsPerPage);
  const paginatedReports = displayReports.slice(
    (page - 1) * reportConfig.itemsPerPage,
    page * reportConfig.itemsPerPage
  );

  // Update UI
  updateReportTables(paginatedReports, displayReports, dateRange, customStartDate, customEndDate);
  updateReportSummary(displayReports);
  updateProductSummary(displayReports);
  updateTransferSummary(displayReports);
  
  // Render pagination
  renderPagination(totalPages, page);
}

// NEW: Filter reports by date range
function filterReportsByDate(reports, range, startDate, endDate) {
  const now = new Date();
  let filtered = [...reports];

  switch (range) {
    case 'today':
      const today = now.toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date.split('T')[0] === today);
      break;
    case 'week':
      const oneWeekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date.split('T')[0] >= oneWeekAgo);
      break;
    case 'month':
      const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date.split('T')[0] >= oneMonthAgo);
      break;
    case 'custom':
      if (startDate && endDate) {
        filtered = filtered.filter(r => 
          r.date.split('T')[0] >= startDate && 
          r.date.split('T')[0] <= endDate
        );
      }
      break;
  }

  return filtered;
}

// NEW: Sort reports
function sortReports(reports, field, order) {
  return [...reports].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];
    
    if (field === 'date') {
      return order === 'asc' 
        ? new Date(valueA) - new Date(valueB)
        : new Date(valueB) - new Date(valueA);
    }
    
    return order === 'asc'
      ? valueA - valueB
      : valueB - valueA;
  });
}

// NEW: Update report tables
function updateReportTables(reports, allReports, dateRange, startDate, endDate) {
  const displayDate = getDisplayDate(dateRange, startDate, endDate);
  
  // Expense Table
  const expenseContainer = document.getElementById("shared-report-table");
  if (expenseContainer) {
    const expenseReports = reports.filter(r => r.expenseAmount > 0);
    expenseContainer.innerHTML = `
      <h3>Báo cáo Thu Chi (${displayDate})</h3>
      ${expenseReports.length > 0 
        ? createExpenseTable(expenseReports) 
        : `<p>Không có chi phí trong ${displayDate}</p>`}
    `;
  }

  // Product Table
  const productContainer = document.getElementById("report-product-table");
  if (productContainer) {
    const productReports = getProductReports(reports);
    productContainer.innerHTML = `
      <h3>Báo cáo Xuất Hàng (${displayDate})</h3>
      ${productReports.length > 0 
        ? createProductTable(productReports) 
        : `<p>Không có xuất hàng trong ${displayDate}</p>`}
    `;
  }

  // Transfer Table
  const transferContainer = document.getElementById("transfer-details");
  if (transferContainer) {
    const transferReports = reports.filter(r => r.transferAmount > 0);
    transferContainer.innerHTML = `
      <h3>Giao dịch Chuyển khoản (${displayDate})</h3>
      ${transferReports.length > 0 
        ? createTransferTable(transferReports) 
        : `<p>Không có giao dịch chuyển khoản trong ${displayDate}</p>`}
    `;
  }
}

// NEW: Helper functions for creating tables
function createExpenseTable(reports) {
  return `
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Thời gian</th>
          <th>Nhân viên</th>
          <th>Chi phí (VND)</th>
          <th>Ghi chú</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map((r, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatTime(r.date)}</td>
            <td>${r.employeeName || "Không xác định"}</td>
            <td>${formatCurrency(r.expenseAmount)}</td>
            <td>${r.expenseNote || ""}</td>
            <td class="action-buttons">
              <button onclick="editReportExpense('${r.id}')">Sửa</button>
              <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function createProductTable(productReports) {
  return `
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Sản phẩm</th>
          <th>Số lượng</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${productReports.map((p, index) => {
          const inventoryItem = getInventoryData().find(item => item.id === p.productId);
          const remaining = inventoryItem ? inventoryItem.quantity : 0;
          return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDate(p.date)}</td>
            <td>${p.employeeName}</td>
            <td>${p.productName}</td>
            <td>${p.quantity} (Còn: ${remaining})</td>
            <td class="action-buttons">
              <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
              <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
            </td>
          </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function createTransferTable(reports) {
  const total = reports.reduce((sum, r) => sum + (r.transferAmount || 0), 0);
  return `
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Thời gian</th>
          <th>Nhân viên</th>
          <th>Số tiền (VND)</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map((r, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatTime(r.transferTimestamp)}</td>
            <td>${r.employeeName || "Không xác định"}</td>
            <td>${formatCurrency(r.transferAmount)}</td>
            <td class="action-buttons">
              <button onclick="editReportTransfer('${r.id}')">Sửa</button>
              <button onclick="deleteReportTransfer('${r.id}')">Xóa</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3"><strong>Tổng cộng</strong></td>
          <td><strong>${formatCurrency(total)}</strong></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;
}

// NEW: Formatting helpers
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('vi-VN');
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { 
    style: 'currency', 
    currency: 'VND' 
  }).format(amount);
}

function getDisplayDate(range, startDate, endDate) {
  switch (range) {
    case 'today': return 'hôm nay';
    case 'week': return 'tuần này';
    case 'month': return 'tháng này';
    case 'custom': 
      return startDate && endDate 
        ? `từ ${formatDate(startDate)} đến ${formatDate(endDate)}`
        : 'khoảng thời gian đã chọn';
    default: return '';
  }
}

// ENHANCED EDIT/DELETE FUNCTIONS (with validation)
function editReportExpense(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    showToastNotification("Báo cáo không tồn tại!", 'error');
    return;
  }

  const newAmount = parseFloat(prompt("Nhập số tiền chi phí mới:", report.expenseAmount) || 0);
  if (isNaN(newAmount) || newAmount < 0) {
    showToastNotification("Số tiền không hợp lệ!", 'error');
    return;
  }

  const newNote = prompt("Nhập ghi chú mới:", report.expenseNote || "") || "";

  const updates = {
    expenseAmount: newAmount,
    expenseNote: newAmount > 0 ? newNote : "",
    remaining: report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0),
    cashActual: (report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0)) - (report.transferAmount || 0),
    lastUpdated: new Date().toISOString()
  };

  db.ref("reports/" + reportId).update(updates)
    .then(() => {
      showToastNotification("Đã cập nhật chi phí!", 'success');
      renderFilteredReports(getReportData());
      logReportAction('edit_expense', { reportId, ...updates });
    })
    .catch(err => {
      console.error("Lỗi cập nhật chi phí:", err);
      showToastNotification("Lỗi khi cập nhật chi phí: " + err.message, 'error');
    });
}

// ... (similar enhanced implementations for other edit/delete functions)

// NEW: Report action logging
function logReportAction(action, data) {
  const logEntry = {
    action,
    data,
    timestamp: new Date().toISOString(),
    performedBy: currentUser?.uid || 'system'
  };
  
  db.ref(`reportLogs/${generateId()}`).set(logEntry)
    .catch(err => console.error("Lỗi ghi log hành động báo cáo:", err));
}

// Initialize report system
function initReportSystem() {
  // Set up event listeners
  document.getElementById('report-sort')?.addEventListener('change', (e) => {
    const [field, order] = e.target.value.split('-');
    reportConfig.sortField = field;
    reportConfig.sortOrder = order;
    renderFilteredReports(getReportData());
  });

  // Initial render
  renderReportProductList();
  renderFilteredReports(getReportData());
}