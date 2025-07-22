/*********************************************
 * app.js - Test Kho & Báo cáo (Firebase)
 *********************************************/

// ===================== //
// Firebase Reference    //
// ===================== //
const inventoryRef = db.ref("test_inventory");
const reportsRef = db.ref("test_reports");

// ===================== //
// Biến cục bộ           //
// ===================== //
let inventoryData = [];
let reportData = [];
let selectedProductId = null;

// ===================== //
// 1. Lắng nghe dữ liệu  //
// ===================== //
function listenInventory() {
  inventoryRef.on("value", snapshot => {
    inventoryData = [];
    snapshot.forEach(child => {
      inventoryData.push({ id: child.key, ...child.val() });
    });
    renderInventory();
    renderReportProductList();
  });
}

function listenReports() {
  reportsRef.on("value", snapshot => {
    reportData = [];
    snapshot.forEach(child => {
      reportData.push({ id: child.key, ...child.val() });
    });
    renderReports();
  });
}

// ===================== //
// 2. Quản lý kho        //
// ===================== //
function addInventory() {
  const name = document.getElementById("product-name").value.trim();
  const quantity = parseInt(document.getElementById("product-quantity").value) || 0;
  const price = parseFloat(document.getElementById("product-price").value) || 0;

  if (!name || quantity <= 0 || price <= 0) {
    return alert("Vui lòng nhập đúng thông tin sản phẩm!");
  }

  inventoryRef.push({ name, quantity, price })
    .then(() => {
      alert("Thêm sản phẩm thành công!");
      document.getElementById("product-name").value = "";
      document.getElementById("product-quantity").value = "";
      document.getElementById("product-price").value = "";
    })
    .catch(err => alert("Lỗi thêm sản phẩm: " + err.message));
}

function editInventory(id) {
  const product = inventoryData.find(p => p.id === id);
  if (!product) return;

  const newName = prompt("Tên mới:", product.name) || product.name;
  const newQty = parseInt(prompt("Số lượng mới:", product.quantity)) || product.quantity;
  const newPrice = parseFloat(prompt("Giá mới:", product.price)) || product.price;

  inventoryRef.child(id).update({ name: newName, quantity: newQty, price: newPrice })
    .then(() => alert("Cập nhật sản phẩm thành công!"))
    .catch(err => alert("Lỗi cập nhật: " + err.message));
}

function deleteInventory(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) return;
  inventoryRef.child(id).remove()
    .then(() => alert("Xóa sản phẩm thành công!"))
    .catch(err => alert("Lỗi xóa: " + err.message));
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  if (!list) return;
  list.innerHTML = "";

  if (inventoryData.length === 0) {
    list.innerHTML = "<p>Chưa có sản phẩm nào.</p>";
    return;
  }

  inventoryData.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("inventory-item");
    div.innerHTML = `
      <span>${item.name} - SL: ${item.quantity} - Giá: ${item.price}</span>
      <div>
        <button onclick="editInventory('${item.id}')">Sửa</button>
        <button onclick="deleteInventory('${item.id}')">Xóa</button>
      </div>
    `;
    list.appendChild(div);
  });
}

// ===================== //
// 3. Báo cáo Thu Chi    //
// ===================== //
function renderReportProductList() {
  const container = document.getElementById("report-product-list");
  if (!container) return;
  container.innerHTML = "";

  inventoryData.forEach(item => {
    const btn = document.createElement("button");
    btn.textContent = `${item.name} (SL: ${item.quantity})`;
    btn.onclick = () => {
      selectedProductId = item.id;
      alert(`Chọn: ${item.name}`);
    };
    container.appendChild(btn);
  });
}

function submitReport() {
  if (!selectedProductId) return alert("Vui lòng chọn sản phẩm để xuất!");
  const product = inventoryData.find(p => p.id === selectedProductId);
  if (!product) return alert("Sản phẩm không tồn tại!");

  const reportQuantity = parseInt(document.getElementById("report-quantity").value) || 0;
  if (reportQuantity <= 0 || reportQuantity > product.quantity) {
    return alert("Số lượng xuất không hợp lệ!");
  }

  const revenue = parseFloat(document.getElementById("revenue").value) || 0;
  const expenseAmount = parseFloat(document.getElementById("expense-amount").value) || 0;
  const expenseInfo = document.getElementById("expense-info").value.trim();

  // Trừ tồn kho
  inventoryRef.child(product.id).update({
    quantity: product.quantity - reportQuantity
  });

  // Ghi báo cáo
  reportsRef.push({
    date: new Date().toISOString().split("T")[0],
    product: product.name,
    quantity: reportQuantity,
    revenue,
    expenseAmount,
    expenseInfo
  }).then(() => alert("Xuất kho & báo cáo thành công!"));
}

function renderReports() {
  const container = document.getElementById("report-list");
  if (!container) return;
  container.innerHTML = "";

  if (reportData.length === 0) {
    container.innerHTML = "<p>Chưa có báo cáo nào.</p>";
    return;
  }

  reportData.forEach(r => {
    const row = document.createElement("div");
    row.classList.add("report-item");
    row.innerHTML = `
      ${r.date} - SP: ${r.product} - SL: ${r.quantity} - DT: ${r.revenue} - CP: ${r.expenseAmount} - ${r.expenseInfo}
    `;
    container.appendChild(row);
  });
}

// ===================== //
// 4. Khởi tạo           //
// ===================== //
document.addEventListener("DOMContentLoaded", () => {
  listenInventory();
  listenReports();
});