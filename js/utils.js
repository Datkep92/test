import { auth, database } from './firebase-config.js';
import { get, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

export function showSuccess(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = `<div class="success-message">${message}</div>`;
  setTimeout(() => errorContainer.innerHTML = '', 3000);
}

export function parseNumber(input) {
  if (!input) return 0;
  const cleaned = input.toString().replace(/[^\d]/g, '');
  return parseInt(cleaned) || 0;
}

export function capitalizeFirstLetter(string) {
  return string.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export async function checkAdminStatus(user) {
  if (!user) return false;
  const userRef = ref(database, `users/${user.uid}`);
  const snapshot = await get(userRef);
  return snapshot.exists() && snapshot.val().role === 'admin';
}
