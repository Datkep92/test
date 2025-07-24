// File: js/common.js
// Firebase References
const db = firebase.database();
const auth = firebase.auth();
let currentEmployeeId = null;

// Common Variables
let globalInventoryData = [];
let globalReportData = [];
let globalEmployeeData = [];
let globalAdvanceRequests = [];
let globalMessages = { group: [], manager: [] };
let globalScheduleData = [];
let globalNotifications = [];
let globalGeneralNotifications = [];
let isExpandedStates = {
  filteredReports: false,
  revenueExpenseData: false,
  advanceHistory: false,
  inventoryList: false
};

// File: js/common.js

// ... (giữ nguyên các phần khác của common.js) ...

function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentEmployeeId = user.uid;
      loadFirebaseData(() => {
        loadEmployeeInfo();
        // Load lại tất cả tab khi vào trang
        renderReportProductList();
        renderRevenueExpenseData();
        renderRevenueExpenseSummary();
        renderInventory();
        renderAdvanceHistory();
        renderScheduleStatusList();
        renderCalendar();
        renderBusinessReport(globalReportData);
        renderEmployeeList();
        renderSchedule();
        renderAllSchedule();
        renderEmployeeDetails();
        renderAdvanceApprovalList();
        renderGeneralNotifications();
        renderEmployeeChat(currentEmployeeId);
        renderChat("group");
        renderChat("manager");
        renderNotifications(); // Thay loadNotifications bằng renderNotifications
        renderFilteredReports(getReportData());
        // Mở tab mặc định
        openTabBubble('revenue-expense');
      });
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
    } else {
      currentEmployeeId = null;
      globalInventoryData = [];
      globalReportData = [];
      globalEmployeeData = [];
      globalAdvanceRequests = [];
      globalMessages = { group: [], manager: [] };
      globalScheduleData = [];
      globalNotifications = [];
      globalGeneralNotifications = [];
      // Làm trống các container khi đăng xuất
      renderReportProductList();
      renderRevenueExpenseData();
      renderRevenueExpenseSummary();
      renderInventory();
      renderAdvanceHistory();
      renderScheduleStatusList();
      renderCalendar();
      renderBusinessReport([]);
      renderEmployeeList();
      renderSchedule();
      renderAllSchedule();
      renderEmployeeDetails();
      renderAdvanceApprovalList();
      renderGeneralNotifications();
      renderEmployeeChat(null);
      renderChat("group");
      renderChat("manager");
      renderNotifications(); // Thay loadNotifications bằng renderNotifications
      renderFilteredReports([]);
      document.getElementById("login-page").style.display = "flex";
      document.getElementById("main-page").style.display = "none";
    }
  });
}

function loadFirebaseData(callback) {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentEmployeeId = user.uid;
      Promise.all([
        db.ref("inventory").on("value", snapshot => {
          globalInventoryData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
          console.log("Loaded inventory data:", globalInventoryData);
          renderInventory();
          renderReportProductList();
          globalInventoryData.forEach(item => checkLowStock(item));
        }),
        db.ref("reports").on("value", snapshot => {
          globalReportData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
          console.log("Loaded report data:", globalReportData);
          renderBusinessReport(globalReportData);
          renderFilteredReports(getReportData());
        }),
        db.ref("employees").on("value", snapshot => {
  const employees = snapshot.val() || {};
  globalEmployeeData = Object.keys(employees).map(id => ({
    id,
    dailyWage: employees[id].dailyWage != null ? employees[id].dailyWage : 0,
    allowance: employees[id].allowance != null ? employees[id].allowance : 0,
    otherFee: employees[id].otherFee != null ? employees[id].otherFee : 0,
    ...employees[id]
  }));
  console.log("Loaded employee data:", globalEmployeeData);
  renderEmployeeList();
  renderSchedule();
  renderAllSchedule();
  renderEmployeeDetails();
}),
        db.ref("advances").on("value", snapshot => {
          globalAdvanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
          console.log("Loaded advance requests:", globalAdvanceRequests);
          renderAdvanceHistory();
          renderAdvanceApprovalList();
          renderEmployeeDetails();
        }),
        db.ref("messages/group").on("value", snapshot => {
          globalMessages.group = snapshot.val() ? Object.values(snapshot.val()) : [];
          console.log("Loaded group messages:", globalMessages.group);
          renderChat("group");
        }),
        db.ref("messages/manager").on("value", snapshot => {
          globalMessages.manager = snapshot.val() ? Object.values(snapshot.val()) : [];
          console.log("Loaded manager messages:", globalMessages.manager);
          renderChat("manager");
        }),
        db.ref("schedules").on("value", snapshot => {
          globalScheduleData = snapshot.val() ? Object.keys(snapshot.val()).map(key => ({
            id: key,
            ...snapshot.val()[key]
          })) : [];
          console.log("Loaded schedule data:", globalScheduleData);
          renderSchedule();
          renderAllSchedule();
          renderScheduleStatusList();
          renderOffAndOvertime();
          renderCalendar();
          renderSalarySummary();
          renderEmployeeDetails();
        }),
        db.ref("notifications/" + currentEmployeeId).on("value", snapshot => {
          globalNotifications = snapshot.val() ? Object.values(snapshot.val()).map(n => ({ id: n.id || snapshot.key, ...n })) : [];
          console.log("Loaded notifications:", globalNotifications);
          renderNotifications();
        }),
        db.ref("notifications/general").on("value", snapshot => {
          globalGeneralNotifications = snapshot.val() ? Object.values(snapshot.val()) : [];
          console.log("Loaded general notifications:", globalGeneralNotifications);
          renderNotifications();
        }),
        db.ref("messages/" + currentEmployeeId).on("value", snapshot => {
          globalMessages[currentEmployeeId] = snapshot.val() ? Object.values(snapshot.val()) : [];
          console.log("Loaded messages for employee:", globalMessages[currentEmployeeId]);
          renderEmployeeChat(currentEmployeeId);
        })
      ]).then(() => {
        if (callback) callback();
      }).catch(err => console.error("Error loading Firebase data:", err));
    } else {
      currentEmployeeId = null;
      globalInventoryData = [];
      globalReportData = [];
      globalEmployeeData = [];
      globalAdvanceRequests = [];
      globalMessages = { group: [], manager: [] };
      globalScheduleData = [];
      globalNotifications = [];
      globalGeneralNotifications = [];
      renderProfile();
      renderEmployeeList();
      renderSchedule();
      renderAllSchedule();
      renderEmployeeDetails();
      renderAdvanceApprovalList();
      renderGeneralNotifications();
      renderEmployeeChat(null);
      renderReportProductList();
      renderRevenueExpenseData();
      renderRevenueExpenseSummary();
      renderInventory();
      renderAdvanceHistory();
      renderScheduleStatusList();
      renderCalendar();
      renderBusinessReport([]);
      renderChat("group");
      renderChat("manager");
      renderNotifications(); // Thay loadNotifications bằng renderNotifications
      renderFilteredReports([]);
    }
  });
}

// Thêm hàm renderNotifications
function renderNotifications() {
  const container = document.getElementById("notification-list");
  if (!container) {
    console.warn("Container 'notification-list' không tồn tại trong DOM.");
    return;
  }
  container.innerHTML = "";
  
  // Kết hợp thông báo cá nhân và thông báo chung
  const allNotifications = [
    ...globalNotifications.map(n => ({ ...n, type: 'personal' })),
    ...globalGeneralNotifications.map(n => ({ ...n, type: 'general' }))
  ].sort((a, b) => b.timestamp - a.timestamp); // Sắp xếp theo thời gian giảm dần

  if (allNotifications.length === 0) {
    container.innerHTML = "<p>Chưa có thông báo nào.</p>";
    return;
  }

  allNotifications.forEach(notification => {
    const div = document.createElement("div");
    div.className = `notification ${notification.isRead ? 'read' : 'unread'}`;
    div.innerHTML = `
      <p>${notification.message} - ${new Date(notification.timestamp).toLocaleString('vi-VN')}</p>
      ${notification.type === 'personal' && !notification.isRead ? 
        `<button onclick="markNotificationAsRead('${notification.id}', '${currentEmployeeId}')">Đã đọc</button>` : ''}
    `;
    container.appendChild(div);
  });
}

// Thêm hàm để đánh dấu thông báo là đã đọc
function markNotificationAsRead(notificationId, employeeId) {
  db.ref(`notifications/${employeeId}/${notificationId}`).update({
    isRead: true,
    updatedAt: new Date().toISOString()
  })
    .then(() => {
      globalNotifications = globalNotifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      renderNotifications();
    })
    .catch(err => alert("Lỗi khi đánh dấu thông báo: " + err.message));
}

// ... (giữ nguyên các hàm khác trong common.js) ...

function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    alert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }
  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      loadFirebaseData();
    })
    .catch(err => alert("Lỗi đăng nhập: " + err.message));
}

function logout() {
  auth.signOut().then(() => {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }).catch(err => alert("Lỗi đăng xuất: " + err.message));
}

function toggleMenu() {
  const options = document.getElementById('float-options');
  options.style.display = (options.style.display === 'flex') ? 'none' : 'flex';
}

function openTabBubble(tabId) {
  const tabs = document.querySelectorAll('.tabcontent');
  tabs.forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  toggleMenu();
  if (tabId === 'revenue-expense') {
    renderReportProductList();
    renderRevenueExpenseData();
    renderFilteredReports(getReportData());
  } else if (tabId === 'profile') {
    renderProfile();
    renderAllSchedule();
  } else if (tabId === 'employee') {
    renderEmployeeList();
    renderSchedule();
    renderEmployeeDetails();
    renderAdvanceApprovalList();
    renderGeneralNotifications();
    renderEmployeeChat(currentEmployeeId);
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

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function loadEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) return;
  db.ref(`employees/${user.uid}`).once("value").then(snapshot => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("personal-employee-name").value = data.name || "";
      document.getElementById("employee-address").value = data.address || "";
      document.getElementById("employee-phone").value = data.phone || "";
      document.getElementById("employee-note").value = data.note || "";
    }
  }).catch(err => console.error("Lỗi khi load thông tin nhân viên:", err));
}

function parseEntry(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { money: 0, note: "", error: false };
  }
  const match = text.match(/([\d.,]+)\s*(k|nghìn|tr|triệu)?/i);
  if (!match) {
    return { money: 0, note: text.trim(), error: false };
  }
  let num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num) || num <= 0) {
    return { money: 0, note: text.trim(), error: false };
  }
  const unit = match[2] ? match[2].toLowerCase() : '';
  if (unit.includes('tr')) {
    num *= 1000000;
  } else if (unit.includes('k') || unit.includes('nghìn')) {
    num *= 1000;
  }
  return { money: Math.round(num), note: text.replace(match[0], '').trim(), error: false };
}

function getInventoryData() { return globalInventoryData; }
function getReportData() { return globalReportData; }
function getEmployeeData() { return globalEmployeeData; }
function getAdvanceRequests() { return globalAdvanceRequests; }
function getMessages() { return globalMessages; }
function getScheduleData() { return globalScheduleData; }
function getNotifications() { return globalNotifications; }
function getGeneralNotifications() { return globalGeneralNotifications; }

initApp();