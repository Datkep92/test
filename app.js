/*********************************************
 * app.js - Milano 259 (Full Features - Firebase)
 *********************************************/

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
let expenseNotes = []; // Biến lưu nội dung chi phí
let currentEmployeeId = null;

// Hàm parseEntry (từ bạn cung cấp)
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

// Đăng nhập / Đăng xuất
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    console.error("Login failed: Missing email or password");
    return alert("Vui lòng nhập đầy đủ thông tin!");
  }

  console.log("Attempting login with email:", email);
  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      currentEmployeeId = user.user.uid;
      console.log("Login successful, user ID:", currentEmployeeId);
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      openTabBubble('revenue-expense');
      loadFirebaseData();
    })
    .catch(err => {
      console.error("Login error:", err.message);
      alert("Lỗi đăng nhập: " + err.message);
    });
}

function logout() {
  console.log("Logging out user:", currentEmployeeId);
  auth.signOut().then(() => {
    currentEmployeeId = null;
    console.log("Logout successful");
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }).catch(err => {
    console.error("Logout error:", err.message);
    alert("Lỗi đăng xuất: " + err.message);
  });
}

// Floating Button Tabs
function toggleMenu() {
  const options = document.getElementById('float-options');
  console.log("Toggling menu, current display:", options.style.display);
  options.style.display = (options.style.display === 'flex') ? 'none' : 'flex';
}

function openTabBubble(tabId) {
  console.log("Opening tab:", tabId);
  const tabs = document.querySelectorAll('.tabcontent');
  tabs.forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add('active');
    console.log("Tab activated:", tabId);
  } else {
    console.error("Tab not found:", tabId);
  }

  toggleMenu();
  if (tabId === "revenue-expense" && inventoryData.length > 0) {
    console.log("Rendering revenue-expense data");
    renderReportProductList();
    renderReports();
  } else if (tabId === "inventory") {
    console.log("Rendering inventory data");
    renderInventory();
  } else if (tabId === "profile") {
    console.log("Rendering profile data");
    renderAdvanceHistory();
    renderSalarySummary();
  } else if (tabId === "employee-management") {
    console.log("Rendering employee management data");
    renderEmployeeList();
    renderAdvanceApprovalList();
  } else if (tabId === "business-report") {
    console.log("Rendering business report data");
    renderExpenseSummary();
    generateBusinessChart();
  } else if (tabId === "chat") {
    console.log("Rendering chat data");
    renderChat("group");
    renderChat("manager");
  }
}

// Inventory Management (CRUD)
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  console.log("Adding product:", { name, quantity, price });

  if (!name || quantity <= 0 || price <= 0) {
    console.error("Invalid product input:", { name, quantity, price });
    alert("Vui lòng nhập đầy đủ và đúng thông tin sản phẩm!");
    return;
  }

  inventoryRef.push({ name, quantity, price })
    .then(() => {
      console.log("Product added successfully to Firebase:", { name, quantity, price });
      alert("Đã thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
    })
    .catch(err => {
      console.error("Error adding product to Firebase:", err);
      alert("Lỗi khi thêm sản phẩm: " + err.message);
    });
}

function editInventory(id) {
  console.log("Editing product ID:", id);
  const product = inventoryData.find(p => p.id === id);
  if (!product) {
    console.error("Product not found for ID:", id);
    return;
  }
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Đơn giá:", product.price)) || product.price;
  console.log("Updating product:", { id, newName, newQty, newPrice });
  inventoryRef.child(id).update({ name: newName, quantity: newQty, price: newPrice })
    .catch(err => console.error("Error updating product:", err));
}

function deleteInventory(id) {
  console.log("Deleting product ID:", id);
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef.child(id).remove()
    .then(() => console.log("Product deleted:", id))
    .catch(err => console.error("Error deleting product:", err));
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  if (!list) {
    console.error("Inventory list element not found!");
    return;
  }
  list.innerHTML = "";
  console.log("Rendering inventory, total items:", inventoryData.length);

  if (inventoryData.length === 0) {
    list.innerHTML = "<p>Kho trống.</p>";
    console.log("Inventory is empty");
    return;
  }

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Tên SP</th><th>Số lượng</th><th>Đơn giá</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => {
        console.log("Rendering product:", item);
        return `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price}</td>
          <td>
            <button onclick="editInventory('${item.id}')">Sửa</button>
            <button onclick="deleteInventory('${item.id}')">Xóa</button>
          </td>
        </tr>`;
      }).join("")}
    </tbody>`;
  list.appendChild(table);
}

// Revenue-Expense Report
function submitReport() {
  const expenseInputEl = document.getElementById("expense-input");
  const revenueEl = document.getElementById("revenue");
  const closingBalanceEl = document.getElementById("closing-balance");

  // Kiểm tra xem các phần tử có tồn tại không
  if (!expenseInputEl || !revenueEl || !closingBalanceEl) {
    console.error("One or more input elements not found:", {
      expenseInput: expenseInputEl,
      revenue: revenueEl,
      closingBalance: closingBalanceEl
    });
    alert("Lỗi: Không tìm thấy các trường nhập liệu!");
    return;
  }

  const expenseInput = expenseInputEl.value.trim();
  const revenue = parseFloat(revenueEl.value) || 0;
  const closingBalance = parseFloat(closingBalanceEl.value) || 0;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  // Kiểm tra nếu không có doanh thu, chi phí, hoặc xuất hàng
  if (expenseAmount === 0 && revenue === 0 && Object.keys(productClickCounts).length === 0) {
    console.error("No financial data or products entered for report");
    alert("Vui lòng nhập ít nhất một thông tin: chi phí, doanh thu, hoặc xuất hàng!");
    return;
  }

  // Lấy thời gian hiện tại (giờ Việt Nam)
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const currentHour = parseInt(now.split(', ')[1].split(':')[0]);
  const currentDate = now.split(', ')[0].split('/').reverse().join('-'); // YYYY-MM-DD
  const sortedReports = reportData.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Tính số dư đầu kỳ
  let openingBalance = 0;
  if (currentHour >= 18) {
    // Sau 18:00, lấy closingBalance của báo cáo cuối ngày trước
    const previousDay = new Date(currentDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    const lastReportPrevDay = sortedReports.filter(r => r.date.startsWith(previousDayStr)).pop();
    openingBalance = lastReportPrevDay ? lastReportPrevDay.closingBalance : 0;
  } else {
    // Trước 18:00, lấy closingBalance của báo cáo cuối cùng cùng ngày
    const lastReportToday = sortedReports.filter(r => r.date.startsWith(currentDate)).pop();
    openingBalance = lastReportToday ? lastReportToday.closingBalance : 0;
  }

  // Tính số dư còn lại theo công thức mới
  const remaining = openingBalance + revenue - expenseAmount - closingBalance;

  console.log("Submitting report:", { openingBalance, expenseAmount, expenseNote, revenue, closingBalance, remaining, productClickCounts });

  // Chuẩn bị danh sách sản phẩm xuất hàng
  const productsReported = Object.keys(productClickCounts).map(productId => {
    const product = inventoryData.find(p => p.id === productId);
    const quantity = productClickCounts[productId] || 0;
    if (quantity > 0 && product) {
      return { productId, name: product.name, quantity };
    }
    return null;
  }).filter(p => p !== null);

  console.log("Products reported:", productsReported);

  // Cập nhật số lượng kho
  Promise.all(productsReported.map(p => {
    const product = inventoryData.find(prod => prod.id === p.productId);
    if (product && p.quantity > 0) {
      return inventoryRef.child(p.productId).update({ quantity: product.quantity - p.quantity })
        .then(() => console.log("Updated product quantity:", { productId: p.productId, newQuantity: product.quantity - p.quantity }));
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

    console.log("Pushing report to Firebase:", reportData);

    reportsRef.push(reportData)
      .then(snap => {
        console.log("Report submitted successfully");
        expenseNotes.push({ reportId: snap.key, note: expenseNote || "Không có" });
        console.log("Added to expenseNotes:", { reportId: snap.key, note: expenseNote });
        alert("Báo cáo thành công!");
        expenseInputEl.value = "";
        revenueEl.value = "";
        closingBalanceEl.value = "";
        productClickCounts = {};
        renderReportProductList();
      })
      .catch(err => {
        console.error("Error submitting report:", err);
        alert("Lỗi khi gửi báo cáo: " + err.message);
      });
  }).catch(err => {
    console.error("Error updating product quantities:", err);
    alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message);
  });
}

function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) {
    console.error("Report product list element not found!");
    return;
  }
  if (inventoryData.length === 0) {
    console.log("Waiting for inventory data to load");
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
  container.innerHTML = "";
  console.log("Rendering report product list, total items:", inventoryData.length);

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr><th>Tên sản phẩm</th><th>Số lượng trong kho</th><th>Đơn giá</th><th>Số lượng xuất</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => {
        const clickCount = productClickCounts[item.id] || 0;
        console.log("Rendering product for report:", { id: item.id, name: item.name, clickCount });
        return `
        <tr onclick="incrementProductCount('${item.id}')">
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString('vi-VN')} VND</td>
          <td>
            <input type="number" id="quantity-${item.id}" value="${clickCount}" min="0" max="${item.quantity}" readonly>
          </td>
        </tr>`;
      }).join("")}
    </tbody>`;
  container.appendChild(table);
  console.log("Current product click counts:", productClickCounts);
}

function incrementProductCount(productId) {
  productClickCounts[productId] = (productClickCounts[productId] || 0) + 1;
  const maxQuantity = inventoryData.find(p => p.id === productId)?.quantity || 0;
  if (productClickCounts[productId] > maxQuantity) {
    productClickCounts[productId] = maxQuantity;
    console.warn("Max quantity reached for product:", productId);
  }
  const input = document.getElementById(`quantity-${productId}`);
  if (input) {
    input.value = productClickCounts[productId];
  }
  console.log("Incremented count for product:", { productId, count: productClickCounts[productId] });
}


function renderReports() {
  const container = document.getElementById("shared-report-table");
  if (!container) {
    console.error("Report table element not found!");
    return;
  }
  container.innerHTML = "";
  console.log("Rendering reports, total items:", reportData.length);

  if (reportData.length === 0) {
    container.innerHTML = "<p>Chưa có báo cáo nào.</p>";
    return;
  }

  const sortedReports = reportData.sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentBalance = sortedReports[0]?.openingBalance || 0;
  const updatedReports = sortedReports.map(r => {
    const remaining = currentBalance + r.revenue - r.expenseAmount - r.closingBalance;
    currentBalance = r.closingBalance || remaining;
    return { ...r, remaining };
  });

  const totalRevenue = updatedReports.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpense = updatedReports.reduce((sum, r) => sum + r.expenseAmount, 0);
  const firstOpeningBalance = updatedReports[0]?.openingBalance || 0;
  const finalClosingBalance = updatedReports[updatedReports.length - 1]?.closingBalance || 0;
  const finalBalance = updatedReports[updatedReports.length - 1]?.remaining || 0;

  const table = document.createElement("table");
  table.classList.add("table-style");
  table.innerHTML = `
    <thead>
      <tr>
        <th>STT</th>
        <th>Giờ</th>
        <th>Tên NV</th>
        <th>Nội dung chi phí</th>
        <th>Số tiền chi</th>
        <th>Doanh thu</th>
        <th>Số dư cuối kỳ</th>
        <th>Số dư còn lại</th>
        <th>Sản phẩm xuất</th>
      </tr>
    </thead>
    <tbody>
      ${updatedReports.map((r, index) => {
        const productsText = Array.isArray(r.products) && r.products.length > 0 
          ? r.products.map(p => `${p.name}: ${p.quantity}`).join(", ")
          : "Không có";
        return `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(r.date).toLocaleTimeString('vi-VN')}</td>
          <td>${r.employeeName}</td>
          <td>${r.expenseNote || "Không có"}</td>
          <td>${r.expenseAmount.toLocaleString('vi-VN')} VND</td>
          <td>${r.revenue.toLocaleString('vi-VN')} VND</td>
          <td>${r.closingBalance.toLocaleString('vi-VN')} VND</td>
          <td>${r.remaining.toLocaleString('vi-VN')} VND</td>
          <td>${productsText}</td>
        </tr>`;
      }).join("")}
    </tbody>`;
  container.appendChild(table);

  const totalDiv = document.createElement("div");
  totalDiv.classList.add("report-total");
  totalDiv.innerHTML = `
    <strong>Tổng:</strong><br>
    Số dư đầu kỳ: ${firstOpeningBalance.toLocaleString('vi-VN')} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND<br>
    Chi phí: ${totalExpense.toLocaleString('vi-VN')} VND<br>
    Số dư cuối kỳ: ${finalClosingBalance.toLocaleString('vi-VN')} VND<br>
    Còn lại: ${finalBalance.toLocaleString('vi-VN')} VND
  `;
  container.appendChild(totalDiv);
}

// Employee Management
function addEmployee() {
  const name = document.getElementById("employee-name").value.trim();
  const dailyWage = parseFloat(document.getElementById("employee-dailywage").value) || 0;
  const allowance = parseFloat(document.getElementById("employee-allowance").value) || 0;
  const otherFee = parseFloat(document.getElementById("employee-otherfee").value) || 0;

  console.log("Adding employee:", { name, dailyWage, allowance, otherFee });

  if (!name || dailyWage <= 0) {
    console.error("Invalid employee input:", { name, dailyWage });
    return alert("Nhập thông tin nhân viên hợp lệ!");
  }

  employeesRef.push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0 })
    .then(() => {
      console.log("Employee added successfully");
      alert("Đã thêm nhân viên!");
    })
    .catch(err => {
      console.error("Error adding employee:", err);
      alert("Lỗi khi thêm nhân viên: " + err.message);
    });
}

function renderEmployeeList() {
  const list = document.getElementById("employee-list");
  if (!list) {
    console.error("Employee list element not found!");
    return;
  }
  list.innerHTML = "";
  console.log("Rendering employee list, total items:", employeeData.length);

  if (employeeData.length === 0) {
    list.innerHTML = "<p>Chưa có nhân viên.</p>";
    console.log("No employees available");
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

  console.log("Requesting advance:", { amount, reason, employeeId: currentEmployeeId });

  if (amount <= 0 || !reason) {
    console.error("Invalid advance request:", { amount, reason });
    return alert("Vui lòng nhập số tiền và lý do!");
  }

  advancesRef.push({
    employeeId: currentEmployeeId,
    amount,
    reason,
    status: "pending"
  }).then(() => {
    console.log("Advance request submitted successfully");
    alert("Đã gửi yêu cầu tạm ứng!");
  }).catch(err => {
    console.error("Error submitting advance request:", err);
    alert("Lỗi khi gửi yêu cầu tạm ứng: " + err.message);
  });
}

function renderAdvanceHistory() {
  const container = document.getElementById("advance-history");
  if (!container) {
    console.error("Advance history element not found!");
    return;
  }
  container.innerHTML = "";
  const myAdvances = advanceRequests.filter(a => a.employeeId === currentEmployeeId);
  console.log("Rendering advance history, total items:", myAdvances.length);

  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    console.log("No advance requests for user:", currentEmployeeId);
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
  if (!container) {
    console.error("Advance approval list element not found!");
    return;
  }
  container.innerHTML = "";
  const pending = advanceRequests.filter(a => a.status === "pending");
  console.log("Rendering advance approval list, total items:", pending.length);

  if (pending.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu nào.</p>";
    console.log("No pending advance requests");
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
  console.log("Approving advance ID:", id);
  advancesRef.child(id).update({ status: "approved" })
    .then(() => console.log("Advance approved:", id))
    .catch(err => console.error("Error approving advance:", err));
}

function rejectAdvance(id) {
  console.log("Rejecting advance ID:", id);
  advancesRef.child(id).update({ status: "rejected" })
    .then(() => console.log("Advance rejected:", id))
    .catch(err => console.error("Error rejecting advance:", err));
}

// Salary & Workdays
function calculateSalary(empId) {
  const emp = employeeData.find(e => e.id === empId);
  if (!emp) {
    console.error("Employee not found for salary calculation:", empId);
    return 0;
  }
  const totalAdvance = advanceRequests.filter(a => a.employeeId === empId && a.status === "approved")
    .reduce((sum, a) => sum + a.amount, 0);
  const salary = (emp.workdays - emp.offdays) * emp.dailyWage + emp.allowance - emp.otherFee - totalAdvance;
  console.log("Calculated salary for employee:", { empId, salary });
  return salary;
}

function renderSalarySummary() {
  const container = document.getElementById("salary-summary");
  if (!container) {
    console.error("Salary summary element not found!");
    return;
  }
  const emp = employeeData.find(e => e.id === currentEmployeeId);
  if (!emp) {
    container.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
    console.error("No employee data for user:", currentEmployeeId);
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
  console.log("Rendered salary summary for user:", currentEmployeeId);
}

// Chat
function sendGroupMessage() {
  const msg = document.getElementById("group-message").value.trim();
  if (!msg) {
    console.error("Empty group message");
    return;
  }
  console.log("Sending group message:", msg);
  messagesRef.child("group").push({ text: msg, time: new Date().toISOString() })
    .then(() => {
      console.log("Group message sent successfully");
      document.getElementById("group-message").value = "";
    })
    .catch(err => console.error("Error sending group message:", err));
}

function sendManagerMessage() {
  const msg = document.getElementById("manager-message").value.trim();
  if (!msg) {
    console.error("Empty manager message");
    return;
  }
  console.log("Sending manager message:", msg);
  messagesRef.child("manager").push({ text: msg, time: new Date().toISOString() })
    .then(() => {
      console.log("Manager message sent successfully");
      document.getElementById("manager-message").value = "";
    })
    .catch(err => console.error("Error sending manager message:", err));
}

function renderChat(type) {
  const box = document.getElementById(type + "-chat");
  if (!box) {
    console.error("Chat box not found:", type);
    return;
  }
  box.innerHTML = "";
  console.log(`Rendering ${type} chat, total messages:`, messages[type].length);
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
  if (!container) {
    console.error("Expense summary table element not found!");
    return;
  }
  container.innerHTML = "";
  console.log("Rendering expense summary, total items:", reportData.length);
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
  if (!ctx) {
    console.error("Chart canvas not found!");
    return;
  }
  const labels = [...new Set(reportData.map(r => r.date.split("T")[0]))];
  const revenueData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.revenue, 0));
  const expenseData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + r.expenseAmount, 0));
  console.log("Generating business chart:", { labels, revenueData, expenseData });

  ```chartjs
  {
    "type": "bar",
    "data": {
      "labels": ${JSON.stringify(labels)},
      "datasets": [
        {
          "label": "Doanh thu",
          "data": ${JSON.stringify(revenueData)},
          "backgroundColor": "#28a745"
        },
        {
          "label": "Chi phí",
          "data": ${JSON.stringify(expenseData)},
          "backgroundColor": "#dc3545"
        }
      ]
    },
    "options": {
      "responsive": true,
      "plugins": {
        "legend": {
          "position": "top"
        }
      }
    }
  }
  ```
}

// Initialize Firebase Listeners
function loadFirebaseData() {
  console.log("Initializing Firebase listeners");
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const product = { id: child.key, ...child.val() };
        console.log("Fetched product from Firebase:", product);
        inventoryData.push(product);
      });
    } else {
      console.log("No data in inventory");
    }
    console.log("Updated inventoryData:", inventoryData);
    renderInventory();
    renderReportProductList();
  }, err => {
    console.error("Error fetching inventory data:", err);
  });

  reportsRef.on("value", snapshot => {
    reportData = [];
    expenseNotes = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const report = { id: child.key, ...child.val() };
        console.log("Fetched report from Firebase:", report);
        reportData.push(report);
        if (report.expenseNote) {
          expenseNotes.push({ reportId: child.key, note: report.expenseNote });
        }
      });
    } else {
      console.log("No data in reports");
    }
    console.log("Updated reportData:", reportData);
    console.log("Updated expenseNotes:", expenseNotes);
    renderReports();
    renderExpenseSummary();
  }, err => {
    console.error("Error fetching reports data:", err);
  });

  employeesRef.on("value", snapshot => {
    employeeData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const employee = { id: child.key, ...child.val() };
        console.log("Fetched employee from Firebase:", employee);
        employeeData.push(employee);
      });
    } else {
      console.log("No data in employees");
    }
    console.log("Updated employeeData:", employeeData);
    renderEmployeeList();
    renderSalarySummary();
  }, err => {
    console.error("Error fetching employees data:", err);
  });

  advancesRef.on("value", snapshot => {
    advanceRequests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const advance = { id: child.key, ...child.val() };
        console.log("Fetched advance from Firebase:", advance);
        advanceRequests.push(advance);
      });
    } else {
      console.log("No data in advances");
    }
    console.log("Updated advanceRequests:", advanceRequests);
    renderAdvanceHistory();
    renderAdvanceApprovalList();
  }, err => {
    console.error("Error fetching advances data:", err);
  });

  messagesRef.child("group").on("value", snapshot => {
    messages.group = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const message = child.val();
        console.log("Fetched group message:", message);
        messages.group.push(message);
      });
    } else {
      console.log("No group messages");
    }
    console.log("Updated group messages:", messages.group);
    renderChat("group");
  }, err => {
    console.error("Error fetching group messages:", err);
  });

  messagesRef.child("manager").on("value", snapshot => {
    messages.manager = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const message = child.val();
        console.log("Fetched manager message:", message);
        messages.manager.push(message);
      });
    } else {
      console.log("No manager messages");
    }
    console.log("Updated manager messages:", messages.manager);
    renderChat("manager");
  }, err => {
    console.error("Error fetching manager messages:", err);
  });
}

auth.onAuthStateChanged(user => {
  console.log("Auth state changed:", user ? user.uid : "No user");
  if (user) {
    currentEmployeeId = user.uid;
    console.log("User logged in, ID:", currentEmployeeId);
    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('revenue-expense');
    loadFirebaseData();
  } else {
    currentEmployeeId = null;
    console.log("User logged out");
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});
