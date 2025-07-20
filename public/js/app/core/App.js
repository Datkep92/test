import { Auth } from './Auth.js';
import { Router } from './Router.js';
import { Products } from '../modules/Products.js';
import { Sales } from '../modules/Sales.js';
import { Reports } from '../modules/Reports.js';
import { Users } from '../modules/Users.js';

export class App {
  constructor() {
    this.auth = new Auth();
    this.router = new Router();
    this.products = new Products();
    this.sales = new Sales();
    this.reports = new Reports();
    this.users = new Users();
    
    this.init();
  }

  async init() {
    // Khởi tạo xác thực
    await this.auth.init();
    
    // Kiểm tra trạng thái đăng nhập
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        this.currentUser = user;
        this.router.navigate(user.role === 'admin' ? '/admin' : '/staff');
      } else {
        this.router.navigate('/login');
      }
    });
    
    // Khởi tạo các module
    await Promise.all([
      this.products.init(),
      this.sales.init(),
      this.reports.init(),
      this.users.init()
    ]);
    
    console.log('Ứng dụng đã khởi tạo xong');
  }
}
