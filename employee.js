let expenseCategories = [];

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function parseExpenseInput(input) {
  const normalized = input.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
  
  const amountMatch = normalized.match(/(\d+)\s*$/);
  const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
  
  let description = normalized;
  if (amountMatch) {
    description = normalized.substring(0, amountMatch.index).trim();
  }
  
  const categoryMatch = description.match(/^\s*(\S+)/);
  const category = categoryMatch ? categoryMatch[1] : 'khac';
  
  if (!expenseCategories.includes(category)) {
    expenseCategories.push(category);
    const categoriesRef = db.ref('expenseCategories');
    categoriesRef.set(expenseCategories);
  }
  
  return {
    description: capitalizeFirstLetter(description),
    amount: amount,
    category: capitalizeFirstLetter(category)
  };
}

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

  const reportData = {
    uid: auth.currentUser.uid,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    timestamp: new Date().toISOString(),
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

  const reportRef = db.ref('shared_reports').push();
  reportRef.set(reportData).then(() => {
    // Update inventory for exports
    Promise.all(Object.entries(exportQuantities).map(([productId, qty]) => {
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
    })).then(() => {
      alert('Gửi báo cáo thành công!');
      document.getElementById('opening-balance').value = '';
      document.getElementById('shared-cost').value = '';
      document.getElementById('shared-revenue').value = '';
      document.getElementById('closing-balance').value = '';
      document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
    }).catch(error => {
      console.error('Lỗi cập nhật tồn kho:', error);
      alert('Lỗi cập nhật tồn kho: ' + error.message);
    });
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi gửi báo cáo: ' + error.message);
  });
}

function loadInventory(elementId) {
  const inventoryList = document.getElementById(elementId);
  if (!inventoryList) return;

  db.ref('inventory').on('value', snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      inventoryList.innerHTML = '<p>Không có dữ liệu tồn kho.</p>';
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-2 border-b';
      div.innerHTML = `
        <span>${product.name} (Số lượng: ${product.quantity})</span>
        <input type="number" min="0" class="export-quantity w-24 p-1 border rounded" data-product-id="${productId}" placeholder="Số lượng xuất">
      `;
      inventoryList.appendChild(div);
    });
    console.log('Đã tải danh sách tồn kho thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p>Lỗi tải tồn kho.</p>';
  });
}

function loadProducts() {
  // Không cần nữa vì đã chuyển sang hiển thị danh sách hàng hóa
}

function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) return;

  db.ref('shared_reports').on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo.</p>';
      return;
    }

    let totalOpeningBalance = 0, totalCost = 0, totalRevenue = 0, totalClosingBalance = 0, totalExport = 0;
    Object.entries(data).forEach(([reportId, report]) => {
      const isOwnReport = auth.currentUser && report.uid === auth.currentUser.uid;
      const isManager = auth.currentUser && db.ref('users/' + auth.currentUser.uid).once('value').then(s => s.val().role === 'manager');
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      let exportText = '';
      if (report.exports) {
        exportText = Object.entries(report.exports).map(([productId, qty]) => {
          return db.ref('inventory/' + productId).once('value').then(s => {
            const product = s.val();
            return product ? `${product.name}: ${qty}` : `Sản phẩm ${productId}: ${qty}`;
          });
        });
        Promise.all(exportText).then(texts => {
          div.innerHTML = `
            <p><strong>Ngày:</strong> ${report.date}</p>
            ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
            ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.costDescription} (${report.cost} - ${report.costCategory})</p>` : ''}
            ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
            ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
            ${texts.length ? `<p><strong>Xuất Kho:</strong> ${texts.join(', ')}</p>` : ''}
            ${isOwnReport || isManager ? `<button onclick="editReport('${reportId}')" class="text-blue-500">Sửa</button>` : ''}
            ${isManager ? `<button onclick="deleteReport('${reportId}')" class="text-red-500 ml-2">Xóa</button>` : ''}
          `;
        });
      } else {
        div.innerHTML = `
          <p><strong>Ngày:</strong> ${report.date}</p>
          ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
          ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.costDescription} (${report.cost} - ${report.costCategory})</p>` : ''}
          ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
          ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
          ${isOwnReport || isManager ? `<button onclick="editReport('${reportId}')" class="text-blue-500">Sửa</button>` : ''}
          ${isManager ? `<button onclick="deleteReport('${reportId}')" class="text-red-500 ml-2">Xóa</button>` : ''}
        `;
      }
      reportsList.appendChild(div);

      totalOpeningBalance += report.openingBalance || 0;
      totalCost += report.cost || 0;
      totalRevenue += report.revenue || 0;
      totalClosingBalance += report.closingBalance || 0;
      totalExport += report.exports ? Object.values(report.exports).reduce((sum, qty) => sum + qty, 0) : 0;
    });

    const netProfit = totalOpeningBalance - totalCost + totalRevenue - totalClosingBalance;
    document.getElementById('total-opening-balance').textContent = totalOpeningBalance;
    document.getElementById('total-cost').textContent = totalCost;
    document.getElementById('total-revenue').textContent = totalRevenue;
    document.getElementById('total-closing-balance').textContent = totalClosingBalance;
    document.getElementById('net-profit').textContent = netProfit;
    document.getElementById('total-export').textContent = totalExport;

    console.log('Đã tải báo cáo chung thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p>Lỗi tải báo cáo.</p>';
  });
}

function editReport(reportId) {
  db.ref('shared_reports/' + reportId).once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) return;

    document.getElementById('opening-balance').value = report.openingBalance || '';
    document.getElementById('shared-cost').value = report.cost ? `${report.costDescription} ${report.cost}` : '';
    document.getElementById('shared-revenue').value = report.revenue || '';
    document.getElementById('closing-balance').value = report.closingBalance || '';
    
    if (report.exports) {
      Object.entries(report.exports).forEach(([productId, qty]) => {
        const input = document.querySelector(`.export-quantity[data-product-id="${productId}"]`);
        if (input) input.value = qty;
      });
    }

    const reportRef = db.ref('shared_reports/' + reportId);
    reportRef.set({
      ...report,
      openingBalance: parseFloat(document.getElementById('opening-balance').value) || 0,
      cost: parseExpenseInput(document.getElementById('shared-cost').value).amount || undefined,
      costDescription: parseExpenseInput(document.getElementById('shared-cost').value).description || undefined,
      costCategory: parseExpenseInput(document.getElementById('shared-cost').value).category || undefined,
      revenue: parseFloat(document.getElementById('shared-revenue').value) || undefined,
      closingBalance: parseFloat(document.getElementById('closing-balance').value) || undefined,
      exports: Array.from(document.getElementsByClassName('export-quantity')).reduce((acc, input) => {
        const productId = input.dataset.productId;
        const qty = parseFloat(input.value) || 0;
        if (qty > 0) acc[productId] = qty;
        return acc;
      }, {}),
      uid: auth.currentUser.uid,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    }).then(() => {
      alert('Cập nhật báo cáo thành công!');
      document.getElementById('opening-balance').value = '';
      document.getElementById('shared-cost').value = '';
      document.getElementById('shared-revenue').value = '';
      document.getElementById('closing-balance').value = '';
      document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
    }).catch(error => {
      console.error('Lỗi cập nhật báo cáo:', error);
      alert('Lỗi cập nhật báo cáo: ' + error.message);
    });
  });
}
