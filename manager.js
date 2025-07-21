
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
