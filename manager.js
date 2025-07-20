function addInventory() {
  const name = document.getElementById('product-name').value;
  const quantity = document.getElementById('product-quantity').value;
  const price = document.getElementById('product-price').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để thêm sản phẩm!');
    return;
  }

  if (!name || !quantity || !price) {
    alert('Vui lòng nhập đầy đủ thông tin sản phẩm!');
    return;
  }

  db.ref('inventory').push({
    name: name,
    quantity: parseFloat(quantity),
    price: parseFloat(price),
    timestamp: new Date().toISOString()
  }).then(() => {
    alert('Đã thêm sản phẩm vào tồn kho!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-price').value = '';
  }).catch(error => {
    console.error('Lỗi thêm sản phẩm:', error);
    alert('Lỗi thêm sản phẩm: ' + error.message);
  });
}

function loadInventory() {
  const inventoryDiv = document.getElementById('inventory-list');
  if (!inventoryDiv) {
    console.error('Không tìm thấy phần tử inventory-list');
    alert('Lỗi: Không tìm thấy phần tử hiển thị tồn kho. Vui lòng kiểm tra giao diện.');
    return;
  }

  db.ref('inventory').on('value', snapshot => {
    inventoryDiv.innerHTML = '';
    if (!snapshot.exists()) {
      inventoryDiv.innerHTML = '<p class="text-red-500">Không có sản phẩm nào trong tồn kho.</p>';
      console.warn('Node /inventory rỗng hoặc không tồn tại.');
      return;
    }
    snapshot.forEach(productSnapshot => {
      const product = productSnapshot.val();
      const productDiv = document.createElement('div');
      productDiv.className = 'border p-4 mb-2 rounded';
      productDiv.innerHTML = `
        <p><strong>Tên sản phẩm:</strong> ${product.name}</p>
        <p><strong>Số lượng:</strong> ${product.quantity}</p>
        <p><strong>Đơn giá:</strong> ${product.price}</p>
        <p><strong>Thời gian:</strong> ${product.timestamp}</p>
      `;
      inventoryDiv.appendChild(productDiv);
    });
    console.log('Đã tải danh sách tồn kho thành công cho inventory-list');
  }, error => {
    console.error('Lỗi tải danh sách tồn kho:', error);
    inventoryDiv.innerHTML = '<p class="text-red-500">Lỗi tải danh sách tồn kho: ' + error.message + '</p>';
    alert('Lỗi tải danh sách tồn kho: ' + error.message);
  });
}

function loadSharedReports(divId) {
  const reportsDiv = document.getElementById(divId);
  if (!reportsDiv) {
    console.error(`Không tìm thấy phần tử ${divId}`);
    alert(`Lỗi: Không tìm thấy phần tử báo cáo chung. Vui lòng kiểm tra giao diện.`);
    return;
  }

  db.ref('shared_reports').on('value', snapshot => {
    reportsDiv.innerHTML = '';
    let totalCost = 0;
    let totalRevenue = 0;
    let totalExport = 0;

    if (!snapshot.exists()) {
      reportsDiv.innerHTML = '<p>Không có báo cáo chung nào.</p>';
    } else {
      snapshot.forEach(reportSnapshot => {
        const report = reportSnapshot.val();
        totalCost += report.cost || 0;
        totalRevenue += report.revenue || 0;
        totalExport += report.export || 0;
        const reportDiv = document.createElement('div');
        reportDiv.className = 'border p-4 mb-2 rounded';
        reportDiv.innerHTML = `
          <p><strong>Nhân viên:</strong> ${report.userId}</p>
          ${report.cost ? `<p><strong>Chi Phí:</strong> ${report.cost}</p>` : ''}
          ${report.revenue ? `<p><strong>Doanh Thu:</strong> ${report.revenue}</p>` : ''}
          ${report.export ? `<p><strong>Xuất Kho:</strong> ${report.export}</p>` : ''}
          ${report.productId ? `<p><strong>Sản Phẩm:</strong> ${report.productId}</p>` : ''}
          <p><strong>Thời Gian:</strong> ${report.timestamp}</p>
        `;
        reportsDiv.appendChild(reportDiv);
      });
    }

    // Cập nhật tổng
    document.getElementById('manager-total-cost').textContent = totalCost.toFixed(2);
    document.getElementById('manager-total-revenue').textContent = totalRevenue.toFixed(2);
    document.getElementById('manager-net-profit').textContent = (totalRevenue - totalCost).toFixed(2);
    document.getElementById('manager-total-export').textContent = totalExport.toFixed(2);
    console.log('Đã tải báo cáo chung thành công cho', divId);
  }, error => {
    console.error('Lỗi tải báo cáo chung:', error);
    reportsDiv.innerHTML = '<p class="text-red-500">Lỗi tải báo cáo chung: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo chung: ' + error.message);
  });
}
