import { ref, push, set, onValue, remove } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js';

function addInventory() {
  const name = document.getElementById('product-name').value;
  const quantity = parseFloat(document.getElementById('product-quantity').value);
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || isNaN(quantity) || isNaN(price) || quantity < 0 || price < 0) {
    alert('Vui lòng nhập đầy đủ thông tin hợp lệ.');
    return;
  }

  const inventoryRef = push(ref(db, 'inventory'));
  set(inventoryRef, {
    name,
    quantity,
    price,
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
    alert('Lỗi: Không tìm thấy danh sách tồn kho. Vui lòng kiểm tra giao diện.');
    return;
  }

  onValue(ref(db, 'inventory'), snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      inventoryList.innerHTML = '<p>Không có dữ liệu tồn kho.</p>';
      console.log('Không có dữ liệu tồn kho trong Firebase.');
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      div.innerHTML = `
        <p><strong>${product.name}</strong>: ${product.quantity} (Đơn giá: ${product.price})</p>
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
    console.error('Không tìm thấy phần tử report-table trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo. Vui lòng kiểm tra giao diện.');
    return;
  }

  const filter = document.getElementById('report-filter');
  if (!filter) {
    console.error('Không tìm thấy phần tử report-filter trong DOM');
    alert('Lỗi: Không tìm thấy bộ lọc báo cáo. Vui lòng kiểm tra giao diện.');
    return;
  }

  onValue(ref(db, 'dailyData'), snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo.</p>';
      console.log('Không có dữ liệu báo cáo trong dailyData.');
      return;
    }

    console.log('Dữ liệu báo cáo thô:', data);

    const filterType = filter.value; // 'day' or 'month'
    let groupedReports = {};

    Object.entries(data).forEach(([date, users]) => {
      const formattedDate = date.replace(/_/g, '/');
      const key = filterType === 'day' ? formattedDate : formattedDate.substring(3); // DD/MM/YYYY or MM/YYYY
      Object.entries(users).forEach(([uid, report]) => {
        if (uid === 'expenses' || !/^[a-zA-Z0-9]+$/.test(uid)) {
          console.warn('Bỏ qua key không hợp lệ:', uid);
          return;
        }
        if (!groupedReports[key]) groupedReports[key] = [];
        groupedReports[key].push({ date, uid, ...report });
      });
    });

    let html = '';
    Promise.all(
      Object.entries(groupedReports).map(([key, reports]) => {
        let totalRevenue = 0, totalExport = 0;
        let revenueHtml = '', exportHtml = '';

        return Promise.all(
          reports.map(report => {
            const timestamp = new Date(report.lastUpdated).toLocaleString('vi-VN');
            console.log('Xử lý báo cáo:', report.date, 'UID:', report.uid);
            return onValue(ref(db, 'users/' + report.uid), snapshot => {
              const user = snapshot.val();
              const employeeName = user && user.name ? user.name : report.user || report.uid;

              if (report.revenue) {
                revenueHtml += `<p>${report.revenue} - ${employeeName} ${timestamp}</p>`;
                totalRevenue += report.revenue;
              }
              if (report.exports) {
                return Promise.all(Object.entries(report.exports).map(([index, exportItem]) => {
                  return onValue(ref(db, 'inventory/' + exportItem.productId), s => {
                    const product = s.val();
                    return product ? `<p>${exportItem.quantity} ${exportItem.productName} - ${employeeName} ${timestamp} <button onclick="deleteReport('${report.date}', '${report.uid}')" class="text-red-500 hover:underline">Xóa</button></p>` : `<p>${exportItem.quantity} Sản phẩm ${exportItem.productId} - ${employeeName} ${timestamp} <button onclick="deleteReport('${report.date}', '${report.uid}')" class="text-red-500 hover:underline">Xóa</button></p>`;
                  }, { onlyOnce: true });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, item) => sum + item.quantity, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp} <button onclick="deleteReport('${report.date}', '${report.uid}')" class="text-red-500 hover:underline">Xóa</button></p>`;
              }
            }, { onlyOnce: true });
          })
        ).then(() => {
          html += `
            <div class="mb-4">
              <h4 class="text-lg font-semibold">${key}</h4>
              <div class="pl-4">
                <h5>Doanh Thu:</h5>
                ${revenueHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue} ${new Date().toLocaleString('vi-VN')}</p>
                <hr class="my-2">
                <h5>Xuất Kho:</h5>
                ${exportHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Xuất Kho:</strong> ${totalExport} ${new Date().toLocaleString('vi-VN')}</p>
              </div>
            </div>
          `;
        });
      })
    ).then(() => {
      reportsList.innerHTML = html;
      console.log('Đã tải báo cáo chung thành công cho', elementId);
    }).catch(error => {
      console.error('Lỗi tải báo cáo:', error);
      reportsList.innerHTML = '<p>Lỗi tải báo cáo: ' + error.message + '</p>';
      alert('Lỗi tải báo cáo: ' + error.message);
    });
  }, error => {
    console.error('Lỗi tải báo cáo:', error);
    reportsList.innerHTML = '<p>Lỗi tải báo cáo: ' + error.message + '</p>';
    alert('Lỗi tải báo cáo: ' + error.message);
  });
}

function deleteReport(date, uid) {
  if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
    remove(ref(db, `dailyData/${date}/${uid}`)).then(() => {
      alert('Xóa báo cáo thành công!');
      console.log('Đã xóa báo cáo:', date, uid);
    }).catch(error => {
      console.error('Lỗi xóa báo cáo:', error);
      alert('Lỗi xóa báo cáo: ' + error.message);
    });
  }
}
