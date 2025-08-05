
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
      <input type="number" id="closing-balance" placeholder="Dư cuối kỳ" min="0">
      <button onclick="submitField('closing-balance')">Gửi</button>
    </div>
  `;
}

function submitField(field) {
  auth.onAuthStateChanged(user => {
    if (!user) return showToastNotification("Vui lòng đăng nhập!");

    const employeeName = globalEmployeeData.find(emp => emp.id === user.uid)?.name || "Không xác định";
    const input = document.getElementById(field);
    if (!input || !input.value.trim()) return showToastNotification("Vui lòng nhập dữ liệu!");
    if (input.disabled) return showToastNotification("Đang xử lý, vui lòng chờ!");

    input.disabled = true;
    setTimeout(() => { input.disabled = false; }, 2000);

    const today = new Date().toISOString().split("T")[0];
    const existingReport = globalReportData.find(r => r.date.split("T")[0] === today);

    // ✅ Nếu có báo cáo hôm nay, clone lại để cập nhật — giữ các giá trị cũ
    let reportData = existingReport
      ? { ...existingReport }
      : {
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

    // ✅ Chi phí riêng biệt
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
      reportData.transferAmount += realAmount;
      reportData.transferTimestamp = realAmount > 0 ? new Date().toISOString() : null;
      reportData.grabAmount = reportData.grabAmount || 0;

      const thisInput = realAmount.toLocaleString("vi-VN");
      const total = reportData.transferAmount.toLocaleString("vi-VN");
      details = `Nhập chuyển khoản: ${thisInput} VND (tổng: ${total} VND)`;
      afterValue = `${thisInput} VND (tổng: ${total} VND)`;
      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: details
      });

    } else if (field === "grab-amount") {
      const amount = parseFloat(input.value) || 0;
      if (amount < 0) {
        showToastNotification("Số tiền Grab không được âm!");
        input.disabled = false;
        return;
      }
      const realAmount = amount * 1000;
      reportData.grabAmount = (reportData.grabAmount || 0) + realAmount;
      reportData.grabTimestamp = realAmount > 0 ? new Date().toISOString() : null;
      reportData.transferAmount = reportData.transferAmount || 0;

      const thisInput = realAmount.toLocaleString("vi-VN");
      const total = reportData.grabAmount.toLocaleString("vi-VN");
      details = `Nhập Grab: ${thisInput} VND (tổng: ${total} VND)`;
      afterValue = `${thisInput} VND (tổng: ${total} VND)`;
      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: details
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

      reportData[fieldName] = realValue;

      details = `Nhập ${field}: ${realValue.toLocaleString("vi-VN")} VND`;
      afterValue = `${realValue.toLocaleString("vi-VN")} VND`;

      reportData.history.push({
        timestamp: new Date().toISOString(),
        employeeName,
        action: `Nhập ${field}: ${afterValue}`,
        field: fieldName,
        before: existingReport?.[fieldName]?.toLocaleString("vi-VN") || "",
        after: afterValue
      });
    }

    // ✅ Tính lại
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
    note,
    action: "sửa", // ✅ Thêm dòng này
    approvalStatus: "approved" // ✅ (nếu bạn cần báo cáo đã duyệt mặc định)
  })

      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("expense", "sửa", details, note, before, after, reportId);
          renderFilteredReports(globalReportData);
          renderHistory();
document.getElementById("history-details-modal") && closeModal("history-details-modal");
          showToastNotification("Đã cập nhật chi phí!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật chi phí: " + err.message));
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

    db.ref("reports/" + reportId).update({
  ...updateData,
  cashActual: openingBalance + revenue - expenseAmount - closingBalance - updatedAmount,
  action: "sửa",
  approvalStatus: "approved"
})

      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          logHistory("transfer", "sửa", details, note, before, after);
          renderFilteredReports(globalReportData);
          renderHistory();
document.getElementById("history-details-modal") && closeModal("history-details-modal");
          showToastNotification("Đã cập nhật chuyển khoản!");
        });
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật giao dịch: " + err.message));
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
          <td onclick="showReportDetails('${r.id}')" style="${r.action === 'sửa' && r.approvalStatus === 'approved' ? 'background-color: #fff3cd;' : ''}">
  ${(r.approvalStatus === "pending" || (r.approvalStatus === "approved" && r.action === "xóa")) && r.before
    ? r.before
    : (r.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (r.expenseNote || "Không có") + ")"
  }
</td>

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
  (r.approvalStatus === "approved" && r.action === "xóa" && r.before?.includes("VND"))
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
      ${displayExpenses.map((r, index) => {
        const highlightCell = r.action === "sửa" && r.approvalStatus === "approved";
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${new Date(r.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
            <td>${r.employeeName || "Không xác định"}</td>
            <td onclick="showReportDetails('${r.id}')" style="${highlightCell ? 'background-color: #fff3cd;' : ''}">
              ${
                (r.approvalStatus === "pending" || (r.approvalStatus === "approved" && r.action === "xóa")) && r.before
                  ? r.before
                  : (r.expenseAmount || 0).toLocaleString("vi-VN") + " VND (" + (r.expenseNote || "Không có") + ")"
              }
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>Tổng: ${expenseReports.reduce((sum, r) => sum + getAmountForTotal(r, "expense"), 0).toLocaleString("vi-VN")} VND</strong></td>
      </tr>
    </tfoot>
  </table>
  ${
    expenseReports.length > 3
      ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsFinance = !isExpandedStates.filteredReportsFinance; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">
          ${isExpandedFinance ? "Thu gọn" : "Xem thêm"}
        </button>`
      : ""
  }
`;

if (expenseReports.length === 0) {
  reportContainer.innerHTML += `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
}

 // Bảng Báo cáo Xuất Hàng
const reportMap = {};
sortedReports.forEach(r => reportMap[r.id] = r);

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
  <h3>Bảng Báo Cáo Xuất Hàng (${displayDate})</h3>
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
      ${displayProducts.map(p => {
        const isEdited = reportMap[p.reportId]?.action === "sửa" && reportMap[p.reportId]?.approvalStatus === "approved";
        return `
          <tr>
            <td>${p.index}</td>
            <td>${new Date(p.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
            <td>${p.employeeName}</td>
            <td onclick="showReportProductDetails('${p.reportId}', '${p.productId}')">${p.productName}</td>
            <td onclick="showReportProductDetails('${p.reportId}', '${p.productId}')" style="${isEdited ? 'background-color: #fff3cd;' : ''}">
              ${p.quantity}
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5"><strong>Tổng: ${productReports.reduce((sum, p) => sum + (p.quantity || 0), 0)} đơn vị</strong></td>
      </tr>
    </tfoot>
  </table>
  ${productReports.length > 3 
    ? `<button class="expand-btn" onclick="isExpandedStates.filteredReportsProduct = !isExpandedStates.filteredReportsProduct; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">
         ${isExpandedProduct ? "Thu gọn" : "Xem thêm"}
       </button>` 
    : ""}
`;

if (productReports.length === 0) {
  productContainer.innerHTML += `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
}
const transferReports = sortedReports.filter(r => 
  r.transferAmount > 0 || 
  r.grabAmount > 0 || 
  (r.approvalStatus === "pending" && r.before?.match(/CK|Grab/)) || 
  ((r.approvalStatus === "approved" && r.action === "xóa" && r.before?.match(/CK|Grab/)) || r.isDeleted)
);

let totalTransferAmount = 0;
let totalGrabAmount = 0;

transferReports.forEach(r => {
  if (!r.isDeleted && r.approvalStatus !== "pending") {
    totalTransferAmount += r.transferAmount || 0;
    totalGrabAmount += r.grabAmount || 0;
  } else if (r.approvalStatus === "pending" && r.before?.match(/CK|Grab/)) {
    const match = r.before.match(/([\d,]+) VND/);
    const amountValue = match ? parseFloat(match[1].replace(/,/g, "")) || 0 : 0;
    totalTransferAmount += r.before.includes("CK") ? amountValue : 0;
    totalGrabAmount += r.before.includes("Grab") ? amountValue : 0;
  }
});

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
      ${displayTransfers.map((r, index) => {
        const isEdited = r.action === "sửa" && r.approvalStatus === "approved";

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
            <td onclick="showTransferDetails('${r.id}')" style="${isEdited ? 'background-color: #fff3cd;' : ''}">
              ${amount}
            </td>
          </tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">
          <strong>Tổng: Grab: ${totalGrabAmount.toLocaleString("vi-VN")} VND, CK: ${totalTransferAmount.toLocaleString("vi-VN")} VND</strong>
        </td>
      </tr>
    </tfoot>
  </table>
  ${transferReports.length > 3 
    ? `<button class="expand-btn" onclick="isExpandedStates.transferReports = !isExpandedStates.transferReports; renderFilteredReports(null, '${selectedDate}', '${startDate}', '${endDate}')">
         ${isExpandedTransfer ? "Thu gọn" : "Xem thêm"}
       </button>` 
    : ""}
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

 const isEdited = r => r?.action === "sửa" && r?.approvalStatus === "approved";

summaryContainer.innerHTML = `
  <h3>Tóm tắt Thu Chi (${displayDate}):</h3>

  <p>
  <strong>Dư đầu kỳ:</strong> 
  ${formatAmount(totalOpeningBalance, isEdited(latestOpening))}
  (${formatTime(latestOpening.date)} ${latestOpening.employeeName})
  <button onclick="editReportField('${latestOpening.id}', 'openingBalance')">✏️</button>
</p>

  <p>
  <strong>Doanh thu:</strong> 
  ${formatAmount(totalRevenue, isEdited(latestRevenue))} 
  (${formatTime(latestRevenue.date)} ${latestRevenue.employeeName})
  <button onclick="editReportField('${latestRevenue.id}', 'revenue')">✏️</button>
</p>

  <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString("vi-VN")} VND
    (${formatTime(latestExpense.date)} ${latestExpense.employeeName})
  </p>

  <p><strong>Chuyển khoản:</strong> ${totalTransferAmount.toLocaleString("vi-VN")} VND
    (${formatTime(latestTransfer.date)} ${latestTransfer.employeeName})
  </p>

  <p><strong>Grab:</strong> ${totalGrabAmount.toLocaleString("vi-VN")} VND
    (${formatTime(latestGrab.date)} ${latestGrab.employeeName})
  </p>

  <p>
  <strong>Dư cuối kỳ:</strong> 
  ${formatAmount(totalClosingBalance, isEdited(latestClosing))}
  (${formatTime(latestClosing.date)} ${latestClosing.employeeName})
  <button onclick="editReportField('${latestClosing.id}', 'closingBalance')">✏️</button>
</p>

  <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString("vi-VN")} VND
    (${formatTime(latestRemaining.date)} ${latestRemaining.employeeName})
  </p>

  <p><strong>Tiền mặt:</strong> ${totalCashActual.toLocaleString("vi-VN")} VND
    (${formatTime(latestCashActual.date)} ${latestCashActual.employeeName})
  </p>
`;


}
const formatAmount = (amount, isEdited) => {
  return isEdited
    ? `<span style="color: #d97706; font-weight: 600;">${amount.toLocaleString("vi-VN")} VND </span>`
    : `${amount.toLocaleString("vi-VN")} VND`;
};

function renderHistory(startDate = null, endDate = null) {
  const container = document.getElementById("history-table");
  if (!container) return;

  const isValidDate = date => date && !isNaN(new Date(date).getTime());

  let allHistory = [];

  (globalReportData || []).forEach(report => {
    if (Array.isArray(report.history)) {
      report.history.forEach(h => {
        if (["openingBalance", "revenue", "closingBalance"].includes(h.field)) {
const hDate = toLocalDateStringISO(h.timestamp);
          if (
            (!startDate && !endDate) ||
            (hDate >= startDate && hDate <= (endDate || startDate))
          ) {
            allHistory.push({ ...h, reportId: report.id });
          }
        }
      });
    }
  });

  if (allHistory.length === 0) {
    const label = isValidDate(startDate)
      ? `${new Date(startDate).toLocaleDateString("vi-VN")}${
          isValidDate(endDate) && endDate !== startDate
            ? " đến " + new Date(endDate).toLocaleDateString("vi-VN")
            : ""
        }`
      : "toàn bộ thời gian";

    container.innerHTML = `<p>Chưa có lịch sử thao tác trong ${label}.</p>`;
    return;
  }

  // Sắp xếp mới nhất lên đầu
  allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let labelHtml = "";
  if (isValidDate(startDate)) {
    const labelStart = new Date(startDate).toLocaleDateString("vi-VN");
    const labelEnd = isValidDate(endDate) && endDate !== startDate
      ? " đến " + new Date(endDate).toLocaleDateString("vi-VN")
      : "";

    labelHtml = `
      <p style="margin-bottom: 10px;">
        <em>🔎 Đang xem lịch sử thao tác từ ${labelStart}${labelEnd}</em>
        <button onclick="clearHistoryFilter()" style="margin-left: 10px;">❌ Xóa lọc</button>
      </p>`;
  } else {
    labelHtml = `<p style="margin-bottom: 10px;"><em>🔎 Đang xem toàn bộ lịch sử thao tác</em></p>`;
  }

  container.innerHTML = `
    ${labelHtml}
    <table class="table-style">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Nhân viên</th>
          <th>Hành động</th>
          <th>Trước → Sau</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        ${allHistory
          .map(
            h => `
          <tr>
            <td>${new Date(h.timestamp).toLocaleString("vi-VN")}</td>
            <td>${h.employeeName || "Không rõ"}</td>
            <td>${h.action || ""}</td>
            <td>${h.before || ""} → ${h.after || ""}</td>
            <td>${h.note || ""}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}
function toLocalDateStringISO(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function parseVNDateToISO(input) {
  if (!input || typeof input !== "string") return null;
  const [day, month, year] = input.trim().split("/");
  if (!day || !month || !year) return null;

  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isNaN(new Date(iso).getTime()) ? null : iso;
}



function clearHistoryFilter() {
  const rangeInput = document.getElementById("filter-range");
  if (rangeInput) rangeInput.value = "";

  renderFilteredReports(getReportData());
  renderHistory(); // mặc định không truyền ngày → hiển thị toàn bộ
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
document.getElementById("history-details-modal") && closeModal("history-details-modal");
        showToastNotification("Đã cập nhật thao tác!");
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật thao tác: " + err.message));
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
        note,
        action: "sửa", // ✅ để hệ thống biết đây là bản đã chỉnh sửa
        approvalStatus: "approved" // ✅ để hiển thị bôi vàng đúng
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
document.getElementById("history-details-modal") && closeModal("history-details-modal");

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

function applyFilter() {
  const range = document.getElementById("filter-range")?.value;
  console.log("🎯 Giá trị filterRange:", range);

  if (!range || !range.includes(" to ")) {
    const singleDate = range?.trim();
    if (!singleDate) {
      renderFilteredReports(getReportData());
      renderHistory(); // toàn bộ
      return;
    }
    renderFilteredReports(getReportData(), null, singleDate, singleDate);
    renderHistory(singleDate, singleDate);
    return;
  }

  const [startDate, endDate] = range.split(" to ").map(str => str.trim());

  console.log("📅 startDate:", startDate, "📅 endDate:", endDate);
  renderFilteredReports(getReportData(), null, startDate, endDate);
  renderHistory(startDate, endDate);
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

//
function editReportField(reportId, fieldName) {
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

    const currentValue = report[fieldName] || 0;
    const fieldLabel = {
      openingBalance: "Số dư đầu kỳ",
      closingBalance: "Số dư cuối kỳ",
      revenue: "Doanh thu"
    }[fieldName] || fieldName;

    const note = prompt(`Nhập lý do chỉnh sửa ${fieldLabel.toLowerCase()}:`, "");
    if (!note || note.trim() === "") {
      showToastNotification("Lý do chỉnh sửa không được để trống!");
      return;
    }

    const input = prompt(`Nhập giá trị mới cho ${fieldLabel} (nghìn VND):`, currentValue / 1000);
    const inputNumber = parseFloat(input);
    if (isNaN(inputNumber) || inputNumber < 0) {
      showToastNotification("Giá trị không hợp lệ!");
      return;
    }

    const newValue = Math.round(inputNumber * 1000); // ✅ nhân 1000
    const before = `${currentValue.toLocaleString("vi-VN")} VND`;
    const after = `${newValue.toLocaleString("vi-VN")} VND`;

    report.history = report.history || [];
    report.history.push({
      timestamp: new Date().toISOString(),
      employeeName,
      action: `Sửa ${fieldLabel}`,
      field: fieldName,
      before,
      after,
      note
    });

    db.ref("reports/" + reportId)
      .update({
        [fieldName]: newValue,
        history: report.history,
        action: "sửa",
        approvalStatus: "approved",
        before,
        after,
        note
      })
      .then(() => {
        db.ref("reports").once("value").then(snapshot => {
          globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
          renderFilteredReports(globalReportData);
          renderHistory();
          showToastNotification(`Đã cập nhật ${fieldLabel.toLowerCase()}!`);
          const modal = document.getElementById("history-details-modal");
          if (modal) closeModal("history-details-modal"); // tránh lỗi nếu modal không tồn tại
        });
      })
      .catch(err => showToastNotification("Lỗi khi cập nhật: " + err.message));
  });
}
//
function renderProductGrid() {
  const container = document.getElementById("report-product-list");
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("product-grid");

  const inventory = getInventoryData();

  inventory.forEach(item => {
    const tile = document.createElement("div");
    tile.className = "product-tile product-item";
    tile.dataset.productId = item.id;

    tile.innerHTML = `
  <div id="label-${item.id}" class="product-label">${item.name}</div>
  <button class="minus-btn" onclick="event.stopPropagation(); decreaseQty('${item.id}')">–</button>
`;

    tile.addEventListener("click", () => toggleProduct(item.id));
    container.appendChild(tile);

    if (typeof selectedQuantities[item.id] === "undefined") {
      selectedQuantities[item.id] = 0;
    }

    updateProductTile(item.id);
  });
}
const selectedQuantities = {};

function toggleProduct(id) {
  selectedQuantities[id] = (selectedQuantities[id] || 0) + 1;
  updateProductTile(id);
}

function decreaseQty(id) {
  selectedQuantities[id] = Math.max((selectedQuantities[id] || 0) - 1, 0);
  updateProductTile(id);
}

function updateProductTile(id) {
  const label = document.getElementById("label-" + id);
  const quantity = selectedQuantities[id] || 0;
  label.textContent = quantity > 0 ? quantity : getProductName(id);
  const tile = label.closest(".product-tile");
  tile.classList.toggle("active", quantity > 0);
}

function getProductName(id) {
  const item = getInventoryData().find(p => p.id === id);
  return item?.name || "SP";
}

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

function renderReportProductList() {
  const productList = document.getElementById("report-product-list");
  if (!productList) return;

  const items = getInventoryData();
  productList.innerHTML = `
    <div class="product-grid">
      ${items.map(item => `
        <div class="product-tile product-item" data-product-id="${item.id}">
          <div class="product-name" onclick="incrementProductCount('${item.id}')">
            ${item.name}
          </div>
          <div class="product-controls">
            <span class="quantity">0</span>
            <button class="minus-btn" onclick="decrementProductCount('${item.id}')">−</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
