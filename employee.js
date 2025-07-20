function submitSharedReport() {
  const cost = document.getElementById('shared-cost').value;
  const revenue = document.getElementById('shared-revenue').value;
  const productId = document.getElementById('product-select').value;
  const exportQty = document.getElementById('export-quantity').value;
  const user = auth.currentUser;

  if (!user) {
    alert('Vui lòng đăng nhập để gửi báo cáo!');
    return;
  }

  if (!cost || !revenue || !productId || !exportQty) {
    alert('Vui lòng nhập đầy đủ thông tin báo cáo!');
    return;
  }

  // Kiểm tra số lượng tồn kho
  db.ref('inventory/' + productId).once('value').then(snapshot => {
    const product = snapshot.val();
    if (!product || product.quantity < parseFloat(exportQty)) {
      alert('Số lượng xuất kho vượt quá tồn kho!');
      return;
    }

    // Cập nhật số lượng tồn kho
    db.ref('inventory/' + productId).update({
      quantity: product.quantity - parseFloat(exportQty)
    }).then(() => {
      // Gửi báo cáo chung
      db.ref('shared_reports').push({
        cost: parseFloat(cost),
        revenue: parseFloat(revenue),
        export: parseFloat(exportQty),
        productId: productId,
        userId: user.uid,
        timestamp: new Date().toISOString()
      }).then(() => {
        alert('Báo cáo đã được gửi và tồn kho đã cập nhật!');
        document.getElementById('shared-cost').value = '';
        document.getElementById('shared-revenue').value = '';
        document.getElementById('product-select').value = '';
        document.getElementById('export-quantity').value = '';
      }).catch(error => {
        console.error('Lỗi gửi báo cáo chung:', error);
        alert('Lỗi gửi báo cáo chung: ' + error.message);
      });
    }).catch(error => {
      console.error('Lỗi cập nhật tồn kho:', error);
      alert('Lỗi cập nhật tồn kho: ' + error.message);
    });
  }).catch(error => {
    console.error('Lỗi kiểm tra tồn kho:', error);
    alert('Lỗi kiểm tra tồn kho: ' + error.message);
  });
}

function loadInventory(divId) {
  const inventoryDiv = document.getElementById(divId);
  if (!inventoryDiv) {
    console.error(`Không tìm thấy phần tử ${divId}`);
    return;
  }

  db.ref('inventory').on('value', snapshot => {
    inventoryDiv.innerHTML = '';
    if (!snapshot.exists()) {
      inventoryDiv.innerHTML = '<p>Không có sản phẩm nào trong tồn kho.</p>';
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
  }, error => {
    console.error('Lỗi tải danh sách tồn kho:', error);
    alert('Lỗi tải danh sách tồn kho: ' + error.message);
  });
}

function loadProducts() {
  db.ref('inventory').on('value', snapshot => {
    const productSelect = document.getElementById('product-select');
    productSelect.innerHTML = '<option value="">Chọn sản phẩm</option>';
    if (!snapshot.exists()) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Không có sản phẩm nào';
      option.disabled = true;
      productSelect.appendChild(option);
      return;
    }
    snapshot.forEach(productSnapshot => {
      const product = productSnapshot.val();
      const option = document.createElement('option');
      option.value = productSnapshot.key;
      option.textContent = `${product.name} (Số lượng: ${product.quantity}, Đơn giá: ${product.price})`;
      productSelect.appendChild(option);
    });
  }, error => {
    console.error('Lỗi tải danh sách sản phẩm:', error);
    alert('Lỗi tải danh sách sản phẩm: ' + error.message);
  });
}

function loadSharedReports(divId) {
  const reportsDiv = document.getElementById(divId);
  if (!reportsDiv) {
    console.error(`Không tìm thấy phần tử ${divId}`);
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
        totalCost += report.cost;
        totalRevenue += report.revenue;
        totalExport += report.export;
        const reportDiv = document.createElement('div');
        reportDiv.className = 'border p-4 mb-2 rounded';
        reportDiv.innerHTML = `
          <p><strong>Nhân viên:</strong> ${report.userId}</p>
          <p><strong>Chi Phí:</strong> ${report.cost}</p>
          <p><strong>Doanh Thu:</strong> ${report.revenue}</p>
          <p><strong>Xuất Kho:</strong> ${report.export}</p>
          <p><strong>Sản Phẩm:</strong> ${report.productId}</p>
          <p><strong>Thời Gian:</strong> ${report.timestamp}</p>
        `;
        reportsDiv.appendChild(reportDiv);
      });
    }

    // Cập nhật tổng
    document.getElementById('total-cost').textContent = totalCost.toFixed(2);
    document.getElementById('total-revenue').textContent = totalRevenue.toFixed(2);
    document.getElementById('net-profit').textContent = (totalRevenue - totalCost).toFixed(2);
    document.getElementById('total-export').textContent = totalExport.toFixed(2);
  }, error => {
    console.error('Lỗi tải báo cáo chung:', error);
    alert('Lỗi tải báo cáo chung: ' + error.message);
  });
}
