// File: js/revenue-expense.js
function applyFilter() {
  const filterRange = document.getElementById("filter-range").value;
  let filteredReports = getReportData();

  if (filterRange) {
    const [startDate, endDate] = filterRange.split(" to ");
    if (startDate) {
      renderFilteredReports(filteredReports, null, startDate, endDate || startDate); // Hỗ trợ ngày hiện tại
    } else {
      alert("Vui lòng chọn ngày bắt đầu!");
      renderFilteredReports(filteredReports);
    }
  } else {
    renderFilteredReports(filteredReports);
  }
}
function submitReport() {
  const openingBalance = parseFloat(document.getElementById("opening-balance").value) || 0;
  const expenseInput = document.getElementById("expense-input").value.trim();
  const revenue = parseFloat(document.getElementById("revenue").value) || 0;
  const transferAmount = parseFloat(document.getElementById("transfer-amount").value) || 0;
  const closingBalance = document.getElementById("closing-balance").value ? parseFloat(document.getElementById("closing-balance").value) : null;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  const productClickCounts = getProductClickCounts();
  console.log("Product click counts:", productClickCounts);

  const productsReported = Object.keys(productClickCounts).map(productId => {
    const product = getInventoryData().find(p => p.id === productId);
    const quantity = productClickCounts[productId] || 0;
    return quantity > 0 && product ? { productId, name: product.name, quantity, price: product.price || 0 } : null;
  }).filter(p => p !== null);

  console.log("Products reported:", productsReported);

  for (const p of productsReported) {
    const inventoryProduct = getInventoryData().find(prod => prod.id === p.productId);
    if (!inventoryProduct || p.quantity > inventoryProduct.quantity) {
      alert(`Số lượng xuất vượt quá tồn kho cho sản phẩm ${p.name} (Tồn: ${inventoryProduct?.quantity || 0})!`);
      return;
    }
  }

  Promise.all(productsReported.map(p => {
    const product = getInventoryData().find(prod => prod.id === p.productId);
    console.log(`Updating inventory for ${p.name}: ${product.quantity} - ${p.quantity}`);
    return product && p.quantity > 0 ? db.ref("inventory/" + p.productId).update({ quantity: product.quantity - p.quantity }) : Promise.resolve();
  })).then(() => {
    const user = auth.currentUser;
    if (!user) {
      alert("Vui lòng đăng nhập để gửi báo cáo!");
      return;
    }
    const employeeName = user.displayName || user.email.split('@')[0] || 'Nhân viên';

    const reportData = {
      date: new Date().toISOString(),
      employeeId: currentEmployeeId || user.uid,
      employeeName: employeeName,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      transferAmount, // Thêm tiền chuyển khoản
      transferTimestamp: transferAmount > 0 ? new Date().toISOString() : null, // Lưu thời gian nếu có chuyển khoản
      closingBalance,
      remaining: openingBalance + revenue - expenseAmount - (closingBalance || 0),
      cashActual: (openingBalance + revenue - expenseAmount - (closingBalance || 0)) - transferAmount, // Tiền mặt thực tế
      products: productsReported,
      submittedBy: currentEmployeeId || user.uid
    };

    console.log("Report data to be saved:", reportData);

    db.ref("reports").push(reportData)
      .then(snap => {
        setProductClickCounts({});
        loadFirebaseData(() => {
          alert("Báo cáo thành công!");
          document.getElementById("opening-balance").value = "";
          document.getElementById("expense-input").value = "";
          document.getElementById("revenue").value = "";
          document.getElementById("transfer-amount").value = ""; // Xóa input chuyển khoản
          document.getElementById("closing-balance").value = "";
          renderReportProductList();
          renderRevenueExpenseData();
          renderFilteredReports(getReportData());
        });
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
    remaining: report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0),
    cashActual: (report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0)) - (report.transferAmount || 0)
  })
    .then(() => {
      renderRevenueExpenseData();
      renderFilteredReports(getReportData());
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
    remaining: report.openingBalance + report.revenue - 0 - (report.closingBalance || 0),
    cashActual: (report.openingBalance + report.revenue - 0 - (report.closingBalance || 0)) - (report.transferAmount || 0)
  })
    .then(() => {
      renderRevenueExpenseData();
      renderFilteredReports(getReportData());
      alert("Đã xóa chi phí!");
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
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
      renderFilteredReports(getReportData());
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
      const inventoryProduct = globalInventoryData.find(p => p.id === productId);
      if (inventoryProduct) {
        inventoryProduct.quantity = inventoryProduct.quantity + product.quantity - newQuantity;
      }
      renderRevenueExpenseData();
      renderReportProductList();
      renderFilteredReports(getReportData());
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
      if (inventoryProduct) {
        inventoryProduct.quantity += product.quantity;
      }
      renderRevenueExpenseData();
      renderReportProductList();
      renderFilteredReports(getReportData());
      alert("Đã xóa sản phẩm!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

function renderReportProductList() {
  const productListContainer = document.getElementById("report-product-list");
  if (!productListContainer) {
    console.error("Product list container not found");
    return;
  }

  const inventoryData = getInventoryData();
  console.log("Inventory data for product list:", inventoryData);

  const productClickCounts = getProductClickCounts();
  console.log("Product click counts for rendering:", productClickCounts);

  if (!inventoryData || inventoryData.length === 0) {
    productListContainer.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }

  productListContainer.innerHTML = inventoryData.map(product => `
    <div class="product-item">
      <span class="product-name" onclick="incrementProductCount('${product.id}')">${product.name} (Tồn: ${product.quantity})</span>
      <button class="minus" onclick="decrementProductCount('${product.id}')">−</button>
      <span class="quantity">${productClickCounts[product.id] || 0}</span>
    </div>
  `).join("");
}

function incrementProductCount(productId) {
  const product = getInventoryData().find(p => p.id === productId);
  if (!product) {
    console.error("Product not found:", productId);
    return;
  }
  let counts = getProductClickCounts();
  counts[productId] = (counts[productId] || 0) + 1;
  if (counts[productId] > product.quantity) {
    counts[productId] = product.quantity;
    alert("Đã đạt số lượng tối đa trong kho!");
  }
  setProductClickCounts(counts);
  console.log("Updated product click counts:", counts);
  renderReportProductList();
}

function decrementProductCount(productId) {
  const product = getInventoryData().find(p => p.id === productId);
  if (!product) {
    console.error("Product not found:", productId);
    return;
  }
  let counts = getProductClickCounts();
  counts[productId] = (counts[productId] || 0) - 1;
  if (counts[productId] < 0) {
    counts[productId] = 0;
  }
  setProductClickCounts(counts);
  console.log("Updated product click counts:", counts);
  renderReportProductList();
}

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  const transferContainer = document.getElementById("transfer-details");
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!reportContainer || !productContainer || !transferContainer || !summaryContainer) {
    console.error("One or more containers not found");
    return;
  }

  console.log("Inventory data:", getInventoryData());

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
      ? r.products.map(p => {
          console.log("Processing product:", p);
          return {
            index: index + 1,
            reportId: r.id,
            employeeName: r.employeeName || "Không xác định",
            productName: p.name || "Sản phẩm không xác định",
            quantity: p.quantity,
            productId: p.productId,
            date: r.date
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
  let totalTransferAmount = 0; // Khai báo một lần
  const transferTable = document.createElement("table");
  transferTable.classList.add("table-style");
  transferTable.innerHTML = `
    <thead><tr><th>STT</th><th>Giờ</th><th>Số tiền (VND)</th><th>Hành động</th></tr></thead>
    <tbody>${transferReports.map((r, index) => {
      totalTransferAmount += r.transferAmount || 0; // Cộng dồn vào biến duy nhất
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

  // Tóm tắt thu chi (sử dụng totalTransferAmount đã tính)
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

function renderRevenueExpenseSummary() {
  // Hàm này được xử lý trong renderFilteredReports
}

function getInventoryData() { return globalInventoryData; }
function getReportData() { return globalReportData; }
function getEmployeeData() { return globalEmployeeData; }
function getProductClickCounts() { return window.productClickCounts || {}; }
function setProductClickCounts(counts) { window.productClickCounts = counts; }