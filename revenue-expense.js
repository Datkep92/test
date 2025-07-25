// Gắn hàm vào window để common.js truy cập
window.renderReportProductList = renderReportProductList;
window.renderFilteredReports = renderFilteredReports;

// Gửi báo cáo
function submitReport() {
  const openingBalance = parseFloat(document.getElementById("opening-balance")?.value) || 0;
  const revenue = parseFloat(document.getElementById("revenue")?.value) || 0;
  const expenseInput = document.getElementById("expense-input")?.value || "";
  const transferAmount = parseFloat(document.getElementById("transfer-amount")?.value) || 0;
  const closingBalance = parseFloat(document.getElementById("closing-balance")?.value) || 0;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput); // Dùng parseEntry từ common.js
  const products = Array.from(document.querySelectorAll("#report-product-list .product-item")).map(item => {
    const productId = item.dataset.productId;
    const name = item.querySelector(".product-name")?.textContent;
    const quantity = parseInt(item.querySelector(".quantity")?.textContent) || 0;
    return quantity > 0 ? { productId, name, quantity } : null;
  }).filter(p => p);

  if (openingBalance < 0 || revenue < 0 || expenseAmount < 0 || transferAmount < 0 || closingBalance < 0) {
    alert("Các giá trị không được âm!");
    return;
  }

  const remaining = openingBalance + revenue - expenseAmount - closingBalance;
  const cashActual = remaining - transferAmount;

  auth.onAuthStateChanged(user => {
    if (!user) {
      alert("Vui lòng đăng nhập!");
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
      employeeName: globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định"
    };

    db.ref("reports").push(reportData)
      .then(() => {
        alert("Báo cáo đã được gửi!");
        document.getElementById("revenue-expense-form")?.reset();
        renderReportProductList();
        renderFilteredReports(getReportData());
      })
      .catch(err => alert("Lỗi khi gửi báo cáo: " + err.message));
  });
}

// Chỉnh sửa chi phí
function editReportExpense(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newExpense = prompt("Chỉnh sửa chi phí (VND):", report.expenseAmount || 0);
  const newNote = prompt("Chỉnh sửa ghi chú:", report.expenseNote || "");
  if (!newExpense || isNaN(newExpense) || newExpense < 0) {
    alert("Chi phí không hợp lệ!");
    return;
  }
  const updatedExpense = parseFloat(newExpense);
  db.ref("reports/" + reportId).update({
    expenseAmount: updatedExpense,
    expenseNote: newNote || "",
    remaining: report.openingBalance + report.revenue - updatedExpense - (report.closingBalance || 0),
    cashActual: (report.openingBalance + report.revenue - updatedExpense - (report.closingBalance || 0)) - (report.transferAmount || 0)
  })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã cập nhật chi phí!");
    })
    .catch(err => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

// Xóa chi phí
function deleteReportExpense(reportId) {
  if (!confirm("Xóa chi phí này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  db.ref("reports/" + reportId).update({
    expenseAmount: 0,
    expenseNote: "",
    remaining: report.openingBalance + report.revenue - (report.closingBalance || 0),
    cashActual: (report.openingBalance + report.revenue - (report.closingBalance || 0)) - (report.transferAmount || 0)
  })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã xóa chi phí!");
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
}

// Chỉnh sửa giao dịch chuyển khoản
function editReportTransfer(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newAmount = prompt("Chỉnh sửa số tiền chuyển khoản (VND):", report.transferAmount || 0);
  if (!newAmount || isNaN(newAmount) || newAmount < 0) {
    alert("Số tiền không hợp lệ!");
    return;
  }
  const updatedAmount = parseFloat(newAmount);
  db.ref("reports/" + reportId).update({
    transferAmount: updatedAmount,
    transferTimestamp: updatedAmount > 0 ? new Date().toISOString() : null,
    cashActual: (report.openingBalance + report.revenue - report.expenseAmount - (report.closingBalance || 0)) - updatedAmount
  })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã cập nhật giao dịch chuyển khoản!");
    })
    .catch(err => alert("Lỗi khi cập nhật giao dịch: " + err.message));
}

// Xóa giao dịch chuyển khoản
function deleteReportTransfer(reportId) {
  if (!confirm("Xóa giao dịch chuyển khoản này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  db.ref("reports/" + reportId).update({
    transferAmount: 0,
    transferTimestamp: null,
    cashActual: report.openingBalance + report.revenue - report.expenseAmount - (report.closingBalance || 0)
  })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã xóa giao dịch chuyển khoản!");
    })
    .catch(err => alert("Lỗi khi xóa giao dịch: " + err.message));
}

// Hiển thị dữ liệu thu chi
function renderRevenueExpenseData() {
  const reportContainer = document.getElementById("shared-report-table");
  if (!reportContainer) return;

  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date(today).toLocaleDateString('vi-VN');

  const todayReports = getReportData().filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  if (todayReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có dữ liệu chi tiết cho ngày ${displayDate}.</p>`;
    return;
  }

  const expenseReports = todayReports.filter(r => r.expenseAmount > 0).sort((a, b) => new Date(b.date) - new Date(a.date));
  const isExpanded = isExpandedStates.revenueExpenseData;
  const displayExpenses = isExpanded ? expenseReports : expenseReports.slice(0, 3);

  const reportTable = document.createElement("table");
  reportTable.classList.add("table-style");
  reportTable.innerHTML = `
    <thead><tr><th>STT</th><th>Tên NV</th><th>Chi phí</th><th>Hành động</th></tr></thead>
    <tbody>${displayExpenses.map((r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${r.employeeName || "Không xác định"}</td>
        <td>${(r.expenseAmount || 0).toLocaleString('vi-VN')} VND (${r.expenseNote || "Không có"})</td>
        <td><div class="action-buttons">
          <button onclick="editReportExpense('${r.id}')">Sửa</button>
          <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
        </div></td>
      </tr>`).join("")}</tbody>`;
  reportContainer.innerHTML = `<h3>Bảng Báo cáo Thu Chi (${displayDate})</h3>`;
  reportContainer.appendChild(reportTable);

  if (expenseReports.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpanded ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => { 
      isExpandedStates.revenueExpenseData = !isExpandedStates.revenueExpenseData; 
      renderRevenueExpenseData(); 
    };
    reportContainer.appendChild(expandBtn);
  }
}

// Hiển thị báo cáo lọc
function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  const transferContainer = document.getElementById("transfer-details");
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!reportContainer || !productContainer || !transferContainer || !summaryContainer) {
    console.error("One or more containers not found");
    return;
  }

  let displayReports = filteredReports;
  if (startDate) {
    displayReports = filteredReports.filter(r => {
      const reportDate = new Date(r.date).toISOString().split("T")[0];
      return reportDate >= startDate && reportDate <= (endDate || startDate);
    });
  } else if (selectedDate) {
    displayReports = filteredReports.filter(r => r.date.split('T')[0] === selectedDate);
  } else {
    const today = new Date().toISOString().split("T")[0];
    displayReports = filteredReports.filter(r => r.date.split('T')[0] === today);
  }

  const displayDate = selectedDate 
    ? new Date(selectedDate).toLocaleDateString('vi-VN')
    : (startDate 
      ? `${new Date(startDate).toLocaleDateString('vi-VN')}${endDate && endDate !== startDate ? ' - ' + new Date(endDate).toLocaleDateString('vi-VN') : ''}`
      : new Date().toLocaleDateString('vi-VN'));

  if (displayReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    transferContainer.innerHTML = `<p>Chưa có giao dịch chuyển khoản trong ${displayDate}.</p>`;
    summaryContainer.innerHTML = `<p>Chưa có tóm tắt thu chi trong ${displayDate}.</p>`;
    return;
  }

  const sortedReports = displayReports.sort((a, b) => new Date(b.date) - new Date(a.date));
  const isExpandedFinance = isExpandedStates.filteredReports;
  const isExpandedProduct = isExpandedStates.filteredReports;

  // Bảng báo cáo thu chi
  const expenseReports = sortedReports.filter(r => r.expenseAmount > 0);
  const displayExpenses = isExpandedFinance ? expenseReports : expenseReports.slice(0, 3);
  const reportTable = document.createElement("table");
  reportTable.classList.add("table-style");
  reportTable.innerHTML = `
    <thead><tr><th>STT</th><th>Tên NV</th><th>Chi phí</th><th>Hành động</th></tr></thead>
    <tbody>${displayExpenses.map((r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${r.employeeName || "Không xác định"}</td>
        <td>${(r.expenseAmount || 0).toLocaleString('vi-VN')} VND (${r.expenseNote || "Không có"})</td>
        <td><div class="action-buttons">
          <button onclick="editReportExpense('${r.id}')">Sửa</button>
          <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
        </div></td>
      </tr>`).join("")}</tbody>`;
  reportContainer.innerHTML = `<h3>Bảng Báo cáo Thu Chi (${displayDate})</h3>`;
  reportContainer.appendChild(reportTable);

  if (expenseReports.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedFinance ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => { 
      isExpandedStates.filteredReports = !isExpandedStates.filteredReports; 
      renderFilteredReports(filteredReports, selectedDate, startDate, endDate); 
    };
    reportContainer.appendChild(expandBtn);
  }

  // Bảng báo cáo xuất hàng
  const productReports = sortedReports.flatMap((r, index) => 
    Array.isArray(r.products) && r.products.length > 0 
      ? r.products.map(p => ({
          index: index + 1,
          reportId: r.id,
          employeeName: r.employeeName || "Không xác định",
          productName: p.name || "Sản phẩm không xác định",
          quantity: p.quantity,
          productId: p.productId,
          date: r.date
        }))
      : []
  );
  const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
  const productTable = document.createElement("table");
  productTable.classList.add("table-style");
  productTable.innerHTML = `
    <thead><tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr></thead>
    <tbody>${displayProducts.map(p => `
      <tr>
        <td>${p.index}</td>
        <td>${p.employeeName}</td>
        <td>${p.productName}</td>
        <td>${p.quantity}</td>
        <td><div class="action-buttons">
          <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
          <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
        </div></td>
      </tr>`).join("")}</tbody>`;
  productContainer.innerHTML = `<h3>Bảng Báo cáo Xuất Hàng (${displayDate})</h3>`;
  productContainer.appendChild(productTable);

  if (productReports.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedProduct ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => { 
      isExpandedStates.filteredReports = !isExpandedStates.filteredReports; 
      renderFilteredReports(filteredReports, selectedDate, startDate, endDate); 
    };
    productContainer.appendChild(expandBtn);
  }

  // Bảng chi tiết giao dịch chuyển khoản
  const transferReports = sortedReports.filter(r => r.transferAmount > 0 && r.transferTimestamp);
  let totalTransferAmount = 0;
  const transferTable = document.createElement("table");
  transferTable.classList.add("table-style");
  transferTable.innerHTML = `
    <thead><tr><th>STT</th><th>Giờ</th><th>Số tiền (VND)</th><th>Hành động</th></tr></thead>
    <tbody>${transferReports.map((r, index) => {
      totalTransferAmount += r.transferAmount || 0;
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${new Date(r.transferTimestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${(r.transferAmount || 0).toLocaleString('vi-VN')}</td>
        <td><div class="action-buttons">
          <button onclick="editReportTransfer('${r.id}')">Sửa</button>
          <button onclick="deleteReportTransfer('${r.id}')">Xóa</button>
        </div></td>
      </tr>`;
    }).join("")}</tbody>`;
  transferTable.innerHTML += `
    <tfoot><tr><td colspan="2"><strong>Tổng</strong></td><td><strong>${totalTransferAmount.toLocaleString('vi-VN')} VND</strong></td><td></td></tr></tfoot>`;
  transferContainer.innerHTML = `<h3>Chi tiết Giao dịch Chuyển khoản (${displayDate})</h3>`;
  if (transferReports.length === 0) {
    transferContainer.innerHTML += `<p>Chưa có giao dịch chuyển khoản trong ${displayDate}.</p>`;
  } else {
    transferContainer.appendChild(transferTable);
  }

  // Tóm tắt thu chi
  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;
  const totalCashActual = totalRemaining - totalTransferAmount;

  const getLatestReport = (field, condition) => {
    const validReports = sortedReports.filter(condition).sort((a, b) => new Date(b.date) - new Date(a.date));
    return validReports[0] || { employeeName: "Không xác định", date: null };
  };

  const latestOpening = getLatestReport('openingBalance', r => r.openingBalance > 0);
  const latestRevenue = getLatestReport('revenue', r => r.revenue > 0);
  const latestExpense = getLatestReport('expenseAmount', r => r.expenseAmount > 0);
  const latestTransfer = getLatestReport('transferAmount', r => r.transferAmount > 0);
  const latestClosing = getLatestReport('closingBalance', r => r.closingBalance > 0);
  const latestRemaining = getLatestReport('remaining', r => r.remaining !== 0);
  const latestCashActual = getLatestReport('cashActual', r => r.cashActual !== 0);

  const formatTime = (date) => date ? new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString('vi-VN')} VND (${formatTime(latestOpening.date)} NV: ${latestOpening.employeeName})</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString('vi-VN')} VND (${formatTime(latestRevenue.date)} NV: ${latestRevenue.employeeName})</p>
    <p><strong>Tiền chuyển khoản:</strong> ${totalTransferAmount.toLocaleString('vi-VN')} VND (${formatTime(latestTransfer.date)} NV: ${latestTransfer.employeeName})</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString('vi-VN')} VND (${formatTime(latestExpense.date)} NV: ${latestExpense.employeeName})</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString('vi-VN')} VND (${formatTime(latestClosing.date)} NV: ${latestClosing.employeeName})</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString('vi-VN')} VND (${formatTime(latestRemaining.date)} NV: ${latestRemaining.employeeName})</p>
    <p><strong>Tiền mặt thực tế:</strong> ${totalCashActual.toLocaleString('vi-VN')} VND (${formatTime(latestCashActual.date)} NV: ${latestCashActual.employeeName})</p>`;

  // Tổng xuất kho
  const totalProductSummary = productReports.reduce((acc, p) => {
    acc[p.productName] = (acc[p.productName] || 0) + p.quantity;
    return acc;
  }, {});
  const totalProductText = Object.entries(totalProductSummary)
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => {
      const inventoryItem = getInventoryData().find(item => item.name === name);
      const remainingQty = inventoryItem ? inventoryItem.quantity : 0;
      return `<li>${name}: ${qty} (Còn: ${remainingQty})</li>`;
    })
    .join("");
  const totalProductDiv = document.createElement("div");
  totalProductDiv.classList.add("report-total");
  totalProductDiv.innerHTML = `<strong>Tổng xuất kho (${displayDate}):</strong><ul>${totalProductText || "<li>Không có</li>"}</ul>`;
  productContainer.appendChild(totalProductDiv);
}

// Hiển thị danh sách sản phẩm
function renderReportProductList() {
  const productList = document.getElementById("report-product-list");
  if (!productList) return;

  productList.innerHTML = getInventoryData().map(item => `
    <div class="product-item" data-product-id="${item.id}">
      <span class="product-name">${item.name} (Tồn: ${item.quantity})</span>
      <button class="minus" onclick="decrementProductCount('${item.id}')">-</button>
      <span class="quantity">0</span>
    </div>`).join("");
}

// Tăng số lượng sản phẩm
function incrementProductCount(productId) {
  const productItem = document.querySelector(`.product-item[data-product-id="${productId}"]`);
  if (!productItem) return;

  const quantitySpan = productItem.querySelector(".quantity");
  const currentQuantity = parseInt(quantitySpan.textContent) || 0;
  const inventoryItem = getInventoryData().find(item => item.id === productId);
  if (!inventoryItem || currentQuantity >= inventoryItem.quantity) {
    alert("Không đủ hàng trong kho!");
    return;
  }
  quantitySpan.textContent = currentQuantity + 1;
}

// Giảm số lượng sản phẩm
function decrementProductCount(productId) {
  const productItem = document.querySelector(`.product-item[data-product-id="${productId}"]`);
  if (!productItem) return;

  const quantitySpan = productItem.querySelector(".quantity");
  const currentQuantity = parseInt(quantitySpan.textContent) || 0;
  if (currentQuantity > 0) {
    quantitySpan.textContent = currentQuantity - 1;
  }
}

// Chỉnh sửa sản phẩm trong báo cáo
function editReportProduct(reportId, productId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products?.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const newQuantity = prompt("Chỉnh sửa số lượng:", product.quantity);
  if (!newQuantity || isNaN(newQuantity) || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const updatedQuantity = parseInt(newQuantity);
  const inventoryItem = getInventoryData().find(item => item.id === productId);
  if (updatedQuantity > inventoryItem.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products.map(p => 
    p.productId === productId ? { ...p, quantity: updatedQuantity } : p
  ).filter(p => p.quantity > 0);
  db.ref("reports/" + reportId).update({ products: updatedProducts })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã cập nhật sản phẩm!");
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
}

// Xóa sản phẩm trong báo cáo
function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm này khỏi báo cáo?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const updatedProducts = report.products?.filter(p => p.productId !== productId) || [];
  db.ref("reports/" + reportId).update({ products: updatedProducts })
    .then(() => {
      renderFilteredReports(getReportData());
      alert("Đã xóa sản phẩm!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

// Lọc báo cáo
function applyFilter() {
  const filterRange = document.getElementById("filter-range")?.value;
  if (!filterRange) {
    renderFilteredReports(getReportData());
    return;
  }
  const [start, end] = filterRange.split(" - ");
  const startDate = start ? new Date(start.split("/").reverse().join("-")).toISOString().split("T")[0] : null;
  const endDate = end ? new Date(end.split("/").reverse().join("-")).toISOString().split("T")[0] : startDate;
  renderFilteredReports(getReportData(), null, startDate, endDate);
}