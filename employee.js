// employee.js

function loadEmployeeInventory(containerId) {
  const inventoryRef = firebase.database().ref('inventory');
  inventoryRef.once('value').then(snapshot => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    snapshot.forEach(child => {
      const item = child.val();
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center border p-2 my-1 hover:bg-gray-50';

      const name = document.createElement('span');
      name.textContent = `${item.name} - Tồn: ${item.quantity}`;

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.placeholder = 'Số lượng';
      input.className = 'border p-1 w-20';
      input.dataset.productId = child.key;
      input.dataset.productName = item.name;

      row.appendChild(name);
      row.appendChild(input);
      container.appendChild(row);
    });
  });
}

function getInventoryExported() {
  const inputs = document.querySelectorAll('#employee-inventory input');
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
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return alert("Không xác định được người dùng");

  const openingBalance = parseInt(document.getElementById('opening-balance').value) || 0;
  const closingBalance = parseInt(document.getElementById('closing-balance').value) || 0;
  const revenue = parseInt(document.getElementById('shared-revenue').value) || 0;
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
    userName: firebase.auth().currentUser?.displayName || 'Nhân viên'
  };

  firebase.database().ref('shared_reports').push(report)
    .then(() => {
      alert('Đã gửi báo cáo thành công');
      // Reset form sau khi gửi
      document.getElementById('opening-balance').value = '';
      document.getElementById('closing-balance').value = '';
      document.getElementById('shared-revenue').value = '';
      document.getElementById('shared-cost').value = '';
      // Load lại báo cáo
      displaySharedReportSummary(today);
    })
    .catch(err => {
      console.error("Lỗi gửi báo cáo:", err);
      alert("Không thể gửi báo cáo");
    });
}

function parseCostString(costStr) {
  if (!costStr) return 0;
  const match = costStr.match(/\d+/g);
  return match ? match.map(Number).reduce((a, b) => a + b, 0) : 0;
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.toLocaleDateString('vi-VN')}`;
}

function displaySharedReportSummary(date) {
  const container = document.getElementById('shared-reports');
  if (!container) {
    console.error('Không tìm thấy container shared-reports');
    return;
  }

  fetchReportSummary(date, (group, sum, reports, error) => {
    if (error) {
      container.innerHTML = '<p class="text-red-500">Lỗi khi tải báo cáo. Vui lòng thử lại.</p>';
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
      const timeStr = formatTimestamp(report.timestamp);
      const exportText = report.exports?.map(e => `${e.productName}: ${e.quantity}`).join('<br>') || '0';

      row.innerHTML = `
        <td class="py-2 px-4 border">${report.userName || report.uid.substring(0, 6)}</td>
        <td class="py-2 px-4 border text-right">${report.openingBalance || 0}</td>
        <td class="py-2 px-4 border text-right">${report.revenue || 0}</td>
        <td class="py-2 px-4 border">${report.cost || '0'}</td>
        <td class="py-2 px-4 border text-right">${report.closingBalance || 0}</td>
        <td class="py-2 px-4 border">${exportText}</td>
        <td class="py-2 px-4 border">${timeStr}</td>
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
