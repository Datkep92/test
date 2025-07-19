import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmFpKa8TpDjo3pQADaTubgVpDPOi-FPXk",
  authDomain: "quanly-d7e54.firebaseapp.com",
  projectId: "quanly-d7e54",
  storageBucket: "quanly-d7e54.appspot.com",
  messagingSenderId: "482686011267",
  appId: "1:482686011267:web:f2fe9d400fe618487a98b6",
  measurementId: "G-G3H6MTCWCM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBox = document.getElementById("loginBox");
const mainApp = document.getElementById("mainApp");
const currentUserSpan = document.getElementById("currentUser");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const tabNguoiDung = document.getElementById("tabNguoiDung");
const expenseTableBody = document.querySelector("#expenseTable tbody");
const addExpenseBtn = document.getElementById("addExpenseBtn");
const shipmentTableBody = document.querySelector("#shipmentTable tbody");
const addShipmentBtn = document.getElementById("addShipmentBtn");
const revenueTableBody = document.querySelector("#revenueTable tbody");
const addRevenueBtn = document.getElementById("addRevenueBtn");
const inventoryTableBody = document.querySelector("#inventoryTable tbody");
const addInventoryBtn = document.getElementById("addInventoryBtn");
const userTableBody = document.querySelector("#userTable tbody");
const addUserBtn = document.getElementById("addUserBtn");
const notesTextarea = document.getElementById("notesTextarea");
const saveNotesBtn = document.getElementById("saveNotesBtn");
const dailyReportBtn = document.getElementById("dailyReportBtn");
const monthlyReportBtn = document.getElementById("monthlyReportBtn");
const printReportBtn = document.getElementById("printReportBtn");
const reportUser = document.getElementById("reportUser");
const reportCategory = document.getElementById("reportCategory");
const applyReportBtn = document.getElementById("applyReportBtn");

let currentUser = null;
let userRole = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginBox.classList.add("hidden");
    mainApp.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    currentUserSpan.innerText = user.email;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      userRole = userDoc.data().role;
      if (userRole === "manager") {
        tabNguoiDung.classList.remove("hidden");
        document.getElementById("nguoiDungContent").classList.remove("hidden");
      }
    }
    loadExpenses();
    loadShipments();
    loadRevenue();
    loadInventory();
    loadUsers();
    loadNotes();
    loadReportUsers();
  } else {
    currentUser = null;
    userRole = null;
    loginBox.classList.remove("hidden");
    mainApp.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
});

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value.trim());
  } catch (err) {
    console.error("Đăng nhập thất bại:", err.message);
    alert("🚫 Đăng nhập thất bại: " + err.message);
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

async function loadExpenses() {
  expenseTableBody.innerHTML = "<tr><td colspan='3'>⏳ Đang tải...</td></tr>";
  const q = query(collection(db, "expenses"), where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);
  let html = "";
  snapshot.forEach(doc => {
    const expense = doc.data();
    html += `<tr>
      <td>${expense.description}</td>
      <td>${expense.amount.toLocaleString("vi-VN")}₫</td>
      <td><button class="deleteBtn" data-id="${doc.id}" data-collection="expenses">Xóa</button></td>
    </tr>`;
  });
  expenseTableBody.innerHTML = html || "<tr><td colspan='3'>📭 Không có dữ liệu</td></tr>";
  bindDeleteButtons();
}

addExpenseBtn.onclick = async () => {
  const description = document.getElementById("expenseDescription").value.trim();
  const amount = parseInt(document.getElementById("expenseAmount").value.trim());
  if (!description || isNaN(amount)) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }
  const newExpense = {
    uid: currentUser.uid,
    description,
    amount,
    timestamp: serverTimestamp()
  };
  await addDoc(collection(db, "expenses"), newExpense);
  loadExpenses();
  document.getElementById("expenseDescription").value = "";
  document.getElementById("expenseAmount").value = "";
};

async function loadShipments() {
  shipmentTableBody.innerHTML = "<tr><td colspan='4'>⏳ Đang tải...</td></tr>";
  const q = query(collection(db, "shipments"), where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);
  let html = "";
  snapshot.forEach(doc => {
    const shipment = doc.data();
    html += `<tr>
      <td>${shipment.product}</td>
      <td>${shipment.quantity}</td>
      <td>${shipment.unit}</td>
      <td><button class="deleteBtn" data-id="${doc.id}" data-collection="shipments">Xóa</button></td>
    </tr>`;
  });
  shipmentTableBody.innerHTML = html || "<tr><td colspan='4'>📭 Không có dữ liệu</td></tr>";
  bindDeleteButtons();
}

addShipmentBtn.onclick = async () => {
  const product = document.getElementById("shipmentProduct").value.trim();
  const quantity = parseInt(document.getElementById("shipmentQuantity").value.trim());
  const unit = document.getElementById("shipmentUnit").value.trim();
  if (!product || isNaN(quantity) || !unit) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }
  const newShipment = {
    uid: currentUser.uid,
    product,
    quantity,
    unit,
    timestamp: serverTimestamp()
  };
  await addDoc(collection(db, "shipments"), newShipment);
  loadShipments();
  document.getElementById("shipmentProduct").value = "";
  document.getElementById("shipmentQuantity").value = "";
  document.getElementById("shipmentUnit").value = "";
};

async function loadRevenue() {
  revenueTableBody.innerHTML = "<tr><td colspan='3'>⏳ Đang tải...</td></tr>";
  const q = query(collection(db, "revenue"), where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);
  let html = "";
  snapshot.forEach(doc => {
    const revenue = doc.data();
    html += `<tr>
      <td>${revenue.description}</td>
      <td>${revenue.amount.toLocaleString("vi-VN")}₫</td>
      <td><button class="deleteBtn" data-id="${doc.id}" data-collection="revenue">Xóa</button></td>
    </tr>`;
  });
  revenueTableBody.innerHTML = html || "<tr><td colspan='3'>📭 Không có dữ liệu</td></tr>";
  bindDeleteButtons();
}

addRevenueBtn.onclick = async () => {
  const description = document.getElementById("revenueDescription").value.trim();
  const amount = parseInt(document.getElementById("revenueAmount").value.trim());
  if (!description || isNaN(amount)) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }
  const newRevenue = {
    uid: currentUser.uid,
    description,
    amount,
    timestamp: serverTimestamp()
  };
  await addDoc(collection(db, "revenue"), newRevenue);
  loadRevenue();
  document.getElementById("revenueDescription").value = "";
  document.getElementById("revenueAmount").value = "";
};

async function loadInventory() {
  inventoryTableBody.innerHTML = "<tr><td colspan='5'>⏳ Đang tải...</td></tr>";
  const q = query(collection(db, "inventory"), where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);
  let html = "";
  snapshot.forEach(doc => {
    const item = doc.data();
    html += `<tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${item.price.toLocaleString("vi-VN")}₫</td>
      <td><button class="deleteBtn" data-id="${doc.id}" data-collection="inventory">Xóa</button></td>
    </tr>`;
  });
  inventoryTableBody.innerHTML = html || "<tr><td colspan='5'>📭 Không có dữ liệu</td></tr>";
  bindDeleteButtons();
}

addInventoryBtn.onclick = async () => {
  const name = document.getElementById("inventoryName").value.trim();
  const quantity = parseInt(document.getElementById("inventoryQuantity").value.trim());
  const unit = document.getElementById("inventoryUnit").value.trim();
  const price = parseInt(document.getElementById("inventoryPrice").value.trim());
  if (!name || isNaN(quantity) || !unit || isNaN(price)) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }
  const newItem = {
    uid: currentUser.uid,
    name,
    quantity,
    unit,
    price,
    timestamp: serverTimestamp()
  };
  await addDoc(collection(db, "inventory"), newItem);
  loadInventory();
  document.getElementById("inventoryName").value = "";
  document.getElementById("inventoryQuantity").value = "";
  document.getElementById("inventoryUnit").value = "";
  document.getElementById("inventoryPrice").value = "";
};

async function loadUsers() {
  if (userRole !== "manager") return;
  userTableBody.innerHTML = "<tr><td colspan='4'>⏳ Đang tải...</td></tr>";
  const snapshot = await getDocs(collection(db, "users"));
  let html = "";
  snapshot.forEach(doc => {
    const user = doc.data();
    html += `<tr>
      <td>${user.email}</td>
      <td>${user.role === "manager" ? "Quản lý" : "Nhân viên"}</td>
      <td>Hoạt động</td>
      <td><button class="deleteUserBtn" data-id="${doc.id}">Xóa</button></td>
    </tr>`;
  });
  userTableBody.innerHTML = html || "<tr><td colspan='4'>📭 Không có dữ liệu</td></tr>";
  document.querySelectorAll(".deleteUserBtn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      await deleteDoc(doc(db, "users", id));
      loadUsers();
    });
  });
}

addUserBtn.onclick = async () => {
  if (userRole !== "manager") return;
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value.trim();
  const role = document.getElementById("newUserRole").value;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: role
    });
    loadUsers();
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPassword").value = "";
  } catch (err) {
    console.error("Thêm người dùng thất bại:", err.message);
    alert("🚫 Thêm người dùng thất bại: " + err.message);
  }
};

async function loadNotes() {
  const noteDoc = await getDoc(doc(db, "notes", currentUser.uid));
  if (noteDoc.exists()) {
    notesTextarea.value = noteDoc.data().note || "";
  }
}

saveNotesBtn.onclick = async () => {
  const note = notesTextarea.value.trim();
  await setDoc(doc(db, "notes", currentUser.uid), { note }, { merge: true });
  alert("Ghi chú đã được lưu");
};

async function loadReportUsers() {
  if (userRole !== "manager") return;
  const snapshot = await getDocs(collection(db, "users"));
  reportUser.innerHTML = '<option value="all">Tất cả người dùng</option>';
  snapshot.forEach(doc => {
    const user = doc.data();
    reportUser.innerHTML += `<option value="${doc.id}">${user.email}</option>`;
  });
}

async function generateReport(isDaily) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), isDaily ? today.getDate() : 1);
  const end = new Date(today.getFullYear(), today.getMonth(), isDaily ? today.getDate() + 1 : today.getMonth() + 1);
  const userId = reportUser.value === "all" ? null : reportUser.value;
  const category = reportCategory.value;

  let queries = [];
  if (category === "all" || category === "expenses") {
    queries.push(userId ? query(collection(db, "expenses"), where("uid", "==", userId), where("timestamp", ">=", start), where("timestamp", "<", end)) : query(collection(db, "expenses"), where("timestamp", ">=", start), where("timestamp", "<", end)));
  }
  if (category === "all" || category === "revenue") {
    queries.push(userId ? query(collection(db, "revenue"), where("uid", "==", userId), where("timestamp", ">=", start), where("timestamp", "<", end)) : query(collection(db, "revenue"), where("timestamp", ">=", start), where("timestamp", "<", end)));
  }
  if (category === "all" || category === "shipments") {
    queries.push(userId ? query(collection(db, "shipments"), where("uid", "==", userId), where("timestamp", ">=", start), where("timestamp", "<", end)) : query(collection(db, "shipments"), where("timestamp", ">=", start), where("timestamp", "<", end)));
  }

  const snapshots = await Promise.all(queries.map(q => getDocs(q)));
  let totalExpenses = 0, totalRevenue = 0;
  let reportHtml = "<h4>Kết quả báo cáo</h4>";

  if (category === "all" || category === "expenses") {
    reportHtml += "<h5>Chi phí</h5><table><tr><th>Mô tả</th><th>Số tiền</th></tr>";
    snapshots[0].forEach(doc => {
      const expense = doc.data();
      totalExpenses += expense.amount;
      reportHtml += `<tr><td>${expense.description}</td><td>${expense.amount.toLocaleString("vi-VN")}₫</td></tr>`;
    });
    reportHtml += "</table>";
  }
  if (category === "all" || category === "revenue") {
    reportHtml += "<h5>Doanh thu</h5><table><tr><th>Mô tả</th><th>Số tiền</th></tr>";
    snapshots[category === "all" ? (category === "expenses" ? 0 : 1) : 0].forEach(doc => {
      const revenue = doc.data();
      totalRevenue += revenue.amount;
      reportHtml += `<tr><td>${revenue.description}</td><td>${revenue.amount.toLocaleString("vi-VN")}₫</td></tr>`;
    });
    reportHtml += "</table>";
  }
  if (category === "all" || category === "shipments") {
    reportHtml += "<h5>Xuất hàng</h5><table><tr><th>Sản phẩm</th><th>Số lượng</th><th>ĐVT</th></tr>";
    snapshots[category === "all" ? (category === "expenses" ? 1 : category === "revenue" ? 1 : 2) : 0].forEach(doc => {
      const shipment = doc.data();
      reportHtml += `<tr><td>${shipment.product}</td><td>${shipment.quantity}</td><td>${shipment.unit}</td></tr>`;
    });
    reportHtml += "</table>";
  }

  document.getElementById("dailyRevenue").innerText = totalRevenue.toLocaleString("vi-VN") + "₫";
  document.getElementById("dailyExpenses").innerText = totalExpenses.toLocaleString("vi-VN") + "₫";
  document.getElementById("dailyBalance").innerText = (totalRevenue - totalExpenses).toLocaleString("vi-VN") + "₫";
  document.getElementById("reportResults").innerHTML = reportHtml;
}

dailyReportBtn.onclick = () => generateReport(true);
monthlyReportBtn.onclick = () => generateReport(false);
applyReportBtn.onclick = () => generateReport(reportCategory.value !== "all");

printReportBtn.onclick = () => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head><title>Báo cáo</title><style>${document.querySelector('style').innerText}</style></head>
      <body>${document.getElementById("reportResults").innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

function bindDeleteButtons() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const collection = btn.getAttribute("data-collection");
      await deleteDoc(doc(db, collection, id));
      if (collection === "expenses") loadExpenses();
      else if (collection === "shipments") loadShipments();
      else if (collection === "revenue") loadRevenue();
      else if (collection === "inventory") loadInventory();
    };
  });
}

// Tab functionality
const tabs = ["chiPhi", "xuatHang", "doanhThu", "khoHang", "baoCao", "nguoiDung"];
tabs.forEach(tab => {
  const btn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (btn) {
    btn.onclick = () => {
      tabs.forEach(t => {
        document.getElementById(`${t}Content`).classList.add("hidden");
        document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.remove("active");
      });
      document.getElementById(`${tab}Content`).classList.remove("hidden");
      btn.classList.add("active");
    };
  }
});
