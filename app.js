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
function updateEmployeeInfo() {
  const user = auth.currentUser;
  if (!user) {
    alert("Vui lòng đăng nhập để cập nhật thông tin!");
    return;
  }

  const nameInput = document.getElementById("personal-employee-name").value.trim();
  const addressInput = document.getElementById("employee-address").value.trim();
  const phoneInput = document.getElementById("employee-phone").value.trim();
  const noteInput = document.getElementById("employee-note").value.trim();

  if (!nameInput) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  const employeeRef = employeesRef.child(user.uid);
  employeeRef.update({
    name: nameInput,
    address: addressInput || "",
    phone: phoneInput || "",
    note: noteInput || "",
    updatedAt: new Date().toISOString()
  })
  .then(() => {
    alert("Cập nhật thông tin thành công!");
  })
  .catch(error => {
    console.error("Lỗi khi cập nhật thông tin:", error);
    alert("Có lỗi xảy ra khi cập nhật thông tin!");
  });
}

  const employeeRef = employeesRef.child(user.uid);
  employeeRef.update({
    name: nameInput,
    address: addressInput || "",
    phone: phoneInput || "",
    note: noteInput || "",
    updatedAt: new Date().toISOString()
  })
  .then(() => {
    alert("Cập nhật thông tin thành công!");
  })
  .catch(error => {
    console.error("Lỗi khi cập nhật thông tin:", error);
    alert("Có lỗi xảy ra khi cập nhật thông tin!");
  });
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
  if (tabId === "revenue-expense") {
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
  const closingBalance = closingBalanceEl.value ? parseFloat(closingBalanceEl.value) : null; // Lưu null nếu không nhập
  const { money: expenseAmount, note: expenseNote } = parseEntry(expenseInput);

  if (openingBalance === 0 && expenseAmount === 0 && revenue === 0 && closingBalance === null && Object.keys(productClickCounts).length === 0) {
    alert("Vui lòng nhập ít nhất một thông tin: số dư đầu kỳ, chi phí, doanh thu, số dư cuối kỳ, hoặc xuất hàng!");
    return;
  }

  // Tính số tiền còn lại
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
    // Ưu tiên lấy tên từ employeeData
    const employee = employeeData.find(e => e.id === currentEmployeeId);
    const employeeName = employee ? employee.name : 
                        (auth.currentUser.displayName || auth.currentUser.email.split('@')[0] || 'Nhân viên');

    if (!employee) {
      console.warn("Không tìm thấy nhân viên trong employeeData:", {
        currentEmployeeId,
        employeeDataLength: employeeData.length,
        employeeDataIds: employeeData.map(e => e.id)
      });
    }

    const reportData = {
      date: new Date().toISOString(),
      employeeId: currentEmployeeId,
      employeeName: employeeName,
      openingBalance,
      expenseAmount,
      expenseNote: expenseNote || "Không có",
      revenue,
      closingBalance, // Lưu null nếu không nhập
      remaining,
      products: productsReported
    };

    // Log để kiểm tra dữ liệu
    console.log("Gửi báo cáo:", {
      openingBalance,
      revenue,
      expenseAmount,
      closingBalance,
      remaining,
      productsReported
    });

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
    remaining: report.openingBalance + report.revenue - newAmount - report.closingBalance
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
    remaining: report.openingBalance + report.revenue - 0 - report.closingBalance
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
      // Cập nhật nút lọc
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(singleDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = reportData.filter(r => {
        const reportDate = new Date(r.date).getTime();
        return reportDate >= start && reportDate < end;
      });
      // Cập nhật nút lọc
      document.getElementById("filter-report-btn").textContent = `Lọc: ${new Date(startDate).toLocaleDateString('vi-VN')} - ${new Date(endDate).toLocaleDateString('vi-VN')}`;
      renderFilteredReports(filteredReports, null, startDate, endDate);
    } else {
      alert("Vui lòng chọn một ngày hoặc khoảng thời gian!");
      return;
    }

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

function renderFilteredReports(filteredReports, selectedDate = null, startDate = null, endDate = null) {
  const reportContainer = document.getElementById("shared-report-table");
  const productContainer = document.getElementById("report-product-table");
  if (!reportContainer || !productContainer) {
    console.error("Report table element not found!");
    return;
  }
  reportContainer.innerHTML = "";
  productContainer.innerHTML = "";

  // Xác định ngày hiện tại hoặc ngày được chọn
  const today = new Date().toISOString().split("T")[0];
  const displayDate = selectedDate || (startDate && endDate ? `${startDate} - ${endDate}` : today);

  if (filteredReports.length === 0) {
    reportContainer.innerHTML = `<p>Chưa có báo cáo thu chi trong ${displayDate}.</p>`;
    productContainer.innerHTML = `<p>Chưa có báo cáo xuất hàng trong ${displayDate}.</p>`;
    return;
  }

  const sortedReports = filteredReports.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Lọc báo cáo có thông tin tài chính
  const financeReports = sortedReports.filter(r => 
    r.openingBalance !== 0 || r.revenue !== 0 || r.expenseAmount !== 0 || r.closingBalance !== null
  );

  // Trạng thái mở rộng
  let isExpandedFinance = false;
  let isExpandedProduct = false;

  // Hàm render bảng thu chi
  const renderFinanceTable = () => {
    const displayReports = isExpandedFinance ? financeReports : financeReports.slice(0, 3);
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
        ${displayReports.map((r, index) => `
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
    reportContainer.innerHTML = `<h3>Danh sách Báo cáo Thu Chi (${displayDate})</h3>`;
    reportContainer.appendChild(reportTable);

    // Nút Xem thêm
    if (financeReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedFinance ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => {
        isExpandedFinance = !isExpandedFinance;
        renderFinanceTable();
      };
      reportContainer.appendChild(expandBtn);
    }
  };

  // Hàm render bảng xuất hàng
  const renderProductTable = () => {
    const productReports = sortedReports.flatMap((r, index) => 
      Array.isArray(r.products) && r.products.length > 0 
        ? r.products.map(p => {
            const inventoryItem = inventoryData.find(item => item.id === p.productId);
            return {
              index: index + 1,
              reportId: r.id,
              employeeName: r.employeeName,
              productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định",
              quantity: p.quantity,
              productId: p.productId
            };
          })
        : []
    );

    const displayProducts = isExpandedProduct ? productReports : productReports.slice(0, 3);
    const productTable = document.createElement("table");
    productTable.classList.add("table-style");
    productTable.innerHTML = `
      <thead>
        <tr><th>STT</th><th>Tên NV</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Hành động</th></tr>
      </thead>
      <tbody>
        ${displayProducts.map(p => `
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
    productContainer.innerHTML = `<h3>Danh sách Báo cáo Xuất Hàng (${displayDate})</h3>`;
    productContainer.appendChild(productTable);

    // Nút Xem thêm
    if (productReports.length > 3) {
      const expandBtn = document.createElement("button");
      expandBtn.textContent = isExpandedProduct ? "Thu gọn" : "Xem thêm";
      expandBtn.className = "expand-btn";
      expandBtn.onclick = () => {
        isExpandedProduct = !isExpandedProduct;
        renderProductTable();
      };
      productContainer.appendChild(expandBtn);
    }
  };

  // Render bảng
  renderFinanceTable();
  renderProductTable();

  // Tổng hợp thu chi
  const totalOpeningBalance = sortedReports.reduce((sum, r) => sum + (r.openingBalance || 0), 0);
  const totalRevenue = sortedReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalExpense = sortedReports.reduce((sum, r) => sum + (r.expenseAmount || 0), 0);
  const totalClosingBalance = sortedReports.reduce((sum, r) => sum + (r.closingBalance || 0), 0);
  const finalBalance = totalOpeningBalance + totalRevenue - totalExpense - totalClosingBalance;

  const totalReportDiv = document.createElement("div");
  totalReportDiv.classList.add("report-total");
  totalReportDiv.innerHTML = `
    <strong>Tổng (${displayDate}):</strong><br>
    Số dư đầu kỳ: ${totalOpeningBalance.toLocaleString('vi-VN')} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND<br>
    Chi phí: ${totalExpense.toLocaleString('vi-VN')} VND<br>
    Số dư cuối kỳ: ${totalClosingBalance.toLocaleString('vi-VN')} VND<br>
    Còn lại: ${finalBalance.toLocaleString('vi-VN')} VND
  `;
  reportContainer.appendChild(totalReportDiv);

  // Tổng hợp xuất hàng
  const productReports = sortedReports.flatMap(r => 
    Array.isArray(r.products) ? r.products.map(p => {
      const inventoryItem = inventoryData.find(item => item.id === p.productId);
      return {
        productName: inventoryItem ? inventoryItem.name : "Sản phẩm không xác định",
        quantity: p.quantity
      };
    }) : []
  );

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
    <strong>Tổng xuất kho (${displayDate}):</strong> ${totalProductText || "Không có"}
  `;
  productContainer.appendChild(totalProductDiv);
}

function renderReports() {
  renderFilteredReports(reportData);
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
  const user = auth.currentUser;
  const personalInfoDiv = document.getElementById("personal-info");
  if (!personalInfoDiv || !user) return;

  const employee = employeeData.find(emp => emp.id === user.uid);
  if (employee) {
    document.getElementById("personal-employee-name").value = employee.name || "";
    document.getElementById("employee-address").value = employee.address || "";
    document.getElementById("employee-phone").value = employee.phone || "";
    document.getElementById("employee-note").value = employee.note || "";
    document.getElementById("advance-amount").value = "";
  }
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

// Initialize Firebase Listeners (phần inventoryRef được cập nhật)
function loadFirebaseData() {
  console.log("Initializing Firebase listeners");

  // Lắng nghe inventory
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const product = { id: child.key, ...child.val() };
        console.log("Fetched product from Firebase:", product);
        inventoryData.push(product);
      });
    }
    console.log("Updated inventoryData:", inventoryData);
    renderInventory();
    renderReportProductList();
  }, err => {
    console.error("Error fetching inventory data:", err);
  });

  // Lắng nghe reports
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
    }
    console.log("Updated reportData:", reportData);
    console.log("Updated expenseNotes:", expenseNotes);
    const today = new Date().toISOString().split("T")[0];
    const todayReports = reportData.filter(r => r.date.split('T')[0] === today);
    renderFilteredReports(todayReports, today);
    renderExpenseSummary();
  }, err => {
    console.error("Error fetching reports data:", err);
  });

  // Lắng nghe employees
  employeesRef.on("value", snapshot => {
    employeeData = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const employee = { id: child.key, ...child.val() };
        console.log("Fetched employee from Firebase:", employee);
        employeeData.push(employee);
      });
    }
    console.log("Updated employeeData:", employeeData);
    renderEmployeeList();
    renderSalarySummary();
  }, err => {
    console.error("Error fetching employees data:", err);
  });

  // Lắng nghe advances
  advancesRef.on("value", snapshot => {
    advanceRequests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const advance = { id: child.key, ...child.val() };
        console.log("Fetched advance from Firebase:", advance);
        advanceRequests.push(advance);
      });
    }
    console.log("Updated advanceRequests:", advanceRequests);
    renderAdvanceHistory();
    renderAdvanceApprovalList();
  }, err => {
    console.error("Error fetching advances data:", err);
  });

  // Lắng nghe messages
  messagesRef.child("group").on("value", snapshot => {
    messages.group = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const message = child.val();
        console.log("Fetched group message:", message);
        messages.group.push(message);
      });
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
    }
    console.log("Updated manager messages:", messages.manager);
    renderChat("manager");
  }, err => {
    console.error("Error fetching manager messages:", err);
  });

  // Đảm bảo nhân viên mới được thêm và cập nhật employeeData
  auth.onAuthStateChanged(user => {
    if (user) {
      const employeeRef = employeesRef.child(user.uid);
      employeeRef.once("value").then(snapshot => {
        if (!snapshot.exists()) {
          const newEmployee = {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            active: true,
            dailyWage: 0,
            allowance: 0,
            otherFees: 0,
            address: "",
            phone: "",
            note: "",
            createdAt: new Date().toISOString()
          };
          employeeRef.set(newEmployee).then(() => {
            console.log("Đã thêm nhân viên mới vào Firebase:", user.uid);
            employeeData.push({ id: user.uid, ...newEmployee });
            renderEmployeeList();
          });
        }
      });
    }
  });
}


// Update employee display name
function updateEmployeeName() {
  const displayNameInput = document.getElementById("employee-display-name");
  if (!displayNameInput) {
    alert("Lỗi: Không tìm thấy trường nhập tên hiển thị!");
    return;
  }

  const newName = displayNameInput.value.trim();
  if (!newName) {
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  if (!currentEmployeeId) {
    alert("Lỗi: Không tìm thấy ID nhân viên!");
    return;
  }

  // Update name in Firebase
  employeesRef.child(currentEmployeeId).update({ name: newName })
    .then(() => {
      // Update local employeeData
      const employee = employeeData.find(e => e.id === currentEmployeeId);
      if (employee) {
        employee.name = newName;
      } else {
        employeeData.push({ id: currentEmployeeId, name: newName });
      }
      alert("Cập nhật tên hiển thị thành công!");
      displayNameInput.value = "";
      renderReports(); // Refresh reports to show updated name
    })
    .catch(err => alert("Lỗi khi cập nhật tên: " + err.message));
}
