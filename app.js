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
 * Quản lý kho (Sửa hàm addInventory)
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

// Chèn tiếp các phần khác nếu cần...
