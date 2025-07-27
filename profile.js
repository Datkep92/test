// Giả định các biến toàn cục được định nghĩa ở file khác
// let globalScheduleData = [];
// let globalEmployeeData = [];
// let globalAdvanceRequests = [];
// let globalNotifications = [];
// let currentEmployeeId = auth.currentUser.uid;
// let db = firebase.database();
// let auth = firebase.auth();

// Biến toàn cục cho lịch và trạng thái
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentScheduleMonth = new Date().getMonth() + 1;
let currentScheduleYear = new Date().getFullYear();

// Hàm đóng modal
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Hàm chung để hiển thị danh sách
function renderList(containerId, data, templateFn) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} không tồn tại`);
    return;
  }
  container.innerHTML = '';
  const ul = document.createElement('ul');
  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = templateFn(item);
    li.style.cursor = 'pointer';
    li.onclick = () => templateFn.onclick ? templateFn.onclick(item) : null;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

// Sửa renderCalendar để hiển thị lịch tất cả nhân viên với ký hiệu
function renderCalendar() {
  const calendar = document.getElementById('calendar');
  if (!calendar) return;
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
    const schedules = globalScheduleData.filter(s => s.date === date);
    let statusClass = 'normal';
    if (schedules.some(s => s.status === 'off' && s.approvalStatus === 'approved')) {
      statusClass = 'off';
    } else if (schedules.some(s => s.status === 'overtime' && s.approvalStatus === 'approved')) {
      statusClass = 'overtime';
    } else if (schedules.some(s => s.status === 'swap' && s.approvalStatus === 'approved')) {
      statusClass = 'swap';
    } else if (schedules.some(s => s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending')) {
      statusClass = 'pending';
    }
    const hasCurrentEmployeeSchedule = schedules.some(s => s.employeeId === currentEmployeeId);
    const sticker = hasCurrentEmployeeSchedule ? '<span class="sticker">★</span>' : '';
    calendarHTML += `<div class="day ${statusClass}" data-date="${date}" onclick="showActionModal('${date}')">${day}${sticker}</div>`;
  }
  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
}

// Hàm chuyển tháng lịch
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

// Sửa showActionModal để hỗ trợ nhiều nhân viên nghỉ/tăng ca
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
    const statusText = existingSchedule.status === 'off' ? 'Nghỉ' : existingSchedule.status === 'overtime' ? 'Tăng Ca' : 'Đổi Ca';
    const approvalText = existingSchedule.approvalStatus === 'pending' ? 'Chờ duyệt' : existingSchedule.approvalStatus === 'swapPending' ? 'Chờ đổi ca' : 'Đã duyệt';
    content += `<p>Trạng thái của bạn: ${statusText} (${approvalText})</p>`;
  } else {
    content += `<p>Trạng thái của bạn: Trống</p>`;
  }
  if (otherEmployeesOff.length > 0) {
    const offNames = otherEmployeesOff.map(s => s.employeeName).join(', ');
    content += `<p>Nhân viên nghỉ: ${offNames}</p>`;
  } else {
    content += `<p>Không có nhân viên nào nghỉ.</p>`;
  }

  content += `<div class="button-group">`;
  if (!existingSchedule || existingSchedule.approvalStatus !== 'approved') {
    content += `
      <button class="primary-btn" onclick="submitScheduleRequest('${date}', 'off')">Nghỉ</button>
      <button class="primary-btn" onclick="submitScheduleRequest('${date}', 'overtime')">Tăng Ca</button>
    `;
  }
  if (otherEmployeesOff.length > 0) {
    otherEmployeesOff.forEach(emp => {
      content += `<button class="primary-btn" onclick="submitScheduleRequest('${date}', 'swap', '${emp.employeeId}')">Đổi ca với ${emp.employeeName}</button>`;
    });
  }
  if (existingSchedule && (existingSchedule.approvalStatus === 'pending' || existingSchedule.approvalStatus === 'approved')) {
    content += `<button class="secondary-btn" onclick="cancelSchedule('${existingSchedule.id}')">Hủy</button>`;
  }
  content += `<button class="primary-btn" onclick="closeModal('action-modal')">Đóng</button>`;
  content += `</div>`;

  modalContent.innerHTML = content;
  modal.style.display = 'block';
}

// Hàm gửi yêu cầu lịch
function submitScheduleRequest(date, status, targetEmployeeId = null) {
  if (!['off', 'overtime', 'swap'].includes(status)) {
    alert('Trạng thái không hợp lệ!');
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    alert('Vui lòng đăng nhập để gửi yêu cầu!');
    return;
  }
  const employee = globalEmployeeData.find(e => e.id === user.uid);
  if (!employee) {
    alert('Không tìm thấy thông tin nhân viên!');
    return;
  }

  const existingSchedule = globalScheduleData.find(s => s.employeeId === user.uid && s.date === date);
  if (existingSchedule) {
    db.ref('schedules/' + existingSchedule.id).remove()
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
    approvalStatus: status === 'swap' ? 'swapPending' : 'pending',
    timestamp: Date.now(),
    targetEmployeeId: status === 'swap' ? targetEmployeeId : null
  };

  db.ref('schedules/' + scheduleId).set(scheduleData)
    .then(() => {
      globalScheduleData.push(scheduleData);
      const statusText = status === 'off' ? 'Nghỉ' : status === 'overtime' ? 'Tăng Ca' : 'Đổi Ca';
      const notificationMessage = `Yêu cầu ${statusText} ngày ${date} từ ${employee.name}`;

      db.ref('messages/manager').push({
        message: notificationMessage,
        senderId: user.uid,
        senderName: employee.name,
        scheduleId,
        timestamp: Date.now()
      });

      if (status === 'swap' && targetEmployeeId) {
        const targetEmployee = globalEmployeeData.find(e => e.id === targetEmployeeId);
        if (targetEmployee) {
          db.ref(`notifications/${targetEmployeeId}`).push({
            message: `Yêu cầu đổi ca ngày ${date} từ ${employee.name}`,
            timestamp: Date.now(),
            type: 'swap',
            date,
            scheduleId,
            requesterId: user.uid,
            requesterName: employee.name,
            isRead: false
          });
        }
      }

      db.ref('notifications/' + user.uid).push({
        message: `Yêu cầu ${statusText} ngày ${date} đã được gửi.`,
        timestamp: Date.now(),
        type: 'confirmation',
        date,
        isRead: false
      }).then(() => {
        alert(`Yêu cầu ${statusText} đã được gửi!`);
        closeModal('action-modal');
        renderCalendar();
        renderScheduleStatusList();
        renderNotifications();
        renderOffAndOvertime();
        renderSalarySummary();
      });
    })
    .catch(err => alert('Lỗi khi gửi yêu cầu: ' + err.message));
}

// Hàm hủy yêu cầu lịch
function cancelSchedule(key) {
  const schedule = globalScheduleData.find(s => s.id === key);
  if (!schedule) {
    alert('Yêu cầu không tồn tại!');
    return;
  }
  db.ref('schedules/' + key).remove()
    .then(() => {
      globalScheduleData = globalScheduleData.filter(s => s.id !== key);
      const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
      const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]);
      const statusText = schedule.status === 'off' ? 'Nghỉ' : schedule.status === 'overtime' ? 'Tăng ca' : 'Đổi ca';
      const message = `${employeeName} đã hủy yêu cầu ${statusText} ngày ${schedule.date}`;
      db.ref('messages/manager').push({
        message,
        senderId: currentEmployeeId,
        senderName: employeeName,
        scheduleId: key,
        timestamp: Date.now()
      }).then(() => {
        db.ref('notifications/' + schedule.employeeId).push({
          message: `Yêu cầu ${statusText} ngày ${schedule.date} đã bị hủy.`,
          timestamp: Date.now(),
          type: 'confirmation',
          date: schedule.date,
          isRead: false
        });
        alert('Đã hủy yêu cầu và thông báo quản lý!');
        renderCalendar();
        renderScheduleStatusList();
        renderNotifications();
        renderOffAndOvertime();
        renderSalarySummary();
      }).catch(err => alert('Lỗi gửi thông báo hủy: ' + err.message));
    })
    .catch(err => alert('Lỗi hủy yêu cầu: ' + err.message));
}

// Hàm xử lý phản hồi đổi ca
function respondToSwapRequest(scheduleId, accept) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule || schedule.approvalStatus !== 'swapPending') {
    alert('Yêu cầu đổi ca không hợp lệ hoặc đã được xử lý!');
    return;
  }

  const user = auth.currentUser;
  if (!user || user.uid !== schedule.targetEmployeeId) {
    alert('Bạn không có quyền phản hồi yêu cầu này!');
    return;
  }

  const employee = globalEmployeeData.find(e => e.id === user.uid);
  const requester = globalEmployeeData.find(e => e.id === schedule.employeeId);
  if (!employee || !requester) {
    alert('Không tìm thấy thông tin nhân viên!');
    return;
  }

  if (accept) {
    db.ref('schedules/' + scheduleId).update({
      approvalStatus: 'approved'
    });
    globalScheduleData.find(s => s.id === scheduleId).approvalStatus = 'approved';

    const targetSchedule = globalScheduleData.find(s => s.employeeId === user.uid && s.date === schedule.date && s.status === 'off');
    if (targetSchedule) {
      db.ref('schedules/' + targetSchedule.id).remove();
      globalScheduleData = globalScheduleData.filter(s => s.id !== targetSchedule.id);
    }

    db.ref('messages/manager').push({
      message: `${employee.name} đã đồng ý đổi ca ngày ${schedule.date} với ${requester.name}`,
      senderId: user.uid,
      senderName: employee.name,
      scheduleId,
      timestamp: Date.now()
    });
    db.ref(`notifications/${schedule.employeeId}`).push({
      message: `${employee.name} đã đồng ý đổi ca ngày ${schedule.date}`,
      timestamp: Date.now(),
      type: 'confirmation',
      date: schedule.date,
      isRead: false
    });
  } else {
    db.ref('schedules/' + scheduleId).remove();
    globalScheduleData = globalScheduleData.filter(s => s.id !== scheduleId);

    db.ref('messages/manager').push({
      message: `${employee.name} đã từ chối đổi ca ngày ${schedule.date} với ${requester.name}`,
      senderId: user.uid,
      senderName: employee.name,
      scheduleId,
      timestamp: Date.now()
    });
    db.ref(`notifications/${schedule.employeeId}`).push({
      message: `${employee.name} đã từ chối đổi ca ngày ${schedule.date}`,
      timestamp: Date.now(),
      type: 'confirmation',
      date: schedule.date,
      isRead: false
    });
  }

  alert(`Đã ${accept ? 'đồng ý' : 'từ chối'} yêu cầu đổi ca!`);
  closeModal('action-modal');
  renderCalendar();
  renderScheduleStatusList();
  renderNotifications();
  renderOffAndOvertime();
  renderSalarySummary();
}

// Hàm hiển thị trạng thái lịch
function renderScheduleStatusList() {
  const schedules = globalScheduleData.filter(req => 
    req.employeeId === currentEmployeeId &&
    req.date.startsWith(`${currentScheduleYear}-${String(currentScheduleMonth).padStart(2, '0')}`)
  );
  renderList('schedule-status-list', schedules, (req) => {
    const statusText = req.status === 'off' ? 'Nghỉ' : req.status === 'overtime' ? 'Tăng Ca' : 'Đổi Ca';
    const approvalText = req.approvalStatus === 'pending' ? 'Chờ duyệt' : req.approvalStatus === 'swapPending' ? 'Chờ đổi ca' : 'Đã duyệt';
    return {
      html: `${statusText} ngày ${req.date} - ${approvalText}`,
      onclick: () => showActionModal(req.date, req)
    };
  });
  document.getElementById('schedule-month-title').innerHTML = `Tháng ${currentScheduleMonth}/${currentScheduleYear}`;
}

// Hàm chuyển tháng trạng thái lịch
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

// Hàm hiển thị thông báo
function renderNotifications() {
  const notifications = globalNotifications.filter(n => n.employeeId === currentEmployeeId && !n.isRead);
  renderList('notifications-container', notifications, (n) => {
    return {
      html: n.message,
      onclick: n.type === 'swap' ? () => showSwapResponseModal(n.scheduleId, n.date, n.requesterName) : null
    };
  });
}

// Hàm hiển thị popup phản hồi đổi ca
function showSwapResponseModal(scheduleId, date, requesterName) {
  const modal = document.getElementById('action-modal');
  const modalContent = document.getElementById('schedule-action-content');
  if (!modal || !modalContent) return;
  modalContent.innerHTML = `
    <h3>Yêu cầu đổi ca: ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    <p>Từ: ${requesterName}</p>
    <div class="button-group">
      <button class="primary-btn" onclick="respondToSwapRequest('${scheduleId}', true)">Đồng ý</button>
      <button class="secondary-btn" onclick="respondToSwapRequest('${scheduleId}', false)">Từ chối</button>
      <button class="primary-btn" onclick="closeModal('action-modal')">Đóng</button>
    </div>
  `;
  modal.style.display = 'block';
}

// Hàm cập nhật thông tin cá nhân
function updateEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    alert('Vui lòng đăng nhập để cập nhật thông tin!');
    return;
  }
  const name = document.getElementById('personal-employee-name').value;
  const address = document.getElementById('employee-address').value;
  const phone = document.getElementById('employee-phone').value;
  const note = document.getElementById('employee-note').value;

  const employeeData = { id: user.uid, name, address, phone, note };
  db.ref('employees/' + user.uid).set(employeeData)
    .then(() => {
      const index = globalEmployeeData.findIndex(e => e.id === user.uid);
      if (index !== -1) {
        globalEmployeeData[index] = employeeData;
      } else {
        globalEmployeeData.push(employeeData);
      }
      alert('Cập nhật thông tin thành công!');
    })
    .catch(err => alert('Lỗi cập nhật thông tin: ' + err.message));
}

// Hàm gửi yêu cầu tạm ứng
function requestAdvance() {
  const user = auth.currentUser;
  if (!user) {
    alert('Vui lòng đăng nhập để gửi yêu cầu!');
    return;
  }
  const amount = document.getElementById('advance-amount').value;
  const reason = document.getElementById('advance-reason').value;
  if (!amount || !reason) {
    alert('Vui lòng nhập số tiền và lý do!');
    return;
  }
  const employee = globalEmployeeData.find(e => e.id === user.uid);
  const requestId = Date.now().toString();
  const advanceData = {
    id: requestId,
    employeeId: user.uid,
    employeeName: employee ? employee.name : (user.displayName || user.email.split('@')[0]),
    amount: parseFloat(amount),
    reason,
    status: 'pending',
    timestamp: Date.now()
  };
  db.ref('advances/' + requestId).set(advanceData)
    .then(() => {
      globalAdvanceRequests.push(advanceData);
      db.ref('messages/manager').push({
        message: `Yêu cầu tạm ứng ${amount} VND từ ${advanceData.employeeName}: ${reason}`,
        senderId: user.uid,
        senderName: advanceData.employeeName,
        advanceId: requestId,
        timestamp: Date.now()
      });
      db.ref('notifications/' + user.uid).push({
        message: `Yêu cầu tạm ứng ${amount} VND đã được gửi.`,
        timestamp: Date.now(),
        type: 'confirmation',
        isRead: false
      });
      alert('Yêu cầu tạm ứng đã được gửi!');
      document.getElementById('advance-amount').value = '';
      document.getElementById('advance-reason').value = '';
      renderAdvanceHistory();
      renderNotifications();
    })
    .catch(err => alert('Lỗi gửi yêu cầu tạm ứng: ' + err.message));
}

// Hàm hiển thị lịch sử tạm ứng
function renderAdvanceHistory() {
  const requests = globalAdvanceRequests.filter(req => req.employeeId === currentEmployeeId);
  renderList('advance-history-container', requests, (req) => {
    const statusText = req.status === 'pending' ? 'Chờ duyệt' : req.status === 'approved' ? 'Đã duyệt' : 'Bị từ chối';
    return `${req.amount} VND - ${req.reason} - ${statusText}`;
  });
}

// Hàm hiển thị ngày off và tăng ca
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

  container.innerHTML = `
    <p>Ngày off trong tháng: ${offDays.length > 0 ? offDays.join(', ') : 'Không có'}</p>
    <p>Ngày tăng ca trong tháng: ${overtimeDays.length > 0 ? overtimeDays.join(', ') : 'Không có'}</p>
  `;
}

// Hàm tính và hiển thị tổng lương
function renderSalarySummary() {
  const container = document.getElementById('salary-summary');
  if (!container) return;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) {
    container.innerHTML = '<p>Không tìm thấy thông tin nhân viên.</p>';
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
  const allowance = employee.allowance || 0;
  const otherFee = employee.otherFee || 0;
  const overtimePay = overtimeDays * dailyWage * 1.5;
  const advances = globalAdvanceRequests.filter(a => 
    a.employeeId === currentEmployeeId && 
    a.status === 'approved' && 
    new Date(a.timestamp).getMonth() + 1 === currentMonth &&
    new Date(a.timestamp).getFullYear() === currentYear
  ).reduce((sum, a) => sum + a.amount, 0);
  const totalSalary = (workingDays * dailyWage) + overtimePay + allowance + otherFee - advances;

  container.innerHTML = `
    <p>Tổng lương tháng ${currentMonth}/${currentYear}</p>
    <p>Số ngày làm: ${workingDays}</p>
    <p>Lương cơ bản: ${workingDays * dailyWage} VND</p>
    <p>Tiền tăng ca: ${overtimePay} VND</p>
    <p>Phụ cấp: ${allowance} VND</p>
    <p>Phí khác: ${otherFee} VND</p>
    <p>Tạm ứng: ${advances} VND</p>
    <p>Thực nhận: ${totalSalary} VND</p>
  `;
}

// Hàm render toàn bộ tab Cá nhân
function renderProfile() {
  const user = auth.currentUser;
  if (!user) return;
  const employee = globalEmployeeData.find(e => e.id === user.uid);
  if (employee) {
    document.getElementById('personal-employee-name').value = employee.name || '';
    document.getElementById('employee-address').value = employee.address || '';
    document.getElementById('employee-phone').value = employee.phone || '';
    document.getElementById('employee-note').value = employee.note || '';
  }
  renderCalendar();
  renderScheduleStatusList();
  renderNotifications();
  renderAdvanceHistory();
  renderOffAndOvertime();
  renderSalarySummary();
}