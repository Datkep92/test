// manager.js

function addInventory() {
  const name = document.getElementById('product-name').value.trim();
  const quantity = parseInt(document.getElementById('product-quantity').value);
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || isNaN(quantity) || isNaN(price)) {
    alert('Vui lòng nhập đúng thông tin sản phẩm.');
    return;
  }

  const productId = db.ref('inventory').push().key;
  const item = {
    name,
    quantity,
    price,
    unit: 'cái',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  db.ref('inventory/' + productId).set(item)
    .then(() => {
      alert('Đã thêm sản phẩm.');
      document.getElementById('product-name').value = '';
      document.getElementById('product-quantity').value = '';
      document.getElementById('product-price').value = '';
    })
    .catch(err => {
      console.error(err);
      alert('Lỗi khi thêm sản phẩm: ' + err.message);
    });
}
