function addInventory() {
  const name = document.getElementById('product-name').value.trim();
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
    unit: 'cái',
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Thêm sản phẩm thành công!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
    console.log('Đã thêm sản phẩm:', name);
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
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
      inventoryList.innerHTML = '<p>Không có dữ liệu tồn kho.</p>';
      console.log('Không có dữ liệu tồn kho trong Firebase.');
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-2 border-b';
      div.innerHTML = `
        <span>${product.name} (Số lượng: ${product.quantity})</span>
        <input type="number" min="0" max="${product.quantity}" class="export-quantity w-24 p-1 border rounded" data-product-id="${productId}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-unit="${product.unit || 'cái'}" placeholder="Số lượng xuất">
      `;
      inventoryList.appendChild(div);
    });
    console.log('Đã tải danh sách tồn kho thành công cho', elementId, Object.keys(data));
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = '<p>Lỗi tải tồn kho: ' + error.message + '</p>';
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

  const filter = document.getElementById('manager-report-filter');
  if (!filter) {
    console.error('Không tìm thấy phần tử report-filter trong DOM');
    alert('Lỗi: Không tìm thấy bộ lọc báo cáo.');
    return;
  }

  db.ref('dailyData').on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo.</p>';
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

    let html = `
      <div class="report-row">
        <p><strong>Tổng Tồn kho đầu kỳ:</strong> ${totalInitial}</p>
        <p><strong>Tổng Tồn kho cuối kỳ:</strong> ${totalFinal}</p>
        <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue}</p>
        <p><strong>Tổng Chi Phí:</strong> ${totalExpense}</p>
        <p><strong>Chi tiết Chi Phí:</strong> ${expenseDetails.length ? expenseDetails.join('; ') : 'Không có'}</p>
        <p><strong>Chi tiết Doanh Thu:</strong> ${revenueDetails.length ? revenueDetails.join('; ') : 'Không có'}</p>
        <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
        <p><strong>Chi tiết Xuất kho:</strong> ${exportDetails.length ? exportDetails.join('; ') : 'Không có'}</p>
      </div>
    `;
    reportsList.innerHTML = html;
    console.log('Đã tải báo cáo tổng thành công cho', elementId);
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p>Lỗi tải báo cáo: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo: ' + error.message);
  });
}
