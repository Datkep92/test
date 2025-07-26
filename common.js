// Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// Global variables
let currentUser = null;
let globalEmployees = [];
let globalSchedules = [];
let globalNotifications = [];
let globalMessages = {};
let globalAdvanceRequests = [];

// Initialize app
function initApp() {
  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      loadAllData();
      setupRealtimeListeners();
    } else {
      resetAllData();
    }
  });
}

// Load all data
function loadAllData() {
  const promises = [
    loadEmployees(),
    loadSchedules(),
    loadNotifications(),
    loadMessages(),
    loadAdvanceRequests()
  ];
  
  return Promise.all(promises);
}

// Realtime listeners
function setupRealtimeListeners() {
  db.ref('employees').on('value', snapshot => {
    globalEmployees = snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
    if (typeof renderEmployeeList === 'function') renderEmployeeList();
  });
  
  db.ref('schedules').on('value', snapshot => {
    globalSchedules = snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderScheduleStatus === 'function') renderScheduleStatus();
  });
  
  db.ref(`notifications/${currentUser.uid}`).on('value', snapshot => {
    globalNotifications = snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
    if (typeof renderNotifications === 'function') renderNotifications();
  });
  
  db.ref('messages').on('value', snapshot => {
    globalMessages = snapshot.val() || {};
    if (typeof renderChat === 'function') renderChat();
  });
  
  db.ref('advances').on('value', snapshot => {
    globalAdvanceRequests = snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
    if (typeof renderAdvanceHistory === 'function') renderAdvanceHistory();
  });
}

// Reset all data
function resetAllData() {
  globalEmployees = [];
  globalSchedules = [];
  globalNotifications = [];
  globalMessages = {};
  globalAdvanceRequests = [];
}

// Notification system
function sendNotification(receiverId, message, type, data = {}) {
  const notificationId = db.ref(`notifications/${receiverId}`).push().key;
  const notification = {
    id: notificationId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'Quản lý',
    message,
    type,
    data,
    timestamp: Date.now(),
    isRead: false
  };
  
  return db.ref(`notifications/${receiverId}/${notificationId}`).set(notification);
}

// Mark notification as read
function markAsRead(notificationId) {
  return db.ref(`notifications/${currentUser.uid}/${notificationId}`).update({
    isRead: true,
    readAt: Date.now()
  });
}

// Login/Logout
function login(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

function logout() {
  return auth.signOut();
}

// Helper functions
function getEmployeeById(id) {
  return globalEmployees.find(e => e.id === id);
}

function getEmployeeSchedules(employeeId) {
  return globalSchedules.filter(s => s.employeeId === employeeId);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);