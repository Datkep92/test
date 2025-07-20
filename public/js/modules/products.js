import { db } from '../config/firebase.js';
import { ref, set, get, update, remove } from 'firebase/database';

export class ProductService {
  static async getAllProducts() {
    const snapshot = await get(ref(db, 'products'));
    return snapshot.val() || {};
  }

  static async addProduct(product) {
    const newProductRef = ref(db, `products/${product.id}`);
    await set(newProductRef, product);
    return product;
  }

  static async updateProduct(id, updates) {
    const productRef = ref(db, `products/${id}`);
    await update(productRef, updates);
  }

  static async deleteProduct(id) {
    const productRef = ref(db, `products/${id}`);
    await remove(productRef);
  }
}
