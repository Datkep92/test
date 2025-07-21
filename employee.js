// employee.js (cập nhật: gộp báo cáo ngày, tối ưu chọn hàng xuất, hover trực quan)

// employee.js

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
  const ref = firebase.database().ref('shared_reports');
  const container = document.getElementById('shared-reports');
  const totalBox = document.getElementById('total-report');
  container.innerHTML = '';

  let totalOpening = 0, totalRevenue = 0, totalCost = 0, totalClosing = 0, totalExport = 0;

  ref.orderByChild('date').equalTo(date).once('value').then(snapshot => {
    const reports = [];
    snapshot.forEach(child => reports.push({ id: child.key, ...child.val() }));

    const grouped = {
      opening: [],
      closing: [],
      revenue: [],
      cost: [],
      exports: []
    };

    const userPromises = reports.map(r =>
      firebase.database().ref('users/' + r.uid).once('value').then(snap => {
        const name = snap.val()?.name || r.uid;
        const time = formatTimestamp(r.timestamp);
        if (r.openingBalance > 0) grouped.opening.push(`${r.openingBalance} - ${name} ${time}`);
        if (r.closingBalance > 0) grouped.closing.push(`${r.closingBalance} - ${name} ${time}`);
        if (r.revenue > 0) grouped.revenue.push(`${r.revenue} - ${name} ${time}`);
        if (r.cost) grouped.cost.push(`${r.cost} - ${name} ${time}`);
        if (r.exports?.length) {
          r.exports.forEach(e => {
            grouped.exports.push(`${e.productName}: ${e.quantity} - ${name} ${time}`);
            totalExport += e.quantity;
          });
        }

        totalOpening += r.openingBalance || 0;
        totalClosing += r.closingBalance || 0;
        totalRevenue += r.revenue || 0;
        totalCost += parseCostString(r.cost);
      })
    );

    Promise.all(userPromises).then(() => {
      const sections = [
        { title: 'Số Dư Đầu Kỳ', list: grouped.opening, total: totalOpening },
        { title: 'Số Dư Cuối Kỳ', list: grouped.closing, total: totalClosing },
        { title: 'Chi Phí', list: grouped.cost, total: totalCost },
        { title: 'Doanh Thu', list: grouped.revenue, total: totalRevenue },
        { title: 'Xuất Kho', list: grouped.exports, total: totalExport }
      ];

      sections.forEach(sec => {
        const box = document.createElement('div');
        box.className = 'mb-3 p-2 border rounded bg-white';
        const title = document.createElement('h4');
        title.className = 'font-semibold';
        title.textContent = sec.title;
        box.appendChild(title);

        sec.list.forEach(line => {
          const p = document.createElement('p');
          p.textContent = line;
          box.appendChild(p);
        });

        const total = document.createElement('p');
        total.className = 'font-bold mt-2';
        total.textContent = `Tổng ${sec.title}: ${sec.total}`;
        box.appendChild(total);

        container.appendChild(box);
      });

      const netProfit = totalOpening + totalRevenue - totalCost - totalClosing;
      document.getElementById('total-opening-balance').textContent = totalOpening;
      document.getElementById('total-cost').textContent = totalCost;
      document.getElementById('total-revenue').textContent = totalRevenue;
      document.getElementById('total-closing-balance').textContent = totalClosing;
      document.getElementById('net-profit').textContent = netProfit;
      document.getElementById('total-export').textContent = totalExport;
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
