import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyAJgDyqPBgM8O14RrpvsZ1FNIR1QttCzqo",
  authDomain: "hackathon-c9504.firebaseapp.com",
  databaseURL: "https://hackathon-c9504-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hackathon-c9504",
  storageBucket: "hackathon-c9504.firebasestorage.app",
  messagingSenderId: "812844676937",
  appId: "1:812844676937:web:8a406bb2e4fec1d6478c98",
  measurementId: "G-93HR04XJCR"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);