/* eslint-disable no-console */
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  getDocs
} from "firebase/firestore";

// Test Firestore connection
export async function testFirestore() {
  try {
    const testCollection = collection(db, "connection_test");

    const docRef = await addDoc(testCollection, {
      message: "Naya Sahara Firebase connection successful!",
      createdAt: new Date()
    });

    console.log("Document created with ID:", docRef.id);

    const snapshot = await getDocs(testCollection);

    snapshot.forEach((document) => {
      console.log(document.id, document.data());
    });

  } catch (error) {
    console.error("Firestore connection failed:", error);
  }
}