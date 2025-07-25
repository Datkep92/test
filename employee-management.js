// File: js/employee-management.js

// ================ CALENDAR FUNCTIONS ================
let currentCalendarMonth = new Date().getMonth() + 1;
let currentCalendarYear = new Date().getFullYear();

function renderEmployeeCalendar() {
  const calendar = document.getElementById('employee-calendar');
  if (!calendar) return;

  const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();
  const firstDay = new Date(currentCalendarYear, currentCalendarMonth - 1, 1).getDay() || 7;

  let calendarHTML = `
    <div class="calendar-header">
      <button onclick="changeEmployeeMonth(-1)">❮</button>
      <h3>Tháng ${currentCalendarMonth}/${currentCalendarYear}</h3>
      <button onclick="changeEmployeeMonth(1)">❯</button>
    </div>
    <div class="employee-calendar">
      <div class="calendar-header">CN</div>
      <div class="calendar-header">T2</div>
      <div class="calendar-header">T3</div>
      <div class="calendar-header">T4</div>
      <div class="calendar-header">T5</div>
      <div class="calendar-header">T6</div>
      <div class="calendar-header">T7</div>`;

  for (let i = 1; i < firstDay; i++) {
    calendarHTML += `<div class="day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentCalendarYear}-${String(currentCalendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedules = globalScheduleData.filter(s => s.date === date);
    
    const offCount = schedules.filter(s => s.status === 'off' && s.approvalStatus === 'approved').length;
    const overtimeCount = schedules.filter(s => s.status === 'overtime' && s.approvalStatus === 'approved').length;
    
    let dayClass = 'day';
    let dayContent = `<div class="day-number">${day}</div>`;
    
    if (offCount > 0) {
      dayClass += ' day-off';
      dayContent += `<div class="day-count">Nghỉ: ${offCount}</div>`;
    }
    
    if (overtimeCount > 0) {
      dayClass += ' day-overtime';
      dayContent += `<div class="day-count">Tăng ca: ${overtimeCount}</div>`;
    }
    
    if (offCount === 0 && overtimeCount === 0) {
      dayClass += ' day-normal';
    }

    calendarHTML += `<div class="${dayClass}" onclick="showEmployeeDayDetail('${date}')">${dayContent}</div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}

function changeEmployeeMonth(offset) {
  currentCalendarMonth += offset;
  if (currentCalendarMonth < 1) {
    currentCalendarMonth = 12;
    currentCalendarYear--;
  } else if (currentCalendarMonth > 12) {
    currentCalendarMonth = 1;
    currentCalendarYear++;
  }
  renderEmployeeCalendar();
}

function showEmployeeDayDetail(date) {
  const modal = document.getElementById('employee-day-modal');
  const modalContent = document.getElementById('employee-day-modal-content');
  
  if (!modal || !modalContent) return;

  const schedules = globalScheduleData.filter(s => s.date === date);
  const offEmployees = schedules.filter(s => s.status === 'off' && s.approvalStatus === 'approved');
  const overtimeEmployees = schedules.filter(s => s.status === 'overtime' && s.approvalStatus === 'approved');
  const pendingSchedules = schedules.filter(s => s.approvalStatus === 'pending');
  
  let content = `
    <h3>Chi tiết ngày: ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    <div class="employee-day-details">
      <div class="employee-day-section">
        <h4>Nhân viên nghỉ (${offEmployees.length})</h4>
        <ul>
          ${offEmployees.map(e => `
            <li>
              ${getEmployeeName(e.employeeId)}
              <button class="small-btn" onclick="showScheduleActionModal('${e.id}')">Sửa</button>
            </li>
          `).join('')}
        </ul>
      </div>
      
      <div class="employee-day-section">
        <h4>Nhân viên tăng ca (${overtimeEmployees.length})</h4>
        <ul>
          ${overtimeEmployees.map(e => `
            <li>
              ${getEmployeeName(e.employeeId)}
              <button class="small-btn" onclick="showScheduleActionModal('${e.id}')">Sửa</button>
            </li>
          `).join('')}
        </ul>
      </div>
      
      <div class="employee-day-section">
        <h4>Yêu cầu chờ duyệt (${pendingSchedules.length})</h4>
        <ul>
          ${pendingSchedules.map(s => `
            <li>
              ${getEmployeeName(s.employeeId)} - 
              ${s.status === 'off' ? 'Nghỉ' : 'Tăng ca'}
              <button class="small-btn" onclick="showScheduleApprovalModal('${s.id}')">Xử lý</button>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
    
    <div class="employee-day-actions">
      <h4>Thêm lịch cho nhân viên</h4>
      <div class="input-group">
        <select id="employee-day-select">
          <option value="">Chọn nhân viên</option>
          ${globalEmployeeData.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
        </select>
        <select id="employee-day-type">
          <option value="off">Nghỉ</option>
          <option value="overtime">Tăng ca</option>
        </select>
        <button class="primary-btn" onclick="addEmployeeSchedule('${date}')">Thêm</button>
      </div>
      
      <h4>Ghi chú chung</h4>
      <textarea id="employee-day-note" placeholder="Ghi chú cho ngày này"></textarea>
      <button class="primary-btn" onclick="saveDayNote('${date}')">Lưu ghi chú</button>
    </div>
    
    <button class="primary-btn" onclick="closeModal('employee-day-modal')">Đóng</button>
  `;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

function addEmployeeSchedule(date) {
  const employeeId = document.getElementById('employee-day-select').value;
  const scheduleType = document.getElementById('employee-day-type').value;
  
  if (!employeeId) {
    alert('Vui lòng chọn nhân viên');
    return;
  }
  
  const scheduleId = `${date}_${employeeId}`;
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  
  const scheduleData = {
    id: scheduleId,
    employeeId: employeeId,
    employeeName: employee.name,
    date: date,
    status: scheduleType,
    approvalStatus: 'approved',
    timestamp: Date.now()
  };

  db.ref('schedules/' + scheduleId).set(scheduleData)
    .then(() => {
      globalScheduleData.push(scheduleData);
      alert('Đã thêm lịch thành công!');
      renderEmployeeCalendar();
      closeModal('employee-day-modal');
    })
    .catch(err => alert('Lỗi khi thêm lịch: ' + err.message));
}

function saveDayNote(date) {
  const note = document.getElementById('employee-day-note').value;
  db.ref('dayNotes/' + date).set(note)
    .then(() => alert('Đã lưu ghi chú thành công!'))
    .catch(err => alert('Lỗi khi lưu ghi chú: ' + err.message));
}

// ================ SCHEDULE APPROVAL ================
function renderScheduleApprovalList() {
  const container = document.getElementById("schedule-approval-list");
  if (!container) return;
  
  const pendingSchedules = globalScheduleData
    .filter(s => s.approvalStatus === "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pendingSchedules.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu lịch làm việc nào cần duyệt.</p>";
    return;
  }

  container.innerHTML = `
    <table class="approval-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Loại</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${pendingSchedules.map(s => {
          const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
          return `
            <tr>
              <td>${s.date ? new Date(s.date).toLocaleDateString('vi-VN') : "N/A"}</td>
              <td>${s.employeeName || "Không rõ"}</td>
              <td>${statusText}</td>
              <td>Chờ duyệt</td>
              <td>
                <button class="action-btn approve" onclick="approveSchedule('${s.id}')">Duyệt</button>
                <button class="action-btn reject" onclick="rejectSchedule('${s.id}')">Từ chối</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderScheduleHistory() {
  const container = document.getElementById("schedule-history");
  if (!container) return;

  const processedSchedules = globalScheduleData
    .filter(s => s.approvalStatus !== "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (processedSchedules.length === 0) {
    container.innerHTML = "<p>Chưa có lịch sử duyệt lịch làm việc.</p>";
    return;
  }

  container.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Loại</th>
          <th>Trạng thái</th>
          <th>Ngày xử lý</th>
        </tr>
      </thead>
      <tbody>
        ${processedSchedules.map(s => {
          const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
          const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : "Từ chối";
          const approvalClass = s.approvalStatus === "approved" ? "approved" : "rejected";
          const processDate = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('vi-VN') : "N/A";
          
          return `
            <tr>
              <td>${s.date ? new Date(s.date).toLocaleDateString('vi-VN') : "N/A"}</td>
              <td>${s.employeeName || "Không rõ"}</td>
              <td>${statusText}</td>
              <td class="${approvalClass}">${approvalText}</td>
              <td>${processDate}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ================ ADVANCE APPROVAL ================
function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) return;
  
  const pendingAdvances = globalAdvanceRequests
    .filter(a => a.status === "pending")
    .sort((a, b) => b.timestamp - a.timestamp);

  if (pendingAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng nào cần duyệt.</p>";
    return;
  }

  container.innerHTML = `
    <table class="approval-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Số tiền</th>
          <th>Lý do</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${pendingAdvances.map(a => `
          <tr>
            <td>${a.date ? new Date(a.date).toLocaleDateString('vi-VN') : "N/A"}</td>
            <td>${a.employeeName || "Không rõ"}</td>
            <td>${(a.amount || 0).toLocaleString('vi-VN')} VND</td>
            <td>${a.reason || "Không có"}</td>
            <td>
              <button class="action-btn approve" onclick="approveAdvance('${a.id}', 'approved')">Duyệt</button>
              <button class="action-btn reject" onclick="rejectAdvance('${a.id}')">Từ chối</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) return;

  const processedAdvances = globalAdvanceRequests
    .filter(a => a.status !== "pending")
    .sort((a, b) => b.timestamp - a.timestamp);

  if (processedAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có lịch sử tạm ứng.</p>";
    return;
  }

  container.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Số tiền</th>
          <th>Lý do</th>
          <th>Trạng thái</th>
          <th>Ngày xử lý</th>
        </tr>
      </thead>
      <tbody>
        ${processedAdvances.map(a => {
          const statusText = a.status === "approved" ? "Đã duyệt" : "Từ chối";
          const statusClass = a.status === "approved" ? "approved" : "rejected";
          const processDate = a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('vi-VN') : "N/A";
          
          return `
            <tr>
              <td>${a.date ? new Date(a.date).toLocaleDateString('vi-VN') : "N/A"}</td>
              <td>${a.employeeName || "Không rõ"}</td>
              <td>${(a.amount || 0).toLocaleString('vi-VN')} VND</td>
              <td>${a.reason || "Không có"}</td>
              <td class="${statusClass}">${statusText}</td>
              <td>${processDate}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function showAdvanceApprovalModal(advanceId) {
  const modal = document.getElementById("advance-approval-modal");
  const modalContent = document.getElementById("advance-approval-modal-content");
  
  if (!modal || !modalContent) return;
  
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('advance-approval-modal')">×</span>
    <h3>Xử lý tạm ứng</h3>
    <div class="advance-detail">
      <p><strong>Nhân viên:</strong> ${advance.employeeName}</p>
      <p><strong>Ngày:</strong> ${advance.date ? new Date(advance.date).toLocaleDateString('vi-VN') : "N/A"}</p>
      <p><strong>Số tiền:</strong> ${(advance.amount || 0).toLocaleString('vi-VN')} VND</p>
      <p><strong>Lý do:</strong> ${advance.reason || "Không có"}</p>
    </div>
    <div class="input-group">
      <label for="approval-reason">Lý do (nếu từ chối):</label>
      <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)"></textarea>
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="approveAdvance('${advanceId}', 'approved')">Duyệt</button>
      <button class="secondary-btn" onclick="rejectAdvance('${advanceId}')">Từ chối</button>
    </div>
  `;
  
  modal.style.display = "block";
}

function rejectAdvance(advanceId) {
  const reason = document.getElementById("approval-reason").value.trim();
  if (!reason) {
    alert("Vui lòng nhập lý do từ chối!");
    return;
  }
  approveAdvance(advanceId, 'denied', reason);
}

// ================ EMPLOYEE MANAGEMENT ================
function renderEmployeeList() {
  const container = document.getElementById("employee-list");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (globalEmployeeData.length === 0) {
    container.innerHTML = "<p>Chưa có nhân viên nào.</p>";
    return;
  }

  container.innerHTML = `
    <table class="employee-table">
      <thead>
        <tr>
          <th>Tên</th>
          <th>Vai trò</th>
          <th>Lương/ngày</th>
          <th>Phụ cấp</th>
          <th>Phí khác</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${globalEmployeeData.map(employee => `
          <tr>
            <td>${employee.name}</td>
            <td>${employee.role || 'Nhân viên'}</td>
            <td>${(employee.dailyWage || 0).toLocaleString('vi-VN')} VND</td>
            <td>${(employee.allowance || 0).toLocaleString('vi-VN')} VND</td>
            <td>${(employee.otherFee || 0).toLocaleString('vi-VN')} VND</td>
            <td class="action-buttons">
              <button class="action-btn edit" onclick="showEditEmployeeForm('${employee.id}')">Sửa</button>
              <button class="action-btn delete" onclick="deleteEmployee('${employee.id}')">Xóa</button>
              <button class="action-btn chat" onclick="startEmployeeChat('${employee.id}')">Chat</button>
              <button class="action-btn details" onclick="showEmployeeFinancials('${employee.id}')">Chi tiết</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showEditEmployeeForm(employeeId) {
  const modal = document.getElementById("employee-modal");
  const modalContent = document.getElementById("employee-modal-content");
  
  if (!modal || !modalContent) return;
  
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;
  
  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('employee-modal')">×</span>
    <h3>Cập nhật nhân viên</h3>
    <div class="input-group">
      <label for="employee-name">Họ tên:</label>
      <input type="text" id="employee-name" value="${employee.name || ''}">
    </div>
    <div class="input-group">
      <label for="employee-email">Email:</label>
      <input type="email" id="employee-email" value="${employee.email || ''}">
    </div>
    <div class="input-group">
      <label for="employee-daily-wage">Lương ngày (VND):</label>
      <input type="number" id="employee-daily-wage" value="${employee.dailyWage || 0}">
    </div>
    <div class="input-group">
      <label for="employee-allowance">Phụ cấp (VND):</label>
      <input type="number" id="employee-allowance" value="${employee.allowance || 0}">
    </div>
    <div class="input-group">
      <label for="employee-other-fee">Phí khác (VND):</label>
      <input type="number" id="employee-other-fee" value="${employee.otherFee || 0}">
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="updateEmployee('${employeeId}')">Cập nhật</button>
      <button class="secondary-btn" onclick="closeModal('employee-modal')">Hủy</button>
    </div>
  `;
  
  modal.style.display = "block";
}

function updateEmployee(employeeId) {
  const employee = {
    name: document.getElementById("employee-name").value,
    email: document.getElementById("employee-email").value,
    dailyWage: parseFloat(document.getElementById("employee-daily-wage").value) || 0,
    allowance: parseFloat(document.getElementById("employee-allowance").value) || 0,
    otherFee: parseFloat(document.getElementById("employee-other-fee").value) || 0,
    role: "employee"
  };
  
  db.ref(`employees/${employeeId}`).update(employee)
    .then(() => {
      alert("Cập nhật nhân viên thành công!");
      closeModal("employee-modal");
      renderEmployeeList();
    })
    .catch(err => alert("Lỗi khi cập nhật nhân viên: " + err.message));
}

function deleteEmployee(employeeId) {
  if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

  const updates = {};
  updates[`employees/${employeeId}`] = null;
  
  // Xóa lịch liên quan
  globalScheduleData
    .filter(s => s.employeeId === employeeId)
    .forEach(s => {
      updates[`schedules/${s.id}`] = null;
    });
  
  // Xóa tạm ứng liên quan
  globalAdvanceRequests
    .filter(a => a.employeeId === employeeId)
    .forEach(a => {
      updates[`advances/${a.id}`] = null;
    });
  
  db.ref().update(updates)
    .then(() => {
      globalEmployeeData = globalEmployeeData.filter(e => e.id !== employeeId);
      globalScheduleData = globalScheduleData.filter(s => s.employeeId !== employeeId);
      globalAdvanceRequests = globalAdvanceRequests.filter(a => a.employeeId !== employeeId);
      
      alert("Xóa nhân viên thành công!");
      renderEmployeeList();
      renderEmployeeCalendar();
    })
    .catch(err => alert("Lỗi khi xóa nhân viên: " + err.message));
}

function showEmployeeFinancials(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;
  
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  
  const schedules = globalScheduleData.filter(s => 
    s.employeeId === employeeId && 
    s.date.startsWith(`${year}-${String(month).padStart(2, '0')}`) &&
    s.approvalStatus === "approved"
  );
  
  const workDays = schedules.filter(s => s.status === "normal").length;
  const offDays = schedules.filter(s => s.status === "off").length;
  const overtimeDays = schedules.filter(s => s.status === "overtime").length;
  
  const baseSalary = workDays * employee.dailyWage;
  const overtimePay = overtimeDays * employee.dailyWage * 1.5;
  const allowance = employee.allowance || 0;
  const otherFee = employee.otherFee || 0;
  
  const advances = globalAdvanceRequests
    .filter(a => 
      a.employeeId === employeeId && 
      a.status === "approved" &&
      new Date(a.timestamp).getMonth() + 1 === month
    )
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  
  const totalSalary = baseSalary + overtimePay + allowance - otherFee - advances;
  
  const modal = document.getElementById("employee-financial-modal");
  const modalContent = document.getElementById("employee-financial-modal-content");
  
  if (!modal || !modalContent) return;
  
  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('employee-financial-modal')">×</span>
    <h3>Thông tin tài chính: ${employee.name}</h3>
    <div class="financial-details">
      <p><strong>Tháng:</strong> ${month}/${year}</p>
      <p><strong>Ngày công:</strong> ${workDays}</p>
      <p><strong>Ngày nghỉ:</strong> ${offDays}</p>
      <p><strong>Ngày tăng ca:</strong> ${overtimeDays}</p>
      <hr>
      <p><strong>Lương cơ bản:</strong> ${baseSalary.toLocaleString('vi-VN')} VND</p>
      <p><strong>Tiền tăng ca:</strong> ${overtimePay.toLocaleString('vi-VN')} VND</p>
      <p><strong>Phụ cấp:</strong> ${allowance.toLocaleString('vi-VN')} VND</p>
      <p><strong>Phí khác:</strong> -${otherFee.toLocaleString('vi-VN')} VND</p>
      <p><strong>Tạm ứng:</strong> -${advances.toLocaleString('vi-VN')} VND</p>
      <hr>
      <p class="total-salary"><strong>Tổng lương:</strong> ${totalSalary.toLocaleString('vi-VN')} VND</p>
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="closeModal('employee-financial-modal')">Đóng</button>
    </div>
  `;
  
  modal.style.display = "block";
}

function startEmployeeChat(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;
  
  document.getElementById("chat-employee-select").value = employeeId;
  loadEmployeeChat(employeeId);
  
  // Scroll to chat section
  document.getElementById("employee-chat").scrollIntoView({ behavior: 'smooth' });
}

// ================ NOTIFICATION FUNCTIONS ================
function sendGeneralNotification() {
  const message = document.getElementById("general-notification-text").value.trim();
  if (!message) {
    alert("Vui lòng nhập nội dung thông báo!");
    return;
  }

  const notification = {
    id: 'notif-' + Date.now(),
    message: message,
    timestamp: Date.now(),
    sender: "Quản lý",
    isRead: false
  };

  // Gửi đến tất cả nhân viên
  globalEmployeeData.forEach(employee => {
    db.ref(`notifications/${employee.id}/${notification.id}`).set(notification)
      .then(() => {
        // Gửi thông báo realtime
        db.ref(`messages/group`).push({
          message: `THÔNG BÁO: ${message}`,
          senderId: "manager",
          senderName: "Quản lý",
          timestamp: Date.now()
        });
      });
  });

  // Lưu thông báo chung
  db.ref(`notifications/general/${notification.id}`).set(notification)
    .then(() => {
      globalGeneralNotifications.push(notification);
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
  
  container.innerHTML = `
    <table class="notification-table">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Nội dung</th>
          <th>Người gửi</th>
        </tr>
      </thead>
      <tbody>
        ${globalGeneralNotifications.sort((a, b) => b.timestamp - a.timestamp).map(n => `
          <tr>
            <td>${new Date(n.timestamp).toLocaleString('vi-VN')}</td>
            <td>${n.message}</td>
            <td>${n.sender || "Quản lý"}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ================ CHAT FUNCTIONS ================
function renderEmployeeChat(employeeId) {
  const container = document.getElementById("employee-chat");
  if (!container) return;
  
  container.innerHTML = `
    <div class="chat-header">
      <h3>Chat với nhân viên</h3>
      <select id="chat-employee-select" onchange="loadEmployeeChat(this.value)">
        <option value="">Chọn nhân viên</option>
        ${globalEmployeeData.map(emp => 
          `<option value="${emp.id}" ${employeeId === emp.id ? 'selected' : ''}>${emp.name}</option>`
        ).join('')}
      </select>
    </div>
    <div id="chat-messages" class="chat-messages"></div>
    <div class="chat-input">
      <textarea id="employee-chat-text" placeholder="Nhập tin nhắn..."></textarea>
      <button class="primary-btn" onclick="sendEmployeeChat()">Gửi</button>
    </div>
  `;
  
  if (employeeId) loadEmployeeChat(employeeId);
}

function loadEmployeeChat(employeeId) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;
  
  messagesContainer.innerHTML = "";
  
  const messages = globalMessages[employeeId] || [];
  if (messages.length === 0) {
    messagesContainer.innerHTML = "<p>Chưa có tin nhắn nào.</p>";
    return;
  }
  
  messages.forEach(msg => {
    const isManager = msg.senderId === "manager";
    const msgElement = document.createElement("div");
    msgElement.className = `chat-message ${isManager ? 'sent' : 'received'}`;
    msgElement.innerHTML = `
      <div class="message-sender">${isManager ? 'Bạn' : msg.senderName || 'Nhân viên'}</div>
      <div class="message-content">${msg.message}</div>
      <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('vi-VN')}</div>
    `;
    messagesContainer.appendChild(msgElement);
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendEmployeeChat() {
  const employeeId = document.getElementById("chat-employee-select").value;
  if (!employeeId) {
    alert("Vui lòng chọn nhân viên để chat!");
    return;
  }
  
  const message = document.getElementById("employee-chat-text").value.trim();
  if (!message) {
    alert("Vui lòng nhập nội dung tin nhắn!");
    return;
  }
  
  const chatData = {
    message: message,
    senderId: "manager",
    senderName: "Quản lý",
    timestamp: Date.now()
  };
  
  db.ref(`messages/${employeeId}`).push(chatData)
    .then(() => {
      // Cập nhật UI
      globalMessages[employeeId] = globalMessages[employeeId] || [];
      globalMessages[employeeId].push(chatData);
      loadEmployeeChat(employeeId);
      
      // Gửi thông báo
      db.ref(`notifications/${employeeId}`).push({
        message: `Bạn có tin nhắn mới từ Quản lý`,
        timestamp: Date.now(),
        type: "chat",
        isRead: false
      });
      
      document.getElementById("employee-chat-text").value = "";
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}

// ================ HELPER FUNCTIONS ================
function getEmployeeName(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  return employee ? employee.name : "Không rõ";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// ================ INITIALIZATION ================
function initEmployeeManagement() {
  renderEmployeeCalendar();
  renderEmployeeList();
  renderScheduleApprovalList();
  renderScheduleHistory();
  renderAdvanceApprovalList();
  renderAdvanceHistory();
  renderGeneralNotifications();
}

// Gọi hàm khởi tạo khi tab được mở
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('employee-management')) {
    initEmployeeManagement();
  }
});