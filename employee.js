function submitEmployeeReport() {
  const initialInventory = parseInt(document.getElementById('employee-initial-inventory').value);
  const finalInventory = parseInt(document.getElementById('employee-final-inventory').value);
  const revenue = parseFloat(document.getElementById('employee-revenue').value);
  const expenseAmount = parseFloat(document.getElementById('employee-expense-amount').value);
  const expenseInfo = document.getElementById('employee-expense-info').value;

  if (isNaN(initialInventory) || isNaN(finalInventory) || isNaN(revenue)) {
    alert('Vui lòng nhập đầy đủ thông tin tồn kho và doanh thu.');
    return;
  }

  const dateKey = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
  const user = firebase.auth().currentUser;
  if (!user) {
    alert('Vui lòng đăng nhập để gửi báo cáo.');
    return;
  }

  const reportData = {
    date: dateKey,
    user: user.email,
    initialInventory,
    finalInventory,
    revenue,
    lastUpdated: Date.now()
  };

  if (!isNaN(expenseAmount) && expenseAmount > 0) {
    reportData.expense = {
      amount: expenseAmount,
      info: expenseInfo || 'Không có thông tin',
      timestamp: Date.now()
    };
  }

  db.ref(`dailyData/${dateKey}/${user.uid}`).set(reportData).then(() => {
    alert('Gửi báo cáo thành công!');
    console.log('Đã gửi báo cáo:', reportData);
    document.getElementById('employee-initial-inventory').value = '';
    document.getElementById('employee-final-inventory').value = '';
    document.getElementById('employee-revenue').value = '';
    document.getElementById('employee-expense-amount').value = '';
    document.getElementById('employee-expense-info').value = '';
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi gửi báo cáo: ' + error.message);
  });
}
