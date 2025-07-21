function loadSharedReports(elementId, userRole, userId) {
  const reportsList = document.getElementById(elementId);
  const filter = document.getElementById(`${userRole}-report-filter`);
  const dateInput = document.getElementById(`${userRole}-report-date`);

  if (!reportsList || !filter || !dateInput) {
    console.error('Không tìm thấy phần tử shared-report-table, report-filter hoặc report-date trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo, bộ lọc hoặc mục chọn ngày.');
    return;
  }

  const updateReports = () => {
    const selectedDate = dateInput.value;
    const dateKey = selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN').replace(/\//g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');

    db.ref('dailyData').on('value', snapshot => {
      reportsList.innerHTML = '';
      const data = snapshot.val();
      if (!data) {
        reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo.</p>';
        console.log('Không có dữ liệu báo cáo trong dailyData.');
        return;
      }

      const filterType = filter.value;
      let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
      let expenseDetails = [], revenueDetails = [], exportDetails = [];

      Object.entries(data).forEach(([date, users]) => {
        const formattedDate = date.replace(/_/g, '/');
        const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
        if (filterType === 'day' && date !== dateKey) return;
        if (filterType === 'month' && formattedDate.substring(3) !== new Date(selectedDate).toLocaleDateString('vi-VN').substring(3)) return;

        Object.entries(users).forEach(([uid, report]) => {
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
            const canDelete = userRole === 'manager' || (userRole === 'employee' && uid === userId);
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
          ${expenseDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
          <p><strong>Chi tiết Doanh Thu:</strong></p>
          ${revenueDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
          <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
          <p><strong>Chi tiết Xuất kho:</strong></p>
          ${exportDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
        </div>
      `;
      reportsList.innerHTML = html;
      console.log('Đã tải báo cáo tổng thành công cho', elementId, 'ngày:', selectedDate);
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
