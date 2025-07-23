// Inventory Tab Functions
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  if (!name || quantity <= 0 || price < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newProduct = {
    id: Date.now().toString(),
    name,
    quantity,
    price,
    timestamp: new Date().toISOString()
  };

  db.ref("inventory/" + newProduct.id).set(newProduct)
    .then(() => {
      globalInventoryData.push(newProduct);
      alert("Thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
      renderInventory();
    })
    .catch(err => alert("Lỗi khi thêm sản phẩm: " + err.message));
}

function renderInventory() {
  const container = document.getElementById("inventory-list");
  if (!container) {
    console.warn("Container 'inventory-list' không tồn tại trong DOM.");
    return;
  }
  container.innerHTML = "";
  if (!globalInventoryData || globalInventoryData.length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  globalInventoryData.forEach(item => {
    const div = document.createElement("div");
    div.innerHTML = `${item.name}: ${item.quantity} - ${item.price.toLocaleString('vi-VN')} VND <button onclick="deleteInventory('${item.id}')">Xóa</button>`;
    container.appendChild(div);
  });
}

function deleteInventory(productId) {
  if (!confirm("Xóa sản phẩm này?")) return;
  db.ref("inventory/" + productId).remove()
    .then(() => {
      globalInventoryData = globalInventoryData.filter(item => item.id !== productId);
      renderInventory();
      alert("Xóa sản phẩm thành công!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}