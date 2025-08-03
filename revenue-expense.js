
// revenue-expense.js
// Quản lý báo cáo thu chi và xuất hàng, tối ưu mobile

// Gắn hàm vào window để common.js truy cập
window.renderReportProductList = renderReportProductList;
window.renderFilteredReports = renderFilteredReports;
let totalGrabAmount = 0;


// Hiển thị form nhập liệu với nút riêng cho mỗi ô
function renderInputForm() {
  const form = document.getElementById("revenue-expense-form");
  if (!form) return;
  form.innerHTML = `
    <div class="input-group">
      <input type="number" id="opening-balance" placeholder="Dư đầu kỳ" min="0">
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
      <input type="number" id="closing-balance" placeholder="Dư cuối kỳ" min="0">
      <button onclick="submitField('closing-balance')">Gửi</button>
    </div>
  `;
}

function submitField(field) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const input = document.getElementById(field);
    if (!input || !input.value.trim()) {
      showToastNotification("Vui lòng nhập dữ liệu!");
      return;
    }
    if (input.disabled) {
      showToastNotification("Đang xử lý, vui lòng chờ!");
      return;
    }

    input.disabled = true;
    setTimeout(() => { input.disabled = false; }, 2000);

    let reportData = {
      date: new Date().toISOString(),
      employeeId: user.uid,
      employeeName,
      openingBalance: 0,
      revenue: 0,
      expenseAmount: 0,
      closingBalance: 0,
      transferAmount: 0,
      grabAmount: 0,
      remaining: 0,
      cashActual: 0,
      history: []
    };

    let details = "";
    let afterValue = "";

    const today = new Date().toISOString().split("T")[0];
    const existingReport = globalReportData.find(r => r.date.split("T")[0] === today && r[field.replace("-", "")] > 0);

    if (field === "expense-input") {
      const { money: expenseAmount, note: expenseNote } = parseEntry(input.value);
      if (expenseAmount < 0 || (expenseAmount > 0 && !expenseNote)) {
        showToastNotification("Vui lòng nhập đúng chi phí và ghi chú!");
        input.disabled = false;
        return;
      }
      reportData.expenseAmount = expenseAmount;
      reportData.expenseNote = expenseNote;
      details = `Nhập chi phí: ${expenseAmount.toLocaleString("vi-VN")} VND (${expenseNote})`;
      afterValue = `${expenseAmount.toLocaleString("vi-VN")} VND (${expenseNote})`;
      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: `Nhập chi phí: ${afterValue}`
      });
    } else if (field === "transfer-amount") {
      const amount = parseFloat(input.value) || 0;
      if (amount < 0) {
        showToastNotification("Số tiền không được âm!");
        input.disabled = false;
        return;
      }
      const realAmount = amount * 1000;
      reportData.transferAmount = realAmount;
      reportData.grabAmount = 0;
      reportData.transferTimestamp = realAmount > 0 ? new Date().toISOString() : null;
      details = `Nhập chuyển khoản: ${realAmount.toLocaleString("vi-VN")} VND`;
      afterValue = `${realAmount.toLocaleString("vi-VN")} VND`;
      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: `Nhập chuyển khoản: ${afterValue}`
      });
    } else if (field === "grab-amount") {
      const amount = parseFloat(input.value) || 0;
      if (amount < 0) {
        showToastNotification("Số tiền Grab không được âm!");
        input.disabled = false;
        return;
      }
      const realAmount = amount * 1000;
      reportData.grabAmount = realAmount;
      reportData.transferAmount = 0;
      reportData.grabTimestamp = realAmount > 0 ? new Date().toISOString() : null;
      details = `Nhập Grab: ${realAmount.toLocaleString("vi-VN")} VND`;
      afterValue = `${realAmount.toLocaleString("vi-VN")} VND`;
      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: `Nhập Grab: ${afterValue}`
      });
    } else {
      const value = parseFloat(input.value) || 0;
      if (value < 0) {
        showToastNotification("Giá trị không được âm!");
        input.disabled = false;
        return;
      }
      const realValue = value * 1000;
      const fieldName = field === "opening-balance" ? "openingBalance"
                        : field === "closing-balance" ? "closingBalance"
                        : field.replace("-", "");

      if (fieldName === "revenue" && existingReport) {
        // Cộng dồn doanh thu nếu đã có trong ngày
        reportData.revenue = (existingReport.revenue || 0) + realValue;
        details = `Nhập ${field}: ${realValue.toLocaleString("vi-VN")} VND (tổng: ${reportData.revenue.toLocaleString("vi-VN")} VND)`;
        afterValue = `${realValue.toLocaleString("vi-VN")} VND (tổng: ${reportData.revenue.toLocaleString("vi-VN")} VND)`;
      } else {
        reportData[fieldName] = realValue;
        details = `Nhập ${field}: ${realValue.toLocaleString("vi-VN")} VND`;
        afterValue = `${realValue.toLocaleString("vi-VN")} VND`;
      }

      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: `Nhập ${field}: ${afterValue}`
      });
    }

    reportData.remaining = reportData.openingBalance + reportData.revenue - reportData.expenseAmount - reportData.closingBalance;
    reportData.cashActual = reportData.remaining - reportData.transferAmount - reportData.grabAmount;

    const saveData = (refId) => {
      db.ref(refId).update(reportData).then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory(
            field,
            existingReport ? "cập nhật" : "nhập",
            details,
            "",
            existingReport?.[field.replace("-", "")]?.toLocaleString("vi-VN") || "",
            afterValue
          );
          renderFilteredReports(globalReportData);
          renderRevenueExpenseData();
          renderHistory();
          input.value = "";
          const label = field === "expense-input" ? "chi phí"
                      : field === "transfer-amount" ? "chuyển khoản"
                      : field === "grab-amount" ? "Grab"
                      : field === "opening-balance" ? "số dư đầu kỳ"
                      : field === "closing-balance" ? "số dư cuối kỳ"
                      : field;
          const action = existingReport ? "Cập nhật" : "Đã nhập";
          showToastNotification(`${action} ${label}: ${afterValue}`);
        });
      }).catch(err => {
        showToastNotification("Lỗi khi cập nhật báo cáo: " + err.message);
        input.disabled = false;
      });
    };

    if (existingReport && field !== "expense-input") {
      saveData("reports/" + existingReport.id);
    } else {
      db.ref("reports").push(reportData).then(ref => saveData("reports/" + ref.key));
    }
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
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền chỉnh sửa báo cáo này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do chỉnh sửa:", report.note || "");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do chỉnh sửa không được để trống!");
      return;
    }
    const before = `${(report.expenseAmount || 0).toLocaleString("vi-VN")} VND (${report.expenseNote || "Không có"})`;
    const newExpense = prompt("Chỉnh sửa chi phí (VND):", report.expenseAmount || 0);
    const newNote = prompt("Chỉnh sửa ghi chú:", report.expenseNote || "");
    if (!newExpense || isNaN(newExpense) || newExpense < 0) {
      showToastNotification("Chi phí không hợp lệ!");
      return;
    }
    const updatedExpense = parseFloat(newExpense);
    const after = `${updatedExpense.toLocaleString("vi-VN")} VND (${newNote || "Không có"})`;
    const details = `Sửa chi phí: ${after}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Sửa chi phí: ${after}`
    });

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
        history: report.history,
        before,
        after,
        note
      })
      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("expense", "sửa", details, note, before, after, reportId);
          renderFilteredReports(globalReportData);
          renderHistory();
          closeModal("history-details-modal");
          showToastNotification("Đã cập nhật chi phí!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật chi phí: " + err.message));
  });
}

// Xóa chi phí
function deleteReportExpense(reportId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền xóa báo cáo này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do xóa:");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do xóa không được để trống!");
      return;
    }
    if (!confirm("Xóa chi phí này?")) return;
    const before = `${(report.expenseAmount || 0).toLocaleString("vi-VN")} VND (${report.expenseNote || "Không có"})`;
    const details = `Xóa chi phí: ${before}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Xóa chi phí: ${before}`
    });

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
        history: report.history,
        before,
        after: `Đã xóa: ${before}`,
        note,
        isDeleted: true
      })
      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("expense", "xóa", details, note, before, "Đã xóa");
          renderFilteredReports(globalReportData);
          renderHistory();
          closeModal("history-details-modal");
          showToastNotification("Đã xóa chi phí!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi xóa chi phí: " + err.message));
  });
}

// Chỉnh sửa giao dịch chuyển khoản
function editReportTransfer(reportId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền chỉnh sửa giao dịch này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do chỉnh sửa:", report.note || "");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do chỉnh sửa không được để trống!");
      return;
    }
    const before = `${(report.transferAmount || report.grabAmount || 0).toLocaleString("vi-VN")} VND (${report.transferAmount > 0 ? "CK" : "Grab"})`;
    const newAmount = prompt("Chỉnh sửa số tiền chuyển khoản (VND):", (report.transferAmount || report.grabAmount || 0) / 1000);
    if (!newAmount || isNaN(newAmount) || newAmount < 0) {
      showToastNotification("Số tiền không hợp lệ!");
      return;
    }
    const updatedAmount = parseFloat(newAmount) * 1000;
    const after = `${updatedAmount.toLocaleString("vi-VN")} VND (${report.transferAmount > 0 ? "CK" : "Grab"})`;
    const details = `Sửa ${report.transferAmount > 0 ? "chuyển khoản" : "Grab"}: ${after}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Sửa ${report.transferAmount > 0 ? "chuyển khoản" : "Grab"}: ${after}`
    });

    const openingBalance = Number(report.openingBalance) || 0;
    const revenue = Number(report.revenue) || 0;
    const expenseAmount = Number(report.expenseAmount) || 0;
    const closingBalance = Number(report.closingBalance) || 0;

    const updateData = report.transferAmount > 0
      ? {
          transferAmount: updatedAmount,
          grabAmount: 0,
          transferTimestamp: updatedAmount > 0 ? new Date().toISOString() : null,
          history: report.history,
          before,
          after,
          note
        }
      : {
          grabAmount: updatedAmount,
          transferAmount: 0,
          transferTimestamp: updatedAmount > 0 ? new Date().toISOString() : null,
          history: report.history,
          before,
          after,
          note
        };

    db.ref("reports/" + reportId)
      .update({
        ...updateData,
        cashActual: openingBalance + revenue - expenseAmount - closingBalance - updatedAmount
      })
      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("transfer", "sửa", details, note, before, after);
          renderFilteredReports(globalReportData);
          renderHistory();
          closeModal("history-details-modal");
          showToastNotification("Đã cập nhật chuyển khoản!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật giao dịch: " + err.message));
  });
}
// Xóa giao dịch chuyển khoản
function deleteReportTransfer(reportId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền xóa giao dịch này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do xóa:");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do xóa không được để trống!");
      return;
    }
    if (!confirm("Xóa giao dịch chuyển khoản này?")) return;
    const before = `${(report.transferAmount || report.grabAmount || 0).toLocaleString("vi-VN")} VND (${report.transferAmount > 0 ? "CK" : "Grab"})`;
    const details = `Xóa ${report.transferAmount > 0 ? "chuyển khoản" : "Grab"}: ${before}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Xóa ${report.transferAmount > 0 ? "chuyển khoản" : "Grab"}: ${before}`
    });

    const openingBalance = Number(report.openingBalance) || 0;
    const revenue = Number(report.revenue) || 0;
    const expenseAmount = Number(report.expenseAmount) || 0;
    const closingBalance = Number(report.closingBalance) || 0;

    db.ref("reports/" + reportId)
      .update({
        transferAmount: 0,
        grabAmount: 0,
        transferTimestamp: null,
        cashActual: openingBalance + revenue - expenseAmount - closingBalance,
        history: report.history,
        before,
        after: `Đã xóa: ${before}`,
        note,
        isDeleted: true
      })
      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("transfer", "xóa", details, note, before, "Đã xóa");
          renderFilteredReports(globalReportData);
          renderHistory();
          closeModal("history-details-modal");
          showToastNotification("Đã xóa chuyển khoản!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi xóa giao dịch: " + err.message));
  });
}

function renderRevenueExpenseData() {
  const reportContainer = document.getElementById("shared-report-table");
  if (!reportContainer) {
    console.warn("Container 'shared-report-table' không tồn tại trong DOM.");
    return;
  }

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

  const expenseReports = todayReports
    .filter(r => r.expenseAmount > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const isExpanded = isExpandedStates.revenueExpenseData ?? false;
  const displayExpenses = isExpanded ? expenseReports : expenseReports.slice(0, 3);

  const reportTable = document.createElement("table");
  reportTable.classList.add("table-style");
  reportTable.innerHTML = `
    <thead><tr><th>STT</th><th>Tên NV</th><th>Chi phí</th></tr></thead>
    <tbody>${displayExpenses
      .map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.employeeName || "Không xác định"}</td>
          <td onclick="showReportDetails('${r.id}')">${(r.expenseAmount || 0).toLocaleString("vi-VN")} VND (${r.expenseNote || "Không có"})</td>
        </tr>`)
      .join("")}
    </tbody>
  `;

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

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  const transferContainer = document.getElementById("transfer-details");
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!reportContainer || !productContainer || !transferContainer || !summaryContainer) {
    console.warn("Một hoặc nhiều container không tồn tại trong DOM.");
    return;
  }

  let displayReports = filteredReports || globalReportData || [];
  if (startDate) {
    displayReports = displayReports.filter(r => {
      const reportDate = new Date(r.date).toISOString().split("T")[0];
      return reportDate >= startDate && reportDate <= (endDate || startDate);
    });
  } else if (selectedDate) {
    displayReports = displayReports.filter(r => r.date.split("T")[0] === selectedDate);
  } else {
    const today = new Date().toISOString().split("T")[0];
    displayReports = displayReports.filter(r => r.date.split("T")[0] === today);
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
    renderHistory(startDate, endDate);
    return;
  }

  const sortedReports = displayReports.sort((a, b) => new Date(b.date) - new Date(a.date));
  const isExpandedFinance = isExpandedStates.filteredReportsFinance ?? false;
  const isExpandedProduct = isExpandedStates.filteredReportsProduct ?? false;
  const isExpandedTransfer = isExpandedStates.transferReports ?? false;

  // Xác định trạng thái và màu sắc cho cột cuối
  const getStatusDisplay = (r, field) => {
    if (r.approvalStatus === "pending") {
      return `<span style="color: #6c757d;">[Đang chờ]</span>`;
    } else if (r.approvalStatus === "approved" && r.action === "sửa" && field === (r.expenseAmount ? "expense" : "transfer")) {
      return `<span style="color: #dc3545;">[Đã sửa]</span>`;
    } else if (r.approvalStatus === "approved" && r.action === "xóa" && field === (r.expenseAmount ? "expense" : "transfer")) {
      return `<span style="color: #dc3545;">[Đã xóa]</span>`;
    } else if (r.approvalStatus === "rejected") {
      return `<span style="color: #007bff;">[Bị từ chối]</span>`;
    }
    return "";
  };

  // Bảng Báo cáo Thu Chi
  const expenseReports = sortedReports.filter(r => r.expenseAmount > 0 || (r.approvalStatus === "pending" && r.before?.includes("VND")) || (r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND")));
  const displayExpenses = isExpandedFinance ? expenseReports : expenseReports.slice(0, 3);
  reportContainer.innerHTML = `
    <h3>Bảng Báo cáo Thu Chi (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Chi phí</th>
        </tr>
      </thead>
      <tbody>
        ${displayExpenses
          .map(
            (r, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${new Date(r.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>${r.employeeName || "Không xác định"}</td>
              <td onclick="showReportDetails('${r.id}')">${(r.approvalStatus === "pending" || (r.approvalStatus === "approved" && r.action === "xóa")) && r.before ? r.before : (r.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (r.expenseNote || "Không có") + ")"} ${getStatusDisplay(r, "expense")}</td>
            </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Tổng: ${expenseReports.reduce((sum, r) => sum + getAmountForTotal(r, "expense"), 0).toLocaleString("vi-VN")} VND</strong></td>
        </tr>
      </tfoot>
    </table>
    ${expenseReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsFinance = !isExpandedStates.filteredReportsFinance; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedFinance ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (expenseReports.length === 0) {
    reportContainer.innerHTML += `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
  }

  // Bảng Báo cáo Xuất Hàng (giữ nguyên)
  const productReports = sortedReports
    .flatMap((r, index) =>
      Array.isArray(r.products) && r.products.length > 0
        ? r.products.map(p => ({
            index: index + 1,
            reportId: r.id,
            employeeName: r.employeeName || "Không xác định",
            productName: p.name || "Sản phẩm không xác định",
            quantity: p.quantity || 0,
            productId: p.productId,
            date: r.date,
          }))
        : []
    );
  const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
  productContainer.innerHTML = `
    <h3>Bảng Báo cáo Xuất Hàng (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Tên hàng hóa</th>
          <th>Số lượng</th>
        </tr>
      </thead>
      <tbody>
        ${displayProducts
          .map(
            p => `
            <tr>
              <td>${p.index}</td>
              <td>${new Date(p.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>${p.employeeName}</td>
              <td>${p.productName}</td>
              <td>${p.quantity}</td>
            </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5"><strong>Tổng: ${productReports.reduce((sum, p) => sum + (p.quantity || 0), 0)} đơn vị</strong></td>
        </tr>
      </tfoot>
    </table>
    ${productReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsProduct = !isExpandedStates.filteredReportsProduct; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedProduct ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (productReports.length === 0) {
    productContainer.innerHTML += `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
  }

   // Bảng Chi tiết Giao dịch Chuyển khoản
  const transferReports = sortedReports.filter(r => 
    r.transferAmount > 0 || 
    r.grabAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.match(/CK|Grab/)) || 
    ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.match(/CK|Grab/)) || r.isDeleted)
  );
  let totalTransferAmount = 0;
  let totalGrabAmount = 0;
  const displayTransfers = isExpandedTransfer ? transferReports : transferReports.slice(0, 3);
  transferContainer.innerHTML = `
    <h3>Chi tiết Giao dịch Chuyển khoản (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Số tiền</th>
        </tr>
      </thead>
      <tbody>
        ${displayTransfers
          .map((r, index) => {
            // Chỉ tính tổng cho dòng không bị xóa và không đang chờ
            if (!r.isDeleted && r.approvalStatus !== "pending") {
              totalTransferAmount += r.transferAmount || 0;
              totalGrabAmount += r.grabAmount || 0;
            } else if (r.approvalStatus === "pending" && r.before?.match(/CK|Grab/)) {
              const match = r.before.match(/([\d,]+) VND/);
              const amountValue = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
              totalTransferAmount += r.before.includes("CK") ? amountValue : 0;
              totalGrabAmount += r.before.includes("Grab") ? amountValue : 0;
            }
            const amount = (r.isDeleted || (r.approvalStatus === "approved" && r.action === "xóa")) && r.before?.match(/CK|Grab/)
              ? r.before
              : (r.approvalStatus === "pending" && r.before?.match(/CK|Grab/)
                ? r.before
                : (r.transferAmount > 0
                  ? `CK: ${(r.transferAmount || 0).toLocaleString("vi-VN")} VND`
                  : `Grab: ${(r.grabAmount || 0).toLocaleString("vi-VN")} VND`));
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(r.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>${r.employeeName || "Không xác định"}</td>
                <td onclick="showTransferDetails('${r.id}')">${amount} ${getStatusDisplay(r, "transfer")}</td>
              </tr>`;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Tổng: Grab: ${totalGrabAmount.toLocaleString("vi-VN")} VND, CK: ${totalTransferAmount.toLocaleString("vi-VN")} VND</strong></td>
        </tr>
      </tfoot>
    </table>
    ${transferReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.transferReports = !isExpandedStates.transferReports; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedTransfer ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (transferReports.length === 0) {
    transferContainer.innerHTML += `<p>Chưa có giao dịch chuyển khoản trong ${displayDate}.</p>`;
  }

  // Tóm tắt Thu Chi
  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + getAmountForTotal(r, "expense"), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;
  const totalCashActual = totalRemaining - totalTransferAmount - totalGrabAmount;

  const getLatestReport = (field, condition) => {
    const validReports = sortedReports.filter(condition).sort((a, b) => new Date(b.date) - new Date(a.date));
    return validReports[0] || { employeeName: "Không xác định", date: null };
  };
  const latestOpening = getLatestReport("openingBalance", r => r.openingBalance > 0);
  const latestRevenue = getLatestReport("revenue", r => r.revenue > 0);
  const latestExpense = getLatestReport("expenseAmount", r => r.expenseAmount > 0 || (r.approvalStatus === "pending" && r.before?.includes("VND")) || (r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND")));
  const latestTransfer = getLatestReport("transferAmount", r => r.transferAmount > 0 || r.grabAmount > 0 || (r.approvalStatus === "pending" && r.before?.includes("VND")));
  const latestGrab = getLatestReport("grabAmount", r => r.grabAmount > 0 || (r.approvalStatus === "pending" && r.before?.includes("Grab")));
  const latestClosing = getLatestReport("closingBalance", r => r.closingBalance > 0);
  const latestRemaining = getLatestReport("remaining", r => r.remaining !== 0);
  const latestCashActual = getLatestReport("cashActual", r => r.cashActual !== 0);

  const formatTime = date => (date ? new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString("vi-VN")} VND (${formatTime(latestOpening.date)} NV: ${latestOpening.employeeName})</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString("vi-VN")} VND (${formatTime(latestRevenue.date)} NV: ${latestRevenue.employeeName})</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString("vi-VN")} VND (${formatTime(latestExpense.date)} NV: ${latestExpense.employeeName})</p>
    <p><strong>Tiền chuyển khoản:</strong> ${totalTransferAmount.toLocaleString("vi-VN")} VND (${formatTime(latestTransfer.date)} NV: ${latestTransfer.employeeName})</p>
    <p><strong>Tiền Grab:</strong> ${totalGrabAmount.toLocaleString("vi-VN")} VND (${formatTime(latestGrab.date)} NV: ${latestGrab.employeeName})</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString("vi-VN")} VND (${formatTime(latestClosing.date)} NV: ${latestClosing.employeeName})</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString("vi-VN")} VND (${formatTime(latestRemaining.date)} NV: ${latestRemaining.employeeName})</p>
    <p><strong>Tiền mặt thực tế:</strong> ${totalCashActual.toLocaleString("vi-VN")} VND (${formatTime(latestCashActual.date)} NV: ${latestCashActual.employeeName})</p>
  `;
}

function getAmountForTotal(r, field) {
  // Loại bỏ dòng đã xóa khỏi tổng
  if (r.isDeleted || (r.approvalStatus === "approved" && r.action === "xóa")) {
    return 0;
  }
  // Xử lý dòng đang chờ duyệt với giá trị before
  if (r.approvalStatus === "pending" && r.before && r.before.includes("VND")) {
    const match = r.before.match(/([\d,]+) VND/);
    if (field === "expense" && match) {
      return parseFloat(match[1].replace(/,/g, "")) || 0;
    } else if (field === "transfer" && match) {
      return parseFloat(match[1].replace(/,/g, "")) || 0;
    }
  }
  // Xử lý dòng bình thường
  if (field === "expense") return r.expenseAmount || 0;
  if (field === "transfer") return (r.transferAmount || 0) + (r.grabAmount || 0);
  return 0;
}

function logHistory(type, action, details = "", note = "", before = "", after = "") {
  if (!type || !action || !details) {
    console.warn("Thiếu thông tin cần thiết để ghi lịch sử:", { type, action, details });
    return;
  }
  auth.onAuthStateChanged(user => {
    if (!user) return;
    const historyData = {
      employeeId: user.uid,
      employeeName: globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định",
      type,
      action,
      details,
      note,
      before,
      after: after || details, // Sử dụng details nếu after rỗng
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

function showReportDetails(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    showToastNotification("Không tìm thấy báo cáo!");
    return;
  }
  const modal = document.getElementById("history-details-modal") || document.createElement("div");
  modal.id = "history-details-modal";
  modal.className = "modal";

  const isManager = isCurrentUserManager();
  const isOwner = report.employeeId === currentEmployeeId;
  const canEdit = isManager || isOwner;

  let historyHtml = report.history?.map((entry, index) => 
    `Lần ${index + 1}: ${new Date(entry.timestamp).toLocaleString("vi-VN")} - ${entry.employeeName} - ${entry.action}`
  ).join('<br>') || 'Chưa có lịch sử';

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Chi tiết báo cáo thu chi</h3>
      <p><strong>Nhân viên:</strong> ${report.employeeName || "Không xác định"}</p>
      <p><strong>Thời gian:</strong> ${new Date(report.date).toLocaleString("vi-VN")}</p>
      <p><strong>Nội dung ban đầu:</strong> <span style="color: #6c757d;">${report.before || (report.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (report.expenseNote || "Không có") + ")"}</span></p>
      <p><strong>Nội dung sau khi sửa:</strong> <span style="color: #dc3545;">${report.after || (report.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (report.expenseNote || "Không có") + ")"}</span></p>
      <p><strong>Ghi chú:</strong> ${report.note || "Không có"}</p>
      <h4>Lịch sử chỉnh sửa/xóa</h4>
      <div>${historyHtml}</div>
      <div class="action-buttons">
        ${canEdit ? `<button style="color: #6c757d;" onclick="editReportExpense('${reportId}')">[Sửa]</button>` : ""}
        ${canEdit ? `<button style="color: #6c757d;" onclick="deleteReportExpense('${reportId}')">[Xóa]</button>` : ""}
        <button onclick="closeModal('history-details-modal')">[Đóng]</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "block";
}

function showTransferDetails(reportId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    showToastNotification("Không tìm thấy giao dịch!");
    return;
  }
  const modal = document.getElementById("history-details-modal") || document.createElement("div");
  modal.id = "history-details-modal";
  modal.className = "modal";

  const isManager = isCurrentUserManager();
  const isOwner = report.employeeId === currentEmployeeId;
  const canEdit = isManager || isOwner;

  let historyHtml = report.history?.map((entry, index) => 
    `Lần ${index + 1}: ${new Date(entry.timestamp).toLocaleString("vi-VN")} - ${entry.employeeName} - ${entry.action}`
  ).join('<br>') || 'Chưa có lịch sử';

  const amount = report.transferAmount > 0 ? `CK: ${(report.transferAmount || 0).toLocaleString("vi-VN")} VND` : `Grab: ${(report.grabAmount || 0).toLocaleString("vi-VN")} VND`;
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Chi tiết giao dịch</h3>
      <p><strong>Nhân viên:</strong> ${report.employeeName || "Không xác định"}</p>
      <p><strong>Thời gian:</strong> ${new Date(report.date).toLocaleString("vi-VN")}</p>
      <p><strong>Nội dung ban đầu:</strong> <span style="color: #6c757d;">${report.before || amount}</span></p>
      <p><strong>Nội dung sau khi sửa:</strong> <span style="color: #dc3545;">${report.after || amount}</span></p>
      <p><strong>Ghi chú:</strong> ${report.note || "Không có"}</p>
      <h4>Lịch sử chỉnh sửa/xóa</h4>
      <div>${historyHtml}</div>
      <div class="action-buttons">
        ${canEdit ? `<button style="color: #6c757d;" onclick="editReportTransfer('${reportId}')">[Sửa]</button>` : ""}
        ${canEdit ? `<button style="color: #6c757d;" onclick="deleteReportTransfer('${reportId}')">[Xóa]</button>` : ""}
        <button onclick="closeModal('history-details-modal')">[Đóng]</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "block";
}

function showReportProductDetails(reportId, productId) {
  const report = getReportData().find(r => r.id === reportId);
  if (!report) {
    showToastNotification("Không tìm thấy báo cáo!");
    return;
  }
  const product = report.products?.find(p => p.productId === productId);
  if (!product) {
    showToastNotification("Không tìm thấy sản phẩm!");
    return;
  }
  const modal = document.getElementById("history-details-modal") || document.createElement("div");
  modal.id = "history-details-modal";
  modal.className = "modal";

  const isManager = isCurrentUserManager();
  const isOwner = report.employeeId === currentEmployeeId;
  const canEdit = isManager || isOwner;

  let historyHtml = report.history?.map((entry, index) => 
    `Lần ${index + 1}: ${new Date(entry.timestamp).toLocaleString("vi-VN")} - ${entry.employeeName} - ${entry.action}`
  ).join('<br>') || 'Chưa có lịch sử';

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Chi tiết xuất hàng</h3>
      <p><strong>Nhân viên:</strong> ${report.employeeName || "Không xác định"}</p>
      <p><strong>Thời gian:</strong> ${new Date(report.date).toLocaleString("vi-VN")}</p>
      <p><strong>Nội dung ban đầu:</strong> <span style="color: #6c757d;">${product.before || `${product.name} (${product.quantity} đơn vị)`}</span></p>
      <p><strong>Nội dung sau khi sửa:</strong> <span style="color: #dc3545;">${product.after || `${product.name} (${product.quantity} đơn vị)`}</span></p>
      <p><strong>Ghi chú:</strong> ${product.note || "Không có"}</p>
      <h4>Lịch sử chỉnh sửa/xóa</h4>
      <div>${historyHtml}</div>
      <div class="action-buttons">
        ${canEdit ? `<button style="color: #6c757d;" onclick="editReportProduct('${reportId}', '${productId}')">[Sửa]</button>` : ""}
        ${canEdit ? `<button style="color: #6c757d;" onclick="deleteReportProduct('${reportId}', '${productId}')">[Xóa]</button>` : ""}
        <button onclick="closeModal('history-details-modal')">[Đóng]</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "block";
}

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  const transferContainer = document.getElementById("transfer-details");
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!reportContainer || !productContainer || !transferContainer || !summaryContainer) {
    console.warn("Một hoặc nhiều container không tồn tại trong DOM.");
    return;
  }

  let displayReports = filteredReports || globalReportData || [];
  if (startDate) {
    displayReports = displayReports.filter(r => {
      const reportDate = new Date(r.date).toISOString().split("T")[0];
      return reportDate >= startDate && reportDate <= (endDate || startDate);
    });
  } else if (selectedDate) {
    displayReports = displayReports.filter(r => r.date.split("T")[0] === selectedDate);
  } else {
    const today = new Date().toISOString().split("T")[0];
    displayReports = displayReports.filter(r => r.date.split("T")[0] === today);
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
    renderHistory(startDate, endDate);
    return;
  }

  const sortedReports = displayReports.sort((a, b) => new Date(b.date) - new Date(a.date));
  const isExpandedFinance = isExpandedStates.filteredReportsFinance ?? false;
  const isExpandedProduct = isExpandedStates.filteredReportsProduct ?? false;
  const isExpandedTransfer = isExpandedStates.transferReports ?? false;

  // Xác định trạng thái và màu sắc cho cột cuối
  const getStatusDisplay = (r, field) => {
    if (r.approvalStatus === "pending") {
      return `<span style="color: #6c757d;">[Đang chờ]</span>`;
    } else if (r.approvalStatus === "approved" && r.action === "sửa" && field === (r.expenseAmount ? "expense" : "transfer")) {
      return `<span style="color: #dc3545;">[Đã sửa]</span>`;
    } else if ((r.approvalStatus === "approved" && r.action === "xóa") || r.isDeleted) {
      return `<span style="color: #dc3545;">[Đã xóa]</span>`;
    } else if (r.approvalStatus === "rejected") {
      return `<span style="color: #007bff;">[Bị từ chối]</span>`;
    }
    return "";
  };

  // Bảng Báo cáo Thu Chi
  const expenseReports = sortedReports.filter(r => 
    r.expenseAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.includes("VND")) || 
    ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND")) || r.isDeleted)
  );
  const displayExpenses = isExpandedFinance ? expenseReports : expenseReports.slice(0, 3);
  reportContainer.innerHTML = `
    <h3>Bảng Báo cáo Thu Chi (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Chi phí</th>
        </tr>
      </thead>
      <tbody>
        ${displayExpenses
          .map(
            (r, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(r.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>${r.employeeName || "Không xác định"}</td>
                <td onclick="showReportDetails('${r.id}')">
                  ${r.isDeleted || (r.approvalStatus === "approved" && r.action === "xóa") ? 
                    r.before : 
                    (r.approvalStatus === "pending" && r.before ? 
                      r.before : 
                      (r.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (r.expenseNote || "Không có") + ")")
                  } ${getStatusDisplay(r, "expense")}
                </td>
              </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Tổng: ${expenseReports.reduce((sum, r) => sum + getAmountForTotal(r, "expense"), 0).toLocaleString("vi-VN")} VND</strong></td>
        </tr>
      </tfoot>
    </table>
    ${expenseReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsFinance = !isExpandedStates.filteredReportsFinance; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedFinance ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (expenseReports.length === 0) {
    reportContainer.innerHTML += `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
  }

  // Bảng Báo cáo Xuất Hàng
  const productReports = sortedReports
    .flatMap((r, index) =>
      Array.isArray(r.products) && r.products.length > 0
        ? r.products.map(p => ({
            index: index + 1,
            reportId: r.id,
            employeeName: r.employeeName || "Không xác định",
            productName: p.name || "Sản phẩm không xác định",
            quantity: p.quantity || 0,
            productId: p.productId,
            date: r.date,
          }))
        : []
    );
  const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
  productContainer.innerHTML = `
    <h3>Bảng Báo cáo Xuất Hàng (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Tên hàng hóa</th>
          <th>Số lượng</th>
        </tr>
      </thead>
      <tbody>
        ${displayProducts
          .map(
            p => `
            <tr>
              <td>${p.index}</td>
              <td>${new Date(p.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
              <td>${p.employeeName}</td>
              <td>${p.productName}</td>
              <td>${p.quantity}</td>
            </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5"><strong>Tổng: ${productReports.reduce((sum, p) => sum + (p.quantity || 0), 0)} đơn vị</strong></td>
        </tr>
      </tfoot>
    </table>
    ${productReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsProduct = !isExpandedStates.filteredReportsProduct; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedProduct ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (productReports.length === 0) {
    productContainer.innerHTML += `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
  }

  // Bảng Chi tiết Giao dịch Chuyển khoản
  const transferReports = sortedReports.filter(r => 
    r.transferAmount > 0 || 
    r.grabAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.includes("VND")) || 
    ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND")) || r.isDeleted)
  );
  let totalTransferAmount = 0;
  let totalGrabAmount = 0;
  const displayTransfers = isExpandedTransfer ? transferReports : transferReports.slice(0, 3);
  transferContainer.innerHTML = `
    <h3>Chi tiết Giao dịch Chuyển khoản (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Số tiền</th>
        </tr>
      </thead>
      <tbody>
        ${displayTransfers
          .map((r, index) => {
            // Không tính tổng cho dòng đã xóa
            if (!r.isDeleted && !(r.approvalStatus === "approved" && r.action === "xóa")) {
              totalTransferAmount += r.transferAmount ? r.transferAmount : 0;
              totalGrabAmount += r.grabAmount ? r.grabAmount : 0;
              if (r.approvalStatus === "pending" && r.before?.includes("VND")) {
                const match = r.before.match(/([\d,]+) VND/);
                const amountValue = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
                totalTransferAmount += r.before.includes("CK") ? amountValue : 0;
                totalGrabAmount += r.before.includes("Grab") ? amountValue : 0;
              }
            }
            const amount = r.isDeleted || (r.approvalStatus === "approved" && r.action === "xóa") 
              ? r.before 
              : (r.approvalStatus === "pending" && r.before?.includes("VND") 
                ? r.before 
                : (r.transferAmount > 0 
                  ? `CK: ${(r.transferAmount || 0).toLocaleString("vi-VN")} VND` 
                  : `Grab: ${(r.grabAmount || 0).toLocaleString("vi-VN")} VND`));
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(r.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>${r.employeeName || "Không xác định"}</td>
                <td onclick="showTransferDetails('${r.id}')">${amount} ${getStatusDisplay(r, "transfer")}</td>
              </tr>`;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Tổng: Grab: ${totalGrabAmount.toLocaleString("vi-VN")} VND, CK: ${totalTransferAmount.toLocaleString("vi-VN")} VND</strong></td>
        </tr>
      </tfoot>
    </table>
    ${transferReports.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.transferReports = !isExpandedStates.transferReports; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">${isExpandedTransfer ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
  if (transferReports.length === 0) {
    transferContainer.innerHTML += `<p>Chưa có giao dịch chuyển khoản trong ${displayDate}.</p>`;
  }

  // Tóm tắt Thu Chi
  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + getAmountForTotal(r, "expense"), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;
  const totalCashActual = totalRemaining - totalTransferAmount - totalGrabAmount;

  const getLatestReport = (field, condition) => {
    const validReports = sortedReports.filter(condition).sort((a, b) => new Date(b.date) - new Date(a.date));
    return validReports[0] || { employeeName: "Không xác định", date: null };
  };
  const latestOpening = getLatestReport("openingBalance", r => r.openingBalance > 0);
  const latestRevenue = getLatestReport("revenue", r => r.revenue > 0);
  const latestExpense = getLatestReport("expenseAmount", r => 
    r.expenseAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.includes("VND")) || 
    ((r.approvalStatus === "approved" && r.action === "xóa") || r.isDeleted)
  );
  const latestTransfer = getLatestReport("transferAmount", r => 
    r.transferAmount > 0 || 
    r.grabAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.includes("VND")) || 
    ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND")) || r.isDeleted)
  );
  const latestGrab = getLatestReport("grabAmount", r => 
    r.grabAmount > 0 || 
    (r.approvalStatus === "pending" && r.before?.includes("Grab")) || 
    ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("Grab")) || r.isDeleted)
  );
  const latestClosing = getLatestReport("closingBalance", r => r.closingBalance > 0);
  const latestRemaining = getLatestReport("remaining", r => r.remaining !== 0);
  const latestCashActual = getLatestReport("cashActual", r => r.cashActual !== 0);

  const formatTime = date => (date ? new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString("vi-VN")} VND (${formatTime(latestOpening.date)} NV: ${latestOpening.employeeName})</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString("vi-VN")} VND (${formatTime(latestRevenue.date)} NV: ${latestRevenue.employeeName})</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString("vi-VN")} VND (${formatTime(latestExpense.date)} NV: ${latestExpense.employeeName})</p>
    <p><strong>Tiền chuyển khoản:</strong> ${totalTransferAmount.toLocaleString("vi-VN")} VND (${formatTime(latestTransfer.date)} NV: ${latestTransfer.employeeName})</p>
    <p><strong>Tiền Grab:</strong> ${totalGrabAmount.toLocaleString("vi-VN")} VND (${formatTime(latestGrab.date)} NV: ${latestGrab.employeeName})</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString("vi-VN")} VND (${formatTime(latestClosing.date)} NV: ${latestClosing.employeeName})</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString("vi-VN")} VND (${formatTime(latestRemaining.date)} NV: ${latestRemaining.employeeName})</p>
    <p><strong>Tiền mặt thực tế:</strong> ${totalCashActual.toLocaleString("vi-VN")} VND (${formatTime(latestCashActual.date)} NV: ${latestCashActual.employeeName})</p>
  `;
}function renderHistory(startDate = null, endDate = null) {
  const historyContainer = document.getElementById("history-table");
  if (!historyContainer) {
    console.warn("Container 'history-table' không tồn tại trong DOM.");
    return;
  }

  let displayHistory = globalHistory || [];
  if (startDate) {
    displayHistory = displayHistory.filter(h => {
      const historyDate = new Date(h.timestamp).toISOString().split("T")[0];
      return historyDate >= startDate && historyDate <= (endDate || startDate);
    });
  } else {
    const today = new Date().toISOString().split("T")[0];
    displayHistory = displayHistory.filter(h => h.timestamp.split("T")[0] === today);
  }

  const displayDate = startDate
    ? `${new Date(startDate).toLocaleDateString("vi-VN")}${
        endDate && endDate !== startDate ? " - " + new Date(endDate).toLocaleDateString("vi-VN") : ""
      }`
    : new Date().toLocaleDateString("vi-VN");

  if (displayHistory.length === 0) {
    historyContainer.innerHTML = `<p>Chưa có lịch sử thao tác trong ${displayDate}.</p>`;
    return;
  }

  const sortedHistory = displayHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const isExpanded = isExpandedStates.history ?? false;
  const displayItems = isExpanded ? sortedHistory : sortedHistory.slice(0, 3);

  historyContainer.innerHTML = `
    <h3>Lịch sử Thao tác (${displayDate})</h3>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Giờ</th>
          <th>Tên NV</th>
          <th>Nội dung cập nhật mới nhất</th>
        </tr>
      </thead>
      <tbody>
        ${displayItems
          .map((h, index) => {
            const contentColor = h.isDeleted ? "#DC3545" : h.action.includes("Sửa") ? "#FFC107" : "inherit";
            const details = h.isDeleted ? `Đã xóa: ${h.details}` : (h.after || h.details);
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${new Date(h.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>${h.employeeName || "Không xác định"}</td>
                <td style="color: ${contentColor}; cursor: pointer;" onclick="showHistoryDetails('${h.id}')">${details}</td>
              </tr>`;
          })
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Tổng: ${sortedHistory.length} thao tác</strong></td>
        </tr>
      </tfoot>
    </table>
    ${sortedHistory.length > 3 ? `<button class="expand-btn" onclick="isExpandedStates.history = !isExpandedStates.history; renderHistory('${startDate}', '${endDate}')">${isExpanded ? "Thu gọn" : "Xem thêm"}</button>` : ""}
  `;
}
function showHistoryDetails(historyId) {
  const history = globalHistory.find(h => h.id === historyId);
  if (!history) {
    showToastNotification("Không tìm thấy thao tác!");
    return;
  }
  const modal = document.getElementById("history-details-modal") || document.createElement("div");
  modal.id = "history-details-modal";
  modal.className = "modal";

  const isManager = isCurrentUserManager();
  const isOwner = history.employeeId === currentEmployeeId;
  const canEdit = isManager || isOwner;

  let historyHtml = history.history?.map((entry, index) => 
    `Lần ${index + 1}: ${new Date(entry.timestamp).toLocaleString("vi-VN")} - ${entry.employeeName} - ${entry.action}`
  ).join('<br>') || 'Chưa có lịch sử';

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Chi tiết thao tác</h3>
      <p><strong>Nhân viên:</strong> ${history.employeeName || "Không xác định"}</p>
      <p><strong>Thời gian:</strong> ${new Date(history.timestamp).toLocaleString("vi-VN")}</p>
      <p><strong>Nội dung ban đầu:</strong> <span style="color: #6c757d;">${history.before || "Không có"}</span></p>
      <p><strong>Nội dung sau khi sửa:</strong> <span style="color: #dc3545;">${history.after || "Không có"}</span></p>
      <p><strong>Ghi chú:</strong> ${history.note || "Không có"}</p>
      <h4>Lịch sử chỉnh sửa/xóa</h4>
      <div>${historyHtml}</div>
      <div class="action-buttons">
        ${canEdit ? `<button style="color: #6c757d;" onclick="editHistory('${historyId}')">[Sửa]</button>` : ""}
        ${canEdit ? `<button style="color: #6c757d;" onclick="deleteHistory('${historyId}')">[Xóa]</button>` : ""}
        <button onclick="closeModal('history-details-modal')">[Đóng]</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "block";
}

function editHistory(historyId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const history = globalHistory.find(h => h.id === historyId);
    if (!history) {
      showToastNotification("Không tìm thấy thao tác!");
      return;
    }
    if (!isCurrentUserManager() && history.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền chỉnh sửa thao tác này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do chỉnh sửa:", history.note || "");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do chỉnh sửa không được để trống!");
      return;
    }
    const newDetails = prompt("Chỉnh sửa nội dung thao tác:", history.details || "");
    if (!newDetails || newDetails.trim() === "") {
      showToastNotification("Nội dung thao tác không được để trống!");
      return;
    }
    const before = history.details || "Không có";
    const after = newDetails;

    history.history = history.history || [];
    history.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Sửa: ${newDetails}`
    });

    db.ref(`history/${historyId}`)
      .update({
        details: newDetails,
        note: note,
        updatedAt: new Date().toISOString(),
        history: history.history
      })
      .then(() => {
        globalHistory = globalHistory.map(h =>
          h.id === historyId ? { ...h, details: newDetails, note, history: history.history } : h
        );
        logHistory("history", "sửa", `Sửa thao tác: ${newDetails}`, note, before, after);
        renderHistory();
        closeModal("history-details-modal");
        showToastNotification("Đã cập nhật thao tác!");
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật thao tác: " + err.message));
  });
}

function deleteHistory(historyId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const history = globalHistory.find(h => h.id === historyId);
    if (!history) {
      showToastNotification("Không tìm thấy thao tác!");
      return;
    }
    if (!isCurrentUserManager() && history.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền xóa thao tác này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do xóa:");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do xóa không được để trống!");
      return;
    }
    if (!confirm("Xóa thao tác này?")) return;
    const before = history.details || "Không có";
    const details = `Xóa thao tác: ${before}`;

    history.history = history.history || [];
    history.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Xóa thao tác: ${before}`
    });

    db.ref(`history/${historyId}`)
      .update({
        isDeleted: true,
        after: `Đã xóa: ${before}`,
        note,
        history: history.history,
        updatedAt: new Date().toISOString()
      })
      .then(() => {
        globalHistory = globalHistory.map(h =>
          h.id === historyId ? { ...h, isDeleted: true, after: `Đã xóa: ${before}`, note, history: history.history } : h
        );
        logHistory("history", "xóa", details, note, before, "Đã xóa");
        renderHistory();
        closeModal("history-details-modal");
        showToastNotification("Đã xóa thao tác!");
      })
      .catch(err => showToastNotification("Lỗi khi xóa thao tác: " + err.message));
  });
}
// Chỉnh sửa sản phẩm trong báo cáo
function editReportProduct(reportId, productId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền chỉnh sửa sản phẩm này!");
      return;
    }
    const product = report.products?.find(p => p.productId === productId);
    if (!product) {
      showToastNotification("Sản phẩm không tồn tại trong báo cáo!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do chỉnh sửa:", product.note || "");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do chỉnh sửa không được để trống!");
      return;
    }
    const before = `${product.name} (${product.quantity} đơn vị)`;
    const newQuantity = prompt("Chỉnh sửa số lượng:", product.quantity);
    if (!newQuantity || isNaN(newQuantity) || newQuantity < 0) {
      showToastNotification("Số lượng không hợp lệ!");
      return;
    }
    const updatedQuantity = parseInt(newQuantity);
    const inventoryItem = getInventoryData().find(item => item.id === productId);
    if (!inventoryItem || updatedQuantity > inventoryItem.quantity + product.quantity) {
      showToastNotification("Số lượng vượt quá tồn kho!");
      return;
    }
    const updatedProducts = report.products
      .map(p => (p.productId === productId ? { ...p, quantity: updatedQuantity, note } : p))
      .filter(p => p.quantity > 0);
    const after = `${product.name} (${updatedQuantity} đơn vị)`;
    const details = `Sửa xuất hàng: ${after}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Sửa xuất hàng: ${after}`
    });

    db.ref("reports/" + reportId)
      .update({ 
        products: updatedProducts, 
        history: report.history,
        before,
        after,
        note
      })
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
                showToastNotification("Đã cập nhật sản phẩm!");
              });
            });
          });
        } else {
          showToastNotification("Không tìm thấy sản phẩm trong tồn kho!");
        }
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật sản phẩm: " + err.message));
  });
}
// Xóa sản phẩm trong báo cáo
function deleteReportProduct(reportId, productId) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      showToastNotification("Vui lòng đăng nhập!");
      return;
    }
    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const report = getReportData().find(r => r.id === reportId);
    if (!report) {
      showToastNotification("Báo cáo không tồn tại!");
      return;
    }
    if (!isCurrentUserManager() && report.employeeId !== user.uid) {
      showToastNotification("Bạn không có quyền xóa sản phẩm này!");
      return;
    }
    const note = prompt("Vui lòng nhập lý do xóa:");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do xóa không được để trống!");
      return;
    }
    if (!confirm("Xóa sản phẩm này khỏi báo cáo?")) return;
    const product = report.products?.find(p => p.productId === productId);
    if (!product) {
      showToastNotification("Sản phẩm không tồn tại trong báo cáo!");
      return;
    }
    const before = `${product.name} (${product.quantity} đơn vị)`;
    const details = `Xóa xuất hàng: ${before}`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Xóa xuất hàng: ${before}`
    });

    const updatedProducts = report.products.map(p =>
      p.productId === productId ? { ...p, isDeleted: true, after: `Đã xóa: ${before}`, note } : p
    );

    db.ref("reports/" + reportId)
      .update({ 
        products: updatedProducts, 
        history: report.history,
        before,
        after: `Đã xóa: ${before}`,
        note
      })
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
                showToastNotification("Đã xóa sản phẩm!");
              });
            });
          });
        } else {
          showToastNotification("Không tìm thấy sản phẩm trong tồn kho!");
        }
      })
      .catch(err => showToastNotification("Lỗi khi xóa sản phẩm: " + err.message));
  });
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
function initializeReports() {
  db.ref("reports").once("value").then(snapshot => {
    globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
    renderFilteredReports(globalReportData); // Render báo cáo thu chi và xuất hàng
    renderRevenueExpenseData(); // Render báo cáo thu chi hàng ngày
    renderHistory(); // Render lịch sử
  }).catch(err => console.error("Lỗi khi tải dữ liệu báo cáo:", err));
}

// Gọi hàm khởi tạo khi trang tải
document.addEventListener("DOMContentLoaded", initializeReports);
