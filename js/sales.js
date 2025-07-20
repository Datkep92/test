import { database } from './firebase-config.js';
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, showSuccess, parseNumber } from './utils.js';
import { products, renderProductSelection, loadProducts } from './products.js';
import { dailyData, currentUser, selectedProduct } from './shared-data.js';

let dailyData = {
  date: '',
  expenses: [],
  exports: [],
  revenue: 0,
  note: '',
  user: ''
};

let currentTab = 'expense';
let selectedProduct = null;
let currentUser = null;

export function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');

  document.getElementById('expenseTab').classList.add('hidden');
  document.getElementById('exportTab').classList.add('hidden');
  document.getElementById('revenueTab').classList.add('hidden');

  document.getElementById(`${tab}Tab`).classList.remove('hidden');

  if (tab === 'export') {
    renderProductSelection();
  }
}

export async function loadData(user) {
  currentUser = user;
  const today = new Date().toLocaleDateString('vi-VN');
  document.getElementById('summaryDate').textContent = today;

  await loadProducts();

  try {
    const dateKey = today.replace(/\//g, '_');
    const dailyRef = ref(database, `dailyData/${dateKey}/${user.uid}`);
    const snapshot = await get(dailyRef);

    if (snapshot.exists()) {
      dailyData = snapshot.val();
    } else {
      dailyData = {
        date: today,
        expenses: [],
        exports: [],
        revenue: 0,
        note: '',
        user: user.email
      };
    }

    document.getElementById('dailyNote').value = dailyData.note || '';
    renderDailyData();
  } catch (error) {
    showError(`Lỗi khi tải dữ liệu ngày: ${error.message}`);
  }
}

export function deleteExpense(index) {
  if (confirm('Xóa chi phí này?')) {
    dailyData.expenses.splice(index, 1);
    renderDailyData();
  }
}

export async function saveDailyData() {
  const today = new Date().toLocaleDateString('vi-VN');
  dailyData.note = document.getElementById('dailyNote').value;
  dailyData.date = today;
  dailyData.user = currentUser.email;

  try {
    const dateKey = today.replace(/\//g, '_');
    const dailyRef = ref(database, `dailyData/${dateKey}/${currentUser.uid}`);
    await set(dailyRef, dailyData);
    showSuccess('Đã lưu dữ liệu ngày ' + dailyData.date);
  } catch (error) {
    showError(`Lỗi khi lưu dữ liệu ngày: ${error.message}`);
  }
}

export function addExport() {
  const qtyInput = document.getElementById('exportQuantity');
  if (!selectedProduct) {
    showError('Vui lòng chọn sản phẩm');
    return;
  }

  const quantity = parseFloat(qtyInput.value);
  if (isNaN(quantity) || quantity <= 0) {
    showError('Vui lòng nhập số lượng hợp lệ');
    return;
  }

  if (quantity > selectedProduct.quantity) {
    showError(`Không đủ tồn kho. Hiện có: ${selectedProduct.quantity} ${selectedProduct.unit}`);
    return;
  }

  if (!Array.isArray(dailyData.exports)) dailyData.exports = [];

  dailyData.exports.push({
    productId: selectedProduct.id,
    productName: selectedProduct.name,
    quantity,
    unit: selectedProduct.unit || '',
    price: selectedProduct.price || 0,
    approved: false,
    timestamp: Date.now()
  });

  document.getElementById('exportQuantity').value = '1';
  renderDailyData();
}

export function deleteExport(index) {
  if (confirm('Xóa xuất hàng này?')) {
    const exportItem = dailyData.exports[index];
    if (!exportItem.approved) {
      const product = products.find(p => p.id === exportItem.productId);
      if (product) {
        product.quantity += exportItem.quantity;
      }
    }

    dailyData.exports.splice(index, 1);
    renderDailyData();
    renderProductSelection();
  }
}

export function renderDailyData() {
  if (!Array.isArray(dailyData.exports)) dailyData.exports = [];
  if (!Array.isArray(dailyData.expenses)) dailyData.expenses = [];

  const exportTable = document.querySelector('#exportTable tbody');
  exportTable.innerHTML = '';

  dailyData.exports.forEach((item, index) => {
    const isApproved = item.approved === true;
    const isMine = item.user === currentUser.email || !item.user;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.productName}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${isApproved ? `<span class="approved-badge">✔️ Đã duyệt</span>` : `<span class="pending-badge">⏳ Chờ duyệt</span>`}</td>
      <td class="actions">
        ${!isApproved && isMine ? `<button onclick="deleteExport(${index})" class="danger">Xóa</button>` : ''}
      </td>
    `;
    exportTable.appendChild(row);
  });

  const expenseTable = document.querySelector('#expenseTable tbody');
  expenseTable.innerHTML = '';
  dailyData.expenses.forEach((expense, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${expense.description}</td>
      <td class="text-right">${expense.amount.toLocaleString('vi-VN')}₫</td>
      <td class="actions">
        <button onclick="deleteExpense(${index})" class="danger">Xóa</button>
      </td>
    `;
    expenseTable.appendChild(row);
  });

  const totalExpense = dailyData.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalRevenue = dailyData.revenue || 0;
  const balance = totalRevenue - totalExpense;

  document.getElementById('totalExpense').textContent = `${totalExpense.toLocaleString('vi-VN')}₫`;
  document.getElementById('totalRevenue').textContent = `${totalRevenue.toLocaleString('vi-VN')}₫`;
  document.getElementById('dailyBalance').textContent = `${balance.toLocaleString('vi-VN')}₫`;
}

// Expose functions to window for HTML onclick handlers
window.switchTab = switchTab;
window.addExport = addExport;
window.deleteExport = deleteExport;
window.saveDailyData = saveDailyData;
window.deleteExpense = deleteExpense;
// Thêm vào cuối file
// Export các hàm cần thiết
export { 
  renderDailyData,
  switchTab,
  loadData,
  deleteExpense,
  saveDailyData,
  addExport,
  deleteExport,
  addExpense,
  addRevenue
};
