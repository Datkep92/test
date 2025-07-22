/*********************************************
 * app.js - Milano 259 (Firebase)
 * Quản lý Kho, Báo cáo, Nhân sự, Tạm ứng, Chat
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
let currentEmployeeId = null;
let selectedProductId = null;

// ===================== //
// 1. Đăng nhập          //
// ===================== //
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Vui lòng nhập thông tin đăng nhập!");

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      currentEmployeeId = userCredential.user.uid;
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      const firstTab = document.querySelector(".bottom-nav button.tablinks");
      if (firstTab) firstTab.click();
      loadDataFromFirebase();
    })
    .catch(err => alert("Đăng nhập thất bại: " + err.message));
}

function logout() {
  auth.signOut().then(() => {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  });
}

// ===================== //
// 2. Tabs               //
// ===================== //
function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
  const tablinks = document.querySelectorAll(".tablinks");
  tablinks.forEach(btn => btn.classList.remove("active"));
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.classList.add("active");

  if (tabName === "profile") {
    renderAdvanceHistory();
    renderSalarySummary();
    renderEmployeeCalendar();
  } else if (tabName === "employee-management") {
    renderAdvanceApprovalList();
    renderEmployeeList();
  } else if (tabName === "business-report") {
    renderExpenseSummary();
    generateBusinessChart();
  }
}

// ===================== //
// 3. Kho (Firebase)     //
// ===================== //
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;
  if (!name || quantity <= 0 || price <= 0) return alert("Vui lòng nhập đúng thông tin sản phẩm!");

  inventoryRef.push({ name, quantity, price }).then(() => {
    alert("Thêm sản phẩm thành công!");
  });
}

function editInventory(id) {
  const product = inventoryData.find(p => p.id === id);
  if (!product) return;
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng mới:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Giá mới:", product.price)) || product.price;
  inventoryRef.child(id).set({ name: newName, quantity: newQty, price: newPrice });
}

function deleteInventory(id) {
  inventoryRef.child(id).remove().then(() => alert("Đã xóa sản phẩm!"));
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  if (!list) return;
  list.innerHTML = "";
  inventoryData.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("inventory-item");
    div.innerHTML = `${item.name} - SL: ${item.quantity} - Giá: ${item.price} 
      <button onclick="editInventory('${item.id}')">Sửa</button>
      <button onclick="deleteInventory('${item.id}')">Xóa</button>`;
    list.appendChild(div);
  });
  renderReportProductList();
}

// ===================== //
// 4. Báo cáo (Firebase) //
// ===================== //
function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) return;
  container.innerHTML = "";
  inventoryData.forEach(item => {
    const btn = document.createElement("button");
    btn.textContent = `${item.name} (SL: ${item.quantity})`;
    btn.onclick = () => { selectedProductId = item.id; alert(`Đang chọn: ${item.name}`); };
    container.appendChild(btn);
  });
}

function submitReport() {
  if (!selectedProductId) return alert("Vui lòng chọn sản phẩm để xuất!");
  const product = inventoryData.find(p => p.id === selectedProductId);
  if (!product) return;

  const reportQuantity = parseInt(document.getElementById("report-quantity").value) || 0;
  if (reportQuantity <= 0 || reportQuantity > product.quantity) return alert("Số lượng xuất không hợp lệ!");

  const revenue = parseFloat(document.getElementById("revenue").value) || 0;
  const expenseAmount = parseFloat(document.getElementById("expense-amount").value) || 0;
  const expenseInfo = document.getElementById("expense-info").value.trim();

  // Update tồn kho
  inventoryRef.child(product.id).update({ quantity: product.quantity - reportQuantity });

  // Gửi báo cáo
  reportsRef.push({
    date: new Date().toISOString().split("T")[0],
    product: product.name,
    quantity: reportQuantity,
    revenue,
    expenseAmount,
    expenseInfo
  }).then(() => alert("Báo cáo thành công!"));
}

function renderReports() {
  const container = document.getElementById("shared-report-table");
  if (!container) return;
  container.innerHTML = "";
  reportData.forEach(r => {
    const row = document.createElement("div");
    row.innerHTML = `Ngày: ${r.date} - SP: ${r.product} - SL: ${r.quantity} - DT: ${r.revenue} - CP: ${r.expenseAmount} - ${r.expenseInfo}`;
    container.appendChild(row);
  });
}

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

// ===================== //
// 5. Tạm ứng (Firebase) //
// ===================== //
function requestAdvance() {
  const amount = parseFloat(document.getElementById("advance-amount").value) || 0;
  const reason = document.getElementById("advance-reason").value.trim();
  if (amount <= 0 || !reason) return alert("Vui lòng nhập số tiền và lý do tạm ứng!");

  advancesRef.push({
    employeeId: currentEmployeeId,
    amount,
    reason,
    status: "pending"
  }).then(() => alert("Yêu cầu tạm ứng đã gửi!"));
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) return;
  container.innerHTML = "";
  advanceRequests.filter(a => a.employeeId === currentEmployeeId)
    .forEach(a => {
      const div = document.createElement("div");
      div.innerHTML = `${a.amount} VND - ${a.reason} - Trạng thái: ${a.status}`;
      container.appendChild(div);
    });
}

function renderAdvanceApprovalList() {
  const container = document.getElementById("advance-approval-list");
  if (!container) return;
  container.innerHTML = "";
  advanceRequests.filter(a => a.status === "pending")
    .forEach(a => {
      const emp = employeeData.find(e => e.id === a.employeeId) || { name: "Nhân viên" };
      const div = document.createElement("div");
      div.innerHTML = `${emp.name}: ${a.amount} - ${a.reason}
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

// ===================== //
// 6. Nhân viên & Lương  //
// ===================== //
function addEmployee() {
  const name = document.getElementById("employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;
  if (!name || dailyWage <= 0) return alert("Nhập đúng thông tin nhân viên!");

  employeesRef.push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0 })
    .then(() => alert("Thêm nhân viên thành công!"));
}

function renderEmployeeList() {
  const list = document.getElementById("employee-list");
  if (!list) return;
  list.innerHTML = "";
  employeeData.forEach(emp => {
    const div = document.createElement("div");
    div.innerHTML = `${emp.name} - Lương ngày: ${emp.dailyWage} - Phụ cấp: ${emp.allowance} - Phí khác: ${emp.otherFee}`;
    list.appendChild(div);
  });
}

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
    <p>Lương ngày công: ${emp.dailyWage}</p>
    <p>Phụ cấp: ${emp.allowance}</p>
    <p>Phí khác: ${emp.otherFee}</p>
    <p><strong>Tổng lương: ${salary} VND</strong></p>
  `;
}

// ===================== //
// 7. Chat (Firebase)    //
// ===================== //
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

// ===================== //
// 8. Biểu đồ KD         //
// ===================== //
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

// ===================== //
// 9. Load Firebase Data //
// ===================== //
function loadDataFromFirebase() {
  // Inventory
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    snapshot.forEach(child => inventoryData.push({ id: child.key, ...child.val() }));
    renderInventory();
  });

  // Reports
  reportsRef.on("value", snapshot => {
    reportData = [];
    snapshot.forEach(child => reportData.push({ id: child.key, ...child.val() }));
    renderReports();
    renderExpenseSummary();
  });

  // Employees
  employeesRef.on("value", snapshot => {
    employeeData = [];
    snapshot.forEach(child => employeeData.push({ id: child.key, ...child.val() }));
    renderEmployeeList();
    renderSalarySummary();
  });

  // Advances
  advancesRef.on("value", snapshot => {
    advanceRequests = [];
    snapshot.forEach(child => advanceRequests.push({ id: child.key, ...child.val() }));
    renderAdvanceHistory();
    renderAdvanceApprovalList();
  });

  // Messages
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