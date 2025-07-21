let expenseCategories = [];

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function parseExpenseInput(input) {
  const normalized = input.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
  
  const amountMatch = normalized.match(/(\d+)\s*$/);
  const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
  
  let description = normalized;
  if (amountMatch) {
    description = normalized.substring(0, amountMatch.index).trim();
  }
  
  const categoryMatch = description.match(/^\s*(\S+)/);
  const category = categoryMatch ? categoryMatch[1] : 'khac';
  
  if (!expenseCategories.includes(category)) {
    expenseCategories.push(category);
    const categoriesRef = db.ref('expenseCategories');
    categoriesRef.set(expenseCategories).catch(error => {
      console.error('Lỗi cập nhật danh mục chi phí:', error);
    });
  }
  
  return {
    description: capitalizeFirstLetter(description),
    amount: amount,
    category: capitalizeFirstLetter(category)
  };
}

function submitSharedReport() {
  const revenueInput = document.getElementById('shared-revenue');
  const exportInputs = document.getElementsByClassName('export-quantity');
  const noteInput = document.getElementById('shared-note');

  if (!revenueInput || !noteInput) {
    console.error('Không tìm thấy một hoặc nhiều phần tử input trong DOM');
    alert('Lỗi: Giao diện chưa tải đúng. Vui lòng kiểm tra lại.');
    return;
  }

  console.log('Bắt đầu xử lý báo cáo...');
  const revenue = parseFloat(revenueInput.value) || 0;
  const note = noteInput.value || '';
  const exportQuantities = Array.from(exportInputs).reduce((acc, input) => {
    const productId = input.dataset.productId;
    const qty = parseFloat(input.value) || 0;
    if (qty > 0) {
      acc[productId] = {
        productId,
        quantity: qty,
        productName: input.dataset.productName || 'Unknown',
        price: parseFloat(input.dataset.productPrice) || 0,
        unit: input.dataset.productUnit || 'Unknown',
        timestamp: Date.now()
      };
    }
    return acc;
  }, {});

  console.log('Dữ liệu nhập:', { revenue, note, exportQuantities });

  if (revenue === 0 && Object.keys(exportQuantities).length === 0 && !note) {
    alert('Vui lòng nhập ít nhất một trường thông tin.');
    console.log('Không có dữ liệu hợp lệ để gửi báo cáo.');
    return;
  }

  const reportData = {
    user: auth.currentUser.email,
    date: new Date().toLocaleDateString('vi-VN'),
    lastUpdated: Date.now()
  };

  if (revenue > 0) reportData.revenue = revenue;
  if (note) reportData.note = note;
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  console.log('Dữ liệu báo cáo gửi đi:', reportData);

  const dateKey = reportData.date.replace(/\//g, '_');
  const reportRef = db.ref(`dailyData/${dateKey}/${auth.currentUser.uid}`);
  reportRef.set(reportData).then(() => {
    console.log('Đã lưu báo cáo vào dailyData:', dateKey, auth.currentUser.uid);
    if (Object.keys(exportQuantities).length > 0) {
      return Promise.all(Object.entries(exportQuantities).map(([productId, exportItem]) => {
        console.log(`Cập nhật tồn kho cho productId ${productId}: ${exportItem.quantity}`);
        return db.ref('inventory/' + productId).once('value').then(snapshot => {
          const product = snapshot.val();
          if (!product) {
            throw new Error(`Không tìm thấy sản phẩm ${productId} trong kho.`);
          }
          if (product.quantity >= exportItem.quantity) {
            return db.ref('inventory/' + productId).update({
              quantity: product.quantity - exportItem.quantity
            }).then(() => {
              console.log(`Đã cập nhật tồn kho cho ${productId}: ${product.quantity - exportItem.quantity}`);
            });
          } else {
            throw new Error(`Số lượng xuất kho (${exportItem.quantity}) vượt quá tồn kho (${product.quantity}) cho sản phẩm ${productId}.`);
          }
        });
      }));
    }
  }).then(() => {
    alert('Gửi báo cáo thành công!');
    revenueInput.value = '';
    noteInput.value = '';
    Array.from(exportInputs).forEach(input => input.value = '');
    console.log('Đã xóa các trường nhập sau khi gửi báo cáo.');
  }).catch(error => {
    console.error('Lỗi gửi báo cáo hoặc cập nhật tồn kho:', error);
    alert('Lỗi: ' + error.message);
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
      div.className = 'flex items-center justify-between p-2 border-b';
      div.innerHTML = `
        <span>${product.name} (Số lượng: ${product.quantity})</span>
        <input type="number" min="0" class="export-quantity w-24 p-1 border rounded" data-product-id="${productId}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-unit="${product.unit || 'Unknown'}" placeholder="Số lượng xuất">
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

  db.ref('dailyData').on('value', snapshot => {
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
            return db.ref('users/' + report.uid).once('value').then(userSnapshot => {
              const user = userSnapshot.val();
              const employeeName = user && user.name ? user.name : report.user || report.uid;

              if (report.revenue) {
                revenueHtml += `<p>${report.revenue} - ${employeeName} ${timestamp}</p>`;
                totalRevenue += report.revenue;
              }
              if (report.exports) {
                return Promise.all(Object.entries(report.exports).map(([index, exportItem]) => {
                  return db.ref('inventory/' + exportItem.productId).once('value').then(s => {
                    const product = s.val();
                    return product ? `<p>${exportItem.quantity} ${exportItem.productName} - ${employeeName} ${timestamp}</p>` : `<p>${exportItem.quantity} Sản phẩm ${exportItem.productId} - ${employeeName} ${timestamp}</p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, item) => sum + item.quantity, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp}</p>`;
              }
            }).catch(error => {
              console.error(`Lỗi tải tên người dùng cho UID ${report.uid}:`, error);
              const employeeName = report.user || report.uid;
              if (report.revenue) {
                revenueHtml += `<p>${report.revenue} - ${employeeName} ${timestamp}</p>`;
                totalRevenue += report.revenue;
              }
              if (report.exports) {
                return Promise.all(Object.entries(report.exports).map(([index, exportItem]) => {
                  return db.ref('inventory/' + exportItem.productId).once('value').then(s => {
                    const product = s.val();
                    return product ? `<p>${exportItem.quantity} ${exportItem.productName} - ${employeeName} ${timestamp}</p>` : `<p>${exportItem.quantity} Sản phẩm ${exportItem.productId} - ${employeeName} ${timestamp}</p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, item) => sum + item.quantity, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp}</p>`;
              }
            });
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
