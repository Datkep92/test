// report-tab.js (REWRITE) - Báo cáo thu chi hoàn chỉnh (thay thế)

// ---------- CONFIG / GLOBALS ----------
const INVENTORY_MOVEMENTS_PATH = "inventoryMovements"; // đổi nếu DB bạn khác (ví dụ: "inventoryOutputs")
let manualCostGroups = {};         // { keyword: targetGroup }
let globalReportRaw = [];          // toàn bộ báo cáo (reports)
let globalInventoryRaw = [];       // sản phẩm kho
let globalInventoryOutputs = [];   // chuyển động xuất kho (nếu có)
let globalPayrollRaw = [];         // bảng lương / payroll
let reportFilterPicker = null;     // flatpickr instance
let lastComputedGroupKeys = [];    // lưu group keys hiện có để modal dùng
let lastComputedGroupMap = {};     // lưu map từ render để modal dễ lấy

// ---------- DOM Ready & flatpickr init ----------
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("report-filter-range");
  if (el && typeof flatpickr !== "undefined") {
    reportFilterPicker = flatpickr(el, {
      mode: "range",
      dateFormat: "Y-m-d",
      defaultDate: [],
      locale: { firstDayOfWeek: 1 },
      onClose: function(selectedDates) {
        applyReportFilter();
      }
    });
  }

  // ensure modal container exists
  if (!document.getElementById("group-edit-modal")) {
    const modal = document.createElement("div");
    modal.id = "group-edit-modal";
    modal.style.display = "none";
    modal.style.position = "fixed";
    modal.style.left = 0; modal.style.top = 0; modal.style.width = "100%"; modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.5)";
    modal.style.zIndex = 9999;
    document.body.appendChild(modal);
  }
});

// ---------- Fetch all data ----------
function fetchAllReportData() {
  const db = firebase.database();

  const pReports = db.ref("reports").once("value");
  const pInventory = db.ref("inventory").once("value");
  const pPayroll = db.ref("payroll").once("value");
  const pInvMov = db.ref(INVENTORY_MOVEMENTS_PATH).once("value").catch(() => ({ val: () => null }));

  Promise.all([pReports, pInventory, pPayroll, pInvMov])
    .then(([reportsSnap, inventorySnap, payrollSnap, invMovSnap]) => {
      globalReportRaw = Object.values(reportsSnap.val() || {});
      globalInventoryRaw = Object.values(inventorySnap.val() || {});
      globalPayrollRaw = Object.values(payrollSnap.val() || {});
      globalInventoryOutputs = Object.values(invMovSnap.val() || {});

      // render
      renderAllReportSections();
    })
    .catch(err => {
      console.error("Lỗi khi fetch dữ liệu báo cáo:", err);
    });
}

// ---------- Apply date range filter ----------
function applyReportFilter() {
  let start = null, end = null;

  // Lấy ngày từ flatpickr nếu có
  if (reportFilterPicker && reportFilterPicker.selectedDates && reportFilterPicker.selectedDates.length === 2) {
    start = new Date(reportFilterPicker.selectedDates[0]);
    end = new Date(reportFilterPicker.selectedDates[1]);
  } else {
    // Lấy từ input text
    const raw = (document.getElementById("report-filter-range") || {}).value || "";
    if (!raw) {
      renderAllReportSections();
      return;
    }
    const parts = raw.split(/\s+to\s+|\s*-\s*/i).map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      start = new Date(parts[0]);
      end = new Date(parts[0]);
    } else {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
    }
  }

  // Kiểm tra hợp lệ
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.warn("Invalid date range filter");
    renderAllReportSections();
    return;
  }

  // Set đầu và cuối ngày
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);

  // Lọc dữ liệu theo ngày
  const filtered = globalReportRaw.filter(r => {
    const d = new Date(r.date || r.createdAt || r.timestamp || r.time || r.datetime);
    return !isNaN(d.getTime()) && d >= start && d <= end;
  });

  const invFiltered = globalInventoryOutputs.filter(m => {
    const d = new Date(m.date || m.timestamp || m.createdAt);
    return !isNaN(d.getTime()) && d >= start && d <= end;
  });

  // Render các phần báo cáo
  renderRevenueExpenseSection(filtered, { dateRange: [start, end], inventoryRangeOutputs: invFiltered });
  renderDailyExpenseTable(filtered, invFiltered, { start, end });
  renderInventoryExportReport(); // vẫn tính theo rangeVal từ input
  renderReportPayrollTable(start, end); // <-- Lương nhân viên áp dụng bộ lọc
}


// ---------- Add manual cost group via small form (legacy) ----------
function addManualCostGroup() {
  const keywordEl = document.getElementById("group-keyword");
  const targetEl = document.getElementById("group-target");
  const keyword = (keywordEl && keywordEl.value.trim().toLowerCase()) || "";
  const target = (targetEl && targetEl.value.trim().toLowerCase()) || "";
  if (!keyword || !target) return alert("Nhập đầy đủ thông tin");
  manualCostGroups[keyword] = target;
  renderRevenueExpenseSection(globalReportRaw);
}

// ---------- Main render: revenue/expense summary & monthly cost table & chart ----------
/**
 * renderRevenueExpenseSection(data, opts)
 * data: array of reports (filtered or full)
 * opts: { dateRange: [start,end], inventoryRangeOutputs: [] }
 *
 * Monthly cost table always based on globalReportRaw (full), but summary/chart reflect `data` passed.
 */
function renderRevenueExpenseSection(data, opts = {}) {
  // fallback to all data for summary if not provided
  const summaryData = (Array.isArray(data) && data.length) ? data : globalReportRaw.slice();

  const revenueTotal = summaryData.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const expenseTotal = summaryData.reduce((s, r) => s + Number(r.expenseAmount || 0), 0);
  const grabTotal = summaryData.reduce((s, r) => s + Number(r.grabAmount || 0), 0);
  const transferTotal = summaryData.reduce((s, r) => s + Number(r.transferAmount || 0), 0);

  // inventory cost in summary range if opts provide inventoryRangeOutputs; else compute 0 for summary
  let inventoryCostInSummary = 0;
if (opts.dateRange && opts.dateRange.length === 2) {
  const [start, end] = opts.dateRange;
  inventoryCostInSummary = getInventoryExportTotalByDate(start, end);
} else {
  inventoryCostInSummary = getInventoryExportTotalByDate();
}


  // payrollTotal for summary (we keep the old behaviour: all payroll aggregated if not per-month)
  const payrollTotalAll = globalPayrollRaw.reduce((s,p) => s + Number(p.totalSalary || p.salary || p.amount || 0), 0);

  // If filtered by dateRange and payroll entries include dates/month info, try to compute payroll only for that range:
  let payrollInSummary = payrollTotalAll;
  if (opts.dateRange) {
    const [start, end] = opts.dateRange;
    // try to pick payroll entries that have 'date' or 'monthKey'
    const payrollRange = globalPayrollRaw.filter(p => {
      if (p.date) {
        const d = new Date(p.date);
        return !isNaN(d.getTime()) && d >= start && d <= end;
      }
      // monthKey format "YYYY-MM" or p.month/p.year
      if (p.monthKey) {
        const [y,m] = p.monthKey.split("-").map(Number);
        if (!y || !m) return false;
        const d1 = new Date(y, m-1, 1), d2 = new Date(y, m-1, 31);
        return d2 >= start && d1 <= end;
      }
      return false;
    });
    if (payrollRange.length) payrollInSummary = payrollRange.reduce((s,p) => s + Number(p.totalSalary || p.salary || p.amount || 0), 0);
  }

  // cash actual and net profit
  const cashActual = revenueTotal - expenseTotal - payrollInSummary - grabTotal - transferTotal - inventoryCostInSummary;
  const netProfit = revenueTotal - expenseTotal - payrollInSummary;

  // ---------- build groupMap from summaryData (for chart grouping & quick group list) ----------
  const allExpenses = summaryData
    .map(r => ({ note: (r.expenseNote || r.note || "").trim(), amount: Number(r.expenseAmount || 0), raw: r }))
    .filter(e => e.amount > 0);

  const groupMap = {}; // groupKey -> total
  const groupCountMap = {}; // groupKey -> count
  allExpenses.forEach(e => {
    const key = normalizeExpenseNoteToKey(e.note);
    const target = manualCostGroups[key] || key;
    groupMap[target] = (groupMap[target] || 0) + e.amount;
    groupCountMap[target] = (groupCountMap[target] || 0) + 1;
  });

  // include payroll as a special group for visibility (use payrollInSummary)
  if (payrollInSummary > 0) {
    groupMap["lương_nv"] = (groupMap["lương_nv"] || 0) + payrollInSummary;
    groupCountMap["lương_nv"] = (groupCountMap["lương_nv"] || 0) + 1;
  }

  // include inventory cost in summary as "nguyên_liệu" group
  if (inventoryCostInSummary > 0) {
    groupMap["nguyen_lieu"] = (groupMap["nguyen_lieu"] || 0) + inventoryCostInSummary;
    groupCountMap["nguyen_lieu"] = (groupCountMap["nguyen_lieu"] || 0) + 1;
  }

  // store last computed group keys for modal
  lastComputedGroupMap = { ...groupMap };
  lastComputedGroupKeys = Object.keys(groupMap).sort((a,b) => groupMap[b] - groupMap[a]);

  // ---------- Render summary table ----------
  const summaryContainer = document.getElementById("report-summary-table");
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <table class="table-style">
        <tr><th>Tổng Doanh thu</th><td>${formatVND(revenueTotal)}</td></tr>
        <tr><th>Tổng Chi phí (ghi sổ)</th><td>${formatVND(expenseTotal)}</td></tr>
        <tr><th>Tổng Lương NV</th><td>${formatVND(payrollInSummary)}</td></tr>
        <tr><th>Tổng Nguyên liệu (xuất kho)</th><td>${formatVND(inventoryCostInSummary)}</td></tr>
        <tr><th>Tổng Grab</th><td>${formatVND(grabTotal)}</td></tr>
        <tr><th>Tổng CK</th><td>${formatVND(transferTotal)}</td></tr>
        <tr><th><b>Tiền mặt thực tế</b></th><td><b>${formatVND(cashActual)}</b></td></tr>
        <tr><th><b>Lợi nhuận</b></th><td><b>${formatVND(netProfit)}</b></td></tr>
      </table>
      <div style="margin-top:8px;">
        <button onclick="openAddMonthlyCostModal()" class="small-btn">＋ Thêm dòng chi phí tháng</button>
      </div>
    `;
  }

  // ---------- Monthly cost table: compute for current month and compare with average of all months ----------
  const now = new Date();
  const currMonth = now.getMonth();
  const currYear = now.getFullYear();

  // build monthly groups map (monthKey -> { groupKey -> total })
  const monthlyByKey = {}; // "YYYY-MM" => { groupKey: total }
  globalReportRaw.forEach(r => {
    const d = new Date(r.date || r.createdAt || r.timestamp || r.time || r.datetime);
    if (isNaN(d.getTime())) return;
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    monthlyByKey[mk] = monthlyByKey[mk] || {};
    if (Number(r.expenseAmount || 0) > 0) {
      const k = normalizeExpenseNoteToKey(r.expenseNote || r.note || "");
      const target = manualCostGroups[k] || k;
      monthlyByKey[mk][target] = (monthlyByKey[mk][target] || 0) + Number(r.expenseAmount || 0);
    }
  });

  // add payroll per month if payroll entries include monthKey or month/date
  globalPayrollRaw.forEach(p => {
    const monthKey =
      p.monthKey ||
      (p.month && p.year ? `${p.year}-${String(p.month).padStart(2,"0")}` : null) ||
      (p.date ? (() => { const d = new Date(p.date); return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })() : null);
    const val = Number(p.totalSalary || p.salary || p.amount || 0);
    if (!monthKey || !val) return;
    monthlyByKey[monthKey] = monthlyByKey[monthKey] || {};
    monthlyByKey[monthKey]["lương_nv"] = (monthlyByKey[monthKey]["lương_nv"] || 0) + val;
  });

  // include inventory outputs per month grouped as nguyen_lieu
  globalInventoryOutputs.forEach(m => {
    const d = new Date(m.date || m.timestamp || m.createdAt);
    if (isNaN(d.getTime())) return;
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const qty = Number(m.quantity || m.qty || 0);
    const unit = Number(m.unitPrice || m.unit_cost || m.price || 0);
    const cost = qty * unit;
    if (!cost) return;
    monthlyByKey[mk] = monthlyByKey[mk] || {};
    monthlyByKey[mk]["nguyen_lieu"] = (monthlyByKey[mk]["nguyen_lieu"] || 0) + cost;
  });

  // compute average per group across all months
  const groupSums = {}; // group -> { sum, monthsCount }
  Object.keys(monthlyByKey).forEach(mk => {
    const mobj = monthlyByKey[mk];
    Object.keys(mobj).forEach(gk => {
      groupSums[gk] = groupSums[gk] || { sum: 0, months: 0 };
      groupSums[gk].sum += mobj[gk];
    });
  });
  // monthsCount = number of distinct months present (we use month count across monthlyByKey)
  const monthsCount = Object.keys(monthlyByKey).length || 1;
  const groupAvg = {}; // group -> avg
  Object.keys(groupSums).forEach(gk => {
    groupAvg[gk] = groupSums[gk].sum / monthsCount;
  });

  // take current month data
  const currKey = `${currYear}-${String(currMonth+1).padStart(2,"0")}`;
  const thisMonthCost = monthlyByKey[currKey] || {};
  // ensure groups include ones in average too
  const allGroupsForTable = Array.from(new Set([ ...Object.keys(thisMonthCost), ...Object.keys(groupAvg) ]));

  // Build table rows
  const rowsHtml = allGroupsForTable
    .sort((a,b) => (thisMonthCost[b] || 0) - (thisMonthCost[a] || 0))
    .map(gk => {
      const cur = thisMonthCost[gk] || 0;
      const avg = groupAvg[gk] || 0;
      const diff = cur - avg;
      const diffPct = avg > 0 ? ( (diff/avg) * 100 ).toFixed(1) + "%" : "—";
      const displayName = humanizeGroupKey(gk);
      return `
      <tr>
        <td>${displayName}</td>
        <td>${formatVND(cur)}</td>
        <td>${formatVND(avg)}</td>
        <td style="color:${diff>0?'red':'green'}">${formatVND(diff)} (${diffPct})</td>
        <td><button class="small-btn" onclick="openGroupEditModal('${escapeJs(gk)}')">Gộp</button></td>
      </tr>`;
    }).join("");

  const monthlyContainer = document.getElementById("report-expense-detail");
  if (monthlyContainer) {
    monthlyContainer.innerHTML = `
      <h4>Chi phí tháng ${currMonth + 1}/${currYear}</h4>
      <table class="table-style">
        <thead><tr><th>Nhóm</th><th>Tháng này</th><th>Trung bình</th><th>Chênh lệch</th><th>Gộp</th></tr></thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <p><b>Tổng chi phí tháng:</b> ${formatVND(Object.values(thisMonthCost).reduce((a,b)=>a+b,0))}</p>
    `;
  }

  // ---------- Chart (summary) ----------
  const canvas = document.getElementById("chart-profit");
  if (canvas && canvas.getContext) {
    if (window.myReportChart) window.myReportChart.destroy();
    const ctx = canvas.getContext("2d");
    const labels = ["Doanh thu","Chi phí","Lương NV","Nguyên liệu","Grab","CK","Tiền mặt","Lợi nhuận"];
    const values = [
      revenueTotal,
      expenseTotal,
      payrollInSummary,
      inventoryCostInSummary,
      grabTotal,
      transferTotal,
      cashActual,
      netProfit
    ];
    window.myReportChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ["#4caf50","#f44336","#ff9800","#9c27b0","#9e9e9e","#3f51b5","#009688","#2196f3"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

// ---------- Daily expense table (applies date filter) ----------
function renderDailyExpenseTable(reportsFiltered = [], invFiltered = [], range = {}) {
  // container id: report-expense-daily
  const container = document.getElementById("report-expense-daily");
  if (!container) {
    // create simple container appended under report-expense-detail
    const parent = document.getElementById("report-expense-detail") || document.body;
    const div = document.createElement("div");
    div.id = "report-expense-daily";
    div.style.marginTop = "16px";
    parent.insertAdjacentElement("afterend", div);
  }

  const el = document.getElementById("report-expense-daily");
  // combine reports + inventory outputs into one list for display
  const rows = [];

  // reports
  (reportsFiltered || []).forEach(r => {
    const d = new Date(r.date || r.createdAt || r.timestamp || r.time || r.datetime);
    rows.push({
      date: isNaN(d.getTime()) ? null : d,
      type: "report",
      emp: r.employeeName || r.employee || r.createdBy || "Không xác định",
      note: r.expenseNote || r.note || "",
      amount: Number(r.expenseAmount || 0),
      id: r.id || r.key || r._id || null,
      raw: r
    });
  });

  // inventory outputs
  (invFiltered || []).forEach(m => {
    const d = new Date(m.date || m.timestamp || m.createdAt);
    const qty = Number(m.quantity || m.qty || 0);
    const unit = Number(m.unitPrice || m.unit_cost || m.price || 0);
    const cost = qty * unit;
    rows.push({
      date: isNaN(d.getTime()) ? null : d,
      type: "inv_out",
      emp: m.employeeName || m.addedBy || "Kho",
      note: m.itemName || m.itemId || "Xuất kho",
      amount: cost,
      id: m.id || m.key || null,
      raw: m
    });
  });

  // sort by date desc
  rows.sort((a,b) => {
    const ta = a.date ? a.date.getTime() : 0;
    const tb = b.date ? b.date.getTime() : 0;
    return tb - ta;
  });

  if (!rows.length) {
    el.innerHTML = "<p>Không có chi phí trong khoảng thời gian đã chọn.</p>";
    return;
  }

  el.innerHTML = `
    <h4>Chi phí theo ngày (bảng chi tiết)</h4>
    <table class="table-style">
      <thead>
        <tr><th>Ngày</th><th>Loại</th><th>Người/Phòng</th><th>Ghi chú</th><th>Số tiền</th><th>Hành động</th></tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const dstr = r.date ? r.date.toLocaleString("vi-VN") : "-";
          const type = r.type === "inv_out" ? "Xuất kho (NL)" : "Chi phí";
          return `<tr>
            <td>${dstr}</td>
            <td>${type}</td>
            <td>${escapeHtml(r.emp || "")}</td>
            <td>${escapeHtml(r.note || "")}</td>
            <td>${formatVND(r.amount)}</td>
            <td>
              <button class="small-btn" onclick='openGroupEditModalFromRow(${JSON.stringify(serializeForHandler(r))})'>Gộp</button>
              ${r.type === "report" ? `<button class="small-btn" onclick='editReportExpenseInline("${r.id}")'>Sửa</button>` : ""}
            </td>
          </tr>`; }).join("")}
      </tbody>
    </table>
  `;
}

// ---------- Helper: open group edit modal (choose group from existing or create new) ----------
function openGroupEditModal(groupKey) {
  // open modal and show radio options = lastComputedGroupKeys + special entries
  const modal = document.getElementById("group-edit-modal");
  if (!modal) return alert("Modal gộp nhóm chưa sẵn sàng.");

  const candidates = Array.from(new Set([...(lastComputedGroupKeys || []), "khác", "mua", "lương_nv", "nguyen_lieu"]));
  const radios = candidates.map(k => {
    const label = humanizeGroupKey(k);
    return `<label style="display:block;margin:6px;"><input type="radio" name="group-target" value="${escapeAttr(k)}"> ${escapeHtml(label)}</label>`;
  }).join("");

  modal.innerHTML = `
    <div style="max-width:520px;margin:60px auto;background:#fff;padding:16px;border-radius:6px;position:relative;">
      <h3>Gộp nhóm cho <em>${escapeHtml(groupKey)}</em></h3>
      <div style="max-height:260px;overflow:auto;border:1px solid #eee;padding:8px;margin-bottom:8px;">
        ${radios}
      </div>
      <div style="margin-bottom:8px;">
        <label>Hoặc tạo nhóm mới: <input id="group-new-input" placeholder="Tên nhóm mới"></label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="closeGroupModal()" class="small-btn">Hủy</button>
        <button onclick='saveGroupSelection("${escapeJs(groupKey)}")' class="small-btn primary-btn">Lưu</button>
      </div>
    </div>
  `;
  modal.style.display = "block";
}

// open modal for a specific row (we pass serialized row info)
function openGroupEditModalFromRow(rowSerialized) {
  // rowSerialized is an object we serialized in onclick; reconstruct string groupKey from its note
  const groupKey = normalizeExpenseNoteToKey(rowSerialized.note || "");
  openGroupEditModal(groupKey);
}

function closeGroupModal() {
  const modal = document.getElementById("group-edit-modal");
  if (modal) modal.style.display = "none";
}

function saveGroupSelection(groupKey) {
  const modal = document.getElementById("group-edit-modal");
  if (!modal) return;
  const selected = modal.querySelector('input[name="group-target"]:checked');
  const newNameInput = modal.querySelector("#group-new-input");
  let target = "";
  if (newNameInput && newNameInput.value.trim()) {
    target = newNameInput.value.trim().toLowerCase();
  } else if (selected) {
    target = selected.value;
  } else {
    alert("Vui lòng chọn nhóm hoặc nhập tên nhóm mới");
    return;
  }
  // store mapping manualCostGroups[originalKey] = target
  manualCostGroups[groupKey] = target;
  closeGroupModal();
  renderRevenueExpenseSection(globalReportRaw);
}

// ---------- Add monthly cost modal & save ----------
function openAddMonthlyCostModal() {
  // basic modal collect: date, note, amount
  const modalId = "add-monthly-cost-modal";
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.style.position = "fixed"; modal.style.left = 0; modal.style.top = 0; modal.style.width = "100%"; modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.45)"; modal.style.zIndex = 9999;
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="max-width:480px;margin:70px auto;background:#fff;padding:12px;border-radius:6px;">
      <h3>Thêm dòng chi phí tháng</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label>Ngày: <input id="manual-cost-date" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
        <label>Ghi chú: <input id="manual-cost-note" type="text" placeholder="Ví dụ: Sửa máy, mua phụ tùng,..."></label>
        <label>Số tiền (VND): <input id="manual-cost-amount" type="number" min="0" step="1000" placeholder="1000000"></label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
        <button onclick="closeAddMonthlyCostModal()" class="small-btn">Hủy</button>
        <button onclick="saveManualMonthlyCost()" class="small-btn primary-btn">Lưu</button>
      </div>
    </div>
  `;
  modal.style.display = "block";
}
function closeAddMonthlyCostModal() {
  const modal = document.getElementById("add-monthly-cost-modal");
  if (modal) modal.style.display = "none";
}
function saveManualMonthlyCost() {
  const date = (document.getElementById("manual-cost-date") || {}).value;
  const note = (document.getElementById("manual-cost-note") || {}).value || "Chi phí thủ công";
  const rawAmount = Number((document.getElementById("manual-cost-amount") || {}).value || 0);
  if (!date || !rawAmount || rawAmount <= 0) return alert("Nhập ngày và số tiền hợp lệ");
  // push to reports in firebase as an expense record
  const db = firebase.database();
  const entry = {
    date: new Date(date).toISOString(),
    expenseAmount: rawAmount,
    expenseNote: note,
    employeeName: (auth && auth.currentUser && auth.currentUser.displayName) ? auth.currentUser.displayName : "Manual",
    manualAdded: true,
    timestamp: Date.now()
  };
  db.ref("reports").push(entry)
    .then(() => {
      closeAddMonthlyCostModal();
      fetchAllReportData(); // reload
      showToastNotification("Đã thêm dòng chi phí tháng");
    })
    .catch(err => {
      alert("Lỗi khi lưu chi phí: " + err.message);
    });
}

// ---------- Helpers: compute inventory costs ----------
function computeInventoryCostsFromMovements(movements) {
  // movements: array of { itemId, itemName, quantity, unitPrice, date } - compute cost per itemName or itemId
  const map = {};
  (movements || []).forEach(m => {
    const qty = Number(m.quantity || m.qty || 0);
    const unit = Number(m.unitPrice || m.unit_cost || m.price || 0);
    const fallbackPrice = (globalInventoryRaw.find(i => i.id === m.itemId) || {}).price || 0;
    const cost = qty * (unit || fallbackPrice);
    const key = (m.itemName || m.itemId || "nguyen_lieu").toString().toLowerCase();
    map[key] = (map[key] || 0) + cost;
  });
  return map;
}

function computeInventoryCostsByMonth(monthIndex, year) {
  // returns map group->total for that month
  const map = {};
  (globalInventoryOutputs || []).forEach(m => {
    const d = new Date(m.date || m.timestamp || m.createdAt);
    if (isNaN(d.getTime())) return;
    if (d.getMonth() === monthIndex && d.getFullYear() === year) {
      const qty = Number(m.quantity || m.qty || 0);
      const unit = Number(m.unitPrice || m.unit_cost || m.price || 0);
      const fallbackPrice = (globalInventoryRaw.find(i => i.id === m.itemId) || {}).price || 0;
      const cost = qty * (unit || fallbackPrice);
      const key = (m.itemName || m.itemId || "nguyen_lieu").toString().toLowerCase();
      map[key] = (map[key] || 0) + cost;
    }
  });
  return map;
}

// ---------- Helpers: payroll per month ----------
function computePayrollForMonth(monthIndex, year) {
  // attempt flexible matching: payroll entries may have monthKey=YYYY-MM, or date, or month/year
  let total = 0;
  (globalPayrollRaw || []).forEach(p => {
    if (p.monthKey) {
      const [y,m] = p.monthKey.split("-").map(Number);
      if (y === year && m === monthIndex+1) total += Number(p.totalSalary || p.salary || p.amount || 0);
    } else if (p.month && p.year) {
      if (Number(p.month) === monthIndex+1 && Number(p.year) === year) total += Number(p.totalSalary || p.salary || p.amount || 0);
    } else if (p.date) {
      const d = new Date(p.date);
      if (!isNaN(d.getTime()) && d.getMonth() === monthIndex && d.getFullYear() === year) total += Number(p.totalSalary || p.salary || p.amount || 0);
    } else {
      // fallback: if no month info, we won't count (or optionally spread equally across months)
    }
  });
  return total;
}

// ---------- Utility helpers ----------
function normalizeExpenseNoteToKey(note) {
  if (!note) return "khác";
  const cleaned = note.toString().trim().toLowerCase();
  if (!cleaned) return "khác";
  const parts = cleaned.split(/\s+/);
  // if starts with 'mua' or 'mua hàng' -> use next token
  if (parts[0] === "mua") return parts[1] ? parts[1] : "mua";
  return parts[0];
}
function humanizeGroupKey(k) {
  if (!k) return "";
  if (k === "lương_nv" || k === "luong_nv") return "Lương NV";
  if (k === "nguyen_lieu" || k === "nguyên_liệu") return "Nguyên liệu";
  return k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function formatVND(v) { return (Number(v) || 0).toLocaleString("vi-VN") + " ₫"; }
function escapeHtml(s) { return (""+s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function escapeAttr(s) { return (""+s).replace(/"/g,'&quot;'); }
function escapeJs(s) { return (""+s).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"'); }
function serializeForHandler(obj) {
  // reduce object for safe inline-json in attributes (used in onclick)
  return {
    date: obj.date ? (obj.date instanceof Date ? obj.date.toISOString() : obj.date) : null,
    type: obj.type,
    emp: obj.emp,
    note: obj.note,
    amount: obj.amount,
    id: obj.id
  };
}

// Inline small editor for existing report expense (basic)
function editReportExpenseInline(reportId) {
  if (!reportId) return alert("Không xác định ID báo cáo");
  const r = globalReportRaw.find(x => (x.id || x.key) === reportId);
  if (!r) return alert("Báo cáo không tồn tại");
  const note = prompt("Ghi chú chi phí:", r.expenseNote || r.note || "");
  if (note === null) return;
  const val = prompt("Số tiền (VND):", r.expenseAmount || 0);
  if (val === null) return;
  const amount = Number(val || 0);
  if (isNaN(amount) || amount < 0) return alert("Số tiền không hợp lệ");
  const updates = {
    expenseNote: note,
    expenseAmount: amount,
    timestamp: Date.now()
  };
  firebase.database().ref("reports/" + reportId).update(updates)
    .then(() => {
      showToastNotification("Cập nhật chi phí thành công");
      fetchAllReportData();
    })
    .catch(err => alert("Lỗi khi cập nhật: " + err.message));
}

// ---------- Misc render boot ----------
function renderInventorySection() {
  const el = document.getElementById("report-inventory");
  if (!el) return;
  el.innerHTML = `
    <table class="table-style">
      <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Giá</th><th>Ngưỡng tồn</th></tr></thead>
      <tbody>
        ${(globalInventoryRaw || []).map(i => `<tr><td>${escapeHtml(i.name||i.itemName||i.id)}</td><td>${i.quantity||0}</td><td>${formatVND(i.price||i.unitPrice||0)}</td><td>${i.lowStockThreshold||0}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}






// ---------- High level render entry ----------
function renderAllReportSections() {
  // default summary uses all data
  renderRevenueExpenseSection(globalReportRaw);
  renderInventorySection();
renderReportPayrollTable(start, end);
  renderInventoryExportReport();
renderLowStockWarning();
// hide daily table until filter applied
  const dailyEl = document.getElementById("report-expense-daily");
  if (dailyEl) dailyEl.innerHTML = "<p>Áp dụng bộ lọc ngày để xem bảng chi phí theo ngày.</p>";
}

// ---------- Extra suggestions (returned to user) ----------
/*
Gợi ý cải tiến UX / Data:
1. Lưu lịch sử thay đổi gộp thủ công (audit log) để rollback khi gộp nhầm.
2. Thêm cờ 'expenseType' cho mỗi báo cáo (vd: 'general','material','salary') để dễ group hơn.
3. Nếu hệ thống có nhiều xuất kho -> chuẩn hóa movements với fields: itemId,itemName,quantity,unitPrice,date,employee.
4. Export CSV / Excel cho các bảng (daily/monthly) để kế toán dùng.
5. Thêm cơ chế phê duyệt cho dòng chi phí thêm thủ công (approval workflow).
6. Highlight tự động các nhóm có tăng > X% so với trung bình.
*/

function renderInventoryExportReport(start, end) {
  const grouped = {};
  let total = 0;

  globalReportRaw.forEach(r => {
    const d = new Date(r.date);
    if (start && end && (d < start || d > end)) return;
    if (!r.products || !r.products.length) return;

    r.products.forEach(prod => {
      const id = prod.productId;
      const qty = prod.quantity || 0;
      const invItem = globalInventoryRaw.find(inv => inv.id === id);
      const price = invItem ? (invItem.price || 0) : 0;

      const amount = qty * price;
      total += amount;

      if (!grouped[id]) {
        grouped[id] = { name: prod.name.trim(), qty: 0, price: price };
      }
      grouped[id].qty += qty;
    });
  });

  let rows = Object.values(grouped).map(item => {
    const amount = item.qty * item.price;
    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${item.price.toLocaleString()} ₫</td>
        <td>${amount.toLocaleString()} ₫</td>
      </tr>
    `;
  }).join("");

  document.getElementById("report-inventory-export").innerHTML = `
    <div class="card-title">Xuất kho nguyên liệu</div>
    <div class="table-responsive">
      <table class="table-style">
        <thead>
          <tr><th>Tên hàng hóa</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><th colspan="3">Tổng cộng</th><th>${total.toLocaleString()} ₫</th></tr>
        </tfoot>
      </table>
    </div>
  `;
}



// Hàm tính tổng nguyên liệu xuất kho theo ngày (dùng chung cho summary + bảng chi tiết)
function getInventoryExportTotalByDate(startDate, endDate) {
  let total = 0;

  (globalReportRaw || []).forEach(r => {
    const d = new Date(r.date || r.createdAt || r.timestamp || r.time || r.datetime);
    if (isNaN(d.getTime())) return;
    if (startDate && endDate && (d < startDate || d > endDate)) return;

    if (!r.products || !r.products.length) return;

    r.products.forEach(prod => {
      const qty = Number(prod.quantity || prod.qty || 0);
      if (!qty) return;

      // Lấy giá từ inventory hoặc fallback giá trong product
      const invItem = (globalInventoryRaw || []).find(inv => inv.id === (prod.productId || prod.id));
      const price = invItem ? Number(invItem.price || 0) : Number(prod.unitPrice || prod.price || 0) || 0;

      total += qty * price;
    });
  });

  return total;
}


function renderLowStockWarning() {
  const lowStock = globalInventoryRaw.filter(item => {
    return (item.quantity || 0) <= (item.lowStockThreshold || 0);
  });

  if (!lowStock.length) {
    document.getElementById("low-stock-warning").innerHTML = `
      <p class="muted">Không có mặt hàng nào dưới ngưỡng tồn kho</p>
    `;
    return;
  }

  const rows = lowStock.map(item => `
    <tr style="color:red;">
      <td>⚠ ${item.name}</td>
      <td>${item.quantity}</td>
    </tr>
  `).join("");

  document.getElementById("low-stock-warning").innerHTML = `
    <div class="card-title">Cảnh báo tồn kho thấp</div>
    <div class="table-responsive">
      <table class="table-style">
        <thead>
          <tr><th>Tên hàng</th><th>Số lượng còn</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
// bảng lương nv
function loadPayrollReportData(callback) {
  let promises = [];

  // Tải payrolls_daily
  promises.push(
    firebase.database().ref("payrolls_daily").once("value").then(snap => {
      globalPayrollsDaily = snap.val() || {};
    })
  );

  // Tải tạm ứng
  promises.push(
    firebase.database().ref("advances").once("value").then(snap => {
      let data = snap.val() || {};
      globalAdvanceRequests = Object.values(data);
    })
  );

  // Tải lịch làm việc (nếu chưa có)
  if (!globalScheduleData || !globalScheduleData.length) {
    promises.push(
      firebase.database().ref("schedules").once("value").then(snap => {
        globalScheduleData = Object.values(snap.val() || {});
      })
    );
  }

  Promise.all(promises).then(() => {
    if (typeof callback === "function") callback();
  });
}


// ---------- Helper: tính lương 1 nhân viên trong khoảng ngày ----------
function computeEmployeePayrollInRange(employee, startDate, endDate) {
  if (!employee) return { totalSalary: 0, bonusTotal: 0, penaltyTotal: 0, advanceTotal: 0, net: 0 };

  const empId = employee.id;
  // lấy cài đặt nếu có (globalEmployeeSettings có thể đến từ profile.js)
  const settings = (typeof globalEmployeeSettings !== 'undefined' && globalEmployeeSettings[empId]) ? globalEmployeeSettings[empId] : {};
  const wage = Number(settings.wagePerHour || employee.wagePerHour || employee.defaultWagePerHour || 20000);
  const hours = Number(settings.hoursPerDay || employee.hoursPerDay || employee.defaultHoursPerDay || 8);
  const defaultOtHours = Number(settings.overtimeHours || 2);

  const payrollsDailyForEmp = (typeof globalPayrollsDaily !== 'undefined' && globalPayrollsDaily[empId]) ? globalPayrollsDaily[empId] : {};
  const schedules = globalScheduleData || [];
  const advances = globalAdvanceRequests || [];

  let totalSalary = 0, bonusTotal = 0, penaltyTotal = 0, advanceTotal = 0;

  // clone start/end để không mutate nguyên gốc
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0,10);

    const schedule = schedules.find(s =>
      s.employeeId === empId &&
      s.date === dateStr &&
      s.approvalStatus === "approved"
    );

    let baseSalary = 0;
    let overtimePay = 0;

    if (schedule) {
      if (schedule.status === "off") {
        baseSalary = 0;
      } else if (schedule.status === "overtime" || Number(schedule.overtimeHours) > 0) {
        baseSalary = wage * hours;
        const otHours = Number(schedule.overtimeHours) || defaultOtHours;
        overtimePay = wage * otHours;
      } else {
        baseSalary = wage * hours;
      }
    } else {
      // không có record lịch → coi như làm bình thường
      baseSalary = wage * hours;
    }

    // Bonus / Penalty trong globalPayrollsDaily (hệ thống có thể lưu object hoặc array)
    const dailyRecord = payrollsDailyForEmp[dateStr] || {};
    let bonus = 0, penalty = 0;
    if (Array.isArray(dailyRecord)) {
      dailyRecord.forEach(it => { bonus += Number(it.bonus||0); penalty += Number(it.penalty||0); });
    } else if (typeof dailyRecord === 'object') {
      bonus = Number(dailyRecord.bonus || 0);
      penalty = Number(dailyRecord.penalty || 0);
    }

    // Tạm ứng đã duyệt (approved/done)
    const adv = advances.filter(a =>
      a.employeeId === empId &&
      a.date === dateStr &&
      (a.status === "approved" || a.status === "done")
    );
    const advSum = adv.reduce((s,a) => s + Number(a.amount||0), 0);

    const dailyTotal = baseSalary + overtimePay + bonus - penalty - advSum;

    totalSalary += dailyTotal;
    bonusTotal += bonus;
    penaltyTotal += penalty;
    advanceTotal += advSum;
  }

  return { totalSalary, bonusTotal, penaltyTotal, advanceTotal, net: totalSalary };
}

function renderReportPayrollTable(startDate, endDate) {
  const el = document.getElementById("report-payroll");
  if (!el) return;

  // Lấy ngày từ bộ lọc nếu không truyền tham số
  if (!startDate || !endDate) {
    const raw = (document.getElementById("report-filter-range") || {}).value || "";
    if (!raw) {
      el.innerHTML = "<p style='color:#b00;'>Vui lòng chọn khoảng ngày để xem báo cáo lương</p>";
      return;
    }
    const parts = raw.split(/\s+to\s+|\s*-\s*/i).map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) { startDate = parts[0]; endDate = parts[0]; }
    else { startDate = parts[0]; endDate = parts[1]; }
  }

  // Chuẩn hóa Date
  startDate = new Date(startDate);
  endDate = new Date(endDate);
  if (isNaN(startDate) || isNaN(endDate) || endDate < startDate) {
    el.innerHTML = "<p style='color:#b00;'>Khoảng ngày không hợp lệ</p>";
    return;
  }
  startDate.setHours(0,0,0,0);
  endDate.setHours(23,59,59,999);

  let tableRows = "";
  let grandTotal = { base:0, ot:0, bonus:0, penalty:0, advance:0, net:0 };

  (globalEmployeeData || []).forEach(emp => {
    const settings = (typeof globalEmployeeSettings !== "undefined" && globalEmployeeSettings[emp.id]) ? globalEmployeeSettings[emp.id] : {};
    const wage = Number(settings.wagePerHour || emp.wagePerHour || 16000);
    const hours = Number(settings.hoursPerDay || emp.hoursPerDay || 5);
    const defaultOtHours = Number(settings.overtimeHours || 2);

    let baseTotal = 0, otTotal = 0, bonusTotal = 0, penaltyTotal = 0, advanceTotal = 0, netTotal = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0,10);

      // Lịch làm việc
      const schedule = (globalScheduleData || []).find(s =>
        s.employeeId === emp.id &&
        s.date === dateStr &&
        s.approvalStatus === "approved"
      );

      let baseSalary = 0, overtimePay = 0;
      if (schedule) {
        if (schedule.status === "off") {
          baseSalary = 0;
        } else if (schedule.status === "overtime" || Number(schedule.overtimeHours) > 0) {
          baseSalary = wage * hours;
          overtimePay = wage * (Number(schedule.overtimeHours) || defaultOtHours);
        } else {
          baseSalary = wage * hours;
        }
      } else {
        baseSalary = wage * hours;
      }

      // Thưởng / Phạt từ payrolls_daily
      const dailyRecord = ((globalPayrollsDaily || {})[emp.id] || {})[dateStr] || {};
      let bonus = Number(dailyRecord.bonus || 0);
      let penalty = Number(dailyRecord.penalty || 0);

      // Tạm ứng từ advances
      const adv = (globalAdvanceRequests || []).filter(a =>
        a.employeeId === emp.id &&
        a.date === dateStr &&
        (a.status === "approved" || a.status === "done")
      ).reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const totalDay = baseSalary + overtimePay + bonus - penalty - adv;

      baseTotal += baseSalary;
      otTotal += overtimePay;
      bonusTotal += bonus;
      penaltyTotal += penalty;
      advanceTotal += adv;
      netTotal += totalDay;
    }

    // Cộng vào tổng chung
    grandTotal.base += baseTotal;
    grandTotal.ot += otTotal;
    grandTotal.bonus += bonusTotal;
    grandTotal.penalty += penaltyTotal;
    grandTotal.advance += advanceTotal;
    grandTotal.net += netTotal;

    // Thêm dòng nhân viên
    tableRows += `
      <tr>
        <td>${emp.name}</td>
        <td style="text-align:right;">${formatVND(baseTotal)}</td>
        <td style="text-align:right;">${formatVND(otTotal)}</td>
        <td style="text-align:right;">${formatVND(bonusTotal)}</td>
        <td style="text-align:right;">${formatVND(penaltyTotal)}</td>
        <td style="text-align:right;">${formatVND(advanceTotal)}</td>
        <td style="text-align:right;color:green;"><strong>${formatVND(netTotal)}</strong></td>
      </tr>
    `;
  });

  // Render bảng
  el.innerHTML = `
    <div class="card-title">Bảng lương ngày (${startDate.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')})</div>
    <div class="table-responsive">
      <table class="table-style">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th style="text-align:right;">Lương cơ bản</th>
            <th style="text-align:right;">OT</th>
            <th style="text-align:right;">Thưởng</th>
            <th style="text-align:right;">Phạt</th>
            <th style="text-align:right;">Tạm ứng</th>
            <th style="text-align:right;">Thực nhận</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <th>Tổng</th>
            <th style="text-align:right;">${formatVND(grandTotal.base)}</th>
            <th style="text-align:right;">${formatVND(grandTotal.ot)}</th>
            <th style="text-align:right;">${formatVND(grandTotal.bonus)}</th>
            <th style="text-align:right;">${formatVND(grandTotal.penalty)}</th>
            <th style="text-align:right;">${formatVND(grandTotal.advance)}</th>
            <th style="text-align:right;color:green;">${formatVND(grandTotal.net)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
