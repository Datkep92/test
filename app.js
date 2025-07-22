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
let expenseNotes = [];
let currentEmployeeId = null;
let isFirebaseInitialized = false;

// Hàm parseEntry (giữ nguyên từ bạn cung cấp)
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
      openTabBubble('profile');
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
  if (tabId === "revenue-expense") {
    console.log("Rendering revenue-expense data");
    renderReportProductList();
    renderReports();
  } else if (tabId === "inventory") {
    console.log("Rendering inventory data");
    renderInventory();
  } else if (tabId === "profile") {
    console.log("Rendering profile data");
    renderProfile();
    renderAdvanceHistory();
    renderSalarySummary();
    renderSchedule();
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
      <tr><th>Tên SP</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Hành động</th></tr>
    </thead>
    <tbody>
      ${inventoryData.map(item => {
        console.log("Rendering product:", item);
        const total = item.quantity * item.price;
        return `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString('vi-VN')} VND</td>
          <td>${total.toLocaleString('vi-VN')} VND</td>
          <td>
            <button onclick="editInventory('${item.id}')">Sửa</button>
            <button onclick="deleteInventory('${item.id}')">Xóa</button>
          </td>
        </tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3"><strong>Tổng tiền tồn kho:</strong></td><td><strong>${inventoryData.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString('vi-VN')} VND</strong></td><td></td></tr>
    </tfoot>`;
  list.appendChild(table);
}

// Revenue-Expense Report
function submitReport() {
  const openingBalanceEl = document.getElementById("opening-balance");
  const expenseInputEl = document.getElementById("expense-input");
  const revenueEl = document.getElementById("revenue");
  const closingBalanceEl = document.getElementById("closing-balance");

  if (!openingBalanceEl || !expenseInputEl || !revenueEl || !closingBalanceEl) {
    alert("Lỗi: Không tìm thấy các trường nhập liệu!");
    return;
  }

  const openingBalance = parseFloat(openingBalanceEl.value) || 0;
  const expenseInput = expenseInputEl.value.trim();
  const revenue = parseFloat(revenueEl.value) || 0;
  const closingBalance = closingBalanceEl.value ? parseFloat(closingBalanceEl.value) : null;
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (openingBalance === 0 && expenseAmount === 0 && revenue === 0 && closingBalance === null && Object.keys(productClickCounts).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin: số dư đầu kỳ, chi phí, doanh thu, số dư cuối kỳ, hoặc xuất hàng!");
    return;
  }

  const remaining = openingBalance + revenue - expenseAmount - (closingBalance || 0);

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
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const employeeName = employee ? employee.name : (auth.currentUser.displayName || auth.currentUser.email.split('@')[0] || 'Nhân viên');

    const reportData = {
      date: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName: employeeName,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      closingBalance,
      remaining,
      products: productsReported
    };

    console.log("Gửi báo cáo:", reportData);

    reportsRef.push(reportData)
      .then(snap => {
        expenseNotes.push({ reportId: snap.key, note: expenseNote || "Không có" });
        alert("Báo cáo thành công!");
        openingBalanceEl.value = "";
        expenseInputEl.value = "";
        revenueEl.value = "";
        closingBalanceEl.value = "";
        productClickCounts = {};
        renderReportProductList();
        renderReports();
      })
      .catch(err => alert("Lỗi khi gửi báo cáo: " + err.message));
  }).catch(err => alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message));
}

function editReportExpense(reportId) {
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newInput = prompt("Chỉnh sửa nội dung chi phí (VD: 500k Mua nguyên liệu):", `${report.expenseAmount / 1000}k ${report.expenseNote}`);
  if (!newInput) return;
  const { money: newAmount, note: newNote } = parseEntry(newInput);
  reportsRef.child(reportId).update({
    expenseAmount: newAmount,
    expenseNote: newNote || "Không có",
    remaining: report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0)
  })
    .then(() => {
      expenseNotes = expenseNotes.map(note =>
        note.reportId === reportId ? { ...note, note: newNote || "Không có" } : note
      );
      renderReports();
      alert("Đã cập nhật chi phí!");
    })
    .catch(err => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

function deleteReportExpense(reportId) {
  if (!confirm("Xóa nội dung chi phí này?")) return;
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  reportsRef.child(reportId).update({
    expenseAmount: 0,
    expenseNote: "Không có",
    remaining: report.openingBalance + report.revenue - 0 - (report.closingBalance || 0)
  })
    .then(() => {
      expenseNotes = expenseNotes.filter(note => note.reportId !== reportId);
      renderReports();
      alert("Đã xóa chi phí!");
    })
    .catch(err => alert("Lỗi khi xóa chi phí: " + err.message));
}

function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm xuất hàng này?")) return;
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const updatedProducts = report.products.filter(p => p.productId !== productId);
  const inventoryProduct = inventoryData.find(p => p.id === productId);
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryProduct ? inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity }) : Promise.resolve()
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã xóa sản phẩm!");
    })
    .catch(err => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

function editReportProduct(reportId, productId) {
  const report = reportData.find(r => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find(p => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const newQuantity = parseInt(prompt("Số lượng mới:", product.quantity));
  if (!newQuantity || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const inventoryProduct = inventoryData.find(p => p.id === productId);
  if (!inventoryProduct) {
    alert("Sản phẩm không tồn tại trong kho!");
    return;
  }
  if (newQuantity > inventoryProduct.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products.map(p =>
    p.productId === productId ? { ...p, quantity: newQuantity } : p
  );
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity - newQuantity })
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã cập nhật sản phẩm!");
    })
    .catch(err => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
}

function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) {
    console.error("Report product list element not found!");
    return;
  }
  container.innerHTML = "";
  if (inventoryData.length === 0) {
    container.innerHTML = "<p>Chưa có sản phẩm trong kho.</p>";
    return;
  }
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
  const product = inventoryData.find(p => p.id === productId);
  if (!product) return;
  productClickCounts[productId] = (productClickCounts[productId] || 0) + 1;
  if (productClickCounts[productId] > product.quantity) {
    productClickCounts[productId] = product.quantity;
    alert("Đã đạt số lượng tối đa trong kho!");
  }
  renderReportProductList();
}

function filterReports() {
  const overlay = document.createElement("div");
  overlay.id = "date-filter-overlay";
  overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;";

  const filterBox = document.createElement("div");
  filterBox.style.cssText = "background: white; padding: 20px; border-radius: 5px; width: 300px; text-align: center;";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Đóng";
  closeBtn.style.cssText = "margin-top: 10px;";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  const singleDateLabel = document.createElement("label");
  singleDateLabel.textContent = "Chọn ngày: ";
  const singleDateInput = document.createElement("input");
  singleDateInput.type = "date";
  singleDateInput.id = "single-filter-date";
  singleDateInput.max = new Date().toISOString().split("T")[0];

  const rangeDateLabel = document.createElement("label");
  rangeDateLabel.textContent = "Chọn khoảng thời gian: ";
  const startDateInput = document.createElement("input");
  startDateInput.type = "date";
  startDateInput.id = "filter-start-date";
  startDateInput.max = new Date().toISOString().split("T")[0];
  const endDateInput = document.createElement("input");
  endDateInput.type = "date";
  endDateInput.id = "filter-end-date";
  endDateInput.max = new Date().toISOString().split("T")[0];

  const filterBtn = document.createElement("button");
  filterBtn.textContent = "Lọc";
  filterBtn.className = "primary-btn";
  filterBtn.onclick = () => {
    const singleDate = singleDateInput.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    let filteredReports = reportData;

    if (singleDate) {
      const selectedDate = new Date(singleDate).toISOString().split('T')[0];
      filteredReports = reportData.filter(r => r.date.split('T')[0] === selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = reportData.filter(r => {
        const reportDate = new Date(r.date).getTime();
        return reportDate >= start && reportDate < end;
      });
    } else {
      alert("Vui lòng chọn một ngày hoặc khoảng thời gian!");
      return;
    }

    renderFilteredReports(filteredReports);
    document.body.removeChild(overlay);
  };

  filterBox.appendChild(singleDateLabel);
  filterBox.appendChild(singleDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(rangeDateLabel);
  filterBox.appendChild(startDateInput);
  filterBox.appendChild(endDateInput);
  filterBox.appendChild(document.createElement("br"));
  filterBox.appendChild(filterBtn);
  filterBox.appendChild(closeBtn);
  overlay.appendChild(filterBox);
  document.body.appendChild(overlay);
}

function renderFilteredReports(filteredReports) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  if (!reportContainer || !productContainer) {
    console.error("Report table element not found!");
    return;
  }
  reportContainer.innerHTML = "";
  productContainer.innerHTML = "";

  if (filteredReports.length === 0) {
    reportContainer.innerHTML = "<p>Chưa có báo cáo thu chi trong khoảng thời gian được chọn.</p>";
    productContainer.innerHTML = "<p>Chưa có báo cáo xuất hàng trong khoảng thời gian được chọn.</p>";
    return;
  }

  const sortedReports = filteredReports.sort((a, b) => new Date(a.date) - new Date(b.date));

  const financeReports = sortedReports.filter(r =>
    r.openingBalance !== 0 || r.revenue !== 0 || r.expenseAmount !== 0 || r.closingBalance !== null
  );

  const reportTable = document.createElement("table");
  reportTable.classList.add("table-style");
  reportTable.innerHTML = `
    <thead>
      <tr>
        <th>STT</th>
        <th>Tên NV</th>
        <th>Chi phí</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      ${financeReports.map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.employeeName}</td>
          <td>${r.expenseAmount.toLocaleString('vi-VN')} VND (${r.expenseNote || "Không có"})</td>
          <td>
            <button onclick="editReportExpense('${r.id}')">Sửa</button>
            <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
          </td>
        </tr>`).join("")}
    </tbody>`;
  reportContainer.appendChild(reportTable);

  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const finalBalance = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  const totalReportDiv = document.createElement("div");
  totalReportDiv.classList.add("report-total");
  totalReportDiv.innerHTML = `
    <strong>Tổng:</strong><br>
    Số dư đầu kỳ: ${totalOpeningBalance.toLocaleString('vi-VN')} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND<br>
    Chi phí: ${totalExpense.toLocaleString('vi-VN')} VND<br>
    Số dư cuối kỳ: ${totalClosingBalance.toLocaleString('vi-VN')} VND<br>
    Còn lại: ${finalBalance.toLocaleString('vi-VN')} VND
  `;
  reportContainer.appendChild(totalReportDiv);

  const productReports = sortedReports.flatMap((r, index) =>
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

  const totalProductSummary = productReports.reduce((acc, p) => {
    acc[p.productName] = (acc[p.productName] || 0) + p.quantity;
    return acc;
  }, {});
  const totalProductText = Object.entries(totalProductSummary)
    .map(([name, qty]) => {
      const inventoryItem = inventoryData.find(item => item.name === name);
      const remainingQty = inventoryItem ? inventoryItem.quantity : 0;
      return `${name}: ${qty} (Còn: ${remainingQty})`;
    })
    .join(" - ");

  const totalProductDiv = document.createElement("div");
  totalProductDiv.classList.add("report-total");
  totalProductDiv.innerHTML = `
    <strong>Tổng xuất kho:</strong> ${totalProductText || "Không có"}
  `;
  productContainer.appendChild(totalProductDiv);
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

  employeesRef.push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0, address: "", phone: "", dob: "" })
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
    status: "pending",
    requestTime: new Date().toISOString()
  }).then(() => {
    console.log("Advance request submitted successfully");
    alert("Đã gửi yêu cầu tạm ứng!");
    document.getElementById("advance-amount").value = "";
    document.getElementById("advance-reason").value = "";
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
    div.innerHTML = `Tạm ứng: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason} - Trạng thái: ${a.status || "pending"}`;
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
  const pending = advanceRequests.filter(a => a.status === "pending" && employeeData.some(e => e.id === currentEmployeeId && e.role === "manager"));
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
      ${emp.name}: ${a.amount.toLocaleString('vi-VN')} VND - ${a.reason}
      <button onclick="approveAdvance('${a.id}')">Duyệt</button>
      <button onclick="rejectAdvance('${a.id}')">Từ chối</button>`;
    container.appendChild(div);
  });
}

function approveAdvance(id) {
  console.log("Approving advance ID:", id);
  advancesRef.child(id).update({ status: "approved" })
    .then(() => {
      console.log("Advance approved:", id);
      renderSalarySummary(); // Cập nhật lại lương
    })
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
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const baseWorkdays = daysInMonth;
  const schedule = emp.schedule || {};
  const offDays = Object.values(schedule).filter(s => s === "Off").length;
  const overtimeDays = Object.values(schedule).filter(s => s === "Tăng ca").length;
  const totalAdvance = advanceRequests.filter(a => a.employeeId === empId && a.status === "approved")
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  const salary = (baseWorkdays + overtimeDays - offDays) * emp.dailyWage + (emp.allowance || 0) - (emp.otherFee || 0) - totalAdvance;
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
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  container.innerHTML = `
    <p>Tháng: ${now.getFullYear()}-${now.getMonth() + 1} (Tổng ${daysInMonth} ngày)</p>
    <p>Ngày làm: ${daysInMonth}</p>
    <p>Ngày nghỉ: ${Object.values(emp.schedule || {}).filter(s => s === "Off").length}</p>
    <p>Ngày tăng ca: ${Object.values(emp.schedule || {}).filter(s => s === "Tăng ca").length}</p>
    <p>Lương/ngày: ${emp.dailyWage.toLocaleString('vi-VN')} VND</p>
    <p>Phụ cấp: ${emp.allowance || 0} VND</p>
    <p>Phí khác: ${emp.otherFee || 0} VND</p>
    <p>Tạm ứng: ${advanceRequests.filter(a => a.employeeId === emp.id && a.status === "approved").reduce((sum, a) => sum + (a.amount || 0), 0).toLocaleString('vi-VN')} VND</p>
    <p><strong>Tổng lương: ${salary.toLocaleString('vi-VN')} VND</strong></p>`;
  console.log("Rendered salary summary for user:", currentEmployeeId);
}

function renderSalaryComparison() {
  const container = document.getElementById("salary-comparison");
  if (!container) return;
  const emp = employeeData.find(e => e.id === currentEmployeeId);
  if (!emp) return;
  const now = new Date();
  const currentSalary = calculateSalary(emp.id);
  const comparison = [];
  for (let i = 1; i <= 3; i++) {
    const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const pastSalary = calculatePastSalary(emp.id, pastDate);
    comparison.push({ month: `${pastDate.getFullYear()}-${pastDate.getMonth() + 1}`, salary: pastSalary });
  }
  container.innerHTML = `
    <table class="table-style">
      <thead><tr><th>Tháng</th><th>Lương (VND)</th></tr></thead>
      <tbody>
        ${comparison.map(c => `<tr><td>${c.month}</td><td>${c.salary.toLocaleString('vi-VN')}</td></tr>`).join("")}
        <tr><td><strong>Tháng hiện tại</strong></td><td><strong>${currentSalary.toLocaleString('vi-VN')}</strong></td></tr>
      </tbody>
    </table>`;
}

function calculatePastSalary(empId, date) {
  const emp = employeeData.find(e => e.id === empId);
  if (!emp) return 0;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const baseWorkdays = daysInMonth;
  const offDays = 0; // Giả lập, cần lịch sử schedule
  const overtimeDays = 0; // Giả lập
  const totalAdvance = 0; // Giả lập, cần lịch sử tạm ứng
  return (baseWorkdays + overtimeDays - offDays) * emp.dailyWage + (emp.allowance || 0) - (emp.otherFee || 0) - totalAdvance;
}

// Chat
function sendGroupMessage() {
  const msg = document.getElementById("group-message").value.trim();
  if (!msg) {
    console.error("Empty group message");
    return;
  }
  console.log("Sending group message:", msg);
  messagesRef.child("group").push({ text: msg, time: new Date().toISOString(), senderId: currentEmployeeId })
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
  messagesRef.child("manager").push({ text: msg, time: new Date().toISOString(), senderId: currentEmployeeId })
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
    const sender = employeeData.find(e => e.id === m.senderId) || { name: "Nhân viên" };
    const div = document.createElement("div");
    div.classList.add("chat-message");
    div.textContent = `[${new Date(m.time).toLocaleTimeString()}] ${sender.name}: ${m.text}`;
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
    const productsText = Array.isArray(r.products)
      ? (r.products.length > 0 ? r.products.map(p => `${p.name}: ${p.quantity}`).join(", ") : "Không có sản phẩm")
      : (r.product ? `Sản phẩm: ${r.product}` : "Không có sản phẩm");
    const row = document.createElement("div");
    row.innerHTML = `${new Date(r.date).toLocaleString()} - ${r.employeeName} - Chi phí: ${r.expenseAmount.toLocaleString('vi-VN')} VND - ${productsText}`;
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
    .reduce((sum, r) => sum + (r.revenue || 0), 0));
  const expenseData = labels.map(d => reportData.filter(r => r.date.split("T")[0] === d)
    .reduce((sum, r) => sum + (r.expenseAmount || 0), 0));
  console.log("Generating business chart:", { labels, revenueData, expenseData });

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

// Profile Management
function uploadProfileImage() {
  const fileInput = document.getElementById("profile-image-upload");
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64String = e.target.result;
      localStorage.setItem(`profileImage_${currentEmployeeId}`, base64String);
      document.getElementById("profile-image").src = base64String;
    };
    reader.readAsDataURL(file);
  }
}

function updateProfileInfo() {
  const address = document.getElementById("profile-address").value.trim();
  const phone = document.getElementById("profile-phone").value.trim();
  const dob = document.getElementById("profile-dob").value;

  if (!address || !phone || !dob) {
    alert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }

  const employeeRef = employeesRef.child(currentEmployeeId);
  employeeRef.update({
    address: address,
    phone: phone,
    dob: dob
  }).then(() => {
    alert("Cập nhật thông tin thành công!");
    loadEmployeeData();
  }).catch(err => alert("Lỗi khi cập nhật: " + err.message));
}

function updateEmployeeName() {
  const newName = document.getElementById("employee-display-name").value.trim();
  if (!newName) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  employeesRef.child(currentEmployeeId).update({ name: newName })
    .then(() => {
      const emp = employeeData.find(e => e.id === currentEmployeeId);
      if (emp) emp.name = newName;
      else employeeData.push({ id: currentEmployeeId, name: newName });
      alert("Đổi tên thành công!");
      document.getElementById("employee-display-name").value = "";
      renderProfile();
      renderReports(); // Cập nhật tên trong báo cáo
    })
    .catch(err => alert("Lỗi khi đổi tên: " + err.message));
}

function renderProfile() {
  const emp = employeeData.find(e => e.id === currentEmployeeId);
  if (emp) {
    document.getElementById("employee-display-name").value = emp.name || "";
    document.getElementById("profile-address").value = emp.address || "";
    document.getElementById("profile-phone").value = emp.phone || "";
    document.getElementById("profile-dob").value = emp.dob || "";
    const savedImage = localStorage.getItem(`profileImage_${currentEmployeeId}`);
    if (savedImage) {
      document.getElementById("profile-image").src = savedImage;
    }
  }
}

function changeMonth(offset) {
  const now = new Date();
  let currentMonth = now.getMonth() + offset;
  let currentYear = now.getFullYear();
  if (currentMonth < 0) {
    currentMonth += 12;
    currentYear -= 1;
  } else if (currentMonth > 11) {
    currentMonth -= 12;
    currentYear += 1;
  }
  document.getElementById("current-month").textContent = `${currentYear}-${currentMonth + 1}`;
  renderSchedule();
}

function updateScheduleFromDate() {
  const date = document.getElementById("schedule-date-picker").value;
  if (date) {
    const [year, month] = date.split("-");
    document.getElementById("current-month").textContent = `${year}-${month}`;
    renderSchedule();
  }
}

function renderSchedule() {
  const [year, month] = document.getElementById("current-month").textContent.split("-");
  const daysInMonth = new Date(year, month - 1, 0).getDate();
  const container = document.getElementById("schedule-table");
  if (!container) return;

  container.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("table-style", "schedule-mobile");
  table.innerHTML = `
    <thead><tr><th>Ngày</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
    <tbody>
      ${Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const emp = employeeData.find(e => e.id === currentEmployeeId);
        const status = (emp && emp.schedule && emp.schedule[day]) || "Làm";
        return `
          <tr>
            <td>${day}</td>
            <td>${status}</td>
            <td><button onclick="handleDayClick(${day}, '${status}')">Chọn</button></td>
          </tr>`;
      }).join("")}
    </tbody>`;
  container.appendChild(table);
}

function handleDayClick(day, status) {
  const options = ["Off", "Tăng ca", "Đổi ca"];
  const newStatus = prompt("Chọn trạng thái:", options.join(", ")) || status;
  if (options.includes(newStatus)) {
    if (newStatus === "Off" && checkOffConflict(day)) {
      alert("Ngày nghỉ đã bị trùng, vui lòng chọn ngày khác hoặc gửi đề xuất đổi ca!");
    } else {
      updateSchedule(day, newStatus);
      if (newStatus === "Đổi ca") {
        const targetEmp = prompt("Nhập ID nhân viên muốn đổi ca:");
        if (targetEmp && employeeData.some(e => e.id === targetEmp)) {
          sendSwapRequest(targetEmp, day);
        } else {
          alert("ID nhân viên không hợp lệ!");
        }
      } else {
        sendApprovalRequest(day, newStatus);
      }
    }
  }
}

function checkOffConflict(day) {
  return employeeData.some(emp => emp.id !== currentEmployeeId && emp.schedule && emp.schedule[day] === "Off");
}

function updateSchedule(day, status) {
  const empRef = employeesRef.child(currentEmployeeId).child("schedule");
  empRef.update({ [day]: status });
}

function sendApprovalRequest(day, status) {
  advancesRef.push({
    employeeId: currentEmployeeId,
    type: "schedule_change",
    day: day,
    status: status,
    requestTime: new Date().toISOString(),
    approvalStatus: "pending"
  }).then(() => console.log("Gửi yêu cầu duyệt lịch thành công"));
}

function sendSwapRequest(targetEmpId, day) {
  advancesRef.push({
    employeeId: currentEmployeeId,
    targetEmpId: targetEmpId,
    type: "swap_request",
    day: day,
    requestTime: new Date().toISOString(),
    approvalStatus: "pending"
  }).then(() => console.log("Gửi đề xuất đổi ca thành công"));
}

function renderActivityHistory() {
  const container = document.getElementById("activity-history");
  if (!container) return;
  const empActivities = reportData.filter(r => r.employeeId === currentEmployeeId)
    .map(r => `Báo cáo ngày ${new Date(r.date).toLocaleDateString()}`);
  const advanceActivities = advanceRequests.filter(a => a.employeeId === currentEmployeeId)
    .map(a => `Yêu cầu tạm ứng ${a.amount.toLocaleString('vi-VN')} VND - ${a.approvalStatus || "pending"}`);
  const approvalActivities = advanceRequests.filter(a => employeeData.some(e => e.id === a.employeeId && e.role === "manager"))
    .map(a => `Duyệt yêu cầu của ${employeeData.find(e => e.id === a.employeeId)?.name} - ${a.approvalStatus || "pending"}`);
  container.innerHTML = `
    <h4>Hoạt động của bạn:</h4>
    <ul>${empActivities.map(a => `<li>${a}</li>`).join("")}</ul>
    <h4>Yêu cầu tạm ứng:</h4>
    <ul>${advanceActivities.map(a => `<li>${a}</li>`).join("")}</ul>
    <h4>Hoạt động quản lý (nếu có):</h4>
    <ul>${approvalActivities.map(a => `<li>${a}</li>`).join("")}</ul>`;
}

// Initialize Firebase Listeners
function loadFirebaseData() {
  if (isFirebaseInitialized) return;
  console.log("Initializing Firebase listeners");

  inventoryRef.on("value", snapshot => {
    inventoryData = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderInventory();
    renderReportProductList();
  }, err => console.error("Error fetching inventory data:", err));

  reportsRef.on("value", snapshot => {
    reportData = snapshot.exists() ? Object.values(snapshot.val()) : [];
    expenseNotes = reportData.filter(r => r.expenseNote).map(r => ({ reportId: r.id, note: r.expenseNote }));
    renderReports();
    renderExpenseSummary();
    renderActivityHistory();
  }, err => console.error("Error fetching reports data:", err));

  employeesRef.on("value", snapshot => {
    employeeData = snapshot.exists() ? Object.values(snapshot.val()) : [];
    if (employeeData.length === 0 && currentEmployeeId) {
      employeesRef.child(currentEmployeeId).set({
        name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0] || 'Nhân viên',
        email: auth.currentUser.email,
        active: true,
        role: 'employee',
        dailyWage: 0,
        allowance: 0,
        otherFee: 0,
        workdays: 26,
        offdays: 0,
        address: "",
        phone: "",
        dob: ""
      }).then(() => console.log("Đã thêm nhân viên mới vào Firebase:", currentEmployeeId));
    }
    renderProfile();
    renderSchedule();
    renderSalarySummary();
    renderSalaryComparison();
    renderEmployeeList();
    renderAdvanceApprovalList();
  }, err => console.error("Error fetching employees data:", err));

  advancesRef.on("value", snapshot => {
    advanceRequests = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderAdvanceHistory();
    renderAdvanceApprovalList();
    renderSalarySummary();
    renderActivityHistory();
  }, err => console.error("Error fetching advances data:", err));

  messagesRef.child("group").on("value", snapshot => {
    messages.group = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderChat("group");
  }, err => console.error("Error fetching group messages:", err));

  messagesRef.child("manager").on("value", snapshot => {
    messages.manager = snapshot.exists() ? Object.values(snapshot.val()) : [];
    renderChat("manager");
  }, err => console.error("Error fetching manager messages:", err));

  isFirebaseInitialized = true;
}

// Auth State
auth.onAuthStateChanged(user => {
  if (user) {
    currentEmployeeId = user.uid;
    document.getElementById("login-page").style.display = "none";
    document.getElementById("main-page").style.display = "block";
    openTabBubble('profile');
    loadFirebaseData();
  } else {
    currentEmployeeId = null;
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("main-page").style.display = "none";
  }
});
