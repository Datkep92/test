// employee.js (cập nhật: tất cả nhân viên cộng dồn vào 1 bảng báo cáo duy nhất mỗi ngày)

function loadEmployeeInventory(elementId) {
  const inventoryList = document.getElementById(elementId);
  if (!inventoryList) return;

  db.ref('inventory').once('value').then(snapshot => {
    const data = snapshot.val();
    inventoryList.innerHTML = '';
    if (!data) {
      inventoryList.innerHTML = '<p>Không có dữ liệu tồn kho.</p>';
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b cursor-pointer hover:bg-gray-100';
      div.innerHTML = `
        <p><strong>${product.name}</strong> - Tồn: ${product.quantity}</p>
        <input type="number" min="0" class="export-quantity mt-1 border p-1 w-full" data-product-id="${productId}" placeholder="Số lượng xuất...">
      `;
      inventoryList.appendChild(div);
    });
  }).catch(error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p>Lỗi tải tồn kho.</p>';
  });
}

window.loadEmployeeInventory = loadEmployeeInventory;

function submitSharedReport() {
  const openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;
  const costInput = document.getElementById('shared-cost').value;
  const revenue = parseFloat(document.getElementById('shared-revenue').value) || 0;
  const closingBalance = parseFloat(document.getElementById('closing-balance').value) || 0;

  const exportQuantities = Array.from(document.getElementsByClassName('export-quantity')).reduce((acc, input) => {
    const productId = input.dataset.productId;
    const qty = parseFloat(input.value) || 0;
    if (qty > 0) acc[productId] = qty;
    return acc;
  }, {});

  if (openingBalance === 0 && !costInput && revenue === 0 && closingBalance === 0 && Object.keys(exportQuantities).length === 0) {
    alert('Vui lòng nhập ít nhất một trường thông tin.');
    return;
  }

  const uid = auth.currentUser.uid;
  const date = new Date().toISOString().split('T')[0];

  db.ref('users/' + uid + '/name').once('value').then(snapshot => {
    const name = snapshot.val() || 'Không rõ';
    return db.ref('shared_reports/' + date).transaction(current => {
      if (!current) current = {};

      current.totalOpeningBalance = (current.totalOpeningBalance || 0) + openingBalance;
      current.totalRevenue = (current.totalRevenue || 0) + revenue;
      current.totalClosingBalance = (current.totalClosingBalance || 0) + closingBalance;

      if (costInput) {
        const expense = parseExpenseInput(costInput);
        current.totalCost = (current.totalCost || 0) + expense.amount;
        if (!current.costDetails) current.costDetails = [];
        current.costDetails.push({
          uid,
          name,
          amount: expense.amount,
          description: expense.description,
          category: expense.category
        });
      }

      if (Object.keys(exportQuantities).length > 0) {
        current.totalExport = (current.totalExport || 0);
        if (!current.exports) current.exports = {};
        Object.entries(exportQuantities).forEach(([productId, qty]) => {
          current.totalExport += qty;
          current.exports[productId] = (current.exports[productId] || 0) + qty;
        });
      }

      if (!current.entries) current.entries = [];
      current.entries.push({ uid, name, openingBalance, revenue, closingBalance, costInput, exportQuantities, timestamp: new Date().toISOString() });
      return current;
    });
  }).then(() => {
    return Promise.all(Object.entries(exportQuantities).map(([productId, qty]) => {
      return db.ref('inventory/' + productId).once('value').then(snapshot => {
        const product = snapshot.val();
        if (product && product.quantity >= qty) {
          return db.ref('inventory/' + productId).update({
            quantity: product.quantity - qty
          });
        } else {
          throw new Error('Số lượng xuất kho vượt quá tồn kho.');
        }
      });
    }));
  }).then(() => {
    alert('Gửi báo cáo thành công!');
    document.getElementById('opening-balance').value = '';
    document.getElementById('shared-cost').value = '';
    document.getElementById('shared-revenue').value = '';
    document.getElementById('closing-balance').value = '';
    document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi gửi báo cáo: ' + error.message);
  });
}

function parseExpenseInput(input) {
  const match = input.match(/^(.*?)\s*(\d+(\.\d+)?)(\s*-\s*(.*))?$/);
  if (match) {
    return {
      description: match[1].trim(),
      amount: parseFloat(match[2]),
      category: match[5] ? match[5].trim() : 'Khác'
    };
  }
  return { amount: 0, description: '', category: 'Khác' };
}
