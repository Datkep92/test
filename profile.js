
// Thêm ở đầu file
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('profile')) {
    initProfile();
  }
});
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
    renderScheduleStatusList();
    renderNotifications();
    renderAdvanceHistory();
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
  renderScheduleStatusList();
  renderNotifications();
  renderAdvanceHistory();
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
      renderScheduleStatusList();
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
      renderScheduleStatusList();
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
      renderScheduleStatusList(); // Cập nhật danh sách trạng thái
      renderCalendar(); // Cập nhật lịch
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error approving schedule:', err);
    });
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
    andess: addressInput.value.trim() || ""
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
      renderScheduleStatusList(); // Cập nhật danh sách trạng thái
      renderCalendar(); // Cập nhật lịch
    })
    .catch(err => {
      showToastNotification(`Lỗi: ${err.message}`);
      console.error('❌ Error rejecting schedule:', err);
    });
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
  db.ref('schedules/' + scheduleId).set(scheduleData)
    .then(() => {
      showToastNotification(`✅ Đã gửi yêu cầu ${getScheduleTypeText(scheduleData)} thành công`);
      console.log("✅ Submitted schedule:", scheduleData);
      console.log("Current globalScheduleData:", globalScheduleData);
      closeModal('action-modal');
      if (document.getElementById('schedule-status-list')) {
        renderScheduleStatusList();
      } else {
        console.warn("Skipping renderScheduleStatusList, container not found");
      }
      renderCalendar();
      renderScheduleRequests();
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
        renderScheduleStatusList(); // Cập nhật danh sách
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
        renderScheduleStatusList(); // Cập nhật danh sách
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

function renderScheduleStatusList() {
  const container = document.getElementById('schedule-status-list');
  if (!container) {
    console.warn("schedule-status-list not found, possibly profile tab not active");
    return;
  }

  const isManager = isCurrentUserManager();

  // Hiển thị tất cả lịch trong tháng hiện tại cho cả nhân viên và quản lý
  const schedules = globalScheduleData.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() + 1 === currentScheduleMonth &&
           d.getFullYear() === currentScheduleYear;
  });

  container.innerHTML = `
    <div class="schedule-header">
      <button onclick="changeScheduleMonth(-1)">❮</button>
      <h4>Tháng ${currentScheduleMonth}/${currentScheduleYear}</h4>
      <button onclick="changeScheduleMonth(1)">❯</button>
    </div>
    ${schedules.length > 0 ? `
      <ul class="schedule-list">
        ${schedules.map(s => `
          <li class="schedule-item ${s.approvalStatus}${s.cancelRequested ? ' cancel-requested' : ''}">
            <div class="schedule-date">${new Date(s.date).toLocaleDateString('vi-VN')}</div>
            <div class="schedule-type">${getScheduleTypeText(s)}</div>
            <div class="schedule-status">${getScheduleStatusText(s)}${s.cancelRequested ? ' (Yêu cầu hủy)' : ''}</div>

            ${isManager && (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending') ? `
              <button class="small-btn" onclick="showScheduleActionModal('${s.id}', 'process')">Xử lý</button>
            ` : isManager && s.cancelRequested ? `
              <button class="small-btn" onclick="showScheduleActionModal('${s.id}', 'cancel')">Xử lý hủy</button>
            ` : s.employeeId === currentEmployeeId && 
                 (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending' || s.approvalStatus === 'approved') ? `
              <button class="small-btn" onclick="cancelSchedule('${s.id}')">Hủy</button>
            ` : ''}
          </li>
        `).join('')}
      </ul>
    ` : '<p>Không có lịch làm việc đặc biệt</p>'}
  `;

  container.style.display = 'block';
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
// Thêm vào profile.js, trước phần CALENDAR UI





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
// Sửa hàm renderAdvanceHistory
function renderAdvanceHistory() {
  const container = document.getElementById("advance-history-container");
  if (!container) return;

  const isManager = isCurrentUserManager();
  const requests = isManager
    ? globalAdvanceRequests.filter(a => a.status === "pending")
    : globalAdvanceRequests.filter(a => a.employeeId === currentEmployeeId);

  container.innerHTML = `
    <h3>Lịch sử tạm ứng</h3>
    ${requests.length > 0 ? `
      <table class="advance-table table-style">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân viên</th>
            <th>Số tiền</th>
            <th>Ghi chú</th>
            <th>Trạng thái/Hành động</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(a => `
            <tr>
              <td>${new Date(a.date).toLocaleDateString("vi-VN")}</td>
              <td>${a.employeeName || "Không xác định"}</td>
              <td>${!isNaN(Number(a.amount)) ? Number(a.amount).toLocaleString("vi-VN") : "Không xác định"} VND</td>
              <td>${a.reason || "Không có"}</td>
              <td>
                ${isManager && a.status === "pending" ? `
                  <button class="status-btn status-pending" onclick="showAdvanceActionModal('${a.id}', 'process')">Xử lý</button>
                ` : `
                  <button class="status-btn status-${a.status === 'denied' ? 'rejected' : a.status}">${getAdvanceStatusText(a)}</button>
                `}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : "<p>Chưa có yêu cầu tạm ứng nào</p>"}
  `;
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
      closeModal('action-modal'); // Đóng popup nếu mở từ modal
      renderAdvanceHistory(); // Cập nhật danh sách
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
      closeModal('action-modal'); // Đóng popup nếu mở từ modal
      renderAdvanceHistory(); // Cập nhật danh sách
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
    if (document.getElementById("schedule-status-list")) renderScheduleStatusList();
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
    if (document.getElementById("advance-history-container")) renderAdvanceHistory();
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
function showEmployeePayrollPopup(employeeId) {
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const content = document.getElementById("employee-payroll-content");
  content.innerHTML = renderPayrollContent(employee, currentMonth, currentYear);

  document.getElementById("employee-payroll-modal").style.display = "block";
}

function changePayrollMonth(employeeId) {
  const m = parseInt(document.getElementById("payroll-month-select").value);
  const y = parseInt(document.getElementById("payroll-year-select").value);
  const employee = globalEmployeeData.find(e => e.id === employeeId);
  if (!employee) return;

  const content = document.getElementById("employee-payroll-content");
  content.innerHTML = renderPayrollContent(employee, m, y);
}

function renderPayrollContent(employee, month, year) {
  const schedules = globalScheduleData.filter(s =>
    s.employeeId === employee.id &&
    new Date(s.date).getMonth() + 1 === month &&
    new Date(s.date).getFullYear() === year
  );

  const totalOff = schedules.filter(s => s.status === 'off' && s.approvalStatus === 'approved').length;
  const totalOvertime = schedules.filter(s => s.status === 'overtime' && s.approvalStatus === 'approved').length;

  window.__off = totalOff;
  window.__ot = totalOvertime;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `<option value="${m}" ${m === month ? 'selected' : ''}>Tháng ${m}</option>`;
  }).join("");

  return `
    <h3>Bảng tính lương: ${employee.name}</h3>
    <div style="margin-bottom: 8px;">
      <label>Chọn tháng: 
        <select id="payroll-month-select" onchange="changePayrollMonth(${employee.id})">
          ${monthOptions}
        </select>
        <select id="payroll-year-select" onchange="changePayrollMonth(${employee.id})">
          ${[year - 1, year, year + 1].map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="payroll-summary">
      <p>🛌 Ngày nghỉ: <strong>${totalOff}</strong></p>
      <p>🕒 Tăng ca: <strong>${totalOvertime}</strong></p>
    </div>

    <div class="payroll-inputs">
      <label>Giờ công cơ bản: <input type="number" id="baseHour" value="0" oninput="calculatePayroll()"></label>
      <label>Đơn giá/giờ: <input type="number" id="baseRate" value="60000" oninput="calculatePayroll()"></label>

      <fieldset style="grid-column: span 2;">
        <legend>⚖️ Chế tài</legend>
        <label><input type="checkbox" id="penalty-late" onchange="togglePenalty()"> Đi trễ</label>
        <input type="number" id="penalty-late-amount" value="0" oninput="calculatePayroll()" disabled>

        <label><input type="checkbox" id="penalty-other" onchange="togglePenalty()"> Vi phạm khác</label>
        <input type="number" id="penalty-other-amount" value="0" oninput="calculatePayroll()" disabled>
      </fieldset>

      <fieldset style="grid-column: span 2;">
        <legend>🎁 Thưởng</legend>
        <label><input type="checkbox" id="bonus-diligence" onchange="toggleBonus()"> Chuyên cần</label>
        <input type="number" id="bonus-diligence-amount" value="0" oninput="calculatePayroll()" disabled>

        <label><input type="checkbox" id="bonus-birthday" onchange="toggleBonus()"> Sinh nhật</label>
        <input type="number" id="bonus-birthday-amount" value="0" oninput="calculatePayroll()" disabled>
      </fieldset>

      <label style="grid-column: span 2;">± Khoản khác: <input type="number" id="extra" value="0" oninput="calculatePayroll()"></label>
    </div>

    <div id="payroll-total" class="payroll-total">
      💰 Tổng tạm tính: <strong>0</strong> đ
    </div>

    <div class="button-group">
      <button onclick="savePayroll(${employee.id}, ${month}, ${year})" class="primary-btn">💾 Lưu</button>
      <button onclick="printPayroll()" class="primary-btn">🖨 In</button>
      <button onclick="closeModal('employee-payroll-modal')" class="secondary-btn">Đóng</button>
    </div>

    <script>
      setTimeout(() => calculatePayroll(), 10);
    </script>
  `;
}

function calculatePayroll() {
  const overtime = window.__ot || 0;
  const off = window.__off || 0;

  const hour = parseFloat(document.getElementById("baseHour").value) || 0;
  const rate = parseFloat(document.getElementById("baseRate").value) || 0;
  const extra = parseFloat(document.getElementById("extra").value) || 0;

  const penalty =
    (document.getElementById("penalty-late").checked ? parseFloat(document.getElementById("penalty-late-amount").value) || 0 : 0) +
    (document.getElementById("penalty-other").checked ? parseFloat(document.getElementById("penalty-other-amount").value) || 0 : 0);

  const bonus =
    (document.getElementById("bonus-diligence").checked ? parseFloat(document.getElementById("bonus-diligence-amount").value) || 0 : 0) +
    (document.getElementById("bonus-birthday").checked ? parseFloat(document.getElementById("bonus-birthday-amount").value) || 0 : 0);

  const totalHour = hour + overtime - off;
  const salary = totalHour * rate + bonus - penalty + extra;

  const totalDiv = document.getElementById("payroll-total");
  if (totalDiv) {
    totalDiv.innerHTML = `💰 Tổng tạm tính: <strong>${salary.toLocaleString("vi-VN")}</strong> đ`;
  }
}

function togglePenalty() {
  document.getElementById("penalty-late-amount").disabled = !document.getElementById("penalty-late").checked;
  document.getElementById("penalty-other-amount").disabled = !document.getElementById("penalty-other").checked;
  calculatePayroll();
}

function toggleBonus() {
  document.getElementById("bonus-diligence-amount").disabled = !document.getElementById("bonus-diligence").checked;
  document.getElementById("bonus-birthday-amount").disabled = !document.getElementById("bonus-birthday").checked;
  calculatePayroll();
}

function savePayroll(employeeId, month, year) {
  const hour = parseFloat(document.getElementById("baseHour").value) || 0;
  const rate = parseFloat(document.getElementById("baseRate").value) || 0;
  const extra = parseFloat(document.getElementById("extra").value) || 0;

  const penalty =
    (document.getElementById("penalty-late").checked ? parseFloat(document.getElementById("penalty-late-amount").value) || 0 : 0) +
    (document.getElementById("penalty-other").checked ? parseFloat(document.getElementById("penalty-other-amount").value) || 0 : 0);

  const bonus =
    (document.getElementById("bonus-diligence").checked ? parseFloat(document.getElementById("bonus-diligence-amount").value) || 0 : 0) +
    (document.getElementById("bonus-birthday").checked ? parseFloat(document.getElementById("bonus-birthday-amount").value) || 0 : 0);

  const totalHour = hour + (window.__ot || 0) - (window.__off || 0);
  const salary = totalHour * rate + bonus - penalty + extra;

  const data = {
    employeeId,
    month,
    year,
    hour, rate, penalty, bonus, extra,
    totalHour, salary,
    savedAt: new Date().toISOString()
  };

  firebase.database().ref(`payrolls/${employeeId}/${year}-${String(month).padStart(2, '0')}`).set(data)
    .then(() => alert("💾 Đã lưu bảng lương."))
    .catch(err => alert("❌ Lỗi khi lưu: " + err.message));
}

function printPayroll() {
  const name = document.querySelector("#employee-payroll-content h3").innerText;
  const month = document.getElementById("payroll-month-select").value;
  const year = document.getElementById("payroll-year-select").value;
  const content = document.getElementById("employee-payroll-content").innerHTML;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
    <head>
      <title>${name} - Lương ${month}/${year}</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        h3 { margin-top: 0; }
        .payroll-summary, .payroll-inputs, .payroll-total {
          margin-bottom: 12px;
        }
        label { display: block; margin-bottom: 6px; }
        .payroll-inputs input {
          width: 120px;
          padding: 3px;
          margin-left: 8px;
          text-align: right;
        }
      </style>
    </head>
    <body>
      ${content}
      <script>window.print(); setTimeout(() => window.close(), 500);</script>
    </body>
    </html>
  `);
}

function initManagerPayrollAccess() {
  if (currentUserRole === 'admin') {
    document.getElementById("manager-payroll-section").style.display = "block";

    const select = document.getElementById("payroll-employee-select");
    select.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
      globalEmployeeData.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
  }
}
function initManagerPayrollAccess() {
  const current = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!current || current.role !== 'admin') return;

  const section = document.getElementById("manager-payroll-section");
  if (section) section.style.display = "block";

  const select = document.getElementById("payroll-employee-select");
  if (select) {
    select.innerHTML = '<option value="">-- Chọn nhân viên --</option>' +
      globalEmployeeData.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
  }
}


function renderAllScheduleRequests() {
  const container = document.getElementById("schedule-requests-preview");
  const btnViewAll = document.getElementById("view-all-schedule-requests");
  const isManager = isCurrentUserManager();

  const allRequests = isManager
    ? globalScheduleData.filter(s => s.requestType)
    : globalScheduleData.filter(s => s.employeeId === currentEmployeeId && s.requestType);

  const requests = allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const statusMap = {
    off: "🛌 Nghỉ",
    overtime: "🕒 Tăng ca",
    swap: "🔁 Đổi ca",
    "cancel-off": "🚫 Huỷ nghỉ",
    "cancel-overtime": "🚫 Huỷ tăng ca",
    "cancel-swap": "🚫 Huỷ đổi ca"
  };

  container.innerHTML = `
    <table class="table-style">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Loại</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map(req => {
          const emp = globalEmployeeData.find(e => e.id === req.employeeId);
          const name = emp?.name || req.employeeName || "Không rõ";
          const typeText = statusMap[req.status] || "❓";
          const date = new Date(req.date).toLocaleDateString("vi-VN");
          const status = req.approvalStatus === "approved"
            ? "✅ Đã duyệt"
            : req.approvalStatus === "rejected"
            ? "❌ Từ chối"
            : "⏳ Chờ duyệt";

          return `
            <tr>
              <td>${date}</td>
              <td>${name}</td>
              <td>${typeText}</td>
              <td>${status}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  btnViewAll.style.display = "none"; // Ẩn lại sau khi mở rộng
}

function renderScheduleRequests() {
  const container = document.getElementById("schedule-requests-preview");
  const btnViewAll = document.getElementById("view-all-schedule-requests");

  // Nếu container không tồn tại, không tiếp tục
  if (!container || !btnViewAll) {
    console.warn("⚠️ schedule-requests-preview hoặc view-all-schedule-requests không tồn tại trong DOM.");
    return;
  }

  const isManager = isCurrentUserManager();

  const allRequests = isManager
    ? globalScheduleData.filter(s => s.requestType)
    : globalScheduleData.filter(s => s.employeeId === currentEmployeeId && s.requestType);

  const requests = allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (requests.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    btnViewAll.style.display = "none";
    return;
  }

  const statusMap = {
    off: "🛌 Nghỉ",
    overtime: "🕒 Tăng ca",
    swap: "🔁 Đổi ca",
    "cancel-off": "🚫 Huỷ nghỉ",
    "cancel-overtime": "🚫 Huỷ tăng ca",
    "cancel-swap": "🚫 Huỷ đổi ca"
  };

  const previewList = requests.slice(0, 3);

  container.innerHTML = `
    <table class="table-style">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Loại</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${previewList.map(req => {
          const emp = globalEmployeeData.find(e => e.id === req.employeeId);
          const name = emp?.name || req.employeeName || "Không rõ";
          const typeText = statusMap[req.status] || "❓";
          const date = new Date(req.date).toLocaleDateString("vi-VN");
          const status = req.approvalStatus === "approved"
            ? "✅ Đã duyệt"
            : req.approvalStatus === "rejected"
            ? "❌ Từ chối"
            : "⏳ Chờ duyệt";

          return `
            <tr>
              <td>${date}</td>
              <td>${name}</td>
              <td>${typeText}</td>
              <td>${status}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  btnViewAll.style.display = requests.length > 3 ? "inline-block" : "none";
}

function renderEmployeeList() {
  const container = document.getElementById("employee-list-container");
  if (!container) return;

  const rows = globalEmployeeData.map(emp => `
    <tr onclick="showEmployeePopup('${emp.id}')">
      <td>${emp.name}</td>
      <td>${emp.phone || "Không rõ"}</td>
      <td>${emp.role}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <table class="table-style">
      <thead>
        <tr>
          <th>Tên</th>
          <th>SĐT</th>
          <th>Vai trò</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


function showEmployeeDetails(employeeId) {
  const emp = globalEmployeeData.find(e => e.id === employeeId);
  if (!emp) return;

  const modal = document.getElementById("employee-details-modal");
  const content = document.getElementById("employee-details-content");
  if (!modal || !content) return;

  content.innerHTML = `
    <h3>Thông tin nhân viên</h3>
    <p><strong>Tên:</strong> ${emp.name}</p>
    <p><strong>Vai trò:</strong> ${emp.role}</p>
    <p><strong>Email:</strong> ${emp.email}</p>
    <p><strong>Điện thoại:</strong> ${emp.phone || "Chưa có"}</p>
    <p><strong>Địa chỉ:</strong> ${emp.address || "Chưa có"}</p>
  `;

  modal.style.display = "block";
}

function showEmployeePopup(employeeId) {
  const emp = globalEmployeeData.find(e => e.id === employeeId);
  if (!emp) return;

  const modal = document.getElementById("action-modal");
  const content = document.getElementById("action-modal-content");
  if (!modal || !content) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const schedules = globalScheduleData.filter(s => {
    const date = new Date(s.date);
    return (
      s.employeeId === employeeId &&
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    );
  });

  const totalOff = schedules.filter(s => s.status === 'off' && s.approvalStatus === 'approved').length;
  const totalOvertime = schedules.filter(s => s.status === 'overtime' && s.approvalStatus === 'approved').length;

  const defaultHours = 8;
  const defaultWage = 20000;
  const defaultWorkingDays = totalDaysInMonth;

  const rewards = window.globalRewardData?.filter(r => r.employeeId === employeeId) || [];
  const punishments = window.globalPunishmentData?.filter(p => p.employeeId === employeeId) || [];

  const rewardHtml = rewards.map(r => `<tr><td>${r.reason}</td><td>+${r.amount.toLocaleString('vi-VN')}đ</td></tr>`).join('') || '<tr><td colspan="2">Không có</td></tr>';
  const punishmentHtml = punishments.map(p => `<tr><td>${p.reason}</td><td>-${p.amount.toLocaleString('vi-VN')}đ</td></tr>`).join('') || '<tr><td colspan="2">Không có</td></tr>';

  content.innerHTML = `
    <h3>👤 BẢNG LƯƠNG NHÂN VIÊN</h3>
    <p><strong>Tên:</strong> ${emp.name}</p>
    <p><strong>Email:</strong> ${emp.email || 'Chưa có'} | <strong>SĐT:</strong> ${emp.phone || emp.sdt || 'Chưa có'} | <strong>Địa chỉ:</strong> ${emp.address || emp.andess || 'Chưa có'}</p>
    <p><strong>Tháng:</strong> ${currentMonth + 1}/${currentYear}</p>

    <hr>
    <div class="input-group">
      <label>Giờ/ngày:</label>
      <input id="input-hours-${employeeId}" type="number" value="${defaultHours}" min="1" oninput="updateLiveSalary('${employeeId}', ${defaultWorkingDays}, ${totalOff}, ${totalOvertime})" />
    </div>
    <div class="input-group">
      <label>Tiền/giờ (VND):</label>
      <input id="input-wage-${employeeId}" type="number" value="${defaultWage}" min="1000" oninput="updateLiveSalary('${employeeId}', ${defaultWorkingDays}, ${totalOff}, ${totalOvertime})" />
    </div>

    <p><strong>Ngày làm thực tế:</strong> ${defaultWorkingDays - totalOff + totalOvertime}</p>
    <p><strong>Ngày nghỉ:</strong> ${totalOff} | <strong>Tăng ca:</strong> ${totalOvertime}</p>

    <h4>🎁 Thưởng</h4>
    <table><tbody id="reward-table-${employeeId}">${rewardHtml}</tbody></table>
    <div class="input-group">
      <input id="new-reward-${employeeId}" type="number" placeholder="Nhập tiền thưởng" oninput="updateLiveSalary('${employeeId}', ${defaultWorkingDays}, ${totalOff}, ${totalOvertime})" />
      <input id="new-reward-reason-${employeeId}" type="text" placeholder="Lý do" />
      <button onclick="addTempReward('${employeeId}')">➕ Thêm</button>
    </div>

    <h4>⚠️ Chế tài</h4>
    <table><tbody id="punishment-table-${employeeId}">${punishmentHtml}</tbody></table>
    <div class="input-group">
      <input id="new-punish-${employeeId}" type="number" placeholder="Nhập tiền phạt" oninput="updateLiveSalary('${employeeId}', ${defaultWorkingDays}, ${totalOff}, ${totalOvertime})" />
      <input id="new-punish-reason-${employeeId}" type="text" placeholder="Lý do" />
      <button onclick="addTempPunishment('${employeeId}')">➕ Thêm</button>
    </div>

    <h4>💰 Lương thực tính</h4>
    <div id="salary-result-${employeeId}" class="live-salary"></div>

    <div class="button-group">
      <button class="secondary-btn" onclick="printSalaryPopup('${employeeId}')">🖨️ In bảng lương</button>
      <button class="secondary-btn" onclick="closeModal('action-modal')">Đóng</button>
    </div>
  `;

  modal.style.display = "block";
  updateLiveSalary(employeeId, defaultWorkingDays, totalOff, totalOvertime);
}

function updateLiveSalary(employeeId, totalDaysInMonth, totalOff, totalOvertime) {
  const hours = parseFloat(document.getElementById(`input-hours-${employeeId}`)?.value || '0') || 0;
  const wage = parseFloat(document.getElementById(`input-wage-${employeeId}`)?.value || '0') || 0;
  const tempReward = parseFloat(document.getElementById(`new-reward-${employeeId}`)?.value || '0') || 0;
  const tempPunish = parseFloat(document.getElementById(`new-punish-${employeeId}`)?.value || '0') || 0;

  const rewards = window.globalRewardData?.filter(r => r.employeeId === employeeId) || [];
  const punishments = window.globalPunishmentData?.filter(p => p.employeeId === employeeId) || [];

  const rewardAmount = rewards.reduce((sum, r) => sum + (r.amount || 0), 0) + tempReward;
  const punishmentAmount = punishments.reduce((sum, p) => sum + (p.amount || 0), 0) + tempPunish;

  const workingDays = totalDaysInMonth - totalOff + totalOvertime;
  const baseSalary = workingDays * hours * wage;
  const totalSalary = baseSalary + rewardAmount - punishmentAmount;

  const resultField = document.getElementById(`salary-result-${employeeId}`);
  if (resultField) {
    resultField.innerHTML = `
      <p><strong>Lương cơ bản:</strong> ${baseSalary.toLocaleString('vi-VN')}đ</p>
      <p><strong>+ Thưởng:</strong> ${rewardAmount.toLocaleString('vi-VN')}đ</p>
      <p><strong>- Chế tài:</strong> ${punishmentAmount.toLocaleString('vi-VN')}đ</p>
      <p><strong>= Lương thực nhận:</strong> <span style="color:green; font-size: 1.2em">${totalSalary.toLocaleString('vi-VN')}đ</span></p>
    `;
  }
}

function addTempReward(employeeId) {
  updateLiveSalary(employeeId);
}

function addTempPunishment(employeeId) {
  updateLiveSalary(employeeId);
}

function printSalaryPopup(employeeId) {
  const modalContent = document.getElementById("action-modal-content");
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head><title>Bảng lương</title></head>
      <body style="font-family:sans-serif; padding:20px">${modalContent.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
