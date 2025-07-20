function addStock() {
  const stock = document.getElementById('stock').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để nhập kho!');
    return;
  }

  if (!stock) {
    alert('Vui lòng nhập số lượng nhập kho!');
    return;
  }

  db.ref('stock').push({
    quantity: parseFloat(stock),
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Đã nhập kho!');
    document.getElementById('stock').value = '';
  }).catch(error => {
    console.error('Lỗi nhập kho:', error);
    alert('Lỗi nhập kho: ' + error.message);
  });
}

function loadReports() {
  db.ref('reports').on('value', snapshot => {
    const reportsDiv = document.getElementById('reports');
    reportsDiv.innerHTML = '';
    snapshot.forEach(userSnapshot => {
      const userId = userSnapshot.key;
      const reports = userSnapshot.val();
      for (let reportId in reports) {
        const report = reports[reportId];
        const reportDiv = document.createElement('div');
        reportDiv.className = 'border p-4 mb-2 rounded';
        reportDiv.innerHTML = `
          <p><strong>User ID:</strong> ${userId}</p>
          <p><strong>Chi Phí:</strong> ${report.cost}</p>
          <p><strong>Doanh Thu:</strong> ${report.revenue}</p>
          <p><strong>Xuất Hàng:</strong> ${report.export}</p>
          <p><strong>Thời Gian:</strong> ${report.timestamp}</p>
        `;
        reportsDiv.appendChild(reportDiv);
      }
    });
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    alert('Lỗi tải báo cáo: ' + error.message);
  });
}
