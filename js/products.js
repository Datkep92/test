import { database } from './firebase-config.js';
import { ref, set, get, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, showSuccess } from './utils.js';

// Global products array
let products = [];

async function addProduct() {
  const name = document.getElementById('productName').value.trim();
  const quantity = parseInt(document.getElementById('productQuantity').value) || 0;
  const unit = document.getElementById('productUnit').value.trim();
  const price = parseInt(document.getElementById('productPrice').value) || 0;
  
  if (!name || !unit || isNaN(quantity) || isNaN(price)) {
    showError('Vui lòng nhập đầy đủ thông tin sản phẩm');
    return;
  }
  
  const newProduct = {
    id: Date.now().toString(),
    name,
    quantity,
    unit,
    price
  };
  
  try {
    const productRef = ref(database, `products/${newProduct.id}`);
    await set(productRef, newProduct);
    products.push(newProduct);
    
    document.getElementById('productName').value = '';
    document.getElementById('productQuantity').value = '';
    document.getElementById('productUnit').value = '';
    document.getElementById('productPrice').value = '';
    
    renderProducts();
    renderProductSelection();
    showSuccess('Sản phẩm đã được thêm thành công');
  } catch (error) {
    showError(`Lỗi khi thêm sản phẩm: ${error.message}`);
  }
}

async function editProduct(index) {
  const product = products[index];
  const newName = prompt('Tên sản phẩm:', product.name);
  if (!newName) return;
  
  const newQuantity = parseInt(prompt('Số lượng:', product.quantity)) || 0;
  if (isNaN(newQuantity)) return alert('Số lượng không hợp lệ');
  
  const newUnit = prompt('Đơn vị tính:', product.unit);
  if (!newUnit) return;
  
  const newPrice = parseInt(prompt('Giá đơn vị:', product.price)) || 0;
  if (isNaN(newPrice)) return alert('Giá không hợp lệ');
  
  try {
    const productRef = ref(database, `products/${product.id}`);
    await set(productRef, {
      ...product,
      name: newName,
      quantity: newQuantity,
      unit: newUnit,
      price: newPrice
    });
    
    product.name = newName;
    product.quantity = newQuantity;
    product.unit = newUnit;
    product.price = newPrice;
    
    renderProducts();
    renderProductSelection();
    showSuccess('Sản phẩm đã được cập nhật');
  } catch (error) {
    showError(`Lỗi khi cập nhật sản phẩm: ${error.message}`);
  }
}

async function deleteProduct(index) {
  if (confirm('Xóa sản phẩm này?')) {
    const product = products[index];
    try {
      const productRef = ref(database, `products/${product.id}`);
      await remove(productRef);
      products.splice(index, 1);
      renderProducts();
      renderProductSelection();
      showSuccess('Sản phẩm đã được xóa');
    } catch (error) {
      showError(`Lỗi khi xóa sản phẩm: ${error.message}`);
    }
  }
}

function renderProducts() {
  const table = document.querySelector('#productTable tbody');
  table.innerHTML = '';
  products.forEach((product, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.quantity}</td>
      <td>${product.unit}</td>
      <td class="text-right">${product.price.toLocaleString('vi-VN')}₫</td>
      <td class="actions">
        <button onclick="editProduct(${index})">✏️ Sửa</button>
        <button onclick="deleteProduct(${index})" class="danger">🗑️ Xóa</button>
      </td>
    `;
    table.appendChild(row);
  });
}

function renderProductSelection() {
  const container = document.getElementById('productList');
  container.innerHTML = '';
  products.forEach((product) => {
    const productItem = document.createElement('div');
    productItem.className = 'product-item';
    productItem.innerHTML = `
      <div><strong>${product.name}</strong></div>
      <div>Tồn kho: ${product.quantity} ${product.unit}</div>
      <div style="margin-top: 8px; color: #27ae60;">${product.price.toLocaleString('vi-VN')}₫/${product.unit}</div>
    `;
    productItem.addEventListener('click', () => {
      document.querySelectorAll('.product-item').forEach(item => item.classList.remove('selected'));
      productItem.classList.add('selected');
      selectedProduct = product;
    });
    container.appendChild(productItem);
  });
}

async function loadProducts() {
  try {
    const productsRef = ref(database, 'products');
    const snapshot = await get(productsRef);
    products = [];
    if (snapshot.exists()) {
      snapshot.forEach(childSnapshot => {
        products.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
  } catch (error) {
    showError(`Lỗi khi tải sản phẩm: ${error.message}`);
  }
}

// Expose for inline use
window.addProduct = addProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

// ✅ Export mặc định cho module
export let products = [];

export function renderProductSelection() { ... }
export async function loadProducts() { ... }
// các hàm khác cũng export theo cách này

