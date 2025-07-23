// Khởi tạo Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDmFpKa8TpDjo3pQADaTubgVpDPOi-FPXk",
  authDomain: "quanly-d7e54.firebaseapp.com",
  databaseURL: "https://quanly-d7e54-default-rtdb.firebaseio.com",
  projectId: "quanly-d7e54",
  storageBucket: "quanly-d7e54.firebasestorage.app",
  messagingSenderId: "482686011267",
  appId: "1:482686011267:web:f2fe9d400fe618487a98b6"
};

firebase.initializeApp(firebaseConfig);
console.log("Firebase initialized successfully");

// Khai báo các tham chiếu Firebase
const database = firebase.database();
const inventoryRef = database.ref("inventory");
const reportsRef = database.ref("reports");
const employeesRef = database.ref("employees");
const advancesRef = database.ref("advances");
const messagesRef = database.ref("messages");
const schedulesRef = database.ref("schedules");
const swapRequestsRef = database.ref("swapRequests");
const notificationsRef = database.ref("notifications");

// Khai báo các biến toàn cục
let inventoryData = [];
let reportData = [];
let employeeData = [];
let advanceRequests = [];
let messages = { group: [], manager: [] };
let scheduleData = [];
let notifications = [];
let generalNotifications = [];

// Hàm loadFirebaseData
function loadFirebaseData() {
  return Promise.all([
    inventoryRef.once("value").then(snapshot => {
      inventoryData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded inventory data:", inventoryData.length, "items");
    }).catch(err => {
      console.error("Error loading inventory:", err);
      alert("Lỗi tải dữ liệu kho: " + err.message);
    }),
    reportsRef.once("value").then(snapshot => {
      reportData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded report data:", reportData.length, "reports");
    }).catch(err => {
      console.error("Error loading reports:", err);
      alert("Lỗi tải dữ liệu báo cáo: " + err.message);
    }),
    employeesRef.once("value").then(snapshot => {
      employeeData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded employee data:", employeeData.length, "employees");
    }).catch(err => {
      console.error("Error loading employees:", err);
      alert("Lỗi tải dữ liệu nhân viên: " + err.message);
    }),
    advancesRef.once("value").then(snapshot => {
      advanceRequests = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded advance requests:", advanceRequests.length, "requests");
    }).catch(err => {
      console.error("Error loading advance requests:", err);
      alert("Lỗi tải dữ liệu yêu cầu tạm ứng: " + err.message);
    }),
    messagesRef.child("group").once("value").then(snapshot => {
      messages.group = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded group messages:", messages.group.length, "messages");
    }).catch(err => {
      console.error("Error loading group messages:", err);
      alert("Lỗi tải tin nhắn nhóm: " + err.message);
    }),
    messagesRef.child("manager").once("value").then(snapshot => {
      messages.manager = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded manager messages:", messages.manager.length, "messages");
    }).catch(err => {
      console.error("Error loading manager messages:", err);
      alert("Lỗi tải tin nhắn quản lý: " + err.message);
    }),
    schedulesRef.once("value").then(snapshot => {
      scheduleData = snapshot.val() ? Object.values(snapshot.val()) : [];
      console.log("Loaded schedule data:", scheduleData.length, "schedules");
    }).catch(err => {
      console.error("Error loading schedules:", err);
      alert("Lỗi tải dữ liệu lịch làm việc: " + err.message);
    })
  ]).then(() => {
    console.log("All Firebase data loaded successfully");
  }).catch(err => {
    console.error("Error loading Firebase data:", err);
    alert("Lỗi tải dữ liệu từ Firebase: " + err.message);
  });
}

// Hàm tiện ích
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
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// Khởi tạo ứng dụng
function initApp() {
  loadFirebaseData().then(() => {
    if (firebase.auth().currentUser) {
      console.log("User is logged in, rendering initial data...");
      openTabBubble('revenue-expense');
    }
  });
}

// Xuất các hàm và biến cần thiết
export {
  loadFirebaseData,
  parseEntry,
  showToastNotification,
  closeModal,
  initApp,
  inventoryRef,
  reportsRef,
  employeesRef,
  advancesRef,
  messagesRef,
  schedulesRef,
  swapRequestsRef,
  notificationsRef,
  inventoryData,
  reportData,
  employeeData,
  advanceRequests,
  messages,
  scheduleData,
  notifications,
  generalNotifications
};