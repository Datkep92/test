import firebaseConfig from '../../../firebase-config.json';

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

export { app, db, auth };
