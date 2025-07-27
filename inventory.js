// Enhanced Inventory Management System
let currentEditProductId = null;
let inventorySortConfig = { field: 'timestamp', order: 'desc' };

// MAIN FUNCTIONS (preserved with enhancements)
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("product-low-stock-threshold").value) || 10;

  // ENHANCED VALIDATION
  if (!name) {
    showToastNotification("Vui lòng nhập tên sản phẩm!");
    return;
  }
  if (quantity <= 0) {
    showToastNotification("Số lượng phải lớn hơn 0!");
    return;
  }
  if (price < 0) {
    showToastNotification("Giá sản phẩm không hợp lệ!");
    return;
  }

  const newProduct = {
    id: generateId(), // NEW: Better ID generation
    name,
    quantity,
    price,
    lowStockThreshold,
    createdBy: currentUser?.uid || 'system',
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };

  db.ref("inventory/" + newProduct.id).set(newProduct)
    .then(() => {
      globalInventoryData.push(newProduct);
      showToastNotification("Thêm sản phẩm thành công!", 'success');
      resetInventoryForm();
      renderInventory();
      checkLowStock(newProduct);
      logInventoryAction('add', newProduct); // NEW: Action logging
    })
    .catch(err => {
      console.error("Lỗi khi thêm sản phẩm:", err);
      showToastNotification("Lỗi khi thêm sản phẩm: " + err.message, 'error');
    });
}

// ENHANCED RENDER FUNCTION
function renderInventory() {
  const container = document.getElementById("inventory-list");
  if (!container) {
    console.warn("Container 'inventory-list' không tồn tại");
    return;
  }

  // NEW: Sorting
  const sortedInventory = [...globalInventoryData].sort((a, b) => {
    if (inventorySortConfig.field === 'name') {
      return inventorySortConfig.order === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    return inventorySortConfig.order === 'asc'
      ? new Date(a[inventorySortConfig.field]) - new Date(b[inventorySortConfig.field])
      : new Date(b[inventorySortConfig.field]) - new Date(a[inventorySortConfig.field]);
  });

  // NEW: Filtering
  const searchTerm = document.getElementById('inventory-search')?.value.toLowerCase() || '';
  const filteredInventory = sortedInventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    item.id.toLowerCase().includes(searchTerm)
  );

  // NEW: Pagination
  const pageSize = 10;
  const currentPage = isExpandedStates.inventoryPage || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = filteredInventory.slice(startIndex, startIndex + pageSize);

  // Build table (preserving original structure)
  container.innerHTML = `
    <div class="inventory-controls">
      <input type="text" id="inventory-search" placeholder="Tìm kiếm..." oninput="renderInventory()">
      <select id="inventory-sort" onchange="handleInventorySortChange()">
        <option value="timestamp-desc">Mới nhất</option>
        <option value="timestamp-asc">Cũ nhất</option>
        <option value="name-asc">Tên A-Z</option>
        <option value="name-desc">Tên Z-A</option>
      </select>
    </div>
    <table class="table-style">
      <thead>
        <tr>
          <th>STT</th>
          <th>Thời gian</th>
          <th>Tên</th>
          <th>Số lượng</th>
          <th>Đơn giá</th>
          <th>Thành tiền</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${paginatedItems.map((item, index) => `
          <tr class="${item.quantity < item.lowStockThreshold ? 'low-stock' : ''}">
            <td>${startIndex + index + 1}</td>
            <td>${formatDateTime(item.timestamp)}</td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.quantity * item.price)}</td>
            <td class="action-buttons">
              <button onclick="openEditInventoryModal('${item.id}')">Sửa</button>
              <button onclick="adjustInventory('${item.id}', 'increase')">+</button>
              <button onclick="adjustInventory('${item.id}', 'decrease')">-</button>
              <button onclick="deleteInventory('${item.id}')">Xóa</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${renderInventoryPagination(filteredInventory.length, pageSize, currentPage)}
  `;

  // NEW: Initialize sort dropdown
  const sortSelect = document.getElementById('inventory-sort');
  if (sortSelect) {
    sortSelect.value = `${inventorySortConfig.field}-${inventorySortConfig.order}`;
  }
}

// NEW: Helper functions
function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('vi-VN');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function handleInventorySortChange() {
  const [field, order] = document.getElementById('inventory-sort').value.split('-');
  inventorySortConfig = { field, order };
  renderInventory();
}

function renderInventoryPagination(totalItems, pageSize, currentPage) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';
  
  let paginationHtml = '<div class="pagination">';
  for (let i = 1; i <= totalPages; i++) {
    paginationHtml += `
      <button ${i === currentPage ? 'class="active"' : ''} 
        onclick="changeInventoryPage(${i})">
        ${i}
      </button>`;
  }
  paginationHtml += '</div>';
  return paginationHtml;
}

function changeInventoryPage(page) {
  isExpandedStates.inventoryPage = page;
  renderInventory();
}

// ENHANCED CHECK LOW STOCK
function checkLowStock(item) {
  if (item.quantity < item.lowStockThreshold) {
    const message = `Cảnh báo: ${item.name} chỉ còn ${item.quantity} đơn vị (ngưỡng: ${item.lowStockThreshold})`;
    showToastNotification(message, 'warning');
    
    // NEW: Send to responsible person
    const responsiblePerson = getResponsiblePersonForInventory();
    if (responsiblePerson) {
      sendNotification(responsiblePerson.id, message, 'inventory_low_stock', {
        productId: item.id,
        productName: item.name,
        currentQuantity: item.quantity,
        threshold: item.lowStockThreshold
      });
    }
    
    // Keep original general notification
    db.ref("notifications/general").push({
      message,
      timestamp: Date.now(),
      type: 'inventory_warning',
      productId: item.id
    }).catch(err => console.error("Lỗi gửi thông báo tồn kho thấp:", err));
  }
}

// NEW: Inventory adjustment
function adjustInventory(productId, action) {
  const product = globalInventoryData.find(p => p.id === productId);
  if (!product) return;

  const amount = parseInt(prompt(`Nhập số lượng muốn ${action === 'increase' ? 'tăng' : 'giảm'}:`)) || 0;
  if (amount <= 0) return;

  const newQuantity = action === 'increase' 
    ? product.quantity + amount 
    : product.quantity - amount;

  if (newQuantity < 0) {
    showToastNotification("Số lượng không thể âm!", 'error');
    return;
  }

  const update = {
    quantity: newQuantity,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: currentUser?.uid || 'system'
  };

  db.ref(`inventory/${productId}`).update(update)
    .then(() => {
      Object.assign(product, update);
      renderInventory();
      checkLowStock(product);
      logInventoryAction('adjust', { productId, action, amount });
      showToastNotification(`Đã ${action === 'increase' ? 'tăng' : 'giảm'} ${amount} đơn vị cho ${product.name}`, 'success');
    })
    .catch(err => {
      console.error("Lỗi điều chỉnh tồn kho:", err);
      showToastNotification("Lỗi khi điều chỉnh tồn kho: " + err.message, 'error');
    });
}

// NEW: Inventory action logging
function logInventoryAction(action, data) {
  const logEntry = {
    action,
    data,
    timestamp: new Date().toISOString(),
    performedBy: currentUser?.uid || 'system'
  };
  
  db.ref(`inventoryLogs/${generateId()}`).set(logEntry)
    .catch(err => console.error("Lỗi ghi log hành động kho:", err));
}

// PRESERVED EDIT/DELETE FUNCTIONS (with minor enhancements)
function openEditInventoryModal(productId) {
  const product = globalInventoryData.find(p => p.id === productId);
  if (!product) {
    showToastNotification("Sản phẩm không tồn tại!", 'error');
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
  const product = globalInventoryData.find(p => p.id === currentEditProductId);
  if (!product) {
    showToastNotification("Sản phẩm không tồn tại!", 'error');
    return;
  }

  const name = document.getElementById("edit-product-name").value.trim();
  const quantity = parseInt(document.getElementById("edit-product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("edit-product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("edit-product-low-stock-threshold").value) || 10;

  // Enhanced validation
  if (!name || quantity < 0 || price < 0) {
    showToastNotification("Vui lòng nhập thông tin hợp lệ!", 'error');
    return;
  }

  const update = {
    name,
    quantity,
    price,
    lowStockThreshold,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: currentUser?.uid || 'system'
  };

  db.ref("inventory/" + currentEditProductId).update(update)
    .then(() => {
      Object.assign(product, update);
      showToastNotification("Cập nhật sản phẩm thành công!", 'success');
      closeModal("edit-inventory-modal");
      renderInventory();
      checkLowStock(product);
      logInventoryAction('edit', { productId: currentEditProductId, changes: update });
    })
    .catch(err => {
      console.error("Lỗi cập nhật sản phẩm:", err);
      showToastNotification("Lỗi khi cập nhật sản phẩm: " + err.message, 'error');
    });
}

function deleteInventory(productId) {
  if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
  
  db.ref("inventory/" + productId).remove()
    .then(() => {
      globalInventoryData = globalInventoryData.filter(item => item.id !== productId);
      renderInventory();
      showToastNotification("Xóa sản phẩm thành công!", 'success');
      logInventoryAction('delete', { productId });
    })
    .catch(err => {
      console.error("Lỗi xóa sản phẩm:", err);
      showToastNotification("Lỗi khi xóa sản phẩm: " + err.message, 'error');
    });
}

// NEW: Get responsible person for inventory
function getResponsiblePersonForInventory() {
  // Implement logic to get inventory manager
  // Could be from user role or specific assignment
  return globalEmployees.find(e => e.roles?.includes('inventory_manager')) || null;
}