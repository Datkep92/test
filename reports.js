function loadInventory(elementId, role = 'employee') {
  const container = document.getElementById(elementId);
  if (!container) return;

  db.ref('inventory').on('value', snapshot => {
    const data = snapshot.val() || {};
    let html = '<ul style="list-style:none;padding:0;">';
    Object.entries(data).forEach(([id, item]) => {
      html += `
        <li style="padding: 8px; border-bottom: 1px solid #ccc;">
          ${item.name}: ${item.quantity} ${item.unit} (Giá: ${item.price})
          ${role === 'manager' ? `
            <button onclick="editInventory('${id}')" style="margin-left: 8px;">✏️</button>
            <button onclick="deleteInventory('${id}')" style="margin-left: 4px; color:red;">🗑</button>
          ` : ''}
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  });
}

function deleteInventory(productId) {
  if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
  db.ref('inventory/' + productId).remove()
    .then(() => alert('Đã xóa thành công!'))
    .catch(err => alert('Lỗi xóa: ' + err.message));
}

function editInventory(productId) {
  db.ref('inventory/' + productId).once('value').then(snapshot => {
    const data = snapshot.val();
    const newName = prompt('Tên mới:', data.name);
    const newPrice = prompt('Giá mới:', data.price);
    const newQuantity = prompt('Số lượng mới:', data.quantity);
    if (isNaN(newPrice) || isNaN(newQuantity)) return alert('Giá và số lượng phải là số.');
    const updates = {
      name: newName,
      price: parseFloat(newPrice),
      quantity: parseInt(newQuantity),
      timestamp: new Date().toLocaleString('vi-VN')
    };
    db.ref('inventory/' + productId).update(updates)
      .then(() => alert('Đã cập nhật sản phẩm.'))
      .catch(err => alert('Lỗi cập nhật: ' + err.message));
  });
}

function loadExpenseSummary(elementId) {
  const container = document.getElementById(elementId);
  if (!container) return;

  db.ref('expenseCategories').once('value', snapshot => {
    const categories = snapshot.val() || {};
    let html = '<table class="summary-table"><thead><tr><th>Loại chi phí</th><th>Tên</th></tr></thead><tbody>';
    Object.entries(categories).forEach(([id, name]) => {
      html += `<tr><td>${id}</td><td>${name}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  });
}

function loadSharedReports(elementId, uid) {
  const container = document.getElementById(elementId);
  if (!container) return;

  db.ref('dailyData').once('value', snapshot => {
    const data = snapshot.val() || {};
    let html = '<table class="summary-table"><thead><tr><th>Ngày</th><th>Người dùng</th><th>Doanh thu</th></tr></thead><tbody>';

    Object.entries(data).forEach(([date, users]) => {
      Object.entries(users).forEach(([userId, entry]) => {
        html += `<tr>
          <td>${entry.date || date}</td>
          <td>${entry.user || userId}</td>
          <td>${entry.revenue || 0}</td>
        </tr>`;
      });
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  });
}
