import { auth } from '../config/firebase.js';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ROUTES, ROLE } from '../config/routes.js';

export class AuthService {
  static async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return this.redirectUser(userCredential.user);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  static async logout() {
    await signOut(auth);
    window.location.href = ROUTES.LOGIN;
  }

  static redirectUser(user) {
    // Logic redirect dựa trên role
    const route = user.email.includes('admin') ? ROUTES.ADMIN : ROUTES.STAFF;
    window.location.href = route;
  }

  static handleAuthError(error) {
    // Xử lý các loại lỗi Firebase
    const errorMap = {
      'auth/user-not-found': 'Tài khoản không tồn tại',
      'auth/wrong-password': 'Sai mật khẩu',
      'auth/too-many-requests': 'Tài khoản tạm khóa do đăng nhập sai nhiều lần'
    };
    return errorMap[error.code] || 'Đăng nhập thất bại';
  }
}
