import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// picks the service account file from GOOGLE_APPLICATION_CREDENTIALS
initializeApp({ credential: applicationDefault() });

export const firestore = getFirestore();
