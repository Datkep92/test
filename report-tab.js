let manualCostGroups = {};
let globalReportRaw = [];
let globalInventoryRaw = [];
let globalPayrollRaw = [];

// Khởi tạo flatpickr bộ lọc thời gian
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("report-filter-range")) {
    flatpickr("#report-filter-range", {
      mode: "range",
      dateFormat: "Y-m-d",
      defaultDate: [new Date(), new Date()],
      locale: { firstDayOfWeek: 1 }
    });
  }
});

// Lấy dữ liệu mới nhất từ Firebase
function fetchAllReportData() {
  // Reports
  firebase.database().ref("reports").once("value").then(snap => {
    const val = snap.val() || {};
    globalReportRaw = Object.values(val);
    renderAllReportSections();
  });

  // Inventory
  firebase.database().ref("inventory").once("value").then(snap => {
    const val = snap.val() || {};
    globalInventoryRaw = Object.values(val);
    renderInventorySection();
  });

  // Payroll
  firebase.database().ref("payroll").once("value").then(snap => {
    const val = snap.val() || {};
    globalPayrollRaw = Object.values(val);
    renderPayrollSection();
  });
}

// Áp dụng bộ lọc thời gian
function applyReportFilter() {
  const range = document.getElementById("report-filter-range").value;
  if (!range) {
    renderAllReportSections();
    return;
  }

  const [start, end] = range.split(" to ").map(d => new Date(d));
  const filtered = globalReportRaw.filter(r => {
    const date = new Date(r.date);
    return date >= start && date <= end;
  });

  renderRevenueExpenseSection(filtered);
}

// Thêm nhóm gộp thủ công
function addManualCostGroup() {
  const keyword = document.getElementById("group-keyword").value.trim().toLowerCase();
  const target = document.getElementById("group-target").value.trim().toLowerCase();
  if (!keyword || !target) return alert("Nhập đầy đủ thông tin");

  manualCostGroups[keyword] = target;
  renderRevenueExpenseSection(globalReportRaw);
}

// ===== Render Phần 1 =====
function renderRevenueExpenseSection(data) {
  if (!data || !data.length) {
    document.getElementById("report-summary-table").innerHTML = "<p>Không có dữ liệu</p>";
    document.getElementById("report-expense-detail").innerHTML = "";
    return;
  }

  // Tính toán tổng
  const revenueTotal = data.reduce((s, r) => s + (r.revenue || 0), 0);
  const expenseTotal = data.reduce((s, r) => s + (r.expenseAmount || 0), 0);
  const grabTotal = data.reduce((s, r) => s + (r.grabAmount || 0), 0);
  const transferTotal = data.reduce((s, r) => s + (r.transferAmount || 0), 0);
  const payrollTotal = globalPayrollRaw.reduce((s, p) => s + (p.totalSalary || 0), 0);
  const netProfit = revenueTotal - expenseTotal - payrollTotal;

  // Gom chi phí
  const allExpenses = data.map(r => ({ note: r.expenseNote, amount: r.expenseAmount }))
    .filter(e => e.amount > 0);
  const groupMap = new Map();
  allExpenses.forEach(e => {
    let key = (e.note || "").toLowerCase().split(" ")[0];
    if (manualCostGroups[key]) key = manualCostGroups[key];
    if (!groupMap.has(key)) groupMap.set(key, 0);
    groupMap.set(key, groupMap.get(key) + e.amount);
  });

  // Render bảng tổng hợp
  document.getElementById("report-summary-table").innerHTML = `
    <table class="table-style">
      <tr><th>Tổng Doanh thu</th><td>${revenueTotal.toLocaleString()} ₫</td></tr>
      <tr><th>Tổng Chi phí</th><td>${expenseTotal.toLocaleString()} ₫</td></tr>
      <tr><th>Tổng Lương NV</th><td>${payrollTotal.toLocaleString()} ₫</td></tr>
      <tr><th>Tổng Grab</th><td>${grabTotal.toLocaleString()} ₫</td></tr>
      <tr><th>Tổng CK</th><td>${transferTotal.toLocaleString()} ₫</td></tr>
      <tr><th><b>Lợi nhuận</b></th><td><b>${netProfit.toLocaleString()} ₫</b></td></tr>
    </table>
  `;

  // Render chi tiết chi phí
  document.getElementById("report-expense-detail").innerHTML = `
    <table class="table-style">
      <thead><tr><th>Nhóm</th><th>Tổng</th></tr></thead>
      <tbody>
        ${[...groupMap.entries()].map(([k, v]) =>
          `<tr><td>${k}</td><td>${v.toLocaleString()} ₫</td></tr>`).join("")}
      </tbody>
    </table>
  `;

  // Vẽ biểu đồ
  if (window.myReportChart) window.myReportChart.destroy();
  const ctx = document.getElementById("chart-profit").getContext("2d");
  window.myReportChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Doanh thu", "Chi phí", "Lương NV", "Lợi nhuận"],
      datasets: [{
        data: [revenueTotal, expenseTotal, payrollTotal, netProfit],
        backgroundColor: ["#4caf50", "#f44336", "#ff9800", "#2196f3"]
      }]
    }
  });
}

// ===== Render Phần 2 =====
function renderInventorySection() {
  const data = globalInventoryRaw;
  document.getElementById("report-inventory").innerHTML = `
    <table class="table-style">
      <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Ngưỡng tồn</th></tr></thead>
      <tbody>
        ${data.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.lowStockThreshold || 0}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

// ===== Render Phần 3 =====
function renderPayrollSection() {
  const data = globalPayrollRaw;
  document.getElementById("report-payroll").innerHTML = `
    <table class="table-style">
      <thead><tr><th>Nhân viên</th><th>Lương</th><th>Thưởng</th><th>Phạt</th><th>Thực nhận</th></tr></thead>
      <tbody>
        ${data.map(p => {
          const real = (p.totalSalary || 0) + (p.bonusTotal || 0) - (p.penaltyTotal || 0);
          return `<tr><td>${p.employeeName || ""}</td><td>${(p.totalSalary || 0).toLocaleString()} ₫</td>
            <td>${(p.bonusTotal || 0).toLocaleString()} ₫</td>
            <td>${(p.penaltyTotal || 0).toLocaleString()} ₫</td>
            <td>${real.toLocaleString()} ₫</td></tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

// Gọi khi mở tab Báo Cáo
function renderAllReportSections() {
  renderRevenueExpenseSection(globalReportRaw);
  renderInventorySection();
  renderPayrollSection();
}