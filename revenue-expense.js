// File: js/revenue-expense.js
// Revenue-Expense Tab Functions
// File: js/revenue-expense.js (Chỉ sửa hàm submitReport)
// File: js/revenue-expense.js (Chỉ sửa hàm submitReport)
function submitReport() {
  const openingBalance = parseFloat(document.getElementById("opening-balance").value) || 0;
  const expenseInput = document.getElementById("expense-input").value.trim();
  const revenue = parseFloat(document.getElementById("revenue").value) || 0;
  const closingBalance = document.getElementById("closing-balance").value ? parseFloat(document.getElementById("closing-balance").value) : null;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (openingBalance === 0 && expenseAmount === 0 && revenue === 0 && closingBalance === null && Object.keys(getProductClickCounts()).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin!");
    return;
  }

  const remaining = openingBalance + revenue - expenseAmount - (closingBalance || 0);
  const productsReported = Object.keys(getProductClickCounts()).map(productId => {
    const product = getInventoryData().find(p => p.id === productId);
    const quantity = getProductClickCounts()[productId] || 0;
    return quantity > 0 && product ? { productId, name: product.name, quantity, price: product.price || 0 } : null;
  }).filter(p => p !== null);

  Promise.all(productsReported.map(p => {
    const product = getInventoryData().find(prod => prod.id === p.productId);
    return product && p.quantity > 0 ? db.ref("inventory/" + p.productId).update({ quantity: product.quantity - p.quantity }) : Promise.resolve();
  })).then(() => {
    const user = auth.currentUser;
    if (!user) {
      alert("Vui lòng đăng nhập để gửi báo cáo!");
      return;
    }
    const employee = getEmployeeData().find(e => e.id === currentEmployeeId);
    if (!employee) {
      console.log("Không tìm thấy nhân viên với ID:", currentEmployeeId, "Danh sách employeeData:", getEmployeeData().map(e => e ? e.id : 'undefined'));
      alert(`Không tìm thấy thông tin nhân viên với ID ${currentEmployeeId}! Vui lòng kiểm tra lại dữ liệu hoặc liên hệ quản lý.`);
      return;
    }
    const employeeName = employee.name || (user.displayName || user.email.split('@')[0] || 'Nhân viên');
    const role = employee.role || "employee";

    let reportEmployeeId = currentEmployeeId;
    let reportEmployeeName = employeeName;
    if (role === "manager") {
      const selectEmployee = prompt("Nhập ID nhân viên để báo cáo thay (nhấn Enter để dùng ID hiện tại):");
      if (selectEmployee) {
        const selectedEmployee = getEmployeeData().find(e => e.id === selectEmployee);
        if (selectedEmployee) {
          reportEmployeeId = selectEmployee;
          reportEmployeeName = selectedEmployee.name || "Nhân viên không xác định";
        } else {
          alert(`Không tìm thấy nhân viên với ID ${selectEmployee}! Sẽ dùng ID hiện tại.`);
        }
      }
    }

    const reportData = {
      date: new Date().toISOString(),
      employeeId: reportEmployeeId,
      employeeName: reportEmployeeName,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      closingBalance,
      remaining,
      products: productsReported,
      submittedBy: currentEmployeeId
    };

    db.ref("reports").push(reportData)
      .then(snap => {
        alert("Báo cáo thành công!");
        document.getElementById("opening-balance").value = "";
        document.getElementById("expense-input").value = "";
        document.getElementById("revenue").value = "";
        document.getElementById("closing-balance").value = "";
        setProductClickCounts({});
        renderReportProductList();
        renderRevenueExpenseData();
        renderRevenueExpenseSummary();
      })
      .catch(err => alert("Lỗi khi gửi báo cáo: " + err.message));
  }).catch(err => alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message));
}

function editReportExpense(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newInput = prompt("Chỉnh sửa nội dung chi phí:", `${report.expenseAmount / 1000}k ${report.expenseNote}`);
  if (!newInput) return;
  const { money: newAmount, note: newNote } = parseEntry(newInput);
  db.ref("reports/" + reportId).update({ 
    expenseAmount: newAmount, 
    expenseNote: newNote || "Không có",
    remaining: report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0)
  })
    .then(() => {
      renderRevenueExpenseData();
      renderRevenueExpenseSummary();
      alert("Đã cập nhật chi phí!");
    })
    .catch(err => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

function deleteReportExpense(reportId) {
  if (!confirm("Xóa nội dung chi phí này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  db.ref("reports/" + reportId).update({ 
    expenseAmount: 0, 
    expenseNote: "Không có",
    remaining: report.openingBalance + report.revenue - 0 - (report.closingBalance || 0)
  })
    .then(() => {
      renderRevenueExpenseData();
      renderRevenueExpenseSummary();
      alert("Đã xóa chi phí!");
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
}

function editReportProduct(reportId, productId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const newQuantity = parseInt(prompt("Số lượng mới:", product.quantity));
  if (!newQuantity || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const inventoryProduct = getInventoryData().find(p => p.id === productId);
  if (!inventoryProduct) {
    alert("Sản phẩm không tồn tại trong kho!");
    return;
  }
  if (newQuantity > inventoryProduct.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products.map(p => 
    p.productId === productId ? { ...p, quantity: newQuantity } : p
  );
  Promise.all([
    db.ref("reports/" + reportId).update({ products: updatedProducts }),
    db.ref("inventory/" + productId).update({ quantity: inventoryProduct.quantity + product.quantity - newQuantity })
  ])
    .then(() => {
      renderRevenueExpenseData();
      renderReportProductList();
      alert("Đã cập nhật sản phẩm!");
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
}

function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm xuất hàng này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const updatedProducts = report.products.filter(p => p.productId !== productId);
  const inventoryProduct = getInventoryData().find(p => p.id === productId);
  Promise.all([
    db.ref("reports/" + reportId).update({ products: updatedProducts }),
    inventoryProduct ? db.ref("inventory/" + productId).update({ quantity: inventoryProduct.quantity + product.quantity }) : Promise.resolve()
  ])
    .then(() => {
      renderRevenueExpenseData();
      renderReportProductList();
      alert("Đã xóa sản phẩm!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) return;
  container.innerHTML = "";
  if (getInventoryData().length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  getInventoryData().forEach(item => {
    const clickCount = getProductClickCounts()[item.id] || 0;
    const button = document.createElement("button");
    button.classList.add("product-button");
    button.textContent = `${item.name}: ${clickCount} (Tồn: ${item.quantity})`;
    button.onclick = () => incrementProductCount(item.id);
    container.appendChild(button);
  });
}

function incrementProductCount(productId) {
  const product = getInventoryData().find(p => p.id === productId);
  if (!product) return;
  let counts = getProductClickCounts();
  counts[productId] = (counts[productId] || 0) + 1;
  if (counts[productId] > product.quantity) {
    counts[productId] = product.quantity;
    alert("Đã đạt số lượng tối đa trong kho!");
  }
  setProductClickCounts(counts);
  renderReportProductList();
}

function filterReports() {
  const overlay = document.createElement("div");
  overlay.id = "date-filter-overlay";
  overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;";
  
  const filterBox = document.createElement("div");
  filterBox.style.cssText = "background: white; padding: 20px; border-radius: 5px; width: 300px; text-align: center;";
  
  const singleDateLabel = document.createElement("label");
  singleDateLabel.textContent = "Chọn ngày: ";
  const singleDateInput = document.createElement("input");
  singleDateInput.type = "date";
  singleDateInput.id = "single-filter-date";
  singleDateInput.value = new Date().toISOString().split("T")[0]; // Mặc định là ngày hiện tại
  singleDateInput.max = new Date().toISOString().split("T")[0];

  const rangeDateLabel = document.createElement("label");
  rangeDateLabel.textContent = "Chọn khoảng thời gian: ";
  const startDateInput = document.createElement("input");
  startDateInput.type = "date";
  startDateInput.id = "filter-start-date";
  startDateInput.max = new Date().toISOString().split("T")[0];
  const endDateInput = document.createElement("input");
  endDateInput.type = "date";
  endDateInput.id = "filter-end-date";
  endDateInput.max = new Date().toISOString().split("T")[0];

  const filterBtn = document.createElement("button");
  filterBtn.textContent = "Lọc";
  filterBtn.className = "primary-btn";
  filterBtn.onclick = () => {
    const singleDate = singleDateInput.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    let filteredReports = getReportData();

    if (singleDate) {
      const selectedDate = new Date(singleDate).toISOString().split('T')[0];
      filteredReports = filteredReports.filter(r => r.date.split('T')[0] === selectedDate);
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(singleDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = filteredReports.filter(r => {
        const reportDate = new Date(r.date).getTime();
        return reportDate >= start && reportDate < end;
      });
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(startDate).toLocaleDateString('vi-VN')} - ${new Date(endDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, null, startDate, endDate);
    } else {
      alert("Vui lòng chọn một ngày hoặc khoảng thời gian!");
      return;
    }

    document.body.removeChild(overlay);
  };

  filterBox.appendChild(singleDateLabel);
  filterBox.appendChild(singleDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(rangeDateLabel);
  filterBox.appendChild(startDateInput);
  filterBox.appendChild(endDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(filterBtn);
  filterBox.appendChild(closeBtn);
  overlay.appendChild(filterBox);
  document.body.appendChild(overlay);
}

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  if (!reportContainer || !productContainer) return;

  const today = new Date().toISOString().split("T")[0];
  const displayDate = selectedDate || (startDate && endDate ? `${startDate} - ${endDate}` : new Date(today).toLocaleDateString('vi-VN'));

  if (filteredReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    return;
  }

  const sortedReports = filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));
  let isExpandedFinance = false;
  let isExpandedProduct = false;

  const renderFinanceTable = () => {
    const displayReports = isExpandedFinance ? sortedReports : sortedReports.slice(0, 3);
    const reportTable = document.createElement("table");
    reportTable.classList.add("table-style");
    reportTable.innerHTML = `
      <thead><tr><th>STT</th><th>Tên NV</th><th>Chi phí</th><th>Hành động</th></tr></thead>
      <tbody>${displayReports.map((r, index) => `
        <tr><td>${index + 1}</td><td>${r.employeeName}</td><td>${(r.expenseAmount || 0).toLocaleString('vi-VN')} VND (${r.expenseNote || "Không có"})</td>
        <td><button onclick="editReportExpense('${r.id}')">Sửa</button><button onclick="deleteReportExpense('${r.id}')">Xóa</button></td></tr>`).join("")}</tbody>`;
    reportContainer.innerHTML = `<h3>Danh sách Báo cáo Thu Chi (${displayDate})</h3>`;
    reportContainer.appendChild(reportTable);

    if (sortedReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedFinance ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => { isExpandedFinance = !isExpandedFinance; renderFinanceTable(); };
      reportContainer.appendChild(expandBtn);
    }
  };

  const renderProductTable = () => {
    const productReports = sortedReports.flatMap((r, index) => 
      Array.isArray(r.products) && r.products.length > 0 
        ? r.products.map(p => {
            const inventoryItem = getInventoryData().find(item => item.id === p.productId);
            return {
              index: index + 1,
              reportId: r.id,
              employeeName: r.employeeName,
              productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định",
              quantity: p.quantity,
              productId: p.productId
            };
          })
        : []
    );
    const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
    const productTable = document.createElement("table");
    productTable.classList.add("table-style");
    productTable.innerHTML = `
      <thead><tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr></thead>
      <tbody>${displayProducts.map(p => `
        <tr><td>${p.index}</td><td>${p.employeeName}</td><td>${p.productName}</td><td>${p.quantity}</td>
        <td><button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button><button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button></td></tr>`).join("")}</tbody>`;
    productContainer.innerHTML = `<h3>Danh sách Báo cáo Xuất Hàng (${displayDate})</h3>`;
    productContainer.appendChild(productTable);

    if (productReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedProduct ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => { isExpandedProduct = !isExpandedProduct; renderProductTable(); };
      productContainer.appendChild(expandBtn);
    }
  };

  renderFinanceTable();
  renderProductTable();

  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const finalBalance = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  const totalReportDiv = document.createElement("div");
  totalReportDiv.classList.add("report-total");
  totalReportDiv.innerHTML = `
    <strong>Tổng (${displayDate}):</strong><br>
    Số dư đầu kỳ: ${totalOpeningBalance.toLocaleString('vi-VN')} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND<br>
    Chi phí: ${totalExpense.toLocaleString('vi-VN')} VND<br>
    Số dư cuối kỳ: ${totalClosingBalance.toLocaleString('vi-VN')} VND<br>
    Còn lại: ${finalBalance.toLocaleString('vi-VN')} VND`;
  reportContainer.appendChild(totalReportDiv);

  const productReports = sortedReports.flatMap(r => 
    Array.isArray(r.products) ? r.products.map(p => {
      const inventoryItem = getInventoryData().find(item => item.id === p.productId);
      return { productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định", quantity: p.quantity };
    }) : []
  );
  const totalProductSummary = productReports.reduce((acc, p) => {
    acc[p.productName] = (acc[p.productName] || 0) + p.quantity;
    return acc;
  }, {});
  const totalProductText = Object.entries(totalProductSummary)
    .map(([name, qty]) => {
      const inventoryItem = getInventoryData().find(item => item.name === name);
      const remainingQty = inventoryItem ? inventoryItem.quantity : 0;
      return `${name}: ${qty} (Còn: ${remainingQty})`;
    })
    .join(" - ");

  const totalProductDiv = document.createElement("div");
  totalProductDiv.classList.add("report-total");
  totalProductDiv.innerHTML = `<strong>Tổng xuất kho (${displayDate}):</strong> ${totalProductText || "Không có"}`;
  productContainer.appendChild(totalProductDiv);
}

function renderRevenueExpenseData() {
  const reportTable = document.getElementById("shared-report-table");
  if (!reportTable) {
    console.warn("Container 'shared-report-table' không tồn tại trong DOM.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date(today).toLocaleDateString('vi-VN');

  const todayReports = getReportData().filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  reportTable.innerHTML = `
    <h3>Bảng Báo cáo Thu Chi</h3>
    <table class="table-style">
      <thead><tr><th>Ngày</th><th>Nhân viên</th><th>Doanh thu (VND)</th><th>Chi phí (VND)</th><th>Ghi chú</th></tr></thead>
      <tbody>${todayReports.length > 0
        ? todayReports.map(report => `
          <tr><td>${new Date(report.date).toLocaleDateString('vi-VN')}</td>
          <td>${report.employeeName || "Không xác định"}</td>
          <td>${(report.revenue || 0).toLocaleString('vi-VN')}</td>
          <td>${(report.expenseAmount || 0).toLocaleString('vi-VN')}</td>
          <td>${report.expenseNote || ""}</td></tr>`).join("")
        : `<tr><td colspan="5">Chưa có dữ liệu chi tiết cho ngày ${displayDate}.</td></tr>`}</tbody>
    </table>`;
}
function renderRevenueExpenseSummary() {
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!summaryContainer) {
    console.error("Revenue-expense summary container not found!");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // 2025-07-24
  const displayDate = new Date(today).toLocaleDateString('vi-VN'); // "24/07/2025"

  const todayReports = reportData.filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  // Nếu không có báo cáo, hiển thị thông báo và các giá trị bằng 0
  if (todayReports.length === 0) {
    summaryContainer.innerHTML = `
      <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
      <p>Chưa có dữ liệu thu chi cho ngày ${displayDate}.</p>
      <p><strong>Số dư đầu kỳ:</strong> 0 VND</p>
      <p><strong>Doanh thu:</strong> 0 VND</p>
      <p><strong>Chi phí:</strong> 0 VND</p>
      <p><strong>Số dư cuối kỳ:</strong> 0 VND</p>
      <p><strong>Còn lại:</strong> 0 VND</p>
    `;
    console.log(`No revenue-expense data for ${today}`);
    return;
  }

  const totalOpeningBalance = todayReports.reduce((sum, report) => sum + (Number(report.openingBalance) || 0), 0);
  const totalRevenue = todayReports.reduce((sum, report) => sum + (Number(report.revenue) || 0), 0);
  const totalExpense = todayReports.reduce((sum, report) => sum + (Number(report.expenseAmount) || 0), 0);
  const totalClosingBalance = todayReports.reduce((sum, report) => sum + (Number(report.closingBalance) || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString('vi-VN')} VND</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString('vi-VN')} VND</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString('vi-VN')} VND</p>
  `;
  console.log(`Rendered revenue-expense summary for ${today}, total reports: ${todayReports.length}`);
}

// Helper Functions for Data Access
function getInventoryData() { return globalInventoryData; }
function getReportData() { return globalReportData; }
function getEmployeeData() { return globalEmployeeData; }
function getProductClickCounts() { return window.productClickCounts || {}; }
function setProductClickCounts(counts) { window.productClickCounts = counts; }