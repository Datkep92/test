import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { get, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { handleLogin, handleLogout } from './auth.js';
import { checkAdminStatus } from './utils.js';
import { loadData } from './sales.js';
import { renderUserList } from './users.js';
import { loadReportFilters } from './reports.js';

// System Data
let currentUser = null;

// Initialize the app
function initApp() {
  // Set current date in report date picker
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('reportDate').value = today;
  
  // Event listeners
  document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleLogin();
  });
  
  document.getElementById('expenseInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addExpense();
  });
  
  document.getElementById('revenueAmount').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addRevenue();
  });
  
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      handleSuccessfulLogin();
    } else {
      // User is signed out
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
  
  // Check if user is admin
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

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
document.getElementById('expenseInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') addExpense();
});

document.getElementById('revenueAmount').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') addRevenue();
});
// Expose functions to global scope for HTML onclick handlers
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
