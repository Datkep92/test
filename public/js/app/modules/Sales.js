import { db } from '../../config/firebase.js';
import { ref, set, get, update, push, onValue, runTransaction } from 'firebase/database';

export class Sales {
  constructor() {
    this.currentTab = 'expense';
    this.selectedProduct = null;
  }

  async init() {
    // Lắng nghe thay đổi dữ liệu bán hàng
    onValue(ref(db, 'sales'), (snapshot) => {
      this.salesData = snapshot.val() || {};
      this.renderSalesData();
    });
  }

  async addExpense(expenseData) {
    const today = this.getTodayKey();
    const expenseRef = push(ref(db, `sales/${today}/expenses`));
    
    await set(expenseRef, {
      ...expenseData,
      userId: this.app.auth.currentUser.uid,
      timestamp: Date.now()
    });
  }

  async addExport(productId, quantity) {
    return runTransaction(ref(db, `products/${productId}`), (product) => {
      if (!product) throw new Error('Sản phẩm không tồn tại');
      if (product.quantity < quantity) throw new Error('Không đủ tồn kho');
      
      product.quantity -= quantity;
      return product;
    }).then(() => {
      const today = this.getTodayKey();
      const exportRef = push(ref(db, `sales/${today}/exports`));
      
      return set(exportRef, {
        productId,
        quantity,
        userId: this.app.auth.currentUser.uid,
        timestamp: Date.now()
      });
    });
  }

  getTodayKey() {
    const today = new Date();
    return `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
  }

  renderSalesData() {
    // Render dữ liệu bán hàng theo tab hiện tại
    switch (this.currentTab) {
      case 'expense':
        this.renderExpenses();
        break;
      case 'export':
        this.renderExports();
        break;
      case 'revenue':
        this.renderRevenue();
        break;
    }
  }
}
