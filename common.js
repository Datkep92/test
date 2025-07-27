// common.js - File xử lý chung cho toàn ứng dụng

// Biến toàn cục
let currentTab = 'revenue-expense';
const tabButtons = {};

// Khởi tạo sự kiện cho các nút tab
function initTabSystem() {
  // Lấy tất cả các nút tab từ floating menu và các nút khác
  const tabButtons = document.querySelectorAll('[onclick^="openTab"]');
  
  tabButtons.forEach(button => {
    const tabId = button.getAttribute('onclick').match(/'([^']+)'/)[1];
    tabButtons[tabId] = button;
    
    button.addEventListener('click', () => {
      openTab(tabId);
    });
  });
}

// Hàm chuyển tab
function openTab(tabId) {
  // Ẩn tất cả các tab
  const tabcontents = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontents.length; i++) {
    tabcontents[i].style.display = "none";
  }

  // Hiển thị tab được chọn
  document.getElementById(tabId).style.display = "block";
  currentTab = tabId;

  // Cập nhật trạng thái active cho các nút
  updateActiveTabButtons(tabId);
  
  // Load dữ liệu khi chuyển tab (nếu cần)
  loadTabData(tabId);
}

// Cập nhật trạng thái active cho các nút tab
function updateActiveTabButtons(activeTabId) {
  // Reset tất cả nút
  Object.values(tabButtons).forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Active nút được chọn
  if (tabButtons[activeTabId]) {
    tabButtons[activeTabId].classList.add('active');
  }
}

// Hàm load dữ liệu khi chuyển tab
function loadTabData(tabId) {
  switch(tabId) {
    case 'revenue-expense':
      if (typeof renderRevenueExpense === 'function') renderRevenueExpense();
      break;
    case 'inventory':
      if (typeof renderInventory === 'function') renderInventory();
      break;
    // Thêm các case khác tương ứng
  }
}

// Hàm toggle floating menu
function toggleMenu() {
  const floatOptions = document.getElementById("float-options");
  if (floatOptions.style.display === "block") {
    floatOptions.style.display = "none";
  } else {
    floatOptions.style.display = "block";
  }
}

// Hàm đăng nhập
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Hàm đăng xuất
function logout() {
  firebase.auth().signOut();
}

// Hàm hiển thị thông báo
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Khởi tạo khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTabSystem();
  
  // Mở tab mặc định
  openTab('revenue-expense');
});