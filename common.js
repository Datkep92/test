
let currentEmployeeId = null;
// File: js/employee-management.js

// Firebase References
const db = firebase.database();
const auth = firebase.auth();
let globalHistory = [];
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
      console.log("initApp - currentEmployeeId:", currentEmployeeId); // Debug
      loadFirebaseData(() => {
        loadEmployeeInfo();
        renderReportProductList();
        renderRevenueExpenseData();
        renderInventory();
        renderAdvanceHistory();
        renderScheduleStatusList();
        renderCalendar();
        renderScheduleRequests();
        renderNotifications();
        renderFilteredReports(getReportData());
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
      renderReportProductList();
      renderRevenueExpenseData();
      renderInventory();
      renderAdvanceHistory();
      renderScheduleStatusList();
      renderCalendar();
      renderScheduleRequests();
      renderNotifications();
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

    // Tải dữ liệu users
    db.ref("users").once("value").then(snapshot => {
      globalEmployeeData = [];
      snapshot.forEach(child => {
        globalEmployeeData.push({ id: child.key, ...child.val() });
      });
      const found = globalEmployeeData.find(e => e.id === userId);
      if (!found) {
        const newUser = {
          id: userId,
          name: user.displayName || "Chưa rõ tên",
          email: user.email || "",
          role: "employee",
          active: true
        };
        db.ref(`users/${userId}`).set(newUser)
          .then(() => {
            globalEmployeeData.push(newUser);
            console.log("✅ Added new user to /users:", newUser);
          })
          .catch(err => {
            console.error("❌ Error adding user to /users:", err.message);
          });
      }
      isEmployeeDataLoaded = true;
      console.log("✅ Loaded employee data:", globalEmployeeData);

      if (document.getElementById('profile') && document.getElementById('profile').style.display !== 'none') {
        loadEmployeeInfo();
      }

      if (typeof callback === "function") callback();
    }).catch(err => {
      console.error("❌ Error loading users:", err.message);
    });

    // Tải dữ liệu schedules
    db.ref("schedules").once("value").then(snapshot => {
      globalScheduleData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderCalendar === "function") renderCalendar();
    }).catch(err => {
      console.error("❌ Error loading schedules:", err.message);
    });

    // Tải dữ liệu inventory
    db.ref("inventory").once("value").then(snapshot => {
      globalInventoryData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderInventory === "function") renderInventory();
    }).catch(err => {
      console.error("❌ Error loading inventory:", err.message);
    });

    // Tải dữ liệu advanceRequests
    db.ref("advanceRequests").once("value").then(snapshot => {
      globalAdvanceRequests = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));

      // Nhân viên xem lịch sử tạm ứng của họ
      if (typeof renderAdvanceHistory === "function") renderAdvanceHistory();

      // Quản lý xem tất cả yêu cầu tạm ứng
      if (isCurrentUserManager() && typeof renderAdvanceRequests === "function") {
        renderAdvanceRequests();
        const container = document.getElementById("advance-request-list");
        if (container) {
          container.classList.remove("hidden");
          container.style.display = "block";
        }
      }

    }).catch(err => {
      console.error("❌ Error loading advance requests:", err.message);
    });

    // Tải dữ liệu reports
    db.ref("reports").once("value").then(snapshot => {
      globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderFilteredReports === "function") renderFilteredReports(globalReportData);
    }).catch(err => {
      console.error("❌ Error loading reports:", err.message);
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
    initProfile(); // Đảm bảo gọi initProfile khi mở tab
  } else if (tabId === 'employee') {
  }
}

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
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function loadEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) return;
  db.ref(`users/${user.uid}`).once("value").then(snapshot => {
    const data = snapshot.val();
    if (data) {
      const nameInput = document.getElementById("name-input");
      const addressInput = document.getElementById("address-input");
      const phoneInput = document.getElementById("phone-input");

      if (nameInput) nameInput.value = data.name || "";
      if (addressInput) addressInput.value = data.andess || "";
      if (phoneInput) phoneInput.value = data.sdt || "";
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
function loadFirebaseData(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      console.log("❌ User not logged in");
      return;
    }

    const userId = user.uid;

    // Load users
    db.ref("users").once("value").then(snapshot => {
      globalEmployeeData = [];
      snapshot.forEach(child => {
        globalEmployeeData.push({ id: child.key, ...child.val() });
      });

      const found = globalEmployeeData.find(e => e.id === userId);
      if (!found) {
        const newUser = {
          id: userId,
          name: user.displayName || "Chưa rõ tên",
          email: user.email || "",
          role: "employee",
          active: true
        };
        db.ref(`users/${userId}`).set(newUser).then(() => {
          globalEmployeeData.push(newUser);
          console.log("✅ Added new user to /users:", newUser);
        }).catch(err => {
          console.error("❌ Error adding user:", err.message);
        });
      }

      isEmployeeDataLoaded = true;
      console.log("✅ Loaded employee data:", globalEmployeeData);

      if (document.getElementById('profile') && document.getElementById('profile').style.display !== 'none') {
        loadEmployeeInfo();
      }

      if (typeof callback === "function") callback();
    }).catch(err => {
      console.error("❌ Error loading users:", err.message);
    });

    // Load schedules
    db.ref("schedules").once("value").then(snapshot => {
      globalScheduleData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderCalendar === "function") renderCalendar();
    }).catch(err => {
      console.error("❌ Error loading schedules:", err.message);
    });

    // Load inventory
    db.ref("inventory").once("value").then(snapshot => {
      globalInventoryData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderInventory === "function") renderInventory();
    }).catch(err => {
      console.error("❌ Error loading inventory:", err.message);
    });

    // ✅ Load advances (tạm ứng)
    db.ref("advances").once("value").then(snapshot => {
      globalAdvanceRequests = Object.entries(snapshot.val() || {}).map(([id, data]) => ({
        id,
        ...data
      }));

      console.log("✅ Loaded advances:", globalAdvanceRequests);

      // Nhân viên
      if (typeof renderAdvanceHistory === "function") renderAdvanceHistory();

      // Quản lý
      if (isCurrentUserManager() && typeof renderAdvanceRequests === "function") {
        renderAdvanceRequests();

        // Hiển thị container nếu bị ẩn
        const container = document.getElementById("advance-request-list");
        if (container) {
          container.classList.remove("hidden");
          container.style.display = "block";
        }
      }
    }).catch(err => {
      console.error("❌ Error loading advances:", err.message);
    });

    // Load reports
    db.ref("reports").once("value").then(snapshot => {
      globalReportData = Object.entries(snapshot.val() || {}).map(([id, data]) => ({ id, ...data }));
      if (typeof renderFilteredReports === "function") renderFilteredReports(globalReportData);
    }).catch(err => {
      console.error("❌ Error loading reports:", err.message);
    });
  });
}
function showDayDetails(date) {
  const modal = document.getElementById('day-details-modal');
  const content = document.getElementById('day-details-content');
  if (!modal || !content) {
    console.error("Modal or content not found");
    return;
  }

  console.log("Schedules for date:", date, globalScheduleData); // Debug
  const schedules = globalScheduleData.filter(s => s.date === date && s.employeeId);
  content.innerHTML = `
    <h3>Lịch làm việc ngày ${new Date(date).toLocaleDateString('vi-VN')}</h3>
    ${schedules.length > 0
      ? schedules.map(s => {
          const employee = globalEmployeeData.find(e => e.id === s.employeeId);
          const isManager = isCurrentUserManager();
          return `
            <div class="schedule-item">
              <p><strong>${employee ? employee.name : 'Không xác định'}</strong>: 
                ${s.status === 'off' ? 'Nghỉ' : s.status === 'overtime' ? 'Tăng ca' : 'Đổi ca'}</p>
              ${isManager && (s.approvalStatus === 'pending' || s.approvalStatus === 'swapPending')
                ? `
                  <button onclick="approveSchedule('${s.id}')">Phê duyệt</button>
                  <button onclick="rejectSchedule('${s.id}')">Từ chối</button>
                `
                : `<p>Trạng thái: ${s.approvalStatus === 'approved' ? 'Đã duyệt' : s.approvalStatus === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}</p>`
              }
            </div>
          `;
        }).join('')
      : '<p>Chưa có lịch làm việc.</p>'
    }
    <button onclick="closeModal('day-details-modal')">Đóng</button>
  `;
  modal.style.display = 'block';
}

initApp();
