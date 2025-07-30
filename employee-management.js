// File: js/employee-management.js
let currentCalendarMonth = new Date().getMonth() + 1;
let currentCalendarYear = new Date().getFullYear();

// ================ INITIALIZATION ================
function initEmployeeManagement() {
  setupRealtimeListeners();
  renderAllComponents();
}

function setupRealtimeListeners() {
  // Schedules
  db.ref('schedules').on('value', (snapshot) => {
    globalScheduleData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({
      id: key,
      ...snapshot.val()[key]
    })) : [];
    renderEmployeeCalendar();
    renderScheduleList();
    renderManagerActionHistory();
  });

  // Employees
  db.ref('employees').on('value', (snapshot) => {
    globalEmployeeData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({
      id: key,
      ...snapshot.val()[key]
    })) : [];
    renderEmployeeList();
  });

  // Advances
  db.ref('advances').on('value', (snapshot) => {
    globalAdvanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
    renderAdvanceList();
    renderManagerActionHistory();
  });
}

function renderAllComponents() {
  renderEmployeeCalendar();
  renderEmployeeList();
  renderScheduleList();
  renderAdvanceList();
  renderManagerActionHistory();
  renderEmployeeChat('group');
}

// ================ CALENDAR FUNCTIONS ================
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
    const date = `${currentCalendarYear}-${String(currentCalendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedules = globalScheduleData.filter(s => s.date === date);
    const status = calculateDayStatus(schedules);
    
    calendarHTML += `
      <div class="day ${status.class}" onclick="showEmployeeDayDetail('${date}')">
        ${day}
        <div class="day-status">
          ${status.offCount > 0 ? `<span class="status-off">N:${status.offCount}</span>` : ''}
          ${status.overtimeCount > 0 ? `<span class="status-overtime">TC:${status.overtimeCount}</span>` : ''}
          ${status.swapCount > 0 ? `<span class="status-swap">ĐC:${status.swapCount}</span>` : ''}
          ${status.pendingCount > 0 ? `<span class="status-pending">CD:${status.pendingCount}</span>` : ''}
        </div>
      </div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}

function calculateDayStatus(schedules) {
  const result = {
    class: 'normal',
    offCount: 0,
    overtimeCount: 0,
    swapCount: 0,
    pendingCount: 0
  };

  schedules.forEach(s => {
    if (s.approvalStatus === 'approved') {
      if (s.status === 'off') result.offCount++;
      else if (s.status === 'overtime') result.overtimeCount++;
      else if (s.status === 'swap') result.swapCount++;
    } else if (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending') {
      result.pendingCount++;
    }
  });

  if (result.pendingCount > 0) result.class = 'pending';
  else if (result.offCount > 0) result.class = 'off';
  else if (result.overtimeCount > 0) result.class = 'overtime';
  else if (result.swapCount > 0) result.class = 'swap';

  return result;
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
  const swapEmployees = schedules.filter(s => s.status === 'swap' && s.approvalStatus === 'approved');
  const pendingSchedules = schedules.filter(s => s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending');
  
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
        <h4>Nhân viên đổi ca (${swapEmployees.length})</h4>
        <ul>
          ${swapEmployees.map(e => `
            <li>
              ${getEmployeeName(e.employeeId)} ↔ ${getEmployeeName(e.targetEmployeeId)}
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
              ${s.status === 'off' ? 'Nghỉ' : s.status === 'overtime' ? 'Tăng ca' : `Đổi ca với ${getEmployeeName(s.targetEmployeeId)}`}
              <button class="small-btn" onclick="showScheduleDetailModal('${s.id}')">Xử lý</button>
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
    </div>
    
    <button class="primary-btn" onclick="closeModal('employee-day-modal')">Đóng</button>
  `;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

// ================ SCHEDULE MANAGEMENT ================
function renderScheduleList() {
  const container = document.getElementById('schedule-list');
  if (!container) return;

  const pendingRequests = globalScheduleData.filter(s => 
    s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending'
  ).sort((a, b) => b.timestamp - a.timestamp);

  const processedRequests = globalScheduleData.filter(s => 
    s.approvalStatus === 'approved' || s.approvalStatus === 'rejected'
  ).sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = `
    <div class="schedule-section">
      <h3>Yêu cầu chờ xử lý (${pendingRequests.length})</h3>
      ${pendingRequests.length > 0 ? renderScheduleTable(pendingRequests, true) : '<p>Không có yêu cầu chờ xử lý</p>'}
    </div>
    <div class="schedule-section">
      <h3>Lịch sử yêu cầu (${processedRequests.length})</h3>
      ${processedRequests.length > 0 ? renderScheduleTable(processedRequests, false) : '<p>Chưa có lịch sử yêu cầu</p>'}
    </div>
  `;
}

function renderScheduleTable(schedules, showActions) {
  return `
    <table class="schedule-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Loại yêu cầu</th>
          <th>Trạng thái</th>
          ${showActions ? '<th>Thao tác</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${schedules.map(s => `
          <tr>
            <td>${new Date(s.date).toLocaleDateString('vi-VN')}</td>
            <td>${s.employeeName || getEmployeeName(s.employeeId)}</td>
            <td>${getScheduleTypeText(s)}</td>
            <td class="${getStatusClass(s)}">${getScheduleStatusText(s)}</td>
            ${showActions ? `
              <td><button class="small-btn" onclick="showScheduleDetailModal('${s.id}')">Xử lý</button></td>
            ` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showScheduleDetailModal(scheduleId) {
  const modal = document.getElementById('schedule-detail-modal');
  const modalContent = document.getElementById('schedule-detail-modal-content');
  if (!modal || !modalContent) return;

  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  const employeeSchedules = globalScheduleData.filter(s => s.employeeId === schedule.employeeId);
  const statusText = schedule.status === 'off' ? 'Nghỉ' : schedule.status === 'overtime' ? 'Tăng ca' : `Đổi ca với ${getEmployeeName(schedule.targetEmployeeId)}`;

  let content = `
    <h3>Xử lý yêu cầu: ${getEmployeeName(schedule.employeeId)}</h3>
    <div class="tab-container">
      <button class="tab-button active" onclick="showTabContent('schedule-process-tab', this)">Xử lý yêu cầu</button>
      <button class="tab-button" onclick="showTabContent('schedule-history-tab', this)">Lịch sử lịch làm việc</button>
    </div>
    <div id="schedule-process-tab" class="tab-content active">
      <p>Ngày: ${new Date(schedule.date).toLocaleDateString('vi-VN')}</p>
      <p>Loại: ${statusText}</p>
      ${schedule.approvalStatus === 'pending' || schedule.approvalStatus === 'swapPending' ? `
        <div class="input-group">
          <label for="approval-reason">Lý do (nếu từ chối):</label>
          <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)"></textarea>
        </div>
        <div class="button-group">
          <button class="primary-btn" onclick="approveSchedule('${scheduleId}')">Duyệt</button>
          <button class="secondary-btn" onclick="rejectSchedule('${scheduleId}')">Từ chối</button>
        </div>
      ` : `<p>Trạng thái: ${schedule.approvalStatus === 'approved' ? 'Đã duyệt' : `Từ chối: ${schedule.rejectReason || ''}`}</p>`}
      <button class="primary-btn" onclick="closeModal('schedule-detail-modal')">Đóng</button>
    </div>
    <div id="schedule-history-tab" class="tab-content">
      <table class="history-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Trạng thái</th>
            <th>Nội dung</th>
          </tr>
        </thead>
        <tbody>
          ${employeeSchedules.sort((a, b) => b.timestamp - a.timestamp).map(s => {
            const sStatus = s.status === 'off' ? 'Nghỉ' : s.status === 'overtime' ? 'Tăng ca' : `Đổi ca với ${getEmployeeName(s.targetEmployeeId)}`;
            const approvalText = s.approvalStatus === 'approved' ? 'Đã duyệt' : s.approvalStatus === 'rejected' ? `Từ chối: ${s.rejectReason || ''}` : 'Chờ duyệt';
            return `
              <tr>
                <td>${new Date(s.date).toLocaleDateString('vi-VN')}</td>
                <td>${approvalText}</td>
                <td>${sStatus}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

function approveSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  const updates = {};
  updates[`schedules/${scheduleId}/approvalStatus`] = 'approved';
  updates[`schedules/${scheduleId}/updatedAt`] = Date.now();
  
  // Thông báo cho nhân viên
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu ${statusText} ngày ${schedule.date} đã được duyệt`,
    timestamp: Date.now(),
    type: 'schedule_approval',
    isRead: false
  };

  // Nếu là đổi ca, cập nhật cả lịch của nhân viên đổi
  if (schedule.status === 'swap' && schedule.targetEmployeeId) {
    const swapScheduleId = `${schedule.date}_${schedule.targetEmployeeId}`;
    updates[`schedules/${swapScheduleId}`] = {
      id: swapScheduleId,
      employeeId: schedule.targetEmployeeId,
      employeeName: getEmployeeName(schedule.targetEmployeeId),
      date: schedule.date,
      status: 'off',
      approvalStatus: 'approved',
      timestamp: Date.now()
    };
    
    // Thông báo cho nhân viên đổi ca
    updates[`notifications/${schedule.targetEmployeeId}/notif_${Date.now()}`] = {
      message: `Bạn đã đồng ý đổi ca ngày ${schedule.date} với ${schedule.employeeName}`,
      timestamp: Date.now(),
      type: 'swap_approval',
      isRead: false
    };
  }

  db.ref().update(updates)
    .then(() => {
      alert('Đã duyệt yêu cầu!');
      closeModal('schedule-detail-modal');
    })
    .catch(err => alert('Lỗi khi duyệt: ' + err.message));
}

function rejectSchedule(scheduleId) {
  const reason = document.getElementById('approval-reason').value.trim();
  if (!reason) {
    alert('Vui lòng nhập lý do từ chối!');
    return;
  }

  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  const updates = {};
  updates[`schedules/${scheduleId}/approvalStatus`] = 'rejected';
  updates[`schedules/${scheduleId}/updatedAt`] = Date.now();
  updates[`schedules/${scheduleId}/rejectReason`] = reason;
  
  // Thông báo cho nhân viên
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu ${statusText} ngày ${schedule.date} bị từ chối: ${reason}`,
    timestamp: Date.now(),
    type: 'schedule_rejection',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      alert('Đã từ chối yêu cầu!');
      closeModal('schedule-detail-modal');
    })
    .catch(err => alert('Lỗi khi từ chối: ' + err.message));
}

function showScheduleActionModal(scheduleId) {
  const modal = document.getElementById('schedule-action-modal');
  const modalContent = document.getElementById('schedule-action-modal-content');
  if (!modal || !modalContent) return;

  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  modalContent.innerHTML = `
    <h3>Sửa lịch: ${getEmployeeName(schedule.employeeId)}</h3>
    <p>Ngày: ${new Date(schedule.date).toLocaleDateString('vi-VN')}</p>
    <p>Trạng thái: ${schedule.status === 'off' ? 'Nghỉ' : schedule.status === 'overtime' ? 'Tăng ca' : `Đổi ca với ${getEmployeeName(schedule.targetEmployeeId)}`}</p>
    <div class="button-group">
      <button class="secondary-btn" onclick="deleteSchedule('${scheduleId}')">Xóa</button>
      <button class="primary-btn" onclick="closeModal('schedule-action-modal')">Đóng</button>
    </div>
  `;
  modal.style.display = 'block';
}

function deleteSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) return;

  if (!confirm('Bạn chắc chắn muốn xóa lịch này?')) return;

  const updates = {};
  updates[`schedules/${scheduleId}`] = null;
  
  // Thông báo cho nhân viên
  const statusText = schedule.status === 'off' ? 'nghỉ' : schedule.status === 'overtime' ? 'tăng ca' : 'đổi ca';
  updates[`notifications/${schedule.employeeId}/notif_${Date.now()}`] = {
    message: `Lịch ${statusText} ngày ${schedule.date} đã bị xóa`,
    timestamp: Date.now(),
    type: 'schedule_deletion',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      alert('Đã xóa lịch!');
      closeModal('schedule-action-modal');
    })
    .catch(err => alert('Lỗi khi xóa lịch: ' + err.message));
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
      alert('Đã thêm lịch thành công!');
      closeModal('employee-day-modal');
    })
    .catch(err => alert('Lỗi khi thêm lịch: ' + err.message));
}

// ================ ADVANCE MANAGEMENT ================
function renderAdvanceList() {
  const container = document.getElementById('advance-list');
  if (!container) return;

  const pendingAdvances = globalAdvanceRequests.filter(a => a.status === 'pending')
    .sort((a, b) => b.timestamp - a.timestamp);
  
  const processedAdvances = globalAdvanceRequests.filter(a => a.status !== 'pending')
    .sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = `
    <div class="advance-section">
      <h3>Yêu cầu tạm ứng chờ xử lý (${pendingAdvances.length})</h3>
      ${pendingAdvances.length > 0 ? renderAdvanceTable(pendingAdvances, true) : '<p>Không có yêu cầu tạm ứng chờ xử lý</p>'}
    </div>
    <div class="advance-section">
      <h3>Lịch sử tạm ứng (${processedAdvances.length})</h3>
      ${processedAdvances.length > 0 ? renderAdvanceTable(processedAdvances, false) : '<p>Chưa có lịch sử tạm ứng</p>'}
    </div>
  `;
}

function renderAdvanceTable(advances, showActions) {
  return `
    <table class="advance-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Số tiền</th>
          <th>Lý do</th>
          <th>Trạng thái</th>
          ${showActions ? '<th>Thao tác</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${advances.map(a => `
          <tr>
            <td>${new Date(a.date).toLocaleDateString('vi-VN')}</td>
            <td>${a.employeeName || getEmployeeName(a.employeeId)}</td>
            <td>${a.amount.toLocaleString('vi-VN')} VND</td>
            <td>${a.reason || 'Không có'}</td>
            <td class="${getAdvanceStatusClass(a)}">${getAdvanceStatusText(a)}</td>
            ${showActions ? `
              <td><button class="small-btn" onclick="showAdvanceDetailModal('${a.id}')">Xử lý</button></td>
            ` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showAdvanceDetailModal(advanceId) {
  const modal = document.getElementById('advance-detail-modal');
  const modalContent = document.getElementById('advance-detail-modal-content');
  if (!modal || !modalContent) return;

  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  const employeeAdvances = globalAdvanceRequests.filter(a => a.employeeId === advance.employeeId);

  let content = `
    <h3>Xử lý tạm ứng: ${getEmployeeName(advance.employeeId)}</h3>
    <div class="tab-container">
      <button class="tab-button active" onclick="showTabContent('advance-process-tab', this)">Xử lý yêu cầu</button>
      <button class="tab-button" onclick="showTabContent('advance-history-tab', this)">Lịch sử tạm ứng</button>
    </div>
    <div id="advance-process-tab" class="tab-content active">
      <p>Ngày: ${new Date(advance.date).toLocaleDateString('vi-VN')}</p>
      <p>Số tiền: ${advance.amount.toLocaleString('vi-VN')} VND</p>
      <p>Lý do: ${advance.reason || 'Không có'}</p>
      ${advance.status === 'pending' ? `
        <div class="input-group">
          <label for="approval-reason">Lý do (nếu từ chối):</label>
          <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)"></textarea>
        </div>
        <div class="button-group">
          <button class="primary-btn" onclick="approveAdvance('${advanceId}')">Duyệt</button>
          <button class="secondary-btn" onclick="rejectAdvance('${advanceId}')">Từ chối</button>
        </div>
      ` : `<p>Trạng thái: ${advance.status === 'approved' ? 'Đã duyệt' : `Từ chối: ${advance.rejectReason || ''}`}</p>`}
      <button class="primary-btn" onclick="closeModal('advance-detail-modal')">Đóng</button>
    </div>
    <div id="advance-history-tab" class="tab-content">
      <table class="history-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Số tiền</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${employeeAdvances.sort((a, b) => b.timestamp - a.timestamp).map(a => {
            const statusText = a.status === 'approved' ? 'Đã duyệt' : a.status === 'denied' ? `Từ chối: ${a.rejectReason || ''}` : 'Chờ duyệt';
            return `
              <tr>
                <td>${new Date(a.date).toLocaleDateString('vi-VN')}</td>
                <td>${a.amount.toLocaleString('vi-VN')} VND</td>
                <td>${a.reason || 'Không có'}</td>
                <td>${statusText}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

function approveAdvance(advanceId) {
  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  const updates = {};
  updates[`advances/${advanceId}/status`] = 'approved';
  updates[`advances/${advanceId}/updatedAt`] = Date.now();
  
  // Thông báo cho nhân viên
  updates[`notifications/${advance.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND đã được duyệt`,
    timestamp: Date.now(),
    type: 'advance_approval',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      alert('Đã duyệt yêu cầu tạm ứng!');
      closeModal('advance-detail-modal');
    })
    .catch(err => alert('Lỗi khi duyệt: ' + err.message));
}

function rejectAdvance(advanceId) {
  const reason = document.getElementById('approval-reason').value.trim();
  if (!reason) {
    alert('Vui lòng nhập lý do từ chối!');
    return;
  }

  const advance = globalAdvanceRequests.find(a => a.id === advanceId);
  if (!advance) return;

  const updates = {};
  updates[`advances/${advanceId}/status`] = 'denied';
  updates[`advances/${advanceId}/updatedAt`] = Date.now();
  updates[`advances/${advanceId}/rejectReason`] = reason;
  
  // Thông báo cho nhân viên
  updates[`notifications/${advance.employeeId}/notif_${Date.now()}`] = {
    message: `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND bị từ chối: ${reason}`,
    timestamp: Date.now(),
    type: 'advance_rejection',
    isRead: false
  };

  db.ref().update(updates)
    .then(() => {
      alert('Đã từ chối yêu cầu tạm ứng!');
      closeModal('advance-detail-modal');
    })
    .catch(err => alert('Lỗi khi từ chối: ' + err.message));
}

// ================ EMPLOYEE MANAGEMENT ================
// File: js/employee-management.js

// ================ EMPLOYEE MANAGEMENT ================

function renderEmployeeList() {
  const container = document.getElementById("employee-list");
  container.innerHTML = "";

  globalEmployeeData.forEach(emp => {
    const div = document.createElement("div");
    div.className = "employee-item";
    div.innerHTML = `
      <div><b>${emp.name}</b> (${emp.role})</div>
      <div>${emp.email || ""}</div>
      <button onclick="editEmployee('${emp.id}')">Sửa</button>
      <button onclick="deleteEmployee('${emp.id}')">Xóa</button>
    `;
    container.appendChild(div);
  });
}



function showAddEmployeeForm() {
  const modal = document.getElementById("employee-modal");
  const content = document.getElementById("employee-modal-content");

  content.innerHTML = `
    <div class="employee-form">
      <input type="hidden" id="employee-form-id" value="">
      <label for="employee-name">Tên nhân viên</label>
      <input type="text" id="employee-name" placeholder="Nhập tên nhân viên">
      <label for="employee-email">Email</label>
      <input type="email" id="employee-email" placeholder="Nhập email">
      <label for="employee-role">Vai trò</label>
      <select id="employee-role">
        <option value="employee">Nhân viên</option>
        <option value="manager">Quản lý</option>
      </select>
      <div style="margin-top: 12px; display: flex; gap: 10px;">
        <button class="primary-btn" onclick="submitEmployeeForm()">💾 Lưu</button>
        <button class="secondary-btn" onclick="closeEmployeeForm()">❌ Hủy</button>
      </div>
    </div>
  `;
  modal.style.display = "block";
}


function editEmployee(employee) {
  const modal = document.getElementById("employee-modal");
  const content = document.getElementById("employee-modal-content");

  content.innerHTML = `
    <div class="employee-form">
      <input type="hidden" id="employee-form-id" value="${employee.id}">
      <label for="employee-name">Tên nhân viên</label>
      <input type="text" id="employee-name" value="${employee.name}">
      <label for="employee-email">Email</label>
      <input type="email" id="employee-email" value="${employee.email}">
      <label for="employee-role">Vai trò</label>
      <select id="employee-role">
        <option value="employee" ${employee.role === 'employee' ? 'selected' : ''}>Nhân viên</option>
        <option value="manager" ${employee.role === 'manager' ? 'selected' : ''}>Quản lý</option>
      </select>
      <div style="margin-top: 12px; display: flex; gap: 10px;">
        <button class="primary-btn" onclick="submitEmployeeForm()">💾 Lưu</button>
        <button class="secondary-btn" onclick="closeEmployeeForm()">❌ Hủy</button>
      </div>
    </div>
  `;
  modal.style.display = "block";
}





function closeEmployeeForm() {
  document.getElementById("employee-modal").style.display = "none";
}



function submitEmployeeForm() {
  const id = document.getElementById("employee-form-id").value;
  const name = document.getElementById("employee-name").value.trim();
  const email = document.getElementById("employee-email").value.trim();
  const role = document.getElementById("employee-role").value;

  if (!name || !email) {
    alert("Vui lòng nhập đầy đủ thông tin.");
    return;
  }

  const newData = { name, email, role, active: true };

  if (id) {
    firebase.database().ref("users/" + id).update(newData)
      .then(() => {
        showToastNotification("✅ Đã cập nhật nhân viên.");
        closeEmployeeForm();
        loadFirebaseData();
      })
      .catch(err => alert("Lỗi khi cập nhật: " + err.message));
  } else {
    const newRef = firebase.database().ref("users").push();
    newRef.set(newData)
      .then(() => {
        showToastNotification("✅ Đã thêm nhân viên.");
        closeEmployeeForm();
        loadFirebaseData();
      })
      .catch(err => alert("Lỗi khi thêm mới: " + err.message));
  }
}

// Tải danh sách nhân viên khi khởi tạo
function loadEmployees() {
  db.ref("users").once("value").then(snapshot => {
    globalEmployeeData = [];
    snapshot.forEach(child => {
      globalEmployeeData.push({ id: child.key, ...child.val() });
    });
    renderEmployeeList();
  });
}


function showEmployeeDetailModal(employeeId) {
  const modal = document.getElementById('employee-modal');
  const modalContent = document.getElementById('employee-modal-content');
  if (!modal || !modalContent) return;

  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;

  const currentMonth = `${currentCalendarYear}-${String(currentCalendarMonth).padStart(2, '0')}`;
  const schedules = globalScheduleData.filter(s => 
    s.employeeId === employeeId && 
    s.approvalStatus === 'approved' && 
    s.date.startsWith(currentMonth)
  );
  
  const workDays = schedules.filter(s => s.status === 'normal').length;
  const offDays = schedules.filter(s => s.status === 'off').length;
  const overtimeDays = schedules.filter(s => s.status === 'overtime').length;
  const swapDays = schedules.filter(s => s.status === 'swap').map(s => new Date(s.date).toLocaleDateString('vi-VN')).join(', ') || 'Không có';

  const baseSalary = workDays * (employee.dailyWage || 0);
  const overtimePay = overtimeDays * (employee.dailyWage || 0) * 1.5;
  const allowance = employee.allowance || 0;
  const otherFee = employee.otherFee || 0;
  const advances = globalAdvanceRequests
    .filter(a => a.employeeId === employeeId && a.status === 'approved' && a.date.startsWith(currentMonth))
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalSalary = baseSalary + overtimePay + allowance - otherFee - advances;

  modalContent.innerHTML = `
    <h3>Thông tin nhân viên: ${employee.name}</h3>
    <div class="tab-container">
      <button class="tab-button active" onclick="showTabContent('employee-info-tab', this)">Thông tin</button>
      <button class="tab-button" onclick="showTabContent('employee-financial-tab', this)">Tài chính</button>
    </div>
    <div id="employee-info-tab" class="tab-content active">
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
        <button class="secondary-btn" onclick="deleteEmployee('${employeeId}')">Xóa</button>
        <button class="primary-btn" onclick="startEmployeeChat('${employeeId}')">Chat</button>
      </div>
    </div>
    <div id="employee-financial-tab" class="tab-content">
      <p><strong>Tháng:</strong> ${currentCalendarMonth}/${currentCalendarYear}</p>
      <p><strong>Ngày công:</strong> ${workDays}</p>
      <p><strong>Ngày nghỉ:</strong> ${offDays}</p>
      <p><strong>Ngày tăng ca:</strong> ${overtimeDays}</p>
      <p><strong>Ngày đổi ca:</strong> ${swapDays}</p>
      <hr>
      <p><strong>Lương cơ bản:</strong> ${baseSalary.toLocaleString('vi-VN')} VND</p>
      <p><strong>Tiền tăng ca:</strong> ${overtimePay.toLocaleString('vi-VN')} VND</p>
      <p><strong>Phụ cấp:</strong> ${allowance.toLocaleString('vi-VN')} VND</p>
      <p><strong>Phí khác:</strong> -${otherFee.toLocaleString('vi-VN')} VND</p>
      <p><strong>Tạm ứng:</strong> -${advances.toLocaleString('vi-VN')} VND</p>
      <hr>
      <p class="total-salary"><strong>Tổng lương:</strong> ${totalSalary.toLocaleString('vi-VN')} VND</p>
    </div>
    <button class="primary-btn" onclick="closeModal('employee-modal')">Đóng</button>
  `;

  modal.style.display = 'block';
}

function updateEmployee(employeeId) {
  const employee = {
    name: document.getElementById('employee-name').value,
    email: document.getElementById('employee-email').value,
    dailyWage: parseFloat(document.getElementById('employee-daily-wage').value) || 0,
    allowance: parseFloat(document.getElementById('employee-allowance').value) || 0,
    otherFee: parseFloat(document.getElementById('employee-other-fee').value) || 0,
    role: 'employee'
  };

  db.ref(`employees/${employeeId}`).update(employee)
    .then(() => {
      alert('Cập nhật nhân viên thành công!');
      closeModal('employee-modal');
    })
    .catch(err => alert('Lỗi khi cập nhật nhân viên: ' + err.message));
}

function deleteEmployee(employeeId) {
  if (!confirm('Bạn có chắc muốn xóa nhân viên này?')) return;

  const updates = {};
  updates[`employees/${employeeId}`] = null;
  
  // Xóa tất cả lịch của nhân viên
  globalScheduleData
    .filter(s => s.employeeId === employeeId)
    .forEach(s => {
      updates[`schedules/${s.id}`] = null;
    });
  
  // Xóa tất cả yêu cầu tạm ứng
  globalAdvanceRequests
    .filter(a => a.employeeId === employeeId)
    .forEach(a => {
      updates[`advances/${a.id}`] = null;
    });

  db.ref().update(updates)
    .then(() => {
      alert('Xóa nhân viên thành công!');
      renderEmployeeList();
    })
    .catch(err => alert('Lỗi khi xóa nhân viên: ' + err.message));
}

// ================ MANAGER ACTION HISTORY ================
function renderManagerActionHistory() {
  const container = document.getElementById('manager-action-history');
  if (!container) return;

  const actions = [];
  
  // Thêm hành động từ lịch làm việc
  globalScheduleData.forEach(s => {
    if (s.approvalStatus === 'approved' || s.approvalStatus === 'rejected') {
      const statusText = s.status === 'off' ? 'Nghỉ' : s.status === 'overtime' ? 'Tăng ca' : `Đổi ca với ${getEmployeeName(s.targetEmployeeId)}`;
      actions.push({
        date: new Date(s.updatedAt).toISOString().split('T')[0],
        type: 'schedule',
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        status: s.approvalStatus,
        details: `${s.approvalStatus === 'approved' ? 'Duyệt' : 'Từ chối'} ${statusText} ngày ${s.date}${s.rejectReason ? `: ${s.rejectReason}` : ''}`,
        timestamp: s.updatedAt
      });
    }
  });

  // Thêm hành động từ tạm ứng
  globalAdvanceRequests.forEach(a => {
    if (a.status === 'approved' || a.status === 'denied') {
      actions.push({
        date: new Date(a.updatedAt).toISOString().split('T')[0],
        type: 'advance',
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        status: a.status,
        details: `${a.status === 'approved' ? 'Duyệt' : 'Từ chối'} tạm ứng ${a.amount.toLocaleString('vi-VN')} VND${a.rejectReason ? `: ${a.rejectReason}` : ''}`,
        timestamp: a.updatedAt
      });
    }
  });

  if (actions.length === 0) {
    container.innerHTML = '<p>Chưa có lịch sử xử lý.</p>';
    return;
  }

  container.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Hành động</th>
          <th>Nhân viên</th>
          <th>Chi tiết</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${actions.sort((a, b) => b.timestamp - a.timestamp).map(a => `
          <tr>
            <td>${a.date}</td>
            <td>${a.type === 'schedule' ? 'Lịch làm việc' : 'Tạm ứng'}</td>
            <td>${a.employeeName}</td>
            <td>${a.details}</td>
            <td>${a.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ================ CHAT FUNCTIONS ================
function renderEmployeeChat(employeeId) {
  const container = document.getElementById('employee-chat');
  if (!container) return;

  container.innerHTML = `
    <div class="chat-header">
      <h3>Chat và thông báo chung</h3>
      <select id="chat-employee-select" onchange="loadEmployeeChat(this.value)">
        <option value="group">Thông báo chung</option>
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
  else loadEmployeeChat('group');
}

function loadEmployeeChat(recipientId) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';

  const messages = globalMessages[recipientId] || [];
  if (messages.length === 0) {
    messagesContainer.innerHTML = '<p>Chưa có tin nhắn nào.</p>';
    return;
  }

  messages.forEach(msg => {
    const isManager = msg.senderId === 'manager';
    const msgElement = document.createElement('div');
    msgElement.className = `chat-message ${isManager ? 'sent' : 'received'}`;
    msgElement.innerHTML = `
      <div class="message-sender">${isManager ? 'Bạn' : msg.senderName || 'Nhân viên'}</div>
      <div class="message-content">${msg.message}</div>
      <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('vi-VN')}</div>
    `;
    messagesContainer.appendChild(msgElement);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendEmployeeChat() {
  const recipientId = document.getElementById('chat-employee-select').value;
  if (!recipientId) {
    alert('Vui lòng chọn nhân viên hoặc nhóm để chat!');
    return;
  }

  const message = document.getElementById('employee-chat-text').value.trim();
  if (!message) {
    alert('Vui lòng nhập nội dung tin nhắn!');
    return;
  }

  const chatData = {
    message: message,
    senderId: 'manager',
    senderName: 'Quản lý',
    timestamp: Date.now()
  };

  if (recipientId === 'group') {
    globalEmployeeData.forEach(employee => {
      db.ref(`messages/${employee.id}`).push(chatData);
      db.ref(`notifications/${employee.id}`).push({
        message: `Thông báo chung từ Quản lý: ${message}`,
        timestamp: Date.now(),
        type: 'chat',
        isRead: false
      });
    });
    db.ref('messages/group').push(chatData)
      .then(() => {
        document.getElementById('employee-chat-text').value = '';
      })
      .catch(err => alert('Lỗi khi gửi thông báo chung: ' + err.message));
  } else {
    db.ref(`messages/${recipientId}`).push(chatData)
      .then(() => {
        db.ref(`notifications/${recipientId}`).push({
          message: `Bạn có tin nhắn mới từ Quản lý`,
          timestamp: Date.now(),
          type: 'chat',
          isRead: false
        });
        document.getElementById('employee-chat-text').value = '';
      })
      .catch(err => alert('Lỗi khi gửi tin nhắn: ' + err.message));
  }
}

function startEmployeeChat(employeeId) {
  document.getElementById('chat-employee-select').value = employeeId;
  loadEmployeeChat(employeeId);
  document.getElementById('employee-chat-section').scrollIntoView({ behavior: 'smooth' });
}

// ================ HELPER FUNCTIONS ================
function getEmployeeName(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  return employee ? employee.name : 'Không rõ';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function showTabContent(tabId, button) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  button.classList.add('active');
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

function getStatusClass(schedule) {
  switch(schedule.approvalStatus) {
    case 'pending': return 'status-pending';
    case 'swapPending': return 'status-pending';
    case 'approved': return 'status-approved';
    case 'rejected': return 'status-rejected';
    default: return '';
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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('employee-management')) {
    initEmployeeManagement();
  }
});
