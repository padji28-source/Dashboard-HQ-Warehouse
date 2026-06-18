import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import type { AuditLog, WhatsAppLog } from '../types';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get Firestore reference with Database ID
export const db = getFirestore(app);

// Audit Logging helper
export async function logAudit(username: string, module: string, action: string, details: string) {
  try {
    const auditColl = collection(db, 'audit_logs');
    await addDoc(auditColl, {
      username,
      module,
      action,
      details,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Gagal mencatatkan audit log ke Firebase:', err);
  }
}

// WhatsApp Log helper
export async function logWhatsAppActivity(from: string, message: string, reply: string, status: 'sent' | 'received' | 'error') {
  try {
    const waColl = collection(db, 'whatsapp_logs');
    await addDoc(waColl, {
      from,
      message,
      reply,
      status,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Gagal mencatatkan WhatsApp activity ke Firebase:', err);
  }
}

// Fetch WhatsApp history logs
export async function getWhatsAppHistory(maxCount = 50): Promise<WhatsAppLog[]> {
  try {
    const waColl = collection(db, 'whatsapp_logs');
    const q = query(waColl, orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  } catch (err) {
    console.error('Gagal mengambil riwayat WhatsApp:', err);
    return [];
  }
}

// Fetch Audit history logs
export async function getAuditHistory(maxCount = 50): Promise<AuditLog[]> {
  try {
    const auditColl = collection(db, 'audit_logs');
    const q = query(auditColl, orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  } catch (err) {
    console.error('Gagal mengambil riwayat audit:', err);
    return [];
  }
}

export default db;
