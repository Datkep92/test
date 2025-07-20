import { db } from './auth.js';
import { collection, query, where, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function initReports() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('reportDate').value = today;

  async function generateReport(dateFilter, userFilter = 'all', categoryFilter = 'all', isMonthly = false) {
    let allDailyData = [];
    const dateStr = isMonthly ? dateFilter : new Date(dateFilter).toLocaleDateString('vi-VN');
    const [year, month] = isMonthly ? dateFilter.split('-') : [new Date(dateFilter).getFullYear(), new Date(dateFilter).getMonth() + 1];

    const startDate = isMonthly ? new Date(year, month - 1, 1) : new Date(dateFilter);
    const endDate = isMonthly ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(dateFilter + 'T23:59:59.999');

    const collections = ['expenses', 'exports', 'revenues', 'dailyNotes'];
    for (const col of collections) {
      let q = query(
        collection(db, col),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );
      if (userFilter !== 'all') q = query(q, where('user', '==', userFilter));
      if (col === 'expenses' && categoryFilter !== 'all') q = query(q, where('category', '==', categoryFilter));
      const snapshot = await getDocs(q);
      allDailyData.push({ collection: col, docs: snapshot.docs });
    }

    if (!allDailyData.some(data => data.docs.length > 0)) {
      document.getElementById('reportOutput').innerHTML = `<p>Không có dữ liệu ${isMonthly ? 'tháng' : 'ngày'} ${dateStr}</p>`;
      return;
    }

    let totalRevenue = 0;
    let totalExpense = 0;
    let totalExportCost = 0;
    let expenseDetails = {};
    let exportDetails = {};
    let userNotes = [];
    let dailySummaries = [];

    allDailyData.forEach(({ collection, docs }) => {
      if (collection === 'revenues') {
        docs.forEach(doc => totalRevenue += doc.data().amount);
      } else if (collection === 'expenses') {
        docs.forEach(doc => {
          const expense = doc.data();
          totalExpense += expense.amount;
          if (!expenseDetails[expense.category]) expenseDetails[expense.category] = { amount: 0, items: [] };
          expenseDetails[expense.category].amount += expense.amount;
          expenseDetails[expense.category].items.push({
            description: expense.description,
            amount: expense.amount,
            user: expense.user,
            date: doc.data().timestamp.toDate().toLocaleDateString('vi-VN')
          });
        });
      } else if (collection === 'exports') {
        docs.forEach(doc => {
          const exportItem = doc.data();
          totalExportCost += exportItem.quantity * exportItem.price;
          if (!exportDetails[exportItem.productName]) exportDetails[exportItem.productName] = { quantity: 0, cost: 0, unit: exportItem.unit, items: [] };
          exportDetails[exportItem.productName].quantity += exportItem.quantity;
          exportDetails[exportItem.productName].cost += exportItem.quantity * exportItem.price;
          exportDetails[exportItem.productName].items.push({
            quantity: exportItem.quantity,
            user: exportItem.user,
            date: exportItem.timestamp.toDate().toLocaleDateString('vi-VN')
          });
        });
      } else if (collection === 'dailyNotes') {
        docs.forEach(doc => {
          if (doc.data().note) userNotes.push({
            user: doc.data().user,
            note: doc.data().note,
            date: doc.data().date
          });
        });
      }
    });

    if (isMonthly) {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${day}/${month}/${year}`;
        let dayRevenue = 0, dayExpense = 0, dayExportCost = 0;
        allDailyData.forEach(({ collection, docs }) => {
          const dayDocs = docs.filter(doc => doc.data().timestamp.toDate().toLocaleDateString('vi-VN') === dayStr);
          if (collection === 'revenues') dayRevenue += dayDocs.reduce((sum, doc) => sum + doc.data().amount, 0);
          if (collection === 'expenses') dayExpense += dayDocs.reduce((sum, doc) => sum + doc.data().amount, 0);
          if (collection === 'exports') dayExportCost += dayDocs.reduce((sum, doc) => sum + (doc.data().quantity * doc.data().price), 0);
        });
        if (dayRevenue || dayExpense || dayExportCost) {
          dailySummaries.push({
            date: dayStr,
            revenue: dayRevenue,
            expense: dayExpense,
            exportCost: dayExportCost,
            profit: dayRevenue - dayExpense - dayExportCost
          });
        }
      }
    }

    const profit = totalRevenue - totalExpense - totalExportCost;
    let reportHTML = `
      <h4>Báo cáo ${isMonthly ? 'tháng' : 'ngày'} ${dateStr}</h4>
      ${userFilter !== 'all' ? `<p>Người dùng: ${userFilter}</p>` : ''}
      ${categoryFilter !== 'all' ? `<p>Danh mục: ${categoryFilter}</p>` : ''}
      
      <div class="summary-section">
        <h5>Tổng hợp</h5>
        <table class="table">
          <tr><td>Tổng doanh thu:</td><td class="text-right">${totalRevenue.toLocaleString('vi-VN')}₫</td></tr>
          <tr><td>Tổng chi phí:</td><td class="text-right">${totalExpense.toLocaleString('vi-VN')}₫</td></tr>
          <tr><td>Tổng giá trị hàng xuất:</td><td class="text-right">${totalExportCost.toLocaleString('vi-VN')}₫</td></tr>
          <tr><td><strong>Lợi nhuận thực:</strong></td><td class="text-right"><strong>${profit.toLocaleString('vi-VN')}₫</strong></td></tr>
        </table>
      </div>
      
      <div class="expense-section">
        <h5>Chi tiết chi phí</h5>
        ${Object.entries(expenseDetails).map(([category, data]) => `
          <div class="category-section">
            <h6>${category}: ${data.amount.toLocaleString('vi-VN')}₫</h6>
            <table class="table">
              <thead><tr><th>Mô tả</th><th class="text-right">Số tiền</th><th>Người nhập</th><th>Ngày</th></tr></thead>
              <tbody>
                ${data.items.map(item => `
                  <tr>
                    <td>${item.description}</td>
                    <td class="text-right">${item.amount.toLocaleString('vi-VN')}₫</td>
                    <td>${item.user}</td>
                    <td>${item.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
      
      <div class="export-section">
        <h5>Chi tiết xuất hàng</h5>
        ${Object.entries(exportDetails).map(([product, data]) => `
          <div class="product-section">
            <h6>${product}: ${data.quantity} ${data.unit} (${data.cost.toLocaleString('vi-VN')}₫)</h6>
            <table class="table">
              <thead><tr><th>Số lượng</th><th>Người nhập</th><th>Ngày</th></tr></thead>
              <tbody>
                ${data.items.map(item => `
                  <tr>
                    <td>${item.quantity}</td>
                    <td>${item.user}</td>
                    <td>${item.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    `;

    if (isMonthly && dailySummaries.length > 0) {
      reportHTML += `
        <div class="daily-summary-section">
          <h5>Tổng hợp từng ngày</h5>
          <table class="table">
            <thead><tr><th>Ngày</th><th class="text-right">Doanh thu</th><th class="text-right">Chi phí</th><th class="text-right">Xuất hàng</th><th class="text-right">Lợi nhuận</th></tr></thead>
            <tbody>
              ${dailySummaries.map(day => `
                <tr>
                  <td>${day.date}</td>
                  <td class="text-right">${day.revenue.toLocaleString('vi-VN')}₫</td>
                  <td class="text-right">${day.expense.toLocaleString('vi-VN')}₫</td>
                  <td class="text-right">${day.exportCost.toLocaleString('vi-VN')}₫</td>
                  <td class="text-right">${day.profit.toLocaleString('vi-VN')}₫</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (userNotes.length > 0) {
      reportHTML += `
        <div class="notes-section">
          <h5>Ghi chú từ nhân viên</h5>
          <table class="table">
            <thead><tr><th>Người ghi</th><th>Ghi chú</th><th>Ngày</th></tr></thead>
            <tbody>
              ${userNotes.map(note => `
                <tr>
                  <td>${note.user}</td>
                  <td>${note.note}</td>
                  <td>${note.date}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    document.getElementById('reportOutput').innerHTML = reportHTML;
  }

  document.getElementById('daily-report').addEventListener('click', () => {
    const dateInput = document.getElementById('reportDate').value;
    if (!dateInput) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng chọn ngày</div>';
      return;
    }
    const userFilter = document.getElementById('reportUserFilter').value;
    const categoryFilter = document.getElementById('reportCategoryFilter').value;
    generateReport(dateInput, userFilter, categoryFilter);
  });

  document.getElementById('monthly-report').addEventListener('click', () => {
    const dateInput = document.getElementById('reportDate').value;
    if (!dateInput) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng chọn ngày trong tháng</div>';
      return;
    }
    const date = new Date(dateInput);
    const dateFilter = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const userFilter = document.getElementById('reportUserFilter').value;
    const categoryFilter = document.getElementById('reportCategoryFilter').value;
    generateReport(dateFilter, userFilter, categoryFilter, true);
  });

  document.getElementById('apply-report').addEventListener('click', () => {
    const dateInput = document.getElementById('reportDate').value;
    if (!dateInput) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng chọn ngày</div>';
      return;
    }
    const userFilter = document.getElementById('reportUserFilter').value;
    const categoryFilter = document.getElementById('reportCategoryFilter').value;
    generateReport(dateInput, userFilter, categoryFilter);
  });

  document.getElementById('print-report').addEventListener('click', () => {
    window.print();
  });

  onSnapshot(collection(db, 'expenseCategories'), (snapshot) => {
    const categoryFilter = document.getElementById('reportCategoryFilter');
    categoryFilter.innerHTML = '<option value="all">Tất cả danh mục</option>';
    snapshot.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.data().category;
      option.textContent = doc.data().category;
      categoryFilter.appendChild(option);
    });
  });
}