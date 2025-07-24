
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


// File: js/employee-management.js

function addEmployee() {
  const employee = {
    name: document.getElementById("employee-name").value,
    email: document.getElementById("employee-email").value,
    address: document.getElementById("employee-address").value,
    phone: document.getElementById("employee-phone").value,
    note: document.getElementById("employee-note").value,
    dailyWage: parseFloat(document.getElementById("employee-daily-wage").value) || 0,
    allowance: parseFloat(document.getElementById("employee-allowance").value) || 0,
    otherFee: parseFloat(document.getElementById("employee-other-fee").value) || 0,
    role: "employee",
  };
  const password = document.getElementById("employee-password").value;

  // Kiểm tra email đã tồn tại
  auth.fetchSignInMethodsForEmail(employee.email)
    .then(methods => {
      if (methods.length > 0) {
        alert("Email đã được sử dụng. Vui lòng chọn email khác.");
        return;
      }
      // Tạo tài khoản mới
      createUserWithEmailAndPassword(auth, employee.email, password)
        .then(userCredential => {
          const user = userCredential.user;
          return db.ref("employees/" + user.uid).set(employee);
        })
        .then(() => {
          alert("Thêm nhân viên thành công!");
          closeModal("employee-modal");
        })
        .catch(err => {
          console.error("Error adding employee:", err);
          alert("Lỗi khi thêm nhân viên: " + err.message);
        });
    })
    .catch(err => {
      console.error("Error checking email:", err);
      alert("Lỗi khi kiểm tra email: " + err.message);
    });
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

// File: js/employee-management.js


// File: js/employee-management.js

function renderSchedule() {
  const container = document.getElementById("schedule-list");
  if (!container) {
    console.warn("Container 'schedule-list' not found in DOM.");
    return;
  }
  container.innerHTML = "";

  // Tính tuần hiện tại
  const today = new Date();
  let currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Bắt đầu từ Thứ 2
  currentWeekStart.setHours(0, 0, 0, 0);

  // Biến lưu tuần hiện tại
  let weekStart = new Date(currentWeekStart);

  // Hàm render bảng lịch
  function renderWeekTable(startDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    // Tính số tuần trong năm
    const yearStart = new Date(startDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((startDate - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);

    // Chuẩn hóa dữ liệu lịch từ globalScheduleData
    console.log("Schedule data for rendering:", globalScheduleData);
    const formattedScheduleData = [];
    globalScheduleData.forEach(schedule => {
      if (!schedule.id) {
        console.warn("Schedule missing id:", schedule);
        return;
      }
      // Kiểm tra nếu schedule có employeeId và date
      if (schedule.employeeId && schedule.date) {
        try {
          const dateObj = new Date(schedule.date);
          if (isNaN(dateObj.getTime())) {
            console.warn(`Invalid date in schedule ${schedule.id}:`, schedule.date);
            return;
          }
          formattedScheduleData.push({
            id: schedule.id,
            employeeId: schedule.employeeId,
            date: dateObj.toISOString().split('T')[0],
            status: schedule.status || 'normal', // Đồng bộ với tab Cá nhân
            approvalStatus: schedule.approvalStatus || 'approved'
          });
        } catch (err) {
          console.warn(`Error parsing date for schedule ${schedule.id}:`, schedule.date, err);
        }
      }
      // Xử lý autoOffDays nếu tồn tại
      if (schedule.autoOffDays && typeof schedule.autoOffDays === 'object') {
        console.log(`Processing autoOffDays for schedule ${schedule.id}:`, schedule.autoOffDays);
        Object.entries(schedule.autoOffDays).forEach(([offDayId, offDayData]) => {
          if (offDayData.date && offDayData.employeeId) {
            try {
              const dateObj = new Date(offDayData.date);
              if (isNaN(dateObj.getTime())) {
                console.warn(`Invalid date in autoOffDays ${offDayId}:`, offDayData.date);
                return;
              }
              formattedScheduleData.push({
                id: offDayId,
                employeeId: offDayData.employeeId,
                date: dateObj.toISOString().split('T')[0],
                status: offDayData.status || 'off', // Giả định autoOffDays là ngày nghỉ
                approvalStatus: offDayData.approvalStatus || schedule.approvalStatus || 'approved'
              });
            } catch (err) {
              console.warn(`Error parsing date in autoOffDays ${offDayId}:`, offDayData.date, err);
            }
          } else {
            console.warn(`Invalid autoOffDays data ${offDayId}:`, offDayData);
          }
        });
      }
    });

    if (formattedScheduleData.length === 0 && globalScheduleData.length > 0) {
      console.warn("No valid schedules after processing. Check data format in Firebase.");
    }

    container.innerHTML = `
      <div class="schedule-controls">
        <button class="primary-btn" onclick="renderWeek(${weekStart.getTime() - 7 * 24 * 60 * 60 * 1000})">Tuần trước</button>
        <span>Tuần ${weekNumber} - ${startDate.getMonth() + 1}/${startDate.getFullYear()}</span>
        <button class="primary-btn" onclick="renderWeek(${weekStart.getTime() + 7 * 24 * 60 * 60 * 1000})">Tuần sau</button>
      </div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Tên nhân viên</th>
            ${days.map(day => `
              <th>
                <div>${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                <div>${day.getDate()}</div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${globalEmployeeData.map(employee => `
            <tr>
              <td class="employee-name">${employee.name}</td>
              ${days.map(day => {
                const schedule = formattedScheduleData.find(s => 
                  s.employeeId === employee.id && 
                  s.date === day.toISOString().split('T')[0]
                );
                let displayText = ' ';
                let className = 'day-normal';
                if (schedule) {
                  if (schedule.approvalStatus === 'pending') {
                    displayText = 'Chờ duyệt';
                    className = 'day-pending';
                  } else if (schedule.approvalStatus === 'approved') {
                    if (schedule.status === 'off') {
                      displayText = 'Nghỉ';
                      className = 'day-off';
                    } else if (schedule.status === 'overtime') {
                      displayText = 'Tăng ca';
                      className = 'day-overtime';
                    } else if (schedule.status === 'swap') {
                      displayText = 'Đổi ca';
                      className = 'day-swap';
                    }
                  } else if (schedule.approvalStatus === 'denied') {
                    displayText = 'Nghỉ';
                    className = 'day-off';
                  }
                }
                return `
                  <td class="${className}">
                    ${displayText}
                    ${schedule && schedule.approvalStatus === 'pending' ? `
                      <div class="schedule-actions">
                        <button class="approve-btn" onclick="approveSchedule('${schedule.id}')">Phê duyệt</button>
                        <button class="reject-btn" onclick="rejectSchedule('${schedule.id}')">Từ chối</button>
                      </div>
                    ` : ''}
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Hàm render tuần theo thời gian
  window.renderWeek = function(timestamp) {
    weekStart = new Date(timestamp);
    renderWeekTable(weekStart);
  };

  // Render tuần hiện tại mặc định
  renderWeekTable(weekStart);
}

// Hàm hiển thị danh sách yêu cầu lịch làm việc (chờ duyệt)
function renderScheduleApprovalList() {
  const container = document.getElementById("schedule-approval-list");
  if (!container) {
    console.warn("Container 'schedule-approval-list' not found in DOM.");
    return;
  }

  const currentEmployee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!currentEmployee || currentEmployee.role !== "admin") {
    container.innerHTML = "<p>Chỉ admin mới có quyền xem yêu cầu lịch làm việc.</p>";
    return;
  }

  const pendingSchedules = globalScheduleData
    .filter(s => s.approvalStatus === "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pendingSchedules.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu lịch làm việc nào cần duyệt.</p>";
    return;
  }

  container.innerHTML = pendingSchedules.map(s => {
    const emp = globalEmployeeData.find(e => e.id === s.employeeId);
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    return `
      <div class="request-item">
        <p><b>${s.date}</b> - ${statusText}</p>
        <p>Nhân viên: ${emp?.name || "Không rõ"}</p>
        <div class="button-group">
          <button class="primary-btn" onclick="showScheduleApprovalModal('${s.id}')">Xử lý</button>
        </div>
        <hr>
      </div>
    `;
  }).join("");
}


// Hàm hiển thị modal phê duyệt/từ chối yêu cầu lịch
function showScheduleApprovalModal(scheduleId) {
  const modal = document.getElementById("schedule-approval-modal");
  const modalContent = document.getElementById("schedule-approval-modal-content");
  if (!modal || !modalContent) {
    console.error("Modal 'schedule-approval-modal' or 'schedule-approval-modal-content' not found in DOM.");
    alert("Lỗi: Không tìm thấy modal xử lý yêu cầu lịch làm việc!");
    return;
  }
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    console.warn(`Schedule with ID ${scheduleId} not found in globalScheduleData.`);
    alert("Không tìm thấy yêu cầu lịch làm việc!");
    return;
  }
  console.log("Rendering modal for schedule:", schedule); // Debug
  const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
  modalContent.innerHTML = `
    <span class="close" onclick="closeModal('schedule-approval-modal')">×</span>
    <h3>Duyệt yêu cầu: ${schedule.employeeName || "Không rõ"} - ${statusText} ngày ${new Date(schedule.date).toLocaleDateString('vi-VN')}</h3>
    <p>Ngày: ${schedule.date ? new Date(schedule.date).toLocaleDateString('vi-VN') : "Không xác định"}</p>
    <div class="input-group">
      <label for="approval-reason">Lý do (nếu từ chối):</label>
      <textarea id="approval-reason" placeholder="Nhập lý do từ chối (nếu có)" rows="4"></textarea>
    </div>
    <div class="button-group">
      <button class="primary-btn" onclick="approveSchedule('${scheduleId}')">Phê duyệt</button>
      <button class="secondary-btn" onclick="rejectSchedule('${scheduleId}')">Từ chối</button>
    </div>
  `;
  console.log("Modal content set:", modalContent.innerHTML); // Debug
  modal.style.display = "block";
}
// Hàm hiển thị lịch sử yêu cầu lịch làm việc
function renderScheduleHistory() {
  const container = document.getElementById("schedule-history");
  if (!container) return;

  const currentEmployee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!currentEmployee || currentEmployee.role !== "admin") {
    container.innerHTML = "<p>Chỉ admin mới có quyền xem lịch sử lịch làm việc.</p>";
    return;
  }

  const list = globalScheduleData
    .filter(s => s.approvalStatus !== "pending")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (list.length === 0) {
    container.innerHTML = "<p>Chưa có lịch sử yêu cầu lịch làm việc.</p>";
    return;
  }

  container.innerHTML = "<h4>Lịch sử yêu cầu lịch làm việc</h4>" +
    list.map(item => {
      const emp = globalEmployeeData.find(e => e.id === item.employeeId);
      const statusText = item.status === "off" ? "Nghỉ" : item.status === "overtime" ? "Tăng ca" : "Đổi ca";
      return `
        <div class="request-item">
          <p><b>${item.date}</b> - ${statusText}</p>
          <p>Nhân viên: ${emp?.name || "Không rõ"}</p>
          <p>Trạng thái: ${getApprovalStatusText(item.approvalStatus)}</p>
          ${item.reason ? `<p>Lý do từ chối: ${item.reason}</p>` : ""}
          <hr>
        </div>
      `;
    }).join("");
}
function getApprovalStatusText(status) {
  if (status === "approved") return "✅ Đã duyệt";
  if (status === "rejected") return "❌ Từ chối";
  return "⏳ Đang chờ";
}

// Hàm phê duyệt lịch (đã cập nhật để gửi thông báo)
function approveSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    alert("Không tìm thấy lịch!");
    return;
  }
  db.ref(`schedules/${scheduleId}`).update({
    approvalStatus: 'approved',
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      globalScheduleData = globalScheduleData.map(s => 
        s.id === scheduleId ? { ...s, approvalStatus: 'approved' } : s
      );
      const statusText = schedule.status === 'off' ? 'Nghỉ' : schedule. status === 'overtime' ? 'Tăng ca' : 'Đổi ca';
      db.ref(`notifications/${schedule.employeeId}`).push({
        message: `Yêu cầu ${statusText} ngày ${schedule.date} đã được duyệt.`,
        timestamp: Date.now(),
        type: 'confirmation',
        isRead: false
      });
      renderSchedule();
      renderScheduleApprovalList();
      renderScheduleHistory();
      renderAllSchedule();
      renderEmployeeDetails();
      renderProfile();
      renderCalendar();
      renderScheduleStatusList();
      renderOffAndOvertime(); // Thêm
      renderSalarySummary(); // Thêm
    })
    .catch(err => {
      console.error("Error approving schedule:", err);
      alert("Lỗi khi phê duyệt lịch: " + err.message);
    });
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

// File: js/employee-management.js

function renderEmployeeChat(employeeId) {
  const container = document.getElementById("employee-chat");
  if (!container) {
    console.warn("Container 'employee-chat' not found in DOM.");
    return;
  }
  container.innerHTML = `
    <div class="employee-select">
      <h4>Chọn nhân viên để chat</h4>
      <select id="chat-employee-select" onchange="loadEmployeeChat(this.value)">
        <option value="">Chọn nhân viên</option>
        ${globalEmployeeData.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('')}
      </select>
    </div>
    <div id="chat-messages"></div>
  `;
  if (employeeId) loadEmployeeChat(employeeId);
}

function loadEmployeeChat(employeeId) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) {
    console.warn("Container 'chat-messages' not found in DOM.");
    return;
  }
  messagesContainer.innerHTML = "";
  const messages = globalMessages[employeeId] || [];
  if (messages.length === 0) {
    messagesContainer.innerHTML = "<p>Chưa có tin nhắn.</p>";
    return;
  }
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = `chat-message ${msg.senderId === currentEmployeeId ? 'sent' : 'received'}`;
    div.innerHTML = `
      <p>${msg.message}</p>
      <small>${new Date(msg.timestamp).toLocaleString('vi-VN')}</small>
    `;
    messagesContainer.appendChild(div);
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// File: js/employee-management.js

// Hiển thị chi tiết nhân viên
function showEmployeeDetails(employeeId) {
  const container = document.getElementById("employee-details");
  if (!container) {
    console.warn("Container 'employee-details' not found in DOM.");
    return;
  }
  const employee = globalEmployeeData.find(emp => emp.id === employeeId);
  if (!employee) {
    container.innerHTML = "<p>Không tìm thấy nhân viên.</p>";
    console.warn(`Employee with ID ${employeeId} not found in globalEmployeeData.`);
    return;
  }
  container.innerHTML = `
    <h4>Chi tiết nhân viên</h4>
    <p><strong>Họ tên:</strong> ${employee.name}</p>
    <p><strong>Email:</strong> ${employee.email}</p>
    <p><strong>Địa chỉ:</strong> ${employee.address || 'Chưa có'}</p>
    <p><strong>Số điện thoại:</strong> ${employee.phone || 'Chưa có'}</p>
    <p><strong>Ghi chú:</strong> ${employee.note || 'Chưa có'}</p>
    <p><strong>Lương ngày:</strong> ${employee.dailyWage || 0} VNĐ</p>
    <p><strong>Phụ cấp:</strong> ${employee.allowance || 0} VNĐ</p>
    <p><strong>Phí khác:</strong> ${employee.otherFee || 0} VNĐ</p>
  `;
}

// Hiển thị form sửa nhân viên trong modal
function showEditEmployeeForm(employeeId) {
  const modal = document.getElementById("employee-modal");
  const title = document.getElementById("employee-modal-title");
  const submitBtn = document.getElementById("employee-modal-submit");
  const employee = globalEmployeeData.find(emp => emp.id === employeeId);
  if (!employee) {
    console.warn(`Employee with ID ${employeeId} not found in globalEmployeeData.`);
    return;
  }
  title.textContent = "Sửa nhân viên";
  document.getElementById("employee-name").value = employee.name || "";
  document.getElementById("employee-email").value = employee.email || "";
  document.getElementById("employee-password").style.display = "none"; // Ẩn mật khẩu khi sửa
  document.getElementById("employee-password-label").style.display = "none";
  document.getElementById("employee-address").value = employee.address || "";
  document.getElementById("employee-phone").value = employee.phone || "";
  document.getElementById("employee-note").value = employee.note || "";
  document.getElementById("employee-daily-wage").value = employee.dailyWage || 0;
  document.getElementById("employee-allowance").value = employee.allowance || 0;
  document.getElementById("employee-other-fee").value = employee.otherFee || 0;
  submitBtn.onclick = () => updateEmployee(employeeId);
  modal.style.display = "block";
}

// Cập nhật nhân viên
function updateEmployee(employeeId) {
  const employee = {
    name: document.getElementById("employee-name").value,
    email: document.getElementById("employee-email").value,
    address: document.getElementById("employee-address").value,
    phone: document.getElementById("employee-phone").value,
    note: document.getElementById("employee-note").value,
    dailyWage: parseFloat(document.getElementById("employee-daily-wage").value) || 0,
    allowance: parseFloat(document.getElementById("employee-allowance").value) || 0,
    otherFee: parseFloat(document.getElementById("employee-other-fee").value) || 0,
  };
  db.ref(`employees/${employeeId}`).update(employee)
    .then(() => {
      alert("Cập nhật nhân viên thành công!");
      closeModal("employee-modal");
    })
    .catch(err => {
      console.error("Error updating employee:", err);
      alert("Lỗi khi cập nhật nhân viên: " + err.message);
    });
}

// File: js/employee-management.js

// ... (giữ nguyên các hàm khác: renderEmployeeList, renderEmployeeDetails, showEmployeeModal, addEmployee, editEmployee, deleteEmployee, ...)

// Sửa hàm renderSchedule để đồng bộ với profile.js
function renderSchedule() {
  const container = document.getElementById("schedule-list");
  if (!container) {
    console.warn("Container 'schedule-list' not found in DOM.");
    return;
  }
  container.innerHTML = "";

  // Tính tuần hiện tại
  const today = new Date();
  let currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Bắt đầu từ Thứ 2
  currentWeekStart.setHours(0, 0, 0, 0);

  // Biến lưu tuần hiện tại
  let weekStart = new Date(currentWeekStart);

  // Hàm render bảng lịch
  function renderWeekTable(startDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    // Tính số tuần trong năm
    const yearStart = new Date(startDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((startDate - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);

    // Chuẩn hóa dữ liệu lịch từ globalScheduleData
    console.log("Schedule data for rendering:", globalScheduleData);
    const formattedScheduleData = [];
    globalScheduleData.forEach(schedule => {
      if (!schedule.id || !schedule.employeeId || !schedule.date) {
        console.warn("Invalid schedule data:", schedule);
        return;
      }
      try {
        const dateObj = new Date(schedule.date);
        if (isNaN(dateObj.getTime())) {
          console.warn(`Invalid date in schedule ${schedule.id}:`, schedule.date);
          return;
        }
        formattedScheduleData.push({
          id: schedule.id,
          employeeId: schedule.employeeId,
          date: dateObj.toISOString().split('T')[0],
          status: schedule.status || 'normal',
          approvalStatus: schedule.approvalStatus || 'approved'
        });
      } catch (err) {
        console.warn(`Error parsing date for schedule ${schedule.id}:`, schedule.date, err);
      }
      // Xử lý autoOffDays nếu tồn tại
      if (schedule.autoOffDays && typeof schedule.autoOffDays === 'object') {
        console.log(`Processing autoOffDays for schedule ${schedule.id}:`, schedule.autoOffDays);
        Object.entries(schedule.autoOffDays).forEach(([offDayId, offDayData]) => {
          if (offDayData.date && offDayData.employeeId) {
            try {
              const dateObj = new Date(offDayData.date);
              if (isNaN(dateObj.getTime())) {
                console.warn(`Invalid date in autoOffDays ${offDayId}:`, offDayData.date);
                return;
              }
              formattedScheduleData.push({
                id: offDayId,
                employeeId: offDayData.employeeId,
                date: dateObj.toISOString().split('T')[0],
                status: offDayData.status || 'off',
                approvalStatus: offDayData.approvalStatus || schedule.approvalStatus || 'approved'
              });
            } catch (err) {
              console.warn(`Error parsing date in autoOffDays ${offDayId}:`, offDayData.date, err);
            }
          } else {
            console.warn(`Invalid autoOffDays data ${offDayId}:`, offDayData);
          }
        });
      }
    });

    if (formattedScheduleData.length === 0 && globalScheduleData.length > 0) {
      console.warn("No valid schedules after processing. Check data format in Firebase.");
      container.innerHTML = "<p>Không có dữ liệu lịch hợp lệ. Vui lòng kiểm tra dữ liệu Firebase.</p>";
      return;
    }

    container.innerHTML = `
      <div class="schedule-controls">
        <button class="primary-btn" onclick="renderWeek(${weekStart.getTime() - 7 * 24 * 60 * 60 * 1000})">Tuần trước</button>
        <span>Tuần ${weekNumber} - ${startDate.getMonth() + 1}/${startDate.getFullYear()}</span>
        <button class="primary-btn" onclick="renderWeek(${weekStart.getTime() + 7 * 24 * 60 * 60 * 1000})">Tuần sau</button>
      </div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Tên nhân viên</th>
            ${days.map(day => `
              <th>
                <div>${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                <div>${day.getDate()}</div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${globalEmployeeData.map(employee => `
            <tr>
              <td class="employee-name">${employee.name}</td>
              ${days.map(day => {
                const schedule = formattedScheduleData.find(s => 
                  s.employeeId === employee.id && 
                  s.date === day.toISOString().split('T')[0]
                );
                let displayText = 'Làm việc';
                let className = 'day-normal';
                if (schedule) {
                  if (schedule.approvalStatus === 'pending') {
                    displayText = 'Chờ duyệt';
                    className = 'day-pending';
                  } else if (schedule.approvalStatus === 'approved') {
                    if (schedule.status === 'off') {
                      displayText = 'Nghỉ';
                      className = 'day-off';
                    } else if (schedule.status === 'overtime') {
                      displayText = 'Tăng ca';
                      className = 'day-overtime';
                    } else if (schedule.status === 'swap') {
                      displayText = 'Đổi ca';
                      className = 'day-swap';
                    }
                  } else if (schedule.approvalStatus === 'denied') {
                    displayText = 'Làm việc';
                    className = 'day-normal';
                  }
                }
                return `
                  <td class="${className}">
                    ${displayText}
                    ${schedule && schedule.approvalStatus === 'pending' ? `
                      <div class="schedule-actions">
                        <button class="approve-btn" onclick="approveSchedule('${schedule.id}')">Phê duyệt</button>
                        <button class="reject-btn" onclick="rejectSchedule('${schedule.id}')">Từ chối</button>
                      </div>
                    ` : ''}
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Hàm render tuần theo thời gian
  window.renderWeek = function(timestamp) {
    weekStart = new Date(timestamp);
    renderWeekTable(weekStart);
  };

  // Render tuần hiện tại mặc định
  renderWeekTable(weekStart);
}



// Sửa hàm approveSchedule để gọi đầy đủ các hàm render
function approveSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    alert("Không tìm thấy lịch!");
    return;
  }
  db.ref(`schedules/${scheduleId}`).update({
    approvalStatus: 'approved',
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      globalScheduleData = globalScheduleData.map(s => 
        s.id === scheduleId ? { ...s, approvalStatus: 'approved' } : s
      );
      const statusText = schedule.status === 'off' ? 'Nghỉ' : schedule.status === 'overtime' ? 'Tăng ca' : 'Đổi ca';
      db.ref(`notifications/${schedule.employeeId}`).push({
        message: `Yêu cầu ${statusText} ngày ${schedule.date} đã được duyệt.`,
        timestamp: Date.now(),
        type: 'confirmation',
        isRead: false
      });
      renderSchedule();
      renderScheduleApprovalList();
      renderScheduleHistory();
      renderAllSchedule();
      renderEmployeeDetails();
      renderProfile();
      renderCalendar(); // Thêm
      renderScheduleStatusList(); // Thêm
    })
    .catch(err => {
      console.error("Error approving schedule:", err);
      alert("Lỗi khi phê duyệt lịch: " + err.message);
    });
}

function rejectSchedule(scheduleId) {
  const schedule = globalScheduleData.find(s => s.id === scheduleId);
  if (!schedule) {
    console.warn(`Schedule with ID ${scheduleId} not found.`);
    alert("Không tìm thấy lịch!");
    return;
  }
  const modal = document.getElementById("schedule-approval-modal");
  const reasonInput = document.getElementById("approval-reason");
  if (!modal || modal.style.display !== "block") {
    console.error("Modal 'schedule-approval-modal' is not visible or not found.");
    alert("Lỗi: Modal xử lý yêu cầu không hiển thị!");
    return;
  }
  if (!reasonInput) {
    console.error("Textarea 'approval-reason' not found in DOM. Modal content:", document.getElementById("schedule-approval-modal-content").innerHTML);
    alert("Lỗi: Không tìm thấy trường nhập lý do từ chối! Vui lòng thử lại.");
    return;
  }
  const reason = reasonInput.value.trim();
  if (!reason) {
    alert("Vui lòng nhập lý do từ chối!");
    return;
  }
  db.ref(`schedules/${scheduleId}`).update({
    approvalStatus: 'denied',
    reason: reason || null,
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      globalScheduleData = globalScheduleData.map(s => 
        s.id === scheduleId ? { ...s, approvalStatus: 'denied', reason: reason || null } : s
      );
      const statusText = schedule.status === 'off' ? 'Nghỉ' : schedule.status === 'overtime' ? 'Tăng ca' : 'Đổi ca';
      db.ref(`notifications/${schedule.employeeId}`).push({
        message: `Yêu cầu ${statusText} ngày ${schedule.date} bị từ chối. Lý do: ${reason}`,
        timestamp: Date.now(),
        type: 'confirmation',
        isRead: false
      });
      closeModal("schedule-approval-modal");
      renderSchedule();
      renderScheduleApprovalList();
      renderScheduleHistory();
      renderAllSchedule();
      renderEmployeeDetails();
      renderProfile();
      renderCalendar();
      renderScheduleStatusList();
      renderOffAndOvertime();
      renderSalarySummary();
      alert("Yêu cầu đã được từ chối!");
    })
    .catch(err => {
      console.error("Error rejecting schedule:", err);
      alert("Lỗi khi từ chối lịch: " + err.message);
    });
}