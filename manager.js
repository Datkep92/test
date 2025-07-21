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

  db.ref('shared_reports').on('value', snapshot => {
    reportsList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      reportsList.innerHTML = '<p>Không có báo cáo.</p>';
      console.log('Không có dữ liệu báo cáo trong Firebase.');
      return;
    }

    console.log('Dữ liệu báo cáo thô:', data);

    const filterType = filter.value; // 'day' or 'month'
    let groupedReports = {};

    Object.entries(data).forEach(([reportId, report]) => {
      const key = filterType === 'day' ? report.date : report.date.substring(0, 7); // YYYY-MM-DD or YYYY-MM
      if (!groupedReports[key]) groupedReports[key] = [];
      groupedReports[key].push({ reportId, ...report });
    });

    let html = '';
    Promise.all(
      Object.entries(groupedReports).map(([key, reports]) => {
        let totalOpeningBalance = 0, totalCost = 0, totalRevenue = 0, totalClosingBalance = 0, totalExport = 0;
        let openingBalanceHtml = '', costHtml = '', revenueHtml = '', closingBalanceHtml = '', exportHtml = '';

        return Promise.all(
          reports.map(report => {
            const timestamp = new Date(report.timestamp).toLocaleString('vi-VN');
            console.log('Xử lý báo cáo:', report.reportId, 'UID:', report.uid);
            return db.ref('users/' + report.uid).once('value').then(userSnapshot => {
              const user = userSnapshot.val();
              const employeeName = user && user.name ? user.name : report.uid;

              if (report.openingBalance) {
                openingBalanceHtml += `<p>${report.openingBalance} - ${employeeName} ${timestamp}</p>`;
                totalOpeningBalance += report.openingBalance;
              }
              if (report.cost) {
                costHtml += `<p>${report.costDescription} ${report.cost} - ${employeeName} ${timestamp}</p>`;
                totalCost += report.cost;
              }
              if (report.revenue) {
                revenueHtml += `<p>${report.revenue} - ${employeeName} ${timestamp}</p>`;
                totalRevenue += report.revenue;
              }
              if (report.closingBalance) {
                closingBalanceHtml += `<p>${report.closingBalance} - ${employeeName} ${timestamp}</p>`;
                totalClosingBalance += report.closingBalance;
              }
              if (report.exports) {
                return Promise.all(Object.entries(report.exports).map(([productId, qty]) => {
                  return db.ref('inventory/' + productId).once('value').then(s => {
                    const product = s.val();
                    return product ? `<p>${qty} ${product.name} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>` : `<p>${qty} Sản phẩm ${productId} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, qty) => sum + qty, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>`;
              }
            }).catch(error => {
              console.error(`Lỗi tải tên người dùng cho UID ${report.uid}:`, error);
              const employeeName = report.uid;
              if (report.openingBalance) {
                openingBalanceHtml += `<p>${report.openingBalance} - ${employeeName} ${timestamp}</p>`;
                totalOpeningBalance += report.openingBalance;
              }
              if (report.cost) {
                costHtml += `<p>${report.costDescription} ${report.cost} - ${employeeName} ${timestamp}</p>`;
                totalCost += report.cost;
              }
              if (report.revenue) {
                revenueHtml += `<p>${report.revenue} - ${employeeName} ${timestamp}</p>`;
                totalRevenue += report.revenue;
              }
              if (report.closingBalance) {
                closingBalanceHtml += `<p>${report.closingBalance} - ${employeeName} ${timestamp}</p>`;
                totalClosingBalance += report.closingBalance;
              }
              if (report.exports) {
                return Promise.all(Object.entries(report.exports).map(([productId, qty]) => {
                  return db.ref('inventory/' + productId).once('value').then(s => {
                    const product = s.val();
                    return product ? `<p>${qty} ${product.name} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>` : `<p>${qty} Sản phẩm ${productId} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, qty) => sum + qty, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button> <button onclick="deleteReport('${reportId}')" class="text-red-500 hover:underline">Xóa</button></p>`;
              }
            });
          })
        ).then(() => {
          const netProfit = totalOpeningBalance + totalRevenue - totalCost - totalClosingBalance;
          html += `
            <div class="mb-4">
              <h4 class="text-lg font-semibold">${key}</h4>
              <div class="pl-4">
                <h5>Số Dư Đầu Kỳ:</h5>
                ${openingBalanceHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Số Dư Đầu Kỳ:</strong> ${totalOpeningBalance} ${new Date().toLocaleString('vi-VN')}</p>
                <hr class="my-2">
                <h5>Số Dư Cuối Kỳ:</h5>
                ${closingBalanceHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Số Dư Cuối Kỳ:</strong> ${totalClosingBalance} ${new Date().toLocaleString('vi-VN')}</p>
                <hr class="my-2">
                <h5>Chi Phí:</h5>
                ${costHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Chi Phí:</strong> ${totalCost} ${new Date().toLocaleString('vi-VN')}</p>
                <hr class="my-2">
                <h5>Doanh Thu:</h5>
                ${revenueHtml || '<p>Không có dữ liệu.</p>'}
                <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue} ${new Date().toLocaleString('vi-VN')}</p>
                <hr class="my-2">
                <h5>Số Tiền Thực Tế:</h5>
                <p>= Dư Đầu Kỳ: ${totalOpeningBalance} + Tổng Doanh Thu: ${totalRevenue} - Tổng Chi Phí: ${totalCost} - Tổng Số Dư Cuối Kỳ: ${totalClosingBalance} = ${netProfit} ${new Date().toLocaleString('vi-VN')}</p>
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

function editReport(reportId) {
  db.ref('shared_reports/' + reportId).once('value').then(snapshot => {
    const report = snapshot.val();
    if (!report) {
      console.error('Không tìm thấy báo cáo:', reportId);
      alert('Lỗi: Không tìm thấy báo cáo.');
      return;
    }

    const openingBalanceInput = document.getElementById('opening-balance');
    const costInput = document.getElementById('shared-cost');
    const revenueInput = document.getElementById('shared-revenue');
    const closingBalanceInput = document.getElementById('closing-balance');

    if (!openingBalanceInput || !costInput || !revenueInput || !closingBalanceInput) {
      console.error('Không tìm thấy một hoặc nhiều phần tử input trong DOM');
      alert('Lỗi: Giao diện chưa tải đúng. Vui lòng kiểm tra lại.');
      return;
    }

    openingBalanceInput.value = report.openingBalance || '';
    costInput.value = report.cost ? `${report.costDescription} ${report.cost}` : '';
    revenueInput.value = report.revenue || '';
    closingBalanceInput.value = report.closingBalance || '';
    
    if (report.exports) {
      Object.entries(report.exports).forEach(([productId, qty]) => {
        const input = document.querySelector(`.export-quantity[data-product-id="${productId}"]`);
        if (input) input.value = qty;
      });
    }

    const reportRef = db.ref('shared_reports/' + reportId);
    reportRef.set({
      ...report,
      openingBalance: parseFloat(openingBalanceInput.value) || 0,
      cost: parseExpenseInput(costInput.value).amount || undefined,
      costDescription: parseExpenseInput(costInput.value).description || undefined,
      costCategory: parseExpenseInput(costInput.value).category || undefined,
      revenue: parseFloat(revenueInput.value) || undefined,
      closingBalance: parseFloat(closingBalanceInput.value) || undefined,
      exports: Array.from(document.getElementsByClassName('export-quantity')).reduce((acc, input) => {
        const productId = input.dataset.productId;
        const qty = parseFloat(input.value) || 0;
        if (qty > 0) acc[productId] = qty;
        return acc;
      }, {}),
      uid: auth.currentUser.uid,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    }).then(() => {
      alert('Cập nhật báo cáo thành công!');
      openingBalanceInput.value = '';
      costInput.value = '';
      revenueInput.value = '';
      closingBalanceInput.value = '';
      document.querySelectorAll('.export-quantity').forEach(input => input.value = '');
      console.log('Đã cập nhật báo cáo:', reportId);
    }).catch(error => {
      console.error('Lỗi cập nhật báo cáo:', error);
      alert('Lỗi cập nhật báo cáo: ' + error.message);
    });
  }).catch(error => {
    console.error('Lỗi tải báo cáo để chỉnh sửa:', error);
    alert('Lỗi tải báo cáo để chỉnh sửa: ' + error.message);
  });
}

function deleteReport(reportId) {
  if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
    db.ref('shared_reports/' + reportId).remove().then(() => {
      alert('Xóa báo cáo thành công!');
      console.log('Đã xóa báo cáo:', reportId);
    }).catch(error => {
      console.error('Lỗi xóa báo cáo:', error);
      alert('Lỗi xóa báo cáo: ' + error.message);
    });
  }
}
