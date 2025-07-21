function submitEmployeeReport() {
  const initial = parseInt(document.getElementById('employee-initial').value);
  const final = parseInt(document.getElementById('employee-final').value);
  const revenue = parseFloat(document.getElementById('employee-revenue').value);
  const expenseAmount = parseFloat(document.getElementById('employee-expense-amount').value);
  const expenseNote = document.getElementById('employee-expense-note').value.trim();

  if (isNaN(initial) || isNaN(final) || isNaN(revenue)) {
    alert('Vui lòng nhập đủ tồn kho và doanh thu.');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert('Chưa đăng nhập.');
    return;
  }

  const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
  const reportRef = db.ref(`dailyData/${today}/${user.uid}`);

  const reportData = {
    date: today,
    user: user.email,
    initialInventory: initial,
    finalInventory: final,
    revenue: revenue,
    lastUpdated: Date.now()
  };

  if (!isNaN(expenseAmount) && expenseAmount > 0) {
    reportData.expense = {
      amount: expenseAmount,
      info: expenseNote || 'Không rõ',
      timestamp: Date.now()
    };
  }

  reportRef.set(reportData)
    .then(() => {
      alert('Gửi báo cáo thành công!');
      // Reset form
      ['initial', 'final', 'revenue', 'expense-amount', 'expense-note'].forEach(id => {
        document.getElementById(`employee-${id}`).value = '';
      });
    })
    .catch(err => {
      console.error(err);
      alert('Lỗi gửi báo cáo: ' + err.message);
    });
}
