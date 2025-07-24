/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/

// Firebase References
const database = firebase.database();
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
let currentYear = new Date().getFullYear(); // Năm hiện tại
let isExpandedAdvance = false;
let isExpandedSchedule = false;
let notifications = [];
let generalNotifications = [];
let isExpandedNotifications = false;

// Tải dữ liệu thông báo
function loadNotifications() {
  if (!currentEmployeeId) {
    console.error("No current employee ID for loading notifications");
    return;
  }

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
    showToastNotifications();
  }, err => {
    console.error("Error fetching personal notifications:", err);
  });

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
    showGeneralNotificationModal();
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
    .slice(0, 5);

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
    }, index * 6000);
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
  }, 5000);
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
            loadNotifications();
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
          loadNotifications();
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

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) {
    console.error("Calendar element not found!");
    return;
  }

  const today = new Date();
  currentMonth = today.getMonth() + 1; // Tháng 7 (1-based)
  currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay() || 7;

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

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) {
    console.error("Advance history element not found!");
    return;
  }
  container.innerHTML = "";
  const myAdvances = advanceRequests
    .filter(a => a.employeeId === currentEmployeeId)
    .sort((a, b) => b.timestamp - a.timestamp);
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

function renderScheduleStatusList() {
  const container = document.getElementById("schedule-status-list");
  if (!container) {
    console.error("Schedule status list element not found!");
    return;
  }
  container.innerHTML = "";
  const schedules = scheduleData
    .filter(s => s.employeeId === currentEmployeeId)
    .sort((a, b) => b.timestamp - a.timestamp);
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
    renderRevenueExpenseSummary();
    renderReportProductList();
    renderRevenueExpenseData();
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
  const closingBalance = closingBalanceEl.value ? parseFloat(closingBalanceEl.value) : null;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (openingBalance === 0 && expenseAmount === 0 && revenue === 0 && closingBalance === null && Object.keys(productClickCounts).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin: số dư đầu kỳ, chi phí, doanh thu, số dư cuối kỳ, hoặc xuất hàng!");
    return;
  }

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
      closingBalance,
      remaining,
      products: productsReported
    };

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
        renderRevenueExpenseData();
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
      renderRevenueExpenseData();
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
      renderRevenueExpenseData();
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
      renderRevenueExpenseData();
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
      renderRevenueExpenseData();
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
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(singleDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = reportData.filter(r => {
        const reportDate = new Date(r.date).getTime();
        return reportDate >= start && reportDate < end;
      });
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

  const today = new Date().toISOString().split("T")[0];
  const displayDate = selectedDate || (startDate && endDate ? `${startDate} - ${endDate}` : today);

  if (filteredReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    return;
  }

  const sortedReports = filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));

  const financeReports = sortedReports.filter(r => 
    r.openingBalance !== 0 || r.revenue !== 0 || r.expenseAmount !== 0 || r.closingBalance !== null
  );

  let isExpandedFinance = false;
  let isExpandedProduct = false;

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

  renderFinanceTable();
  renderProductTable();

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

function renderRevenueExpenseData() {
  const reportTable = document.getElementById("shared-report-table");
  if (!reportTable) {
    console.error("Shared report table element not found!");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // 2025-07-24
  const displayDate = new Date(today).toLocaleDateString('vi-VN'); // "24/07/2025"

  const todayReports = reportData.filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  reportTable.innerHTML = `
    <h3>Bảng Báo cáo Thu Chi</h3>
    <table class="table-style">
      <thead>
        <tr><th>Ngày</th><th>Nhân viên</th><th>Doanh thu (VND)</th><th>Chi phí (VND)</th><th>Ghi chú</th></tr>
      </thead>
      <tbody>
        ${todayReports.length > 0
          ? todayReports.map(report => `
            <tr>
              <td>${new Date(report.date).toLocaleDateString('vi-VN')}</td>
              <td>${report.employeeName || "Không xác định"}</td>
              <td>${Number(report.revenue || 0).toLocaleString('vi-VN')}</td>
              <td>${Number(report.expenseAmount || 0).toLocaleString('vi-VN')}</td>
              <td>${report.expenseNote || ""}</td>
            </tr>
          `).join("")
          : `<tr><td colspan="5">Chưa có dữ liệu chi tiết cho ngày ${displayDate}.</td></tr>`}
      </tbody>
    </table>
  `;
  console.log(`Rendered revenue-expense data for ${today}, total reports: ${todayReports.length}`);
}

function renderRevenueExpenseSummary() {
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!summaryContainer) {
    console.error("Revenue-expense summary container not found!");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // 2025-07-24
  const displayDate = new Date(today).toLocaleDateString('vi-VN'); // "24/07/2025"

  const todayReports = reportData.filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  const sampleData = todayReports.length === 0 ? [{
    openingBalance: 860006,
    revenue: 2901003,
    expenseAmount: 340012,
    closingBalance: 500004,
    remaining: 2920993,
    employeeName: "Nhân viên mẫu",
    expenseNote: "Mua nguyên liệu"
  }] : todayReports;

  const totalOpeningBalance = sampleData.reduce((sum, report) => sum + (Number(report.openingBalance) || 0), 0);
  const totalRevenue = sampleData.reduce((sum, report) => sum + (Number(report.revenue) || 0), 0);
  const totalExpense = sampleData.reduce((sum, report) => sum + (Number(report.expenseAmount) || 0), 0);
  const totalClosingBalance = sampleData.reduce((sum, report) => sum + (Number(report.closingBalance) || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString('vi-VN')} VND</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString('vi-VN')} VND</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString('vi-VN')} VND</p>
  `;
  console.log(`Rendered revenue-expense summary for ${today}, total reports: ${todayReports.length}`);
}

function renderBusinessReport() {
  const reportTable = document.getElementById("shared-report-table");
  if (!reportTable) {
    console.error("Shared report table element not found!");
    return;
  }

  if (!reportData || reportData.length === 0) {
    reportTable.innerHTML = "<p>Chưa có dữ liệu thu chi.</p>";
    console.warn("No report data available to render business report. reportData:", reportData);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date(today).toLocaleDateString('vi-VN');

  const sortedReports = reportData
    .map(report => ({
      ...report,
      date: new Date(report.date).toISOString().split("T")[0]
    }))
    .filter(report => report.date === today);

  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const totalProfit = totalRevenue - totalExpense;

  document.getElementById("total-revenue").textContent = totalRevenue.toLocaleString();
  document.getElementById("total-expense").textContent = totalExpense.toLocaleString();
  document.getElementById("total-profit").textContent = totalProfit.toLocaleString();

  const expenseCategories = {};
  sortedReports.forEach(report => {
    if (report.expenseNotes && report.expenseAmount) {
      const note = report.expenseNotes.toLowerCase().trim();
      let category = "Khác";
      if (note.includes("cam")) category = "Mua cam";
      else if (note.includes("xăng") || note.includes("xang")) category = "Mua xăng";
      else if (note.includes("trái cây") || note.includes("trai cay")) category = "Trái cây";
      expenseCategories[category] = (expenseCategories[category] || 0) + Number(report.expenseAmount);
    }
  });

  const expenseCategorySummary = document.getElementById("expense-category-summary");
  expenseCategorySummary.innerHTML = `
    <table>
      <tr><th>Danh mục</th><th>Số tiền (VND)</th></tr>
      <tr><td>Tổng doanh thu</td><td>${totalRevenue.toLocaleString()}</td></tr>
      ${Object.keys(expenseCategories).length > 0
        ? Object.entries(expenseCategories)
            .map(([category, amount]) => `<tr><td>${category}</td><td>${amount.toLocaleString()}</td></tr>`)
            .join("")
        : "<tr><td colspan='2'>Chưa có chi phí nào.</td></tr>"}
      <tr><td><strong>Tổng chi phí</strong></td><td><strong>${totalExpense.toLocaleString()}</strong></td></tr>
      <tr><td><strong>Số tiền còn lại</strong></td><td><strong>${totalProfit.toLocaleString()}</strong></td></tr>
    </table>
  `;

  const inventoryOutValue = sortedReports
    .filter(report => report.products)
    .reduce((sum, report) => {
      return (
        sum +
        Object.values(report.products).reduce((subSum, product) => {
          return subSum + (Number(product.quantity) * Number(product.price || 0));
        }, 0)
      );
    }, 0);
  const expenseMinusInventory = totalExpense - inventoryOutValue;

  document.getElementById("expense-minus-inventory").innerHTML = `
    <div>
      <p>Tổng chi phí: ${totalExpense.toLocaleString()} VND</p>
      <p>Giá trị hàng xuất kho: ${inventoryOutValue.toLocaleString()} VND</p>
      <p>Số tiền sau trừ hàng xuất: ${expenseMinusInventory.toLocaleString()} VND</p>
    </div>
  `;

  const expenseTable = document.getElementById("expense-summary-table");
  expenseTable.innerHTML = `
    <table>
      <tr><th>Ngày</th><th>Nhân viên</th><th>Chi phí (VND)</th><th>Ghi chú</th></tr>
      ${sortedReports
        .filter(report => Number(report.expenseAmount) > 0)
        .map(report => `
          <tr>
            <td>${new Date(report.date).toLocaleDateString()}</td>
            <td>${report.employeeName || "Không xác định"}</td>
            <td>${Number(report.expenseAmount).toLocaleString()}</td>
            <td>${report.expenseNotes || ""}</td>
          </tr>
        `)
        .join("") || "<tr><td colspan='4'>Chưa có chi phí nào.</td></tr>"}
    </table>
  `;

  generateBusinessChart(sortedReports);
}

function filterBusinessReports() {
  if (!reportData || reportData.length === 0) {
    renderBusinessReport([]);
    console.warn("No report data available to filter. reportData:", reportData);
    return;
  }

  const startDate = document.getElementById("start-date").value || "2025-07-23";
  const endDate = document.getElementById("end-date").value || "2025-07-23";
  const filterType = document.getElementById("filter-type").value || "today";

  const normalizeDate = (dateStr) => {
    const date = new Date(dateStr);
    if (!isNaN(date)) return date.toISOString().split("T")[0];
    if (typeof dateStr === "string") {
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
      if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) return dateStr.replace(/\//g, "-");
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = dateStr.split("/");
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  };

  const normalizedReports = reportData.map(report => ({
    ...report,
    date: normalizeDate(report.date) || report.date
  }));

  let filteredReports = normalizedReports;
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (filterType === "today") {
    filteredReports = normalizedReports.filter(report => {
      if (!report.date) return false;
      return report.date === "2025-07-24";
    });
  } else if (start && end) {
    filteredReports = normalizedReports.filter(report => {
      if (!report.date) return false;
      const reportDate = new Date(report.date);
      return reportDate >= start && reportDate <= end;
    });
  } else if (filterType !== "all") {
    const now = new Date("2025-07-24");
    let startFilter;
    if (filterType === "week") {
      startFilter = new Date(now.setDate(now.getDate() - 7));
    } else if (filterType === "month") {
      startFilter = new Date(now.setMonth(now.getMonth() - 1));
    } else if (filterType === "quarter") {
      startFilter = new Date(now.setMonth(now.getMonth() - 3));
    }
    filteredReports = normalizedReports.filter(report => {
      if (!report.date) return false;
      return new Date(report.date) >= startFilter;
    });
  }

  if (filteredReports.length === 0) {
    console.warn("No reports found for filter:", { startDate, endDate, filterType, normalizedReports });
  }
  renderBusinessReport(filteredReports);
}

function renderRevenueExpenseData() {
  const reportTable = document.getElementById("shared-report-table");
  if (!reportTable) {
    console.error("Shared report table element not found!");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // 2025-07-24
  const displayDate = new Date(today).toLocaleDateString('vi-VN'); // "24/07/2025"

  const todayReports = reportData.filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  reportTable.innerHTML = `
    <h3>Bảng Báo cáo Thu Chi</h3>
    <table class="table-style">
      <thead>
        <tr><th>Ngày</th><th>Nhân viên</th><th>Doanh thu (VND)</th><th>Chi phí (VND)</th><th>Ghi chú</th></tr>
      </thead>
      <tbody>
        ${todayReports.length > 0
          ? todayReports.map(report => `
            <tr>
              <td>${new Date(report.date).toLocaleDateString('vi-VN')}</td>
              <td>${report.employeeName || "Không xác định"}</td              <td>${Number(report.revenue || 0).toLocaleString('vi-VN')}</td>
              <td>${Number(report.expenseAmount || 0).toLocaleString('vi-VN')}</td>
              <td>${report.expenseNote || ""}</td>
            </tr>
          `).join("")
          : `<tr><td colspan="5">Chưa có dữ liệu chi tiết cho ngày ${displayDate}.</td></tr>`}
      </tbody>
    </table>
  `;
  console.log(`Rendered revenue-expense data for ${today}, total reports: ${todayReports.length}`);
}

function renderRevenueExpenseSummary() {
  const summaryContainer = document.getElementById("revenue-expense-summary");
  if (!summaryContainer) {
    console.error("Revenue-expense summary container not found!");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // 2025-07-24
  const displayDate = new Date(today).toLocaleDateString('vi-VN'); // "24/07/2025"

  const todayReports = reportData.filter(report => {
    const reportDate = new Date(report.date).toISOString().split("T")[0];
    return reportDate === today;
  });

  const sampleData = todayReports.length === 0 ? [{
    openingBalance: 860006,
    revenue: 2901003,
    expenseAmount: 340012,
    closingBalance: 500004,
    remaining: 2920993,
    employeeName: "Nhân viên mẫu",
    expenseNote: "Mua nguyên liệu"
  }] : todayReports;

  const totalOpeningBalance = sampleData.reduce((sum, report) => sum + (Number(report.openingBalance) || 0), 0);
  const totalRevenue = sampleData.reduce((sum, report) => sum + (Number(report.revenue) || 0), 0);
  const totalExpense = sampleData.reduce((sum, report) => sum + (Number(report.expenseAmount) || 0), 0);
  const totalClosingBalance = sampleData.reduce((sum, report) => sum + (Number(report.closingBalance) || 0), 0);
  const totalRemaining = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  summaryContainer.innerHTML = `
    <h3>Tóm tắt Thu Chi (${displayDate}):</h3>
    <p><strong>Số dư đầu kỳ:</strong> ${totalOpeningBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Doanh thu:</strong> ${totalRevenue.toLocaleString('vi-VN')} VND</p>
    <p><strong>Chi phí:</strong> ${totalExpense.toLocaleString('vi-VN')} VND</p>
    <p><strong>Số dư cuối kỳ:</strong> ${totalClosingBalance.toLocaleString('vi-VN')} VND</p>
    <p><strong>Còn lại:</strong> ${totalRemaining.toLocaleString('vi-VN')} VND</p>
  `;
  console.log(`Rendered revenue-expense summary for ${today}, total reports: ${todayReports.length}`);
}

// Business Report
function generateBusinessChart(reports = []) {
  const ctx = document.getElementById('growth-chart').getContext('2d');
  if (!window.myChart) {
    window.myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: reports.map(r => new Date(r.date).toLocaleDateString('vi-VN')),
        datasets: [{
          label: 'Doanh thu',
          data: reports.map(r => r.revenue || 0),
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true
        }, {
          label: 'Chi phí',
          data: reports.map(r => r.expenseAmount || 0),
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } else {
    window.myChart.data.labels = reports.map(r => new Date(r.date).toLocaleDateString('vi-VN'));
    window.myChart.data.datasets[0].data = reports.map(r => r.revenue || 0);
    window.myChart.data.datasets[1].data = reports.map(r => r.expenseAmount || 0);
    window.myChart.update();
  }
  console.log("Generated business chart with", reports.length, "data points");
}

function exportReportsToCSV() {
  const csv = [];
  const headers = ["Ngày", "Nhân viên", "Doanh thu (VND)", "Chi phí (VND)", "Ghi chú"];
  csv.push(headers.join(","));

  reportData.forEach(report => {
    const row = [
      new Date(report.date).toLocaleDateString('vi-VN'),
      report.employeeName || "Không xác định",
      (report.revenue || 0).toLocaleString('vi-VN'),
      (report.expenseAmount || 0).toLocaleString('vi-VN'),
      report.expenseNote || ""
    ];
    csv.push(row.join(","));
  });

  const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "baocao_thuchi.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  console.log("Exported reports to CSV");
}

// Inventory Management
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  if (!name || quantity <= 0 || price < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newProduct = {
    id: Date.now().toString(),
    name,
    quantity,
    price,
    timestamp: new Date().toISOString()
  };

  inventoryRef.child(newProduct.id).set(newProduct)
    .then(() => {
      inventoryData.push(newProduct);
      alert("Thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
      renderInventory();
    })
    .catch(err => alert("Lỗi khi thêm sản phẩm: " + err.message));
}

function renderInventory() {
  const container = document.getElementById("inventory-list");
  if (!container) {
    console.error("Inventory list element not found!");
    return;
  }
  container.innerHTML = "";
  if (inventoryData.length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  inventoryData.forEach(item => {
    const div = document.createElement("div");
    div.innerHTML = `${item.name}: ${item.quantity} - ${item.price.toLocaleString('vi-VN')} VND <button onclick="deleteInventory('${item.id}')">Xóa</button>`;
    container.appendChild(div);
  });
}

function deleteInventory(productId) {
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef.child(productId).remove()
    .then(() => {
      inventoryData = inventoryData.filter(item => item.id !== productId);
      renderInventory();
      alert("Xóa sản phẩm thành công!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

// Employee Management
function addEmployee() {
  const name = document.getElementById("manage-employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  if (!name || dailyWage < 0 || allowance < 0 || otherFee < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newEmployee = {
    id: Date.now().toString(),
    name,
    dailyWage,
    allowance,
    otherFee,
    active: true,
    role: "employee",
    workdays: 26,
    offdays: 0,
    address: "",
    phone: "",
    note: "",
    createdAt: new Date().toISOString()
  };

  employeesRef.child(newEmployee.id).set(newEmployee)
    .then(() => {
      employeeData.push(newEmployee);
      alert("Thêm nhân viên thành công!");
      document.getElementById("manage-employee-name").value = "";
      document.getElementById("employee-dailywage").value = "";
      document.getElementById("employee-allowance").value = "";
      document.getElementById("employee-otherfee").value = "";
      renderEmployeeList();
    })
    .catch(err => alert("Lỗi khi thêm nhân viên: " + err.message));
}

function renderEmployeeList() {
  const container = document.getElementById("employee-list");
  if (!container) {
    console.error("Employee list element not found!");
    return;
  }
  container.innerHTML = "";
  if (employeeData.length === 0) {
    container.innerHTML = "<p>Chưa có nhân viên.</p>";
    return;
  }
  employeeData.forEach(emp => {
    const div = document.createElement("div");
    div.innerHTML = `${emp.name} - Lương ngày: ${emp.dailyWage.toLocaleString('vi-VN')} VND <button onclick="deleteEmployee('${emp.id}')">Xóa</button>`;
    container.appendChild(div);
  });
}

function deleteEmployee(employeeId) {
  if (!confirm("Xóa nhân viên này?")) return;
  employeesRef.child(employeeId).remove()
    .then(() => {
      employeeData = employeeData.filter(emp => emp.id !== employeeId);
      renderEmployeeList();
      alert("Xóa nhân viên thành công!");
    })
    .catch(err => alert("Lỗi khi xóa nhân viên: " + err.message));
}

function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) {
    console.error("Advance approval list element not found!");
    return;
  }
  container.innerHTML = "";
  const pendingAdvances = advanceRequests.filter(a => a.status === "pending");
  if (pendingAdvances.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu tạm ứng nào.</p>";
    return;
  }
  pendingAdvances.forEach(a => {
    const div = document.createElement("div");
    div.innerHTML = `${a.employeeName}: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason} <button onclick="approveAdvance('${a.id}')">Duyệt</button> <button onclick="denyAdvance('${a.id}')">Từ chối</button>`;
    container.appendChild(div);
  });
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

  const employee = employeeData.find(e => e.id === user.uid);
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

  advancesRef.child(advanceData.id).set(advanceData)
    .then(() => {
      advanceRequests.push(advanceData);
      alert("Gửi yêu cầu tạm ứng thành công!");
      document.getElementById("advance-amount").value = "";
      document.getElementById("advance-reason").value = "";
      renderAdvanceHistory();
      renderAdvanceApprovalList();
    })
    .catch(err => alert("Lỗi khi gửi yêu cầu tạm ứng: " + err.message));
}

function approveAdvance(advanceId) {
  if (!confirm("Duyệt yêu cầu tạm ứng này?")) return;
  advancesRef.child(advanceId).update({ status: "approved" })
    .then(() => {
      const advance = advanceRequests.find(a => a.id === advanceId);
      if (advance) advance.status = "approved";
      renderAdvanceApprovalList();
      alert("Đã duyệt yêu cầu tạm ứng!");
    })
    .catch(err => alert("Lỗi khi duyệt yêu cầu: " + err.message));
}

function denyAdvance(advanceId) {
  if (!confirm("Từ chối yêu cầu tạm ứng này?")) return;
  advancesRef.child(advanceId).update({ status: "denied" })
    .then(() => {
      const advance = advanceRequests.find(a => a.id === advanceId);
      if (advance) advance.status = "denied";
      renderAdvanceApprovalList();
      alert("Đã từ chối yêu cầu tạm ứng!");
    })
    .catch(err => alert("Lỗi khi từ chối yêu cầu: " + err.message));
}

// Chat
function renderChat(type) {
  const container = document.getElementById(`${type}-chat`);
  if (!container) {
    console.error(`${type}-chat element not found!`);
    return;
  }
  container.innerHTML = "";
  const chatMessages = messages[type] || [];
  chatMessages.forEach(msg => {
    const div = document.createElement("div");
    div.innerHTML = `${msg.senderName}: ${msg.message} - ${new Date(msg.timestamp).toLocaleTimeString()}`;
    container.appendChild(div);
  });
}

function sendGroupMessage() {
  const message = document.getElementById("group-message").value.trim();
  if (!message) {
    alert("Vui lòng nhập tin nhắn!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi tin nhắn!");
    return;
  }

  const employee = employeeData.find(e => e.id === user.uid);
  const senderName = employee ? employee.name : (user.displayName || user.email.split('@')[0] || 'Nhân viên');

  const msgData = {
    message,
    senderId: user.uid,
    senderName,
    timestamp: Date.now()
  };

  messagesRef.child("group").push(msgData)
    .then(() => {
      messages.group.push(msgData);
      document.getElementById("group-message").value = "";
      renderChat("group");
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}

function sendManagerMessage() {
  const message = document.getElementById("manager-message").value.trim();
  if (!message) {
    alert("Vui lòng nhập tin nhắn!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để gửi tin nhắn!");
    return;
  }

  const employee = employeeData.find(e => e.id === user.uid);
  const senderName = employee ? employee.name : (user.displayName || user.email.split('@')[0] || 'Nhân viên');

  const msgData = {
    message,
    senderId: user.uid,
    senderName,
    timestamp: Date.now()
  };

  messagesRef.child("manager").push(msgData)
    .then(() => {
      messages.manager.push(msgData);
      document.getElementById("manager-message").value = "";
      renderChat("manager");
    })
    .catch(err => alert("Lỗi khi gửi tin nhắn: " + err.message));
}

// Load Firebase Data
function loadFirebaseData() {
  return Promise.all([
    inventoryRef.once("value").then(snapshot => {
      inventoryData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded inventory data:", inventoryData.length, "items");
    }),
    reportsRef.once("value").then(snapshot => {
      reportData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded report data:", reportData.length, "reports");
    }),
    employeesRef.once("value").then(snapshot => {
      employeeData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded employee data:", employeeData.length, "employees");
    }),
    advancesRef.once("value").then(snapshot => {
      advanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded advance requests:", advanceRequests.length, "requests");
    }),
    messagesRef.child("group").on("value", snapshot => {
      messages.group = snapshot.val() ? Object.values(snapshot.val()) : [];
      renderChat("group");
    }),
    messagesRef.child("manager").on("value", snapshot => {
      messages.manager = snapshot.val() ? Object.values(snapshot.val()) : [];
      renderChat("manager");
    }),
    schedulesRef.on("value", snapshot => {
      scheduleData = snapshot.val() ? Object.values(snapshot.val()) : [];
      renderScheduleApprovalList();
      renderScheduleStatusList();
    })
  ]).catch(err => console.error("Error loading Firebase data:", err));
}

// Utility Functions
function showActionModal(date) {
  const modal = document.getElementById("action-modal");
  const modalContent = document.getElementById("action-modal-content");
  if (!modal || !modalContent) {
    console.error("Action modal or content not found!");
    return;
  }

  modalContent.innerHTML = `
    <h3>Chọn hành động cho ngày ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    <button onclick="submitScheduleRequest('${date}', 'off')">Nghỉ</button>
    <button onclick="submitScheduleRequest('${date}', 'overtime')">Tăng ca</button>
    <button onclick="submitScheduleRequest('${date}', 'swap')">Đổi ca</button>
    <button onclick="closeModal('action-modal')">Hủy</button>
  `;
  modal.style.display = "block";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

function approveSchedule(scheduleId) {
  if (!confirm("Duyệt lịch làm việc này?")) return;
  schedulesRef.child(scheduleId).update({ approvalStatus: "approved" })
    .then(() => {
      const schedule = scheduleData.find(s => s.id === scheduleId);
      if (schedule) schedule.approvalStatus = "approved";
      renderScheduleApprovalList();
      renderScheduleStatusList();
      renderSalarySummary();
      alert("Đã duyệt lịch làm việc!");
    })
    .catch(err => alert("Lỗi khi duyệt lịch: " + err.message));
}

function denySchedule(scheduleId) {
  if (!confirm("Từ chối lịch làm việc này?")) return;
  schedulesRef.child(scheduleId).update({ approvalStatus: "denied" })
    .then(() => {
      const schedule = scheduleData.find(s => s.id === scheduleId);
      if (schedule) schedule.approvalStatus = "denied";
      renderScheduleApprovalList();
      renderScheduleStatusList();
      renderSalarySummary();
      alert("Đã từ chối lịch làm việc!");
    })
    .catch(err => alert("Lỗi khi từ chối lịch: " + err.message));
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) {
    console.error("Salary summary element not found!");
    return;
  }
  const employee = employeeData.find(e => e.id === currentEmployeeId);
  if (!employee) {
    container.innerHTML = "<p>Không tìm thấy thông tin nhân viên.</p>";
    return;
  }

  const approvedSchedules = scheduleData.filter(s => 
    s.employeeId === currentEmployeeId && s.approvalStatus === "approved"
  );
  const workdays = approvedSchedules.filter(s => s.status === "overtime").length;
  const offdays = approvedSchedules.filter(s => s.status === "off").length;
  const regularDays = employee.workdays - offdays;

  const baseSalary = regularDays * employee.dailyWage;
  const overtimePay = workdays * (employee.dailyWage * 1.5); // Tăng ca tính 1.5 lần lương ngày
  const totalSalary = baseSalary + overtimePay + employee.allowance - employee.otherFee;

  container.innerHTML = `
    <h3>Tổng lương tháng ${currentMonth}/${currentYear}</h3>
    <p>Lương cơ bản: ${baseSalary.toLocaleString('vi-VN')} VND</p>
    <p>Tiền tăng ca: ${overtimePay.toLocaleString('vi-VN')} VND</p>
    <p>Phụ cấp: ${employee.allowance.toLocaleString('vi-VN')} VND</p>
    <p>Phí khác: ${employee.otherFee.toLocaleString('vi-VN')} VND</p>
    <p><strong>Tổng lương: ${totalSalary.toLocaleString('vi-VN')} VND</strong></p>
  `;
  console.log("Rendered salary summary for employee:", currentEmployeeId);
}

// Initialize
loadFirebaseData().then(() => {
  console.log("Firebase data loaded, initializing app...");
  if (auth.currentUser) {
    loadEmployeeInfo();
    renderCalendar();
    renderScheduleStatusList();
    loadNotifications();
  }
});