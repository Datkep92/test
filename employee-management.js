function renderEmployeeList() {
  const container = document.getElementById("employee-list");
  container.innerHTML = "";
  if (globalEmployeeData.length === 0) {
    container.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
    return;
  }
  globalEmployeeData.forEach(employee => {
    const div = document.createElement("div");
    div.className = "employee-item";
    div.innerHTML = `
      <p><strong>${employee.name}</strong> - ${employee.role}</p>
      <p>Lương: ${employee.dailyWage || 0} VNĐ/ngày</p>
      <button onclick="showEmployeeDetails('${employee.id}')">Chi tiết</button>
      <button onclick="showEditEmployeeForm('${employee.id}')">Sửa</button>
      <button onclick="deleteEmployee('${employee.id}')">Xóa</button>
    `;
    container.appendChild(div);
  });
}
// Các hàm khác (renderEmployeeDetails, showEmployeeModal, addEmployee, editEmployee, deleteEmployee, renderSchedule, v.v.) giữ nguyên từ phiên bản trước
function renderEmployeeDetails() {
  const container = document.getElementById("employee-details");
  if (!container) return;
  container.innerHTML = "";

  const selectedCheckboxes = document.querySelectorAll(".employee-checkbox:checked");
  if (selectedCheckboxes.length === 0) {
    container.innerHTML = "<p>Vui lòng chọn một nhân viên để xem chi tiết.</p>";
    return;
  }
  if (selectedCheckboxes.length > 1) {
    container.innerHTML = "<p>Vui lòng chỉ chọn một nhân viên.</p>";
    return;
  }

  const employeeId = selectedCheckboxes[0].dataset.id;
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const schedules = globalScheduleData.filter(s => 
    s.employeeId === employeeId && 
    s.approvalStatus === "approved" && 
    s.date && 
    !isNaN(new Date(s.date)) && 
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );
  const workdays = schedules.filter(s => s.status !== "off").length;
  const offdays = schedules.filter(s => s.status === "off").length;
  const baseSalary = workdays * (employee.dailyWage || 0);
  const overtimePay = schedules.filter(s => s.status === "overtime").length * ((employee.dailyWage || 0) * 1.5);
  const advances = globalAdvanceRequests
    .filter(a => a.employeeId === employeeId && a.status === "approved")
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalSalary = baseSalary + overtimePay + (employee.allowance || 0) - (employee.otherFee || 0) - advances;

  container.innerHTML = `
    <h3>Thông tin chi tiết: ${employee.name}</h3>
    <p><strong>Địa chỉ:</strong> ${employee.address || "Không có"}</p>
    <p><strong>Số điện thoại:</strong> ${employee.phone || "Không có"}</p>
    <p><strong>Ghi chú:</strong> ${employee.note || "Không có"}</p>
    <p><strong>Lương ngày:</strong> ${(employee.dailyWage || 0).toLocaleString('vi-VN')} VND</p>
    <p><strong>Phụ cấp:</strong> ${(employee.allowance || 0).toLocaleString('vi-VN')} VND</p>
    <p><strong>Phí khác:</strong> ${(employee.otherFee || 0).toLocaleString('vi-VN')} VND</p>
    <p><strong>Ngày công:</strong> ${workdays}</p>
    <p><strong>Ngày nghỉ:</strong> ${offdays}</p>
    <p><strong>Tổng lương:</strong> ${totalSalary.toLocaleString('vi-VN')} VND</p>
    <div class="button-group">
      <button class="primary-btn" onclick="showEmployeeModal('edit', '${employeeId}')">Chỉnh sửa</button>
    </div>
  `;
}

function showEmployeeModal(mode, employeeId = null) {
  const modal = document.getElementById("employee-modal");
  const modalContent = document.getElementById("employee-modal-content");
  const title = document.getElementById("employee-modal-title");
  const submitBtn = document.getElementById("employee-modal-submit");
  const passwordLabel = document.getElementById("employee-password-label");
  const passwordInput = document.getElementById("employee-password");
  if (!modal || !modalContent || !title || !submitBtn) return;

  if (mode === "add") {
    title.textContent = "Thêm nhân viên";
    passwordLabel.style.display = "block";
    passwordInput.style.display = "block";
    document.getElementById("employee-name").value = "";
    document.getElementById("employee-email").value = "";
    document.getElementById("employee-password").value = "";
    document.getElementById("employee-address").value = "";
    document.getElementById("employee-phone").value = "";
    document.getElementById("employee-note").value = "";
    document.getElementById("employee-daily-wage").value = "";
    document.getElementById("employee-allowance").value = "";
    document.getElementById("employee-other-fee").value = "";
    submitBtn.onclick = () => addEmployee();
  } else {
    const employee = globalEmployeeData.find(e => e.id === employeeId);
    if (!employee) return;
    title.textContent = `Chỉnh sửa nhân viên: ${employee.name}`;
    passwordLabel.style.display = "none";
    passwordInput.style.display = "none";
    document.getElementById("employee-name").value = employee.name || "";
    document.getElementById("employee-email").value = employee.email || "";
    document.getElementById("employee-address").value = employee.address || "";
    document.getElementById("employee-phone").value = employee.phone || "";
    document.getElementById("employee-note").value = employee.note || "";
    document.getElementById("employee-daily-wage").value = employee.dailyWage || 0;
    document.getElementById("employee-allowance").value = employee.allowance || 0;
    document.getElementById("employee-other-fee").value = employee.otherFee || 0;
    submitBtn.onclick = () => editEmployee(employeeId);
  }
  modal.style.display = "block";
}

function addEmployee() {
  const name = document.getElementById("employee-name").value.trim();
  const email = document.getElementById("employee-email").value.trim();
  const password = document.getElementById("employee-password").value.trim();
  const address = document.getElementById("employee-address").value.trim();
  const phone = document.getElementById("employee-phone").value.trim();
  const note = document.getElementById("employee-note").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-daily-wage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-other-fee").value) || 0;

  if (!name || !email || !password) {
    alert("Vui lòng nhập tên, email và mật khẩu!");
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      const uid = userCredential.user.uid;
      const employeeData = {
        id: uid,
        name,
        email,
        address,
        phone,
        note,
        dailyWage,
        allowance,
        otherFee,
        createdAt: new Date().toISOString()
      };
      db.ref("employees/" + uid).set(employeeData)
        .then(() => {
          globalEmployeeData.push(employeeData);
          alert("Thêm nhân viên thành công!");
          closeModal("employee-modal");
          renderEmployeeList();
          renderProfile();
          renderSchedule();
        })
        .catch(err => alert("Lỗi khi thêm nhân viên: " + err.message));
    })
    .catch(err => alert("Lỗi khi tạo tài khoản: " + err.message));
}

function editEmployee(employeeId) {
  const name = document.getElementById("employee-name").value.trim();
  const address = document.getElementById("employee-address").value.trim();
  const phone = document.getElementById("employee-phone").value.trim();
  const note = document.getElementById("employee-note").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-daily-wage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-other-fee").value) || 0;

  if (!name) {
    alert("Vui lòng nhập tên!");
    return;
  }

  db.ref("employees/" + employeeId).update({
    name,
    address,
    phone,
    note,
    dailyWage,
    allowance,
    otherFee,
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      const employee = globalEmployeeData.find(e => e.id === employeeId);
      if (employee) {
        employee.name = name;
        employee.address = address;
        employee.phone = phone;
        employee.note = note;
        employee.dailyWage = dailyWage;
        employee.allowance = allowance;
        employee.otherFee = otherFee;
      }
      alert("Cập nhật nhân viên thành công!");
      closeModal("employee-modal");
      renderEmployeeList();
      renderEmployeeDetails();
      renderProfile();
      renderSchedule();
    })
    .catch(err => alert("Lỗi khi cập nhật nhân viên: " + err.message));
}

function deleteEmployee(employeeId) {
  if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

  const updates = {};
  updates["employees/" + employeeId] = null;
  db.ref("schedules").once("value").then(snapshot => {
    const schedules = snapshot.val() || {};
    Object.keys(schedules).forEach(key => {
      if (schedules[key].employeeId === employeeId) {
        updates["schedules/" + key] = null;
      }
    });
    db.ref("advances").once("value").then(snapshot => {
      const advances = snapshot.val() || {};
      Object.keys(advances).forEach(key => {
        if (advances[key].employeeId === employeeId) {
          updates["advances/" + key] = null;
        }
      });
      db.ref().update(updates)
        .then(() => {
          globalEmployeeData = globalEmployeeData.filter(e => e.id !== employeeId);
          globalScheduleData = globalScheduleData.filter(s => s.employeeId !== employeeId);
          globalAdvanceRequests = globalAdvanceRequests.filter(a => a.employeeId === employeeId);
          alert("Xóa nhân viên thành công!");
          renderEmployeeList();
          renderEmployeeDetails();
          renderProfile();
          renderSchedule();
          renderAdvanceApprovalList();
        })
        .catch(err => alert("Lỗi khi xóa nhân viên: " + err.message));
    });
  });
}

function renderSchedule() {
  const container = document.getElementById("schedule-list");
  if (!container) return;
  container.innerHTML = "";
  if (!globalScheduleData || !globalEmployeeData || globalEmployeeData.length === 0) {
    container.innerHTML = "<p>Chưa có lịch làm việc hoặc thông tin nhân viên.</p>";
    return;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const table = document.createElement("table");
  table.classList.add("table-style");

  let header = "<tr><th>Nhân viên</th>";
  for (let day = 1; day <= daysInMonth; day++) {
    header += `<th>${day}</th>`;
  }
  header += "</tr>";
  table.innerHTML = `<thead>${header}</thead><tbody>`;

  globalEmployeeData.forEach(emp => {
    let row = `<tr><td class="employee-name">${emp.name}</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const schedule = globalScheduleData.find(s => s.date === date && s.employeeId === emp.id);
      let className = "";
      let content = "";
      if (schedule && schedule.date && !isNaN(new Date(schedule.date))) {
        if (schedule.approvalStatus === "approved") {
          className = schedule.status === "off" ? "day off" : schedule.status === "overtime" ? "day overtime" : "day swap";
          content = `${emp.name} ${schedule.status === "off" ? "off" : schedule.status === "overtime" ? "tăng ca" : "đổi ca"}`;
        } else if (schedule.approvalStatus === "pending") {
          className = "day pending";
          content = `${emp.name} chờ duyệt`;
        }
      }
      const onclickAction = schedule && schedule.approvalStatus === "pending" ? `showScheduleApprovalModal('${schedule.id}')` : "";
      row += `<td class="${className}" ${onclickAction ? `onclick="${onclickAction}"` : ""}>${content}</td>`;
    }
    row += "</tr>";
    table.innerHTML += row;
  });

  table.innerHTML += "</tbody>";
  container.appendChild(table);
}

function showScheduleApprovalModal(scheduleId) {
  const modal = document.getElementById("schedule-approval-modal");
  const modalContent = document.getElementById("schedule-approval-modal-content");
  if (!modal || !modalContent) return;
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('schedule-approval-modal')">×</span>
    <h3>Duyệt yêu cầu: ${schedule.employeeName} - ${statusText} ngày ${new Date(schedule.date).toLocaleDateString('vi-VN')}</h3>
    <div class="input-group">
      <label for="approval-reason">Lý do (nếu từ chối):</label>
      <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)"></textarea>
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="approveSchedule('${scheduleId}', 'approved')">Duyệt</button>
      <button class="secondary-btn" onclick="approveSchedule('${scheduleId}', 'denied')">Từ chối</button>
    </div>
  `;
  modal.style.display = "block";
}

function approveSchedule(scheduleId, status) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  const reason = document.getElementById("approval-reason").value.trim();
  if (status === "denied" && !reason) {
    alert("Vui lòng nhập lý do từ chối!");
    return;
  }

  db.ref("schedules/" + scheduleId).update({
    approvalStatus: status,
    reason: status === "denied" ? reason : null,
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
      const notificationMessage = `Yêu cầu ${statusText} ngày ${schedule.date} đã được ${status === "approved" ? "duyệt" : "từ chối"}.${reason ? ` Lý do: ${reason}` : ""}`;
      db.ref("notifications/" + schedule.employeeId).push({
        message: notificationMessage,
        timestamp: Date.now(),
        type: "confirmation",
        date: schedule.date,
        isRead: false
      });
      db.ref("messages/" + schedule.employeeId).push({
        message: notificationMessage,
        senderId: "manager",
        senderName: "Quản lý",
        timestamp: Date.now()
      });
      globalScheduleData = globalScheduleData.map(s => s.id === scheduleId ? { ...s, approvalStatus: status, reason: status === "denied" ? reason : null } : s);
      alert(`Yêu cầu đã được ${status === "approved" ? "duyệt" : "từ chối"}!`);
      closeModal("schedule-approval-modal");
      renderSchedule();
      renderEmployeeDetails();
      renderProfile();
      renderAdvanceApprovalList();
    })
    .catch(err => alert("Lỗi khi xử lý yêu cầu: " + err.message));
}

function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) return;
  container.innerHTML = "";
  const pendingAdvances = globalAdvanceRequests.filter(a => a.status === "pending").sort((a, b) => b.timestamp - a.timestamp);
  if (pendingAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng nào cần duyệt.</p>";
    return;
  }
  pendingAdvances.forEach(a => {
    const div = document.createElement("div");
    div.innerHTML = `
      ${a.employeeName}: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason || "Không có lý do"} - Ngày: ${a.date || "Không xác định"}
      <button class="primary-btn" onclick="showAdvanceApprovalModal('${a.id}')">Xử lý</button>
      <hr>
    `;
    container.appendChild(div);
  });
}

function showAdvanceApprovalModal(advanceId) {
  const modal = document.getElementById("advance-approval-modal");
  const modalContent = document.getElementById("advance-approval-modal-content");
  if (!modal || !modalContent) return;
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('advance-approval-modal')">×</span>
    <h3>Duyệt tạm ứng: ${advance.employeeName} - ${advance.amount.toLocaleString('vi-VN')} VND</h3>
    <p>Lý do: ${advance.reason || "Không có"}</p>
    <p>Ngày: ${advance.date || "Không xác định"}</p>
    <div class="input-group">
      <label for="approval-reason">Lý do (nếu từ chối):</label>
      <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)"></textarea>
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="approveAdvance('${advanceId}', 'approved')">Duyệt</button>
      <button class="secondary-btn" onclick="approveAdvance('${advanceId}', 'denied')">Từ chối</button>
    </div>
  `;
  modal.style.display = "block";
}

function approveAdvance(advanceId, status) {
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  const reason = document.getElementById("approval-reason").value.trim();
  if (status === "denied" && !reason) {
    alert("Vui lòng nhập lý do từ chối!");
    return;
  }

  db.ref("advances/" + advanceId).update({
    status,
    reason: status === "denied" ? reason : null,
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      const notificationMessage = `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND ngày ${advance.date} đã được ${status === "approved" ? "duyệt" : "từ chối"}.${reason ? ` Lý do: ${reason}` : ""}`;
      db.ref("notifications/" + advance.employeeId).push({
        message: notificationMessage,
        timestamp: Date.now(),
        type: "confirmation",
        isRead: false
      });
      db.ref("messages/" + advance.employeeId).push({
        message: notificationMessage,
        senderId: "manager",
        senderName: "Quản lý",
        timestamp: Date.now()
      });
      globalAdvanceRequests = globalAdvanceRequests.map(a => a.id === advanceId ? { ...a, status, reason: status === "denied" ? reason : null } : a);
      alert(`Yêu cầu tạm ứng đã được ${status === "approved" ? "duyệt" : "từ chối"}!`);
      closeModal("advance-approval-modal");
      renderAdvanceApprovalList();
      renderEmployeeDetails();
      renderProfile();
    })
    .catch(err => alert("Lỗi khi xử lý yêu cầu tạm ứng: " + err.message));
}

function sendGeneralNotification() {
  const message = document.getElementById("general-notification-text").value.trim();
  if (!message) {
    alert("Vui lòng nhập nội dung thông báo!");
    return;
  }

  const notificationData = {
    id: Date.now().toString(),
    message,
    timestamp: Date.now(),
    readBy: {}
  };
  db.ref("notifications/general/" + notificationData.id).set(notificationData)
    .then(() => {
      globalGeneralNotifications.push(notificationData);
      alert("Gửi thông báo thành công!");
      document.getElementById("general-notification-text").value = "";
      renderGeneralNotifications();
    })
    .catch(err => alert("Lỗi khi gửi thông báo: " + err.message));
}

function renderGeneralNotifications() {
  const container = document.getElementById("general-notification-list");
  if (!container) return;
  container.innerHTML = "";
  if (!globalGeneralNotifications || globalGeneralNotifications.length === 0) {
    container.innerHTML = "<p>Chưa có thông báo chung.</p>";
    return;
  }
  globalGeneralNotifications.sort((a, b) => b.timestamp - a.timestamp).forEach(n => {
    const div = document.createElement("div");
    div.innerHTML = `${n.message} - ${new Date(n.timestamp).toLocaleString('vi-VN')}<hr>`;
    container.appendChild(div);
  });
}

function sendEmployeeChat() {
  const selectedCheckboxes = document.querySelectorAll(".employee-checkbox:checked");
  if (selectedCheckboxes.length !== 1) {
    alert("Vui lòng chọn duy nhất một nhân viên để chat!");
    return;
  }
  const employeeId = selectedCheckboxes[0].dataset.id;
  const message = document.getElementById("employee-chat-text").value.trim();
  if (!message) {
    alert("Vui lòng nhập nội dung tin nhắn!");
    return;
  }

  db.ref("messages/" + employeeId).push({
    message,
    senderId: "manager",
    senderName: "Quản lý",
    timestamp: Date.now()
  })
    .then(() => {
      db.ref("notifications/" + employeeId).push({
        message: `Tin nhắn mới từ Quản lý: ${message}`,
        timestamp: Date.now(),
        type: "chat",
        isRead: false
      });
      alert("Gửi tin nhắn thành công!");
      document.getElementById("employee-chat-text").value = "";
      renderEmployeeChat(employeeId);
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}

function renderEmployeeChat(employeeId) {
  const container = document.getElementById("employee-chat");
  if (!container) return;
  container.innerHTML = "";
  if (!employeeId) {
    container.innerHTML = "<p>Vui lòng chọn một nhân viên để xem lịch sử chat.</p>";
    return;
  }

  db.ref("messages/" + employeeId).once("value").then(snapshot => {
    const messages = snapshot.val() ? Object.values(snapshot.val()) : [];
    if (messages.length === 0) {
      container.innerHTML = "<p>Chưa có tin nhắn với nhân viên này.</p>";
      return;
    }
    messages.sort((a, b) => a.timestamp - b.timestamp).forEach(msg => {
      const div = document.createElement("div");
      div.innerHTML = `${msg.senderName}: ${msg.message} - ${new Date(msg.timestamp).toLocaleString('vi-VN')}<hr>`;
      container.appendChild(div);
    });
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}