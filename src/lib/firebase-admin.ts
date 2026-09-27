import fs from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let projectId = process.env.FIREBASE_PROJECT_ID || 'ownverse-store';

try {
  const configUrl = new URL('../../firebase-applet-config.json', import.meta.url);
  if (fs.existsSync(configUrl)) {
    const raw = fs.readFileSync(configUrl, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
      projectId = parsed.projectId.trim();
    }
  }
} catch {
  // Fallback to environment or default projectId when running on external hosts
}

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

export const adminAuth = getAuth();
