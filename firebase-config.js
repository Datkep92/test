// Khởi tạo Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDmFpKa8TpDjo3pQADaTubgVpDPOi-FPXk",
  authDomain: "quanly-d7e54.firebaseapp.com",
  databaseURL: "https://quanly-d7e54-default-rtdb.firebaseio.com",
  projectId: "quanly-d7e54",
  storageBucket: "quanly-d7e54.firebasestorage.app",
  messagingSenderId: "482686011267",
  appId: "1:482686011267:web:f2fe9d400fe618487a98b6"
};
// Khởi tạo Firebase
const app = firebase.initializeApp(firebaseConfig);

// Xuất các module cần thiết
const auth = firebase.auth();
const db = firebase.database();

// Xuất để các file khác sử dụng
export { auth, db };
