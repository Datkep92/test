function loadSharedReports(elementId, role) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) {
    console.error('Không tìm thấy phần tử shared-report-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo.');
    return;
  }

  const datePickerId = role === 'manager' ? 'manager-date-picker' : 'employee-date-picker';
  const datePicker = document.getElementById(datePickerId);
  if (!datePicker) {
    console.error('Không tìm thấy phần tử date-picker trong DOM');
    alert('Lỗi: Không tìm thấy bộ chọn ngày.');
    return;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('Không có người dùng hiện tại');
    alert('Lỗi: Vui lòng đăng nhập lại.');
    return;
  }

  const selectedDate = datePicker.value;
  const dateKey = selectedDate ? selectedDate.replace(/-/g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
  const refPath = role === 'manager' ? `dailyData/${dateKey}` : `dailyData/${dateKey}/${currentUser.uid}/reports`;

  db.ref(refPath).on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo cho ngày này.</p>';
      console.log('Không có dữ liệu báo cáo trong dailyData.');
      return;
    }

    let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
    let expenseDetails = [], revenueDetails = [], exportDetails = [];

    const processReport = (report, uid, reportId) => {
      totalInitial += report.initialInventory || 0;
      totalFinal += report.finalInventory || 0;
      totalRevenue += report.revenue || 0;

      if (report.expenseHistory) {
        report.expenseHistory.forEach(expense => {
          totalExpense += expense.amount || 0;
          const detail = role === 'manager'
            ? `${expense.amount} (Thông tin: ${expense.info || 'Không có'}, Nhân viên: ${report.user}, Thời gian: ${new Date(expense.timestamp).toLocaleString()})`
            : `${expense.amount} (Thông tin: ${expense.info || 'Không có'}, Thời gian: ${new Date(expense.timestamp).toLocaleString()})`;
          expenseDetails.push(detail);
        });
      }

      if (report.revenue) {
        const detail = role === 'manager'
          ? `${report.revenue} (Nhân viên: ${report.user}, Thời gian: ${new Date(report.lastUpdated).toLocaleString()})`
          : `${report.revenue} (Thời gian: ${new Date(report.lastUpdated).toLocaleString()})`;
        revenueDetails.push(detail);
      }

      if (report.exports) {
        Object.values(report.exports).forEach(exportItem => {
          totalExport += exportItem.quantity || 0;
          const detail = role === 'manager'
            ? `${exportItem.quantity} ${exportItem.productName} (Nhân viên: ${report.user}, Thời gian: ${new Date(exportItem.timestamp).toLocaleString()})`
            : `${exportItem.quantity} ${exportItem.productName} (Thời gian: ${new Date(exportItem.timestamp).toLocaleString()})`;
          exportDetails.push(detail);
        });
      }

      const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
      if (role === 'manager' || dateKey === today) {
        const reportDiv = document.createElement('div');
        const editFunc = role === 'manager' ? 'editManagerReport' : 'editEmployeeReport';
        const deleteFunc = role === 'manager' ? 'deleteManagerReport' : 'deleteEmployeeReport';
        const userParam = role === 'manager' ? `'${uid}',` : '';
        reportDiv.innerHTML = `
          <p>Báo cáo ${new Date(report.lastUpdated).toLocaleString()}${role === 'manager' ? ` (Nhân viên: ${report.user})` : ''}</p>
          <button class="action-btn" onclick="${editFunc}('${reportId}', '${dateKey}', ${userParam})">Sửa</button>
          <button class="action-btn" onclick="${deleteFunc}('${reportId}', '${dateKey}', ${userParam})">Xóa</button>
        `;
        reportsList.appendChild(reportDiv);
      }
    };

    if (role === 'manager') {
      Object.entries(data).forEach(([uid, userData]) => {
        if (userData.reports) {
          Object.entries(userData.reports).forEach(([reportId, report]) => {
            processReport(report, uid, reportId);
          });
        }
      });
    } else {
      Object.entries(data).forEach(([reportId, report]) => {
        processReport(report, currentUser.uid, reportId);
      });
    }

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
    console.log('Đã tải báo cáo tổng thành công cho', elementId, 'ngày', dateKey, 'vai trò', role);
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo: ' + error.message);
  });
}
