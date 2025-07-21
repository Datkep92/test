function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) {
    console.error('Không tìm thấy phần tử shared-report-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo.');
    return;
  }

  const datePicker = document.getElementById('employee-date-picker');
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

  const selectedDate = datePicker.value; // Giá trị ngày dạng YYYY-MM-DD
  const dateKey = selectedDate ? selectedDate.replace(/-/g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');

  db.ref(`dailyData/${dateKey}/${currentUser.uid}/reports`).on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo cho ngày này.</p>';
      console.log('Không có dữ liệu báo cáo trong dailyData.');
      return;
    }

    let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
    let expenseDetails = [], revenueDetails = [], exportDetails = [];

    Object.entries(data).forEach(([reportId, report]) => {
      totalInitial += report.initialInventory || 0;
      totalFinal += report.finalInventory || 0;
      totalRevenue += report.revenue || 0;

      if (report.expenseHistory) {
        report.expenseHistory.forEach(expense => {
          totalExpense += expense.amount || 0;
          expenseDetails.push(`${expense.amount} (Thông tin: ${expense.info || 'Không có'}, Thời gian: ${new Date(expense.timestamp).toLocaleString()})`);
        });
      }

      if (report.revenue) {
        revenueDetails.push(`${report.revenue} (Thời gian: ${new Date(report.lastUpdated).toLocaleString()})`);
      }
      if (report.exports) {
        Object.values(report.exports).forEach(exportItem => {
          totalExport += exportItem.quantity || 0;
          exportDetails.push(`${exportItem.quantity} ${exportItem.productName} (Thời gian: ${new Date(exportItem.timestamp).toLocaleString()})`);
        });
      }

      // Thêm nút sửa/xóa cho báo cáo ngày hiện tại
      const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
      if (dateKey === today) {
        const reportDiv = document.createElement('div');
        reportDiv.innerHTML = `
          <p>Báo cáo ${new Date(report.lastUpdated).toLocaleString()}</p>
          <button class="action-btn" onclick="editEmployeeReport('${reportId}', '${dateKey}')">Sửa</button>
          <button class="action-btn" onclick="deleteEmployeeReport('${reportId}', '${dateKey}')">Xóa</button>
        `;
        reportsList.appendChild(reportDiv);
      }
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
    console.log('Đã tải báo cáo tổng thành công cho', elementId, 'ngày', dateKey);
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo: ' + error.message);
  });
}
function editEmployeeReport(reportId, dateKey) {
  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}/reports/${reportId}`);
  reportRef.once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      alert('Báo cáo không tồn tại.');
      return;
    }

    // Điền dữ liệu vào form để chỉnh sửa
    document.getElementById('employee-initial-inventory').value = report.initialInventory || '';
    document.getElementById('employee-final-inventory').value = report.finalInventory || '';
    document.getElementById('employee-revenue').value = report.revenue || '';
    document.getElementById('employee-expense-amount').value = report.expense?.amount || '';
    document.getElementById('employee-expense-info').value = report.expense?.info || '';

    // Thêm nút lưu chỉnh sửa
    const form = document.getElementById('employee-report-form');
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Lưu chỉnh sửa';
    saveButton.onclick = () => {
      submitEmployeeReport(); // Gọi lại hàm gửi để lưu báo cáo mới
      saveButton.remove(); // Xóa nút sau khi lưu
    };
    form.appendChild(saveButton);
  }).catch(error => {
    console.error('Lỗi tải báo cáo để chỉnh sửa:', error);
    alert('Lỗi: ' + error.message);
  });
}

function deleteEmployeeReport(reportId, dateKey) {
  if (!confirm('Bạn có chắc muốn xóa báo cáo này?')) return;

  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}/reports/${reportId}`);
  reportRef.remove().then(() => {
    alert('Xóa báo cáo thành công!');
    loadSharedReports('shared-report-table'); // Tải lại báo cáo
  }).catch(error => {
    console.error('Lỗi xóa báo cáo:', error);
    alert('Lỗi: ' + error.message);
  });
}
function editManagerReport(reportId, dateKey, uid) {
  const reportRef = db.ref(`dailyData/${dateKey}/${uid}/reports/${reportId}`);
  reportRef.once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      alert('Báo cáo không tồn tại.');
      return;
    }

    // Tạo form chỉnh sửa tạm thời
    const form = document.createElement('div');
    form.innerHTML = `
      <h3>Chỉnh sửa báo cáo</h3>
      <input id="edit-initial-inventory" type="number" placeholder="Tồn kho đầu kỳ" value="${report.initialInventory || ''}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <input id="edit-final-inventory" type="number" placeholder="Tồn kho cuối kỳ" value="${report.finalInventory || ''}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <input id="edit-revenue" type="number" placeholder="Doanh thu" value="${report.revenue || ''}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <input id="edit-expense-amount" type="number" placeholder="Chi phí" value="${report.expense?.amount || ''}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <input id="edit-expense-info" type="text" placeholder="Thông tin chi phí" value="${report.expense?.info || ''}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <button onclick="saveManagerReport('${reportId}', '${dateKey}', '${uid}')">Lưu</button>
    `;
    document.getElementById('manager-page').prepend(form);
  }).catch(error => {
    console.error('Lỗi tải báo cáo để chỉnh sửa:', error);
    alert('Lỗi: ' + error.message);
  });
}

function saveManagerReport(reportId, dateKey, uid) {
  const initialInventory = parseFloat(document.getElementById('edit-initial-inventory').value) || 0;
  const finalInventory = parseFloat(document.getElementById('edit-final-inventory').value) || 0;
  const revenue = parseFloat(document.getElementById('edit-revenue').value) || 0;
  const expenseAmount = parseFloat(document.getElementById('edit-expense-amount').value) || 0;
  const expenseInfo = document.getElementById('edit-expense-info').value.trim() || '';

  if (initialInventory < 0 || finalInventory < 0 || revenue < 0 || expenseAmount < 0) {
    alert('Vui lòng nhập giá trị không âm.');
    return;
  }

  const reportRef = db.ref(`dailyData/${dateKey}/${uid}/reports/${reportId}`);
  reportRef.once('value').then(snapshot => {
    const existingData = snapshot.val() || {};
    const newExpenseHistory = existingData.expenseHistory ? [...existingData.expenseHistory] : [];
    newExpenseHistory.push({ amount: expenseAmount, info: expenseInfo, timestamp: Date.now() });

    const updatedReport = {
      user: existingData.user || auth.currentUser.email,
      date: new Date().toLocaleDateString('vi-VN'),
      lastUpdated: Date.now(),
      initialInventory,
      finalInventory,
      revenue,
      expense: { amount: expenseAmount, info: expenseInfo, timestamp: Date.now() },
      expenseHistory: newExpenseHistory
    };

    return reportRef.set(updatedReport);
  }).then(() => {
    alert('Lưu chỉnh sửa thành công!');
    loadSharedReports('shared-report-table');
    document.querySelector('div > h3').parentElement.remove(); // Xóa form chỉnh sửa
  }).catch(error => {
    console.error('Lỗi lưu chỉnh sửa:', error);
    alert('Lỗi: ' + error.message);
  });
}

function deleteManagerReport(reportId, dateKey, uid) {
  if (!confirm('Bạn có chắc muốn xóa báo cáo này?')) return;

  const reportRef = db.ref(`dailyData/${dateKey}/${uid}/reports/${reportId}`);
  reportRef.remove().then(() => {
    alert('Xóa báo cáo thành công!');
    loadSharedReports('shared-report-table');
  }).catch(error => {
    console.error('Lỗi xóa báo cáo:', error);
    alert('Lỗi: ' + error.message);
  });
}
