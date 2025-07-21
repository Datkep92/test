function submitEmployeeReport() {
  const initialInventory = parseFloat(document.getElementById('employee-initial-inventory').value) || 0;
  const finalInventory = parseFloat(document.getElementById('employee-final-inventory').value) || 0;
  const revenue = parseFloat(document.getElementById('employee-revenue').value) || 0;
  const expenseAmount = parseFloat(document.getElementById('employee-expense-amount').value) || 0;
  const expenseInfo = document.getElementById('employee-expense-info').value.trim() || '';

  if (initialInventory < 0 || finalInventory < 0 || revenue < 0 || expenseAmount < 0) {
    alert('Vui lòng nhập giá trị không âm.');
    return;
  }

  const exportInputs = document.getElementsByClassName('export-quantity');
  const exportQuantities = Array.from(exportInputs).reduce((acc, input) => {
    const qty = parseFloat(input.value) || 0;
    if (qty > 0 && qty <= parseFloat(input.max)) {
      acc[input.dataset.productId] = {
        productId: input.dataset.productId,
        quantity: qty,
        productName: input.dataset.productName,
        price: parseFloat(input.dataset.productPrice) || 0,
        unit: input.dataset.productUnit || 'cái',
        timestamp: Date.now()
      };
    }
    return acc;
  }, {});

  const reportData = {
    user: auth.currentUser.email,
    date: new Date().toLocaleDateString('vi-VN'),
    lastUpdated: Date.now(),
    initialInventory,
    finalInventory,
    revenue,
    expense: { amount: expenseAmount, info: expenseInfo, timestamp: Date.now() }
  };
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  const dateKey = reportData.date.replace(/\//g, '_');
  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}`);
  reportRef.once('value').then(snapshot => {
    const existingData = snapshot.val() || {};
    const newExpenseHistory = existingData.expenseHistory ? [...existingData.expenseHistory] : [];
    newExpenseHistory.push({ amount: expenseAmount, info: expenseInfo, timestamp: Date.now() });

    const newReport = {
      ...existingData,
      ...reportData,
      expenseHistory: newExpenseHistory
    };
    return reportRef.update(newReport);
  }).then(() => {
    if (Object.keys(exportQuantities).length > 0) {
      return Promise.all(Object.entries(exportQuantities).map(([productId, exportItem]) => {
        return db.ref('inventory/' + productId).once('value').then(snapshot => {
          const product = snapshot.val();
          if (product && product.quantity >= exportItem.quantity) {
            return db.ref('inventory/' + productId).update({
              quantity: product.quantity - exportItem.quantity
            });
          } else {
            throw new Error(`Số lượng xuất kho vượt quá tồn kho cho ${product.name}`);
          }
        });
      }));
    }
  }).then(() => {
    alert('Gửi báo cáo thành công!');
    document.getElementById('employee-initial-inventory').value = '';
    document.getElementById('employee-final-inventory').value = '';
    document.getElementById('employee-revenue').value = '';
    document.getElementById('employee-expense-amount').value = '';
    document.getElementById('employee-expense-info').value = '';
    Array.from(exportInputs).forEach(input => input.value = '');
    loadInventory('employee-inventory-list');
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi: ' + error.message);
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
          const user = report.user || 'Không xác định';
          report.expenseHistory.forEach(expense => {
            const expenseType = expense.info.trim().toLowerCase() || 'Không có thông tin';
            if (!expenseSummary[expenseType]) {
              expenseSummary[expenseType] = { total: 0, count: 0, details: [] };
            }
            expenseSummary[expenseType].total += expense.amount;
            expenseSummary[expenseType].count += 1;
            expenseSummary[expenseType].details.push({
              amount: expense.amount,
              timestamp: new Date(expense.timestamp).toLocaleString(),
              user: user
            });
          });
        }
      });
    });

    let html = '<table style="border-collapse: collapse; width: 100%; margin-top: 16px;"><tr><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Loại chi phí</th><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Tổng chi phí</th><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Số lượng giao dịch</th><th style="border: 1px solid #ccc; padding: 8px; background: #f3f4f6;">Chi tiết</th></tr>';
    let grandTotal = 0;
    let grandCount = 0;
    Object.entries(expenseSummary).forEach(([type, summary]) => {
      html += `<tr><td style="border: 1px solid #ccc; padding: 8px;">${type}</td><td style="border: 1px solid #ccc; padding: 8px;">${summary.total}</td><td style="border: 1px solid #ccc; padding: 8px;">${summary.count}</td><td style="border: 1px solid #ccc; padding: 8px;">${summary.details.map(d => `${d.amount} (${d.timestamp} - ${d.user})`).join('<br>')}</td></tr>`;
      grandTotal += summary.total;
      grandCount += summary.count;
    });
    html += `<tr><td style="border: 1px solid #ccc; padding: 8px;"><strong>Tổng cộng</strong></td><td style="border: 1px solid #ccc; padding: 8px;"><strong>${grandTotal}</strong></td><td style="border: 1px solid #ccc; padding: 8px;"><strong>${grandCount}</strong></td><td style="border: 1px solid #ccc; padding: 8px;"></td></tr></table>`;
    summaryTable.innerHTML = html;
    console.log('Đã tải tổng hợp chi phí thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tổng hợp chi phí:', error);
    summaryTable.innerHTML = '<p style="margin: 0;">Lỗi tải tổng hợp chi phí: ' + error.message + '</p>';
    alert('Lỗi tải tổng hợp chi phí: ' + error.message);
  });
}
