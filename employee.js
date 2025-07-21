// employee.js (cập nhật: gộp báo cáo ngày, tối ưu chọn hàng xuất, hover trực quan)

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
    exports
  };

  firebase.database().ref('shared_reports').push(report)
    .then(() => {
      alert('Đã gửi báo cáo thành công');
      displaySharedReportSummary(today);
    })
    .catch(err => {
      console.error("Lỗi gửi báo cáo:", err);
      alert("Không thể gửi báo cáo");
    });
}


function displaySharedReportSummary(date) {
  const container = document.getElementById('shared-report-summary');
  if (!container) return;

  db.ref('shared_reports/' + date).once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      container.innerHTML = '<p>Không có báo cáo nào cho ngày này.</p>';
      return;
    }

    const {
      totalOpeningBalance = 0,
      totalRevenue = 0,
      totalClosingBalance = 0,
      totalCost = 0,
      totalExport = 0,
      exports = {},
      costDetails = [],
      entries = []
    } = report;

    const netProfit = totalOpeningBalance + totalRevenue - totalCost - totalClosingBalance;

    const groupField = (field) => {
      return entries.filter(e => e[field] > 0).map(e => `<li>${e.name}: ${e[field]}</li>`).join('');
    };

    container.innerHTML = `
      <h3 class="text-lg font-semibold">Báo cáo ngày ${date}</h3>

      <h4 class="font-medium mt-2">Đầu kỳ:</h4>
      <ul>${groupField('openingBalance')}</ul>
      <p><strong>Tổng đầu kỳ:</strong> ${totalOpeningBalance}</p>

      <h4 class="font-medium mt-2">Doanh thu:</h4>
      <ul>${groupField('revenue')}</ul>
      <p><strong>Tổng doanh thu:</strong> ${totalRevenue}</p>

      <h4 class="font-medium mt-2">Chi phí:</h4>
      <ul>${costDetails.map(d => `<li>${d.name}: ${d.amount} (${d.description} - ${d.category})</li>`).join('')}</ul>
      <p><strong>Tổng chi phí:</strong> ${totalCost}</p>

      <h4 class="font-medium mt-2">Cuối kỳ:</h4>
      <ul>${groupField('closingBalance')}</ul>
      <p><strong>Tổng cuối kỳ:</strong> ${totalClosingBalance}</p>

      <h4 class="font-medium mt-2">Tổng Xuất Kho:</h4>
      <p>${totalExport}</p>

      <h4 class="font-medium mt-2">Số tiền còn lại:</h4>
      <p><strong>${totalOpeningBalance} + ${totalRevenue} - ${totalCost} - ${totalClosingBalance} = ${netProfit}</strong></p>
    `;
  }).catch(error => {
    console.error('Lỗi tải báo cáo tổng:', error);
    container.innerHTML = '<p>Lỗi tải báo cáo.</p>';
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
