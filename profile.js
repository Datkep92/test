// File: js/profile.js
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentScheduleMonth = new Date().getMonth() + 1;
let currentScheduleYear = new Date().getFullYear();

// ================ INITIALIZATION ================
// Sửa hàm initProfile
function initProfile() {
  setupRealtimeListeners();
  
  // Chỉ render các component cơ bản
  renderCalendar();
  renderScheduleStatusList();
  renderNotifications();
  renderAdvanceHistory();
  
  // Không tự động mở tab nào
}

function setupRealtimeListeners() {
  // Schedules
  db.ref('schedules').orderByChild('employeeId').equalTo(currentEmployeeId).on('value', (snapshot) => {
    globalScheduleData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({
      id: key,
      ...snapshot.val()[key]
    })) : [];
    renderCalendar();
    renderScheduleStatusList();
    renderOffAndOvertime();
    renderSalarySummary();
  });

  // Notifications
  db.ref(`notifications/${currentEmployeeId}`).on('value', (snapshot) => {
    globalNotifications = snapshot.val() ? Object.values(snapshot.val()) : [];
    renderNotifications();
  });

  // Advances
  db.ref('advances').orderByChild('employeeId').equalTo(currentEmployeeId).on('value', (snapshot) => {
    globalAdvanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
    renderAdvanceHistory();
  });
}

function renderProfile() {
  renderCalendar();
  renderScheduleStatusList();
  renderNotifications();
  renderAdvanceHistory();
  renderOffAndOvertime();
  renderSalarySummary();
}

// ================ CALENDAR FUNCTIONS ================
function renderCalendar() {
  const calendar = document.getElementById('calendar');
  if (!calendar) return;

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

  for (let i = 1; i < firstDay; i++) {
    calendarHTML += `<div class="day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mySchedule = globalScheduleData.find(s => s.date === date);
    
    let statusClass = 'normal';
    let statusText = '';
    
    if (mySchedule) {
      statusClass = mySchedule.approvalStatus === 'approved' ? mySchedule.status : 'pending';
      statusText = getScheduleStatusText(mySchedule);
    }

    calendarHTML += `
      <div class="day ${statusClass}" onclick="showActionModal('${date}')">
        ${day}
        ${mySchedule ? `<div class="day-status">${statusText}</div>` : ''}
      </div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}

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

// ================ SCHEDULE FUNCTIONS ================
function showActionModal(date, schedule = null) {
  const modal = document.getElementById('action-modal');
  const modalContent = document.getElementById('schedule-action-content');
  if (!modal || !modalContent) return;

  const existingSchedule = schedule || globalScheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
  const otherEmployeesOff = globalScheduleData.filter(
    s => s.date === date && s.employeeId !== currentEmployeeId && s.status === 'off' && s.approvalStatus === 'approved'
  );

  let content = `
    <h3>Chi tiết lịch: ${new Date(date).toLocaleDateString('vi-VN')}</h3>
  `;
  
  if (existingSchedule) {
    const statusText = existingSchedule.status === 'off' ? 'Nghỉ' : 
                      existingSchedule.status === 'overtime' ? 'Tăng ca' : 
                      `Đổi ca với ${getEmployeeName(existingSchedule.targetEmployeeId)}`;
    const approvalText = existingSchedule.approvalStatus === 'pending' ? 'Chờ duyệt' : 
                         existingSchedule.approvalStatus === 'swapPending' ? 'Chờ đổi ca' : 
                         existingSchedule.approvalStatus === 'approved' ? 'Đã duyệt' : 
                         `Từ chối: ${existingSchedule.rejectReason || ''}`;
    content += `<p>Trạng thái của bạn: ${statusText} (${approvalText})</p>`;
  } else {
    content += `<p>Trạng thái của bạn: Trống</p>`;
  }

  if (otherEmployeesOff.length > 0) {
    content += `<p>Nhân viên nghỉ có thể đổi ca: ${otherEmployeesOff.map(e => e.employeeName).join(', ')}</p>`;
  } else {
    content += `<p>Không có nhân viên nào nghỉ trong ngày này</p>`;
  }

  content += `<div class="button-group">`;
  if (!existingSchedule || existingSchedule.approvalStatus !== 'approved') {
    content += `
      <button class="primary-btn" onclick="submitScheduleRequest('${date}', 'off')">Xin nghỉ</button>
      <button class="primary-btn" onclick="submitScheduleRequest('${date}', 'overtime')">Xin tăng ca</button>
    `;
  }
  
  otherEmployeesOff.forEach(emp => {
    content += `<button class="primary-btn" onclick="submitScheduleRequest('${date}', 'swap', '${emp.employeeId}')">Đổi ca với ${emp.employeeName}</button>`;
  });

  if (existingSchedule && (existingSchedule.approvalStatus === 'pending' || existingSchedule.approvalStatus === 'swapPending')) {
    content += `<button class="secondary-btn" onclick="cancelSchedule('${existingSchedule.id}')">Hủy yêu cầu</button>`;
  }
  
  content += `<button class="primary-btn" onclick="closeModal('action-modal')">Đóng</button>`;
  content += `</div>`;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

function submitScheduleRequest(date, status, targetEmployeeId = null) {
  const scheduleId = `${date}_${currentEmployeeId}`;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  
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

  db.ref('schedules/' + scheduleId).set(scheduleData)
    .then(() => {
      showToastNotification(`Đã gửi yêu cầu ${getScheduleTypeText(scheduleData)} thành công`);
      
      // Gửi thông báo cho quản lý
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

      // Nếu là yêu cầu đổi ca, gửi thông báo cho nhân viên kia
      if (status === 'swap' && targetEmployeeId) {
        db.ref(`notifications/${targetEmployeeId}`).push({
          message: `${employee.name} muốn đổi ca với bạn ngày ${date}`,
          timestamp: Date.now(),
          type: 'swap_request',
          scheduleId,
          isRead: false
        });
      }
    })
    .catch(err => showToastNotification(`Lỗi: ${err.message}`));
}

function cancelSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  if (!confirm('Bạn chắc chắn muốn hủy yêu cầu này?')) return;

  const updates = {};
  updates[`schedules/${scheduleId}`] = null;
  
  // Thông báo cho quản lý
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/manager/notif_${Date.now()}`] = {
    message: `${schedule.employeeName} đã hủy yêu cầu ${statusText} ngày ${schedule.date}`,
    timestamp: Date.now(),
    type: 'schedule_cancellation',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      showToastNotification('Đã hủy yêu cầu thành công');
    })
    .catch(err => showToastNotification(`Lỗi: ${err.message}`));
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

function renderScheduleStatusList() {
  const container = document.getElementById('schedule-status-list');
  if (!container) return;

  const schedules = globalScheduleData.filter(s => 
    s.date.startsWith(`${currentScheduleYear}-${String(currentScheduleMonth).padStart(2, '0')}`)
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = `
    <div class="schedule-header">
      <button onclick="changeScheduleMonth(-1)">❮</button>
      <h4>Tháng ${currentScheduleMonth}/${currentScheduleYear}</h4>
      <button onclick="changeScheduleMonth(1)">❯</button>
    </div>
    ${schedules.length > 0 ? `
      <ul class="schedule-list">
        ${schedules.map(s => `
          <li class="schedule-item ${s.approvalStatus}">
            <div class="schedule-date">${new Date(s.date).toLocaleDateString('vi-VN')}</div>
            <div class="schedule-type">${getScheduleTypeText(s)}</div>
            <div class="schedule-status">${getScheduleStatusText(s)}</div>
            ${(s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending') ? 
              `<button class="small-btn" onclick="cancelSchedule('${s.id}')">Hủy</button>` : ''}
          </li>
        `).join('')}
      </ul>
    ` : '<p>Không có lịch làm việc đặc biệt trong tháng này</p>'}
  `;
}

function changeScheduleMonth(offset) {
  currentScheduleMonth += offset;
  if (currentScheduleMonth < 1) {
    currentScheduleMonth = 12;
    currentScheduleYear--;
  } else if (currentScheduleMonth > 12) {
    currentScheduleMonth = 1;
    currentScheduleYear++;
  }
  renderScheduleStatusList();
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

// ================ ADVANCE FUNCTIONS ================
function renderAdvanceHistory() {
  const container = document.getElementById('advance-history-container');
  if (!container) return;

  const requests = globalAdvanceRequests.sort((a, b) => b.timestamp - a.timestamp);
  
  container.innerHTML = `
    <h3>Lịch sử tạm ứng</h3>
    ${requests.length > 0 ? `
      <table class="advance-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Số tiền</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(a => `
            <tr>
              <td>${new Date(a.date).toLocaleDateString('vi-VN')}</td>
              <td>${a.amount.toLocaleString('vi-VN')} VND</td>
              <td>${a.reason || 'Không có'}</td>
              <td class="${getAdvanceStatusClass(a)}">${getAdvanceStatusText(a)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Chưa có yêu cầu tạm ứng nào</p>'}
  `;
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
  const container = document.getElementById('salary-summary');
  if (!container) return;

  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) {
    container.innerHTML = '<p>Không tìm thấy thông tin nhân viên</p>';
    return;
  }

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const schedules = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && 
    s.approvalStatus === 'approved' && 
    s.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );
  
  const offDays = schedules.filter(s => s.status === 'off').length;
  const overtimeDays = schedules.filter(s => s.status === 'overtime').length;
  const workingDays = daysInMonth - offDays;
  const dailyWage = employee.dailyWage || 0;
  const overtimePay = overtimeDays * dailyWage * 1.5;
  const allowance = employee.allowance || 0;
  const otherFee = employee.otherFee || 0;
  
  const advances = globalAdvanceRequests.filter(a => 
    a.employeeId === currentEmployeeId && 
    a.status === 'approved' && 
    new Date(a.date).getMonth() + 1 === currentMonth &&
    new Date(a.date).getFullYear() === currentYear
  ).reduce((sum, a) => sum + a.amount, 0);
  
  const totalSalary = (workingDays * dailyWage) + overtimePay + allowance - otherFee - advances;

  container.innerHTML = `
    <h3>Dự tính lương tháng ${currentMonth}/${currentYear}</h3>
    <p><strong>Ngày công:</strong> ${workingDays}</p>
    <p><strong>Lương cơ bản:</strong> ${(workingDays * dailyWage).toLocaleString('vi-VN')} VND</p>
    <p><strong>Tiền tăng ca:</strong> ${overtimePay.toLocaleString('vi-VN')} VND</p>
    <p><strong>Phụ cấp:</strong> ${allowance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Phí khác:</strong> -${otherFee.toLocaleString('vi-VN')} VND</p>
    <p><strong>Tạm ứng:</strong> -${advances.toLocaleString('vi-VN')} VND</p>
    <hr>
    <p class="total-salary"><strong>Tổng lương dự tính:</strong> ${totalSalary.toLocaleString('vi-VN')} VND</p>
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