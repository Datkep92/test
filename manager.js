function addInventory() {
  const name = document.getElementById('product-name').value.trim();
  const quantity = parseFloat(document.getElementById('product-quantity').value);
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || isNaN(quantity) || isNaN(price) || quantity < 0 || price < 0) {
    alert('Vui lòng nhập đầy đủ thông tin hợp lệ.');
    return;
  }

  const inventoryRef = db.ref('inventory').push();
  inventoryRef.set({
    name,
    quantity,
    price,
    unit: 'cái',
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Thêm sản phẩm thành công!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
    console.log('Đã thêm sản phẩm:', name);
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
  });
}

function loadInventory(elementId) {
  const inventoryList = document.getElementById(elementId);
  if (!inventoryList) {
    console.error('Không tìm thấy phần tử inventory-list trong DOM');
    alert('Lỗi: Không tìm thấy danh sách tồn kho.');
    return;
  }

  db.ref('inventory').on('value', snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      inventoryList.innerHTML = '<p style="margin: 0;">Không có dữ liệu tồn kho.</p>';
      console.log('Không có dữ liệu tồn kho trong Firebase.');
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.style.cssText = 'display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #ccc;';
      div.innerHTML = `
        <span>${product.name} (Số lượng: ${product.quantity})</span>
        <input type="number" min="0" max="${product.quantity}" class="export-quantity" style="width: 100px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;" data-product-id="${productId}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-unit="${product.unit || 'cái'}" placeholder="Số lượng xuất">
      `;
      inventoryList.appendChild(div);
    });
    console.log('Đã tải danh sách tồn kho thành công cho', elementId, Object.keys(data));
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p style="margin: 0;">Lỗi tải tồn kho: ' + error.message + '</p>';
    alert('Lỗi tải tồn kho: ' + error.message);
  });
}

function loadExpenseSummary(elementId) {
  const summaryTable = document.getElementById(elementId);
  if (!summaryTable) {
    console.error('Không tìm thấy phần tử expense-summary-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng tổng hợp chi phí.');
    return;
  }

  db.ref('dailyData').on('value', snapshot => {
    summaryTable.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      summaryTable.innerHTML = '<p style="margin: 0;">Không có dữ liệu chi phí.</p>';
      console.log('Không có dữ liệu chi phí trong dailyData.');
      return;
    }

    const expenseSummary = {};
    Object.entries(data).forEach(([date, users]) => {
      Object.entries(users).forEach(([uid, report]) => {
        if (report.expenseHistory) {
          report.expenseHistory.forEach(expense => {
            const expenseType = expense.info.trim().toLowerCase();
            if (!expenseSummary[expenseType]) {
              expenseSummary[expenseType] = { total: 0, count: 0 };
            }
            expenseSummary[expenseType].total += expense.amount;
            expenseSummary[expenseType].count += 1;
          });
        }
      });
    });

    let html = '<table style="border-collapse: collapse; width: 100%; margin-top: 16px;"><tr><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Loại chi phí</th><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Tổng chi phí</th><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Số lượng giao dịch</th></tr>';
    let grandTotal = 0;
    let grandCount = 0;
    Object.entries(expenseSummary).forEach(([type, summary]) => {
      html += `<tr><td style="border: 1px solid #ccc; padding: 8px;">${type}</td><td style="border: 1px solid #ccc; padding: 8px;">${summary.total}</td><td style="border: 1px solid #ccc; padding: 8px;">${summary.count}</td></tr>`;
      grandTotal += summary.total;
      grandCount += summary.count;
    });
    html += `<tr><td style="border: 1px solid #ccc; padding: 8px;"><strong>Tổng cộng</strong></td><td style="border: 1px solid #ccc; padding: 8px;"><strong>${grandTotal}</strong></td><td style="border: 1px solid #ccc; padding: 8px;"><strong>${grandCount}</strong></td></tr></table>`;
    summaryTable.innerHTML = html;
    console.log('Đã tải tổng hợp chi phí thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tổng hợp chi phí:', error);
    summaryTable.innerHTML = '<p style="margin: 0;">Lỗi tải tổng hợp chi phí: ' + error.message + '</p>';
    alert('Lỗi tải tổng hợp chi phí: ' + error.message);
  });
}
