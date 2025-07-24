// File: js/profile.js

function updateEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để cập nhật thông tin!");
    return;
  }

  const nameInput = document.getElementById("personal-employee-name").value.trim();
  const addressInput = document.getElementById("employee-address").value.trim();
  const phoneInput = document.getElementById("employee-phone").value.trim();
  const noteInput = document.getElementById("employee-note").value.trim();

  if (!nameInput) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  db.ref("employees/" + user.uid).update({
    name: nameInput,
    address: addressInput || "",
    phone: phoneInput || "",
    note: noteInput || "",
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      alert("Cập nhật thông tin thành công!");
      const employee = globalEmployeeData.find(e => e.id === user.uid);
      if (employee) {
        employee.name = nameInput;
        employee.address = addressInput;
        employee.phone = phoneInput;
        employee.note = noteInput;
      }
      renderProfile();
    })
    .catch(error => alert("Có lỗi xảy ra khi cập nhật thông tin!"));
}

function requestAdvance() {
  const amount = parseFloat(document.getElementById("advance-amount").value) || 0;
  const reason = document.getElementById("advance-reason").value.trim();

  if (amount <= 0 || !reason) {
    alert("Vui lòng nhập số tiền và lý do hợp lệ!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi yêu cầu!");
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === user.uid);
  const employeeName = employee ? employee.name : (user.displayName || user.email.split('@')[0] || 'Nhân viên');

  const advanceData = {
    id: Date.now().toString(),
    employeeId: user.uid,
    employeeName,
    amount,
    reason,
    date: new Date().toISOString().split("T")[0],
    status: "pending",
    timestamp: Date.now()
  };

  db.ref("advances/" + advanceData.id).set(advanceData)
    .then(() => {
      globalAdvanceRequests.push(advanceData);
      alert("Gửi yêu cầu tạm ứng thành công!");
      document.getElementById("advance-amount").value = "";
      document.getElementById("advance-reason").value = "";
      renderAdvanceHistory();
    })
    .catch(err => alert("Lỗi khi gửi yêu cầu tạm ứng: " + err.message));
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) return;
  container.innerHTML = "";
  const myAdvances = globalAdvanceRequests.filter(a => a.employeeId === currentEmployeeId).sort((a, b) => b.timestamp - a.timestamp);
  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    return;
  }
  let isExpanded = false;
  const displayAdvances = isExpanded ? myAdvances : myAdvances.slice(0, 3);
  displayAdvances.forEach(a => {
    const approvalText = a.status === "approved" ? "Đã duyệt" : a.status === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const amount = a.amount || 0;
    const div = document.createElement("div");
    div.innerHTML = `Tạm ứng: ${amount.toLocaleString('vi-VN')} VND - ${a.reason || "Không có lý do"} - Ngày: ${a.date || "Không xác định"} - ${approvalText}<hr>`;
    container.appendChild(div);
  });
  if (myAdvances.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpanded ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => { isExpanded = !isExpanded; renderAdvanceHistory(); };
    container.appendChild(expandBtn);
  }
}

function renderScheduleStatusList() {
  const container = document.getElementById("schedule-status-list");
  if (!container) return;
  container.innerHTML = "";
  const schedules = globalScheduleData.filter(s => s.employeeId === currentEmployeeId && s.date && !isNaN(new Date(s.date))).sort((a, b) => b.timestamp - a.timestamp);
  if (schedules.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }
  let isExpanded = false;
  const displaySchedules = isExpanded ? schedules : schedules.slice(0, 3);
  displaySchedules.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const dateText = s.date ? new Date(s.date).toLocaleDateString('vi-VN') : "Không xác định";
    const div = document.createElement("div");
    div.className = s.approvalStatus === "pending" ? "day pending" : s.status === "off" ? "day off" : s.status === "overtime" ? "day overtime" : "day swap";
    div.innerHTML = `${dateText}: ${statusText} - ${approvalText} ${approvalText === "Chờ duyệt" ? `<button onclick="cancelSchedule('${s.id}')">Hủy</button>` : ""}<hr>`;
    container.appendChild(div);
  });
  if (schedules.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpanded ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => { isExpanded = !isExpanded; renderScheduleStatusList(); };
    container.appendChild(expandBtn);
  }
}

function cancelSchedule(key) {
  const schedule = globalScheduleData.find(s => s.id === key);
  if (!schedule || schedule.approvalStatus !== "pending") {
    alert("Chỉ có thể hủy yêu cầu đang chờ duyệt!");
    return;
  }
  db.ref("schedules/" + key).remove()
    .then(() => {
      globalScheduleData = globalScheduleData.filter(s => s.id !== key);
      const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
      const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]);
      const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
      const message = `${employeeName} đã hủy yêu cầu ${statusText} ngày ${schedule.date}`;
      db.ref("messages/manager").push({ text: message, time: new Date().toISOString(), employeeId: currentEmployeeId, employeeName })
        .then(() => {
          db.ref("notifications/" + schedule.employeeId).push({
            message: `Yêu cầu ${statusText} ngày ${schedule.date} đã bị hủy.`,
            timestamp: Date.now(),
            type: "confirmation",
            isRead: false
          });
          alert("Đã hủy yêu cầu và thông báo quản lý!");
          renderCalendar();
          renderScheduleStatusList();
          renderOffAndOvertime();
          renderSalarySummary();
        })
        .catch(err => alert("Lỗi gửi thông báo hủy: " + err.message));
    })
    .catch(err => alert("Lỗi hủy yêu cầu: " + err.message));
}

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;
  let currentMonth = new Date().getMonth() + 1;
  let currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay() || 7;

  let calendarHTML = `
    <div class="calendar-header">
      <button onclick="changeMonth(-1)">Trước</button>
      <h3>Tháng ${currentMonth}/${currentYear}</h3>
      <button onclick="changeMonth(1)">Sau</button>
    </div>
    <div class="calendar">
      <div class="calendar-header">CN</div><div class="calendar-header">T2</div><div class="calendar-header">T3</div>
      <div class="calendar-header">T4</div><div class="calendar-header">T5</div><div class="calendar-header">T6</div><div class="calendar-header">T7</div>`;

  for (let i = 1; i < firstDay; i++) calendarHTML += `<div class="day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedule = globalScheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
    const statusClass = schedule && schedule.approvalStatus === "approved" ? schedule.status : schedule && schedule.approvalStatus === "pending" ? "pending" : "normal";
    calendarHTML += `<div class="day ${statusClass}" data-date="${date}" onclick="showActionModal('${date}')">${day}</div>`;
  }
  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}

function changeMonth(offset) {
  let currentMonth = new Date().getMonth() + 1 + offset;
  let currentYear = new Date().getFullYear();
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  else if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  renderCalendar();
}

function showActionModal(date) {
  const modal = document.getElementById("action-modal");
  const modalContent = document.getElementById("action-modal-content");
  if (!modal || !modalContent) return;
  const schedule = globalScheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('action-modal')">×</span>
    <h3>Chọn hành động cho ngày ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    <div class="button-group">
      ${!schedule || schedule.approvalStatus !== "approved" ? `<button class="primary-btn" onclick="submitScheduleRequest('${date}', 'off')">Nghỉ</button>` : ""}
      ${!schedule || schedule.approvalStatus !== "approved" ? `<button class="primary-btn" onclick="submitScheduleRequest('${date}', 'overtime')">Tăng ca</button>` : ""}
      ${!schedule || schedule.approvalStatus !== "approved" ? `<button class="primary-btn" onclick="submitScheduleRequest('${date}', 'swap')">Đổi ca</button>` : ""}
      ${schedule && schedule.approvalStatus === "pending" ? `<button class="secondary-btn" onclick="cancelSchedule('${schedule.id}')">Hủy</button>` : ""}
    </div>
  `;
  modal.style.display = "block";
}

function submitScheduleRequest(date, status) {
  if (!["off", "overtime", "swap"].includes(status)) {
    alert("Trạng thái không hợp lệ!");
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi yêu cầu!");
    return;
  }
  const employee = globalEmployeeData.find(e => e.id === user.uid);
  if (!employee) {
    alert("Không tìm thấy thông tin nhân viên!");
    return;
  }

  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekOffs = globalScheduleData.filter(s => 
    s.employeeId === user.uid && 
    s.status === "off" && 
    s.approvalStatus === "approved" && 
    new Date(s.date) >= weekStart && 
    new Date(s.date) <= weekEnd
  );

  // Kiểm tra lịch trùng lặp
  const existingSchedule = globalScheduleData.find(s => s.employeeId === user.uid && s.date === date);
  if (existingSchedule) {
    // Xóa lịch cũ trước khi thêm mới
    db.ref("schedules/" + existingSchedule.id).remove()
      .then(() => {
        globalScheduleData = globalScheduleData.filter(s => s.id !== existingSchedule.id);
        console.log(`Removed duplicate schedule for ${user.uid} on ${date}`);
      })
      .catch(err => console.error(`Error removing duplicate schedule: ${err.message}`));
  }

  const scheduleId = `${date}_${user.uid}`;
  const scheduleData = {
    id: scheduleId,
    employeeId: user.uid,
    employeeName: employee.name,
    date,
    status,
    approvalStatus: weekOffs.length >= 1 && status === "off" ? "pending" : "approved",
    timestamp: Date.now()
  };

  db.ref("schedules/" + scheduleId).set(scheduleData)
    .then(() => {
      globalScheduleData.push(scheduleData);
      const statusText = status === "off" ? "Nghỉ" : status === "overtime" ? "Tăng ca" : "Đổi ca";
      const notificationMessage = `Yêu cầu ${statusText} ngày ${date} đã được gửi.`;
      if (weekOffs.length >= 1 && status === "off") {
        db.ref("messages/manager").push({
          message: `Yêu cầu ${statusText} ngày ${date} từ ${employee.name}`,
          senderId: user.uid,
          senderName: employee.name,
          scheduleId,
          timestamp: Date.now()
        });
      }
      db.ref("notifications/" + user.uid).push({
        message: notificationMessage,
        timestamp: Date.now(),
        type: "confirmation",
        date,
        isRead: false
      }).then(() => {
        alert(`Yêu cầu ${statusText} đã được gửi!`);
        closeModal("action-modal");
        renderCalendar();
        renderScheduleStatusList();
        renderOffAndOvertime();
        renderSalarySummary();
      });
    })
    .catch(err => alert("Lỗi khi gửi yêu cầu: " + err.message));
}
function renderOffAndOvertime() {
  const container = document.getElementById("off-and-overtime");
  if (!container) return;
  container.innerHTML = "";

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const schedules = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.approvalStatus === "approved" && 
    s.date && 
    !isNaN(new Date(s.date)) && 
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );

  const offDays = schedules
    .filter(s => s.status === "off")
    .map(s => new Date(s.date).toLocaleDateString('vi-VN'))
    .join(", ");
  const overtimeDays = schedules
    .filter(s => s.status === "overtime")
    .map(s => new Date(s.date).toLocaleDateString('vi-VN'))
    .join(", ");

  container.innerHTML = `
    <p><strong>Ngày off trong tháng:</strong> ${offDays || "Không có"}</p>
    <p><strong>Ngày tăng ca:</strong> ${overtimeDays || "Không có"}</p>
  `;
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) return;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) {
    container.innerHTML = "<p>Không tìm thấy thông tin nhân viên.</p>";
    return;
  }
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const approvedSchedules = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.approvalStatus === "approved" && 
    s.date && 
    !isNaN(new Date(s.date)) && 
    s.date.startsWith(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  );
  const workdays = approvedSchedules.filter(s => s.status !== "off").length;
  const offdays = approvedSchedules.filter(s => s.status === "off").length;
  const baseSalary = workdays * (employee.dailyWage || 0);
  const overtimePay = approvedSchedules.filter(s => s.status === "overtime").length * ((employee.dailyWage || 0) * 1.5);
  const advances = globalAdvanceRequests
    .filter(a => a.employeeId === currentEmployeeId && a.status === "approved")
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalSalary = baseSalary + overtimePay + (employee.allowance || 0) - (employee.otherFee || 0) - advances;
  container.innerHTML = `
    <h3>Tổng lương tháng ${today.getMonth() + 1}/${today.getFullYear()}</h3>
    <p>Số ngày làm: ${workdays}</p>
    <p>Lương cơ bản: ${baseSalary.toLocaleString('vi-VN')} VND</p>
    <p>Tiền tăng ca: ${overtimePay.toLocaleString('vi-VN')} VND</p>
    <p>Phụ cấp: ${(employee.allowance || 0).toLocaleString('vi-VN')} VND</p>
    <p>Phí khác: ${(employee.otherFee || 0).toLocaleString('vi-VN')} VND</p>
    <p><strong>Thực nhận: ${totalSalary.toLocaleString('vi-VN')} VND</strong></p>
  `;
}

// File: js/profile.js

// Hàm mới: Hiển thị lịch làm việc toàn thể nhân viên (chỉ xem, không chỉnh sửa)
function renderAllSchedule() {
  const container = document.getElementById("all-schedule-list");
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
      row += `<td class="${className}">${content}</td>`;
    }
    row += "</tr>";
    table.innerHTML += row;
  });

  table.innerHTML += "</tbody>";
  container.appendChild(table);
}

// Cập nhật renderProfile để gọi renderAllSchedule
function renderProfile() {
  const user = auth.currentUser;
  if (!user) return;
  const employee = globalEmployeeData.find(e => e.id === user.uid);
  if (employee) {
    document.getElementById("personal-employee-name").value = employee.name || "";
    document.getElementById("employee-address").value = employee.address || "";
    document.getElementById("employee-phone").value = employee.phone || "";
    document.getElementById("employee-note").value = employee.note || "";
  }
  renderCalendar();
  renderScheduleStatusList();
  renderAdvanceHistory();
  renderOffAndOvertime();
  renderSalarySummary();
  renderAllSchedule(); // Gọi hàm mới
}

// Các hàm khác (updateEmployeeInfo, requestAdvance, v.v.) giữ nguyên từ phiên bản trước