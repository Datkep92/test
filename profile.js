// Khai báo global để lưu các instance flatpickr
var flatpickrInstanceMap = {};

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

function calculateSalary(actualWorkingDays, hoursPerDay, wagePerHour, bonuses, penalties) {
  bonuses = Array.isArray(bonuses) ? bonuses : [];
  penalties = Array.isArray(penalties) ? penalties : [];

  const totalBonus = bonuses.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const totalPenalty = penalties.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const baseSalary = actualWorkingDays * hoursPerDay * wagePerHour;
  const finalSalary = baseSalary + totalBonus - totalPenalty;

  return { totalBonus, totalPenalty, finalSalary };
}





// ======================= XỬ LÝ THÊM/XÓA DÒNG ===========================
function addBonusRow() {
  const modal = document.getElementById("action-modal");
  if (!modal.bonuses) modal.bonuses = [];
  modal.bonuses.push({
    date: new Date().toISOString().slice(0,10),
    note: '',
    amount: 0
  });
  renderBonusList();
}

function addPenaltyRow() {
  const modal = document.getElementById("action-modal");
  if (!modal.penalties) modal.penalties = [];
  modal.penalties.push({
    date: new Date().toISOString().slice(0,10),
    note: '',
    amount: 0
  });
  renderPenaltyList();
}
function initPayrollRealtime(employeeId) {
  if (!employeeId) return;

  // Lắng nghe settings
  firebase.database().ref(`employeeSettings/${employeeId}`).on('value', snap => {
    globalEmployeeSettings = globalEmployeeSettings || {};
    globalEmployeeSettings[employeeId] = snap.val() || {};
    refreshPayrollUI(employeeId);
  });

  // Lắng nghe bảng lương tháng
  firebase.database().ref(`payrolls/${employeeId}`).on('value', snap => {
    globalPayrollData = globalPayrollData || {};
    Object.keys(snap.val() || {}).forEach(key => {
      globalPayrollData[`${employeeId}_${key}`] = snap.val()[key];
    });
    refreshPayrollUI(employeeId);
  });

  // Lắng nghe thưởng/phạt từng ngày
  firebase.database().ref(`payrolls_daily/${employeeId}`).on('value', snap => {
    globalPayrollsDaily = globalPayrollsDaily || {};
    globalPayrollsDaily[employeeId] = snap.val() || {};
    refreshPayrollUI(employeeId);
  });

  // Lắng nghe tạm ứng
  firebase.database().ref(`advanceRequests`).on('value', snap => {
    globalAdvanceRequests = Object.values(snap.val() || {});
    refreshPayrollUI(employeeId);
  });

  // Lắng nghe lịch làm việc
  firebase.database().ref(`schedule`).on('value', snap => {
    globalScheduleData = Object.values(snap.val() || {});
    refreshPayrollUI(employeeId);
  });
}

function refreshPayrollUI(employeeId) {
  // Nếu modal lương đang mở → cập nhật cả tháng & ngày
  const detailsModal = document.getElementById("employee-details-modal");
  if (detailsModal && detailsModal.style.display === "block") {
    const start = detailsModal.dataset.dailyStart;
    const end = detailsModal.dataset.dailyEnd;
    if (start && end) {
      loadDailyPayroll(employeeId, start, end);
    }
    loadPayrollDetails(employeeId);
  }
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
  if (type === 'bonus') {
    modal.bonuses[index][field] = value;
  } else if (type === 'penalty') {
    modal.penalties[index][field] = value;
  }
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
/*
// ======================= LƯU LÊN FIREBASE ===========================
// Hàm lưu full payroll
function saveFullPayroll(payrollKey, month, year, employeeId) {
  const modal = document.getElementById("action-modal");
  const actualDays = safeNumber(document.getElementById("edit-actual-days").value);
  const hoursDay = safeNumber(document.getElementById("edit-hours-day").value);
  const wageHour = safeNumber(document.getElementById("edit-wage-hour").value);
  const bonuses = modal?.bonuses || [];
  const penalties = modal?.penalties || [];

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

  // Lưu payroll tháng (đổi path cho đồng bộ)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  db.ref(`payrolls/${employeeId}/${monthKey}`).set(payrollData)
    .then(() => {
      // Đồng bộ wage/hours
      db.ref(`employeeSettings/${employeeId}/wagePerHour`).set(wageHour);
      db.ref(`employeeSettings/${employeeId}/hoursPerDay`).set(hoursDay);

      if (!globalPayrollsDaily[employeeId]) {
        globalPayrollsDaily[employeeId] = {};
      }

      // Thưởng
      bonuses.forEach(b => {
        const dateStr = b.date || new Date().toISOString().slice(0, 10);
        db.ref(`payrolls_daily/${employeeId}/${dateStr}`).update({
          bonus: Number(b.amount) || 0,
          bonusNote: b.note || '',
          updatedAt: Date.now()
        });
        globalPayrollsDaily[employeeId][dateStr] = {
          ...(globalPayrollsDaily[employeeId][dateStr] || {}),
          bonus: Number(b.amount) || 0
        };
      });

      // Phạt
      penalties.forEach(p => {
        const dateStr = p.date || new Date().toISOString().slice(0, 10);
        db.ref(`payrolls_daily/${employeeId}/${dateStr}`).update({
          penalty: Number(p.amount) || 0,
          penaltyNote: p.note || '',
          updatedAt: Date.now()
        });
        globalPayrollsDaily[employeeId][dateStr] = {
          ...(globalPayrollsDaily[employeeId][dateStr] || {}),
          penalty: Number(p.amount) || 0
        };
      });

      // Refresh tab ngày
      const detailsModal = document.getElementById("employee-details-modal");
      if (detailsModal && detailsModal.style.display === "block") {
        const start = detailsModal.dataset.dailyStart || `${monthKey}-01`;
        const end = detailsModal.dataset.dailyEnd || start;
        loadDailyPayroll(employeeId, start, end);
      }

      showToastNotification("✅ Đã lưu bảng lương & thưởng/phạt ngày!");
    })
    .catch(err => {
      showToastNotification(`Lỗi khi lưu bảng lương: ${err.message}`);
    });
}
*/
function saveFullPayroll(payrollKey, month, year, employeeId) {
  const modal = document.getElementById("action-modal");
  const actualDays = safeNumber(document.getElementById("edit-actual-days").value);
  const hoursDay = safeNumber(document.getElementById("edit-hours-day").value);
  const wageHour = safeNumber(document.getElementById("edit-wage-hour").value);
  const bonuses = modal?.bonuses || [];
  const penalties = modal?.penalties || [];

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

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  // 1️⃣ Lưu payroll tháng
  firebase.database().ref(`payrolls/${employeeId}/${monthKey}`).set(payrollData)
    .then(() => {
      // 2️⃣ Cập nhật settings
      firebase.database().ref(`employeeSettings/${employeeId}/wagePerHour`).set(wageHour);
      firebase.database().ref(`employeeSettings/${employeeId}/hoursPerDay`).set(hoursDay);

      // 3️⃣ Lưu thưởng/phạt từng ngày
      bonuses.forEach(b => {
        if (b.date) {
          firebase.database().ref(`payrolls_daily/${employeeId}/${b.date}`).update({
            bonus: Number(b.amount) || 0,
            updatedAt: Date.now()
          });
        }
      });

      penalties.forEach(p => {
        if (p.date) {
          firebase.database().ref(`payrolls_daily/${employeeId}/${p.date}`).update({
            penalty: Number(p.amount) || 0,
            updatedAt: Date.now()
          });
        }
      });

      showToastNotification("✅ Đã lưu bảng lương và thưởng/phạt!");

      // 4️⃣ Reload lại từ Firebase
      reloadPayrollFromFirebase(employeeId, monthKey);
    })
    .catch(err => {
      showToastNotification(`❌ Lỗi khi lưu: ${err.message}`);
    });
}

function reloadPayrollFromFirebase(employeeId, monthKey) {
  Promise.all([
    firebase.database().ref(`payrolls/${employeeId}/${monthKey}`).once('value'),
    firebase.database().ref(`payrolls_daily/${employeeId}`).once('value')
  ]).then(([payrollSnap, dailySnap]) => {
    globalPayrollData[`${employeeId}_${monthKey}`] = payrollSnap.val() || {};
    globalPayrollsDaily[employeeId] = dailySnap.val() || {};
    refreshPayrollUI(employeeId);
  });
}


function renderBonusList() {
  const modal = document.getElementById("action-modal");
  const bonuses = modal?.bonuses || [];
  const bonusList = document.getElementById("bonus-list");
  if (!bonusList) return;

  bonusList.innerHTML = bonuses.map((b, i) => `
    <div class="edit-row">
      <input type="date" value="${b.date || new Date().toISOString().slice(0,10)}"
             onchange="updateRow('bonus', ${i}, 'date', this.value)" />
      <input type="text" value="${b.note || ''}"
             oninput="updateRow('bonus', ${i}, 'note', this.value)" placeholder="Ghi chú" />
      <input type="number" value="${b.amount || 0}"
             oninput="updateRow('bonus', ${i}, 'amount', this.value)" placeholder="Số tiền" />
      <button onclick="removeRow('bonus', ${i})">❌</button>
    </div>
  `).join('');
}

function renderPenaltyList() {
  const modal = document.getElementById("action-modal");
  const penalties = modal?.penalties || [];
  const penaltyList = document.getElementById("penalty-list");
  if (!penaltyList) return;

  penaltyList.innerHTML = penalties.map((p, i) => `
    <div class="edit-row">
      <input type="date" value="${p.date || new Date().toISOString().slice(0,10)}"
             onchange="updateRow('penalty', ${i}, 'date', this.value)" />
      <input type="text" value="${p.note || ''}"
             oninput="updateRow('penalty', ${i}, 'note', this.value)" placeholder="Ghi chú" />
      <input type="number" value="${p.amount || 0}"
             oninput="updateRow('penalty', ${i}, 'amount', this.value)" placeholder="Số tiền" />
      <button onclick="removeRow('penalty', ${i})">❌</button>
    </div>
  `).join('');
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
/////////////////////////////////
////////////////////////////////
/* ===========================
   PROFILE.JS - PAYROLL EXTENSIONS
   - Thêm tab LƯƠNG NGÀY realtime
   - Sửa popup LƯƠNG để có 2 tab (tháng / ngày)
   - Popup nhập THƯỞNG / PHẠT có chọn ngày -> lưu cả tháng + payrolls_daily
   - Lưu ý: giữ nguyên hàm loadPayrollDetails(employeeId) (lương tháng)
   - Khi dán: Xóa/ghi đè các hàm cũ tương ứng
   =========================== */

/* ===========================
   0. Biến toàn cục dùng trong file
   (Nếu đã có ở file gốc thì an toàn - nhưng xóa biến trùng nếu cần)
   =========================== */
let globalPayrollsDaily = {};      // cache realtime payrolls_daily per employee
let payrollDailyListeners = {};    // track firebase listeners to cleanup





/* ===========================
   3. Chuyển tab
   =========================== */
function switchPayrollTab(tab) {
  document.getElementById("tab-monthly").style.display = (tab === "monthly") ? "block" : "none";
  document.getElementById("tab-daily").style.display = (tab === "daily") ? "block" : "none";
  document.getElementById("tab-monthly-btn").classList.toggle("active", tab === "monthly");
  document.getElementById("tab-daily-btn").classList.toggle("active", tab === "daily");

  if (tab === "daily") {
    const empId = document.getElementById("action-modal").dataset.employeeId;
    filterDailyPayroll(empId); // Gọi hàm load dữ liệu ngày
  }
}


/* ===========================
   4. Bộ lọc Lương ngày
   =========================== */
function filterDailyPayroll(employeeId) {
  const startInput = document.getElementById("daily-start");
  const endInput = document.getElementById("daily-end");
  const start = startInput ? startInput.value : null;
  const end = endInput ? (endInput.value || start) : start;

  if (!start) {
    alert("Vui lòng chọn ngày hoặc khoảng ngày");
    return;
  }

  const modal = document.getElementById("employee-details-modal");
  if (modal) {
    modal.dataset.dailyStart = start;
    modal.dataset.dailyEnd = end;
  }

  loadDailyPayroll(employeeId, start, end);
}



/* ===========================
   6. Render bảng Lương ngày
   =========================== */
function renderDailyPayrollTable(rows, totalSalary) {
  const container = document.getElementById("daily-payroll-container");
  if (!container) return;

  if (!rows || rows.length === 0) {
    container.innerHTML = "<p style='color:#b00;'>⚠ Không có dữ liệu</p>";
    return;
  }

  let html = `
    <table class="table-style" style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px;">Ngày</th>
          <th style="text-align:left;padding:6px;">Loại ca</th>
          <th style="text-align:right;padding:6px;">Lương cơ bản</th>
          <th style="text-align:right;padding:6px;">OT</th>
          <th style="text-align:right;padding:6px;">Thưởng</th>
          <th style="text-align:right;padding:6px;">Phạt</th>
          <th style="text-align:right;padding:6px;">Tạm ứng</th>
          <th style="text-align:right;padding:6px;">Tổng</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach(r => {
    html += `
      <tr>
        <td style="padding:6px;">${r.date}</td>
        <td style="padding:6px;">${r.type}</td>
        <td style="padding:6px;text-align:right;">${Number(r.baseSalary).toLocaleString()} VND</td>
        <td style="padding:6px;text-align:right;">${Number(r.overtimePay).toLocaleString()} VND</td>
        <td style="padding:6px;text-align:right;">${Number(r.bonus).toLocaleString()} VND</td>
        <td style="padding:6px;text-align:right;">${Number(r.penalty).toLocaleString()} VND</td>
        <td style="padding:6px;text-align:right;">${Number(r.advanceTotal).toLocaleString()} VND</td>
        <td style="padding:6px;text-align:right;"><strong>${Number(r.total).toLocaleString()} VND</strong></td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="padding:8px;text-align:right;"><strong>Tổng cộng</strong></td>
          <td style="padding:8px;text-align:right;"><strong style="color:green;">${Number(totalSalary).toLocaleString()} VND</strong></td>
        </tr>
      </tfoot>
    </table>
  `;

  // Render bảng
container.innerHTML = html;

// Nếu là quản lý, thêm nút quản lý thưởng/phạt/tạm ứng
if (typeof currentUserRole !== "undefined" && currentUserRole === "admin") {
  const modal = document.getElementById("employee-details-modal");
  const employeeId = modal?.dataset.payrollEmployee || "";
  const monthKey = (modal?.dataset.dailyStart || new Date().toISOString().slice(0,10)).slice(0,7);

  const manageHtml = `
    <div style="margin-top:15px; border-top:1px solid #ddd; padding-top:10px;">
      <h4>Quản lý</h4>
      <button class="primary-btn" onclick="showBonusModal('${employeeId}', '${monthKey}')">+ Thưởng</button>
      <button class="primary-btn" onclick="showPenaltyModal('${employeeId}', '${monthKey}')">+ Phạt</button>
      <button class="primary-btn" onclick="showAdvanceModal('${employeeId}', '${monthKey}')">+ Tạm ứng</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", manageHtml);
}

}

/* ===========================
   7. Lưu thưởng/phạt theo ngày (dùng khi admin lưu)
   - Hàm này ghi node payrolls_daily/{employeeId}/{YYYY-MM-DD}
   - Nếu muốn lưu nhiều khoản cùng ngày, có thể mở rộng thành mảng
   =========================== */
function saveDailyBonusPenalty(employeeId, date, bonus, penalty, bonusNote, penaltyNote) {
  if (!employeeId || !date) return Promise.reject(new Error("employeeId/date required"));
  const payload = {
    bonus: Number(bonus) || 0,
    penalty: Number(penalty) || 0,
    bonusNote: bonusNote || "",
    penaltyNote: penaltyNote || "",
    updatedAt: Date.now()
  };
  const updates = {};
  updates[`payrolls_daily/${employeeId}/${date}`] = payload;
  return db.ref().update(updates);
}

/* ===========================
   8. Popup Thưởng (show + save)
   - Nếu file gốc đã có modal elements, đảm bảo id tồn tại:
     - #bonus-modal, #bonus-modal-content
   =========================== */
function showBonusModal(employeeId, monthKey) {
  const today = new Date().toISOString().slice(0,10);
  const modal = document.getElementById("bonus-modal");
  const content = document.getElementById("bonus-modal-content");
  if (!modal || !content) {
    alert("Không tìm thấy modal thưởng. Vui lòng kiểm tra HTML (bonus-modal, bonus-modal-content).");
    return;
  }
  content.innerHTML = `
    <h3>Thêm thưởng</h3>
    <div style="margin-bottom:8px;">
      <input type="number" id="bonus-amount" placeholder="Số tiền thưởng" />
    </div>
    <div style="margin-bottom:8px;">
      <textarea id="bonus-note" placeholder="Ghi chú"></textarea>
    </div>
    <div style="margin-bottom:8px;">
      <label>Ngày áp dụng:</label><br/>
      <input type="date" id="bonus-date" value="${today}" />
    </div>
    <div style="text-align:right;">
      <button class="primary-btn" onclick="saveBonus('${employeeId}','${monthKey}')">Lưu</button>
      <button class="secondary-btn" onclick="closeBonusModal()">Hủy</button>
    </div>
  `;
  modal.style.display = "block";
}

function saveBonus(employeeId, monthKey) {
  const bonus = Number(document.getElementById("bonus-amount").value) || 0;
  const note = document.getElementById("bonus-note").value || "";
  const date = document.getElementById("bonus-date").value || new Date().toISOString().slice(0,10);

  // 1) Lưu tổng tháng
  db.ref(`payrolls/${employeeId}/${monthKey}/bonus`).set(bonus);
  db.ref(`payrolls/${employeeId}/${monthKey}/bonusNote`).set(note);

  // 2) Lưu chi tiết ngày (realtime)
  const dailyPath = `payrolls_daily/${employeeId}/${date}`;
  db.ref(dailyPath).update({
    bonus: bonus,
    bonusNote: note,
    updatedAt: Date.now()
  }).then(() => {
    showToastNotification('✅ Đã lưu thưởng!');
    closeBonusModal();
    // reload ngay lập tức để bảng lương ngày cập nhật
    const modal = document.getElementById("employee-details-modal");
    if (modal && modal.dataset.dailyStart) {
      loadDailyPayroll(employeeId, modal.dataset.dailyStart, modal.dataset.dailyEnd);
    }
  }).catch(err => {
    console.error("Lỗi lưu thưởng:", err);
    showToastNotification('❌ Lỗi khi lưu thưởng');
  });
}

function savePenalty(employeeId, monthKey) {
  const penalty = Number(document.getElementById("penalty-amount").value) || 0;
  const note = document.getElementById("penalty-note").value || "";
  const date = document.getElementById("penalty-date").value || new Date().toISOString().slice(0,10);

  // 1) Lưu tổng tháng
  db.ref(`payrolls/${employeeId}/${monthKey}/penalty`).set(penalty);
  db.ref(`payrolls/${employeeId}/${monthKey}/penaltyNote`).set(note);

  // 2) Lưu chi tiết ngày (realtime)
  const dailyPath = `payrolls_daily/${employeeId}/${date}`;
  db.ref(dailyPath).update({
    penalty: penalty,
    penaltyNote: note,
    updatedAt: Date.now()
  }).then(() => {
    showToastNotification('✅ Đã lưu phạt!');
    closePenaltyModal();
    // reload ngay lập tức để bảng lương ngày cập nhật
    const modal = document.getElementById("employee-details-modal");
    if (modal && modal.dataset.dailyStart) {
      loadDailyPayroll(employeeId, modal.dataset.dailyStart, modal.dataset.dailyEnd);
    }
  }).catch(err => {
    console.error("Lỗi lưu phạt:", err);
    showToastNotification('❌ Lỗi khi lưu phạt');
  });
}


function closeBonusModal() {
  const modal = document.getElementById("bonus-modal");
  if (!modal) return;
  modal.style.display = "none";
  const content = document.getElementById("bonus-modal-content");
  if (content) content.innerHTML = "";
}



function closePenaltyModal() {
  const modal = document.getElementById("penalty-modal");
  if (!modal) return;
  modal.style.display = "none";
  const content = document.getElementById("penalty-modal-content");
  if (content) content.innerHTML = "";
}

/* ===========================
   10. KHUYẾN NGHỊ TEST & CHECKLIST
   - Có DOM elements:
     - #employee-details-modal, #employee-details-content
     - #bonus-modal, #bonus-modal-content
     - #penalty-modal, #penalty-modal-content
   - Phải load trước:
     - db (firebase.database()), globalScheduleData, globalAdvanceRequests, globalEmployeeData
     - loadPayrollDetails(employeeId) phải tồn tại (không bị xóa)
   - Test:
     - Mở payroll modal -> tab monthly hiển thị loadPayrollDetails
     - Chuyển tab daily -> chọn ngày -> xem kết quả
     - Mở bonus modal -> chọn ngày khác -> lưu -> KTra firebase path payrolls_daily/{employeeId}/{date} có record
     - Khi payrolls_daily thay đổi -> bảng Lương ngày đang mở cập nhật ngay
   =========================== */
   // ====== CACHE & LISTENER (thay thế phiên bản cũ) ======


function startPayrollDailyListener(employeeId) {
  if (!employeeId) return;
  if (payrollDailyListeners[employeeId]) return; // đã lắng nghe

  const ref = db.ref(`payrolls_daily/${employeeId}`);
  const callback = snapshot => {
    globalPayrollsDaily[employeeId] = snapshot.val() || {};
    // Nếu modal đang mở cho employee này và tab daily visible => reload
    const modal = document.getElementById("action-modal") || document.getElementById("employee-details-modal");
    if (modal && modal.style.display === "block" && (modal.dataset.employeeId === employeeId || modal.dataset.payrollEmployee === employeeId)) {
      const tabDaily = document.getElementById("tab-daily");
      const activeTab = tabDaily && tabDaily.style.display !== "none";
      if (activeTab) {
        const start = modal.dataset.dailyStart || new Date().toISOString().slice(0,10);
        const end = modal.dataset.dailyEnd || start;
        loadDailyPayroll(employeeId, start, end);
      }
    }
  };

  ref.on("value", callback);
  payrollDailyListeners[employeeId] = { ref, callback };
}
/*
const cleanArray = arr => arr.map(item => ({
  note: item.note ?? "",   // thay undefined thành chuỗi rỗng
  amount: Number(item.amount) || 0
}));

const bonusesClean = cleanArray(modal.bonuses || []);
const penaltiesClean = cleaArrna(modal.penalties || []);

db.ref(`payroll/${payrollKey}/bonuses`).set(bonusesClean);
db.ref(`payroll/${payrollKey}/penalties`).set(penaltiesClean);y
*/
function stopPayrollDailyListener(employeeId) {
  const entry = payrollDailyListeners[employeeId];
  if (!entry) return;
  entry.ref.off("value", entry.callback);
  delete payrollDailyListeners[employeeId];
  delete globalPayrollsDaily[employeeId];
}

// ====== SHOW PAYROLL MODAL (phiên bản dùng action-modal) ======
function showPayrollModal(employeeId, month, year) {
  // (giữ nguyên logic cũ bạn có, chỉ thêm dataset + start listener)
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

  // --- (giữ phần tính payroll tháng như bạn có) ---
  const payrollKey = `${employeeId}_${month}_${year}`;
  const payrollData = globalPayrollData?.[payrollKey] || {};

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const approvedOffDays = safeNumber(getApprovedOffDays(employeeId, month, year), 0);
  const approvedOvertimeDays = safeNumber(getApprovedOvertimeDays(employeeId, month, year), 0);
  const actualWorkingDays = safeNumber(payrollData.actualWorkingDays || (totalDaysInMonth - approvedOffDays + approvedOvertimeDays), totalDaysInMonth);

  const hoursPerDay = safeNumber(payrollData.hoursPerDay || employee.defaultHoursPerDay || 8);
  const wagePerHour = safeNumber(payrollData.wagePerHour || employee.defaultWagePerHour || 20000);

const bonuses = Array.isArray(payrollData.bonuses) ? payrollData.bonuses : [];
const penalties = Array.isArray(payrollData.penalties) ? payrollData.penalties : [];

modal.bonuses = JSON.parse(JSON.stringify(bonuses));  // clone sâu an toàn
modal.penalties = JSON.parse(JSON.stringify(penalties));



  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const employeeAdvances = globalAdvanceRequests.filter(a =>
    a.employeeId === employeeId &&
    a.status === 'approved' &&
    a.date.startsWith(monthStr)
  );
  const advanceDeductions = (employeeAdvances || []).map((a, i) => ({
  note: `Trừ ứng lương lần ${i + 1}: ${new Date(a.date).toLocaleDateString('vi-VN')}`,
  amount: safeNumber(a.amount)
}));


  const allPenalties = [...penalties, ...advanceDeductions];
  const salaryCalc = calculateSalary(actualWorkingDays, hoursPerDay, wagePerHour, bonuses, allPenalties);

  const isManager = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';
  const isSelf = employeeId === currentEmployee?.id;
  const isManagerView = isManager && !isSelf;

  const managerEditSection = isManagerView ? `
    <div class="edit-row"><label>Ngày công:</label>
      <input type="number" id="edit-actual-days" value="${actualWorkingDays}" oninput="recalculateSalary()" />
    </div>
    <div class="edit-row"><label>Giờ/ngày:</label>
      <input type="number" id="edit-hours-day" value="${hoursPerDay}" oninput="recalculateSalary()" />
    </div>
    <div class="edit-row"><label>Tiền/giờ:</label>
      <input type="number" id="edit-wage-hour" value="${wagePerHour}" oninput="recalculateSalary()" />
    </div>
    <button onclick="addPenaltyRow()">+ Thêm chế tài</button>
    <div id="penalty-list">${penalties.map((p, i) => `
      <div class="edit-row">
        <input type="text" value="${p.note}" oninput="updateRow('penalty', ${i}, 'note', this.value)" />
        <input type="number" value="${p.amount}" oninput="updateRow('penalty', ${i}, 'amount', this.value)" />
        <button onclick="removeRow('penalty', ${i})">❌</button>
      </div>`).join('')}</div>
    <button onclick="addBonusRow()">+ Thêm thưởng</button>
    <div id="bonus-list">${bonuses.map((b, i) => `
      <div class="edit-row">
        <input type="text" value="${b.note}" oninput="updateRow('bonus', ${i}, 'note', this.value)" />
        <input type="number" value="${b.amount}" oninput="updateRow('bonus', ${i}, 'amount', this.value)" />
        <button onclick="removeRow('bonus', ${i})">❌</button>
      </div>`).join('')}</div>
    <div class="button-group">
      <button class="primary-btn" onclick="saveFullPayroll('${payrollKey}', ${month}, ${year}, '${employeeId}')">💾 Lưu bảng lương</button>
      <button onclick="closePayrollModal()">Đóng</button>
    </div>
  ` : '';

  const today = new Date().toISOString().slice(0, 10);
  // Thiết lập dataset dùng chung (dùng cả hai key để tương thích)
  modal.dataset.employeeId = employeeId;
  modal.dataset.payrollEmployee = employeeId;
  modal.dataset.dailyStart = today;
  modal.dataset.dailyEnd = today;

  // HTML (giữ logic bạn có, thêm tabs)
  content.innerHTML = `
    <div class="payroll-tabs" style="margin-bottom:8px;">
      <button id="tab-monthly-btn" class="active" onclick="switchPayrollTab('monthly')">Lương tháng</button>
      <button id="tab-daily-btn" onclick="switchPayrollTab('daily')">Lương ngày</button>
    </div>

    <div id="tab-monthly" class="payroll-tab-content">
      <div style="display: flex; justify-content: space-between;">
        <p><strong>Họ tên:</strong> ${employee.name}</p>
        <p><strong>Tháng:</strong> ${month}/${year}</p>
      </div>
      <hr>
      ${managerEditSection}
      <hr>
      <p>Tổng ngày trong tháng: <strong>${totalDaysInMonth}</strong></p>
      <p>Ngày nghỉ đã duyệt: <strong>${approvedOffDays}</strong></p>
      <p>Ngày tăng ca đã duyệt: <strong>${approvedOvertimeDays}</strong></p>
      <p>✅ Ngày công thực tế: <strong id="display-actual-days">${actualWorkingDays}</strong></p>
      <hr>
      <p>🕒 Giờ/ngày: <strong id="display-hours-day">${hoursPerDay}</strong></p>
      <p>💵 Tiền/giờ: <strong id="display-wage-hour">${wagePerHour.toLocaleString('vi-VN')}</strong></p>
      <hr>
      <p><strong>🎁 Thưởng:</strong></p>
      <ul>${bonuses.map(b => `<li>${b.note}: ${b.amount.toLocaleString('vi-VN')} VND</li>`).join('') || '<li>Không có</li>'}</ul>
      <p><strong>Cộng:</strong> <span id="display-bonus">${salaryCalc.totalBonus.toLocaleString('vi-VN')}</span> VND</p>
      <p><strong>⚠️ Trừ:</strong></p>
      <ul>${allPenalties.map(p => `<li>${p.note}: ${p.amount.toLocaleString('vi-VN')} VND</li>`).join('') || '<li>Không có</li>'}</ul>
      <p><strong>Trừ tổng:</strong> <span id="display-penalty">${salaryCalc.totalPenalty.toLocaleString('vi-VN')}</span> VND</p>
      <hr>
      <p><strong>💰 Lương thực lãnh:</strong> <span id="display-salary">${salaryCalc.finalSalary.toLocaleString('vi-VN')} VND</span></p>
    </div>

    <div id="tab-daily" class="payroll-tab-content" style="display:none;">
      <div class="input-group" style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
        <div>
          <label style="font-size:12px;">Từ</label><br/>
          <input type="date" id="daily-start" value="${today}" />
        </div>
        <div>
          <label style="font-size:12px;">Đến</label><br/>
          <input type="date" id="daily-end" value="${today}" />
        </div>
        <div style="align-self:flex-end;">
          <button class="primary-btn" onclick="filterDailyPayroll('${employeeId}')">Xem</button>
        </div>
      </div>
      <div id="daily-payroll-container"></div>
    </div>

    <div style="text-align:right;margin-top:12px;">
      <button class="secondary-btn" onclick="closePayrollModal()">Đóng</button>
    </div>
  `;

  modal.style.display = "block";

  // Bắt listener realtime (quan trọng)
  startPayrollDailyListener(employeeId);

  // load mặc định tab tháng (giữ nguyên)
  if (typeof loadPayrollDetails === "function") {
    loadPayrollDetails(employeeId);
  }
}

// ====== Đóng modal (dọn listener) ======
function closePayrollModal() {
  const modal = document.getElementById("action-modal") || document.getElementById("employee-details-modal");
  if (!modal) return;
  const employeeId = modal.dataset.employeeId || modal.dataset.payrollEmployee;
  modal.style.display = "none";
  delete modal.dataset.employeeId;
  delete modal.dataset.payrollEmployee;
  delete modal.dataset.dailyStart;
  delete modal.dataset.dailyEnd;
  if (employeeId) stopPayrollDailyListener(employeeId);
}

// ====== LOAD LƯƠNG NGÀY: nếu cache trống thì fetch + kết hợp dữ liệu payrolls_daily ======
function loadDailyPayroll(employeeId, startDate, endDate) {
  const container = document.getElementById("daily-payroll-container");
  if (!container) return;

  const emp = (globalEmployeeData || []).find(e => e.id === employeeId);
  if (!emp) {
    container.innerHTML = "<p style='color:red;'>Không tìm thấy nhân viên</p>";
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end < start) {
    container.innerHTML = "<p style='color:red;'>Khoảng ngày không hợp lệ</p>";
    return;
  }

  firebase.database().ref(`employeeSettings/${employeeId}`).once('value').then(settingSnap => {
    const settings = settingSnap.val() || {};
    const wage = Number(settings.wagePerHour) || 20000;
    const hours = Number(settings.hoursPerDay) || 8;
    const defaultOtHours = Number(settings.overtimeHours) || 2;

    const rows = [];
    let totalSalary = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0,10);

      // Lấy lịch làm việc đã duyệt
      const schedule = (globalScheduleData || []).find(s =>
        s.employeeId === employeeId && 
        s.date === dateStr &&
        s.approvalStatus === "approved"
      );

      let baseSalary = 0;
      let overtimePay = 0;
      let type = "Bình thường"; // mặc định là làm

      if (schedule) {
        if (schedule.status === "off") {
          type = "Nghỉ";
          baseSalary = 0;
        } 
        else if (schedule.status === "overtime" || Number(schedule.overtimeHours) > 0) {
          type = "Tăng ca";
          baseSalary = wage * hours;
          const otHours = Number(schedule.overtimeHours) || defaultOtHours;
          overtimePay = wage * otHours;
        } 
        else {
          baseSalary = wage * hours;
        }
      } else {
        // Không có record lịch => coi như làm bình thường
        baseSalary = wage * hours;
      }

      // Bonus / Penalty trong payrolls_daily
      const dailyRecord = (globalPayrollsDaily[employeeId] || {})[dateStr] || {};
      let bonus = 0, penalty = 0;
      if (Array.isArray(dailyRecord)) {
        dailyRecord.forEach(it => { bonus += Number(it.bonus||0); penalty += Number(it.penalty||0); });
      } else if (typeof dailyRecord === 'object') {
        bonus = Number(dailyRecord.bonus || 0);
        penalty = Number(dailyRecord.penalty || 0);
      }

      // Tạm ứng (approved hoặc done)
      const advances = (globalAdvanceRequests || []).filter(a =>
        a.employeeId === employeeId &&
        a.date === dateStr &&
        (a.status === "approved" || a.status === "done")
      );
      const advanceTotal = advances.reduce((s, a) => s + Number(a.amount || 0), 0);

      const dailyTotal = baseSalary + overtimePay + bonus - penalty - advanceTotal;
      totalSalary += dailyTotal;

      rows.push({
        date: dateStr,
        type,
        baseSalary,
        overtimePay,
        bonus,
        penalty,
        advanceTotal,
        total: dailyTotal
      });
    }

    renderDailyPayrollTable(rows, totalSalary);
  }).catch(err => {
    console.error("Lỗi khi load employeeSettings:", err);
    container.innerHTML = "<p style='color:red;'>Lỗi khi tải cài đặt nhân viên</p>";
  });
}
