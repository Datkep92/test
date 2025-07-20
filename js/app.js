import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { handleLogin, handleLogout } from './auth.js';
import { checkAdminStatus } from './utils.js';
import { loadData } from './sales.js';
import { renderUserList } from './users.js';
import { loadReportFilters } from './reports.js';

// Khởi tạo ứng dụng
export function initApp() {
  // Thiết lập sự kiện
  document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleLogin();
  });

  // Lắng nghe thay đổi trạng thái auth
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      handleSuccessfulLogin();
    } else {
      document.getElementById('loginBox').classList.remove('hidden');
      document.getElementById('appHeader').classList.add('hidden');
      document.getElementById('adminApp').classList.add('hidden');
      document.getElementById('saleApp').classList.add('hidden');
    }
  });
}

async function handleSuccessfulLogin() {
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('appHeader').classList.remove('hidden');
  document.getElementById('currentUser').textContent = currentUser.email;
  
  const isAdmin = await checkAdminStatus(currentUser);
  if (isAdmin) {
    document.getElementById('adminApp').classList.remove('hidden');
    loadReportFilters();
    renderUserList();
  } else {
    document.getElementById('saleApp').classList.remove('hidden');
  }
  
  loadData(currentUser);
}

// Expose functions to global scope
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
