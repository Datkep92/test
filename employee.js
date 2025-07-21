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
  const openingBalanceInput = document.getElementById('opening-balance');
  const costInput = document.getElementById('shared-cost');
  const revenueInput = document.getElementById('shared-revenue');
  const closingBalanceInput = document.getElementById('closing-balance');
  const exportInputs = document.getElementsByClassName('export-quantity');

  if (!openingBalanceInput || !costInput || !revenueInput || !closingBalanceInput) {
    console.error('Không tìm thấy một hoặc nhiều phần tử input trong DOM');
    alert('Lỗi: Giao diện chưa tải đúng. Vui lòng kiểm tra lại.');
    return;
  }

  console.log('Bắt đầu xử lý báo cáo...');
  const openingBalance = parseFloat(openingBalanceInput.value) || 0;
  const costInputValue = costInput.value;
  const revenue = parseFloat(revenueInput.value) || 0;
  const closingBalance = parseFloat(closingBalanceInput.value) || 0;
  const exportQuantities = Array.from(exportInputs).reduce((acc, input) => {
    const productId = input.dataset.productId;
    const qty = parseFloat(input.value) || 0;
    if (qty > 0) acc[productId] = qty;
    return acc;
  }, {});

  console.log('Dữ liệu nhập:', { openingBalance, costInputValue, revenue, closingBalance, exportQuantities });

  if (openingBalance === 0 && !costInputValue && revenue === 0 && closingBalance === 0 && Object.keys(exportQuantities).length === 0) {
    alert('Vui lòng nhập ít nhất một trường thông tin.');
    console.log('Không có dữ liệu hợp lệ để gửi báo cáo.');
    return;
  }

  const reportData = {
    uid: auth.currentUser.uid,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    timestamp: new Date().toISOString(),
  };

  if (openingBalance > 0) reportData.openingBalance = openingBalance;
  if (costInputValue) {
    const expense = parseExpenseInput(costInputValue);
    reportData.cost = expense.amount;
    reportData.costDescription = expense.description;
    reportData.costCategory = expense.category;
  }
  if (revenue > 0) reportData.revenue = revenue;
  if (closingBalance > 0) reportData.closingBalance = closingBalance;
  if (Object.keys(exportQuantities).length > 0) reportData.exports = exportQuantities;

  console.log('Dữ liệu báo cáo gửi đi:', reportData);

  const reportRef = db.ref('shared_reports').push();
  reportRef.set(reportData).then(() => {
    console.log('Đã lưu báo cáo vào shared_reports:', reportRef.key);
    if (Object.keys(exportQuantities).length > 0) {
      return Promise.all(Object.entries(exportQuantities).map(([productId, qty]) => {
        console.log(`Cập nhật tồn kho cho productId ${productId}: ${qty}`);
        return db.ref('inventory/' + productId).once('value').then(snapshot => {
          const product = snapshot.val();
          if (!product) {
            throw new Error(`Không tìm thấy sản phẩm ${productId} trong kho.`);
          }
          if (product.quantity >= qty) {
            return db.ref('inventory/' + productId).update({
              quantity: product.quantity - qty
            }).then(() => {
              console.log(`Đã cập nhật tồn kho cho ${productId}: ${product.quantity - qty}`);
            });
          } else {
            throw new Error(`Số lượng xuất kho (${qty}) vượt quá tồn kho (${product.quantity}) cho sản phẩm ${productId}.`);
          }
        });
      }));
    }
  }).then(() => {
    alert('Gửi báo cáo thành công!');
    openingBalanceInput.value = '';
    costInput.value = '';
    revenueInput.value = '';
    closingBalanceInput.value = '';
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
        <input type="number" min="0" class="export-quantity w-24 p-1 border rounded" data-product-id="${productId}" placeholder="Số lượng xuất">
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
                    return product ? `<p>${qty} ${product.name} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>` : `<p>${qty} Sản phẩm ${productId} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, qty) => sum + qty, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>`;
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
                    return product ? `<p>${qty} ${product.name} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>` : `<p>${qty} Sản phẩm ${productId} - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>`;
                  });
                })).then(texts => {
                  exportHtml += texts.join('');
                  totalExport += Object.values(report.exports).reduce((sum, qty) => sum + qty, 0);
                });
              } else {
                exportHtml += `<p>Không có xuất kho - ${employeeName} ${timestamp} <button onclick="editReport('${reportId}')" class="text-blue-500 hover:underline">Sửa</button></p>`;
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
