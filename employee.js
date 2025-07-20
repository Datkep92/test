function submitReport() {
  const cost = document.getElementById('cost').value;
  const revenue = document.getElementById('revenue').value;
  const exportQty = document.getElementById('export').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để gửi báo cáo!');
    return;
  }

  if (!cost || !revenue || !exportQty) {
    alert('Vui lòng nhập đầy đủ thông tin báo cáo!');
    return;
  }

  db.ref('reports/' + user.uid).push({
    cost: parseFloat(cost),
    revenue: parseFloat(revenue),
    export: parseFloat(exportQty),
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Báo cáo đã được gửi!');
    document.getElementById('cost').value = '';
    document.getElementById('revenue').value = '';
    document.getElementById('export').value = '';
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi gửi báo cáo: ' + error.message);
  });
}
