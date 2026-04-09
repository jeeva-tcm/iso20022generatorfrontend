// src/environments/environment.prod.ts
// Production settings

import { initializeApp } from "firebase/app";

export const environment = {
    production: true,
     apiBaseUrl: 'https://iso20022generatorbackend.onrender.com',
    firebaseConfig: {
       apiKey: "AIzaSyBHD--ylzxTtP0JLI7j1ajSNx-9tzLneKw",
  authDomain: "avid-winter-492811-g9.firebaseapp.com",
  projectId: "avid-winter-492811-g9",
  storageBucket: "avid-winter-492811-g9.firebasestorage.app",
  messagingSenderId: "926327189516",
  appId: "1:926327189516:web:d0a7b912cc633b032d3e29",
  measurementId: "G-J2XH6CXTQP"
    }
};
const app = initializeApp(environment.firebaseConfig);