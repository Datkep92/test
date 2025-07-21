function loadEmployeeInventory(containerId) {
  loadInventoryData(containerId, (div, productId, product) => {
    div.className = 'flex justify-between items-center border p-2 my-1 hover:bg-gray-50';
    div.innerHTML = `
      <span>${product.name} - Tồn: ${product.quantity}</span>
      <input type="number" min="0" placeholder="Số lượng" class="border p-1 w-20 export-quantity" data-product-id="${productId}" data-product-name="${product.name}">
    `;
  });
}
function loadEmployeeInventory(containerId) {
  loadInventoryData(containerId, (div, productId, product) => {
    div.className = 'flex justify-between items-center border p-2 my-1 hover:bg-gray-50';
    div.innerHTML = `
      <span>${product.name} - Tồn: ${product.quantity}</span>
      <input type="number" min="0" placeholder="Số lượng" class="border p-1 w-20 export-quantity" data-product-id="${productId}" data-product-name="${product.name}">
    `;
  });
}

function getInventoryExported() {
  const inputs = document.querySelectorAll('#employee-inventory .export-quantity');
  const exports = [];
  inputs.forEach(input => {
    const qty = parseInt(input.value);
    if (!isNaN(qty) && qty > 0) {
      exports.push({
        productId: input.dataset.productId,
        productName: input.dataset.productName,
        quantity: qty
      });
    }
  });
  return exports;
}

function submitSharedReport() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    alert('Không xác định được người dùng. Vui lòng đăng nhập lại.');
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('employee-page').classList.add('hidden');
    return;
  }

  const openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;
  const closingBalance = parseFloat(document.getElementById('closing-balance').value) || 0;
  const revenue = parseFloat(document.getElementById('shared-revenue').value) || 0;
  const cost = document.getElementById('shared-cost').value || '';
  const exports = getInventoryExported();

  const today = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();

  const report = {
    uid,
    date: today,
    timestamp,
    openingBalance,
    closingBalance,
    revenue,
    cost,
    exports,
    userName: auth.currentUser.displayName || 'Nhân viên'
  };

  db.ref('shared_reports').push(report)
    .then(() => {
      alert('Đã gửi báo cáo thành công!');
      document.getElementById('opening-balance').value = '';
      document.getElementById('closing-balance').value = '';
      document.getElementById('shared-revenue').value = '';
      document.getElementById('shared-cost').value = '';
      document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
      displaySharedReportSummary(today);
    })
    .catch(error => {
      console.error('Lỗi gửi báo cáo:', error);
      alert(error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền gửi báo cáo.' : 'Lỗi gửi báo cáo: ' + error.message);
    });
}

function displaySharedReportSummary(date) {
  const container = document.getElementById('shared-reports');
  const filter = document.getElementById('report-filter');
  if (!container || !filter) {
    console.error('Không tìm thấy container hoặc filter');
    container.innerHTML = '<p class="text-red-500">Lỗi giao diện: Không tìm thấy container báo cáo.</p>';
    return;
  }

  container.innerHTML = '<p class="text-gray-500">Đang tải báo cáo...</p>';
  const filterType = filter.value;
  const dateKey = filterType === 'day' ? date : date.substring(0, 7);

  fetchReportSummary(dateKey, filterType, (group, sum, reports, error) => {
    if (error) {
      container.innerHTML = `<p class="text-red-500">${error}</p>`;
      return;
    }

    container.innerHTML = '';
    const summaryTable = document.createElement('div');
    summaryTable.className = 'mb-6 overflow-x-auto';
    summaryTable.innerHTML = `
      <table class="min-w-full bg-white border">
        <thead>
          <tr class="bg-gray-100">
            <th class="py-2 px-4 border">Nhân viên</th>
            <th class="py-2 px-4 border">Đầu kỳ</th>
            <th class="py-2 px-4 border">Doanh thu</th>
            <th class="py-2 px-4 border">Chi phí</th>
            <th class="py-2 px-4 border">Cuối kỳ</th>
            <th class="py-2 px-4 border">Xuất kho</th>
            <th class="py-2 px-4 border">Thời gian</th>
          </tr>
        </thead>
        <tbody id="report-rows"></tbody>
      </table>
    `;
    container.appendChild(summaryTable);

    const tbody = document.getElementById('report-rows');
    reports.sort((a, b) => b.timestamp - a.timestamp);

    reports.forEach(report => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      const exportText = report.exports?.map(e => `${e.productName || e.productId}: ${e.quantity}`).join('<br>') || '0';
      row.innerHTML = `
        <td class="py-2 px-4 border">${report.userName || report.uid.substring(0, 6)}</td>
        <td class="py-2 px-4 border text-right">${report.openingBalance || 0}</td>
        <td class="py-2 px-4 border text-right">${report.revenue || 0}</td>
        <td class="py-2 px-4 border">${report.cost || '0'}</td>
        <td class="py-2 px-4 border text-right">${report.closingBalance || 0}</td>
        <td class="py-2 px-4 border">${exportText}</td>
        <td class="py-2 px-4 border">${formatTimestamp(report.timestamp)}</td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('total-opening-balance').textContent = sum.opening;
    document.getElementById('total-cost').textContent = sum.cost;
    document.getElementById('total-revenue').textContent = sum.revenue;
    document.getElementById('total-closing-balance').textContent = sum.closing;
    document.getElementById('net-profit').textContent = sum.real;
    document.getElementById('total-export').textContent = sum.export;
  });
}
function getInventoryExported() {
  const inputs = document.querySelectorAll('#employee-inventory .export-quantity');
  const exports = [];
  inputs.forEach(input => {
    const qty = parseInt(input.value);
    if (!isNaN(qty) && qty > 0) {
      exports.push({
        productId: input.dataset.productId,
        productName: input.dataset.productName,
        quantity: qty
      });
    }
  });
  return exports;
}

function submitSharedReport() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    alert('Không xác định được người dùng.');
    return;
  }

  const openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;
  const closingBalance = parseFloat(document.getElementById('closing-balance').value) || 0;
  const revenue = parseFloat(document.getElementById('shared-revenue').value) || 0;
  const cost = document.getElementById('shared-cost').value || '';
  const exports = getInventoryExported();

  const today = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();

  const report = {
    uid,
    date: today,
    timestamp,
    openingBalance,
    closingBalance,
    revenue,
    cost,
    exports,
    userName: auth.currentUser.displayName || 'Nhân viên'
  };

  db.ref('shared_reports').push(report)
    .then(() => {
      alert('Đã gửi báo cáo thành công!');
      document.getElementById('opening-balance').value = '';
      document.getElementById('closing-balance').value = '';
      document.getElementById('shared-revenue').value = '';
      document.getElementById('shared-cost').value = '';
      document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
      displaySharedReportSummary(today);
    })
    .catch(error => {
      console.error('Lỗi gửi báo cáo:', error);
      alert('Lỗi gửi báo cáo: ' + error.message);
    });
}

function displaySharedReportSummary(date) {
  const container = document.getElementById('shared-reports');
  const filter = document.getElementById('report-filter');
  if (!container || !filter) {
    console.error('Không tìm thấy container hoặc filter');
    return;
  }

  const filterType = filter.value;
  const dateKey = filterType === 'day' ? date : date.substring(0, 7);

  fetchReportSummary(dateKey, filterType, (group, sum, reports, error) => {
    if (error) {
      container.innerHTML = '<p class="text-red-500">Lỗi khi tải báo cáo.</p>';
      return;
    }

    container.innerHTML = '';
    const summaryTable = document.createElement('div');
    summaryTable.className = 'mb-6 overflow-x-auto';
    summaryTable.innerHTML = `
      <table class="min-w-full bg-white border">
        <thead>
          <tr class="bg-gray-100">
            <th class="py-2 px-4 border">Nhân viên</th>
            <th class="py-2 px-4 border">Đầu kỳ</th>
            <th class="py-2 px-4 border">Doanh thu</th>
            <th class="py-2 px-4 border">Chi phí</th>
            <th class="py-2 px-4 border">Cuối kỳ</th>
            <th class="py-2 px-4 border">Xuất kho</th>
            <th class="py-2 px-4 border">Thời gian</th>
          </tr>
        </thead>
        <tbody id="report-rows"></tbody>
      </table>
    `;
    container.appendChild(summaryTable);

    const tbody = document.getElementById('report-rows');
    reports.sort((a, b) => b.timestamp - a.timestamp);

    reports.forEach(report => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      const exportText = report.exports?.map(e => `${e.productName || e.productId}: ${e.quantity}`).join('<br>') || '0';
      row.innerHTML = `
        <td class="py-2 px-4 border">${report.userName || report.uid.substring(0, 6)}</td>
        <td class="py-2 px-4 border text-right">${report.openingBalance || 0}</td>
        <td class="py-2 px-4 border text-right">${report.revenue || 0}</td>
        <td class="py-2 px-4 border">${report.cost || '0'}</td>
        <td class="py-2 px-4 border text-right">${report.closingBalance || 0}</td>
        <td class="py-2 px-4 border">${exportText}</td>
        <td class="py-2 px-4 border">${formatTimestamp(report.timestamp)}</td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('total-opening-balance').textContent = sum.opening;
    document.getElementById('total-cost').textContent = sum.cost;
    document.getElementById('total-revenue').textContent = sum.revenue;
    document.getElementById('total-closing-balance').textContent = sum.closing;
    document.getElementById('net-profit').textContent = sum.real;
    document.getElementById('total-export').textContent = sum.export;
  });
}
