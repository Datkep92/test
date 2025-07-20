import { database } from './firebase-config.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, capitalizeFirstLetter } from './utils.js';
import { dailyData, currentUser, renderDailyData, addExpense, addRevenue } from './sales.js';

// ... (giữ nguyên phần còn lại của file)
let expenseCategories = [];

export function parseExpenseInput(input) {
  const normalized = input.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
  
  const amountMatch = normalized.match(/(\d+)\s*$/);
  const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
  
  let description = normalized;
  if (amountMatch) {
    description = normalized.substring(0, amountMatch.index).trim();
  }
  
  const categoryMatch = description.match(/^\s*(\S+)/);
  const category = categoryMatch ? categoryMatch[1] : 'khác';
  
  // Add new category if not exists
  if (!expenseCategories.includes(category)) {
    expenseCategories.push(category);
    
    // Save to Firebase
    const categoriesRef = ref(database, 'expenseCategories');
    set(categoriesRef, expenseCategories);
  }
  
  return {
    description: capitalizeFirstLetter(description),
    amount: amount,
    category: capitalizeFirstLetter(category)
  };
}

export function addExpense() {
  const input = document.getElementById('expenseInput').value.trim();
  if (!input) {
    showError('Vui lòng nhập thông tin chi phí');
    return;
  }
  
  const { description, amount, category } = parseExpenseInput(input);
  
  if (!description || amount <= 0) {
    showError('Không thể xác định mô tả hoặc số tiền từ thông tin nhập');
    return;
  }
  
  dailyData.expenses.push({
    description: `${description}`,
    amount: amount,
    category: category,
    user: currentUser.email,
    timestamp: new Date().getTime()
  });
  
  document.getElementById('expenseInput').value = '';
  renderDailyData();
}

export function deleteExpense(index) {
  if (confirm('Xóa chi phí này?')) {
    dailyData.expenses.splice(index, 1);
    renderDailyData();
  }
}

export function addRevenue() {
  const amount = parseNumber(document.getElementById('revenueAmount').value);
  
  if (isNaN(amount)) {
    showError('Vui lòng nhập số tiền hợp lệ');
    return;
  }
  
  dailyData.revenue += amount;
  document.getElementById('revenueAmount').value = '';
  renderDailyData();
}
