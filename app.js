/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/

// Firebase References
const database = firebase.database(); // Thêm dòng này
const inventoryRef = database.ref("inventory");
const reportsRef = database.ref("reports");
const employeesRef = database.ref("employees");
const advancesRef = database.ref("advances");
const messagesRef = database.ref("messages");
const schedulesRef = database.ref("schedules");
const swapRequestsRef = database.ref("swapRequests");
const notificationsRef = database.ref("notifications");


// Local Variables
let inventoryData = [];
let reportData = [];
let employeeData = [];
let advanceRequests = [];
let messages = { group: [], manager: [] };
let productClickCounts = {};
let expenseNotes = [];
let currentEmployeeId = null;
let scheduleData = [];
let payrollData = JSON.parse(localStorage.getItem("payrollData")) || [];
let currentMonth = new Date().getMonth() + 1; // Tháng hiện tại
let currentYear = new Date().getFullYear(); // Năm hiện tại// Hàm parseEntry (từ bạn cung cấp)
// Thêm biến toàn cục cho trạng thái mở rộng
let isExpandedAdvance = false;
let isExpandedSchedule = false;
// Biến toàn cục
let notifications = [];
let generalNotifications = [];
let isExpandedNotifications = false;

// Tải dữ liệu thông báo
function loadNotifications() {
  if (!currentEmployeeId) {
    console.error("No current employee ID for loading notifications");
    return;
  }

  // Tải thông báo cá nhân
  notificationsRef.child(currentEmployeeId).on("value", snapshot => {
    notifications = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const notification = { id: child.key, employeeId: currentEmployeeId, ...child.val() };
        notifications.push(notification);
      });
    }
    console.log("Updated personal notifications:", notifications);
    renderNotifications();
    showToastNotifications(); // Hiển thị toast cho thông báo xác nhận
  }, err => {
    console.error("Error fetching personal notifications:", err);
  });

  // Tải thông báo chung
  notificationsRef.child("general").on("value", snapshot => {
    generalNotifications = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const notification = { id: child.key, ...child.val() };
        generalNotifications.push(notification);
      });
    }
    console.log("Updated general notifications:", generalNotifications);
    renderNotifications();
    showGeneralNotificationModal(); // Hiển thị modal cho thông báo chung
  }, err => {
    console.error("Error fetching general notifications:", err);
  });
}

// Hiển thị modal thông báo chung
function showGeneralNotificationModal() {
  const modal = document.getElementById("general-notification-modal");
  const modalContent = document.getElementById("general-notification-modal-list");
  if (!modal || !modalContent) {
    console.error("General notification modal or content not found!");
    return;
  }

  const unreadGeneralNotifications = generalNotifications
    .filter(n => !n.readBy || !n.readBy[currentEmployeeId])
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5); // Hiển thị tối đa 5 thông báo chưa đọc

  if (unreadGeneralNotifications.length === 0) {
    console.log("No unread general notifications to display in modal");
    modal.style.display = "none";
    return;
  }

  modalContent.innerHTML = unreadGeneralNotifications
    .map(n => `<div>${n.message} - ${new Date(n.timestamp).toLocaleString('vi-VN')}</div>`)
    .join("");
  
  modal.style.display = "block";
  console.log("Showing general notification modal with", unreadGeneralNotifications.length, "unread notifications");
}

// Đánh dấu thông báo chung là đã đọc
function markGeneralNotificationsAsRead() {
  const unreadGeneralNotifications = generalNotifications
    .filter(n => !n.readBy || !n.readBy[currentEmployeeId]);
  if (unreadGeneralNotifications.length === 0) {
    console.log("No unread general notifications to mark as read");
    closeModal('general-notification-modal');
    return;
  }

  const updates = {};
  unreadGeneralNotifications.forEach(n => {
    updates[`general/${n.id}/readBy/${currentEmployeeId}`] = true;
  });

  notificationsRef.update(updates).then(() => {
    console.log("Marked general notifications as read for employee:", currentEmployeeId);
    generalNotifications = generalNotifications.map(n => 
      unreadGeneralNotifications.find(un => un.id === n.id) 
        ? { ...n, readBy: { ...n.readBy, [currentEmployeeId]: true } } 
        : n
    );
    closeModal('general-notification-modal');
    renderNotifications();
  }).catch(err => {
    console.error("Error marking general notifications as read:", err);
    alert("Lỗi khi đánh dấu thông báo đã đọc: " + err.message);
  });
}

// Hiển thị toast cho thông báo xác nhận
function showToastNotifications() {
  const unreadNotifications = notifications
    .filter(n => n.employeeId === currentEmployeeId && !n.isRead && n.type === "confirmation")
    .sort((a, b) => b.timestamp - a.timestamp);
  
  unreadNotifications.forEach((n, index) => {
    setTimeout(() => {
      showToastNotification(`${n.message} - ${new Date(n.timestamp).toLocaleString('vi-VN')}`);
      notificationsRef.child(currentEmployeeId).child(n.id).update({ isRead: true }).then(() => {
        notifications = notifications.map(notif => 
          notif.id === n.id ? { ...notif, isRead: true } : notif
        );
        renderNotifications();
      });
    }, index * 6000); // Hiển thị từng thông báo cách nhau 6 giây
  });
}
function renderNotifications(notifications, isGeneral = false) {
  const container = document.getElementById(isGeneral ? "general-notification-modal-list" : "notification-list");
  if (!container) {
    console.error(`Notification list element not found for ${isGeneral ? "general" : "personal"} notifications!`);
    return;
  }
  container.innerHTML = "";
  
  if (!notifications || notifications.length === 0) {
    container.innerHTML = `<p>Chưa có thông báo ${isGeneral ? "chung" : "cá nhân"}.</p>`;
    return;
  }

  notifications.forEach(notification => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p>${notification.message} - ${new Date(notification.timestamp).toLocaleString()}</p>
      ${isGeneral ? `<button onclick="markGeneralNotificationAsRead('${notification.id}')">Đã đọc</button>` : ""}
    `;
    container.appendChild(div);
  });
}

// Hàm hiển thị toast
function showToastNotification(message) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.error("Toast container not found!");
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 500);
  }, 5000); // Hiển thị 5 giây
}
function parseEntry(text) {
  const match = text.match(/([\d.,]+)\s*(k|nghìn|tr|triệu)?/i);
  if (!match) return { money: 0, note: text.trim() };

  let num = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2]?.toLowerCase() || '';

  if (unit.includes('tr')) num *= 1_000_000;
  else if (unit.includes('k') || unit.includes('nghìn')) num *= 1_000;

  return {
    money: Math.round(num),
    note: text.replace(match[0], '').trim()
  };
}
function openCalendar() {
  const now = new Date();
  currentMonth = now.getMonth();
  currentYear = now.getFullYear();
  generateCalendar(currentMonth, currentYear);
}
function sendGeneralNotification(message) {
  if (!currentEmployeeId) {
    console.error("No current employee ID");
    alert("Vui lòng đăng nhập để gửi thông báo!");
    return;
  }

  const employee = employeeData.find(emp => emp.id === currentEmployeeId);
  if (!employee || employee.role !== "manager") {
    console.error("User is not a manager");
    alert("Chỉ quản lý mới có quyền gửi thông báo chung!");
    return;
  }

  notificationsRef.child("general").push({
    message,
    timestamp: Date.now(),
    type: "general",
    readBy: {}
  }).then(() => {
    console.log("Sent general notification:", message);
    alert("Gửi thông báo chung thành công!");
  }).catch(err => {
    console.error("Error sending general notification:", err);
    alert("Lỗi khi gửi thông báo: " + err.message);
  });
}
// Sửa hàm loadEmployeeInfo để đảm bảo đồng bộ thông tin sau F5
function loadEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    console.error("No user logged in!");
    return;
  }

  const ref = firebase.database().ref(`employees/${user.uid}`);
  ref.once("value").then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      const nameInput = document.getElementById("personal-employee-name");
      const addressInput = document.getElementById("employee-address");
      const phoneInput = document.getElementById("employee-phone");
      const noteInput = document.getElementById("employee-note");
      if (nameInput) nameInput.value = data.name || "";
      if (addressInput) addressInput.value = data.address || "";
      if (phoneInput) phoneInput.value = data.phone || "";
      if (noteInput) noteInput.value = data.note || "";
      console.log("Loaded employee info:", data);
    }
    // Gọi renderCalendar để hiển thị lịch ngay khi tải
    renderCalendar();
  }).catch((err) => {
    console.error("Lỗi khi load thông tin nhân viên:", err);
  });
}

auth.onAuthStateChanged(user => {
  if (user) {
    currentEmployeeId = user.uid;

    const employeeRef = employeesRef.child(user.uid);
    employeeRef.once("value").then(snapshot => {
      if (!snapshot.exists()) {
        const newEmployee = {
          name: user.displayName || user.email.split('@')[0] || 'Nhân viên',
          email: user.email,
          active: true,
          role: 'employee',
          dailyWage: 0,
          allowance: 0,
          otherFee: 0,
          workdays: 26,
          offdays: 0,
          address: "",
          phone: "",
          note: "",
          createdAt: new Date().toISOString()
        };
        employeeRef.set(newEmployee).then(() => {
          console.log("Đã thêm nhân viên mới vào Firebase:", user.uid);
          employeeData.push({ id: user.uid, ...newEmployee });
          renderEmployeeList();
          loadEmployeeInfo();
          loadFirebaseData().then(() => {
            console.log("Firebase data loaded, rendering calendar and schedule status list...");
            renderCalendar();
            renderScheduleStatusList();
            loadNotifications(); // Tải thông báo (gọi modal và toast)
          }).catch(err => {
            console.error("Error loading Firebase data:", err);
          });
        }).catch(err => {
          console.error("Lỗi khi thêm nhân viên:", err);
        });
      } else {
        const employee = snapshot.val();
        if (!employeeData.find(emp => emp.id === user.uid)) {
          employeeData.push({ id: user.uid, ...employee });
        }
        loadEmployeeInfo();
        loadFirebaseData().then(() => {
          console.log("Firebase data loaded, rendering calendar and schedule status list...");
          renderCalendar();
          renderScheduleStatusList();
          loadNotifications(); // Tải thông báo (gọi modal và toast)
        }).catch(err => {
          console.error("Error loading Firebase data:", err);
        });
        reportsRef.once("value").then(snapshot => {
          snapshot.forEach(child => {
            const report = child.val();
            if (report.employeeId === user.uid && report.employeeName !== employee.name) {
              reportsRef.child(child.key).update({ employeeName: employee.name });
            }
          });
        });
      }
    });

    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('revenue-expense');
  } else {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});

function submitScheduleRequest(date, status) {
  // Kiểm tra tham số status
  if (!["off", "overtime", "swap"].includes(status)) {
    console.error("Invalid status:", status);
    alert("Lỗi: Trạng thái không hợp lệ. Vui lòng chọn Nghỉ, Tăng ca, hoặc Đổi ca.");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error("No user logged in!");
    alert("Vui lòng đăng nhập để gửi yêu cầu.");
    return;
  }

  const employee = employeeData.find(emp => emp.id === user.uid);
  if (!employee) {
    console.error("Employee data not found for user:", user.uid);
    alert("Không tìm thấy thông tin nhân viên.");
    return;
  }

  const scheduleId = `${date}_${user.uid}`;
  const scheduleData = {
    id: scheduleId,
    employeeId: user.uid,
    employeeName: employee.name,
    date: date,
    status: status,
    approvalStatus: "pending",
    timestamp: Date.now()
  };

  schedulesRef.child(scheduleId).set(scheduleData).then(() => {
    console.log(`Submitted schedule request for ${date}:`, scheduleData);
    
    // Gửi thông báo cá nhân
    const statusText = status === "off" ? "Nghỉ" : status === "overtime" ? "Tăng ca" : "Đổi ca";
    notificationsRef.child(user.uid).push({
      message: `Yêu cầu ${statusText} ngày ${date} đã được gửi.`,
      timestamp: Date.now(),
      type: "confirmation",
      date: date,
      isRead: false
    }).then(() => {
      console.log("Sent confirmation notification to employee:", user.uid);
    }).catch(err => {
      console.error("Error sending notification:", err);
    });

    // Gửi thông báo cho quản lý
    messagesRef.child("manager").push({
      message: `Yêu cầu ${statusText} ngày ${date} từ ${employee.name}`,
      senderId: user.uid,
      senderName: employee.name,
      scheduleId: scheduleId,
      timestamp: Date.now()
    }).then(() => {
      console.log("Sent manager notification for schedule request:", scheduleId);
    }).catch(err => {
      console.error("Error sending manager notification:", err);
    });

    closeModal("action-modal");
    renderCalendar();
    renderScheduleStatusList();
  }).catch(err => {
    console.error("Error submitting schedule request:", err);
    alert("Lỗi khi gửi yêu cầu: " + err.message);
  });
}

// Sửa hàm renderCalendar để hiển thị đúng tháng 7
function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) {
    console.error("Calendar element not found!");
    return;
  }

  const today = new Date();
  const currentMonth = today.getMonth() + 1; // Tháng 7 (1-based)
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay() || 7; // Bắt đầu từ thứ 2

  let calendarHTML = `
    <div class="calendar-header">
      <button onclick="changeMonth(-1)">Trước</button>
      <h3>Tháng ${currentMonth}/${currentYear}</h3>
      <button onclick="changeMonth(1)">Sau</button>
    </div>
    <div class="calendar">
      <div class="calendar-header">CN</div>
      <div class="calendar-header">T2</div>
      <div class="calendar-header">T3</div>
      <div class="calendar-header">T4</div>
      <div class="calendar-header">T5</div>
      <div class="calendar-header">T6</div>
      <div class="calendar-header">T7</div>
  `;

  for (let i = 1; i < firstDay; i++) {
    calendarHTML += `<div class="day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedule = scheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
    const statusClass = schedule && schedule.approvalStatus === "approved" ? schedule.status : "normal";
    calendarHTML += `
      <div class="day ${statusClass}" data-date="${date}" onclick="showActionModal('${date}')">
        ${day}
      </div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
  console.log("Rendered calendar for:", currentMonth, currentYear);
}

// Sửa hàm changeMonth để đồng bộ tháng
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

// Sửa hàm renderAdvanceHistory để hiển thị 3 mục và nút Xem thêm
function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) {
    console.error("Advance history element not found!");
    return;
  }
  container.innerHTML = "";
  const myAdvances = advanceRequests
    .filter(a => a.employeeId === currentEmployeeId)
    .sort((a, b) => b.timestamp - a.timestamp); // Sắp xếp theo thời gian giảm dần
  console.log("Rendering advance history, total items:", myAdvances.length);

  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    return;
  }

  const displayAdvances = isExpandedAdvance ? myAdvances : myAdvances.slice(0, 3);
  displayAdvances.forEach(a => {
    const approvalText = a.status === "approved" ? "Đã duyệt" : a.status === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `Tạm ứng: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason} - Ngày: ${a.date} - ${approvalText}<hr>`;
    container.appendChild(div);
  });

  if (myAdvances.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedAdvance ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => {
      isExpandedAdvance = !isExpandedAdvance;
      renderAdvanceHistory();
    };
    container.appendChild(expandBtn);
  }
}

// Sửa hàm renderScheduleStatusList để hiển thị 3 mục và nút Xem thêm, thêm nút Hủy
function renderScheduleStatusList() {
  const container = document.getElementById("schedule-status-list");
  if (!container) {
    console.error("Schedule status list element not found!");
    return;
  }
  container.innerHTML = "";
  const schedules = scheduleData
    .filter(s => s.employeeId === currentEmployeeId)
    .sort((a, b) => b.timestamp - a.timestamp); // Sắp xếp theo thời gian giảm dần
  console.log("Rendering schedule status list, total items:", schedules.length);

  if (schedules.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }

  const displaySchedules = isExpandedSchedule ? schedules : schedules.slice(0, 3);
  displaySchedules.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `
      ${s.date}: ${statusText} - ${approvalText}
      ${approvalText === "Chờ duyệt" ? `<button onclick="cancelSchedule('${s.id}')">Hủy</button>` : ""}
      <hr>`;
    container.appendChild(div);
  });

  if (schedules.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedSchedule ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => {
      isExpandedSchedule = !isExpandedSchedule;
      renderScheduleStatusList();
    };
    container.appendChild(expandBtn);
  }
}

// Thêm hàm cancelSchedule để hủy yêu cầu và gửi thông báo cho quản lý
function cancelSchedule(key) {
  const schedule = scheduleData.find(s => s.id === key);
  if (!schedule) {
    console.error("Schedule not found for key:", key);
    alert("Yêu cầu không tồn tại!");
    return;
  }
  if (schedule.approvalStatus !== "pending") {
    alert("Chỉ có thể hủy yêu cầu đang chờ duyệt!");
    return;
  }

  schedulesRef.child(key).remove().then(() => {
    scheduleData = scheduleData.filter(s => s.id !== key);
    payrollData = payrollData.filter(p => p.date !== schedule.date || p.employeeId !== currentEmployeeId);
    localStorage.setItem("payrollData", JSON.stringify(payrollData));

    // Gửi thông báo cho quản lý
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]);
    const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const message = `${employeeName} đã hủy yêu cầu ${statusText} ngày ${schedule.date}`;
    messagesRef.child("manager").push({
      text: message,
      time: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName
    }).then(() => {
      console.log("Sent cancellation notification to manager:", message);
      alert("Đã hủy yêu cầu và thông báo quản lý!");
      renderCalendar();
      renderScheduleStatusList();
      renderScheduleApprovalList();
      renderSalarySummary();
    }).catch(err => {
      console.error("Lỗi gửi thông báo hủy:", err);
      alert("Lỗi khi gửi thông báo hủy: " + err.message);
    });
  }).catch(err => {
    console.error("Lỗi hủy yêu cầu:", err);
    alert("Lỗi khi hủy yêu cầu: " + err.message);
  });
}

// Sửa hàm renderScheduleApprovalList để hiển thị tất cả trạng thái
function renderScheduleApprovalList() {
  const container = document.getElementById("work-requests");
  if (!container) {
    console.error("Work requests element not found!");
    return;
  }
  container.innerHTML = "";
  console.log("Rendering schedule approval list, total items:", scheduleData.length);

  if (scheduleData.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }

  scheduleData.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `
      <strong>${s.employeeName}</strong>: ${statusText} - Ngày: ${s.date} - ${approvalText}
      ${approvalText === "Chờ duyệt" ? `
        <button onclick="approveSchedule('${s.id}')">Duyệt</button>
        <button onclick="denySchedule('${s.id}')">Từ chối</button>
      ` : ""}
      <hr>`;
    container.appendChild(div);
  });
}

// Sửa hàm updateEmployeeInfo để đảm bảo giữ giá trị input
function updateEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để cập nhật thông tin!");
    return;
  }

  const nameInputEl = document.getElementById("personal-employee-name");
  const addressInputEl = document.getElementById("employee-address");
  const phoneInputEl = document.getElementById("employee-phone");
  const noteInputEl = document.getElementById("employee-note");

  if (!nameInputEl || !addressInputEl || !phoneInputEl || !noteInputEl) {
    console.error("Không tìm thấy các trường nhập liệu trong tab profile!");
    alert("Lỗi: Không tìm thấy các trường nhập liệu!");
    return;
  }

  const nameInput = nameInputEl.value.trim();
  const addressInput = addressInputEl.value.trim();
  const phoneInput = phoneInputEl.value.trim();
  const noteInput = noteInputEl.value.trim();

  if (!nameInput) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  const employeeRef = employeesRef.child(user.uid);
  employeeRef.update({
    name: nameInput,
    address: addressInput || "",
    phone: phoneInput || "",
    note: noteInput || "",
    updatedAt: new Date().toISOString()
  })
  .then(() => {
    console.log("Cập nhật thông tin thành công:", { nameInput, addressInput, phoneInput, noteInput });
    alert("Cập nhật thông tin thành công!");
    // Cập nhật employeeData để đồng bộ
    const employee = employeeData.find(e => e.id === user.uid);
    if (employee) {
      employee.name = nameInput;
      employee.address = addressInput;
      employee.phone = phoneInput;
      employee.note = noteInput;
    }
    renderEmployeeList();
  })
  .catch(error => {
    console.error("Lỗi khi cập nhật thông tin:", error);
    alert("Có lỗi xảy ra khi cập nhật thông tin!");
  });
}

// Đăng nhập / Đăng xuất
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    console.error("Login failed: Missing email or password");
    return alert("Vui lòng nhập đầy đủ thông tin!");
  }

  console.log("Attempting login with email:", email);
  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      console.log("Login successful, user ID:", currentEmployeeId);
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      openTabBubble('revenue-expense');
      loadFirebaseData();
    })
    .catch(err => {
      console.error("Login error:", err.message);
      alert("Lỗi đăng nhập: " + err.message);
    });
}

function logout() {
  console.log("Logging out user:", currentEmployeeId);
  auth.signOut().then(() => {
    currentEmployeeId = null;
    console.log("Logout successful");
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }).catch(err => {
    console.error("Logout error:", err.message);
    alert("Lỗi đăng xuất: " + err.message);
  });
}

// Floating Button Tabs
function toggleMenu() {
  const options = document.getElementById('float-options');
  console.log("Toggling menu, current display:", options.style.display);
  options.style.display = (options.style.display === 'flex') ? 'none' : 'flex';
}

function openTabBubble(tabId) {
  console.log("Opening tab:", tabId);
  const tabs = document.querySelectorAll('.tabcontent');
  tabs.forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add('active');
    console.log("Tab activated:", tabId);
  } else {
    console.error("Tab not found:", tabId);
  }

  toggleMenu();
  if (tabId === "revenue-expense") {
    console.log("Rendering revenue-expense data");
    renderReportProductList();
    renderReports();
  } else if (tabId === "inventory") {
    console.log("Rendering inventory data");
    renderInventory();
  } else if (tabId === "profile") {
    console.log("Rendering profile data");
    renderEmployeeList();
  } else if (tabId === "employee-management") {
    console.log("Rendering employee management data");
    renderEmployeeList();
    renderAdvanceApprovalList();
  } else if (tabId === "business-report") {
    console.log("Rendering business report data");
    renderExpenseSummary();
    generateBusinessChart();
  } else if (tabId === "chat") {
    console.log("Rendering chat data");
    renderChat("group");
    renderChat("manager");
  }
}

// Inventory Management (CRUD)



// Revenue-Expense Report
function submitReport() {
  const openingBalanceEl = document.getElementById("opening-balance");
  const expenseInputEl = document.getElementById("expense-input");
  const revenueEl = document.getElementById("revenue");
  const closingBalanceEl = document.getElementById("closing-balance");

  if (!openingBalanceEl || !expenseInputEl || !revenueEl || !closingBalanceEl) {
    alert("Lỗi: Không tìm thấy các trường nhập liệu!");
    return;
  }

  const openingBalance = parseFloat(openingBalanceEl.value) || 0;
  const expenseInput = expenseInputEl.value.trim();
  const revenue = parseFloat(revenueEl.value) || 0;
  const closingBalance = closingBalanceEl.value ? parseFloat(closingBalanceEl.value) : null; // Lưu null nếu không nhập
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (openingBalance === 0 && expenseAmount === 0 && revenue === 0 && closingBalance === null && Object.keys(productClickCounts).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin: số dư đầu kỳ, chi phí, doanh thu, số dư cuối kỳ, hoặc xuất hàng!");
    return;
  }

  // Tính số tiền còn lại
  const remaining = openingBalance + revenue - expenseAmount - (closingBalance || 0);

  const productsReported = Object.keys(productClickCounts).map(productId => {
    const product = inventoryData.find(p => p.id === productId);
    const quantity = productClickCounts[productId] || 0;
    if (quantity > 0 && product) {
      return { productId, name: product.name, quantity };
    }
    return null;
  }).filter(p => p !== null);

  Promise.all(productsReported.map(p => {
    const product = inventoryData.find(prod => prod.id === p.productId);
    if (product && p.quantity > 0) {
      return inventoryRef.child(p.productId).update({ quantity: product.quantity - p.quantity });
    }
    return Promise.resolve();
  })).then(() => {
    // Ưu tiên lấy tên từ employeeData
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const employeeName = employee ? employee.name : 
                        (auth.currentUser.displayName || auth.currentUser.email.split('@')[0] || 'Nhân viên');

    if (!employee) {
      console.warn("Không tìm thấy nhân viên trong employeeData:", {
        currentEmployeeId,
        employeeDataLength: employeeData.length,
        employeeDataIds: employeeData.map(e => e.id)
      });
    }

    const reportData = {
      date: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName: employeeName,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      closingBalance, // Lưu null nếu không nhập
      remaining,
      products: productsReported
    };

    // Log để kiểm tra dữ liệu
    console.log("Gửi báo cáo:", {
      openingBalance,
      revenue,
      expenseAmount,
      closingBalance,
      remaining,
      productsReported
    });

    reportsRef.push(reportData)
      .then(snap => {
        expenseNotes.push({ reportId: snap.key, note: expenseNote || "Không có" });
        alert("Báo cáo thành công!");
        openingBalanceEl.value = "";
        expenseInputEl.value = "";
        revenueEl.value = "";
        closingBalanceEl.value = "";
        productClickCounts = {};
        renderReportProductList();
        renderReports();
      })
      .catch(err => alert("Lỗi khi gửi báo cáo: " + err.message));
  }).catch(err => alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message));
}

function editReportExpense(reportId) {
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newInput = prompt("Chỉnh sửa nội dung chi phí (VD: 500k Mua nguyên liệu):", `${report.expenseAmount / 1000}k ${report.expenseNote}`);
  if (!newInput) return;
  const { money: newAmount, note: newNote } = parseEntry(newInput);
  reportsRef.child(reportId).update({ 
    expenseAmount: newAmount, 
    expenseNote: newNote || "Không có",
    remaining: report.openingBalance + report.revenue - newAmount - report.closingBalance
  })
    .then(() => {
      expenseNotes = expenseNotes.map(note => 
        note.reportId === reportId ? { ...note, note: newNote || "Không có" } : note
      );
      renderReports();
      alert("Đã cập nhật chi phí!");
    })
    .catch(err => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

function deleteReportExpense(reportId) {
  if (!confirm("Xóa nội dung chi phí này?")) return;
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  reportsRef.child(reportId).update({ 
    expenseAmount: 0, 
    expenseNote: "Không có",
    remaining: report.openingBalance + report.revenue - 0 - report.closingBalance
  })
    .then(() => {
      expenseNotes = expenseNotes.filter(note => note.reportId !== reportId);
      renderReports();
      alert("Đã xóa chi phí!");
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
}

function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm xuất hàng này?")) return;
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const updatedProducts = report.products.filter(p => p.productId !== productId);
  const inventoryProduct = inventoryData.find(p => p.id === productId);
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryProduct ? inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity }) : Promise.resolve()
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã xóa sản phẩm!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

function editReportProduct(reportId, productId) {
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const newQuantity = parseInt(prompt("Số lượng mới:", product.quantity));
  if (!newQuantity || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const inventoryProduct = inventoryData.find(p => p.id === productId);
  if (!inventoryProduct) {
    alert("Sản phẩm không tồn tại trong kho!");
    return;
  }
  if (newQuantity > inventoryProduct.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products.map(p => 
    p.productId === productId ? { ...p, quantity: newQuantity } : p
  );
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity - newQuantity })
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã cập nhật sản phẩm!");
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
}

function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) {
    console.error("Report product list element not found!");
    return;
  }
  container.innerHTML = "";
  if (inventoryData.length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  inventoryData.forEach(item => {
    const clickCount = productClickCounts[item.id] || 0;
    const button = document.createElement("button");
    button.classList.add("product-button");
    button.textContent = `${item.name}: ${clickCount}`;
    button.onclick = () => incrementProductCount(item.id);
    container.appendChild(button);
  });
}

function incrementProductCount(productId) {
  const product = inventoryData.find(p => p.id === productId);
  if (!product) return;
  productClickCounts[productId] = (productClickCounts[productId] || 0) + 1;
  if (productClickCounts[productId] > product.quantity) {
    productClickCounts[productId] = product.quantity;
    alert("Đã đạt số lượng tối đa trong kho!");
  }
  renderReportProductList();
}



function filterReports() {
  const overlay = document.createElement("div");
  overlay.id = "date-filter-overlay";
  overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;";
  
  const filterBox = document.createElement("div");
  filterBox.style.cssText = "background: white; padding: 20px; border-radius: 5px; width: 300px; text-align: center;";
  
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Đóng";
  closeBtn.style.cssText = "margin-top: 10px;";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  const singleDateLabel = document.createElement("label");
  singleDateLabel.textContent = "Chọn ngày: ";
  const singleDateInput = document.createElement("input");
  singleDateInput.type = "date";
  singleDateInput.id = "single-filter-date";
  singleDateInput.max = new Date().toISOString().split("T")[0];

  const rangeDateLabel = document.createElement("label");
  rangeDateLabel.textContent = "Chọn khoảng thời gian: ";
  const startDateInput = document.createElement("input");
  startDateInput.type = "date";
  startDateInput.id = "filter-start-date";
  startDateInput.max = new Date().toISOString().split("T")[0];
  const endDateInput = document.createElement("input");
  endDateInput.type = "date";
  endDateInput.id = "filter-end-date";
  endDateInput.max = new Date().toISOString().split("T")[0];

  const filterBtn = document.createElement("button");
  filterBtn.textContent = "Lọc";
  filterBtn.className = "primary-btn";
  filterBtn.onclick = () => {
    const singleDate = singleDateInput.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    let filteredReports = reportData;

    if (singleDate) {
      const selectedDate = new Date(singleDate).toISOString().split('T')[0];
      filteredReports = reportData.filter(r => r.date.split('T')[0] === selectedDate);
      // Cập nhật nút lọc
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(singleDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = reportData.filter(r => {
        const reportDate = new Date(r.date).getTime();
        return reportDate >= start && reportDate < end;
      });
      // Cập nhật nút lọc
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(startDate).toLocaleDateString('vi-VN')} - ${new Date(endDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, null, startDate, endDate);
    } else {
      alert("Vui lòng chọn một ngày hoặc khoảng thời gian!");
      return;
    }

    document.body.removeChild(overlay);
  };

  filterBox.appendChild(singleDateLabel);
  filterBox.appendChild(singleDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(rangeDateLabel);
  filterBox.appendChild(startDateInput);
  filterBox.appendChild(endDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(filterBtn);
  filterBox.appendChild(closeBtn);
  overlay.appendChild(filterBox);
  document.body.appendChild(overlay);
}

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  if (!reportContainer || !productContainer) {
    console.error("Report table element not found!");
    return;
  }
  reportContainer.innerHTML = "";
  productContainer.innerHTML = "";

  // Xác định ngày hiện tại hoặc ngày được chọn
  const today = new Date().toISOString().split("T")[0];
  const displayDate = selectedDate || (startDate && endDate ? `${startDate} - ${endDate}` : today);

  if (filteredReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    return;
  }

  const sortedReports = filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Lọc báo cáo có thông tin tài chính
  const financeReports = sortedReports.filter(r => 
    r.openingBalance !== 0 || r.revenue !== 0 || r.expenseAmount !== 0 || r.closingBalance !== null
  );

  // Trạng thái mở rộng
  let isExpandedFinance = false;
  let isExpandedProduct = false;

  // Hàm render bảng thu chi
  const renderFinanceTable = () => {
    const displayReports = isExpandedFinance ? financeReports : financeReports.slice(0, 3);
    const reportTable = document.createElement("table");
    reportTable.classList.add("table-style");
    reportTable.innerHTML = `
      <thead>
        <tr>
          <th>STT</th>
          <th>Tên NV</th>
          <th>Chi phí</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${displayReports.map((r, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${r.employeeName}</td>
            <td>${r.expenseAmount.toLocaleString('vi-VN')} VND (${r.expenseNote || "Không có"})</td>
            <td>
              <button onclick="editReportExpense('${r.id}')">Sửa</button>
              <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
            </td>
          </tr>`).join("")}
      </tbody>`;
    reportContainer.innerHTML = `<h3>Danh sách Báo cáo Thu Chi (${displayDate})</h3>`;
    reportContainer.appendChild(reportTable);

    // Nút Xem thêm
    if (financeReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedFinance ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => {
        isExpandedFinance = !isExpandedFinance;
        renderFinanceTable();
      };
      reportContainer.appendChild(expandBtn);
    }
  };

  // Hàm render bảng xuất hàng
  const renderProductTable = () => {
    const productReports = sortedReports.flatMap((r, index) => 
      Array.isArray(r.products) && r.products.length > 0 
        ? r.products.map(p => {
            const inventoryItem = inventoryData.find(item => item.id === p.productId);
            return {
              index: index + 1,
              reportId: r.id,
              employeeName: r.employeeName,
              productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định",
              quantity: p.quantity,
              productId: p.productId
            };
          })
        : []
    );

    const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
    const productTable = document.createElement("table");
    productTable.classList.add("table-style");
    productTable.innerHTML = `
      <thead>
        <tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr>
      </thead>
      <tbody>
        ${displayProducts.map(p => `
          <tr>
            <td>${p.index}</td>
            <td>${p.employeeName}</td>
            <td>${p.productName}</td>
            <td>${p.quantity}</td>
            <td>
              <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
              <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
            </td>
          </tr>`).join("")}
      </tbody>`;
    productContainer.innerHTML = `<h3>Danh sách Báo cáo Xuất Hàng (${displayDate})</h3>`;
    productContainer.appendChild(productTable);

    // Nút Xem thêm
    if (productReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedProduct ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => {
        isExpandedProduct = !isExpandedProduct;
        renderProductTable();
      };
      productContainer.appendChild(expandBtn);
    }
  };

  // Render bảng
  renderFinanceTable();
  renderProductTable();

  // Tổng hợp thu chi
  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const finalBalance = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  const totalReportDiv = document.createElement("div");
  totalReportDiv.classList.add("report-total");
  totalReportDiv.innerHTML = `
    <strong>Tổng (${displayDate}):</strong><br>
    Số dư đầu kỳ: ${totalOpeningBalance.toLocaleString('vi-VN')} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND<br>
    Chi phí: ${totalExpense.toLocaleString('vi-VN')} VND<br>
    Số dư cuối kỳ: ${totalClosingBalance.toLocaleString('vi-VN')} VND<br>
    Còn lại: ${finalBalance.toLocaleString('vi-VN')} VND
  `;
  reportContainer.appendChild(totalReportDiv);

  // Tổng hợp xuất hàng
  const productReports = sortedReports.flatMap(r => 
    Array.isArray(r.products) ? r.products.map(p => {
      const inventoryItem = inventoryData.find(item => item.id === p.productId);
      return {
        productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định",
        quantity: p.quantity
      };
    }) : []
  );

  const totalProductSummary = productReports.reduce((acc, p) => {
    acc[p.productName] = (acc[p.productName] || 0) + p.quantity;
    return acc;
  }, {});
  
  const totalProductText = Object.entries(totalProductSummary)
    .map(([name, qty]) => {
      const inventoryItem = inventoryData.find(item => item.name === name);
      const remainingQty = inventoryItem ? inventoryItem.quantity : 0;
      return `${name}: ${qty} (Còn: ${remainingQty})`;
    })
    .join(" - ");

  const totalProductDiv = document.createElement("div");
  totalProductDiv.classList.add("report-total");
  totalProductDiv.innerHTML = `
    <strong>Tổng xuất kho (${displayDate}):</strong> ${totalProductText || "Không có"}
  `;
  productContainer.appendChild(totalProductDiv);
}

function renderReports() {
  renderFilteredReports(reportData);
}

// Employee Management
function addEmployee() {
  const name = document.getElementById("manage-employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  console.log("Adding employee:", { name, dailyWage, allowance, otherFee });

  if (!name || dailyWage <= 0) {
    console.error("Invalid employee input:", { name, dailyWage });
    return alert("Nhập thông tin nhân viên hợp lệ!");
  }

  employeesRef.push({
    name,
    dailyWage,
    allowance,
    otherFee,
    workdays: 26,
    offdays: 0,
    address: "",
    phone: "",
    note: "",
    createdAt: new Date().toISOString()
  })
  .then(() => {
    console.log("Employee added successfully");
    alert("Đã thêm nhân viên!");
    document.getElementById("manage-employee-name").value = "";
    document.getElementById("employee-dailywage").value = "";
    document.getElementById("employee-allowance").value = "";
    document.getElementById("employee-otherfee").value = "";
  })
  .catch(err => {
    console.error("Error adding employee:", err);
    alert("Lỗi khi thêm nhân viên: " + err.message);
  });
}
function renderEmployeeList() {
  const user = auth.currentUser;
  const personalInfoDiv = document.getElementById("profile");
  if (!personalInfoDiv || !user) {
    console.error("Profile tab or user not found:", { user, personalInfoDiv });
    return;
  }

  const employee = employeeData.find(emp => emp.id === user.uid);
  if (employee) {
    document.getElementById("personal-employee-name").value = employee.name || "";
    document.getElementById("employee-address").value = employee.address || "";
    document.getElementById("employee-phone").value = employee.phone || "";
    document.getElementById("employee-note").value = employee.note || "";
    document.getElementById("advance-amount").value = "";
  } else {
    console.warn("Employee not found in employeeData for user:", user.uid);
  }

  // Hiển thị danh sách nhân viên trong tab employee-management
  const employeeListDiv = document.getElementById("employee-list");
  if (employeeListDiv) {
    employeeListDiv.innerHTML = "";
    if (employeeData.length === 0) {
      employeeListDiv.innerHTML = "<p>Chưa có nhân viên.</p>";
      return;
    }
    const table = document.createElement("table");
    table.classList.add("table-style");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>Địa chỉ</th>
          <th>Số điện thoại</th>
          <th>Ghi chú</th>
          <th>Lương ngày</th>
          <th>Phụ cấp</th>
          <th>Phí khác</th>
        </tr>
      </thead>
      <tbody>
        ${employeeData.map(emp => `
          <tr>
            <td>${emp.name}</td>
            <td>${emp.address || "Chưa cập nhật"}</td>
            <td>${emp.phone || "Chưa cập nhật"}</td>
            <td>${emp.note || "Không có"}</td>
            <td>${emp.dailyWage?.toLocaleString('vi-VN') || 0} VND</td>
            <td>${emp.allowance?.toLocaleString('vi-VN') || 0} VND</td>
            <td>${emp.otherFee?.toLocaleString('vi-VN') || 0} VND</td>
          </tr>
        `).join("")}
      </tbody>`;
    employeeListDiv.appendChild(table);
  }
}

function requestSchedule() {
  const nameInput = document.getElementById("personal-employee-name");
  const name = nameInput ? nameInput.value.trim() : "";

  if (!currentEmployeeId) {
    alert("Không xác định được ID nhân viên!");
    return;
  }

  if (!selectedScheduleDate || !selectedScheduleType || !name) {
    alert("Vui lòng chọn ngày, loại (off/tăng ca) và nhập tên!");
    return;
  }

  const key = `${selectedScheduleDate}_${currentEmployeeId}`;

  schedulesRef.child(key).set({
    employeeId: currentEmployeeId,
    employeeName: name,
    date: selectedScheduleDate,
    status: selectedScheduleType, // off, overtime, present...
    timestamp: Date.now()
  }).then(() => {
    alert(`✅ Đã gửi yêu cầu "${selectedScheduleType}" cho ngày ${selectedScheduleDate}`);
    selectedScheduleDate = "";
    selectedScheduleType = "";
  }).catch(err => {
    console.error("Lỗi gửi yêu cầu LLV:", err);
    alert("❌ Lỗi: " + err.message);
  });
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) {
    console.error("Advance history element not found!");
    return;
  }
  container.innerHTML = "";
  const myAdvances = advanceRequests
    .filter(a => a.employeeId === currentEmployeeId)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Sắp xếp theo timestamp
  console.log("Rendering advance history, total items:", myAdvances.length);

  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    return;
  }

  const displayAdvances = isExpandedAdvance ? myAdvances : myAdvances.slice(0, 3);
  displayAdvances.forEach(a => {
    const amount = typeof a.amount === "number" ? a.amount.toLocaleString('vi-VN') : "0";
    const approvalText = a.status === "approved" ? "Đã duyệt" : a.status === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `Tạm ứng: ${amount} VND - ${a.reason || "Không có lý do"} - Ngày: ${a.date} - ${approvalText}<hr>`;
    container.appendChild(div);
  });

  if (myAdvances.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedAdvance ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => {
      isExpandedAdvance = !isExpandedAdvance;
      renderAdvanceHistory();
    };
    container.appendChild(expandBtn);
  }
}

function approveAdvance(requestKey) {
  const advance = advanceRequests.find(a => a.id === requestKey);
  if (!advance) {
    console.error("Advance request not found for key:", requestKey);
    return;
  }
  advancesRef.child(requestKey).update({ status: "approved" }).then(() => {
    console.log("Advance approved:", requestKey);
    
    // Gửi thông báo xác nhận
    const message = `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND ngày ${advance.date} đã được duyệt.`;
    notificationsRef.child(advance.employeeId).push({
      message,
      timestamp: Date.now(),
      type: "confirmation", // Thêm type
      date: advance.date,
      isRead: false
    }).then(() => {
      console.log("Sent confirmation notification to employee:", advance.employeeId, message);
    }).catch(err => {
      console.error("Lỗi gửi thông báo:", err);
    });

    renderAdvanceApprovalList();
    renderAdvanceHistory();
  }).catch(err => {
    console.error("Lỗi khi duyệt yêu cầu:", err);
    alert("Lỗi khi duyệt yêu cầu: " + err.message);
  });
}
// Tạo lịch
function generateCalendar(month, year) {
  const calendarModal = document.getElementById("calendar-modal");
  if (!calendarModal) {
    console.error("Calendar modal not found!");
    return;
  }
  calendarModal.style.display = "block"; // Đảm bảo hiển thị
  calendarModal.innerHTML = `
    <div class="calendar-header">
      <button onclick="changeMonth(-1)">Trước</button>
      <h3>Tháng ${month}/${year}</h3>
      <button onclick="changeMonth(1)">Sau</button>
    </div>
    <div class="calendar" id="calendar"></div>
    <button onclick="closeCalendar()">Đóng</button>
  `;
  
  const calendar = document.getElementById("calendar");
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay() || 7; // Bắt đầu từ thứ 2

  // Thêm ô trống
  for (let i = 1; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("day");
    calendar.appendChild(emptyDiv);
  }

  // Tạo các ô ngày
  for (let i = 1; i <= daysInMonth; i++) {
    const date = `${year}-${month < 10 ? "0" + month : month}-${i < 10 ? "0" + i : i}`;
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    dayDiv.dataset.date = date;
    
    const schedule = scheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
    dayDiv.classList.add(schedule ? schedule.status : "normal");
    dayDiv.textContent = i;
    
    dayDiv.onclick = () => showActionModal(date);
    calendar.appendChild(dayDiv);
  }
  console.log("Generated calendar for:", month, year);
}

// Đóng lịch
function closeCalendar() {
  const calendarModal = document.getElementById("calendar-modal");
  if (calendarModal) {
    calendarModal.style.display = "none";
    console.log("Closed calendar");
  }
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
  console.log("Changing to month:", currentMonth, currentYear); // Log để kiểm tra
  renderCalendar(); // Gọi renderCalendar để hiển thị tháng mới
}
// Hiển thị modal hành động
function showActionModal(date) {
  const modal = document.getElementById("action-modal");
  const modalContent = document.getElementById("action-modal-content");
  if (!modal || !modalContent) {
    console.error("Modal or modal content not found! Ensure #action-modal and #action-modal-content exist in HTML.");
    alert("Lỗi: Không tìm thấy modal. Vui lòng kiểm tra cấu trúc HTML.");
    return;
  }

  const schedule = scheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
  let modalHTML = `
    <h3>Chọn hành động cho ngày ${date}</h3>
    <button onclick="submitScheduleRequest('${date}', 'off')">Nghỉ</button>
    <button onclick="submitScheduleRequest('${date}', 'overtime')">Tăng ca</button>
    <button onclick="submitScheduleRequest('${date}', 'swap')">Đổi ca</button>
  `;

  // Nếu ngày đã có yêu cầu (approved hoặc pending), hiển thị trạng thái và nút Hủy
  if (schedule && (schedule.approvalStatus === "approved" || schedule.approvalStatus === "pending")) {
    const statusText = {
      off: "Nghỉ",
      overtime: "Tăng ca",
      swap: "Đổi ca"
    }[schedule.status] || schedule.status;
    const approvalText = {
      approved: "Đã duyệt",
      pending: "Chờ duyệt",
      rejected: "Bị từ chối"
    }[schedule.approvalStatus] || schedule.approvalStatus;
    modalHTML += `
      <p>Trạng thái hiện tại: ${statusText} (${approvalText})</p>
      <button onclick="cancelScheduleRequest('${date}', '${schedule.id}')">Hủy yêu cầu</button>
    `;
  }

  modalHTML += `<button onclick="closeModal('action-modal')">Đóng</button>`;
  modalContent.innerHTML = modalHTML;
  modal.style.display = "block";
  console.log("Showing modal for date:", date, "with schedule:", schedule);
}
function cancelScheduleRequest(date, scheduleId) {
  const schedule = scheduleData.find(s => s.id === scheduleId && s.employeeId === currentEmployeeId);
  if (!schedule) {
    alert("Không tìm thấy yêu cầu hoặc bạn không có quyền hủy!");
    return;
  }

  // Cập nhật trạng thái yêu cầu thành cancelled
  const scheduleRef = schedulesRef.child(scheduleId);
  scheduleRef.update({
    approvalStatus: "cancelled",
    updatedAt: new Date().toISOString()
  }).then(() => {
    console.log("Cancelled schedule request:", scheduleId, "for date:", date);
    
    // Gửi thông báo đến quản lý
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const managerMessage = {
      senderId: currentEmployeeId,
      senderName: employee ? employee.name : "Nhân viên",
      message: `Yêu cầu hủy ${schedule.status} ngày ${date} từ ${employee ? employee.name : "Nhân viên"}`,
      timestamp: new Date().toISOString(),
      type: "cancel_request",
      scheduleId: scheduleId
    };
    messagesRef.child("manager").push(managerMessage).then(() => {
      console.log("Sent cancel notification to manager:", managerMessage);
      alert("Yêu cầu hủy đã được gửi đến quản lý!");
      closeModal('action-modal');
      renderCalendar(); // Cập nhật lịch để bỏ màu trạng thái
      renderScheduleStatusList(); // Cập nhật lịch sử yêu cầu
    }).catch(err => {
      console.error("Error sending cancel notification:", err);
      alert("Lỗi khi gửi thông báo hủy!");
    });
  }).catch(err => {
    console.error("Error cancelling schedule request:", err);
    alert("Lỗi khi hủy yêu cầu!");
  });
}

// Đóng modal hành động
function closeActionModal() {
  const actionModal = document.getElementById("action-modal");
  if (actionModal) {
    actionModal.style.display = "none";
    console.log("Closed action modal");
  }
}

function calculateSalary(empId) {
  const emp = employeeData.find(e => e.id === empId);
  if (!emp) {
    console.error("Employee not found for salary calculation:", empId);
    return 0;
  }
  const totalAdvance = advanceRequests.filter(a => a.employeeId === empId && a.status === "approved")
    .reduce((sum, a) => sum + a.amount, 0);
  
  const employeeSchedules = scheduleData.filter(s => s.employeeId === empId);
  const offDays = employeeSchedules.filter(s => s.status === "off").length;
  const overtimeDays = employeeSchedules.filter(s => s.status === "overtime").length;
  const workDays = emp.workdays - offDays;
  const salary = (workDays * emp.dailyWage) + (overtimeDays * emp.dailyWage * 1.5) + emp.allowance - emp.otherFee - totalAdvance;
  
  console.log("Calculated salary for employee:", { empId, workDays, offDays, overtimeDays, salary });
  return salary;
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) {
    console.error("Salary summary element not found!");
    return;
  }
  const emp = employeeData.find(e => e.id === currentEmployeeId);
  if (!emp) {
    container.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
    console.error("No employee data for user:", currentEmployeeId);
    return;
  }
  const employeeSchedules = scheduleData.filter(s => s.employeeId === currentEmployeeId);
  const offDays = employeeSchedules.filter(s => s.status === "off").length;
  const overtimeDays = employeeSchedules.filter(s => s.status === "overtime").length;
  const salary = calculateSalary(emp.id);
  container.innerHTML = `
    <p>Ngày công: ${emp.workdays - offDays}</p>
    <p>Ngày nghỉ: ${offDays}</p>
    <p>Ngày tăng ca: ${overtimeDays}</p>
    <p>Lương/ngày: ${emp.dailyWage.toLocaleString('vi-VN')} VND</p>
    <p>Phụ cấp: ${emp.allowance.toLocaleString('vi-VN')} VND</p>
    <p>Phí khác: ${emp.otherFee.toLocaleString('vi-VN')} VND</p>
    <p><strong>Tổng lương: ${salary.toLocaleString('vi-VN')} VND</strong></p>`;
  console.log("Rendered salary summary for user:", currentEmployeeId);
}
// Chat
function sendGroupMessage() {
  const msg = document.getElementById("group-message").value.trim();
  if (!msg) {
    console.error("Empty group message");
    return;
  }
  console.log("Sending group message:", msg);
  messagesRef.child("group").push({ text: msg, time: new Date().toISOString() })
    .then(() => {
      console.log("Group message sent successfully");
      document.getElementById("group-message").value = "";
    })
    .catch(err => console.error("Error sending group message:", err));
}

function sendManagerMessage() {
  const msg = document.getElementById("manager-message").value.trim();
  if (!msg) {
    console.error("Empty manager message");
    return;
  }
  console.log("Sending manager message:", msg);
  messagesRef.child("manager").push({ text: msg, time: new Date().toISOString() })
    .then(() => {
      console.log("Manager message sent successfully");
      document.getElementById("manager-message").value = "";
    })
    .catch(err => console.error("Error sending manager message:", err));
}

function renderChat(type) {
  const box = document.getElementById(type + "-chat");
  if (!box) {
    console.error("Chat box not found:", type);
    return;
  }
  box.innerHTML = "";
  console.log(`Rendering ${type} chat, total messages:`, messages[type].length);
  messages[type].forEach(m => {
    const div = document.createElement("div");
    div.classList.add("chat-message");
    div.textContent = `[${new Date(m.time).toLocaleTimeString()}] ${m.text}`;
    box.appendChild(div);
  });
}

// Business Report
function renderExpenseSummary() {
  const container = document.getElementById("expense-summary-table");
  if (!container) {
    console.error("Expense summary table element not found!");
    return;
  }
  container.innerHTML = "";
  console.log("Rendering expense summary, total items:", reportData.length);
  reportData.filter(r => r.expenseAmount > 0).forEach(r => {
    const row = document.createElement("div");
    const productsText = Array.isArray(r.products) ? 
      (r.products.length > 0 ? r.products.map(p => `${p.name}: ${p.quantity}`).join(", ") : "Không có sản phẩm") : 
      (r.product ? `Sản phẩm: ${r.product}` : "Không có sản phẩm");
    row.innerHTML = `${new Date(r.date).toLocaleString()} - ${r.employeeName} - Chi phí: ${r.expenseAmount} - ${productsText}`;
    container.appendChild(row);
  });
}

function generateBusinessChart() {
  const ctx = document.getElementById("growth-chart");
  if (!ctx) {
    console.error("Chart canvas not found!");
    return;
  }
  const labels = [...new Set(reportData.map(r => r.date.split("T")[0]))];
  const revenueData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.revenue, 0));
  const expenseData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.expenseAmount, 0));
  console.log("Generating business chart:", { labels, revenueData, expenseData });

  ```chartjs
  {
    "type": "bar",
    "data": {
      "labels": ${JSON.stringify(labels)},
      "datasets": [
        {
          "label": "Doanh thu",
          "data": ${JSON.stringify(revenueData)},
          "backgroundColor": "#28a745"
        },
        {
          "label": "Chi phí",
          "data": ${JSON.stringify(expenseData)},
          "backgroundColor": "#dc3545"
        }
      ]
    },
    "options": {
      "responsive": true,
      "plugins": {
        "legend": {
          "position": "top"
        }
      }
    }
  }
  ```
}
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  console.log("Adding product:", { name, quantity, price });

  if (!name || quantity <= 0 || price <= 0) {
    console.error("Invalid product input:", { name, quantity, price });
    alert("Vui lòng nhập đầy đủ và đúng thông tin sản phẩm!");
    return;
  }

  inventoryRef.push({ name, quantity, price })
    .then(() => {
      console.log("Product added successfully to Firebase:", { name, quantity, price });
      alert("Đã thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
    })
    .catch(err => {
      console.error("Error adding product to Firebase:", err);
      alert("Lỗi khi thêm sản phẩm: " + err.message);
    });
}

function editInventory(id) {
  console.log("Editing product ID:", id);
  const product = inventoryData.find(p => p.id === id);
  if (!product) {
    console.error("Product not found for ID:", id);
    return;
  }
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Đơn giá:", product.price)) || product.price;
  console.log("Updating product:", { id, newName, newQty, newPrice });
  inventoryRef.child(id).update({ name: newName, quantity: newQty, price: newPrice })
    .catch(err => console.error("Error updating product:", err));
}

function deleteInventory(id) {
  console.log("Deleting product ID:", id);
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef.child(id).remove()
    .then(() => console.log("Product deleted:", id))
    .catch(err => console.error("Error deleting product:", err));
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  if (!list) {
    console.error("Inventory list element not found!");
    return;
  }
  list.innerHTML = "";
  console.log("Rendering inventory, total items:", inventoryData.length);

  if (inventoryData.length === 0) {
    list.innerHTML = "<p>Kho trống.</p>";
    console.log("Inventory is empty");
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Tên SP</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => {
        console.log("Rendering product:", item);
        const total = item.quantity * item.price;
        return `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString('vi-VN')} VND</td>
          <td>${total.toLocaleString('vi-VN')} VND</td>
          <td>
            <button onclick="editInventory('${item.id}')">Sửa</button>
            <button onclick="deleteInventory('${item.id}')">Xóa</button>
          </td>
        </tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3"><strong>Tổng tiền tồn kho:</strong></td><td><strong>${inventoryData.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString('vi-VN')} VND</strong></td><td></td></tr>
    </tfoot>`;
  list.appendChild(table);
}


function loadFirebaseData() {
  return new Promise((resolve, reject) => {
    console.log("Initializing Firebase listeners");

    inventoryRef.on("value", snapshot => {
      inventoryData = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const product = { id: child.key, ...child.val() };
          console.log("Fetched product from Firebase:", product);
          inventoryData.push(product);
        });
      }
      console.log("Updated inventoryData:", inventoryData);
      renderInventory();
      renderReportProductList();
    }, err => {
      console.error("Error fetching inventory data:", err);
      reject(err);
    });

    reportsRef.on("value", snapshot => {
      reportData = [];
      expenseNotes = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const report = { id: child.key, ...child.val() };
          console.log("Fetched report from Firebase:", report);
          reportData.push(report);
          if (report.expenseNote) {
            expenseNotes.push({ reportId: child.key, note: report.expenseNote });
          }
        });
      }
      console.log("Updated reportData:", reportData);
      console.log("Updated expenseNotes:", expenseNotes);
      const today = new Date().toISOString().split("T")[0];
      const todayReports = reportData.filter(r => r.date.split('T')[0] === today);
      renderFilteredReports(todayReports, today);
      renderExpenseSummary();
    }, err => {
      console.error("Error fetching reports data:", err);
      reject(err);
    });

    employeesRef.on("value", snapshot => {
      employeeData = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const employee = { id: child.key, ...child.val() };
          console.log("Fetched employee from Firebase:", employee);
          employeeData.push(employee);
        });
      }
      console.log("Updated employeeData:", employeeData);
      renderEmployeeList();
    }, err => {
      console.error("Error fetching employees data:", err);
      reject(err);
    });

    advancesRef.on("value", snapshot => {
      advanceRequests = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const advance = { id: child.key, ...child.val() };
          console.log("Fetched advance request from Firebase:", advance);
          advanceRequests.push(advance);
        });
      }
      console.log("Updated advanceRequests:", advanceRequests);
      renderAdvanceApprovalList();
      renderAdvanceHistory();
    }, err => {
      console.error("Error fetching advances data:", err);
      reject(err);
    });

    schedulesRef.on("value", snapshot => {
      scheduleData = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const schedule = { id: child.key, ...child.val() };
          console.log("Fetched schedule from Firebase:", schedule);
          scheduleData.push(schedule);
        });
      }
      console.log("Updated scheduleData:", scheduleData, "Length:", scheduleData.length);
      renderScheduleApprovalList();
      renderSalarySummary();
      resolve(); // Hoàn tất khi scheduleData được tải
    }, err => {
      console.error("Error fetching schedules data:", err);
      reject(err);
    });

    messagesRef.child("group").on("value", snapshot => {
      messages.group = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const message = child.val();
          console.log("Fetched group message:", message);
          messages.group.push(message);
        });
      }
      console.log("Updated group messages:", messages.group);
      renderChat("group");
    }, err => {
      console.error("Error fetching group messages:", err);
      reject(err);
    });

    messagesRef.child("manager").on("value", snapshot => {
      messages.manager = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const message = child.val();
          console.log("Fetched manager message:", message);
          messages.manager.push(message);
        });
      }
      console.log("Updated manager messages:", messages.manager);
      renderChat("manager");
    }, err => {
      console.error("Error fetching manager messages:", err);
      reject(err);
    });
  });
}

function approveAdvance(requestKey) {
  advancesRef.child(requestKey).update({ status: "approved" })
    .then(() => {
      alert("Đã duyệt yêu cầu!");
    })
    .catch(err => {
      console.error("Lỗi khi duyệt yêu cầu:", err);
      alert("Lỗi khi duyệt yêu cầu: " + err.message);
    });
}

function denyAdvance(requestKey) {
  const advance = advanceRequests.find(a => a.id === requestKey);
  if (!advance) {
    console.error("Advance request not found for key:", requestKey);
    return;
  }
  advancesRef.child(requestKey).update({ status: "denied" }).then(() => {
    console.log("Advance rejected:", requestKey);
    
    // Gửi thông báo xác nhận
    const message = `Yêu cầu tạm ứng ${advance.amount.toLocaleString('vi-VN')} VND ngày ${advance.date} bị từ chối.`;
    notificationsRef.child(advance.employeeId).push({
      message,
      timestamp: Date.now(),
      type: "confirmation", // Thêm type
      date: advance.date,
      isRead: false
    }).then(() => {
      console.log("Sent confirmation notification to employee:", advance.employeeId, message);
    }).catch(err => {
      console.error("Lỗi gửi thông báo:", err);
    });

    renderAdvanceApprovalList();
    renderAdvanceHistory();
  }).catch(err => {
    console.error("Lỗi khi từ chối yêu cầu:", err);
    alert("Lỗi khi từ chối yêu cầu: " + err.message);
  });
}
function updateEmployeeName() {
  const displayNameInput = document.getElementById("employee-display-name");
  if (!displayNameInput) {
    alert("Lỗi: Không tìm thấy trường nhập tên hiển thị!");
    return;
  }

  const newName = displayNameInput.value.trim();
  if (!newName) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  if (!currentEmployeeId) {
    alert("Lỗi: Không tìm thấy ID nhân viên!");
    return;
  }

  // Cập nhật tên trong Firebase
  employeesRef.child(currentEmployeeId).update({ name: newName })
    .then(() => {
      // Cập nhật trong mảng employeeData local
      const employee = employeeData.find(e => e.id === currentEmployeeId);
      if (employee) {
        employee.name = newName;
      } else {
        employeeData.push({ id: currentEmployeeId, name: newName });
      }

      // Đồng bộ sang input "personal-employee-name"
      const personalNameInput = document.getElementById("personal-employee-name");
      if (personalNameInput) {
        personalNameInput.value = newName;
      }

      alert("Cập nhật tên hiển thị thành công!");
      displayNameInput.value = "";
      renderReports(); // Làm mới các báo cáo để hiển thị tên mới
    })
    .catch(err => {
      console.error("Lỗi khi cập nhật tên:", err);
      alert("Lỗi khi cập nhật tên: " + err.message);
    });
}


// Sửa hàm loadEmployeeInfo để đảm bảo đồng bộ thông tin sau F5
function loadEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    console.error("No user logged in!");
    return;
  }

  const ref = firebase.database().ref(`employees/${user.uid}`);
  ref.once("value").then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      const nameInput = document.getElementById("personal-employee-name");
      const addressInput = document.getElementById("employee-address");
      const phoneInput = document.getElementById("employee-phone");
      const noteInput = document.getElementById("employee-note");
      if (nameInput) nameInput.value = data.name || "";
      if (addressInput) addressInput.value = data.address || "";
      if (phoneInput) phoneInput.value = data.phone || "";
      if (noteInput) noteInput.value = data.note || "";
      console.log("Loaded employee info:", data);
    }
    // Gọi renderCalendar để hiển thị lịch ngay khi tải
    renderCalendar();
  }).catch((err) => {
    console.error("Lỗi khi load thông tin nhân viên:", err);
  });
}

// Sửa hàm requestAdvance để đảm bảo amount luôn hợp lệ
function requestAdvance() {
  const amountInput = document.getElementById("advance-amount");
  const reasonInput = document.getElementById("advance-reason");
  const nameInput = document.getElementById("personal-employee-name");

  const amount = parseFloat(amountInput.value) || 0;
  const reason = reasonInput.value.trim();
  const name = nameInput ? nameInput.value.trim() : "";
  const today = new Date().toISOString().split("T")[0];

  if (!currentEmployeeId) {
    alert("Không xác định được ID nhân viên!");
    return;
  }

  if (!name || amount <= 0 || !reason) {
    console.error("Thiếu thông tin yêu cầu tạm ứng:", { amount, reason, name });
    alert("Vui lòng nhập đầy đủ: Họ tên, số tiền và lý do!");
    return;
  }

  const advanceData = {
    employeeId: currentEmployeeId,
    name,
    amount: Math.round(amount), // Đảm bảo amount là số nguyên
    reason,
    date: today,
    status: "pending",
    timestamp: Date.now()
  };

  console.log("Gửi yêu cầu tạm ứng:", advanceData);

  advancesRef.push(advanceData).then(() => {
    console.log("Advance request submitted successfully");
    alert("✅ Đã gửi yêu cầu tạm ứng!");
    amountInput.value = "";
    reasonInput.value = "";
  }).catch(err => {
    console.error("Error submitting advance request:", err);
    alert("❌ Lỗi khi gửi yêu cầu tạm ứng: " + err.message);
  });
}

// Sửa hàm renderAdvanceApprovalList để xử lý trường hợp amount undefined
function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) {
    console.error("Advance approval list element not found!");
    return;
  }
  container.innerHTML = "";
  const pending = advanceRequests.filter(a => a.status === "pending");
  console.log("Rendering advance approval list, total items:", pending.length);

  if (pending.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu tạm ứng nào.</p>";
    return;
  }

  pending.forEach(a => {
    const amount = typeof a.amount === "number" ? a.amount.toLocaleString('vi-VN') : "0";
    const div = document.createElement("div");
    div.innerHTML = `
      ${a.name}: ${amount} VND - ${a.reason} - Ngày: ${a.date}
      <button onclick="approveAdvance('${a.id}')">Duyệt</button>
      <button onclick="denyAdvance('${a.id}')">Từ chối</button>
      <hr>`;
    container.appendChild(div);
  });
}

// Sửa auth.onAuthStateChanged để đồng bộ tên nhân viên
auth.onAuthStateChanged(user => {
  if (user) {
    currentEmployeeId = user.uid;

    const employeeRef = employeesRef.child(user.uid);
    employeeRef.once("value").then(snapshot => {
      if (!snapshot.exists()) {
        const newEmployee = {
          name: user.displayName || user.email.split('@')[0] || 'Nhân viên',
          email: user.email,
          active: true,
          role: 'employee',
          dailyWage: 0,
          allowance: 0,
          otherFee: 0,
          workdays: 26,
          offdays: 0,
          address: "",
          phone: "",
          note: "",
          createdAt: new Date().toISOString()
        };
        employeeRef.set(newEmployee).then(() => {
          console.log("Đã thêm nhân viên mới vào Firebase:", user.uid);
          employeeData.push({ id: user.uid, ...newEmployee });
          renderEmployeeList();
          loadEmployeeInfo();
          loadFirebaseData().then(() => {
            console.log("Firebase data loaded, rendering calendar and schedule status list...");
            renderCalendar(); // Render lịch
            renderScheduleStatusList(); // Render lịch sử yêu cầu
          }).catch(err => {
            console.error("Error loading Firebase data:", err);
          });
        }).catch(err => {
          console.error("Lỗi khi thêm nhân viên:", err);
        });
      } else {
        const employee = snapshot.val();
        if (!employeeData.find(emp => emp.id === user.uid)) {
          employeeData.push({ id: user.uid, ...employee });
        }
        loadEmployeeInfo();
        loadFirebaseData().then(() => {
          console.log("Firebase data loaded, rendering calendar and schedule status list...");
          renderCalendar(); // Render lịch
          renderScheduleStatusList(); // Render lịch sử yêu cầu
        }).catch(err => {
          console.error("Error loading Firebase data:", err);
        });
        // Cập nhật tên nhân viên trong báo cáo nếu cần
        reportsRef.once("value").then(snapshot => {
          snapshot.forEach(child => {
            const report = child.val();
            if (report.employeeId === user.uid && report.employeeName !== employee.name) {
              reportsRef.child(child.key).update({ employeeName: employee.name });
            }
          });
        });
      }
    });

    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('revenue-expense');
  } else {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});
function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) {
    console.error("Calendar element not found!");
    return;
  }

  // Sử dụng currentMonth và currentYear toàn cục
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay() || 7; // Bắt đầu từ thứ 2

  let calendarHTML = `
    <div class="calendar-header">
      <button onclick="changeMonth(-1)">Trước</button>
      <h3>Tháng ${currentMonth}/${currentYear}</h3>
      <button onclick="changeMonth(1)">Sau</button>
    </div>
    <div class="calendar">
      <div class="calendar-header">CN</div>
      <div class="calendar-header">T2</div>
      <div class="calendar-header">T3</div>
      <div class="calendar-header">T4</div>
      <div class="calendar-header">T5</div>
      <div class="calendar-header">T6</div>
      <div class="calendar-header">T7</div>
  `;

  // Thêm các ô trống cho ngày đầu tháng
  for (let i = 1; i < firstDay; i++) {
    calendarHTML += `<div class="day empty"></div>`;
  }

  // Render các ngày trong tháng
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const schedule = scheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
    const statusClass = schedule && schedule.approvalStatus === "approved" ? schedule.status : "normal";
    calendarHTML += `
      <div class="day ${statusClass}" data-date="${date}" onclick="showActionModal('${date}')">
        ${day}
      </div>`;
  }

  calendarHTML += `</div>`;
  calendar.innerHTML = calendarHTML;
  console.log("Rendered calendar for:", currentMonth, currentYear, "with scheduleData:", scheduleData);
}
// Thêm hàm cancelSchedule để hủy yêu cầu và gửi thông báo cho quản lý
function cancelSchedule(key) {
  const schedule = scheduleData.find(s => s.id === key);
  if (!schedule) {
    console.error("Schedule not found for key:", key);
    alert("Yêu cầu không tồn tại!");
    return;
  }
  if (schedule.approvalStatus !== "pending") {
    alert("Chỉ có thể hủy yêu cầu đang chờ duyệt!");
    return;
  }

  schedulesRef.child(key).remove().then(() => {
    scheduleData = scheduleData.filter(s => s.id !== key);
    payrollData = payrollData.filter(p => p.date !== schedule.date || p.employeeId !== currentEmployeeId);
    localStorage.setItem("payrollData", JSON.stringify(payrollData));

    // Gửi thông báo cho quản lý
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]);
    const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const message = `${employeeName} đã hủy yêu cầu ${statusText} ngày ${schedule.date}`;
    messagesRef.child("manager").push({
      text: message,
      time: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName
    }).then(() => {
      console.log("Sent cancellation notification to manager:", message);
      alert("Đã hủy yêu cầu và thông báo quản lý!");
      renderCalendar();
      renderScheduleStatusList();
      renderScheduleApprovalList();
      renderSalarySummary();
    }).catch(err => {
      console.error("Lỗi gửi thông báo hủy:", err);
      alert("Lỗi khi gửi thông báo hủy: " + err.message);
    });
  }).catch(err => {
    console.error("Lỗi hủy yêu cầu:", err);
    alert("Lỗi khi hủy yêu cầu: " + err.message);
  });
}

// Sửa hàm renderScheduleStatusList để hiển thị 3 mục và nút Xem thêm, thêm nút Hủy
function renderScheduleStatusList() {
  const container = document.getElementById("schedule-status-list");
  if (!container) {
    console.error("Schedule status list element not found!");
    return;
  }
  container.innerHTML = "";
  const schedules = scheduleData
    .filter(s => s.employeeId === currentEmployeeId)
    .sort((a, b) => b.timestamp - a.timestamp); // Sắp xếp theo thời gian giảm dần
  console.log("Rendering schedule status list, total items:", schedules.length);

  if (schedules.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }

  const displaySchedules = isExpandedSchedule ? schedules : schedules.slice(0, 3);
  displaySchedules.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `
      ${s.date}: ${statusText} - ${approvalText}
      ${approvalText === "Chờ duyệt" ? `<button onclick="cancelSchedule('${s.id}')">Hủy</button>` : ""}
      <hr>`;
    container.appendChild(div);
  });

  if (schedules.length > 3) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpandedSchedule ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => {
      isExpandedSchedule = !isExpandedSchedule;
      renderScheduleStatusList();
    };
    container.appendChild(expandBtn);
  }
}
// Sửa hàm setStatus để xử lý trạng thái và cập nhật danh sách
function setStatus(date, status) {
  const dayDiv = document.querySelector(`.day[data-date="${date}"]`);
  if (!dayDiv) {
    console.error("Day element not found for date:", date);
    return;
  }
  const currentSchedule = scheduleData.find(s => s.date === date && s.employeeId === currentEmployeeId);
  const employee = employeeData.find(e => e.id === currentEmployeeId);
  const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]);

  if (!employeeName) {
    alert("Vui lòng cập nhật tên hiển thị trước!");
    return;
  }

  const key = `${date}_${currentEmployeeId}`;
  if (currentSchedule && currentSchedule.status === status && currentSchedule.approvalStatus === "pending") {
    // Reset về trạng thái bình thường
    dayDiv.classList.remove(status);
    dayDiv.classList.add("normal");
    schedulesRef.child(key).remove();
    scheduleData = scheduleData.filter(s => s.date !== date || s.employeeId !== currentEmployeeId);
    payrollData = payrollData.filter(p => p.date !== date || p.employeeId !== currentEmployeeId);
    localStorage.setItem("payrollData", JSON.stringify(payrollData));
    console.log(`Ngày ${date} trở về bình thường`);
  } else {
    // Cập nhật trạng thái mới
    dayDiv.classList.remove("normal", "off", "overtime", "swap");
    dayDiv.classList.add("normal"); // Chỉ áp dụng trạng thái khi được duyệt

    const scheduleEntry = {
      date,
      employeeId: currentEmployeeId,
      employeeName,
      status,
      approvalStatus: "pending", // Thêm trạng thái phê duyệt
      timestamp: Date.now()
    };

    if (currentSchedule) {
      currentSchedule.status = status;
      currentSchedule.approvalStatus = "pending";
    } else {
      scheduleData.push(scheduleEntry);
    }

    payrollData.push({ date, employeeId: currentEmployeeId, employeeName, status });
    localStorage.setItem("payrollData", JSON.stringify(payrollData));

    schedulesRef.child(key).set(scheduleEntry).then(() => {
      console.log(`Đã gửi yêu cầu ${status} cho ngày ${date}`);
      if (status === "swap") {
        const conflictingSchedule = scheduleData.find(s => s.date === date && s.employeeId !== currentEmployeeId);
        if (conflictingSchedule) {
          swapRequestsRef.push({
            fromEmployeeId: currentEmployeeId,
            fromEmployeeName: employeeName,
            toEmployeeId: conflictingSchedule.employeeId,
            toEmployeeName: conflictingSchedule.employeeName,
            date,
            status: "pending",
            timestamp: Date.now()
          }).then(() => {
            console.log(`Gửi yêu cầu đổi ca ngày ${date} tới ${conflictingSchedule.employeeName}`);
          });
        } else {
          alert("Không tìm thấy nhân viên có ca trùng để đổi!");
        }
      }
    }).catch(err => {
      console.error("Lỗi gửi yêu cầu lịch làm việc:", err);
      alert("Lỗi: " + err.message);
    });
  }
  closeActionModal();
  renderCalendar();
  renderScheduleStatusList(); // Cập nhật danh sách trạng thái
  renderSalarySummary();
}

// Sửa hàm approveSchedule để cập nhật trạng thái approved
function approveSchedule(key) {
  const schedule = scheduleData.find(s => s.id === key);
  if (!schedule) {
    console.error("Schedule not found for key:", key);
    return;
  }
  schedulesRef.child(key).update({ approvalStatus: "approved" }).then(() => {
    schedule.approvalStatus = "approved";
    console.log(`Đã duyệt yêu cầu ${schedule.status} cho ngày ${schedule.date}`);
    
    // Gửi thông báo xác nhận
    const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const message = `Yêu cầu ${statusText} ngày ${schedule.date} đã được duyệt.`;
    notificationsRef.child(schedule.employeeId).push({
      message,
      timestamp: Date.now(),
      type: "confirmation", // Thêm type
      date: schedule.date,
      isRead: false
    }).then(() => {
      console.log("Sent confirmation notification to employee:", schedule.employeeId, message);
    }).catch(err => {
      console.error("Lỗi gửi thông báo:", err);
    });

    renderCalendar();
    renderScheduleStatusList();
    renderScheduleApprovalList();
  }).catch(err => {
    console.error("Lỗi duyệt yêu cầu:", err);
    alert("Lỗi: " + err.message);
  });
}
// Sửa hàm denySchedule để cập nhật trạng thái denied
function denySchedule(key) {
  const schedule = scheduleData.find(s => s.id === key);
  if (!schedule) {
    console.error("Schedule not found for key:", key);
    alert("Không tìm thấy yêu cầu lịch!");
    return;
  }
  schedulesRef.child(key).update({ approvalStatus: "denied" }).then(() => {
    schedule.approvalStatus = "denied";
    console.log(`Đã từ chối yêu cầu ${schedule.status} cho ngày ${schedule.date}`);
    
    // Gửi thông báo xác nhận
    const statusText = schedule.status === "off" ? "Nghỉ" : schedule.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const message = `Yêu cầu ${statusText} ngày ${schedule.date} bị từ chối.`;
    notificationsRef.child(schedule.employeeId).push({
      message,
      timestamp: Date.now(),
      type: "confirmation",
      date: schedule.date,
      isRead: false
    }).then(() => {
      console.log("Sent confirmation notification to employee:", schedule.employeeId, message);
    }).catch(err => {
      console.error("Lỗi gửi thông báo:", err);
      alert("Lỗi khi gửi thông báo: " + err.message);
    });

    renderCalendar();
    renderScheduleStatusList();
    renderScheduleApprovalList();
  }).catch(err => {
    console.error("Lỗi từ chối yêu cầu:", err);
    alert("Lỗi khi từ chối yêu cầu: " + err.message);
  });
}

// Sửa hàm renderScheduleApprovalList để hiển thị tất cả trạng thái
function renderScheduleApprovalList() {
  const container = document.getElementById("work-requests");
  if (!container) {
    console.error("Work requests element not found!");
    return;
  }
  container.innerHTML = "";
  console.log("Rendering schedule approval list, total items:", scheduleData.length);

  if (scheduleData.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu lịch làm việc nào.</p>";
    return;
  }

  scheduleData.forEach(s => {
    const statusText = s.status === "off" ? "Nghỉ" : s.status === "overtime" ? "Tăng ca" : "Đổi ca";
    const approvalText = s.approvalStatus === "approved" ? "Đã duyệt" : s.approvalStatus === "denied" ? "Bị từ chối" : "Chờ duyệt";
    const div = document.createElement("div");
    div.innerHTML = `
      <strong>${s.employeeName}</strong>: ${statusText} - Ngày: ${s.date} - ${approvalText}
      ${approvalText === "Chờ duyệt" ? `
        <button onclick="approveSchedule('${s.id}')">Duyệt</button>
        <button onclick="denySchedule('${s.id}')">Từ chối</button>
      ` : ""}
      <hr>`;
    container.appendChild(div);
  });
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  } else {
    console.error(`Modal with ID ${modalId} not found!`);
  }
}