function parseCostString(costStr) {
  if (!costStr) return 0;
  const numbers = costStr.match(/\d+/g);
  return numbers ? numbers.reduce((sum, num) => sum + Number(num), 0) : 0;
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.toLocaleDateString('vi-VN')}`;
}

function fetchReportSummary(date, filterType, callback) {
  console.log('fetchReportSummary: Fetching reports for date:', date, 'filterType:', filterType);
  const reportsRef = firebase.database().ref('shared_reports');
  reportsRef.orderByChild('date').equalTo(date).once('value')
    .then(snapshot => {
      const allReports = [];
      snapshot.forEach(child => {
        allReports.push({ id: child.key, ...child.val() });
      });
      console.log('fetchReportSummary: Retrieved reports:', allReports);

      if (allReports.length === 0) {
        console.log('fetchReportSummary: No reports found, returning empty result');
        callback(null, null, [], null);
        return;
      }

      const group = { opening: [], cost: [], revenue: [], closing: [], exports: [] };
      let sum = { opening: 0, cost: 0, revenue: 0, closing: 0, export: 0 };

      const userIds = [...new Set(allReports.map(r => r.uid))];
      console.log('fetchReportSummary: Unique user IDs:', userIds);

      const userPromises = userIds.map(uid =>
        firebase.database().ref(`users/${uid}/name`).once('value')
          .then(snap => {
            const name = snap.val() || (auth.currentUser?.uid === uid ? auth.currentUser.displayName || uid.substring(0, 6) : uid.substring(0, 6));
            console.log(`fetchReportSummary: Fetched name for UID ${uid}:`, name);
            return { uid, name };
          })
          .catch(error => {
            console.warn(`fetchReportSummary: Failed to fetch name for UID ${uid}:`, error.message);
            const name = auth.currentUser?.uid === uid ? auth.currentUser.displayName || uid.substring(0, 6) : uid.substring(0, 6);
            return { uid, name };
          })
      );

      Promise.all(userPromises)
        .then(userData => {
          const users = userData.reduce((acc, { uid, name }) => ({ ...acc, [uid]: { name } }), {});
          console.log('fetchReportSummary: User data:', users);

          allReports.forEach(r => {
            const name = users[r.uid]?.name || r.userName || r.uid.substring(0, 6);
            const time = formatTimestamp(r.timestamp);
            group.opening.push(`${r.openingBalance || 0} - ${name} ${time}`);
            group.cost.push(`${r.cost || '0'} - ${name} ${time}`);
            group.revenue.push(`${r.revenue || 0} - ${name} ${time}`);
            group.closing.push(`${r.closingBalance || 0} - ${name} ${time}`);

            sum.opening += r.openingBalance || 0;
            sum.revenue += r.revenue || 0;
            sum.closing += r.closingBalance || 0;
            sum.cost += parseCostString(r.cost);

            if (r.exports) {
              r.exports.forEach(e => {
                group.exports.push(`${e.quantity} ${e.productName || e.productId} - ${name} ${time}`);
                sum.export += e.quantity || 0;
              });
            }
          });

          sum.real = sum.opening + sum.revenue - sum.cost - sum.closing;
          console.log('fetchReportSummary: Processed data:', { group, sum, reports: allReports });
          callback(group, sum, allReports, null);
        })
        .catch(error => {
          console.error('fetchReportSummary: Error processing user data:', error);
          // Fallback: Use userName from report or UID
          allReports.forEach(r => {
            const name = r.userName || (auth.currentUser?.uid === r.uid ? auth.currentUser.displayName || 'Nhân viên' : r.uid.substring(0, 6));
            const time = formatTimestamp(r.timestamp);
            group.opening.push(`${r.openingBalance || 0} - ${name} ${time}`);
            group.cost.push(`${r.cost || '0'} - ${name} ${time}`);
            group.revenue.push(`${r.revenue || 0} - ${name} ${time}`);
            group.closing.push(`${r.closingBalance || 0} - ${name} ${time}`);

            sum.opening += r.openingBalance || 0;
            sum.revenue += r.revenue || 0;
            sum.closing += r.closingBalance || 0;
            sum.cost += parseCostString(r.cost);

            if (r.exports) {
              r.exports.forEach(e => {
                group.exports.push(`${e.quantity} ${e.productName || e.productId} - ${name} ${time}`);
                sum.export += e.quantity || 0;
              });
            }
          });

          sum.real = sum.opening + sum.revenue - sum.cost - sum.closing;
          console.log('fetchReportSummary: Fallback processed data:', { group, sum, reports: allReports });
          callback(group, sum, allReports, null);
        });
    })
    .catch(error => {
      console.error('fetchReportSummary: Error fetching reports:', error);
      callback(null, null, null, error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập báo cáo.' : error.message);
    });
}

function loadInventoryData(containerId, renderCallback) {
  console.log('loadInventoryData: Loading inventory for container:', containerId);
  const inventoryList = document.getElementById(containerId);
  if (!inventoryList) {
    console.error(`loadInventoryData: Không tìm thấy container ${containerId}`);
    return;
  }

  inventoryList.innerHTML = '<p class="text-gray-500">Đang tải dữ liệu...</p>';
  db.ref('inventory').on('value', snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      console.log(`loadInventoryData: Không có dữ liệu tồn kho cho ${containerId}`);
      inventoryList.innerHTML = '<p class="text-gray-500">Không có dữ liệu tồn kho.</p>';
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      renderCallback(div, productId, product);
      inventoryList.appendChild(div);
    });
    console.log(`loadInventoryData: Đã tải danh sách tồn kho thành công cho ${containerId}`);
  }, error => {
    console.error('loadInventoryData: Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = `<p class="text-red-500">${error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập tồn kho.' : 'Lỗi tải tồn kho.'}</p>`;
  });
}
