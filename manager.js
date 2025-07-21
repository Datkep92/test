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

function loadInventory(containerId) {
  loadInventoryData(containerId, (div, productId, product) => {
    div.innerHTML = `
      <p><strong>${product.name}</strong>: ${product.quantity} (Đơn giá: ${product.price})</p>
    `;
  });
}

function loadSharedReports(containerId) {
  const reportsList = document.getElementById(containerId);
  const filter = document.getElementById('report-filter');
  if (!reportsList || !filter) {
    console.error('Không tìm thấy reportsList hoặc filter');
    return;
  }

  const filterType = filter.value;
  const today = new Date().toISOString().split('T')[0];
  const dateKey = filterType === 'day' ? today : today.substring(0, 7);

  fetchReportSummary(dateKey, filterType, (group, sum, reports, error) => {
    if (error) {
      reportsList.innerHTML = '<p class="text-red-500">Lỗi khi tải báo cáo.</p>';
      return;
    }

    reportsList.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'mb-4';
    div.innerHTML = `<h4 class="text-lg font-semibold">${dateKey}</h4>`;
    const reportList = document.createElement('div');
    reportList.className = 'pl-4';

    reports.forEach(report => {
      const reportDiv = document.createElement('div');
      reportDiv.className = 'p-2 border-b';
      const exportText = report.exports?.map(e => `${e.productName || e.productId}: ${e.quantity}`).join(', ') || '0';
      reportDiv.innerHTML = `
        <p><strong>Nhân viên:</strong> ${report.userName || report.uid.substring(0, 6)}</p>
        ${report.openingBalance ? `<p><strong>Số Dư Đầu Kỳ:</strong> ${report.openingBalance}</p>` : ''}
        ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.cost}</p>` : ''}
        ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
        ${report.closingBalance ? `<p><strong>Số Dư Cuối Kỳ:</strong> ${report.closingBalance}</p>` : ''}
        ${exportText ? `<p><strong>Xuất Kho:</strong> ${exportText}</p>` : ''}
        <button onclick="editReport('${report.id}')" class="text-blue-500 hover:underline">Sửa</button>
        <button onclick="deleteReport('${report.id}')" class="text-red-500 hover:underline ml-2">Xóa</button>
      `;
      reportList.appendChild(reportDiv);
    });

    div.appendChild(reportList);
    reportsList.appendChild(div);

    document.getElementById('manager-total-opening-balance').textContent = sum.opening;
    document.getElementById('manager-total-cost').textContent = sum.cost;
    document.getElementById('manager-total-revenue').textContent = sum.revenue;
    document.getElementById('manager-total-closing-balance').textContent = sum.closing;
    document.getElementById('manager-total-export').textContent = sum.export;
    document.getElementById('manager-net-profit').textContent = sum.real;
  });
}

function editReport(reportId) {
  db.ref('shared_reports/' + reportId).once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      alert('Báo cáo không tồn tại.');
      return;
    }

    document.getElementById('opening-balance').value = report.openingBalance || '';
    document.getElementById('shared-cost').value = report.cost || '';
    document.getElementById('shared-revenue').value = report.revenue || '';
    document.getElementById('closing-balance').value = report.closingBalance || '';

    if (report.exports) {
      document.querySelectorAll('.export-quantity').forEach(input => {
        const qty = report.exports.find(e => e.productId === input.dataset.productId)?.quantity || '';
        input.value = qty;
      });
    }

    const reportRef = db.ref('shared_reports/' + reportId);
    reportRef.set({
      ...report,
      openingBalance: parseFloat(document.getElementById('opening-balance').value) || 0,
      cost: document.getElementById('shared-cost').value || undefined,
      revenue: parseFloat(document.getElementById('shared-revenue').value) || undefined,
      closingBalance: parseFloat(document.getElementById('closing-balance').value) || undefined,
      exports: Array.from(document.getElementsByClassName('export-quantity')).reduce((acc, input) => {
        const productId = input.dataset.productId;
        const qty = parseFloat(input.value) || 0;
        if (qty > 0) {
          acc.push({ productId, productName: input.dataset.productName, quantity: qty });
        }
        return acc;
      }, []),
      uid: auth.currentUser.uid,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      userName: auth.currentUser.displayName || 'Nhân viên'
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
  }).catch(error => {
    console.error('Lỗi tải báo cáo:', error);
    alert('Lỗi tải báo cáo: ' + error.message);
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
