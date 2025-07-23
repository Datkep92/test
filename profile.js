// File: js/profile.js
// Profile Tab Functions
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
      renderEmployeeList();
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
      renderAdvanceApprovalList();
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
    const amount = a.amount || 0; // Xử lý trường hợp amount bị thiếu, gán 0 mặc định
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
  const schedules = globalScheduleData.filter(s => s.employeeId === currentEmployeeId).sort((a, b) => b.timestamp - a.timestamp);
  if (schedules.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }
  let isExpanded = false;
  const displaySchedules = isExpanded ? schedules : schedules.slice(0, 3);
  displaySchedules.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `${s.date}: ${statusText} - ${approvalText} ${approvalText === "Chờ duyệt" ? `<button onclick="cancelSchedule('${s.id}')">Hủy</button>` : ""}<hr>`;
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
          alert("Đã hủy yêu cầu và thông báo quản lý!");
          renderCalendar();
          renderScheduleStatusList();
          renderScheduleApprovalList();
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
    const statusClass = schedule && schedule.approvalStatus === "approved" ? schedule.status : "normal";
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
  modalContent.innerHTML = `
    <h3>Chọn hành động cho ngày ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    <button onclick="submitScheduleRequest('${date}', 'off')">Nghỉ</button>
    <button onclick="submitScheduleRequest('${date}', 'overtime')">Tăng ca</button>
    <button onclick="submitScheduleRequest('${date}', 'swap')">Đổi ca</button>
    <button onclick="closeModal('action-modal')">Hủy</button>`;
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
  const scheduleId = `${date}_${user.uid}`;
  const scheduleData = {
    id: scheduleId,
    employeeId: user.uid,
    employeeName: employee.name,
    date,
    status,
    approvalStatus: "pending",
    timestamp: Date.now()
  };
  db.ref("schedules/" + scheduleId).set(scheduleData)
    .then(() => {
      const statusText = status === "off" ? "Nghỉ" : status === "overtime" ? "Tăng ca" : "Đổi ca";
      db.ref("notifications/" + user.uid).push({
        message: `Yêu cầu ${statusText} ngày ${date} đã được gửi.`,
        timestamp: Date.now(),
        type: "confirmation",
        date,
        isRead: false
      }).then(() => {});
      db.ref("messages/manager").push({
        message: `Yêu cầu ${statusText} ngày ${date} từ ${employee.name}`,
        senderId: user.uid,
        senderName: employee.name,
        scheduleId,
        timestamp: Date.now()
      }).then(() => {});
      closeModal("action-modal");
      renderCalendar();
      renderScheduleStatusList();
    })
    .catch(err => alert("Lỗi khi gửi yêu cầu: " + err.message));
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) return;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) {
    container.innerHTML = "<p>Không tìm thấy thông tin nhân viên.</p>";
    return;
  }
  const approvedSchedules = globalScheduleData.filter(s => 
    s.employeeId === currentEmployeeId && s.approvalStatus === "approved"
  );
  const workdays = approvedSchedules.filter(s => s.status === "overtime").length;
  const offdays = approvedSchedules.filter(s => s.status === "off").length;
  const regularDays = employee.workdays - offdays;
  const baseSalary = regularDays * employee.dailyWage;
  const overtimePay = workdays * (employee.dailyWage * 1.5);
  const totalSalary = baseSalary + overtimePay + employee.allowance - employee.otherFee;
  container.innerHTML = `
    <h3>Tổng lương tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}</h3>
    <p>Lương cơ bản: ${baseSalary.toLocaleString('vi-VN')} VND</p>
    <p>Tiền tăng ca: ${overtimePay.toLocaleString('vi-VN')} VND</p>
    <p>Phụ cấp: ${employee.allowance.toLocaleString('vi-VN')} VND</p>
    <p>Phí khác: ${employee.otherFee.toLocaleString('vi-VN')} VND</p>
    <p><strong>Tổng lương: ${totalSalary.toLocaleString('vi-VN')} VND</strong></p>`;
}

function loadNotifications() {
  db.ref("notifications/" + currentEmployeeId).on("value", snapshot => {
    globalNotifications = snapshot.val() ? Object.values(snapshot.val()).map(n => ({ id: n.id || snapshot.key, ...n })) : [];
    renderNotifications();
    showToastNotifications();
  });
  db.ref("notifications/general").on("value", snapshot => {
    globalGeneralNotifications = snapshot.val() ? Object.values(snapshot.val()) : [];
    renderNotifications(true);
    showGeneralNotificationModal();
  });
}

function showGeneralNotificationModal() {
  const modal = document.getElementById("general-notification-modal");
  const modalContent = document.getElementById("general-notification-modal-list");
  if (!modal || !modalContent) return;
  const unreadGeneralNotifications = globalGeneralNotifications
    .filter(n => !n.readBy || !n.readBy[currentEmployeeId])
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  if (unreadGeneralNotifications.length === 0) {
    modal.style.display = "none";
    return;
  }
  modalContent.innerHTML = unreadGeneralNotifications
    .map(n => `<div>${n.message} - ${new Date(n.timestamp).toLocaleString('vi-VN')}</div>`).join("");
  modal.style.display = "block";
}

function markGeneralNotificationsAsRead() {
  const unreadGeneralNotifications = globalGeneralNotifications
    .filter(n => !n.readBy || !n.readBy[currentEmployeeId]);
  if (unreadGeneralNotifications.length === 0) {
    closeModal('general-notification-modal');
    return;
  }
  const updates = {};
  unreadGeneralNotifications.forEach(n => {
    updates["notifications/general/" + n.id + "/readBy/" + currentEmployeeId] = true;
  });
  db.ref().update(updates)
    .then(() => {
      globalGeneralNotifications = globalGeneralNotifications.map(n => 
        unreadGeneralNotifications.find(un => un.id === n.id) 
          ? { ...n, readBy: { ...n.readBy, [currentEmployeeId]: true } } 
          : n
      );
      closeModal('general-notification-modal');
      renderNotifications(true);
    })
    .catch(err => alert("Lỗi khi đánh dấu thông báo đã đọc: " + err.message));
}

function showToastNotifications() {
  const unreadNotifications = globalNotifications
    .filter(n => n.type === "confirmation" && !n.isRead)
    .sort((a, b) => b.timestamp - a.timestamp);
  unreadNotifications.forEach((n, index) => {
    setTimeout(() => {
      showToastNotification(`${n.message} - ${new Date(n.timestamp).toLocaleString('vi-VN')}`);
      db.ref("notifications/" + currentEmployeeId + "/" + n.id).update({ isRead: true }).then(() => {
        globalNotifications = globalNotifications.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif);
        renderNotifications();
      });
    }, index * 6000);
  });
}

function renderNotifications(isGeneral = false) {
  const container = document.getElementById(isGeneral ? "general-notification-modal-list" : "notification-list");
  if (!container) return;
  container.innerHTML = "";
  const notifications = isGeneral ? globalGeneralNotifications : globalNotifications;
  if (!notifications || notifications.length === 0) {
    container.innerHTML = `<p>Chưa có thông báo ${isGeneral ? "chung" : "cá nhân"}.</p>`;
    return;
  }
  notifications.forEach(notification => {
    const div = document.createElement("div");
    div.innerHTML = `<p>${notification.message} - ${new Date(notification.timestamp).toLocaleString()}</p>`;
    container.appendChild(div);
  });
}