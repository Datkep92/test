import { database } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError } from './utils.js';

export async function loadReportFilters() {
  const userFilter = document.getElementById('reportUserFilter');
  const categoryFilter = document.getElementById('reportCategoryFilter');
  
  // Clear existing options except first
  while (userFilter.options.length > 1) userFilter.remove(1);
  while (categoryFilter.options.length > 1) categoryFilter.remove(1);
  
  // Add users
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      
      for (const uid in users) {
        const user = users[uid];
        if (user.active) {
          const option = document.createElement('option');
          option.value = user.email;
          option.textContent = user.email;
          userFilter.appendChild(option);
        }
      }
    }
  } catch (error) {
    showError(`Lỗi khi tải danh sách người dùng: ${error.message}`);
  }
  
  // Add categories
  expenseCategories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

export async function generateDailyReport() {
  const dateInput = document.getElementById('reportDate').value;
  if (!dateInput) {
    alert('Vui lòng chọn ngày');
    return;
  }
  
  const userFilter = document.getElementById('reportUserFilter').value;
  const categoryFilter = document.getElementById('reportCategoryFilter').value;
  
  generateReport(dateInput, userFilter, categoryFilter);
}

export async function generateMonthlyReport() {
  const dateInput = document.getElementById('reportDate').value;
  if (!dateInput) {
    alert('Vui lòng chọn ngày trong tháng cần báo cáo');
    return;
  }
  
  const date = new Date(dateInput);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  const userFilter = document.getElementById('reportUserFilter').value;
  const categoryFilter = document.getElementById('reportCategoryFilter').value;
  
  generateReport(`${year}-${month.toString().padStart(2, '0')}`, userFilter, categoryFilter, true);
}

async function generateReport(dateFilter, userFilter = 'all', categoryFilter = 'all', isMonthly = false) {
  let allDailyData = [];
  const dateStr = isMonthly 
    ? dateFilter // Format: "YYYY-MM"
    : new Date(dateFilter).toLocaleDateString('vi-VN');
  
  try {
    const dailyRef = ref(database, 'dailyData');
    const snapshot = await get(dailyRef);
    
    if (snapshot.exists()) {
      const allData = snapshot.val();
      
      for (const dateKey in allData) {
        for (const userId in allData[dateKey]) {
          const dailyData = allData[dateKey][userId];
          
          // Apply date filter
          if (isMonthly) {
            const [day, month, year] = dailyData.date.split('/');
            const dataMonth = `${year}-${month.padStart(2, '0')}`;
            if (dataMonth !== dateFilter) continue;
          } else {
            if (dailyData.date !== dateStr) continue;
          }
          
          // Apply user filter
          if (userFilter !== 'all' && userFilter !== dailyData.user) continue;
          
          allDailyData.push(dailyData);
        }
      }
    }
  } catch (error) {
    showError(`Lỗi khi tạo báo cáo: ${error.message}`);
    return;
  }
  
  // Generate report content
  let reportHTML = `<h3>Báo cáo ${isMonthly ? 'tháng' : 'ngày'} ${dateStr}</h3>`;
  
  if (allDailyData.length === 0) {
    reportHTML += `<p>Không có dữ liệu ${isMonthly ? 'tháng' : 'ngày'} ${dateStr}</p>`;
  } else {
    // Calculate totals
    const totalRevenue = allDailyData.reduce((sum, data) => sum + (data.revenue || 0), 0);
    const totalExpenses = allDailyData.reduce((sum, data) => 
      sum + (data.expenses?.reduce((expSum, exp) => expSum + exp.amount, 0) || 0), 0);
    
    reportHTML += `
      <div class="summary-section">
        <h4>Tổng hợp</h4>
        <p>Đã ghi nhận ${allDailyData.length} bản ghi dữ liệu</p>
        <table class="table">
          <tr>
            <td><strong>Tổng doanh thu:</strong></td>
            <td class="text-right">${totalRevenue.toLocaleString('vi-VN')}₫</td>
          </tr>
          <tr>
            <td><strong>Tổng chi phí:</strong></td>
            <td class="text-right">${totalExpenses.toLocaleString('vi-VN')}₫</td>
          </tr>
          <tr>
            <td><strong>Lợi nhuận:</strong></td>
            <td class="text-right">${(totalRevenue - totalExpenses).toLocaleString('vi-VN')}₫</td>
          </tr>
        </table>
      </div>
    `;
  }
  
  document.getElementById('reportOutput').innerHTML = reportHTML;
}

export function applyReportFilters() {
  const dateInput = document.getElementById('reportDate').value;
  if (!dateInput) {
    alert('Vui lòng chọn ngày');
    return;
  }
  
  const userFilter = document.getElementById('reportUserFilter').value;
  const categoryFilter = document.getElementById('reportCategoryFilter').value;
  
  generateReport(dateInput, userFilter, categoryFilter);
}

export function printReport() {
  window.print();
}

// Expose functions to window
window.generateDailyReport = generateDailyReport;
window.generateMonthlyReport = generateMonthlyReport;
window.applyReportFilters = applyReportFilters;
window.printReport = printReport;
