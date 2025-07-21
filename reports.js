
function loadSharedReports(elementId, userId) {
  console.log('loadSharedReports called with:', { elementId, userId });
  const reportsList = document.getElementById(elementId);
  const filter = document.getElementById('report-filter');
  const dateInput = document.getElementById('report-date');

  console.log('DOM elements:', { reportsList, filter, dateInput });
  if (!reportsList || !filter || !dateInput) {
    console.error('Không tìm thấy phần tử shared-report-table, report-filter hoặc report-date trong DOM', { elementId });
    alert('Lỗi: Không tìm thấy bảng báo cáo, bộ lọc hoặc mục chọn ngày.');
    return;
  }

  const updateReports = () => {
    const selectedDate = dateInput.value;
    const dateKey = selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN').replace(/\//g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
    const todayKey = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
    console.log('Selected date, dateKey, todayKey:', { selectedDate, dateKey, todayKey });

    db.ref('dailyData').on('value', snapshot => {
      reportsList.innerHTML = '';
      const data = snapshot.val();
      console.log('Firebase dailyData:', data);
      if (!data) {
        reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo cho ngày/tháng đã chọn.</p>';
        console.log('Không có dữ liệu báo cáo trong dailyData.');
        return;
      }

      // Kiểm tra vai trò người dùng
      let userRole = 'employee'; // Mặc định là nhân viên
      db.ref('users/' + userId).once('value').then(userSnapshot => {
        const userData = userSnapshot.val();
        if (userData && userData.role === 'manager') {
          userRole = 'manager';
        }
        console.log('User role:', userRole);

        const filterType = filter.value;
        let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
        let expenseDetails = [], revenueDetails = [], exportDetails = [];

        Object.entries(data).forEach(([date, users]) => {
          const formattedDate = date.replace(/_/g, '/');
          const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
          if (filterType === 'day' && date !== dateKey) return;
          if (filterType === 'month' && formattedDate.substring(3) !== new Date(selectedDate).toLocaleDateString('vi-VN').substring(3)) return;

          Object.entries(users).forEach(([uid, report]) => {
            console.log('Processing report:', { date, uid, report });
            if (!/^[a-zA-Z0-9]+$/.test(uid)) {
              console.warn('Bỏ qua key không hợp lệ:', uid);
              return;
            }
            totalInitial += report.initialInventory || 0;
            totalFinal += report.finalInventory || 0;
            totalRevenue += report.revenue || 0;
            if (report.expense && report.expense.amount) {
              totalExpense += report.expense.amount;
              const expenseDetail = `${report.expense.amount} (Thông tin: ${report.expense.info || 'Không có'}, Nhân viên: ${report.user}, Thời gian: ${new Date(report.expense.timestamp).toLocaleString()})`;
              const canDelete = userRole === 'manager' || (userRole === 'employee' && uid === userId && date === todayKey);
              expenseDetails.push(`
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>${expenseDetail}</span>
                  ${canDelete ? `<button onclick="deleteReport('${date}', '${uid}')" style="padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>` : ''}
                </div>
              `);
            }
            if (report.revenue) {
              revenueDetails.push(`${report.revenue} (Nhân viên: ${report.user})`);
            }
            if (report.exports) {
              Object.values(report.exports).forEach(exportItem => {
                totalExport += exportItem.quantity || 0;
                exportDetails.push(`${exportItem.quantity} ${exportItem.productName} (Nhân viên: ${report.user})`);
              });
            }
          });
        });

        const remainingBalance = totalRevenue - totalExpense;

        let html = `
          <div style="margin-bottom: 16px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <p><strong>Tổng Tồn kho đầu kỳ:</strong> ${totalInitial}</p>
            <p><strong>Tổng Tồn kho cuối kỳ:</strong> ${totalFinal}</p>
            <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue}</p>
            <p><strong>Tổng Chi Phí:</strong> ${totalExpense}</p>
            <p><strong>Số dư còn lại:</strong> ${remainingBalance >= 0 ? remainingBalance : 0}</p>
            <p><strong>Chi tiết Chi Phí:</strong></p>
            ${expenseDetails.length > 0 ? expenseDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('') : '<p style="margin: 0;">Không có chi phí.</p>'}
            <p><strong>Chi tiết Doanh Thu:</strong></p>
            ${revenueDetails.length > 0 ? revenueDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('') : '<p style="margin: 0;">Không có doanh thu.</p>'}
            <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
            <p><strong>Chi tiết Xuất kho:</strong></p>
            ${exportDetails.length > 0 ? exportDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('') : '<p style="margin: 0;">Không có xuất kho.</p>'}
          </div>
        `;
        reportsList.innerHTML = html;
        console.log('Đã tải báo cáo tổng thành công cho', elementId, 'ngày:', selectedDate);
      }).catch(error => {
        console.error('Lỗi lấy vai trò người dùng:', error);
        alert('Lỗi lấy vai trò người dùng: ' + error.message);
      });
    }, error => {
      console.error('Lỗi tải báo cáo:', error);
      reportsList.innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo: ' + error.message + '</p>';
      alert('Lỗi tải báo cáo: ' + error.message);
    });
  };

  updateReports();
  dateInput.addEventListener('change', updateReports);
  filter.addEventListener('change', updateReports);
}

function deleteReport(date, uid) {
  if (!confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) return;

  db.ref(`dailyData/${date}/${uid}`).remove().then(() => {
    alert('Xóa báo cáo thành công!');
    console.log(`Đã xóa báo cáo của UID ${uid} vào ngày ${date}`);
  }).catch(error => {
    console.error('Lỗi xóa báo cáo:', error);
    alert('Lỗi xóa báo cáo: ' + error.message);
  });
}

function loadInventory(elementId) {
  console.log('loadInventory called with:', { elementId });
  const inventoryList = document.getElementById(elementId);
  if (!inventoryList) {
    console.error('Không tìm thấy phần tử inventory-list trong DOM', { elementId });
    alert('Lỗi: Không tìm thấy danh sách tồn kho.');
    return;
  }

  db.ref('inventory').on('value', snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    console.log('Firebase inventory:', data);
    if (!data) {
      inventoryList.innerHTML = '<p style="margin: 0;">Không có sản phẩm trong kho.</p>';
      console.log('Không có dữ liệu tồn kho.');
      return;
    }

    let html = '<ul style="list-style: none; padding: 0;">';
    Object.entries(data).forEach(([id, item]) => {
      html += `
        <li style="padding: 8px; border-bottom: 1px solid #ccc;">
          ${item.name}: ${item.quantity} ${item.unit} (Giá: ${item.price})
        </li>
      `;
    });
    html += '</ul>';
    inventoryList.innerHTML = html;
    console.log('Đã tải danh sách tồn kho thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p style="margin: 0;">Lỗi tải tồn kho: ' + error.message + '</p>';
    alert('Lỗi tải tồn kho: ' + error.message);
  });
}

function loadExpenseSummary(elementId) {
  console.log('loadExpenseSummary called with:', { elementId });
  const expenseList = document.getElementById(elementId);
  if (!expenseList) {
    console.error('Không tìm thấy phần tử expense-summary-table trong DOM', { elementId });
    alert('Lỗi: Không tìm thấy bảng tổng hợp chi phí.');
    return;
  }

  db.ref('expenseCategories').on('value', snapshot => {
    expenseList.innerHTML = '';
    const data = snapshot.val();
    console.log('Firebase expenseCategories:', data);
    if (!data) {
      expenseList.innerHTML = '<p style="margin: 0;">Không có danh mục chi phí.</p>';
      console.log('Không có dữ liệu danh mục chi phí.');
      return;
    }

    let html = '<ul style="list-style: none; padding: 0;">';
    Object.values(data).forEach(category => {
      html += `<li style="padding: 8px; border-bottom: 1px solid #ccc;">${category}</li>`;
    });
    html += '</ul>';
    expenseList.innerHTML = html;
    console.log('Đã tải tổng hợp chi phí thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tổng hợp chi phí:', error);
    expenseList.innerHTML = '<p style="margin: 0;">Lỗi tải tổng hợp chi phí: ' + error.message + '</p>';
    alert('Lỗi tải tổng hợp chi phí: ' + error.message);
  });
}
