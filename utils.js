// utils.js
function fetchReportSummary(date, callback) {
  const reportsRef = firebase.database().ref('shared_reports');
  const usersRef = firebase.database().ref('users');

  reportsRef.orderByChild('date').equalTo(date).once('value').then(snapshot => {
    const allReports = [];
    snapshot.forEach(child => allReports.push({ id: child.key, ...child.val() }));

    usersRef.once('value').then(userSnap => {
      const users = userSnap.val() || {};
      const group = { opening: [], cost: [], revenue: [], closing: [], exports: [] };
      let sum = { opening: 0, cost: 0, revenue: 0, closing: 0, export: 0 };

      allReports.forEach(r => {
        const name = users[r.uid]?.name || r.uid;
        const time = new Date(r.timestamp).toLocaleTimeString();
        group.opening.push(`${r.openingBalance} - ${name} ${time}`);
        group.cost.push(`${r.cost} - ${name} ${time}`);
        group.revenue.push(`${r.revenue} - ${name} ${time}`);
        group.closing.push(`${r.closingBalance} - ${name} ${time}`);

        sum.opening += r.openingBalance || 0;
        sum.revenue += r.revenue || 0;
        sum.closing += r.closingBalance || 0;

        if (r.cost) {
          const costVal = parseCostString(r.cost);
          sum.cost += costVal;
        }

        if (r.exports) {
          r.exports.forEach(e => {
            group.exports.push(`${e.quantity} ${e.productId} - ${name} ${time}`);
            sum.export += e.quantity;
          });
        }
      });

      sum.real = sum.opening + sum.revenue - sum.cost - sum.closing;
      callback(group, sum, allReports);
    });
  }).catch(error => {
    console.error('Lỗi tải báo cáo:', error);
    callback(null, null, null, error);
  });
}

function parseCostString(costStr) {
  if (!costStr) return 0;
  const numbers = costStr.match(/\d+/g);
  return numbers ? numbers.reduce((sum, num) => sum + Number(num), 0) : 0;
}
