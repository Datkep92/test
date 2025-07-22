/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/
/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmFpKa8TpDjo3pQADaTubgVpDPOi-FPXk",
  authDomain: "quanly-d7e54.firebaseapp.com",
  databaseURL: "https://quanly-d7e54-default-rtdb.firebaseio.com",
  projectId: "quanly-d7e54",
  storageBucket: "quanly-d7e54.firebasestorage.app",
  messagingSenderId: "482686011267",
  appId: "1:482686011267:web:f2fe9d400fe618487a98b6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase References
const inventoryRef = firebase.database().ref("inventory");
const reportsRef = firebase.database().ref("reports");
const employeesRef = firebase.database().ref("employees");
const advancesRef = firebase.database().ref("advances");
const messagesRef = firebase.database().ref("messages");

// Local Variables
let inventoryData = [];
let reportData = [];
let employeeData = [];
let advanceRequests = [];
let messages = { group: [], manager: [] };
let productClickCounts = {};
let expenseNotes = [];
let currentEmployeeId = null;


// Parse entry function
function parseEntry(text) {
  const match = text.match(/([\d.,]+)\s*(k|nghìn|tr|triệu)?/i);
  if (!match) return { money: 0, note: text.trim() };

  let num = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2]?.toLowerCase() || '';

  if (unit.includes('tr')) num *= 1_000_000;
  else if (unit.includes('k') || unit.includes('nghìn')) num *= 1_000;

  return {
    money: Math.round(num),
    note: text.replace(match[0], '').trim()
  };
}

// Login / Logout
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    console.error("Login failed: Missing email or password");
    return alert("Vui lòng nhập đầy đủ thông tin!");
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      openTabBubble('revenue-expense');
      loadFirebaseData();
    })
    .catch(err => alert("Lỗi đăng nhập: " + err.message));
}

function logout() {
  auth.signOut().then(() => {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }).catch(err => alert("Lỗi đăng xuất: " + err.message));
}

// Floating Button Tabs
function toggleMenu() {
  const options = document.getElementById('float-options');
  options.style.display = (options.style.display === 'flex') ? 'none' : 'flex';
}

function openTabBubble(tabId) {
  document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  toggleMenu();
  if (tabId === "revenue-expense") {
    renderReportProductList();
    renderReports();
  } else if (tabId === "inventory") {
    renderInventory();
  } else if (tabId === "profile") {
    renderAdvanceHistory();
    renderSalarySummary();
  } else if (tabId === "employee-management") {
    renderEmployeeList();
    renderAdvanceApprovalList();
  } else if (tabId === Coping to clipboard... "business-report") {
    renderExpenseSummary();
    generateBusinessChart();
  } else if (tabId === "chat") {
    renderChat("group");
    renderChat("manager");
  }
}

// Inventory Management (CRUD)
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  if (!name || quantity <= 0 || price <= 0) {
    alert("Vui lòng nhập đầy đủ và đúng thông tin sản phẩm!");
    return;
  }

  inventoryRef.push({ name, quantity, price })
    .then(() => {
      alert("Đã thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
    })
    .catch(err => alert("Lỗi khi thêm sản phẩm: " + err.message));
}

function editInventory(id) {
  const product = inventoryData.find(p => p.id === id);
  if (!product) return;
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Đơn giá:", product.price)) || product.price;
  inventoryRef.child(id).update({ name: newName, quantity: newQty, price: newPrice })
    .catch(err => console.error("Error updating product:", err));
}

function deleteInventory(id) {
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef.child(id).remove()
    .then(() => console.log("Product deleted:", id))
    .catch(err => console.error("Error deleting product:", err));
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

// Revenue-Expense Report
function submitReport() {
  const expenseInputEl = document.getElementById("expense-input");
  const revenueEl = document.getElementById("revenue");
  const closingBalanceEl = document.getElementById("closing-balance");

  if (!expenseInputEl || !revenueEl || !closingBalanceEl) {
    alert("Lỗi: Không tìm thấy các trường nhập liệu!");
    return;
  }

  const expenseInput = expenseInputEl.value.trim();
  const revenue = parseFloat(revenueEl.value) || 0;
  const closingBalance = parseFloat(closingBalance tereEl.value) || 0;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (expenseAmount === 0 && revenue === 0 && Object.keys(productClickCounts).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin: chi phí, doanh thu, hoặc xuất hàng!");
    return;
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const currentHour = parseInt(now.split(', ')[1].split(':')[0]);
  const currentDate = now.split(', ')[0].split('/').reverse().join('-');
  const sortedReports = reportData.sort((a, b) => new Date(a.date) - new Date(b.date));

  let openingBalance = 0;
  if (currentHour >= 18) {
    const previousDay = new Date(currentDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    const lastReportPrevDay = sortedReports.filter(r => r.date.startsWith(previousDayStr)).pop();
    openingBalance = lastReportPrevDay ? lastReportPrevDay.closingBalance : 0;
  } else {
    const lastReportToday = sortedReports.filter(r => r.date.startsWith(currentDate)).pop();
    openingBalance = lastReportToday ? lastReportToday.closingBalance : 0;
  }

  const remaining = openingBalance + revenue - expenseAmount - closingBalance;
  const productsReported = Object.keys(productClickCounts).map(productId => {
    const product = inventoryData.find(p => p.id === productId);
    const quantity = productClickCounts[productId] || 0;
    if (quantity > 0 && product) {
      return { productId, name: product.name, quantity };
    }
    return null;
  }).filter(p => p !== null);

  Promise.all(productsReported.map(p => {
    const product = inventoryData.find(prod => prod.id === p.productId);
    if (product && p.quantity > 0) {
      return inventoryRef.child(p.productId).update({ quantity: product.quantity - p.quantity });
    }
    return Promise.resolve();
  })).then(() => {
    const employee = employeeData.find(e => e.id === currentEmployeeId) || { name: "Unknown" };
    const reportData = {
      date: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName: employee.name,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      closingBalance,
      remaining,
      products: productsReported
    };

    reportsRef.push(reportData)
      .then(snap => {
        expenseNotes.push({ reportId: snap.key, note: expenseNote || "Không có" });
        alert("Báo cáo thành công!");
        expenseInputEl.value = "";
        revenueEl.value = "";
        closingBalanceEl.value = "";
        productClickCounts = {};
        renderReportProductList();
      })
      .catch(err => alert("Lỗi khi gửi báo cáo: " + err.message));
  }).catch(err => alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message));
}

function editReportExpense(reportId) {
  const report = reportData sayingData.find(r => r.id === reportId);
  if (!report) return;
  const newNote = prompt("Chỉnh sửa nội dung chi phí:", report.expenseNote) || report.expenseNote;
  const newAmount = parseFloat(prompt("Chỉnh sửa số tiền chi:", report.expenseAmount)) || report.expenseAmount;
  reportsRef.child(reportId).update({ expenseNote: newNote, expenseAmount: newAmount })
    .then(() => {
      console.log("Report expense updated:", reportId);
      expenseNotes = expenseNotes.map(note => 
        note.reportId === reportId ? { ...note, note: newNote } : note
      );
    })
    .catch(err => console.error("Error updating report expense:", err));
}

function deleteReportExpense(reportId) {
  if (!confirm("Xóa nội dung chi phí này?")) return;
  reportsRef.child(reportId).update({ expenseNote: "Không có", expenseAmount: 0 })
    .then(() => {
      console.log("Report expense deleted:", reportId);
      expenseNotes = expenseNotes.filter(note => note.reportId !== reportId);
    })
    .catch(err => console.error("Error deleting report expense:", err));
}

function editReportProduct(reportId, productId) {
  const report = reportData.find(r => r.id === reportId);
  if (!report) return;
  const product = report.products.find(p => p.productId === productId);
  if (!product) return;
  const newQuantity = parseInt(prompt("Số lượng mới:", product.quantity)) || product.quantity;
  const updatedProducts = report.products.map(p => 
    p.productId === productId ? { ...p, quantity: newQuantity } : p
  );
  reportsRef.child(reportId).update({ products: updatedProducts })
    .then(() => {
      console.log("Report product updated:", { reportId, productId });
      const inventoryProduct = inventoryData.find(p => p.id === productId);
      if (inventoryProduct) {
        inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity - newQuantity });
      }
    })
    .catch(err => console.error("Error updating report product:", err));
}

function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm xuất hàng này?")) return;
  const report = reportData.find(r => r.id === reportId);
  if (!report) return;
  const product = report.products.find(p => p.productId === productId);
  const updatedProducts = report.products.filter(p => p.productId !== productId);
  reportsRef.child(reportId).update({ products: updatedProducts })
    .then(() => {
      console.log("Report product deleted:", { reportId, productId });
      const inventoryProduct = inventoryData.find(p => p.id === productId);
      if (inventoryProduct && product) {
        inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity });
      }
    })
    .catch(err => console.error("Error deleting report product:", err));
}

function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) return;
  if (inventoryData.length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  container.innerHTML = "";
  inventoryData.forEach(item => {
    const clickCount = productClickCounts[item.id] || 0;
    const button = document.createElement("button");
    button.classList.add("product-button");
    button.textContent = `${item.name}: ${clickCount}`;
    button.onclick = () => incrementProductCount(item.id);
    container.appendChild(button);
  });
}

function incrementProductCount(productId) {
  productClickCounts[productId] = (productClickCounts[productId] || 0) + 1;
  const maxQuantity = inventoryData.find(p => p.id === productId)?.quantity || 0;
  if (productClickCounts[productId] > maxQuantity) {
    productClickCounts[productId] = maxQuantity;
  }
  renderReportProductList();
}

// Render Reports
function renderReports() {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  if (!reportContainer || !productContainer) return;
  reportContainer.innerHTML = "";
  productContainer.innerHTML = "";

  if (reportData.length === 0) {
    reportContainer.innerHTML = "<p>Chưa có báo cáo thu chi.</p>";
    productContainer.innerHTML = "<p>Chưa có báo cáo xuất hàng.</p>";
    return;
  }

  const sortedReports = reportData.sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentBalance = sortedReports[0]?.openingBalance || 0;
  const updatedReports = sortedReports.map(r => {
    const remaining = currentBalance + r.revenue - r.expenseAmount - r.closingBalance;
    currentBalance = r.closingBalance || remaining;
    return { ...r, remaining };
  });

  const reportTable = document.createElement("table");
  reportTable.classList.add("table-style");
  reportTable.innerHTML = `
    <thead>
      <tr><th>STT</th><th>Tên NV</th><th>Nội dung</th><th>Số tiền</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${updatedReports.map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.employeeName}</td>
          <td>${r.expenseNote || "Không có"}</td>
          <td>${r.expenseAmount.toLocaleString('vi-VN')} VND</td>
          <td>
            <button onclick="editReportExpense('${r.id}')">Sửa</button>
            <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
          </td>
        </tr>`).join("")}
    </tbody>`;
  reportContainer.appendChild(reportTable);

  const productReports = updatedReports.flatMap((r, index) => 
    Array.isArray(r.products) && r.products.length > 0 
      ? r.products.map(p => ({
          index: index + 1,
          reportId: r.id,
          employeeName: r.employeeName,
          productName: p.name,
          quantity: p.quantity,
          productId: p.productId
        }))
      : []
  );

  const productTable = document.createElement("table");
  productTable.classList.add("table-style");
  productTable.innerHTML = `
    <thead>
      <tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${productReports.map(p => `
        <tr>
          <td>${p.index}</td>
          <td>${p.employeeName}</td>
          <td>${p.productName}</td>
          <td>${p.quantity}</td>
          <td>
            <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
            <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
          </td>
        </tr>`).join("")}
    </tbody>`;
  productContainer.appendChild(productTable);
}

// Employee Management
function addEmployee() {
  const name = document.getElementById("employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  if (!name || dailyWage <= 0) {
    alert("Nhập thông tin nhân viên hợp lệ!");
    return;
  }

  employeesRef.push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0 })
    .then(() => alert("Đã thêm nhân viên!"))
    .catch(err => alert("Lỗi khi thêm nhân viên: " + err.message));
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

// Advance Requests
function requestAdvance() {
  const amount = parseFloat(document.getElementById("advance-amount").value) || 0;
  const reason = document.getElementById("advance-reason").value.trim();

  if (amount <= 0 || !reason) {
    alert("Vui lòng nhập số tiền và lý do!");
    return;
  }

  advancesRef.push({
    employeeId: currentEmployeeId,
    amount,
    reason,
    status: "pending"
  }).then(() => alert("Đã gửi yêu cầu tạm ứng!"))
    .catch(err => alert("Lỗi khi gửi yêu cầu tạm ứng: " + err.message));
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
  advancesRef.child(id).update({ status: "approved" })
    .then(() => console.log("Advance approved:", id))
    .catch(err => console.error("Error approving advance:", err));
}

function rejectAdvance(id) {
  advancesRef.child(id).update({ status: "rejected" })
    .then(() => console.log("Advance rejected:", id))
    .catch(err => console.error("Error rejecting advance:", err));
}

// Salary & Workdays
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

// Chat
function sendGroupMessage() {
  const msg = document.getElementById("group-message").value.trim();
  if (!msg) return;
  messagesRef.child("group").push({ text: msg, time: new Date().toISOString() })
    .then(() => document.getElementById("group-message").value = "")
    .catch(err => console.error("Error sending group message:", err));
}

function sendManagerMessage() {
  const msg = document.getElementById("manager-message").value.trim();
  if (!msg) return;
  messagesRef.child("manager").push({ text: msg, time: new Date().toISOString() })
    .then(() => document.getElementById("manager-message").value = "")
    .catch(err => console.error("Error sending manager message:", err));
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

// Business Report
function renderExpenseSummary() {
  const container = document.getElementById("expense-summary-table");
  if (!container) return;
  container.innerHTML = "";
  reportData.filter(r => r.expenseAmount > 0).forEach(r => {
    const row = document.createElement("div");
    const productsText = Array.isArray(r.products) ? 
      (r.products.length > 0 ? r.products.map(p => `${p.name}: ${p.quantity}`).join(", ") : "Không có sản phẩm") : 
      (r.product ? `Sản phẩm: ${r.product}` : "Không có sản phẩm");
    row.innerHTML = `${new Date(r.date).toLocaleString()} - ${r.employeeName} - Chi phí: ${r.expenseAmount} - ${productsText}`;
    container.appendChild(row);
  });
}

function generateBusinessChart() {
  const ctx = document.getElementById("growth-chart");
  if (!ctx) return;
  const labels = [...new Set(reportData.map(r => r.date.split("T")[0]))];
  const revenueData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.revenue, 0));
  const expenseData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.expenseAmount, 0));

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Doanh thu",
          data: revenueData,
          backgroundColor: "#28a745"
        },
        {
          label: "Chi phí",
          data: expenseData,
          backgroundColor: "#dc3545"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top"
        }
      }
    }
  });
}

// Initialize Firebase Listeners
function loadFirebaseData() {
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => inventoryData.push({ id: child.key, ...child.val() }));
    }
    renderInventory();
    renderReportProductList();
  }, err => console.error("Error fetching inventory data:", err));

  reportsRef.on("value", snapshot => {
    reportData = [];
    expenseNotes = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const report = { id: child.key, ...child.val() };
        reportData.push(report);
        if (report.expenseNote) {
          expenseNotes.push({ reportId: child.key, note: report.expenseNote });
        }
      });
    }
    renderReports();
    renderExpenseSummary();
  }, err => console.error("Error fetching reports data:", err));

  employeesRef.on("value", snapshot => {
    employeeData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => employeeData.push({ id: child.key, ...child.val() }));
    }
    renderEmployeeList();
    renderSalarySummary();
  }, err => console.error("Error fetching employees data:", err));

  advancesRef.on("value", snapshot => {
    advanceRequests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => advanceRequests.push({ id: child.key, ...child.val() }));
    }
    renderAdvanceHistory();
    renderAdvanceApprovalList();
  }, err => console.error("Error fetching advances data:", err));

  messagesRef.child("group").on("value", snapshot => {
    messages.group = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => messages.group.push(child.val()));
    }
    renderChat("group");
  }, err => console.error("Error fetching group messages:", err));

  messagesRef.child("manager").on("value", snapshot => {
    messages.manager = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => messages.manager.push(child.val()));
    }
    renderChat("manager");
  }, err => console.error("Error fetching manager messages:", err));
}

auth.onAuthStateChanged(user => {
  if (user) {
    currentEmployeeId = user.uid;
    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('revenue-expense');
    loadFirebaseData();
  } else {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});
