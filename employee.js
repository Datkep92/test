// employee.js (gộp hoàn chỉnh: gửi/sửa báo cáo trong ngày, xem nhiều ngày trước, không sửa báo cáo cũ)

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
  const reportData = {
    uid,
    date,
    timestamp: new Date().toISOString()
  };

  if (openingBalance > 0) reportData.openingBalance = openingBalance;
  if (costInput) {
    const expense = parseExpenseInput(costInput);
    reportData.cost = expense.amount;
    reportData.costDescription = expense.description;
    reportData.costCategory = expense.category;
  }
  if (revenue > 0) reportData.revenue = revenue;
  if (closingBalance > 0) reportData.closingBalance = closingBalance;
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  db.ref('users/' + uid + '/name').once('value').then(snapshot => {
    reportData.name = snapshot.val() || 'Không rõ';
    return db.ref('shared_reports/' + date + '/' + uid).set(reportData);
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

function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  const datePicker = document.getElementById('report-date');
  const date = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];
  const currentUserId = auth.currentUser.uid;
  const currentDate = new Date().toISOString().split('T')[0];

  if (!reportsList) return;

  db.ref('shared_reports/' + date).on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo cho ngày này.</p>';
      return;
    }

    Object.entries(data).forEach(([uid, report]) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';

      let exportDetails = '';
      const exportPromises = [];

      if (report.exports) {
        Object.entries(report.exports).forEach(([productId, qty]) => {
          exportPromises.push(
            db.ref('inventory/' + productId).once('value').then(snap => {
              const product = snap.val();
              return product ? `${product.name}: ${qty}` : `SP ${productId}: ${qty}`;
            })
          );
        });
      }

      Promise.all(exportPromises).then(exportTexts => {
        div.innerHTML = `
          <p><strong>Nhân viên:</strong> ${report.name || uid}</p>
          <p><strong>Giờ:</strong> ${new Date(report.timestamp).toLocaleTimeString()}</p>
          ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
          ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.costDescription} (${report.cost} - ${report.costCategory})</p>` : ''}
          ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
          ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
          ${exportTexts.length ? `<p><strong>Xuất Kho:</strong> ${exportTexts.join(', ')}</p>` : ''}
        `;

        // Nếu là ngày hôm nay và của chính user => cho phép sửa
        if (uid === currentUserId && report.date === currentDate) {
          div.innerHTML += `<button onclick="editMyTodayReport()" class="text-blue-500 ml-2">Sửa</button>`;
        }
      });

      reportsList.appendChild(div);
    });
  });
}

function editMyTodayReport() {
  const uid = auth.currentUser.uid;
  const date = new Date().toISOString().split('T')[0];

  db.ref('shared_reports/' + date + '/' + uid).once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      alert('Không tìm thấy báo cáo để sửa.');
      return;
    }

    document.getElementById('opening-balance').value = report.openingBalance || '';
    document.getElementById('shared-cost').value = report.cost ? `${report.costDescription} ${report.cost} - ${report.costCategory}` : '';
    document.getElementById('shared-revenue').value = report.revenue || '';
    document.getElementById('closing-balance').value = report.closingBalance || '';

    if (report.exports) {
      Object.entries(report.exports).forEach(([productId, qty]) => {
        const input = document.querySelector(`.export-quantity[data-product-id="${productId}"]`);
        if (input) input.value = qty;
      });
    }
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
