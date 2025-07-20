import { db } from '../../config/firebase.js';
import { ref, set, get, update, remove, push, onValue } from 'firebase/database';

export class Products {
  constructor() {
    this.products = [];
  }

  async init() {
    // Lắng nghe thay đổi từ Firebase
    onValue(ref(db, 'products'), (snapshot) => {
      this.products = snapshot.val() || [];
      this.renderProducts();
    });
  }

  async addProduct(productData) {
    const newProductRef = push(ref(db, 'products'));
    await set(newProductRef, {
      ...productData,
      id: newProductRef.key,
      createdAt: Date.now()
    });
  }

  async updateProduct(id, updates) {
    await update(ref(db, `products/${id}`), updates);
  }

  async deleteProduct(id) {
    await remove(ref(db, `products/${id}`));
  }

  renderProducts() {
    // Render danh sách sản phẩm ra giao diện
    const table = document.querySelector('#product-table tbody');
    if (!table) return;
    
    table.innerHTML = this.products.map(product => `
      <tr>
        <td>${product.name}</td>
        <td>${product.quantity}</td>
        <td>${product.unit}</td>
        <td class="text-right">${product.price.toLocaleString('vi-VN')}₫</td>
        <td class="actions">
          <button class="btn-edit" data-id="${product.id}">Sửa</button>
          <button class="btn-delete danger" data-id="${product.id}">Xóa</button>
        </td>
      </tr>
    `).join('');
  }
}
