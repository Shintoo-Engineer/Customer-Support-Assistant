import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'trainer' | 'employee';
export type PolicyAccessLevel = 'PUBLIC' | 'EMPLOYEE' | 'TRAINER' | 'ADMIN';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export type PolicyCategory =
  | 'Returns'
  | 'Refunds'
  | 'Shipping'
  | 'Warranty'
  | 'Privacy'
  | 'Security'
  | 'Billing'
  | 'General'
  | 'Customer Service'
  | 'HR'
  | 'IT'
  | 'Training';

export interface PolicyDocumentRecord {
  id: string;
  filename: string;
  originalName: string;
  category: PolicyCategory;
  accessLevel: PolicyAccessLevel;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  status: 'indexed' | 'processing' | 'failed' | 'inactive';
  version: number;
  isActive: boolean;
  chunkCount: number;
  summary?: string;
  extractedTextSnippet?: string;
  filePath?: string;
  processingError?: string;
}

export interface PolicyChunkRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  category: string;
  accessLevel: PolicyAccessLevel;
  chunkText: string;
  chunkIndex: number;
  sectionTitle?: string;
  pageNumber?: number;
  isActive: boolean;
  version: number;
  embedding?: number[];
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  category: 'auth' | 'session' | 'policy' | 'user' | 'system';
  details: string;
  resource?: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  policies: PolicyDocumentRecord[];
  chunks: PolicyChunkRecord[];
  auditLogs: AuditLogRecord[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function ensureDbFile(): DatabaseSchema {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData: DatabaseSchema = {
      users: [],
      policies: [],
      chunks: [],
      auditLogs: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json, creating new database file', err);
    const initialData: DatabaseSchema = { users: [], policies: [], chunks: [], auditLogs: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
}

function saveDb(data: DatabaseSchema) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Global Database API
export const db = {
  getUsers(): UserRecord[] {
    const data = ensureDbFile();
    return data.users;
  },

  getUserById(id: string): UserRecord | undefined {
    return this.getUsers().find(u => u.id === id);
  },

  getUserByEmail(email: string): UserRecord | undefined {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  createUser(user: UserRecord): UserRecord {
    const data = ensureDbFile();
    data.users.push(user);
    saveDb(data);
    return user;
  },

  updateUser(id: string, updates: Partial<UserRecord>): UserRecord | null {
    const data = ensureDbFile();
    const idx = data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    data.users[idx] = { ...data.users[idx], ...updates };
    saveDb(data);
    return data.users[idx];
  },

  deleteUser(id: string): boolean {
    const data = ensureDbFile();
    const initialLen = data.users.length;
    data.users = data.users.filter(u => u.id !== id);
    saveDb(data);
    return data.users.length < initialLen;
  },

  getPolicies(): PolicyDocumentRecord[] {
    const data = ensureDbFile();
    return data.policies;
  },

  getPolicyById(id: string): PolicyDocumentRecord | undefined {
    return this.getPolicies().find(p => p.id === id);
  },

  savePolicy(policy: PolicyDocumentRecord): PolicyDocumentRecord {
    const data = ensureDbFile();
    const existingIdx = data.policies.findIndex(p => p.id === policy.id);
    if (existingIdx >= 0) {
      data.policies[existingIdx] = policy;
    } else {
      data.policies.push(policy);
    }
    saveDb(data);
    return policy;
  },

  deletePolicy(id: string): boolean {
    const data = ensureDbFile();
    data.policies = data.policies.filter(p => p.id !== id);
    data.chunks = data.chunks.filter(c => c.documentId !== id);
    saveDb(data);
    return true;
  },

  getChunks(): PolicyChunkRecord[] {
    const data = ensureDbFile();
    return data.chunks;
  },

  saveChunks(chunks: PolicyChunkRecord[]) {
    const data = ensureDbFile();
    // Replace any existing chunks for these doc IDs
    const docIds = new Set(chunks.map(c => c.documentId));
    data.chunks = data.chunks.filter(c => !docIds.has(c.documentId));
    data.chunks.push(...chunks);
    saveDb(data);
  },

  deleteChunksByDocId(docId: string) {
    const data = ensureDbFile();
    data.chunks = data.chunks.filter(c => c.documentId !== docId);
    saveDb(data);
  },

  getAuditLogs(): AuditLogRecord[] {
    const data = ensureDbFile();
    return data.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  addAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>) {
    const data = ensureDbFile();
    const newLog: AuditLogRecord = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    data.auditLogs.push(newLog);
    saveDb(data);
  }
};

// Seeding Initial Data
export async function seedInitialData() {
  const users = db.getUsers();
  
  if (users.length === 0) {
    console.log('Seeding initial system users...');
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const trainerPassword = await bcrypt.hash('Trainer123!', 10);
    const employeePassword = await bcrypt.hash('Employee123!', 10);

    const initialUsers: UserRecord[] = [
      {
        id: 'usr-admin-1',
        name: 'System Admin',
        email: 'admin@example.com',
        passwordHash: adminPassword,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-trainer-1',
        name: 'Sarah Jenkins (Trainer)',
        email: 'trainer@example.com',
        passwordHash: trainerPassword,
        role: 'trainer',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-employee-1',
        name: 'Alex Rivera (Employee)',
        email: 'employee@example.com',
        passwordHash: employeePassword,
        role: 'employee',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];

    initialUsers.forEach(u => db.createUser(u));

    db.addAuditLog({
      userName: 'System',
      userEmail: 'system@internal',
      userRole: 'admin',
      action: 'SYSTEM_SEED',
      category: 'system',
      details: 'Initialized default Admin, Trainer, and Employee seed accounts.'
    });
  }

  // Seed initial policy documents if empty
  const policies = db.getPolicies();
  if (policies.length === 0) {
    console.log('Seeding initial policy documents...');

    const leaveDocId = 'pol-leave-101';
    const securityDocId = 'pol-sec-201';
    const trainerDocId = 'pol-trn-301';
    const adminDocId = 'pol-adm-401';

    const samplePolicies: PolicyDocumentRecord[] = [
      {
        id: leaveDocId,
        filename: 'Leave_Policy.pdf',
        originalName: 'Company Leave & Time Off Policy.pdf',
        category: 'HR',
        accessLevel: 'EMPLOYEE',
        mimeType: 'application/pdf',
        size: 142000,
        uploadedBy: 'System Admin',
        uploadedAt: new Date().toISOString(),
        status: 'indexed',
        version: 1,
        isActive: true,
        chunkCount: 2,
        summary: 'Company leave entitlement rules including casual leave, paid time off, and notice periods.',
        extractedTextSnippet: 'Employees are entitled to 12 casual leave days per calendar year. All leave requests must be submitted at least 2 days in advance.'
      },
      {
        id: securityDocId,
        filename: 'IT_Security_Policy.pdf',
        originalName: 'IT & Password Security Guidelines.pdf',
        category: 'Security',
        accessLevel: 'EMPLOYEE',
        mimeType: 'application/pdf',
        size: 98000,
        uploadedBy: 'System Admin',
        uploadedAt: new Date().toISOString(),
        status: 'indexed',
        version: 1,
        isActive: true,
        chunkCount: 2,
        summary: 'Password requirements, multi-factor authentication, and data security standards.',
        extractedTextSnippet: 'Passwords must be at least 12 characters long and renewed every 90 days. Sharing passwords is strictly prohibited.'
      },
      {
        id: trainerDocId,
        filename: 'Trainer_Onboarding_Handbook.pdf',
        originalName: 'Trainer Onboarding & Evaluation Handbook.pdf',
        category: 'Training',
        accessLevel: 'TRAINER',
        mimeType: 'application/pdf',
        size: 215000,
        uploadedBy: 'System Admin',
        uploadedAt: new Date().toISOString(),
        status: 'indexed',
        version: 1,
        isActive: true,
        chunkCount: 2,
        summary: 'Guiding employees through simulation practice, scoring standards, and performance reviews.',
        extractedTextSnippet: 'Trainers must review employee simulation transcripts weekly and provide targeted coaching feedback within 24 hours.'
      },
      {
        id: adminDocId,
        filename: 'Admin_Governance_Internal.pdf',
        originalName: 'Internal Administrative Governance & Audit Policy.pdf',
        category: 'General',
        accessLevel: 'ADMIN',
        mimeType: 'application/pdf',
        size: 310000,
        uploadedBy: 'System Admin',
        uploadedAt: new Date().toISOString(),
        status: 'indexed',
        version: 1,
        isActive: true,
        chunkCount: 2,
        summary: 'Internal governance policy detailing system administrative controls and audit requirements.',
        extractedTextSnippet: 'Admin actions including user deletion and system key rotations must be logged in the immutable audit registry.'
      }
    ];

    samplePolicies.forEach(p => db.savePolicy(p));

    const sampleChunks: PolicyChunkRecord[] = [
      {
        id: `${leaveDocId}-chk-1`,
        documentId: leaveDocId,
        documentTitle: 'Company Leave & Time Off Policy.pdf',
        category: 'HR',
        accessLevel: 'EMPLOYEE',
        chunkText: 'Section 1: Casual Leave Entitlement\nEmployees are entitled to 12 casual leave days per calendar year. Casual leave accrues on a monthly basis (1 day per month). Unused casual leave up to 6 days can be carried forward to the following year.',
        chunkIndex: 0,
        sectionTitle: 'Section 1: Leave Entitlement',
        pageNumber: 1,
        isActive: true,
        version: 1
      },
      {
        id: `${leaveDocId}-chk-2`,
        documentId: leaveDocId,
        documentTitle: 'Company Leave & Time Off Policy.pdf',
        category: 'HR',
        accessLevel: 'EMPLOYEE',
        chunkText: 'Section 2: Sick Leave and Maternity Leave\nSick leave requires a medical certificate if absent for more than 2 consecutive working days. Maternity leave provides 26 weeks of fully paid leave for eligible employees following statutory HR guidelines.',
        chunkIndex: 1,
        sectionTitle: 'Section 2: Sick and Maternity Leave',
        pageNumber: 2,
        isActive: true,
        version: 1
      },
      {
        id: `${securityDocId}-chk-1`,
        documentId: securityDocId,
        documentTitle: 'IT & Password Security Guidelines.pdf',
        category: 'Security',
        accessLevel: 'EMPLOYEE',
        chunkText: 'Section 3.1: Password Policy\nPasswords must be at least 12 characters, including uppercase, lowercase, numbers, and special characters. Passwords expire every 90 days.',
        chunkIndex: 0,
        sectionTitle: 'Section 3.1: Passwords',
        pageNumber: 1,
        isActive: true,
        version: 1
      },
      {
        id: `${trainerDocId}-chk-1`,
        documentId: trainerDocId,
        documentTitle: 'Trainer Onboarding & Evaluation Handbook.pdf',
        category: 'Training',
        accessLevel: 'TRAINER',
        chunkText: 'Section 4: Trainer Coaching Protocols\nTrainers are responsible for assessing employee response quality. Coaching scores above 85% qualify employees for autonomous tier 2 support queues.',
        chunkIndex: 0,
        sectionTitle: 'Section 4: Coaching Protocols',
        pageNumber: 1,
        isActive: true,
        version: 1
      },
      {
        id: `${adminDocId}-chk-1`,
        documentId: adminDocId,
        documentTitle: 'Internal Administrative Governance & Audit Policy.pdf',
        category: 'General',
        accessLevel: 'ADMIN',
        chunkText: 'Section 9: Executive Governance\nOnly System Administrators are permitted to configure system roles, modify global user permissions, or clear document knowledge stores.',
        chunkIndex: 0,
        sectionTitle: 'Section 9: Governance',
        pageNumber: 1,
        isActive: true,
        version: 1
      }
    ];

    db.saveChunks(sampleChunks);
  }
}
