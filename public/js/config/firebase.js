// Import từ file cấu hình bên ngoài (không commit lên GitHub)
import firebaseConfig from '../../../firebase-config.json';

// Khởi tạo Firebase
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth };
