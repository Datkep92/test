/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/

// ===================== //
// Firebase References   //
// ===================== //
const inventoryRef = db.ref("inventory");
const reportsRef = db.ref("reports");
const employeesRef = db.ref("employees");
const advancesRef = db.ref("advances");
const messagesRef = db.ref("messages");

// ===================== //
// Biến cục bộ           //
// ===================== //
let inventoryData = [];
let reportData = [];
let employeeData = [];
let advanceRequests = [];
let messages = { group: [], manager: [] };
let selectedProductId = null;
let currentEmployeeId = null;

/**********************
 * 1. Đăng nhập / Đăng xuất
 **********************/
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Vui lòng nhập đầy đủ thông tin!");

  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      openTabBubble('revenue-expense'); // Mở tab mặc định
      loadFirebaseData();
    })
    .catch(err => alert("Lỗi đăng nhập: " + err.message));
}

function logout() {
  auth.signOut().then(() => {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  });
}

/**********************
 * 2. Floating Button Tabs
 **********************/
function toggleMenu() {
  const options = document.getElementById('float-options');
  options.style.display = (options.style.display === 'flex') ? 'none' : 'flex';
}

function openTabBubble(tabId) {
  const tabs = document.querySelectorAll('.tabcontent');
  tabs.forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');

  toggleMenu(); // tự động đóng menu
  if (tabId === "profile") {
    renderAdvanceHistory();
    renderSalarySummary();
  } else if (tabId === "employee-management") {
    renderEmployeeList();
    renderAdvanceApprovalList();
  } else if (tabId === "business-report") {
    renderExpenseSummary();
    generateBusinessChart();
  }
}

/**********************
 * 3. Quản lý kho (CRUD)
 **********************/
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  if (!name || quantity <= 0 || price <= 0) {
    alert("Nhập đúng thông tin sản phẩm!");
    return;
  }

  inventoryRef.push({ name, quantity, price })
    .then(() => {
      alert("Đã thêm sản phẩm!");

      // Xóa nội dung nhập
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";

      // Hiển thị tab Kho để người dùng thấy sản phẩm mới
      openTabBubble('inventory');
    })
    .catch(err => {
      console.error("Lỗi khi thêm sản phẩm:", err);
      alert("Không thể thêm sản phẩm. Kiểm tra kết nối hoặc quyền Firebase.");
    });
}


function editInventory(id) {
  const product = inventoryData.find(p => p.id === id);
  if (!product) return;
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Đơn giá:", product.price)) || product.price;
  inventoryRef.child(id).update({ name: newName, quantity: newQty, price: newPrice });
}

function deleteInventory(id) {
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef.child(id).remove();
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  if (!list) return;
  list.innerHTML = "";

  if (inventoryData.length === 0) {
    list.innerHTML = "<p>Kho trống.</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Tên SP</th><th>Số lượng</th><th>Đơn giá</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price}</td>
          <td>
            <button onclick="editInventory('${item.id}')">Sửa</button>
            <button onclick="deleteInventory('${item.id}')">Xóa</button>
          </td>
        </tr>`).join("")}
    </tbody>`;
  list.appendChild(table);
}

/**********************
 * 4. Báo cáo Thu Chi
 **********************/
function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) return;
  container.innerHTML = "";

  if (inventoryData.length === 0) {
    container.innerHTML = "<p>Kho trống, không có sản phẩm để xuất.</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Chọn</th><th>Tên SP</th><th>Số lượng</th><th>Đơn giá</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => `
        <tr>
          <td><input type="radio" name="select-product" onclick="selectedProductId='${item.id}'"></td>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price}</td>
        </tr>`).join("")}
    </tbody>`;
  container.appendChild(table);
}

function submitReport() {
  if (!selectedProductId) return alert("Chọn sản phẩm để xuất!");
  const product = inventoryData.find(p => p.id === selectedProductId);
  if (!product) return alert("Sản phẩm không tồn tại!");

  const qty = parseInt(document.getElementById("report-quantity").value) || 0;
  if (qty <= 0 || qty > product.quantity) return alert("Số lượng không hợp lệ!");

  const revenue = parseFloat(document.getElementById("revenue").value) || 0;
  const expenseAmount = parseFloat(document.getElementById("expense-amount").value) || 0;
  const expenseInfo = document.getElementById("expense-info").value.trim();

  inventoryRef.child(product.id).update({ quantity: product.quantity - qty });
  reportsRef.push({
    date: new Date().toISOString().split("T")[0],
    product: product.name,
    quantity: qty,
    revenue,
    expenseAmount,
    expenseInfo
  }).then(() => alert("Báo cáo thành công!"));
}

function renderReports() {
  const container = document.getElementById("shared-report-table");
  if (!container) return;
  container.innerHTML = "";

  if (reportData.length === 0) {
    container.innerHTML = "<p>Chưa có báo cáo nào.</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Ngày</th><th>Sản phẩm</th><th>SL</th><th>Doanh thu</th><th>Chi phí</th><th>Ghi chú</th></tr>
    </thead>
    <tbody>
      ${reportData.map(r => `
        <tr>
          <td>${r.date}</td>
          <td>${r.product}</td>
          <td>${r.quantity}</td>
          <td>${r.revenue}</td>
          <td>${r.expenseAmount}</td>
          <td>${r.expenseInfo}</td>
        </tr>`).join("")}
    </tbody>`;
  container.appendChild(table);
}

/**********************
 * 5. Quản lý Nhân viên
 **********************/
function addEmployee() {
  const name = document.getElementById("employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  if (!name || dailyWage <= 0) return alert("Nhập thông tin nhân viên hợp lệ!");

  employeesRef.push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0 })
    .then(() => alert("Đã thêm nhân viên!"));
}

function renderEmployeeList() {
  const list = document.getElementById("employee-list");
  if (!list) return;
  list.innerHTML = "";

  if (employeeData.length === 0) {
    list.innerHTML = "<p>Chưa có nhân viên.</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Tên NV</th><th>Lương/ngày</th><th>Phụ cấp</th><th>Phí khác</th></tr>
    </thead>
    <tbody>
      ${employeeData.map(emp => `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.dailyWage}</td>
          <td>${emp.allowance}</td>
          <td>${emp.otherFee}</td>
        </tr>`).join("")}
    </tbody>`;
  list.appendChild(table);
}

/**********************
 * 6. Tạm ứng
 **********************/
function requestAdvance() {
  const amount = parseFloat(document.getElementById("advance-amount").value) || 0;
  const reason = document.getElementById("advance-reason").value.trim();

  if (amount <= 0 || !reason) return alert("Vui lòng nhập số tiền và lý do!");

  advancesRef.push({
    employeeId: currentEmployeeId,
    amount,
    reason,
    status: "pending"
  }).then(() => alert("Đã gửi yêu cầu tạm ứng!"));
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) return;
  container.innerHTML = "";

  const myAdvances = advanceRequests.filter(a => a.employeeId === currentEmployeeId);

  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    return;
  }

  myAdvances.forEach(a => {
    const div = document.createElement("div");
    div.innerHTML = `Tạm ứng: ${a.amount} VND - ${a.reason} - Trạng thái: ${a.status}`;
    container.appendChild(div);
  });
}

function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) return;
  container.innerHTML = "";

  const pending = advanceRequests.filter(a => a.status === "pending");

  if (pending.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu nào.</p>";
    return;
  }

  pending.forEach(a => {
    const emp = employeeData.find(e => e.id === a.employeeId) || { name: "Nhân viên" };
    const div = document.createElement("div");
    div.innerHTML = `
      ${emp.name}: ${a.amount} - ${a.reason}
      <button onclick="approveAdvance('${a.id}')">Duyệt</button>
      <button onclick="rejectAdvance('${a.id}')">Từ chối</button>`;
    container.appendChild(div);
  });
}

function approveAdvance(id) {
  advancesRef.child(id).update({ status: "approved" });
}

function rejectAdvance(id) {
  advancesRef.child(id).update({ status: "rejected" });
}

/**********************
 * 7. Lương & Ngày công
 **********************/
function calculateSalary(empId) {
  const emp = employeeData.find(e => e.id === empId);
  if (!emp) return 0;
  const totalAdvance = advanceRequests.filter(a => a.employeeId === empId && a.status === "approved")
    .reduce((sum, a) => sum + a.amount, 0);
  return (emp.workdays - emp.offdays) * emp.dailyWage + emp.allowance - emp.otherFee - totalAdvance;
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) return;
  const emp = employeeData.find(e => e.id === currentEmployeeId);
  if (!emp) {
    container.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
    return;
  }
  const salary = calculateSalary(emp.id);
  container.innerHTML = `
    <p>Ngày công: ${emp.workdays}</p>
    <p>Ngày nghỉ: ${emp.offdays}</p>
    <p>Lương/ngày: ${emp.dailyWage}</p>
    <p>Phụ cấp: ${emp.allowance}</p>
    <p>Phí khác: ${emp.otherFee}</p>
    <p><strong>Tổng lương: ${salary} VND</strong></p>`;
}

/**********************
 * 8. Chat
 **********************/
function sendGroupMessage() {
  const msg = document.getElementById("group-message").value.trim();
  if (!msg) return;
  messagesRef.child("group").push({ text: msg, time: new Date().toISOString() });
  document.getElementById("group-message").value = "";
}

function sendManagerMessage() {
  const msg = document.getElementById("manager-message").value.trim();
  if (!msg) return;
  messagesRef.child("manager").push({ text: msg, time: new Date().toISOString() });
  document.getElementById("manager-message").value = "";
}

function renderChat(type) {
  const box = document.getElementById(type + "-chat");
  if (!box) return;
  box.innerHTML = "";
  messages[type].forEach(m => {
    const div = document.createElement("div");
    div.classList.add("chat-message");
    div.textContent = `[${new Date(m.time).toLocaleTimeString()}] ${m.text}`;
    box.appendChild(div);
  });
}

/**********************
 * 9. Báo cáo kinh doanh
 **********************/
function renderExpenseSummary() {
  const container = document.getElementById("expense-summary-table");
  if (!container) return;
  container.innerHTML = "";
  reportData.filter(r => r.expenseAmount > 0).forEach(r => {
    const row = document.createElement("div");
    row.innerHTML = `${r.date} - ${r.product} - Chi phí: ${r.expenseAmount} - ${r.expenseInfo}`;
    container.appendChild(row);
  });
}

function generateBusinessChart() {
  const ctx = document.getElementById("growth-chart");
  if (!ctx) return;
  const labels = [...new Set(reportData.map(r => r.date))];
  const revenueData = labels.map(d => reportData.filter(r => r.date === d)
    .reduce((sum, r) => sum + r.revenue, 0));
  const expenseData = labels.map(d => reportData.filter(r => r.date === d)
    .reduce((sum, r) => sum + r.expenseAmount, 0));
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Doanh thu", data: revenueData, backgroundColor: "green" },
        { label: "Chi phí", data: expenseData, backgroundColor: "red" }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: "top" } } }
  });
}

/**********************
 * 10. Khởi tạo Firebase listeners
 **********************/
function loadFirebaseData() {
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    snapshot.forEach(child => inventoryData.push({ id: child.key, ...child.val() }));
    renderInventory();
    renderReportProductList();
  });

  reportsRef.on("value", snapshot => {
    reportData = [];
    snapshot.forEach(child => reportData.push({ id: child.key, ...child.val() }));
    renderReports();
    renderExpenseSummary();
  });

  employeesRef.on("value", snapshot => {
    employeeData = [];
    snapshot.forEach(child => employeeData.push({ id: child.key, ...child.val() }));
    renderEmployeeList();
    renderSalarySummary();
  });

  advancesRef.on("value", snapshot => {
    advanceRequests = [];
    snapshot.forEach(child => advanceRequests.push({ id: child.key, ...child.val() }));
    renderAdvanceHistory();
    renderAdvanceApprovalList();
  });

  messagesRef.child("group").on("value", snapshot => {
    messages.group = [];
    snapshot.forEach(child => messages.group.push(child.val()));
    renderChat("group");
  });
  messagesRef.child("manager").on("value", snapshot => {
    messages.manager = [];
    snapshot.forEach(child => messages.manager.push(child.val()));
    renderChat("manager");
  });
}
//
auth.onAuthStateChanged(user => {
  if (user) {
    currentEmployeeId = user.uid;
    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('revenue-expense'); // mở tab mặc định
    loadFirebaseData();
  } else {
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});
