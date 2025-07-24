// File: js/inventory.js
let currentEditProductId = null;

// Thêm sản phẩm vào kho
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("product-low-stock-threshold").value) || 10;

  if (!name || quantity <= 0 || price < 0) {
    showToastNotification("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const newProduct = {
    id: Date.now().toString(),
    name,
    quantity,
    price,
    lowStockThreshold,
    timestamp: new Date().toISOString()
  };

  db.ref("inventory/" + newProduct.id).set(newProduct)
    .then(() => {
      globalInventoryData.push(newProduct);
      showToastNotification("Thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
      document.getElementById("product-low-stock-threshold").value = "";
      renderInventory();
      checkLowStock(newProduct);
    })
    .catch(err => showToastNotification("Lỗi khi thêm sản phẩm: " + err.message));
}

// Tính tỷ lệ tồn kho và ngày nhập hàng dự kiến
function calculateStockPercentageAndRestockDate(item) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const productReports = globalReportData
    ? globalReportData
        .filter(report => report.type === "export" && report.products && report.timestamp >= thirtyDaysAgo)
        .flatMap(report => report.products.filter(p => p.name === item.name))
    : [];

  const totalExported = productReports.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const avgDailyExport = totalExported / 30;
  const daysUntilRestock = avgDailyExport > 0 ? Math.floor((item.quantity - item.lowStockThreshold) / avgDailyExport) : Infinity;
  const percentage = item.lowStockThreshold > 0 ? (item.quantity / item.lowStockThreshold) * 100 : 0;
  const restockDate = avgDailyExport > 0 ? new Date(Date.now() + daysUntilRestock * 24 * 60 * 60 * 1000) : null;

  return {
    percentage: percentage.toFixed(2),
    avgDailyExport: avgDailyExport.toFixed(2),
    restockDate: restockDate ? restockDate.toLocaleDateString('vi-VN') : 'Không xác định'
  };
}

// Hiển thị danh sách kho
function renderInventory() {
  const container = document.getElementById('inventory-list');
  if (!container) {
    console.warn("Container 'inventory-list' không tồn tại trong DOM.");
    return;
  }

  container.innerHTML = '';
  if (!globalInventoryData || globalInventoryData.length === 0) {
    container.innerHTML = '<p>Chưa có sản phẩm trong kho.</p>';
    return;
  }

  const isExpanded = window.isExpandedStates?.inventoryList || false;
  const displayItems = isExpanded ? globalInventoryData : globalInventoryData.slice(0, 5);

  const table = document.createElement('table');
  table.classList.add('table-style', 'inventory-table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tên</th>
        <th>Số lượng</th>
        <th>Thành tiền</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      ${displayItems
        .map((item, index) => {
          const { percentage, restockDate } = calculateStockPercentageAndRestockDate(item);
          return `
          <tr class="${item.quantity < item.lowStockThreshold ? 'low-stock' : ''}">
            <td><span class="item-stt">${index + 1}</span>. ${item.name}</td>
            <td class="quantity-cell" data-restock="${restockDate}">${item.quantity} (${percentage}%)</td>
            <td>${(item.quantity * item.price).toLocaleString('vi-VN')} VND</td>
            <td>
              <div class="action-buttons">
                <button class="edit-btn" onclick="openEditInventoryModal('${item.id}')">Sửa</button>
                <button class="delete-btn" onclick="deleteInventory('${item.id}')">Xóa</button>
              </div>
            </td>
          </tr>
        `;
        })
        .join('')}
    </tbody>
  `;
  container.appendChild(table);

  const quantityCells = container.querySelectorAll('.quantity-cell');
  quantityCells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const restockDate = cell.getAttribute('data-restock') || 'Không xác định';
      showToastNotification(`Dự đoán nhập hàng: ${restockDate}`);
    });
  });

  if (globalInventoryData.length > 5) {
    const expandBtn = document.createElement('button');
    expandBtn.textContent = isExpanded ? 'Thu gọn' : 'Xem thêm';
    expandBtn.className = 'expand-btn';
    expandBtn.onclick = () => {
      window.isExpandedStates.inventoryList = !window.isExpandedStates.inventoryList;
      renderInventory();
    };
    container.appendChild(expandBtn);
  }
}

// Hiển thị lịch nhập hàng
function renderRestockSchedule() {
  const container = document.getElementById('restock-schedule');
  if (!container) {
    console.warn("Container 'restock-schedule' không tồn tại trong DOM.");
    return;
  }

  container.innerHTML = '';
  if (!globalInventoryData || globalInventoryData.length === 0) {
    container.innerHTML = '<p>Chưa có sản phẩm trong kho.</p>';
    return;
  }

  const table = document.createElement('table');
  table.classList.add('table-style', 'restock-table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tên</th>
        <th>Số lượng</th>
        <th>Tiêu thụ/ngày</th>
        <th>Ngày nhập hàng</th>
      </tr>
    </thead>
    <tbody>
      ${globalInventoryData
        .map((item, index) => {
          const { avgDailyExport, restockDate } = calculateStockPercentageAndRestockDate(item);
          return `
          <tr class="${item.quantity < item.lowStockThreshold ? 'low-stock' : ''}">
            <td><span class="item-stt">${index + 1}</span>. ${item.name}</td>
            <td>${item.quantity}</td>
            <td>${isNaN(avgDailyExport) ? '0.00' : avgDailyExport}</td>
            <td>${restockDate}</td>
          </tr>
        `;
        })
        .join('')}
    </tbody>
  `;
  container.appendChild(table);
}

// Kiểm tra tồn kho thấp
function checkLowStock(item) {
  if (item.quantity < item.lowStockThreshold) {
    showToastNotification(`Cảnh báo: ${item.name} chỉ còn ${item.quantity} đơn vị!`);
    const user = auth.currentUser;
    if (user) {
      db.ref("notifications/general").push({
        message: `Sản phẩm ${item.name} chỉ còn ${item.quantity} đơn vị, dưới ngưỡng ${item.lowStockThreshold}!`,
        timestamp: Date.now(),
        readBy: {}
      }).catch(err => console.error("Lỗi gửi thông báo tồn kho thấp:", err));
    }
  }
}

// Hiển thị phân tích xuất hàng
function renderExportAnalysis() {
  const container = document.getElementById('export-analysis');
  if (!container) {
    console.warn("Container 'export-analysis' không tồn tại trong DOM.");
    return;
  }

  container.innerHTML = '';
  if (!globalInventoryData || globalInventoryData.length === 0) {
    container.innerHTML = '<p>Chưa có dữ liệu xuất hàng.</p>';
    return;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const table = document.createElement('table');
  table.classList.add('table-style', 'export-analysis-table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tên</th>
        <th>Tổng xuất (7 ngày)</th>
        <th>Trung bình/ngày</th>
      </tr>
    </thead>
    <tbody>
      ${globalInventoryData
        .filter((item) => item && item.name && typeof item.name === 'string')
        .map((item, index) => {
          const productReports = globalReportData
            ? globalReportData
                .filter((report) => report.type === 'export' && report.products && report.timestamp && report.timestamp >= sevenDaysAgo)
                .flatMap((report) => report.products.filter((p) => p.name === item.name))
            : [];
          const totalExported = productReports.reduce((sum, p) => sum + (p.quantity || 0), 0);
          const avgDailyExport = totalExported > 0 ? (totalExported / 7).toFixed(2) : '0.00';
          return `
          <tr>
            <td><span class="item-stt">${index + 1}</span>. ${item.name}</td>
            <td>${totalExported}</td>
            <td>${avgDailyExport}</td>
          </tr>
        `;
        })
        .join('')}
    </tbody>
  `;
  container.appendChild(table);

  const canvas = document.getElementById('export-chart');
  if (!canvas) {
    console.warn("Canvas 'export-chart' không tồn tại trong DOM.");
    return;
  }

  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(date.toLocaleDateString('vi-VN'));
  }

  const colors = [
    'var(--primary-light)', // #8b6b4b
    'var(--accent)', // #D4AF37
    '#2196f3', // Xanh lam
    '#ff4d4d', // Đỏ nhạt
    '#4caf50', // Xanh lá
    '#f06292', // Hồng
    '#ab47bc', // Tím
    '#ff9800', // Cam
    '#26a69a', // Xanh ngọc
    '#7b1fa2', // Tím đậm
  ];

  const datasets = globalInventoryData
    .filter((item) => item && item.name && typeof item.name === 'string')
    .map((item, index) => {
      const productReports = globalReportData
        ? globalReportData
            .filter((report) => report.type === 'export' && report.products && report.timestamp && report.timestamp >= sevenDaysAgo)
            .flatMap((report) => report.products.filter((p) => p.name === item.name))
        : [];
      const quantities = dates.map((date) => {
        const dailyReports = productReports.filter((report) => {
          const reportDate = report.timestamp
            ? new Date(report.timestamp).toLocaleDateString('vi-VN')
            : '';
          return reportDate === date;
        });
        return dailyReports.reduce((sum, report) => sum + (report.quantity || 0), 0);
      });
      return {
        label: item.name,
        data: quantities,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '80',
        fill: false,
        tension: 0.4
      };
    });

  try {
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: dates,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Số lượng xuất',
              color: 'var(--text)',
              font: { size: 14 }
            },
            ticks: {
              color: 'var(--text)',
              stepSize: 1
            }
          },
          x: {
            title: {
              display: true,
              text: 'Ngày',
              color: 'var(--text)',
              font: { size: 14 }
            },
            ticks: {
              color: 'var(--text)',
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'var(--text)',
              font: { size: 12 },
              padding: 15,
              boxWidth: 20
            }
          },
          title: {
            display: true,
            text: 'Phân tích xuất hàng (7 ngày)',
            color: 'var(--primary)',
            font: { size: 16 },
            padding: 15
          }
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi vẽ biểu đồ:', error.message);
  }
}

// Mở modal chỉnh sửa sản phẩm
function openEditInventoryModal(productId) {
  const product = globalInventoryData.find(p => p.id === productId);
  if (!product) {
    showToastNotification("Sản phẩm không tồn tại!");
    return;
  }
  currentEditProductId = productId;
  document.getElementById("edit-product-name").value = product.name;
  document.getElementById("edit-product-quantity").value = product.quantity;
  document.getElementById("edit-product-price").value = product.price;
  document.getElementById("edit-product-low-stock-threshold").value = product.lowStockThreshold || 10;
  document.getElementById("edit-inventory-modal").style.display = "block";
}

// Lưu chỉnh sửa sản phẩm
function saveInventoryEdit() {
  const name = document.getElementById("edit-product-name").value.trim();
  const quantity = parseInt(document.getElementById("edit-product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("edit-product-price").value) || 0;
  const lowStockThreshold = parseInt(document.getElementById("edit-product-low-stock-threshold").value) || 10;

  if (!name || quantity <= 0 || price < 0) {
    showToastNotification("Vui lòng nhập đầy đủ thông tin hợp lệ!");
    return;
  }

  const updatedProduct = {
    name,
    quantity,
    price,
    lowStockThreshold,
    timestamp: new Date().toISOString()
  };

  db.ref("inventory/" + currentEditProductId).update(updatedProduct)
    .then(() => {
      const product = globalInventoryData.find(p => p.id === currentEditProductId);
      if (product) {
        product.name = name;
        product.quantity = quantity;
        product.price = price;
        product.lowStockThreshold = lowStockThreshold;
        product.timestamp = updatedProduct.timestamp;
      }
      showToastNotification("Cập nhật sản phẩm thành công!");
      closeModal("edit-inventory-modal");
      renderInventory();
      checkLowStock(updatedProduct);
    })
    .catch(err => showToastNotification("Lỗi khi cập nhật sản phẩm: " + err.message));
}

// Đóng modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Xóa sản phẩm
function deleteInventory(productId) {
  if (!confirm("Xóa sản phẩm này?")) return;
  db.ref("inventory/" + productId).remove()
    .then(() => {
      globalInventoryData = globalInventoryData.filter(item => item.id !== productId);
      renderInventory();
      showToastNotification("Xóa sản phẩm thành công!");
    })
    .catch(err => showToastNotification("Lỗi khi xóa sản phẩm: " + err.message));
}

// Log để kiểm tra file tải
console.log('inventory.js loaded');