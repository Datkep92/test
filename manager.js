// manager.js
function displaySharedReportSummary(date) {
  const reportsRef = firebase.database().ref('shared_reports');
  const usersRef = firebase.database().ref('users');

  reportsRef.orderByChild('date').equalTo(date).once('value').then(snapshot => {
    const allReports = [];
    snapshot.forEach(child => allReports.push(child.val()));

    usersRef.once('value').then(userSnap => {
      const users = userSnap.val() || {};
      const group = {
        opening: [],
        cost: [],
        revenue: [],
        closing: [],
        exports: []
      };
      let sum = { opening: 0, cost: 0, revenue: 0, closing: 0, export: 0 };

      allReports.forEach(r => {
        const name = users[r.uid]?.name || r.uid;
        const time = new Date(r.timestamp).toLocaleTimeString();
        group.opening.push(`${r.openingBalance} - ${name} ${time}`);
        group.cost.push(`${r.cost} - ${name} ${time}`);
        group.revenue.push(`${r.revenue} - ${name} ${time}`);
        group.closing.push(`${r.closingBalance} - ${name} ${time}`);

        sum.opening += r.openingBalance;
        sum.revenue += r.revenue;
        sum.closing += r.closingBalance;

        if (r.cost.match(/\d+/)) {
          const costVal = parseInt(r.cost.match(/\d+/)[0]);
          sum.cost += costVal;
        }

        r.exports.forEach(e => {
          group.exports.push(`${e.quantity} ${e.productId} - ${name} ${time}`);
          sum.export += e.quantity;
        });
      });

      const real = sum.opening + sum.revenue - sum.cost - sum.closing;
      const table = `
        <div><strong>SỐ Dƪfu Đầu Kỳ:</strong><br>${group.opening.join('<br>')}</div><hr>
        <div><strong>SỐ Dƪfu Cuối Kỳ:</strong><br>${group.closing.join('<br>')}</div><hr>
        <div><strong>Chi Phí:</strong><br>${group.cost.join('<br>')}</div><hr>
        <div><strong>Doanh Thu:</strong><br>${group.revenue.join('<br>')}</div><hr>
        <div><strong>Số Tiền Thực Tế:</strong><br>${real}</div><hr>
        <div><strong>Xuất Kho:</strong><br>${group.exports.join('<br>')}</div><hr>
        <div><strong>Tổng Xuất Kho:</strong> ${sum.export}</div>
      `;
      document.getElementById('report-table').innerHTML = table;
    });
  });
}

function addInventory() {
  const name = document.getElementById('product-name').value;
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
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Thêm sản phẩm thành công!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
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
      div.className = 'p-2 border-b';
      div.innerHTML = `
        <p><strong>${product.name}</strong>: ${product.quantity} (Đơn giá: ${product.price})</p>
      `;
      inventoryList.appendChild(div);
    });
    console.log('Đã tải danh sách tồn kho thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p>Lỗi tải tồn kho.</p>';
  });
}

function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) return;

  const filter = document.getElementById('report-filter');
  if (!filter) return;

  db.ref('shared_reports').on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo.</p>';
      return;
    }

    const filterType = filter.value; // 'day' or 'month'
    let groupedReports = {};
    
    Object.entries(data).forEach(([reportId, report]) => {
      const key = filterType === 'day' ? report.date : report.date.substring(0, 7); // YYYY-MM-DD or YYYY-MM
      if (!groupedReports[key]) groupedReports[key] = [];
      groupedReports[key].push({ reportId, ...report });
    });

    let totalOpeningBalance = 0, totalCost = 0, totalRevenue = 0, totalClosingBalance = 0, totalExport = 0;
    Object.entries(groupedReports).forEach(([key, reports]) => {
      const div = document.createElement('div');
      div.className = 'mb-4';
      div.innerHTML = `<h4 class="text-lg font-semibold">${key}</h4>`;
      const reportList = document.createElement('div');
      reportList.className = 'pl-4';

      reports.forEach(report => {
        const reportDiv = document.createElement('div');
        reportDiv.className = 'p-2 border-b';
        let exportText = '';
        if (report.exports) {
          exportText = Object.entries(report.exports).map(([productId, qty]) => {
            return db.ref('inventory/' + productId).once('value').then(s => {
              const product = s.val();
              return product ? `${product.name}: ${qty}` : `Sản phẩm ${productId}: ${qty}`;
            });
          });
          Promise.all(exportText).then(texts => {
            reportDiv.innerHTML = `
              <p><strong>Nhân viên:</strong> ${report.uid}</p>
              ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
              ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.costDescription} (${report.cost} - ${report.costCategory})</p>` : ''}
              ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
              ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
              ${texts.length ? `<p><strong>Xuất Kho:</strong> ${texts.join(', ')}</p>` : ''}
              <button onclick="editReport('${report.reportId}')" class="text-blue-500">Sửa</button>
              <button onclick="deleteReport('${report.reportId}')" class="text-red-500 ml-2">Xóa</button>
            `;
          });
        } else {
          reportDiv.innerHTML = `
            <p><strong>Nhân viên:</strong> ${report.uid}</p>
            ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
            ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.costDescription} (${report.cost} - ${report.costCategory})</p>` : ''}
            ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
            ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
            <button onclick="editReport('${report.reportId}')" class="text-blue-500">Sửa</button>
            <button onclick="deleteReport('${report.reportId}')" class="text-red-500 ml-2">Xóa</button>
          `;
        }
        reportList.appendChild(reportDiv);

        totalOpeningBalance += report.openingBalance || 0;
        totalCost += report.cost || 0;
        totalRevenue += report.revenue || 0;
        totalClosingBalance += report.closingBalance || 0;
        totalExport += report.exports ? Object.values(report.exports).reduce((sum, qty) => sum + qty, 0) : 0;
      });
      div.appendChild(reportList);
      reportsList.appendChild(div);
    });

    const netProfit = totalOpeningBalance - totalCost + totalRevenue - totalClosingBalance;
    document.getElementById('manager-total-opening-balance').textContent = totalOpeningBalance;
    document.getElementById('manager-total-cost').textContent = totalCost;
    document.getElementById('manager-total-revenue').textContent = totalRevenue;
    document.getElementById('manager-total-closing-balance').textContent = totalClosingBalance;
    document.getElementById('manager-net-profit').textContent = netProfit;
    document.getElementById('manager-total-export').textContent = totalExport;

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

function deleteReport(reportId) {
  if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
    db.ref('shared_reports/' + reportId).remove().then(() => {
      alert('Xóa báo cáo thành công!');
    }).catch(error => {
      console.error('Lỗi xóa báo cáo:', error);
      alert('Lỗi xóa báo cáo: ' + error.message);
    });
  }
}
