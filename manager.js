function addInventory() {
  const name = document.getElementById('product-name').value;
  const quantity = parseInt(document.getElementById('product-quantity').value);
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || isNaN(quantity) || isNaN(price)) {
    alert('Vui lòng nhập đầy đủ thông tin sản phẩm.');
    return;
  }

  const productId = db.ref('inventory').push().key;
  const timestamp = new Date().toLocaleString('vi-VN');
  db.ref('inventory/' + productId).set({
    name,
    quantity,
    price,
    unit: 'cái',
    timestamp
  }).then(() => {
    alert('Thêm sản phẩm thành công!');
    console.log('Đã thêm sản phẩm:', { productId, name, quantity, price });
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
  });
}
