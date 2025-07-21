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

function submitManagerReport() {
  const initialInventory = parseFloat(document.getElementById('initial-inventory').value) || 0;
  const finalInventory = parseFloat(document.getElementById('final-inventory').value) || 0;
  const revenue = parseFloat(document.getElementById('revenue').value) || 0;
  const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
  const expenseInfo = document.getElementById('expense-info').value.trim() || '';

  if (initialInventory < 0 || finalInventory < 0 || revenue < 0 || expenseAmount < 0) {
    alert('Vui lòng nhập giá trị không âm.');
    return;
  }

  const exportInputs = document.getElementsByClassName('export-quantity');
  const exportQuantities = Array.from(exportInputs).reduce((acc, input) => {
    const qty = parseFloat(input.value) || 0;
    if (qty > 0 && qty <= parseFloat(input.max)) {
      acc[input.dataset.productId] = {
        productId: input.dataset.productId,
        quantity: qty,
        productName: input.dataset.productName,
        price: parseFloat(input.dataset.productPrice) || 0,
        unit: input.dataset.productUnit || 'cái',
        timestamp: Date.now()
      };
    }
    return acc;
  }, {});

  const reportData = {
    user: auth.currentUser.email,
    date: new Date().toLocaleDateString('vi-VN'),
    lastUpdated: Date.now(),
    initialInventory,
    finalInventory,
    revenue,
    expense: { amount: expenseAmount, info: expenseInfo }
  };
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  const dateKey = reportData.date.replace(/\//g, '_');
  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}`);
  reportRef.set(reportData).then(() => {
    if (Object.keys(exportQuantities).length > 0) {
      return Promise.all(Object.entries(exportQuantities).map(([productId, exportItem]) => {
        return db.ref('inventory/' + productId).once('value').then(snapshot => {
          const product = snapshot.val();
          if (product && product.quantity >= exportItem.quantity) {
            return db.ref('inventory/' + productId).update({
              quantity: product.quantity - exportItem.quantity
            });
          } else {
            throw new Error(`Số lượng xuất kho vượt quá tồn kho cho ${product.name}`);
          }
        });
      }));
    }
  }).then(() => {
    alert('Gửi báo cáo thành công!');
    document.getElementById('initial-inventory').value = '';
    document.getElementById('final-inventory').value = '';
    document.getElementById('revenue').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-info').value = '';
    Array.from(exportInputs).forEach(input => input.value = '');
    loadInventory('inventory-list'); // Cập nhật lại danh sách tồn kho
  }).catch(error => {
    console.error('Lỗi gửi báo cáo:', error);
    alert('Lỗi: ' + error.message);
  });
}

function loadSharedReports(elementId) {
  const reportsList = document.getElementById(elementId);
  if (!reportsList) {
    console.error('Không tìm thấy phần tử report-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo.');
    return;
  }

  const filter = document.getElementById('report-filter');
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
    let groupedReports = {};

    Object.entries(data).forEach(([date, users]) => {
      const formattedDate = date.replace(/_/g, '/');
      const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
      Object.entries(users).forEach(([uid, report]) => {
        if (!/^[a-zA-Z0-9]+$/.test(uid)) {
          console.warn('Bỏ qua key không hợp lệ:', uid);
          return;
        }
        if (!groupedReports[key]) groupedReports[key] = [];
        groupedReports[key].push({ date, uid, ...report });
      });
    });

    let html = '';
    Promise.all(Object.entries(groupedReports).map(([key, reports]) => {
      let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;

      return Promise.all(reports.map(report => {
        const timestamp = new Date(report.lastUpdated).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        return db.ref('users/' + report.uid).once('value').then(snapshot => {
          const user = snapshot.val();
          const employeeName = user && user.name ? user.name : report.user || report.uid;
          const isCurrentUser = auth.currentUser && auth.currentUser.uid === report.uid;
          const isManager = user && user.role === 'manager';

          totalInitial += report.initialInventory || 0;
          totalFinal += report.finalInventory || 0;
          totalRevenue += report.revenue || 0;
          totalExpense += report.expense ? report.expense.amount || 0 : 0;

          let exportHtml = '';
          if (report.exports) {
            return Promise.all(Object.entries(report.exports).map(([_, exportItem]) => {
              totalExport += exportItem.quantity || 0;
              return db.ref('inventory/' + exportItem.productId).once('value').then(s => {
                const product = s.val();
                return product ? `${exportItem.quantity} ${exportItem.productName}` : `${exportItem.quantity} Sản phẩm ${exportItem.productId}`;
              });
            })).then(texts => {
              exportHtml = texts.join(', ');
            });
          }

          const actions = (isCurrentUser || isManager) ? `<button onclick="deleteReport('${report.date}', '${report.uid}')" class="action-btn text-red-500 hover:underline">Xóa</button><button onclick="editReport('${report.date}', '${report.uid}')" class="action-btn text-blue-500 hover:underline">Sửa</button>` : '';

          html += `
            <div class="report-row">
              <p><strong>Ngày giờ:</strong> ${timestamp}</p>
              <p><strong>Nhân viên:</strong> ${employeeName}</p>
              <p><strong>Tồn kho đầu kỳ:</strong> ${report.initialInventory || 0}</p>
              <p><strong>Tồn kho cuối kỳ:</strong> ${report.finalInventory || 0}</p>
              <p><strong>Doanh Thu:</strong> ${report.revenue || 0}</p>
              <p><strong>Chi Phí:</strong> ${report.expense ? (report.expense.amount || 0) + ' (' + (report.expense.info || 'Không có thông tin') + ')' : '0 (Không có)'}</p>
              <p><strong>Xuất kho:</strong> ${exportHtml || 'Không có'}</p>
              ${actions}
            </div>
          `;
        }).catch(error => {
          console.error(`Lỗi tải tên người dùng cho UID ${report.uid}:`, error);
          const employeeName = report.user || report.uid;
          // Logic fallback
        });
      })).then(() => {
        html += `
          <div class="report-row bg-gray-100 mt-2">
            <p><strong>Tổng Tồn kho đầu kỳ:</strong> ${totalInitial}</p>
            <p><strong>Tổng Tồn kho cuối kỳ:</strong> ${totalFinal}</p>
            <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue}</p>
            <p><strong>Tổng Chi Phí:</strong> ${totalExpense}</p>
            <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
          </div>
        `;
      });
    })).then(() => {
      reportsList.innerHTML = html;
      console.log('Đã tải báo cáo chung thành công cho', elementId);
    }).catch(error => {
      console.error('Lỗi tải báo cáo:', error);
      reportsList.innerHTML = '<p>Lỗi tải báo cáo: ' + error.message + '</p>';
      alert('Lỗi tải báo cáo: ' + error.message);
    });
  });
}

function deleteReport(date, uid) {
  if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
    db.ref(`dailyData/${date}/${uid}`).remove().then(() => {
      alert('Xóa báo cáo thành công!');
      console.log('Đã xóa báo cáo:', date, uid);
    }).catch(error => {
      console.error('Lỗi xóa báo cáo:', error);
      alert('Lỗi xóa báo cáo: ' + error.message);
    });
  }
}

function editReport(date, uid) {
  alert(`Chức năng sửa báo cáo cho ngày ${date}, UID ${uid} chưa được triển khai đầy đủ.`);
  // Thêm form chỉnh sửa nếu cần
}
