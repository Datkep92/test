// File: js/inventory.js
let currentEditProductId = null;

function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("product-low-stock-threshold").value) || 10;

  if (!name || quantity <= 0 || price < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newProduct = {
    id: Date.now().toString(),
    name,
    quantity,
    price,
    lowStockThreshold,
    timestamp: new Date().toISOString()
  };

  db.ref("inventory/" + newProduct.id).set(newProduct)
    .then(() => {
      globalInventoryData.push(newProduct);
      alert("Thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
      document.getElementById("product-low-stock-threshold").value = "";
      renderInventory();
      checkLowStock(newProduct);
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

  const isExpanded = isExpandedStates.inventoryList || false;
  const displayItems = isExpanded ? globalInventoryData : globalInventoryData.slice(0, 5);

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-stt">STT</th>
        <th class="col-time">Ngày</th>
        <th class="col-name">Tên sản phẩm</th>
        <th class="col-sl">SL</th>
        <th class="col-money">Thành tiền</th>
        <th class="col-action">Thao tác</th>
      </tr>
    </thead>
    <tbody>
      ${displayItems.map((item, index) => `
        <tr class="${item.quantity < item.lowStockThreshold ? 'low-stock' : ''}">
          <td class="col-stt">${index + 1}</td>
          <td class="col-time">${new Date(item.timestamp).toLocaleDateString('vi-VN').slice(0, 5)}</td>
          <td class="col-name">${item.name}</td>
          <td class="col-sl">${item.quantity}</td>
          <td class="col-money">${(item.quantity * item.price).toLocaleString('vi-VN')}₫</td>
          <td class="col-action">
            <div class="action-buttons">
              <button onclick="openEditInventoryModal('${item.id}')">Sửa</button>
              <button onclick="deleteInventory('${item.id}')">Xóa</button>
            </div>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;

  container.appendChild(table);

  if (globalInventoryData.length > 5) {
    const expandBtn = document.createElement("button");
    expandBtn.textContent = isExpanded ? "Thu gọn" : "Xem thêm";
    expandBtn.className = "expand-btn";
    expandBtn.onclick = () => {
      isExpandedStates.inventoryList = !isExpandedStates.inventoryList;
      renderInventory();
    };
    container.appendChild(expandBtn);
  }

  globalInventoryData.forEach(item => checkLowStock(item));
}

function checkLowStock(item) {
  if (item.quantity < item.lowStockThreshold) {
    showToastNotification(`Cảnh báo: ${item.name} chỉ còn ${item.quantity} đơn vị!`);
    const user = auth.currentUser;
    if (user) {
      db.ref("notifications/general").push({
        message: `Sản phẩm ${item.name} chỉ còn ${item.quantity} đơn vị, dưới ngưỡng ${item.lowStockThreshold}!`,
        timestamp: Date.now(),
        readBy: {}
      }).catch(err => console.error("Lỗi gửi thông báo tồn kho thấp:", err));
    }
  }
}

function openEditInventoryModal(productId) {
  const product = globalInventoryData.find(p => p.id === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại!");
    return;
  }
  currentEditProductId = productId;
  document.getElementById("edit-product-name").value = product.name;
  document.getElementById("edit-product-quantity").value = product.quantity;
  document.getElementById("edit-product-price").value = product.price;
  document.getElementById("edit-product-low-stock-threshold").value = product.lowStockThreshold || 10;
  document.getElementById("edit-inventory-modal").style.display = "block";
}

function saveInventoryEdit() {
  const name = document.getElementById("edit-product-name").value.trim();
  const quantity = parseInt(document.getElementById("edit-product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("edit-product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("edit-product-low-stock-threshold").value) || 10;

  if (!name || quantity <= 0 || price < 0) {
    alert("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const updatedProduct = {
    name,
    quantity,
    price,
    lowStockThreshold,
    timestamp: new Date().toISOString()
  };

  db.ref("inventory/" + currentEditProductId).update(updatedProduct)
    .then(() => {
      const product = globalInventoryData.find(p => p.id === currentEditProductId);
      if (product) {
        product.name = name;
        product.quantity = quantity;
        product.price = price;
        product.lowStockThreshold = lowStockThreshold;
        product.timestamp = updatedProduct.timestamp;
      }
      alert("Cập nhật sản phẩm thành công!");
      closeModal("edit-inventory-modal");
      renderInventory();
      checkLowStock(updatedProduct);
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
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
