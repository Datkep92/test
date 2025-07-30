
// revenue-expense.js
// Quản lý báo cáo thu chi và xuất hàng, tối ưu mobile

// Gắn hàm vào window để common.js truy cập
window.renderReportProductList = renderReportProductList;
window.renderFilteredReports = renderFilteredReports;

// Hiển thị form nhập liệu với nút riêng cho mỗi ô
function renderInputForm() {
  const form = document.getElementById("revenue-expense-form");
  if (!form) return;
  form.innerHTML = `
    <div class="input-group">
      <input type="number" id="opening-balance" placeholder="Số dư đầu kỳ" min="0">
      <button onclick="submitField('opening-balance')">Gửi</button>
    </div>
    <div class="input-group">
      <input type="number" id="revenue" placeholder="Doanh thu" min="0">
      <button onclick="submitField('revenue')">Gửi</button>
    </div>
    <div class="input-group">
      <input type="text" id="expense-input" placeholder="Chi phí (VD: 1000000 - Mua hàng)">
      <button onclick="submitField('expense')">Gửi</button>
    </div>
    <div class="input-group">
      <input type="number" id="transfer-amount" placeholder="Chuyển khoản" min="0">
      <button onclick="submitField('transfer')">Gửi</button>
    </div>
    <div class="input-group">
      <input type="number" id="closing-balance" placeholder="Số dư cuối kỳ" min="0">
      <button onclick="submitField('closing-balance')">Gửi</button>
    </div>
  `;
}

// Gửi dữ liệu từng ô nhập liệu


function submitField(field) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      alert("Vui lòng đăng nhập!");
      return;
    }

    const input = document.getElementById(field);
    if (!input || !input.value.trim()) {
      alert("Vui lòng nhập dữ liệu!");
      return;
    }

    if (input.disabled) {
      alert("Đang xử lý, vui lòng chờ!");
      return;
    }
    input.disabled = true;
    setTimeout(() => { input.disabled = false; }, 2000);

    let reportData = {
      date: new Date().toISOString(),
      employeeId: user.uid,
      employeeName: globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định",
      openingBalance: 0,
      revenue: 0,
      expenseAmount: 0,
      closingBalance: 0,
      transferAmount: 0,
      remaining: 0,
      cashActual: 0,
    };
    let details = "";

    if (field === "expense-input") {
      const expenseInput = input.value;
      const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);
      if (expenseAmount < 0) {
        alert("Chi phí không được âm!");
        input.disabled = false;
        return;
      }
      if (expenseAmount > 0 && !expenseNote) {
        alert("Vui lòng nhập ghi chú cho chi phí!");
        input.disabled = false;
        return;
      }
      reportData.expenseAmount = expenseAmount;
      reportData.expenseNote = expenseNote;
      details = `Nhập chi phí: ${expenseAmount.toLocaleString("vi-VN")} VND (${expenseNote})`;
    } else if (field === "transfer-amount") {
      const transferAmount = parseFloat(input.value) || 0;
      if (transferAmount < 0) {
        alert("Số tiền chuyển khoản không được âm!");
        input.disabled = false;
        return;
      }
      reportData.transferAmount = transferAmount;
      reportData.transferTimestamp = transferAmount > 0 ? new Date().toISOString() : null;
      details = `Nhập chuyển khoản: ${transferAmount.toLocaleString("vi-VN")} VND`;
    } else {
      const value = parseFloat(input.value) || 0;
      if (value < 0) {
        alert("Giá trị không được âm!");
        input.disabled = false;
        return;
      }
      const fieldName = field === "opening-balance" ? "openingBalance" : field === "closing-balance" ? "closingBalance" : field.replace("-", "");
      reportData[fieldName] = value;
      details = `Nhập ${field === "opening-balance" ? "số dư đầu kỳ" : field === "closing-balance" ? "số dư cuối kỳ" : field}: ${value.toLocaleString("vi-VN")} VND`;
    }

    // Tính remaining và cashActual dựa trên báo cáo hiện tại
    reportData.remaining = reportData.openingBalance + reportData.revenue - reportData.expenseAmount - reportData.closingBalance;
    reportData.cashActual = reportData.remaining - reportData.transferAmount;

    db.ref("reports").push(reportData).then(() => {
      // Tải lại dữ liệu từ Firebase
      db.ref("reports").once("value").then(snapshot => {
        globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
        logHistory(field === "expense-input" ? "expense" : field, "nhập", details);
        renderFilteredReports(globalReportData);
        renderRevenueExpenseData();
        renderHistory();
        input.value = "";
        alert(`Đã gửi ${field}!`);
      });
    }).catch(err => {
      alert("Lỗi khi gửi báo cáo: " + err.message);
      input.disabled = false;
    });
  });
}

// Gửi báo cáo tồn kho
function submitInventoryReport() {
  auth.onAuthStateChanged(user => {
    if (!user) {
      alert("Vui lòng đăng nhập!");
      return;
    }

    const submitButton = document.querySelector("#revenue-expense button[onclick='submitInventoryReport()']");
    if (submitButton.disabled) {
      alert("Đang xử lý, vui lòng chờ!");
      return;
    }
    submitButton.disabled = true;
    setTimeout(() => { submitButton.disabled = false; }, 2000);

    const products = Array.from(document.querySelectorAll("#report-product-list .product-item"))
      .map(item => {
        const productId = item.dataset.productId;
        const name = item.querySelector(".product-name")?.textContent.split(" (")[0];
        const quantity = parseInt(item.querySelector(".quantity")?.textContent) || 0;
        return quantity > 0 ? { productId, name, quantity } : null;
      })
      .filter(p => p);

    if (!products.length) {
      alert("Vui lòng chọn ít nhất một sản phẩm để xuất!");
      submitButton.disabled = false;
      return;
    }

    const reportData = {
      date: new Date().toISOString(),
      products,
      employeeId: user.uid,
      employeeName: globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định",
      openingBalance: 0,
      revenue: 0,
      expenseAmount: 0,
      closingBalance: 0,
      transferAmount: 0,
      remaining: 0,
      cashActual: 0,
    };
    const details = `Xuất hàng: ${products.map(p => `${p.name} (${p.quantity} đơn vị)`).join(", ")}`;

    db.ref("reports").push(reportData).then(() => {
      Promise.all(
        products.map(p =>
          db.ref(`inventory/${p.productId}`).update({
            quantity: getInventoryData().find(item => item.id === p.productId).quantity - p.quantity
          })
        )
      ).then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          db.ref("inventory").once("value").then(inventorySnapshot => {
            globalInventoryData = Object.entries(inventorySnapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
            logHistory("inventory", "nhập", details);
            renderFilteredReports(globalReportData);
            renderReportProductList();
            renderHistory();
            alert("Báo cáo tồn kho đã được gửi!");
          });
        });
      }).catch(err => {
        alert("Lỗi khi cập nhật tồn kho: " + err.message);
        submitButton.disabled = false;
      });
    }).catch(err => {
      alert("Lỗi khi gửi báo cáo tồn kho: " + err.message);
      submitButton.disabled = false;
    });
  });
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

// Hiển thị danh sách sản phẩm
function renderReportProductList() {
  const productList = document.getElementById("report-product-list");
  if (!productList) return;
  productList.innerHTML = getInventoryData()
    .map(
      item => `
        <div class="product-item" data-product-id="${item.id}">
          <span class="product-name" onclick="incrementProductCount('${item.id}')">${item.name} (Tồn: ${item.quantity})</span>
          <div class="product-controls">
            <button class="minus" onclick="decrementProductCount('${item.id}')">-</button>
            <span class="quantity">0</span>
          </div>
        </div>
      `
    )
    .join("");
}
// Chỉnh sửa chi phí
function editReportExpense(reportId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc chỉnh sửa chi phí:");
  if (note === null) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const before = `${(report.expenseAmount || 0).toLocaleString("vi-VN")} VND (${report.expenseNote || "Không có"})`;
  const newExpense = prompt("Chỉnh sửa chi phí (VND):", report.expenseAmount || 0);
  const newNote = prompt("Chỉnh sửa ghi chú:", report.expenseNote || "");
  if (!newExpense || isNaN(newExpense) || newExpense < 0) {
    alert("Chi phí không hợp lệ!");
    return;
  }
  const updatedExpense = parseFloat(newExpense);
  const after = `${updatedExpense.toLocaleString("vi-VN")} VND (${newNote || "Không có"})`;
  const details = `Sửa chi phí: ${after}`;
  const openingBalance = Number(report.openingBalance) || 0;
  const revenue = Number(report.revenue) || 0;
  const closingBalance = Number(report.closingBalance) || 0;
  const transferAmount = Number(report.transferAmount) || 0;
  db.ref("reports/" + reportId)
    .update({
      expenseAmount: updatedExpense,
      expenseNote: newNote || "",
      remaining: openingBalance + revenue - updatedExpense - closingBalance,
      cashActual: openingBalance + revenue - updatedExpense - closingBalance - transferAmount,
    })
    .then(() => {
      db.ref("reports").once("value").then(snapshot => {
        globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
        logHistory("expense", "sửa", details, note, before, after);
        renderFilteredReports(globalReportData);
        renderHistory();
        alert("Đã cập nhật chi phí!");
      });
    })
    .catch(err => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

// Xóa chi phí
function deleteReportExpense(reportId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc xóa chi phí:");
  if (note === null) return;
  if (!confirm("Xóa chi phí này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const before = `${(report.expenseAmount || 0).toLocaleString("vi-VN")} VND (${report.expenseNote || "Không có"})`;
  const details = `Xóa chi phí: ${before}`;
  const openingBalance = Number(report.openingBalance) || 0;
  const revenue = Number(report.revenue) || 0;
  const closingBalance = Number(report.closingBalance) || 0;
  const transferAmount = Number(report.transferAmount) || 0;
  db.ref("reports/" + reportId)
    .update({
      expenseAmount: 0,
      expenseNote: "",
      remaining: openingBalance + revenue - closingBalance,
      cashActual: openingBalance + revenue - closingBalance - transferAmount,
    })
    .then(() => {
      db.ref("reports").once("value").then(snapshot => {
        globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
        logHistory("expense", "xóa", details, note, before, "Đã xóa");
        renderFilteredReports(globalReportData);
        renderHistory();
        alert("Đã xóa chi phí!");
      });
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
}

// Chỉnh sửa giao dịch chuyển khoản
function editReportTransfer(reportId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc chỉnh sửa chuyển khoản:");
  if (note === null) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const before = `${(report.transferAmount || 0).toLocaleString("vi-VN")} VND`;
  const newAmount = prompt("Chỉnh sửa số tiền chuyển khoản (VND):", report.transferAmount || 0);
  if (!newAmount || isNaN(newAmount) || newAmount < 0) {
    alert("Số tiền không hợp lệ!");
    return;
  }
  const updatedAmount = parseFloat(newAmount);
  const after = `${updatedAmount.toLocaleString("vi-VN")} VND`;
  const details = `Sửa chuyển khoản: ${after}`;
  const openingBalance = Number(report.openingBalance) || 0;
  const revenue = Number(report.revenue) || 0;
  const expenseAmount = Number(report.expenseAmount) || 0;
  const closingBalance = Number(report.closingBalance) || 0;
  db.ref("reports/" + reportId)
    .update({
      transferAmount: updatedAmount,
      transferTimestamp: updatedAmount > 0 ? new Date().toISOString() : null,
      cashActual: openingBalance + revenue - expenseAmount - closingBalance - updatedAmount,
    })
    .then(() => {
      db.ref("reports").once("value").then(snapshot => {
        globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
        logHistory("transfer", "sửa", details, note, before, after);
        renderFilteredReports(globalReportData);
        renderHistory();
        alert("Đã cập nhật giao dịch chuyển khoản!");
      });
    })
    .catch(err => alert("Lỗi khi cập nhật giao dịch: " + err.message));
}

// Xóa giao dịch chuyển khoản
function deleteReportTransfer(reportId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc xóa chuyển khoản:");
  if (note === null) return;
  if (!confirm("Xóa giao dịch chuyển khoản này?")) return;
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const before = `${(report.transferAmount || 0).toLocaleString("vi-VN")} VND`;
  const details = `Xóa chuyển khoản: ${before}`;
  const openingBalance = Number(report.openingBalance) || 0;
  const revenue = Number(report.revenue) || 0;
  const expenseAmount = Number(report.expenseAmount) || 0;
  const closingBalance = Number(report.closingBalance) || 0;
  db.ref("reports/" + reportId)
    .update({
      transferAmount: 0,
      transferTimestamp: null,
      cashActual: openingBalance + revenue - expenseAmount - closingBalance,
    })
    .then(() => {
      db.ref("reports").once("value").then(snapshot => {
        globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
        logHistory("transfer", "xóa", details, note, before, "Đã xóa");
        renderFilteredReports(globalReportData);
        renderHistory();
        alert("Đã xóa giao dịch chuyển khoản!");
      });
    })
    .catch(err => alert("Lỗi khi xóa giao dịch: " + err.message));
}

// Hiển thị dữ liệu thu chi
function renderRevenueExpenseData() {
  const reportContainer = document.getElementById("shared-report-table");
  if (!reportContainer) return;

  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date(today).toLocaleDateString("vi-VN");

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
    <tbody>${displayExpenses
      .map(
        (r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${r.employeeName || "Không xác định"}</td>
        <td>${(r.expenseAmount || 0).toLocaleString("vi-VN")} VND (${r.expenseNote || "Không có"})</td>
        <td><div class="action-buttons">
          <button onclick="editReportExpense('${r.id}')">Sửa</button>
          <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
        </div></td>
      </tr>`
      )
      .join("")}</tbody>`;
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
    displayReports = filteredReports.filter(r => r.date.split("T")[0] === selectedDate);
  } else {
    const today = new Date().toISOString().split("T")[0];
    displayReports = filteredReports.filter(r => r.date.split("T")[0] === today);
  }

  const displayDate = selectedDate
    ? new Date(selectedDate).toLocaleDateString("vi-VN")
    : startDate
    ? `${new Date(startDate).toLocaleDateString("vi-VN")}${
        endDate && endDate !== startDate ? " - " + new Date(endDate).toLocaleDateString("vi-VN") : ""
      }`
    : new Date().toISOString().split("T")[0];

  if (displayReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    transferContainer.innerHTML = `<p>Chưa có giao dịch chuyển khoản trong ${displayDate}.</p>`;
    summaryContainer.innerHTML = `<p>Chưa có tóm tắt thu chi trong ${displayDate}.</p>`;
    renderHistory(startDate, endDate); // Gọi renderHistory
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
    <tbody>${displayExpenses
      .map(
        (r, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${r.employeeName || "Không xác định"}</td>
        <td>${(r.expenseAmount || 0).toLocaleString("vi-VN")} VND (${r.expenseNote || "Không có"})</td>
        <td><div class="action-buttons">
          <button onclick="editReportExpense('${r.id}')">Sửa</button>
          <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
        </div></td>
      </tr>`
      )
      .join("")}</tbody>`;
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
  const productReports = sortedReports
    .flatMap((r, index) =>
      Array.isArray(r.products) && r.products.length > 0
        ? r.products.map(p => ({
            index: index + 1,
            reportId: r.id,
            employeeName: r.employeeName || "Không xác định",
            productName: p.name || "Sản phẩm không xác định",
            quantity: p.quantity,
            productId: p.productId,
            date: r.date,
          }))
        : []
    );
  const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
  const productTable = document.createElement("table");
  productTable.classList.add("table-style");
  productTable.innerHTML = `
    <thead><tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr></thead>
    <tbody>${displayProducts
      .map(
        p => `
      <tr>
        <td>${p.index}</td>
        <td>${p.employeeName}</td>
        <td>${p.productName}</td>
        <td>${p.quantity}</td>
        <td><div class="action-buttons">
          <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
          <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
        </div></td>
      </tr>`
      )
      .join("")}</tbody>`;
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
    <tbody>${transferReports
      .map((r, index) => {
        totalTransferAmount += r.transferAmount || 0;
        return `
      <tr>
        <td>${index + 1}</td>
        <td>${new Date(r.transferTimestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${(r.transferAmount || 0).toLocaleString("vi-VN")}</td>
        <td><div class="action-buttons">
          <button onclick="editReportTransfer('${r.id}')">Sửa</button>
          <button onclick="deleteReportTransfer('${r.id}')">Xóa</button>
        </div></td>
      </tr>`;
      })
      .join("")}</tbody>`;
  transferTable.innerHTML += `
    <tfoot><tr><td colspan="2"><strong>Tổng</strong></td><td><strong>${totalTransferAmount.toLocaleString(
      "vi-VN"
    )} VND</strong></td><td></td></tr></tfoot>`;
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

  const latestOpening = getLatestReport("openingBalance", r => r.openingBalance > 0);
  const latestRevenue = getLatestReport("revenue", r => r.revenue > 0);
  const latestExpense = getLatestReport("expenseAmount", r => r.expenseAmount > 0);
  const latestTransfer = getLatestReport("transferAmount", r => r.transferAmount > 0);
  const latestClosing = getLatestReport("closingBalance", r => r.closingBalance > 0);
  const latestRemaining = getLatestReport("remaining", r => r.remaining !== 0);
  const latestCashActual = getLatestReport("cashActual", r => r.cashActual !== 0);

  const formatTime = date => (date ? new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString("vi-VN")} VND (${formatTime(
    latestOpening.date
  )} NV: ${latestOpening.employeeName})</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString("vi-VN")} VND (${formatTime(latestRevenue.date)} NV: ${
    latestRevenue.employeeName
  })</p>
    <p><strong>Tiền chuyển khoản:</strong> ${totalTransferAmount.toLocaleString("vi-VN")} VND (${formatTime(
    latestTransfer.date
  )} NV: ${latestTransfer.employeeName})</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString("vi-VN")} VND (${formatTime(latestExpense.date)} NV: ${
    latestExpense.employeeName
  })</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString("vi-VN")} VND (${formatTime(
    latestClosing.date
  )} NV: ${latestClosing.employeeName})</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString("vi-VN")} VND (${formatTime(latestRemaining.date)} NV: ${
    latestRemaining.employeeName
  })</p>
    <p><strong>Tiền mặt thực tế:</strong> ${totalCashActual.toLocaleString("vi-VN")} VND (${formatTime(
    latestCashActual.date
  )} NV: ${latestCashActual.employeeName})</p>`;

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

  // Gọi renderHistory để hiển thị lịch sử theo bộ lọc
  renderHistory(startDate, endDate);
}
// Lịch sử nhập/xóa báo cáo
function logHistory(type, action, details = "", note = "", before = "", after = "") {
  auth.onAuthStateChanged(user => {
    if (!user) return;
    const historyData = {
      employeeId: user.uid,
      employeeName: globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định",
      type,
      action,
      details,
      note,
      before, // Trạng thái trước
      after,  // Trạng thái sau
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
    };
    db.ref("history").push(historyData).then(() => {
      if (typeof renderHistory === "function") {
        renderHistory();
      }
    }).catch(err => console.error("Lỗi khi ghi lịch sử:", err));
  });
}

function renderHistory(startDate = null, endDate = null) {
  const historyContainer = document.getElementById("history-table");
  if (!historyContainer) return;

  const today = new Date().toISOString().split("T")[0];
  const displayDate = startDate
    ? `${new Date(startDate).toLocaleDateString("vi-VN")}${
        endDate && endDate !== startDate ? " - " + new Date(endDate).toLocaleDateString("vi-VN") : ""
      }`
    : new Date(today).toLocaleDateString("vi-VN");

  let query = db.ref("history");
  if (startDate) {
    query = query.orderByChild("date").startAt(startDate).endAt(endDate || startDate);
  } else {
    query = query.orderByChild("date").equalTo(today);
  }

  query.once("value").then(snapshot => {
    const history = snapshot.val() || {};
    const historyArray = Object.values(history).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (historyArray.length === 0) {
      historyContainer.innerHTML = `
        <h3>Lịch sử Thao tác (${displayDate})</h3>
        <p>Chưa có thao tác trong khoảng thời gian này.</p>
      `;
      return;
    }

    const isExpanded = isExpandedStates.history || false;
    const displayHistory = isExpanded ? historyArray : historyArray.slice(0, 3);

    historyContainer.innerHTML = `
      <h3>Lịch sử Thao tác (${displayDate})</h3>
      <table class="table-style">
        <thead><tr><th>Giờ</th><th>Nhân viên</th><th>Chi tiết</th><th>Ghi chú</th><th>Trước</th><th>Sau</th></tr></thead>
        <tbody>${displayHistory
          .map(
            h => `
            <tr>
              <td>${new Date(h.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>${h.employeeName || "Không xác định"}</td>
              <td>${h.details || "Không có"}</td>
              <td>${h.note || "Không có"}</td>
              <td>${h.before || "Không có"}</td>
              <td>${h.after || "Không có"}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>
    `;

    if (historyArray.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpanded ? "Thu gọn" : "Hiển thị thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => {
        isExpandedStates.history = !isExpandedStates.history;
        renderHistory(startDate, endDate);
      };
      historyContainer.appendChild(expandBtn);
    }
  }).catch(err => console.error("Lỗi khi tải lịch sử:", err));
}


// Chỉnh sửa sản phẩm trong báo cáo
function editReportProduct(reportId, productId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc chỉnh sửa sản phẩm:");
  if (note === null) return;
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
  const before = `${product.name} (${product.quantity} đơn vị)`;
  const newQuantity = prompt("Chỉnh sửa số lượng:", product.quantity);
  if (!newQuantity || isNaN(newQuantity) || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const updatedQuantity = parseInt(newQuantity);
  const inventoryItem = getInventoryData().find(item => item.id === productId);
  if (!inventoryItem || updatedQuantity > inventoryItem.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products
    .map(p => (p.productId === productId ? { ...p, quantity: updatedQuantity } : p))
    .filter(p => p.quantity > 0);
  const after = `${product.name} (${updatedQuantity} đơn vị)`;
  const details = `Sửa xuất hàng: ${after}`;
  
  db.ref("reports/" + reportId)
    .update({ products: updatedProducts })
    .then(() => {
      const quantityChange = product.quantity - updatedQuantity;
      if (inventoryItem) {
        db.ref(`inventory/${productId}`).update({
          quantity: inventoryItem.quantity + quantityChange
        }).then(() => {
          db.ref("reports").once("value").then(snapshot => {
            globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
            db.ref("inventory").once("value").then(inventorySnapshot => {
              globalInventoryData = Object.entries(inventorySnapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
              logHistory("product", "sửa", details, note, before, after);
              renderFilteredReports(globalReportData);
              renderReportProductList();
              renderHistory();
              alert("Đã cập nhật sản phẩm!");
            });
          });
        });
      } else {
        alert("Không tìm thấy sản phẩm trong tồn kho!");
      }
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
}

// Xóa sản phẩm trong báo cáo
function deleteReportProduct(reportId, productId) {
  const note = prompt("Vui lòng nhập ghi chú cho việc xóa sản phẩm:");
  if (note === null) return;
  if (!confirm("Xóa sản phẩm này khỏi báo cáo?")) return;
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
  const before = `${product.name} (${product.quantity} đơn vị)`;
  const details = `Xóa xuất hàng: ${before}`;
  const updatedProducts = report.products.filter(p => p.productId !== productId);
  
  db.ref("reports/" + reportId)
    .update({ products: updatedProducts })
    .then(() => {
      const inventoryItem = getInventoryData().find(item => item.id === productId);
      if (inventoryItem) {
        db.ref(`inventory/${productId}`).update({
          quantity: inventoryItem.quantity + product.quantity
        }).then(() => {
          db.ref("reports").once("value").then(snapshot => {
            globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
            db.ref("inventory").once("value").then(inventorySnapshot => {
              globalInventoryData = Object.entries(inventorySnapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
              logHistory("product", "xóa", details, note, before, "Đã xóa");
              renderFilteredReports(globalReportData);
              renderReportProductList();
              renderHistory();
              alert("Đã xóa sản phẩm!");
            });
          });
        });
      } else {
        alert("Không tìm thấy sản phẩm trong tồn kho!");
      }
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

// Khởi tạo trang
document.addEventListener("DOMContentLoaded", () => {
  renderInputForm();
  renderReportProductList();
  renderRevenueExpenseData();
  renderFilteredReports(getReportData());
  renderHistory();
  document.getElementById("filter-range")?.addEventListener("change", applyFilter);
  document.getElementById("submit-inventory")?.addEventListener("click", submitInventoryReport);
});
// Mở tab Báo cáo Thu Chi mặc định khi tải trang
window.onload = function() {
  openTabBubble('revenue-expense');
};