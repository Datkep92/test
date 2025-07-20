function submitSharedReport() {
  const cost = document.getElementById('shared-cost').value;
  const revenue = document.getElementById('shared-revenue').value;
  const exportQty = document.getElementById('shared-export').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để gửi báo cáo!');
    return;
  }

  if (!cost || !revenue || !exportQty) {
    alert('Vui lòng nhập đầy đủ thông tin báo cáo!');
    return;
  }

  db.ref('shared_reports').push({
    cost: parseFloat(cost),
    revenue: parseFloat(revenue),
    export: parseFloat(exportQty),
    userId: user.uid,
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Báo cáo chung đã được gửi!');
    document.getElementById('shared-cost').value = '';
    document.getElementById('shared-revenue').value = '';
    document.getElementById('shared-export').value = '';
  }).catch(error => {
    console.error('Lỗi gửi báo cáo chung:', error);
    alert('Lỗi gửi báo cáo chung: ' + error.message);
  });
}

function loadProducts() {
  db.ref('inventory').on('value', snapshot => {
    const productSelect = document.getElementById('product-select');
    productSelect.innerHTML = '<option value="">Chọn sản phẩm</option>';
    snapshot.forEach(productSnapshot => {
      const product = productSnapshot.val();
      const option = document.createElement('option');
      option.value = productSnapshot.key;
      option.textContent = `${product.name} (Số lượng: ${product.quantity}, Đơn giá: ${product.price})`;
      productSelect.appendChild(option);
    });
  }, error => {
    console.error('Lỗi tải danh sách sản phẩm:', error);
    alert('Lỗi tải danh sách sản phẩm: ' + error.message);
  });
}

function exportStock() {
  const productId = document.getElementById('product-select').value;
  const quantity = document.getElementById('export-quantity').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để xuất kho!');
    return;
  }

  if (!productId || !quantity) {
    alert('Vui lòng chọn sản phẩm và nhập số lượng xuất kho!');
    return;
  }

  db.ref('exports').push({
    productId: productId,
    quantity: parseFloat(quantity),
    userId: user.uid,
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Đã xuất kho!');
    document.getElementById('product-select').value = '';
    document.getElementById('export-quantity').value = '';
  }).catch(error => {
    console.error('Lỗi xuất kho:', error);
    alert('Lỗi xuất kho: ' + error.message);
  });
}
