
let currentEmployeeId = null;
// File: js/employee-management.js

// Firebase References
const db = firebase.database();
const auth = firebase.auth();

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
        //renderRevenueExpenseSummary();
        renderInventory();
        renderAdvanceHistory();
        renderScheduleStatusList();
        renderCalendar();
        renderBusinessReport(globalReportData);
        renderEmployeeList();
        renderSchedule();
        //renderAllSchedule();
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
      //renderAllSchedule();
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
let isEmployeeDataLoaded = false;

function loadFirebaseData(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      console.log("User not logged in");
      return;
    }

    const userId = user.uid;
    globalEmployeeData = [];

    db.ref("users").once("value").then(snapshot => {
      globalEmployeeData = [];
      snapshot.forEach(child => {
        globalEmployeeData.push({ id: child.key, ...child.val() });
      });

      // ✅ Tạm thời tự thêm người dùng hiện tại nếu chưa có
      const found = globalEmployeeData.find(e => e.id === userId);
      if (!found) {
        globalEmployeeData.push({
          id: userId,
          name: user.displayName || "Chưa rõ tên",
          email: user.email || "",
          role: "employee",
          active: true
        });
        console.warn("⚠️ Đã ép thêm người dùng hiện tại vào danh sách nhân viên.");
      }

      console.log("✅ Loaded employee data:", globalEmployeeData);
      isEmployeeDataLoaded = true;
      renderEmployeeList();

      // 🔁 Gọi callback sau khi dữ liệu nhân viên đã sẵn sàng
      if (typeof callback === "function") callback();
    }).catch(err => {
      console.error("❌ Error loading users:", err.message);
    });

    // Các phần khác vẫn có thể load độc lập (không chờ callback)
    db.ref("inventory").once("value").then(snapshot => {
      globalInventoryData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderInventory === "function") renderInventory();
    });

    db.ref("advanceRequests").once("value").then(snapshot => {
      globalAdvanceData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderAdvanceHistory === "function") renderAdvanceHistory();
    });

    db.ref("schedules").once("value").then(snapshot => {
      globalScheduleData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
    });

    db.ref("reports").once("value").then(snapshot => {
      globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderFilteredReports === "function") renderFilteredReports(globalReportData);
    });
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
  const loginBtn = document.getElementById("login-btn");
  
  if (!email || !password) {
    alert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }
  
  // Hiệu ứng loading
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      loadFirebaseData();
    })
    .catch(err => {
      alert("Lỗi đăng nhập: " + err.message);
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    });
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
    //renderAllSchedule();
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
  db.ref(`users/${user.uid}`).once("value").then(snapshot => {
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
//
function sendNotification(recipient, message) {
  const notification = {
    id: 'notif-' + Math.random().toString(36).substr(2, 9),
    recipient: recipient,
    message: message,
    timestamp: new Date().toISOString(),
    read: false
  };
  if (recipient === 'manager') {
    globalMessages.manager.push(notification);
    firebase.database().ref('messages/manager/' + notification.id).set(notification);
  } else {
    globalMessages[recipient] = globalMessages[recipient] || [];
    globalMessages[recipient].push(notification);
    firebase.database().ref(`messages/employees/${recipient}/` + notification.id).set(notification);
  }
}
initApp();
