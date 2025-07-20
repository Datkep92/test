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

function addInventory() {
  const name = document.getElementById('product-name').value;
  const quantity = document.getElementById('product-quantity').value;
  const price = document.getElementById('product-price').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để thêm sản phẩm!');
    return;
  }

  if (!name || !quantity || !price) {
    alert('Vui lòng nhập đầy đủ thông tin sản phẩm!');
    return;
  }

  db.ref('inventory').push({
    name: name,
    quantity: parseFloat(quantity),
    price: parseFloat(price),
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Đã thêm sản phẩm vào tồn kho!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
  });
}

function loadInventory() {
  db.ref('inventory').on('value', snapshot => {
    const inventoryDiv = document.getElementById('inventory-list');
    inventoryDiv.innerHTML = '';
    snapshot.forEach(productSnapshot => {
      const product = productSnapshot.val();
      const productDiv = document.createElement('div');
      productDiv.className = 'border p-4 mb-2 rounded';
      productDiv.innerHTML = `
        <p><strong>Tên sản phẩm:</strong> ${product.name}</p>
        <p><strong>Số lượng:</strong> ${product.quantity}</p>
        <p><strong>Đơn giá:</strong> ${product.price}</p>
        <p><strong>Thời gian:</strong> ${product.timestamp}</p>
      `;
      inventoryDiv.appendChild(productDiv);
    });
  }, error => {
    console.error('Lỗi tải danh sách tồn kho:', error);
    alert('Lỗi tải danh sách tồn kho: ' + error.message);
  });
}

function loadSharedReports(divId) {
  db.ref('shared_reports').on('value', snapshot => {
    const reportsDiv = document.getElementById(divId);
    reportsDiv.innerHTML = '';
    snapshot.forEach(reportSnapshot => {
      const report = reportSnapshot.val();
      const reportDiv = document.createElement('div');
      reportDiv.className = 'border p-4 mb-2 rounded';
      reportDiv.innerHTML = `
        <p><strong>User ID:</strong> ${report.userId}</p>
        <p><strong>Chi Phí:</strong> ${report.cost}</p>
        <p><strong>Doanh Thu:</strong> ${report.revenue}</p>
        <p><strong>Xuất Hàng:</strong> ${report.export}</p>
        <p><strong>Thời Gian:</strong> ${report.timestamp}</p>
      `;
      reportsDiv.appendChild(reportDiv);
    });
  }, error => {
    console.error('Lỗi tải báo cáo chung:', error);
    alert('Lỗi tải báo cáo chung: ' + error.message);
  });
}
