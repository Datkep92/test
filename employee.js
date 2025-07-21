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
    expense: { amount: expenseAmount, info: expenseInfo }
  };
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  const dateKey = reportData.date.replace(/\//g, '_');
  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}`);
  reportRef.set(reportData).then(() => {
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

function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) {
    console.error('Không tìm thấy phần tử shared-report-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo.');
    return;
  }

  const filter = document.getElementById('employee-report-filter');
  if (!filter) {
    console.error('Không tìm thấy phần tử report-filter trong DOM');
    alert('Lỗi: Không tìm thấy bộ lọc báo cáo.');
    return;
  }

  db.ref('dailyData').on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo.</p>';
      console.log('Không có dữ liệu báo cáo trong dailyData.');
      return;
    }

    const filterType = filter.value;
    let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
    let expenseDetails = [], revenueDetails = [], exportDetails = [];

    Object.entries(data).forEach(([date, users]) => {
      const formattedDate = date.replace(/_/g, '/');
      const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
      Object.entries(users).forEach(([uid, report]) => {
        if (!/^[a-zA-Z0-9]+$/.test(uid)) {
          console.warn('Bỏ qua key không hợp lệ:', uid);
          return;
        }
        totalInitial += report.initialInventory || 0;
        totalFinal += report.finalInventory || 0;
        totalRevenue += report.revenue || 0;
        if (report.expense && report.expense.amount) {
          totalExpense += report.expense.amount;
          expenseDetails.push(`${report.expense.amount} (Thông tin: ${report.expense.info || 'Không có'}, Nhân viên: ${report.user})`);
        }
        if (report.revenue) {
          revenueDetails.push(`${report.revenue} (Nhân viên: ${report.user})`);
        }
        if (report.exports) {
          Object.values(report.exports).forEach(exportItem => {
            totalExport += exportItem.quantity || 0;
            exportDetails.push(`${exportItem.quantity} ${exportItem.productName} (Nhân viên: ${report.user})`);
          });
        }
      });
    });

    const remainingBalance = totalRevenue - totalExpense;

    let html = `
      <div style="margin-bottom: 16px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        <p><strong>Tổng Tồn kho đầu kỳ:</strong> ${totalInitial}</p>
        <p><strong>Tổng Tồn kho cuối kỳ:</strong> ${totalFinal}</p>
        <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue}</p>
        <p><strong>Tổng Chi Phí:</strong> ${totalExpense}</p>
        <p><strong>Số dư còn lại:</strong> ${remainingBalance >= 0 ? remainingBalance : 0}</p>
        <p><strong>Chi tiết Chi Phí:</strong></p>
        ${expenseDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
        <p><strong>Chi tiết Doanh Thu:</strong></p>
        ${revenueDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
        <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
        <p><strong>Chi tiết Xuất kho:</strong></p>
        ${exportDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
      </div>
    `;
    reportsList.innerHTML = html;
    console.log('Đã tải báo cáo tổng thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo: ' + error.message);
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
        if (report.expense && report.expense.amount && report.expense.info) {
          const expenseType = report.expense.info.trim().toLowerCase();
          if (!expenseSummary[expenseType]) {
            expenseSummary[expenseType] = { total: 0, count: 0 };
          }
          expenseSummary[expenseType].total += report.expense.amount;
          expenseSummary[expenseType].count += 1;
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
