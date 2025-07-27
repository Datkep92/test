// Business Report Tab Functions
function renderBusinessReport(reports = globalReportData) {
  const reportTable = document.getElementById("shared-report-table");
  if (!reportTable) return;
  if (!reports || reports.length === 0) {
    reportTable.innerHTML = "<p>Chưa có dữ liệu thu chi.</p>";
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date(today).toLocaleDateString('vi-VN');
  const sortedReports = reports.map(report => ({
    ...report,
    date: new Date(report.date).toISOString().split("T")[0]
  })).filter(report => report.date === today);

  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const totalProfit = totalRevenue - totalExpense;

  const expenseCategories = {};
  sortedReports.forEach(report => {
    if (report.expenseNote && report.expenseAmount) {
      const note = report.expenseNote.toLowerCase().trim();
      let category = "Khác";
      if (note.includes("cam")) category = "Mua cam";
      else if (note.includes("xăng") || note.includes("xang")) category = "Mua xăng";
      else if (note.includes("trái cây") || note.includes("trai cay")) category = "Trái cây";
      expenseCategories[category] = (expenseCategories[category] || 0) + Number(report.expenseAmount);
    }
  });

  const expenseCategorySummary = document.getElementById("expense-category-summary");
  expenseCategorySummary.innerHTML = `
    <table><tr><th>Danh mục</th><th>Số tiền (VND)</th></tr>
    <tr><td>Tổng doanh thu</td><td>${totalRevenue.toLocaleString()}</td></tr>
    ${Object.keys(expenseCategories).length > 0
      ? Object.entries(expenseCategories).map(([category, amount]) => `<tr><td>${category}</td><td>${amount.toLocaleString()}</td></tr>`).join("")
      : "<tr><td colspan='2'>Chưa có chi phí nào.</td></tr>"}
    <tr><td><strong>Tổng chi phí</strong></td><td><strong>${totalExpense.toLocaleString()}</strong></td></tr>
    <tr><td><strong>Số tiền còn lại</strong></td><td><strong>${totalProfit.toLocaleString()}</strong></td></tr></table>`;

  const inventoryOutValue = sortedReports
    .filter(report => report.products)
    .reduce((sum, report) => sum + report.products.reduce((subSum, product) => subSum + (Number(product.quantity) * Number(product.price || 0)), 0), 0);
  const expenseMinusInventory = totalExpense - inventoryOutValue;
  document.getElementById("expense-minus-inventory").innerHTML = `
    <div><p>Tổng chi phí: ${totalExpense.toLocaleString()} VND</p>
    <p>Giá trị hàng xuất kho: ${inventoryOutValue.toLocaleString()} VND</p>
    <p>Số tiền sau trừ hàng xuất: ${expenseMinusInventory.toLocaleString()} VND</p></div>`;

  const expenseTable = document.getElementById("expense-summary-table");
  expenseTable.innerHTML = `
    <table><tr><th>Ngày</th><th>Nhân viên</th><th>Chi phí (VND)</th><th>Ghi chú</th></tr>
    ${sortedReports.filter(report => Number(report.expenseAmount) > 0).map(report => `
      <tr><td>${new Date(report.date).toLocaleDateString()}</td>
      <td>${report.employeeName || "Không xác định"}</td>
      <td>${Number(report.expenseAmount).toLocaleString()}</td>
      <td>${report.expenseNote || ""}</td></tr>`).join("") || "<tr><td colspan='4'>Chưa có chi phí nào.</td></tr>"}</table>`;

  generateBusinessChart(sortedReports);
}

function generateBusinessChart(reports = []) {
  const ctx = document.getElementById('growth-chart').getContext('2d');
  if (!window.myChart) {
    window.myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: reports.map(r => new Date(r.date).toLocaleDateString('vi-VN')),
        datasets: [{
          label: 'Doanh thu',
          data: reports.map(r => r.revenue || 0),
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true
        }, {
          label: 'Chi phí',
          data: reports.map(r => r.expenseAmount || 0),
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  } else {
    window.myChart.data.labels = reports.map(r => new Date(r.date).toLocaleDateString('vi-VN'));
    window.myChart.data.datasets[0].data = reports.map(r => r.revenue || 0);
    window.myChart.data.datasets[1].data = reports.map(r => r.expenseAmount || 0);
    window.myChart.update();
  }
}

function exportReportsToCSV() {
  const csv = [];
  const headers = ["Ngày", "Nhân viên", "Doanh thu (VND)", "Chi phí (VND)", "Ghi chú"];
  csv.push(headers.join(","));
  globalReportData.forEach(report => {
    const row = [
      new Date(report.date).toLocaleDateString('vi-VN'),
      report.employeeName || "Không xác định",
      (report.revenue || 0).toLocaleString('vi-VN'),
      (report.expenseAmount || 0).toLocaleString('vi-VN'),
      report.expenseNote || ""
    ];
    csv.push(row.join(","));
  });
  const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "baocao_thuchi.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}