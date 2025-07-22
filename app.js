
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

// Hàm parseEntry (giữ nguyên)
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

// Hàm khởi tạo Firebase listeners (sửa để trả về Promise)
function loadFirebaseData() {
  if (isFirebaseInitialized) {
    console.log("Firebase already initialized, skipping loadFirebaseData");
    return Promise.resolve();
  }

  console.log("Initializing Firebase listeners");
  isFirebaseInitialized = true;

  return new Promise((resolve, reject) => {
    employeesRef.once(
      "value",
      (snapshot) => {
        employeeData = snapshot.exists()
          ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
          : [];
        if (employeeData.length === 0 && currentEmployeeId && auth.currentUser) {
          const newEmployee = {
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
          };
          employeesRef
            .child(currentEmployeeId)
            .set(newEmployee)
            .then(() => {
              console.log("Added new employee to Firebase:", currentEmployeeId);
              employeeData.push({ id: currentEmployeeId, ...newEmployee });
              loadOtherFirebaseData();
              resolve();
            })
            .catch((err) => {
              console.error("Error adding new employee:", err);
              reject(err);
            });
        } else {
          loadOtherFirebaseData();
          resolve();
        }
      },
      (err) => {
        console.error("Error fetching employees data:", err);
        isFirebaseInitialized = false;
        reject(err);
      }
    );
  });
}

// Hàm tải các dữ liệu Firebase khác
function loadOtherFirebaseData() {
  inventoryRef.on(
    "value",
    (snapshot) => {
      inventoryData = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      renderInventory();
      renderReportProductList();
    },
    (err) => console.error("Error fetching inventory data:", err)
  );

  reportsRef.on(
    "value",
    (snapshot) => {
      reportData = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      expenseNotes = reportData
        .filter((r) => r.expenseNote)
        .map((r) => ({ reportId: r.id, note: r.expenseNote }));
      renderReports();
      renderExpenseSummary();
    },
    (err) => console.error("Error fetching reports data:", err)
  );

  advancesRef.on(
    "value",
    (snapshot) => {
      advanceRequests = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      renderAdvanceHistory();
      renderAdvanceApprovalList();
    },
    (err) => console.error("Error fetching advances data:", err)
  );

  messagesRef.child("group").on(
    "value",
    (snapshot) => {
      messages.group = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      renderChat("group");
    },
    (err) => console.error("Error fetching group messages:", err)
  );

  messagesRef.child("manager").on(
    "value",
    (snapshot) => {
      messages.manager = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }))
        : [];
      renderChat("manager");
    },
    (err) => console.error("Error fetching manager messages:", err)
  );
}

// Hàm xử lý trạng thái xác thực (sửa để chờ loadFirebaseData)
auth.onAuthStateChanged((user) => {
  const loginPage = document.getElementById("login-page");
  const mainPage = document.getElementById("main-page");
  if (!loginPage || !mainPage) {
    console.error("Login or main page element not found");
    alert("Lỗi: Không tìm thấy trang đăng nhập hoặc trang chính!");
    return;
  }
  if (user) {
    currentEmployeeId = user.uid;
    console.log("User logged in, ID:", currentEmployeeId);
    loginPage.style.display = "none";
    mainPage.style.display = "block";
    ensureProfileElements();
    loadFirebaseData()
      .then(() => {
        console.log("loadFirebaseData completed, rendering profile");
        renderProfile();
        renderAdvanceHistory();
        renderSalarySummary();
        openTabBubble("profile");
      })
      .catch((error) => {
        console.error("Error loading Firebase data:", error);
        alert("Lỗi tải dữ liệu: " + error.message);
      });
  } else {
    currentEmployeeId = null;
    console.log("No user logged in, showing login page");
    loginPage.style.display = "flex";
    mainPage.style.display = "none";
    isFirebaseInitialized = false;
  }
});

// Hàm đảm bảo các phần tử HTML cho thông tin cá nhân tồn tại
function ensureProfileElements() {
  const mainPage = document.getElementById("main-page");
  if (!mainPage) {
    console.error("Main page not found, cannot create profile elements");
    return;
  }

  const profileTab = document.getElementById("profile");
  if (!profileTab) {
    console.warn("Profile tab not found, creating one");
    const profileDiv = document.createElement("div");
    profileDiv.id = "profile";
    profileDiv.classList.add("tabcontent");
    mainPage.appendChild(profileDiv);
  }

  const profileContainer = document.getElementById("profile");
  if (!document.getElementById("employee-display-name")) {
    console.warn("Profile elements not found, creating them");
    profileContainer.innerHTML = `
      <h2>Thông tin Cá nhân</h2>
      <div class="profile-section">
        <img id="profile-image" src="https://placehold.co/100x100" alt="Avatar">
        <input type="file" id="profile-image-upload" accept="image/*" onchange="uploadProfileImage()">
        <input id="employee-display-name" placeholder="Tên hiển thị">
        <button onclick="updateEmployeeName()">Lưu tên</button>
        <input id="profile-address" placeholder="Địa chỉ">
        <input id="profile-phone" placeholder="Số điện thoại">
        <input id="profile-dob" type="date" placeholder="Ngày sinh">
        <button onclick="updateProfileInfo()">Cập nhật thông tin</button>
        <h3>Yêu cầu tạm ứng</h3>
        <input type="number" id="advance-amount" placeholder="Số tiền (VND)">
        <input type="text" id="advance-reason" placeholder="Lý do">
        <button onclick="requestAdvance()">Gửi yêu cầu</button>
        <h3>Lương & Ngày công</h3>
        <div id="salary-summary"></div>
        <div id="advance-history"></div>
      </div>
    `;
    console.log("Created profile elements");
  }
}

// Hàm hiển thị thông tin cá nhân
function renderProfile() {
  if (!currentEmployeeId) {
    console.error("No user logged in for profile rendering");
    alert("Lỗi: Vui lòng đăng nhập lại!");
    return;
  }

  ensureProfileElements();

  const nameInput = document.getElementById("employee-display-name");
  const addressInput = document.getElementById("profile-address");
  const phoneInput = document.getElementById("profile-phone");
  const dobInput = document.getElementById("profile-dob");
  const profileImage = document.getElementById("profile-image");

  if (!nameInput || !addressInput || !phoneInput || !dobInput || !profileImage) {
    console.error("Profile input/image elements not found");
    alert("Lỗi: Không tìm thấy các trường nhập hồ sơ!");
    return;
  }

  const emp = employeeData.find((e) => e.id === currentEmployeeId);
  if (emp) {
    nameInput.value = emp.name || "";
    addressInput.value = emp.address || "";
    phoneInput.value = emp.phone || "";
    dobInput.value = emp.dob || "";
    const savedImage = localStorage.getItem(`profileImage_${currentEmployeeId}`);
    profileImage.src = savedImage || "https://placehold.co/100x100";
    console.log("Rendered profile for user:", currentEmployeeId, emp);
  } else {
    console.warn("No employee data for user:", currentEmployeeId);
    nameInput.value = auth.currentUser?.displayName || auth.currentUser?.email.split("@")[0] || "";
    addressInput.value = "";
    phoneInput.value = "";
    dobInput.value = "";
    profileImage.src = "https://placehold.co/100x100";
  }
}

// Hàm cập nhật thông tin cá nhân
function updateProfileInfo() {
  const address = document.getElementById("profile-address")?.value.trim();
  const phone = document.getElementById("profile-phone")?.value.trim();
  const dob = document.getElementById("profile-dob")?.value;

  if (!address || !phone || !dob) {
    console.error("Missing profile info:", { address, phone, dob });
    alert("Vui lòng nhập đầy đủ thông tin: địa chỉ, số điện thoại, ngày sinh!");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    console.error("Invalid phone number:", phone);
    alert("Số điện thoại phải có 10 chữ số!");
    return;
  }

  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
    console.error("Invalid date of birth:", dob);
    alert("Ngày sinh không hợp lệ!");
    return;
  }

  const employeeRef = employeesRef.child(currentEmployeeId);
  employeeRef
    .update({
      address: address,
      phone: phone,
      dob: dob,
    })
    .then(() => {
      console.log("Profile info updated successfully:", { address, phone, dob });
      alert("Cập nhật thông tin cá nhân thành công!");
      const empIndex = employeeData.findIndex((e) => e.id === currentEmployeeId);
      if (empIndex !== -1) {
        employeeData[empIndex] = { ...employeeData[empIndex], address, phone, dob };
      } else {
        employeeData.push({ id: currentEmployeeId, address, phone, dob });
      }
      renderProfile();
    })
    .catch((err) => {
      console.error("Error updating profile info:", err);
      alert("Lỗi khi cập nhật thông tin: " + err.message);
    });
}

// Hàm cập nhật tên nhân viên (sửa để làm mới giao diện)
function updateEmployeeName() {
  const displayNameInput = document.getElementById("employee-display-name");
  if (!displayNameInput) {
    console.error("Display name input not found");
    alert("Lỗi: Không tìm thấy trường nhập tên hiển thị!");
    return;
  }

  const newName = displayNameInput.value.trim();
  if (!newName) {
    console.error("Missing display name");
    alert("Vui lòng nhập tên hiển thị!");
    return;
  }

  if (!currentEmployeeId) {
    console.error("No current employee ID");
    alert("Lỗi: Không tìm thấy ID nhân viên!");
    return;
  }

  employeesRef
    .child(currentEmployeeId)
    .update({ name: newName })
    .then(() => {
      console.log("Employee name updated successfully:", newName);
      const empIndex = employeeData.findIndex((e) => e.id === currentEmployeeId);
      if (empIndex !== -1) {
        employeeData[empIndex].name = newName;
      } else {
        employeeData.push({ id: currentEmployeeId, name: newName });
      }
      alert("Cập nhật tên hiển thị thành công!");
      renderProfile();
      renderReports();
      renderEmployeeList();
    })
    .catch((err) => {
      console.error("Error updating employee name:", err);
      alert("Lỗi khi cập nhật tên: " + err.message);
    });
}

// Hàm tải ảnh đại diện
function uploadProfileImage() {
  const fileInput = document.getElementById("profile-image-upload");
  const file = fileInput?.files[0];
  if (!file) {
    console.error("No file selected for upload");
    alert("Vui lòng chọn một hình ảnh!");
    return;
  }

  if (!file.type.startsWith("image/")) {
    console.error("Invalid file type:", file.type);
    alert("Vui lòng chọn file hình ảnh (jpg, png, v.v.)!");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    console.error("File size too large:", file.size);
    alert("Hình ảnh quá lớn, vui lòng chọn file nhỏ hơn 5MB!");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64String = e.target.result;
    localStorage.setItem(`profileImage_${currentEmployeeId}`, base64String);
    document.getElementById("profile-image").src = base64String;
    console.log("Profile image uploaded successfully for user:", currentEmployeeId);
    alert("Tải ảnh đại diện thành công!");
  };
  reader.onerror = function (err) {
    console.error("Error reading file:", err);
    alert("Lỗi khi tải ảnh: " + err.message);
  };
  reader.readAsDataURL(file);
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
    .then((user) => {
      currentEmployeeId = user.user.uid;
      console.log("Login successful, user ID:", currentEmployeeId);
      document.getElementById("login-page").style.display = "none";
      document.getElementById("main-page").style.display = "block";
      openTabBubble("profile");
      loadFirebaseData();
    })
    .catch((err) => {
      console.error("Login error:", err.message);
      alert("Lỗi đăng nhập: " + err.message);
    });
}

function logout() {
  console.log("Logging out user:", currentEmployeeId);
  auth.signOut()
    .then(() => {
      currentEmployeeId = null;
      console.log("Logout successful");
      document.getElementById("login-page").style.display = "flex";
      document.getElementById("main-page").style.display = "none";
    })
    .catch((err) => {
      console.error("Logout error:", err.message);
      alert("Lỗi đăng xuất: " + err.message);
    });
}

// Floating Button Tabs
function toggleMenu() {
  const options = document.getElementById("float-options");
  console.log("Toggling menu, current display:", options.style.display);
  options.style.display = options.style.display === "flex" ? "none" : "flex";
}

function openTabBubble(tabId) {
  console.log("Opening tab:", tabId);
  const tabs = document.querySelectorAll(".tabcontent");
  tabs.forEach((t) => t.classList.remove("active"));
  const tab = document.getElementById(tabId);
  if (tab) {
    tab.classList.add("active");
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

  inventoryRef
    .push({ name, quantity, price })
    .then(() => {
      console.log("Product added successfully to Firebase:", { name, quantity, price });
      alert("Đã thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
    })
    .catch((err) => {
      console.error("Error adding product to Firebase:", err);
      alert("Lỗi khi thêm sản phẩm: " + err.message);
    });
}

function editInventory(id) {
  console.log("Editing product ID:", id);
  const product = inventoryData.find((p) => p.id === id);
  if (!product) {
    console.error("Product not found for ID:", id);
    alert("Sản phẩm không tồn tại!");
    return;
  }
  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Đơn giá:", product.price)) || product.price;
  console.log("Updating product:", { id, newName, newQty, newPrice });
  inventoryRef
    .child(id)
    .update({ name: newName, quantity: newQty, price: newPrice })
    .then(() => alert("Cập nhật sản phẩm thành công!"))
    .catch((err) => {
      console.error("Error updating product:", err);
      alert("Lỗi khi cập nhật sản phẩm: " + err.message);
    });
}

function deleteInventory(id) {
  console.log("Deleting product ID:", id);
  if (!confirm("Xóa sản phẩm này?")) return;
  inventoryRef
    .child(id)
    .remove()
    .then(() => {
      console.log("Product deleted:", id);
      alert("Đã xóa sản phẩm thành công!");
    })
    .catch((err) => {
      console.error("Error deleting product:", err);
      alert("Lỗi khi xóa sản phẩm: " + err.message);
    });
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
      ${inventoryData
        .map((item) => {
          console.log("Rendering product:", item);
          const total = item.quantity * item.price;
          return `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString("vi-VN")} VND</td>
          <td>${total.toLocaleString("vi-VN")} VND</td>
          <td>
            <button onclick="editInventory('${item.id}')">Sửa</button>
            <button onclick="deleteInventory('${item.id}')">Xóa</button>
          </td>
        </tr>`;
        })
        .join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3"><strong>Tổng tiền tồn kho:</strong></td><td><strong>${inventoryData
        .reduce((sum, item) => sum + item.quantity * item.price, 0)
        .toLocaleString("vi-VN")} VND</strong></td><td></td></tr>
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

  if (
    openingBalance === 0 &&
    expenseAmount === 0 &&
    revenue === 0 &&
    closingBalance === null &&
    Object.keys(productClickCounts).length === 0
  ) {
    alert(
      "Vui lòng nhập ít nhất một thông tin: số dư đầu kỳ, chi phí, doanh thu, số dư cuối kỳ, hoặc xuất hàng!"
    );
    return;
  }

  const remaining = openingBalance + revenue - expenseAmount - (closingBalance || 0);

  const productsReported = Object.keys(productClickCounts)
    .map((productId) => {
      const product = inventoryData.find((p) => p.id === productId);
      const quantity = productClickCounts[productId] || 0;
      if (quantity > 0 && product) {
        return { productId, name: product.name, quantity };
      }
      return null;
    })
    .filter((p) => p !== null);

  Promise.all(
    productsReported.map((p) => {
      const product = inventoryData.find((prod) => prod.id === p.productId);
      if (product && p.quantity > 0) {
        return inventoryRef.child(p.productId).update({ quantity: product.quantity - p.quantity });
      }
      return Promise.resolve();
    })
  )
    .then(() => {
      const employee = employeeData.find((e) => e.id === currentEmployeeId);
      const employeeName = employee
        ? employee.name
        : auth.currentUser.displayName || auth.currentUser.email.split("@")[0] || "Nhân viên";

      if (!employee) {
        console.warn("Không tìm thấy nhân viên trong employeeData:", {
          currentEmployeeId,
          employeeDataLength: employeeData.length,
          employeeDataIds: employeeData.map((e) => e.id),
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
        closingBalance,
        remaining,
        products: productsReported,
      };

      console.log("Gửi báo cáo:", {
        openingBalance,
        revenue,
        expenseAmount,
        closingBalance,
        remaining,
        productsReported,
      });

      reportsRef
        .push(reportData)
        .then((snap) => {
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
        .catch((err) => alert("Lỗi khi gửi báo cáo: " + err.message));
    })
    .catch((err) => alert("Lỗi khi cập nhật số lượng sản phẩm: " + err.message));
}

function editReportExpense(reportId) {
  const report = reportData.find((r) => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const newInput = prompt(
    "Chỉnh sửa nội dung chi phí (VD: 500k Mua nguyên liệu):",
    `${report.expenseAmount / 1000}k ${report.expenseNote}`
  );
  if (!newInput) return;
  const { money: newAmount, note: newNote } = parseEntry(newInput);
  reportsRef
    .child(reportId)
    .update({
      expenseAmount: newAmount,
      expenseNote: newNote || "Không có",
      remaining: report.openingBalance + report.revenue - newAmount - (report.closingBalance || 0),
    })
    .then(() => {
      expenseNotes = expenseNotes.map((note) =>
        note.reportId === reportId ? { ...note, note: newNote || "Không có" } : note
      );
      renderReports();
      alert("Đã cập nhật chi phí!");
    })
    .catch((err) => alert("Lỗi khi cập nhật chi phí: " + err.message));
}

function deleteReportExpense(reportId) {
  if (!confirm("Xóa nội dung chi phí này?")) return;
  const report = reportData.find((r) => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  reportsRef
    .child(reportId)
    .update({
      expenseAmount: 0,
      expenseNote: "Không có",
      remaining: report.openingBalance + report.revenue - 0 - (report.closingBalance || 0),
    })
    .then(() => {
      expenseNotes = expenseNotes.filter((note) => note.reportId !== reportId);
      renderReports();
      alert("Đã xóa chi phí!");
    })
    .catch((err) => alert("Lỗi khi xóa chi phí: " + err.message));
}

function deleteReportProduct(reportId, productId) {
  if (!confirm("Xóa sản phẩm xuất hàng này?")) return;
  const report = reportData.find((r) => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find((p) => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const updatedProducts = report.products.filter((p) => p.productId !== productId);
  const inventoryProduct = inventoryData.find((p) => p.id === productId);
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryProduct
      ? inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity })
      : Promise.resolve(),
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã xóa sản phẩm!");
    })
    .catch((err) => alert("Lỗi khi xóa sản phẩm: " + err.message));
}

function editReportProduct(reportId, productId) {
  const report = reportData.find((r) => r.id === reportId);
  if (!report) {
    alert("Báo cáo không tồn tại!");
    return;
  }
  const product = report.products.find((p) => p.productId === productId);
  if (!product) {
    alert("Sản phẩm không tồn tại trong báo cáo!");
    return;
  }
  const newQuantity = parseInt(prompt("Số lượng mới:", product.quantity));
  if (!newQuantity || newQuantity < 0) {
    alert("Số lượng không hợp lệ!");
    return;
  }
  const inventoryProduct = inventoryData.find((p) => p.id === productId);
  if (!inventoryProduct) {
    alert("Sản phẩm không tồn tại trong kho!");
    return;
  }
  if (newQuantity > inventoryProduct.quantity + product.quantity) {
    alert("Số lượng vượt quá tồn kho!");
    return;
  }
  const updatedProducts = report.products.map((p) =>
    p.productId === productId ? { ...p, quantity: newQuantity } : p
  );
  Promise.all([
    reportsRef.child(reportId).update({ products: updatedProducts }),
    inventoryRef.child(productId).update({ quantity: inventoryProduct.quantity + product.quantity - newQuantity }),
  ])
    .then(() => {
      renderReports();
      renderReportProductList();
      alert("Đã cập nhật sản phẩm!");
    })
    .catch((err) => alert("Lỗi khi cập nhật sản phẩm: " + err.message));
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
  inventoryData.forEach((item) => {
    const clickCount = productClickCounts[item.id] || 0;
    const button = document.createElement("button");
    button.classList.add("product-button");
    button.textContent = `${item.name}: ${clickCount}`;
    button.onclick = () => incrementProductCount(item.id);
    container.appendChild(button);
  });
}

function incrementProductCount(productId) {
  const product = inventoryData.find((p) => p.id === productId);
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
  overlay.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;";

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
      const selectedDate = new Date(singleDate).toISOString().split("T")[0];
      filteredReports = reportData.filter((r) => r.date.split("T")[0] === selectedDate);
    } else if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;
      filteredReports = reportData.filter((r) => {
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

  const financeReports = sortedReports.filter(
    (r) => r.openingBalance !== 0 || r.revenue !== 0 || r.expenseAmount !== 0 || r.closingBalance !== null
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
      ${financeReports
        .map(
          (r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.employeeName}</td>
          <td>${r.expenseAmount.toLocaleString("vi-VN")} VND (${r.expenseNote || "Không có"})</td>
          <td>
            <button onclick="editReportExpense('${r.id}')">Sửa</button>
            <button onclick="deleteReportExpense('${r.id}')">Xóa</button>
          </td>
        </tr>`
        )
        .join("")}
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
    Số dư đầu kỳ: ${totalOpeningBalance.toLocaleString("vi-VN")} VND<br>
    Doanh thu: ${totalRevenue.toLocaleString("vi-VN")} VND<br>
    Chi phí: ${totalExpense.toLocaleString("vi-VN")} VND<br>
    Số dư cuối kỳ: ${totalClosingBalance.toLocaleString("vi-VN")} VND<br>
    Còn lại: ${finalBalance.toLocaleString("vi-VN")} VND
  `;
  reportContainer.appendChild(totalReportDiv);

  const productReports = sortedReports.flatMap((r, index) =>
    Array.isArray(r.products) && r.products.length > 0
      ? r.products.map((p) => ({
          index: index + 1,
          reportId: r.id,
          employeeName: r.employeeName,
          productName: p.name,
          quantity: p.quantity,
          productId: p.productId,
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
      ${productReports
        .map(
          (p) => `
        <tr>
          <td>${p.index}</td>
          <td>${p.employeeName}</td>
          <td>${p.productName}</td>
          <td>${p.quantity}</td>
          <td>
            <button onclick="editReportProduct('${p.reportId}', '${p.productId}')">Sửa</button>
            <button onclick="deleteReportProduct('${p.reportId}', '${p.productId}')">Xóa</button>
          </td>
        </tr>`
        )
        .join("")}
    </tbody>`;
  productContainer.appendChild(productTable);

  const totalProductSummary = productReports.reduce((acc, p) => {
    acc[p.productName] = (acc[p.productName] || 0) + p.quantity;
    return acc;
  }, {});
  const totalProductText = Object.entries(totalProductSummary)
    .map(([name, qty]) => {
      const inventoryItem = inventoryData.find((item) => item.name === name);
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

  employeesRef
    .push({ name, dailyWage, allowance, otherFee, workdays: 26, offdays: 0, address: "", phone: "", dob: "" })
    .then(() => {
      console.log("Employee added successfully");
      alert("Đã thêm nhân viên!");
    })
    .catch((err) => {
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
      ${employeeData
        .map(
          (emp) => `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.dailyWage.toLocaleString("vi-VN")}</td>
          <td>${emp.allowance.toLocaleString("vi-VN")}</td>
          <td>${emp.otherFee.toLocaleString("vi-VN")}</td>
        </tr>`
        )
        .join("")}
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

  advancesRef
    .push({
      employeeId: currentEmployeeId,
      amount,
      reason,
      status: "pending",
      requestTime: new Date().toISOString(),
    })
    .then(() => {
      console.log("Advance request submitted successfully");
      alert("Đã gửi yêu cầu tạm ứng!");
      document.getElementById("advance-amount").value = "";
      document.getElementById("advance-reason").value = "";
    })
    .catch((err) => {
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
  const myAdvances = advanceRequests.filter((a) => a.employeeId === currentEmployeeId);
  console.log("Rendering advance history, total items:", myAdvances.length);

  if (myAdvances.length === 0) {
    container.innerHTML = "<p>Chưa có yêu cầu tạm ứng.</p>";
    console.log("No advance requests for user:", currentEmployeeId);
    return;
  }

  myAdvances.forEach((a) => {
    const div = document.createElement("div");
    div.innerHTML = `Tạm ứng: ${a.amount.toLocaleString("vi-VN")} VND - ${a.reason} - Trạng thái: ${a.status}`;
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
  const pending = advanceRequests.filter(
    (a) => a.status === "pending" && employeeData.some((e) => e.id === currentEmployeeId && e.role === "manager")
  );
  console.log("Rendering advance approval list, total items:", pending.length);

  if (pending.length === 0) {
    container.innerHTML = "<p>Không có yêu cầu nào.</p>";
    console.log("No pending advance requests");
    return;
  }

  pending.forEach((a) => {
    const emp = employeeData.find((e) => e.id === a.employeeId) || { name: "Nhân viên" };
    const div = document.createElement("div");
    div.innerHTML = `
      ${emp.name}: ${a.amount.toLocaleString("vi-VN")} VND - ${a.reason}
      <button onclick="approveAdvance('${a.id}')">Duyệt</button>
      <button onclick="rejectAdvance('${a.id}')">Từ chối</button>`;
    container.appendChild(div);
  });
}

function approveAdvance(id) {
  console.log("Approving advance ID:", id);
  advancesRef
    .child(id)
    .update({ status: "approved" })
    .then(() => {
      console.log("Advance approved:", id);
      renderAdvanceApprovalList();
      renderSalarySummary();
    })
    .catch((err) => {
      console.error("Error approving advance:", err);
      alert("Lỗi khi duyệt yêu cầu: " + err.message);
    });
}

function rejectAdvance(id) {
  console.log("Rejecting advance ID:", id);
  advancesRef
    .child(id)
    .update({ status: "rejected" })
    .then(() => {
      console.log("Advance rejected:", id);
      renderAdvanceApprovalList();
    })
    .catch((err) => {
      console.error("Error rejecting advance:", err);
      alert("Lỗi khi từ chối yêu cầu: " + err.message);
    });
}

// Salary & Workdays
function calculateSalary(empId) {
  const emp = employeeData.find((e) => e.id === empId);
  if (!emp) {
    console.error("Employee not found for salary calculation:", empId);
    return 0;
  }
  const totalAdvance = advanceRequests
    .filter((a) => a.employeeId === empId && a.status === "approved")
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
  const emp = employeeData.find((e) => e.id === currentEmployeeId);
  if (!emp) {
    container.innerHTML = "<p>Chưa có dữ liệu nhân viên.</p>";
    console.error("No employee data for user:", currentEmployeeId);
    return;
  }
  const salary = calculateSalary(emp.id);
  container.innerHTML = `
    <p>Ngày công: ${emp.workdays}</p>
    <p>Ngày nghỉ: ${emp.offdays}</p>
    <p>Lương/ngày: ${emp.dailyWage.toLocaleString("vi-VN")} VND</p>
    <p>Phụ cấp: ${emp.allowance.toLocaleString("vi-VN")} VND</p>
    <p>Phí khác: ${emp.otherFee.toLocaleString("vi-VN")} VND</p>
    <p><strong>Tổng lương: ${salary.toLocaleString("vi-VN")} VND</strong></p>`;
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
  messagesRef
    .child("group")
    .push({ text: msg, time: new Date().toISOString(), senderId: currentEmployeeId })
    .then(() => {
      console.log("Group message sent successfully");
      document.getElementById("group-message").value = "";
    })
    .catch((err) => console.error("Error sending group message:", err));
}

function sendManagerMessage() {
  const msg = document.getElementById("manager-message").value.trim();
  if (!msg) {
    console.error("Empty manager message");
    return;
  }
  console.log("Sending manager message:", msg);
  messagesRef
    .child("manager")
    .push({ text: msg, time: new Date().toISOString(), senderId: currentEmployeeId })
    .then(() => {
      console.log("Manager message sent successfully");
      document.getElementById("manager-message").value = "";
    })
    .catch((err) => console.error("Error sending manager message:", err));
}

function renderChat(type) {
  const box = document.getElementById(type + "-chat");
  if (!box) {
    console.error("Chat box not found:", type);
    return;
  }
  box.innerHTML = "";
  console.log(`Rendering ${type} chat, total messages:`, messages[type].length);
  messages[type].forEach((m) => {
    const sender = employeeData.find((e) => e.id === m.senderId) || { name: "Nhân viên" };
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
  reportData
    .filter((r) => r.expenseAmount > 0)
    .forEach((r) => {
      const productsText = Array.isArray(r.products)
        ? r.products.length > 0
          ? r.products.map((p) => `${p.name}: ${p.quantity}`).join(", ")
          : "Không có sản phẩm"
        : r.product
        ? `Sản phẩm: ${r.product}`
        : "Không có sản phẩm";
      const row = document.createElement("div");
      row.innerHTML = `${new Date(r.date).toLocaleString()} - ${r.employeeName} - Chi phí: ${r.expenseAmount.toLocaleString(
        "vi-VN"
      )} VND - ${productsText}`;
      container.appendChild(row);
    });
}

function generateBusinessChart() {
  const ctx = document.getElementById("growth-chart");
  if (!ctx) {
    console.error("Chart canvas not found!");
    return;
  }
  const labels = [...new Set(reportData.map((r) => r.date.split("T")[0]))];
  const revenueData = labels.map((d) =>
    reportData.filter((r) => r.date.split("T")[0] === d).reduce((sum, r) => sum + (r.revenue || 0), 0)
  );
  const expenseData = labels.map((d) =>
    reportData.filter((r) => r.date.split("T")[0] === d).reduce((sum, r) => sum + (r.expenseAmount || 0), 0)
  );
  console.log("Generating business chart:", { labels, revenueData, expenseData });

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Doanh thu",
          data: revenueData,
          backgroundColor: "#28a745",
        },
        {
          label: "Chi phí",
          data: expenseData,
          backgroundColor: "#dc3545",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
      },
    },
  });
}
