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

// Common Functions
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentEmployeeId = user.uid;
      loadFirebaseData(() => {
        loadEmployeeInfo();
        // Load lại tất cả tab khi vào trang
        renderRevenueExpenseData();
        renderRevenueExpenseSummary();
        renderInventory();
        renderAdvanceHistory();
        renderScheduleStatusList();
        renderCalendar();
        renderBusinessReport(globalReportData); // Hiển thị tổng tiền trong báo cáo kinh doanh
        renderEmployeeList();
        renderAdvanceApprovalList();
        renderScheduleApprovalList();
        renderChat("group");
        renderChat("manager");
        loadNotifications();
        // Mở tab mặc định
        openTabBubble('revenue-expense');
      });
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
    } else {
      currentEmployeeId = null;
      document.getElementById("login-page").style.display = "flex";
      document.getElementById("main-page").style.display = "none";
    }
  });
}

// File: js/common.js (Chỉ sửa hàm loadFirebaseData)
// File: js/common.js (Chỉ sửa hàm loadFirebaseData)
function loadFirebaseData(callback) {
  Promise.all([
    db.ref("inventory").once("value").then(snapshot => {
      globalInventoryData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded inventory data:", globalInventoryData);
    }),
    db.ref("reports").once("value").then(snapshot => {
      globalReportData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded report data:", globalReportData);
    }),
    db.ref("employees").once("value").then(snapshot => {
      const employees = snapshot.val() || {};
      globalEmployeeData = Object.keys(employees).map(id => ({ id, ...employees[id] }));
      console.log("Loaded employee data:", globalEmployeeData);
    }),
    db.ref("advances").once("value").then(snapshot => {
      globalAdvanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded advance requests:", globalAdvanceRequests);
    }),
    db.ref("messages/group").on("value", snapshot => {
      globalMessages.group = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded group messages:", globalMessages.group);
    }),
    db.ref("messages/manager").on("value", snapshot => {
      globalMessages.manager = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded manager messages:", globalMessages.manager);
    }),
    db.ref("schedules").on("value", snapshot => {
      globalScheduleData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded schedule data:", globalScheduleData);
    }),
    db.ref("notifications/" + currentEmployeeId).on("value", snapshot => {
      globalNotifications = snapshot.val() ? Object.values(snapshot.val()).map(n => ({ id: n.id || snapshot.key, ...n })) : [];
      console.log("Loaded notifications:", globalNotifications);
    }),
    db.ref("notifications/general").on("value", snapshot => {
      globalGeneralNotifications = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded general notifications:", globalGeneralNotifications);
    })
  ]).then(() => {
    if (callback) callback();
  }).catch(err => console.error("Error loading Firebase data:", err));
}
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
  const match = text.match(/([\d.,]+)\s*(k|nghìn|tr|triệu)?/i);
  if (!match) return { money: 0, note: text.trim() };
  let num = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2]?.toLowerCase() || '';
  if (unit.includes('tr')) num *= 1_000_000;
  else if (unit.includes('k') || unit.includes('nghìn')) num *= 1_000;
  return { money: Math.round(num), note: text.replace(match[0], '').trim() };
}

// Helper Functions for Data Access
function getInventoryData() { return globalInventoryData; }
function getReportData() { return globalReportData; }
function getEmployeeData() { return globalEmployeeData; }
function getAdvanceRequests() { return globalAdvanceRequests; }
function getMessages() { return globalMessages; }
function getScheduleData() { return globalScheduleData; }
function getNotifications() { return globalNotifications; }
function getGeneralNotifications() { return globalGeneralNotifications; }

initApp();