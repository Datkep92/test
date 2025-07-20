# Ứng dụng Quản lý Kinh doanh (Firebase)

![App Screenshot](./public/assets/images/screenshot.png)

## Tính năng chính
- ✅ Quản lý kho hàng
- ✅ Theo dõi bán hàng
- ✅ Báo cáo doanh thu
- ✅ Quản lý người dùng

## Công nghệ
- Firebase Realtime Database
- Firebase Authentication
- Firebase Hosting

## Cài đặt
1. Clone dự án:
```bash
git clone https://github.com/username/quanly-firebase.git
```

2. Tạo file cấu hình Firebase (không commit file này):
```bash
cp firebase-config.example.json firebase-config.json
```

3. Deploy lên Firebase:
```bash
firebase login
firebase init
firebase deploy
```

## Cấu trúc dự án
```
quanly-firebase/
├── public/           # Source code frontend
├── firebase.json     # Firebase config
└── .firebaserc       # Firebase project
```

## Giấy phép
[MIT](./LICENSE)
