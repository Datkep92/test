
// Thêm ở đầu file
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('profile')) {
    initProfile();
  }
});

function loadPayrollDetails(employeeId) {
  const emp = globalEmployeeData.find(e => e.id === employeeId);
  if (!emp) return;

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthKey = `${year}-${month + 1 < 10 ? '0' + (month + 1) : (month + 1)}`;

  // Lọc lịch làm việc của nhân viên trong tháng
  const schedules = globalScheduleData.filter(s => {
    const d = new Date(s.date);
    return (
      s.employeeId === employeeId &&
      d.getMonth() === month &&
      d.getFullYear() === year &&
      s.approvalStatus === 'approved'
    );
  });

  const daysOff = schedules.filter(s => s.status === 'off').length;
  const daysOT = schedules.filter(s => s.status === 'overtime').length;
  const workingDays = new Date(year, month + 1, 0).getDate() - daysOff + daysOT;

  Promise.all([
    firebase.database().ref(`employeeSettings/${employeeId}`).once('value'),
    firebase.database().ref(`payrolls/${employeeId}/${monthKey}`).once('value')
  ]).then(([settingSnap, payrollSnap]) => {
    const settings = settingSnap.val() || {};
    const payroll = payrollSnap.val() || {};

    const wage = settings.wagePerHour || 20000;
    const hours = settings.hoursPerDay || 8;
    const bonus = payroll.bonus || 0;
    const penalty = payroll.penalty || 0;
    const bonusNote = payroll.bonusNote || '';
    const penaltyNote = payroll.penaltyNote || '';

    const salary = wage * hours * workingDays + bonus - penalty;

    const container = document.getElementById("payroll-details-container");
    if (!container) return;

    container.innerHTML = `
      <table class="table-style">
        <tr><td><strong>Tháng</strong></td><td>${month + 1}/${year}</td></tr>
        <tr><td><strong>Họ tên</strong></td><td>${emp.name}</td></tr>
        <tr><td><strong>Ngày công</strong></td><td>${workingDays}</td></tr>
        <tr><td><strong>Ngày nghỉ</strong></td><td>${daysOff}</td></tr>
        <tr><td><strong>Ngày tăng ca</strong></td><td>${daysOT}</td></tr>
        <tr><td><strong>Chế tài</strong></td><td>${penalty.toLocaleString()} VND<br><em>${penaltyNote}</em></td></tr>
        <tr><td><strong>Thưởng</strong></td><td>${bonus.toLocaleString()} VND<br><em>${bonusNote}</em></td></tr>
        <tr><td><strong>Tổng lương thực lãnh</strong></td><td><strong style="color: green;">${salary.toLocaleString()} VND</strong></td></tr>
      </table>
    `;
  }).catch(err => {
    console.error("Lỗi khi load bảng lương:", err);
  });
}

function prepareSwapRequest(date) {
  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const employees = globalEmployeeData.filter(e => e.id !== currentEmployeeId && e.active);
  if (!employees.length) {
    alert("Không có nhân viên nào để đổi ca!");
    return;
  }

  const selectHTML = `
    <h3>Chọn nhân viên để đổi ca ngày ${date}</h3>
    <select id="swap-employee">
      ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
    </select>
    <div class="button-group">
      <button onclick="submitScheduleRequest('${date}', 'swap', document.getElementById('swap-employee').value)">Xác nhận</button>
      <button onclick="closeModal('action-modal')">Hủy</button>
    </div>
  `;

  content.innerHTML = selectHTML;
  modal.style.display = "block";
}
function initProfile() {
  // Đảm bảo các biến đã được khởi tạo
  currentMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();
  
  loadFirebaseData(() => {
    setupRealtimeListeners();
    renderCalendar();
    renderScheduleRequests();
    renderNotifications();
    renderAdvanceRequests();
    renderOffAndOvertime();
    renderSalarySummary();
  });
}

// Sửa hàm renderCalendar để đảm bảo hiển thị ngay cả khi không có dữ liệu
function renderCalendar() {
  const calendar = document.getElementById('calendar');
  if (!calendar) {
    console.error("Calendar element not found");
    return;
  }

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay() || 7;

  let calendarHTML = `
    <div class="calendar-header">
      <button onclick="changeMonth(-1)">❮</button>
      <h3>Tháng ${currentMonth}/${currentYear}</h3>
      <button onclick="changeMonth(1)">❯</button>
    </div>
    <div class="calendar">
      <div class="calendar-header">CN</div>
      <div class="calendar-header">T2</div>
      <div class="calendar-header">T3</div>
      <div class="calendar-header">T4</div>
      <div class="calendar-header">T5</div>
      <div class="calendar-header">T6</div>
      <div class="calendar-header">T7</div>`;

  // Thêm các ngày trống đầu tháng
  for (let i = 1; i < firstDay; i++) {
    calendarHTML += `<div class="day empty"></div>`;
  }

  // Thêm các ngày trong tháng
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedulesToday = globalScheduleData.filter(s => s.date === dateStr && s.approvalStatus === 'approved');

    const avatarsHTML = schedulesToday.map(s => {
      const initial = s.employeeName?.charAt(0)?.toUpperCase() || "?";
      const bgColor = scheduleStatusColors[s.status] || "#999";
      const statusText = getScheduleTypeText(s);
      return `
        <div class="mini-avatar"
             title="${s.employeeName} - ${statusText}"
             style="background-color: ${bgColor};">
          ${initial}
        </div>`;
    }).join("");

    calendarHTML += `
      <div class="day" onclick="showActionModal('${dateStr}')">
        <div class="day-number">${day}</div>
        <div class="mini-avatar-group">
          ${avatarsHTML}
        </div>
      </div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}
//
// File: js/profile.js
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentScheduleMonth = new Date().getMonth() + 1;
let currentScheduleYear = new Date().getFullYear();






function renderProfile() {
  renderCalendar();
  renderScheduleRequests();
  renderNotifications();
  renderAdvanceRequests();
  renderOffAndOvertime();
  renderSalarySummary();
}





// ================ SCHEDULE FUNCTIONS ================
function showActionModal(date, schedule = null, targetEmployeeId = null) {
  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const viewingEmployeeId = targetEmployeeId || currentEmployeeId;
  const allSchedulesForDate = globalScheduleData.filter(s => s.date === date);
  const currentUser = globalEmployeeData.find(e => e.id === currentEmployeeId);

  let contentHTML = `<h3>Chi tiết lịch ngày ${date}</h3>`;

  if (allSchedulesForDate.length === 0) {
    contentHTML += `<p>Chưa có lịch làm việc nào trong ngày này.</p>`;
  } else {
    contentHTML += `<ul>`;
    allSchedulesForDate.forEach(s => {
      const statusText = getScheduleTypeText(s);
      const approvalText = s.approvalStatus === 'approved'
        ? '✅ Đã duyệt'
        : s.approvalStatus === 'rejected'
          ? '❌ Bị từ chối'
          : '⏳ Chờ duyệt' + (s.cancelRequested ? ' (Yêu cầu hủy)' : '');

      contentHTML += `<li>
        <strong>${s.employeeName}</strong>: ${statusText} (${approvalText})`;

      // Nếu là quản lý & xem lịch người khác & lịch đang chờ duyệt
      if (
        isCurrentUserManager() &&
        s.employeeId !== currentEmployeeId &&
        (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending')
      ) {
        if (s.cancelRequested) {
          contentHTML += `
            <div class="button-group" style="margin-top: 4px;">
              <button onclick="approveCancelSchedule('${s.id}')" class="primary-btn">✔️ Duyệt hủy</button>
              <button onclick="rejectCancelSchedule('${s.id}')" class="secondary-btn">❌  hủy</button>
            </div>`;
        } else {
          contentHTML += `
            <div class="button-group" style="margin-top: 4px;">
              <button onclick="approveSchedule('${s.id}')" class="primary-btn">✔️ Duyệt</button>
              <button onclick="rejectSchedule('${s.id}')" class="secondary-btn">❌ </button>
            </div>`;
        }
      }
      // Nếu là yêu cầu của chính nhân viên hiện tại
      else if (
        s.employeeId === currentEmployeeId &&
        (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending' || s.approvalStatus === 'approved')
      ) {
        contentHTML += `
          <div class="button-group" style="margin-top: 4px;">
            <button onclick="cancelSchedule('${s.id}')" class="secondary-btn">Hủy yêu cầu</button>
          </div>`;
      }

      contentHTML += `</li>`;
    });
    contentHTML += `</ul>`;
  }

  // Nếu là chính mình → hiển thị form gửi yêu cầu
  if (viewingEmployeeId === currentEmployeeId) {
    contentHTML += `
      <div class="schedule-actions">
        <p>Bạn muốn gửi yêu cầu cho ngày này:</p>
        <button onclick="submitScheduleRequest('${date}', 'off')">🛌 Xin nghỉ</button>
        <button onclick="submitScheduleRequest('${date}', 'overtime')">🕒 Tăng ca</button>
        <button onclick="prepareSwapRequest('${date}')">🔁 Đổi ca</button>
      </div>
    `;
  }

  // ✅ Nếu là quản lý → hiển thị form xếp lịch trực tiếp
  if (isCurrentUserManager()) {
    const activeEmployees = globalEmployeeData.filter(e => e.active);
    contentHTML += `
      <hr>
      <div class="schedule-actions">
        <p><strong>Quản lý:</strong> Xếp lịch trực tiếp cho nhân viên:</p>
        <select id="assign-employee-id">
          ${activeEmployees.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
        </select>
        <div class="button-group" style="margin-top: 6px;">
          <button onclick="assignSchedule('${date}', 'off')" class="small-btn">🛌 Nghỉ</button>
          <button onclick="assignSchedule('${date}', 'overtime')" class="small-btn">🕒 Tăng ca</button>
          <button onclick="assignSchedule('${date}', 'swap')" class="small-btn">🔁 Đổi ca</button>
        </div>
      </div>
    `;
  }

  // Nút đóng
  contentHTML += `
    <div class="button-group" style="margin-top: 12px;">
      <button onclick="closeModal('action-modal')" class="secondary-btn">Đóng</button>
    </div>
  `;

  content.innerHTML = contentHTML;
  modal.style.display = "block";
}

function approveCancelSchedule(scheduleId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền phê duyệt!');
    return;
  }
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule || !schedule.cancelRequested) {
    showToastNotification('Yêu cầu hủy không tồn tại!');
    return;
  }

  const updates = {};
  updates[`schedules/${scheduleId}`] = null;

  // Thông báo cho nhân viên
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu hủy ${statusText} ngày ${schedule.date} đã được phê duyệt`,
    timestamp: Date.now(),
    type: 'cancel_approval',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      showToastNotification('Đã phê duyệt hủy yêu cầu!');
      closeModal('action-modal');
      renderScheduleRequests();
      renderCalendar();
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error approving cancel:', err);
    });
}

function rejectCancelSchedule(scheduleId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền từ chối!');
    return;
  }
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule || !schedule.cancelRequested) {
    showToastNotification('Yêu cầu hủy không tồn tại!');
    return;
  }

  const reason = prompt('Lý do từ chối hủy:');
  if (!reason) return;

  const updates = {};
  updates[`schedules/${scheduleId}/cancelRequested`] = null;
  updates[`schedules/${scheduleId}/cancelRequestedAt`] = null;

  // Thông báo cho nhân viên
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu hủy ${statusText} ngày ${schedule.date} bị từ chối: ${reason}`,
    timestamp: Date.now(),
    type: 'cancel_rejection',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      showToastNotification('Đã từ chối hủy yêu cầu!');
      closeModal('action-modal');
      renderScheduleRequests();
      renderCalendar();
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error rejecting cancel:', err);
    });
}

function approveSchedule(scheduleId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền phê duyệt!');
    return;
  }
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }
  db.ref(`schedules/${scheduleId}`).update({ approvalStatus: 'approved' })
    .then(() => {
      db.ref(`notifications/${schedule.employeeId}`).push({
        message: `Yêu cầu ${schedule.status} ngày ${schedule.date} đã được phê duyệt`,
        timestamp: Date.now(),
        read: false
      });
      showToastNotification('Đã phê duyệt yêu cầu!');
      closeModal('action-modal'); // Tự động đóng popup
      renderScheduleRequests(); // Cập nhật danh sách trạng thái
      renderCalendar(); // Cập nhật lịch
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error approving schedule:', err);
    });
}
// ====== Hiển thị danh sách nhân viên cho quản lý ======
function renderEmployeeList() {
  const container = document.getElementById("employee-list-container");
  if (!container) return;

  const currentUser = auth.currentUser;
  if (!currentUser || !globalEmployeeData.length) return;

  const currentEmployee = globalEmployeeData.find(e => e.id === currentUser.uid);
  if (!currentEmployee) return;

  let rows = "";

  if (currentEmployee.role === "manager" || currentEmployee.role === "admin") {
    // ✅ Quản lý xem toàn bộ
    rows = globalEmployeeData.map(emp => `
      <tr onclick="showPayrollModal('${emp.id}')">
        <td>${emp.name}</td>
        <td>${emp.phone || "Không rõ"}</td>
        <td>${emp.address}</td>
      </tr>
    `).join("");
  } else {
    // ✅ Nhân viên chỉ xem chính mình
    rows = `
      <tr onclick="showPayrollModal('${currentEmployee.id}')">
        <td>${currentEmployee.name}</td>
        <td>${currentEmployee.phone || "Không rõ"}</td>
        <td>${currentEmployee.address}</td>
      </tr>
    `;
  }

  container.innerHTML = `
    <table class="table-style">
      <thead>
        <tr>
          <th>Tên</th>
          <th>SĐT</th>
          <th>Địa chỉ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateUserProfile() {
  const nameInput = document.getElementById('name-input');
  const phoneInput = document.getElementById('phone-input');
  const addressInput = document.getElementById('address-input');
  const noteInput = document.getElementById('note-input');

  if (!nameInput || !phoneInput || !addressInput) {
    showToastNotification('Vui lòng điền đầy đủ thông tin!');
    return;
  }

  const updatedData = {
    name: nameInput.value.trim() || "Chưa rõ tên",
    sdt: phoneInput.value.trim() || "",
    address: addressInput.value.trim() || ""
  };
  if (noteInput) updatedData.note = noteInput.value.trim() || "";

  db.ref(`users/${currentEmployeeId}`).update(updatedData)
    .then(() => {
      showToastNotification('Cập nhật thông tin thành công!');
      const userIndex = globalEmployeeData.findIndex(e => e.id === currentEmployeeId);
      if (userIndex !== -1) {
        globalEmployeeData[userIndex] = { ...globalEmployeeData[userIndex], ...updatedData };
      }
    })
    .catch(err => {
      showToastNotification('Lỗi khi cập nhật thông tin!');
      console.error("❌ Error updating profile:", err.message);
    });
}
function rejectSchedule(scheduleId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền từ chối!');
    return;
  }
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }
  const reason = prompt('Lý do từ chối:');
  if (!reason) return;
  db.ref(`schedules/${scheduleId}`).update({ approvalStatus: 'rejected', rejectReason: reason })
    .then(() => {
      db.ref(`notifications/${schedule.employeeId}`).push({
        message: `Yêu cầu ${schedule.status} ngày ${schedule.date} bị từ chối: ${reason}`,
        timestamp: Date.now(),
        read: false
      });
      showToastNotification('Đã từ chối yêu cầu!');
      closeModal('action-modal'); // Tự động đóng popup
      renderScheduleRequests(); // Cập nhật danh sách trạng thái
      renderCalendar(); // Cập nhật lịch
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error rejecting schedule:', err);
    });
}
function renderScheduleRequests() {
  const container = document.getElementById("schedule-requests-container");
  if (!container) return;

  const isManager = isCurrentUserManager();
  const expanded = container.dataset.expanded === "true";

  let requests = isManager
    ? globalScheduleData
    : globalScheduleData.filter(s => s.employeeId === currentEmployeeId);

  // ✅ Nhóm yêu cầu
  const pendingRequests = requests.filter(s =>
    s.approvalStatus === "pending" ||
    s.approvalStatus === "swapPending" ||
    s.cancelRequested
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const processedRequests = requests.filter(s =>
    s.approvalStatus === "approved" ||
    s.approvalStatus === "rejected"
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const sortedRequests = [...pendingRequests, ...processedRequests];

  const displayRequests = expanded ? sortedRequests : sortedRequests.slice(0, 3);

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Yêu Cầu Lịch Làm Việc</h3>
      ${sortedRequests.length > 3 ? `
        <button class="small-btn" onclick="toggleRequestList()">
          ${expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ` : ""}
    </div>
    ${displayRequests.length > 0 ? `
      <table class="schedule-requests-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân viên</th>
            <th>Loại</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${displayRequests.map(s => {
            const date = new Date(s.date).toLocaleDateString("vi-VN");
            const name = s.employeeName || "Không xác định";
            const typeText = getScheduleTypeText(s);

            // ✅ Badge trạng thái với click
            let statusCell = "";
            if (s.approvalStatus === "pending" || s.approvalStatus === "swapPending") {
              if (isManager) {
                statusCell = `<span class="badge badge-warning clickable" onclick="showScheduleActionModal('${s.id}', 'process')">Chờ duyệt</span>`;
              } else if (s.employeeId === currentEmployeeId) {
                statusCell = `<span class="badge badge-warning clickable" onclick="confirmCancel('${s.id}')">Chờ duyệt</span>`;
              } else {
                statusCell = `<span class="badge badge-warning">Chờ duyệt</span>`;
              }
            } else if (s.approvalStatus === "approved") {
              statusCell = `<span class="badge badge-success">Đã duyệt</span>`;
            } else if (s.approvalStatus === "rejected") {
statusCell = `<span class="badge badge-danger clickable" onclick="showRejectReason('${s.rejectReason || ''}')">Từ chối</span>`;
            }

            if (s.cancelRequested) {
              statusCell += ` <span class="badge badge-cancel">Yêu cầu hủy</span>`;
            }

            return `
              <tr>
                <td>${date}</td>
                <td>${name}</td>
                <td>${typeText}</td>
                <td>${statusCell}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    ` : "<p style='color:red;'>⚠ Không có yêu cầu lịch làm việc nào</p>"}
  `;
}

function showRejectReason(reason) {
  if (!reason || reason.trim() === "") {
    alert("Không có lý do từ chối được ghi lại.");
  } else {
    alert("Lý do từ chối: " + reason);
  }
}

function submitScheduleRequest(date, status, targetEmployeeId = null) {
  const scheduleId = `${date}_${currentEmployeeId}`;

  if (!isEmployeeDataLoaded || !globalEmployeeData || globalEmployeeData.length === 0) {
    showToastNotification('Dữ liệu nhân viên chưa sẵn sàng. Vui lòng thử lại sau vài giây.');
    console.warn('globalEmployeeData not ready');
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee || !employee.name) {
    showToastNotification('Lỗi: Không tìm thấy thông tin nhân viên hiện tại');
    console.error('Employee not found for ID:', currentEmployeeId);
    return;
  }

  const scheduleData = {
    id: scheduleId,
    employeeId: currentEmployeeId,
    employeeName: employee.name,
    date: date,
    status: status,
    approvalStatus: status === 'swap' ? 'swapPending' : 'pending',
    timestamp: Date.now(),
    ...(targetEmployeeId && { targetEmployeeId })
  };

  // ✅ Lưu lên Firebase
  db.ref('schedules/' + scheduleId).set(scheduleData)
    .then(() => {
      // ✅ Cập nhật ngay globalScheduleData
      const existingIndex = globalScheduleData.findIndex(s => s.id === scheduleId);
      if (existingIndex !== -1) {
        globalScheduleData[existingIndex] = scheduleData;
      } else {
        globalScheduleData.push(scheduleData);
      }

      // ✅ Render ngay danh sách và calendar
      renderCalendar();
      renderScheduleRequests();

      // ✅ Hiển thị thông báo
      showToastNotification(`✅ Đã gửi yêu cầu ${getScheduleTypeText(scheduleData)} thành công`);
      closeModal('action-modal');

      // ✅ Gửi thông báo cho quản lý
      const notificationMessage = status === 'swap'
        ? `${employee.name} yêu cầu đổi ca ngày ${date} với ${getEmployeeName(targetEmployeeId)}`
        : `${employee.name} yêu cầu ${status === 'off' ? 'nghỉ' : 'tăng ca'} ngày ${date}`;

      db.ref('notifications/manager').push({
        message: notificationMessage,
        timestamp: Date.now(),
        type: 'schedule_request',
        scheduleId,
        isRead: false
      });

      // ✅ Nếu là đổi ca → thông báo cho nhân viên được nhắm đến
      if (status === 'swap' && targetEmployeeId) {
        db.ref(`notifications/${targetEmployeeId}`).push({
          message: `${employee.name} muốn đổi ca với bạn ngày ${date}`,
          timestamp: Date.now(),
          type: 'swap_request',
          scheduleId,
          isRead: false
        });
      }

      console.log("✅ Submitted schedule:", scheduleData);
    })
    .catch(err => {
      showToastNotification(`Lỗi khi gửi yêu cầu: ${err.message}`);
      console.error('Firebase error:', err);
    });
}

function updateEmployeeInfo() {
  const name = document.getElementById("personal-employee-name").value.trim();
  const address = document.getElementById("employee-address").value.trim();
  const phone = document.getElementById("employee-phone").value.trim();
  const note = document.getElementById("employee-note").value.trim();

  if (!name) {
    alert("Vui lòng nhập họ tên.");
    return;
  }

  if (!currentEmployeeId) {
    alert("Không xác định được ID nhân viên hiện tại.");
    return;
  }

  db.ref(`users/${currentEmployeeId}`).update({
    name,
    address,
    phone,
    note
  })
  .then(() => {
    showToastNotification("✅ Đã cập nhật thông tin cá nhân.");
    // Cập nhật lại tên nếu có nơi đang hiển thị tên cũ
    const emp = globalEmployeeData.find(e => e.id === currentEmployeeId);
    if (emp) emp.name = name;
    renderEmployeeList?.();  // render lại danh sách nếu cần
  })
  .catch(err => {
    alert("❌ Lỗi khi cập nhật: " + err.message);
  });
}


function cancelSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }

  // Nếu yêu cầu đang chờ duyệt (pending hoặc swapPending), hủy trực tiếp
  if (schedule.approvalStatus === 'pending' || schedule.approvalStatus === 'swapPending') {
    if (!confirm('Bạn chắc chắn muốn hủy yêu cầu này?')) return;

    const updates = {};
    updates[`schedules/${scheduleId}`] = null;

    db.ref().update(updates)
      .then(() => {
        showToastNotification('Đã hủy yêu cầu thành công');
        closeModal('action-modal'); // Đóng popup
        renderScheduleRequests(); // Cập nhật danh sách
        renderCalendar(); // Cập nhật lịch
      })
      .catch(err => showToastNotification(`Lỗi: ${err.message}`));
  }
  // Nếu yêu cầu đã được duyệt (approved), yêu cầu xác nhận từ quản lý
  else if (schedule.approvalStatus === 'approved') {
    if (!confirm('Yêu cầu đã được duyệt. Hủy yêu cầu này sẽ thông báo cho quản lý để xác nhận. Bạn có muốn tiếp tục?')) return;

    const updates = {};
    // Cập nhật trạng thái thành swapPending để chờ quản lý xác nhận
    updates[`schedules/${scheduleId}/approvalStatus`] = 'swapPending';
    updates[`schedules/${scheduleId}/cancelRequested`] = true;
    updates[`schedules/${scheduleId}/cancelRequestedAt`] = Date.now();

    // Thông báo cho quản lý
    const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
    updates[`notifications/manager/notif_${Date.now()}`] = {
      message: `${schedule.employeeName} yêu cầu hủy ${statusText} đã duyệt ngày ${schedule.date}`,
      timestamp: Date.now(),
      type: 'cancel_request',
      scheduleId,
      isRead: false
    };

    db.ref().update(updates)
      .then(() => {
        showToastNotification('Đã gửi yêu cầu hủy đến quản lý');
        closeModal('action-modal'); // Đóng popup
        renderScheduleRequests(); // Cập nhật danh sách
        renderCalendar(); // Cập nhật lịch
      })
      .catch(err => showToastNotification(`Lỗi: ${err.message}`));
  }
}

function respondToSwapRequest(scheduleId, accept) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule || schedule.approvalStatus !== 'swapPending') {
    alert('Yêu cầu đổi ca không hợp lệ hoặc đã được xử lý!');
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  const requester = globalEmployeeData.find(e => e.id === schedule.employeeId);
  if (!employee || !requester) {
    alert('Không tìm thấy thông tin nhân viên!');
    return;
  }

  const updates = {};
  
  if (accept) {
    // Tạo lịch nghỉ cho nhân viên đồng ý đổi ca
    const swapScheduleId = `${schedule.date}_${currentEmployeeId}`;
    updates[`schedules/${swapScheduleId}`] = {
      id: swapScheduleId,
      employeeId: currentEmployeeId,
      employeeName: employee.name,
      date: schedule.date,
      status: 'off',
      approvalStatus: 'approved',
      timestamp: Date.now()
    };

    // Duyệt yêu cầu đổi ca
    updates[`schedules/${scheduleId}/approvalStatus`] = 'approved';
    updates[`schedules/${scheduleId}/updatedAt`] = Date.now();
    
    // Thông báo cho người yêu cầu
    updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
      message: `${employee.name} đã đồng ý đổi ca ngày ${schedule.date}`,
      timestamp: Date.now(),
      type: 'swap_approval',
      isRead: false
    };

    // Thông báo cho quản lý
    updates[`notifications/manager/notif_${Date.now()}`] = {
      message: `${employee.name} đã đồng ý đổi ca ngày ${schedule.date} với ${requester.name}`,
      timestamp: Date.now(),
      type: 'swap_confirmation',
      isRead: false
    };

    db.ref().update(updates)
      .then(() => {
        showToastNotification('Đã đồng ý đổi ca!');
        closeModal('action-modal');
      })
      .catch(err => showToastNotification(`Lỗi: ${err.message}`));
  } else {
    // Từ chối yêu cầu
    updates[`schedules/${scheduleId}`] = null;
    
    // Thông báo cho người yêu cầu
    updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
      message: `${employee.name} đã từ chối đổi ca ngày ${schedule.date}`,
      timestamp: Date.now(),
      type: 'swap_rejection',
      isRead: false
    };

    // Thông báo cho quản lý
    updates[`notifications/manager/notif_${Date.now()}`] = {
      message: `${employee.name} đã từ chối đổi ca ngày ${schedule.date} với ${requester.name}`,
      timestamp: Date.now(),
      type: 'swap_rejection',
      isRead: false
    };

    db.ref().update(updates)
      .then(() => {
        showToastNotification('Đã từ chối đổi ca!');
        closeModal('action-modal');
      })
      .catch(err => showToastNotification(`Lỗi: ${err.message}`));
  }
}

// ================ NOTIFICATION FUNCTIONS ================
function renderNotifications() {
  const container = document.getElementById('notifications-container');
  if (!container) return;

  const unreadNotifications = globalNotifications
    .filter(n => !n.isRead)
    .sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = `
    <h3>Thông báo mới (${unreadNotifications.length})</h3>
    ${unreadNotifications.length > 0 ? `
      <ul class="notification-list">
        ${unreadNotifications.map(n => `
          <li class="notification-item ${n.type}">
            <div class="notification-message">${n.message}</div>
            <div class="notification-time">${new Date(n.timestamp).toLocaleString('vi-VN')}</div>
            ${n.type === 'swap_request' ? `
              <div class="notification-actions">
                <button class="small-btn" onclick="respondToSwapRequest('${n.scheduleId}', true)">Đồng ý</button>
                <button class="small-btn" onclick="respondToSwapRequest('${n.scheduleId}', false)">Từ chối</button>
              </div>
            ` : ''}
            <button class="mark-read-btn" onclick="markNotificationAsRead('${n.id}')">Đánh dấu đã đọc</button>
          </li>
        `).join('')}
      </ul>
    ` : '<p>Không có thông báo mới</p>'}
  `;
}

function markNotificationAsRead(notificationId) {
  db.ref(`notifications/${currentEmployeeId}/${notificationId}`).update({
    isRead: true
  })
  .catch(err => console.error('Lỗi đánh dấu thông báo đã đọc:', err));
}
function isManagerView(employeeId) {
  return currentEmployee?.role === "manager" || currentEmployee?.role === "admin";
}
let currentEmployee = null;

// ================ ADVANCE FUNCTIONS ================
// Thêm vào profile.js, trước phần CALENDAR UI
function renderAdvanceRequests() {
  const container = document.getElementById("advance-requests-container");
  if (!container) return;

  const isManager = isCurrentUserManager();
  const expanded = container.dataset.expanded === "true";

  let requests = isManager
    ? globalAdvanceRequests
    : globalAdvanceRequests.filter(a => a.employeeId === currentEmployeeId);

  // ✅ Sắp xếp: ưu tiên pending trước, còn lại theo ngày giảm dần
  const pendingRequests = requests
    .filter(a => a.status === "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const processedRequests = requests
    .filter(a => a.status !== "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const sortedRequests = [...pendingRequests, ...processedRequests];
  const displayRequests = expanded ? sortedRequests : sortedRequests.slice(0, 3);

  // ✅ Render giao diện
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Yêu cầu Tạm ứng</h3>
      ${sortedRequests.length > 3 ? `
        <button class="small-btn" onclick="toggleAdvanceRequestList()">
          ${expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ` : ""}
    </div>
    ${displayRequests.length > 0 ? `
      <div class="schedule-requests-container">
        <table class="schedule-requests-table"> <!-- ✅ Dùng class cũ -->
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhân viên</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${displayRequests.map(a => {
              const date = new Date(a.date).toLocaleDateString("vi-VN");
              const name = a.employeeName || "Không xác định";
              const amount = !isNaN(Number(a.amount))
                ? Number(a.amount).toLocaleString("vi-VN") + " VND"
                : "Không xác định";

              let statusBadge = "";
              if (a.status === "pending") {
                if (isManager) {
                  statusBadge = `<span class="badge badge-warning clickable" onclick="showAdvanceActionModal('${a.id}', 'process')">Chờ duyệt</span>`;
                } else if (a.employeeId === currentEmployeeId) {
                  statusBadge = `<span class="badge badge-warning clickable" onclick="confirmCancelAdvance('${a.id}')">Chờ duyệt</span>`;
                } else {
                  statusBadge = `<span class="badge badge-warning">Chờ duyệt</span>`;
                }
              } else if (a.status === "approved") {
                statusBadge = `<span class="badge badge-success">Đã duyệt</span>`;
              } else if (a.status === "denied") {
  statusBadge = `<span class="badge badge-danger clickable" onclick="showRejectReason('${a.rejectReason || ''}')">Từ chối</span>`;
}

              return `
                <tr>
                  <td>${date}</td>
                  <td>${name}</td>
                  <td>${amount}</td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    ` : "<p style='color:red;'>⚠ Không có yêu cầu tạm ứng nào</p>"}
  `;
}
function listenSchedulesRealtime() {
  db.ref("schedules").on("value", snapshot => {
    globalScheduleData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
    
    // ✅ Render lại UI khi có thay đổi
    if (document.getElementById("schedule-requests-container")) {
      renderScheduleRequests();
    }
    if (typeof renderCalendar === "function") {
      renderCalendar();
    }
  }, err => {
    console.error("❌ Lỗi khi lắng nghe schedules:", err.message);
  });
}
function listenAdvancesRealtime() {
  db.ref("advances").on("value", snapshot => {
    globalAdvanceRequests = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
    
    // ✅ Render lại UI khi có thay đổi
    if (document.getElementById("advance-requests-container")) {
      renderAdvanceRequests();
    }
  }, err => {
    console.error("❌ Lỗi khi lắng nghe advances:", err.message);
  });
}


function toggleAdvanceRequestList() {
  const container = document.getElementById("advance-requests-container");
  if (!container) return;
  container.dataset.expanded = container.dataset.expanded === "true" ? "false" : "true";
  renderAdvanceRequests();
}


function confirmCancelAdvance(advanceId) {
  if (confirm("Bạn có chắc muốn hủy yêu cầu tạm ứng này?")) {
    cancelAdvanceRequest(advanceId);
  }
}

function cancelAdvanceRequest(advanceId) {
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }

  if (advance.status === 'pending') {
    const updates = {};
    updates[`advances/${advanceId}`] = null;

    db.ref().update(updates)
      .then(() => {
        showToastNotification('Đã hủy yêu cầu tạm ứng!');
        renderAdvanceRequests(); // cập nhật lại danh sách
      })
      .catch(err => showToastNotification(`Lỗi: ${err.message}`));
  } else {
    showToastNotification('Không thể hủy yêu cầu đã duyệt hoặc bị từ chối.');
  }
}


function toggleRequestList() {
  const container = document.getElementById("schedule-requests-container");
  if (!container) return;
  container.dataset.expanded = container.dataset.expanded === "true" ? "false" : "true";
  renderScheduleRequests();
}
// Sửa hàm showScheduleActionModal
function showScheduleActionModal(scheduleId, action) {
  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    showToastNotification("Yêu cầu không tồn tại!");
    return;
  }

  let contentHTML = `<h3>Xử lý yêu cầu lịch</h3>`;
  if (action === "process") {
    contentHTML += `
      <p>Yêu cầu ${getScheduleTypeText(schedule)} ngày ${new Date(schedule.date).toLocaleDateString('vi-VN')} của ${schedule.employeeName}</p>
      <div class="button-group">
        <button class="primary-btn" onclick="approveSchedule('${scheduleId}')">Phê duyệt</button>
        <button class="secondary-btn" onclick="rejectSchedule('${scheduleId}')">Từ chối</button>
        <button class="secondary-btn" onclick="closeModal('action-modal')">Hủy</button>
      </div>
    `;
  } else if (action === "cancel") {
    contentHTML += `
      <p>Yêu cầu hủy ${getScheduleTypeText(schedule)} ngày ${new Date(schedule.date).toLocaleDateString('vi-VN')} của ${schedule.employeeName}</p>
      <div class="button-group">
        <button class="primary-btn" onclick="approveCancelSchedule('${scheduleId}')">Đồng ý</button>
        <button class="secondary-btn" onclick="rejectCancelSchedule('${scheduleId}')">Không đồng ý</button>
        <button class="secondary-btn" onclick="closeModal('action-modal')">Hủy</button>
      </div>
    `;
  }

  content.innerHTML = contentHTML;
  modal.style.display = "block";
}
// Thêm hàm showAdvanceActionModal
function showAdvanceActionModal(advanceId, action) {
  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) {
    showToastNotification("Yêu cầu không tồn tại!");
    return;
  }

  content.innerHTML = `
    <h3>Xử lý yêu cầu tạm ứng</h3>
    <p>Yêu cầu tạm ứng ${advance.amount.toLocaleString("vi-VN")} VND ngày ${advance.date} của ${advance.employeeName}</p>
    <div class="button-group">
      <button class="primary-btn" onclick="approveAdvance('${advanceId}')">Phê duyệt</button>
      <button class="secondary-btn" onclick="rejectAdvance('${advanceId}')">Từ chối</button>
      <button class="secondary-btn" onclick="closeModal('action-modal')">Hủy</button>
    </div>
  `;
  modal.style.display = "block";
}

// Hàm hỗ trợ để lấy lớp CSS cho trạng thái lịch
function getScheduleStatusClass(schedule) {
  switch (schedule.approvalStatus) {
    case "pending":
    case "swapPending":
      return "status-pending";
    case "approved":
      return "status-approved";
    case "rejected":
      return "status-rejected";
    default:
      return "";
  }
}
function approveAdvance(advanceId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền phê duyệt!');
    return;
  }
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }
  db.ref(`advances/${advanceId}`).update({
    status: 'approved',
    resolvedAt: Date.now(),
    resolvedBy: currentEmployeeId
  })
    .then(() => {
      db.ref(`notifications/${advance.employeeId}`).push({
        message: `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND ngày ${advance.date} đã được phê duyệt`,
        timestamp: Date.now(),
        type: 'advance_approval',
        isRead: false
      });
      showToastNotification('Đã phê duyệt yêu cầu tạm ứng!');
      closeModal('action-modal'); 
      renderAdvanceRequests(); // ✅ Cập nhật danh sách mới
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error approving advance:', err);
    });
}

function rejectAdvance(advanceId) {
  if (!isCurrentUserManager()) {
    showToastNotification('Bạn không có quyền từ chối!');
    return;
  }
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) {
    showToastNotification('Yêu cầu không tồn tại!');
    return;
  }
  const reason = prompt('Lý do từ chối:');
  if (!reason) return;
  db.ref(`advances/${advanceId}`).update({
    status: 'denied',
    rejectReason: reason,
    resolvedAt: Date.now(),
    resolvedBy: currentEmployeeId
  })
    .then(() => {
      db.ref(`notifications/${advance.employeeId}`).push({
        message: `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND ngày ${advance.date} bị từ chối: ${reason}`,
        timestamp: Date.now(),
        type: 'advance_rejection',
        isRead: false
      });
      showToastNotification('Đã từ chối yêu cầu tạm ứng!');
      closeModal('action-modal');
      renderAdvanceRequests(); // ✅ Cập nhật danh sách mới
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error rejecting advance:', err);
    });
}


function requestAdvance() {
  const amount = document.getElementById('advance-amount').value;
  const reason = document.getElementById('advance-reason').value;
  
  if (!amount || !reason) {
    alert('Vui lòng nhập đầy đủ số tiền và lý do!');
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  const requestId = Date.now().toString();
  const advanceData = {
    id: requestId,
    employeeId: currentEmployeeId,
    employeeName: employee.name,
    amount: parseFloat(amount),
    reason,
    status: 'pending',
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0]
  };

  db.ref('advances/' + requestId).set(advanceData)
    .then(() => {
      // Thông báo cho quản lý
      db.ref('notifications/manager').push({
        message: `${employee.name} yêu cầu tạm ứng ${amount} VND: ${reason}`,
        timestamp: Date.now(),
        type: 'advance_request',
        advanceId: requestId,
        isRead: false
      });

      // Thông báo cho nhân viên
      db.ref(`notifications/${currentEmployeeId}`).push({
        message: `Bạn đã gửi yêu cầu tạm ứng ${amount} VND`,
        timestamp: Date.now(),
        type: 'advance_confirmation',
        isRead: false
      });

      showToastNotification('Đã gửi yêu cầu tạm ứng!');
      document.getElementById('advance-amount').value = '';
      document.getElementById('advance-reason').value = '';
    })
    .catch(err => showToastNotification(`Lỗi: ${err.message}`));
}

// ================ WORK SUMMARY FUNCTIONS ================
function renderOffAndOvertime() {
  const container = document.getElementById('off-and-overtime');
  if (!container) return;

  const offDays = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.status === 'off' && 
    s.approvalStatus === 'approved' &&
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  ).map(s => new Date(s.date).toLocaleDateString('vi-VN'));
  
  const overtimeDays = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.status === 'overtime' && 
    s.approvalStatus === 'approved' &&
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  ).map(s => new Date(s.date).toLocaleDateString('vi-VN'));
  
  const swapDays = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.status === 'swap' && 
    s.approvalStatus === 'approved' &&
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  ).map(s => new Date(s.date).toLocaleDateString('vi-VN'));

  container.innerHTML = `
    <h3>Thống kê tháng ${currentMonth}/${currentYear}</h3>
    <p><strong>Ngày nghỉ:</strong> ${offDays.length > 0 ? offDays.join(', ') : 'Không có'}</p>
    <p><strong>Ngày tăng ca:</strong> ${overtimeDays.length > 0 ? overtimeDays.join(', ') : 'Không có'}</p>
    <p><strong>Ngày đổi ca:</strong> ${swapDays.length > 0 ? swapDays.join(', ') : 'Không có'}</p>
  `;
}

function renderSalarySummary() {
  const salaryDiv = document.getElementById("salary-summary");
  if (!salaryDiv) return;

  const userId = currentEmployeeId;
  const schedule = globalScheduleData.filter(s => s.employeeId === userId);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const currentMonthSchedules = schedule.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const offDays = currentMonthSchedules.filter(s => s.status === 'off').length;
  const otDays = currentMonthSchedules.filter(s => s.status === 'overtime').length;

  let summaryText = '';
  if (offDays === 0 && otDays === 0) {
    summaryText = 'Full tháng';
  } else {
    summaryText = `Lương: ${offDays > 0 ? `-${offDays}` : ''} ${otDays > 0 ? `+${otDays}` : ''}`.trim();
  }

  // Tính ngày còn lại trong tháng (được làm)
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();

  const futureWorkDays = schedule.filter(s => {
    const d = new Date(s.date);
    return s.employeeId === userId && s.status === 'working' && d >= today && d <= lastDay;
  }).length;

  salaryDiv.innerHTML = `
    <p>${summaryText}</p>
    <p>Ngày còn lại trong tháng (dự kiến có lương): <strong>${futureWorkDays}</strong></p>
  `;
}

function calculateFutureSalary() {
  const wagePerHour = parseFloat(document.getElementById("wage-per-hour").value) || 0;
  const hoursPerDay = parseFloat(document.getElementById("hours-per-day").value) || 0;

  if (wagePerHour <= 0 || hoursPerDay <= 0) {
    alert("Vui lòng nhập đúng tiền/giờ và giờ/ngày.");
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // từ 0–11
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate(); // 30 hoặc 31

  // Lọc lịch của người dùng trong tháng hiện tại
  const schedule = globalScheduleData.filter(s => {
    const d = new Date(s.date);
    return s.employeeId === currentEmployeeId &&
           d.getFullYear() === year &&
           d.getMonth() === month;
  });

  const offDays = schedule.filter(s => s.status === 'off').length;
  const otDays = schedule.filter(s => s.status === 'overtime').length;

  const realWorkingDays = totalDaysInMonth - offDays + otDays;
  const estimate = realWorkingDays * hoursPerDay * wagePerHour;

  document.getElementById("future-salary-result").innerHTML = `
    <p>Tháng này có <strong>${totalDaysInMonth}</strong> ngày</p>
    <p>Đã nghỉ: <strong>${offDays}</strong> ngày</p>
    <p>Đã tăng ca: <strong>${otDays}</strong> ngày</p>
    <p>➡️ Tổng ngày công tính lương: <strong>${realWorkingDays}</strong></p>
    <p>💰 Lương tạm tính: <strong>${estimate.toLocaleString('vi-VN')} VND</strong></p>
  `;
}

// ================ HELPER FUNCTIONS ================
function getEmployeeName(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  
  return employee ? employee.name : "Không rõ";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function getScheduleTypeText(schedule) {
  switch(schedule.status) {
    case 'off': return 'Nghỉ làm';
    case 'overtime': return 'Tăng ca';
    case 'swap': return `Đổi ca với ${getEmployeeName(schedule.targetEmployeeId)}`;
    default: return 'Không xác định';
  }
}

function getScheduleStatusText(schedule) {
  switch(schedule.approvalStatus) {
    case 'pending': return 'Chờ duyệt';
    case 'swapPending': return 'Chờ phản hồi';
    case 'approved': return 'Đã duyệt';
    case 'rejected': return `Từ chối: ${schedule.rejectReason || ''}`;
    default: return 'Không xác định';
  }
}

function getAdvanceStatusText(advance) {
  switch(advance.status) {
    case 'pending': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt';
    case 'denied': return `Từ chối: ${advance.rejectReason || ''}`;
    default: return 'Không xác định';
  }
}

function getAdvanceStatusClass(advance) {
  switch(advance.status) {
    case 'pending': return 'status-pending';
    case 'approved': return 'status-approved';
    case 'denied': return 'status-rejected';
    default: return '';
  }
}

function showToastNotification(message) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 500);
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profile-page')) {
    initProfile();
  }
});



//
const scheduleStatusColors = {
  off: "#f44336",       // đỏ
  overtime: "#2196F3",  // xanh dương
  swap: "#FF9800"       // cam
};

function isCurrentUserManager() {
  console.log("Checking manager role for:", currentEmployeeId, globalEmployeeData);
  const user = globalEmployeeData.find(e => e.id === currentEmployeeId);
  return user && user.role === 'manager';
}

// ================ INITIALIZATION ================


function setupRealtimeListeners() {
  const isManager = isCurrentUserManager();
  const scheduleQuery = isManager
    ? db.ref("schedules")
    : db.ref("schedules").orderByChild("employeeId").equalTo(currentEmployeeId);

  scheduleQuery.on("value", (snapshot) => {
    globalScheduleData = snapshot.val()
      ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] }))
      : [];
    console.log("Updated globalScheduleData:", globalScheduleData); // Debug
    if (document.getElementById("calendar")) renderCalendar();
    if (document.getElementById("schedule-status-list")) renderScheduleRequests();
    if (document.getElementById("off-and-overtime")) renderOffAndOvertime();
    if (document.getElementById("salary-summary")) renderSalarySummary();
    if (document.getElementById("schedule-requests-container")) renderScheduleRequests(); // Thêm dòng này
  });

  const advanceQuery = isManager
    ? db.ref("advances")
    : db.ref("advances").orderByChild("employeeId").equalTo(currentEmployeeId);

  advanceQuery.on("value", (snapshot) => {
    globalAdvanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
    console.log("Updated globalAdvanceRequests:", globalAdvanceRequests); // Debug
    if (document.getElementById("advance-history-container")) renderAdvanceRequests();
  });

  db.ref(`notifications/${currentEmployeeId}`).on("value", (snapshot) => {
    globalNotifications = snapshot.val() ? Object.values(snapshot.val()) : [];
    if (document.getElementById("notifications-container")) renderNotifications();
  });
}
// ================ CALENDAR UI ================

function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  } else if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  }
  renderCalendar();
}
//////-----///////


// ======================= HÀM HỖ TRỢ ===========================
function safeNumber(value, defaultValue = 0) {
  return isNaN(Number(value)) ? defaultValue : Number(value);
}

function calculateSalary(days, hours, wage, bonuses, penalties) {
  const baseSalary = safeNumber(days) * safeNumber(hours) * safeNumber(wage);
  const totalBonus = bonuses.reduce((sum, b) => sum + safeNumber(b.amount), 0);
  const totalPenalty = penalties.reduce((sum, p) => sum + safeNumber(p.amount), 0);
  return {
    baseSalary,
    totalBonus,
    totalPenalty,
    finalSalary: baseSalary + totalBonus - totalPenalty
  };
}

// ======================= POPUP HIỂN THỊ ===========================
function showPayrollModal(employeeId, month, year) {
  month = safeNumber(month, new Date().getMonth() + 1);
  year = safeNumber(year, new Date().getFullYear());

  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!currentEmployee && auth.currentUser) {
    currentEmployee = globalEmployeeData.find(e => e.id === auth.currentUser.uid);
  }

  if (!employee) return;

  const payrollKey = `${employeeId}_${month}_${year}`;
  const payrollData = globalPayrollData?.[payrollKey] || {};

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const approvedOffDays = safeNumber(getApprovedOffDays(employeeId, month, year), 0);
  const approvedOvertimeDays = safeNumber(getApprovedOvertimeDays(employeeId, month, year), 0);
  const actualWorkingDays = safeNumber(payrollData.actualWorkingDays || (totalDaysInMonth - approvedOffDays + approvedOvertimeDays), totalDaysInMonth);

  const hoursPerDay = safeNumber(payrollData.hoursPerDay || employee.defaultHoursPerDay || 8);
  const wagePerHour = safeNumber(payrollData.wagePerHour || employee.defaultWagePerHour || 20000);

  const bonuses = payrollData.bonuses || [];
  const penalties = payrollData.penalties || [];

  const salaryCalc = calculateSalary(actualWorkingDays, hoursPerDay, wagePerHour, bonuses, penalties);

  const isManager = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';
  const isSelf = employeeId === currentEmployee?.id;
  const isManagerView = isManager && !isSelf;

  const managerEditSection = isManagerView ? `
    <div class="edit-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <label style="width: 120px;">Ngày công:</label>
      <input type="number" id="edit-actual-days" value="${actualWorkingDays}" min="0" max="${totalDaysInMonth}" oninput="recalculateSalary()" style="border: 1px solid #ccc; padding: 4px 6px; width: 100px;" />
    </div>
    <div class="edit-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <label style="width: 120px;">Giờ công/ngày:</label>
      <input type="number" id="edit-hours-day" value="${hoursPerDay}" min="1" oninput="recalculateSalary()" style="border: 1px solid #ccc; padding: 4px 6px; width: 100px;" />
    </div>
    <div class="edit-row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <label style="width: 120px;">Tiền công/giờ:</label>
      <input type="number" id="edit-wage-hour" value="${wagePerHour}" min="0" oninput="recalculateSalary()" style="border: 1px solid #ccc; padding: 4px 6px; width: 100px;" />
    </div>` : '';

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
      <p style="margin: 0;"><strong>Họ tên:</strong> ${employee.name}</p>
      <p style="margin: 0;"><strong>Tháng:</strong> ${month}/${year}</p>
    </div>
    <button onclick="showEditPersonalPopup('${employeeId}')" style="margin: 10px 0; padding: 6px 12px; border: 1px solid #ccc; background: #eee; cursor: pointer;">✏️ Sửa thông tin cá nhân</button>
    <hr>
    ${managerEditSection}
    <hr>
    <p>Tổng ngày trong tháng: <strong>${totalDaysInMonth}</strong></p>
    <p>Ngày nghỉ đã duyệt: <strong>${approvedOffDays}</strong></p>
    <p>Ngày tăng ca đã duyệt: <strong>${approvedOvertimeDays}</strong></p>
    <p>✅ Ngày công thực tế: <strong id="display-actual-days">${actualWorkingDays}</strong></p>
    <hr>
    <p>🕒 Giờ công/ngày: <strong id="display-hours-day">${hoursPerDay}</strong></p>
    <p>💵 Tiền công/giờ: <strong id="display-wage-hour">${wagePerHour.toLocaleString('vi-VN')}</strong></p>
    <div class="bonus-detail">
      <ul>${bonuses.map(b => `<li>${b.note}: ${b.amount.toLocaleString('vi-VN')} VND</li>`).join('') || '<li>Không có</li>'}</ul>
      <p><strong>Cộng:</strong> <span id="display-bonus">${salaryCalc.totalBonus.toLocaleString('vi-VN')}</span> VND</p>
    </div>
    <div class="penalty-detail">
      <ul>${penalties.map(p => `<li>${p.note}: ${p.amount.toLocaleString('vi-VN')} VND</li>`).join('') || '<li>Không có</li>'}</ul>
      <p><strong>Trừ:</strong> <span id="display-penalty">${salaryCalc.totalPenalty.toLocaleString('vi-VN')}</span> VND</p>
    </div>
    <p><strong>💰 Lương thực lãnh:</strong> <span id="display-salary">${salaryCalc.finalSalary.toLocaleString('vi-VN')} VND</span></p>
    <button class="secondary-btn" onclick="closePayrollModal()" style="padding: 6px 12px; background: #ccc; color: black; border: none; border-radius: 4px; cursor: pointer;">Đóng</button>
  `;

  modal.style.display = "block";
  modal.dataset.employeeId = employeeId;
  modal.dataset.month = month;
  modal.dataset.year = year;
  modal.dataset.payrollKey = payrollKey;
  modal.bonuses = [...bonuses];
  modal.penalties = [...penalties];
}

// ======================= POPUP THÔNG TIN CÁ NHÂN ===========================
function showEditPersonalPopup(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;

  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  content.innerHTML = `
    <h3>🔧 Cập nhật thông tin cá nhân</h3>
    <input id="name-input" type="text" placeholder="Nhập tên" />
        <input id="phone-input" type="text" placeholder="Nhập số điện thoại" />
        <input id="address-input" type="text" placeholder="Nhập địa chỉ" />
        <button onclick="updateUserProfile()">Cập nhật</button>
    <button onclick="showPayrollModal('${employeeId}')" style="margin-left: 10px;">↩️ Quay lại</button>
  `;
  modal.style.display = "block";
}

// ======================= GHI ĐÈ THÔNG TIN CÁ NHÂN ===========================
function submitPersonalInfo(employeeId) {
  const name = document.getElementById("name-input")?.value.trim();
  const phone = document.getElementById("phone-input")?.value.trim();
  const address = document.getElementById("address-input")?.value.trim();

  if (!name || !phone || !address) {
    showToastNotification("⚠️ Vui lòng điền đầy đủ thông tin!");
    return;
  }

  const updatedData = {
    name,
    sdt: phone,
    phone,
    address
  };

  db.ref(`users/${employeeId}`).update(updatedData)
    .then(() => {
      showToastNotification("✅ Đã cập nhật thông tin cá nhân!");
      loadFirebaseData(() => showEditPersonalPopup(employeeId));
    })
    .catch((err) => {
      console.error("❌ Lỗi khi ghi đè thông tin:", err);
      showToastNotification("❌ Lỗi khi lưu thông tin cá nhân!");
    });
}

// ======================= XỬ LÝ THÊM/XÓA DÒNG ===========================
function addBonusRow() {
  const modal = document.getElementById("action-modal");
  modal.bonuses.push({ note: "", amount: 0 });
  
  const bonusList = document.getElementById("bonus-list");
  const index = modal.bonuses.length - 1;
  const row = document.createElement("div");
  row.className = "edit-row";
  row.innerHTML = `
    <input type="text" placeholder="Nội dung" oninput="updateRow('bonus', ${index}, 'note', this.value)" />
    <input type="number" placeholder="Số tiền" oninput="updateRow('bonus', ${index}, 'amount', this.value)" />
    <button onclick="removeRow('bonus', ${index})">❌</button>
  `;
  bonusList.appendChild(row);
}

function addPenaltyRow() {
  const modal = document.getElementById("action-modal");
  modal.penalties.push({ note: "", amount: 0 });

  const penaltyList = document.getElementById("penalty-list");
  const index = modal.penalties.length - 1;
  const row = document.createElement("div");
  row.className = "edit-row";
  row.innerHTML = `
    <input type="text" placeholder="Nội dung" oninput="updateRow('penalty', ${index}, 'note', this.value)" />
    <input type="number" placeholder="Số tiền" oninput="updateRow('penalty', ${index}, 'amount', this.value)" />
    <button onclick="removeRow('penalty', ${index})">❌</button>
  `;
  penaltyList.appendChild(row);
}

function removeRow(type, index) {
  const modal = document.getElementById("action-modal");

  if (type === 'bonus') {
    modal.bonuses.splice(index, 1);
    document.getElementById("bonus-list").children[index].remove();
  } else {
    modal.penalties.splice(index, 1);
    document.getElementById("penalty-list").children[index].remove();
  }

  recalculateSalary();
}

function updateRow(type, index, field, value) {
  const modal = document.getElementById("action-modal");
  if (type === 'bonus') modal.bonuses[index][field] = field === 'amount' ? safeNumber(value) : value;
  if (type === 'penalty') modal.penalties[index][field] = field === 'amount' ? safeNumber(value) : value;
  recalculateSalary();
}

// ======================= TÍNH TOÁN REALTIME ===========================
function recalculateSalary() {
  const modal = document.getElementById("action-modal");
  const actualDays = safeNumber(document.getElementById("edit-actual-days").value);
  const hoursDay = safeNumber(document.getElementById("edit-hours-day").value);
  const wageHour = safeNumber(document.getElementById("edit-wage-hour").value);
  const bonuses = modal.bonuses;
  const penalties = modal.penalties;

  const salaryCalc = calculateSalary(actualDays, hoursDay, wageHour, bonuses, penalties);

  document.getElementById("display-actual-days").innerText = actualDays;
  document.getElementById("display-hours-day").innerText = hoursDay;
  document.getElementById("display-wage-hour").innerText = wageHour.toLocaleString('vi-VN');
  document.getElementById("display-bonus").innerText = salaryCalc.totalBonus.toLocaleString('vi-VN');
  document.getElementById("display-penalty").innerText = salaryCalc.totalPenalty.toLocaleString('vi-VN');
  document.getElementById("display-salary").innerText = salaryCalc.finalSalary.toLocaleString('vi-VN') + " VND";
}

// ======================= LƯU LÊN FIREBASE ===========================
function saveFullPayroll(payrollKey, month, year, employeeId) {
  const modal = document.getElementById("action-modal");
  const actualDays = safeNumber(document.getElementById("edit-actual-days").value);
  const hoursDay = safeNumber(document.getElementById("edit-hours-day").value);
  const wageHour = safeNumber(document.getElementById("edit-wage-hour").value);
  const bonuses = modal.bonuses;
  const penalties = modal.penalties;

  const salaryCalc = calculateSalary(actualDays, hoursDay, wageHour, bonuses, penalties);

  const payrollData = {
    employeeId,
    month,
    year,
    actualWorkingDays: actualDays,
    hoursPerDay: hoursDay,
    wagePerHour: wageHour,
    bonuses,
    penalties,
    bonusTotal: salaryCalc.totalBonus,
    penaltyTotal: salaryCalc.totalPenalty,
    totalSalary: salaryCalc.finalSalary,
    updatedAt: Date.now()
  };

  db.ref(`payroll/${payrollKey}`).set(payrollData)
    .then(() => {
      showToastNotification("✅ Đã lưu bảng lương!");
      closePayrollModal();
    })
    .catch(err => showToastNotification(`Lỗi khi lưu bảng lương: ${err.message}`));
}

function closePayrollModal() {
  document.getElementById("action-modal").style.display = "none";
}
// Hàm lấy ngày nghỉ đã duyệt
function getApprovedOffDays(employeeId, month, year) {
  return globalScheduleData.filter(s => 
    s.employeeId === employeeId &&
    s.approvalStatus === "approved" &&
    s.status === "off" &&
    new Date(s.date).getMonth() + 1 === month &&
    new Date(s.date).getFullYear() === year
  ).length;
}

// Hàm lấy ngày tăng ca đã duyệt
function getApprovedOvertimeDays(employeeId, month, year) {
  return globalScheduleData.filter(s => 
    s.employeeId === employeeId &&
    s.approvalStatus === "approved" &&
    s.status === "overtime" &&
    new Date(s.date).getMonth() + 1 === month &&
    new Date(s.date).getFullYear() === year
  ).length;
}
