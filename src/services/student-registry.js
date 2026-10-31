/**
 * Campus Pulse — MIT Moradabad Student Registry
 * 
 * Verifies enrolled students against the official MIT Moradabad student roster.
 * Passwords are stored exclusively as salted bcrypt hashes.
 */

const bcrypt = require('bcryptjs');

// Official college student domain
const OFFICIAL_DOMAIN = 'mitmoradabad.edu.in';

// Verified Student Directory (Institutional Roster)
const VERIFIED_STUDENTS = [
  {
    studentId: '2200820100045',
    name: 'Rohit Sharma',
    email: 'rohit.cse22@mitmoradabad.edu.in',
    branch: 'Computer Science & Engineering',
    batchYear: 2022,
    // Bcrypt hash for: 'MitStudent@2026'
    passwordHash: '$2b$10$pTZRYmFX4Ty4QA761kW/UOLbT1.YyXO1OXiqnW9Swe.kR.Mey.idS',
    status: 'ACTIVE'
  },
  {
    studentId: '2200820140028',
    name: 'Priya Verma',
    email: 'priya.ece22@mitmoradabad.edu.in',
    branch: 'Electronics & Communication Engineering',
    batchYear: 2022,
    // Bcrypt hash for: 'MitStudent@2026'
    passwordHash: '$2b$10$pTZRYmFX4Ty4QA761kW/UOLbT1.YyXO1OXiqnW9Swe.kR.Mey.idS',
    status: 'ACTIVE'
  },
  {
    studentId: '2100820200012',
    name: 'Aman Gupta',
    email: 'aman.me21@mitmoradabad.edu.in',
    branch: 'Mechanical Engineering',
    batchYear: 2021,
    // Bcrypt hash for: 'MitStudent@2026'
    passwordHash: '$2b$10$pTZRYmFX4Ty4QA761kW/UOLbT1.YyXO1OXiqnW9Swe.kR.Mey.idS',
    status: 'ACTIVE'
  }
];

/**
 * Validates whether an email strictly belongs to the official MIT Moradabad domain
 */
function isValidInstitutionalDomain(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${OFFICIAL_DOMAIN}`);
}

/**
 * Finds a verified student record by institutional email
 */
function findStudentByEmail(email) {
  if (!isValidInstitutionalDomain(email)) return null;
  const normalized = email.trim().toLowerCase();
  return VERIFIED_STUDENTS.find(s => s.email.toLowerCase() === normalized && s.status === 'ACTIVE') || null;
}

/**
 * Verifies student credentials against the official registry
 */
async function verifyStudentCredentials(email, password) {
  if (!email || !password) {
    return { success: false, reason: 'Email and password are required' };
  }

  // 1. Strict institutional domain check
  if (!isValidInstitutionalDomain(email)) {
    return {
      success: false,
      reason: `Access restricted. Only official MIT Moradabad student emails (@${OFFICIAL_DOMAIN}) are permitted.`
    };
  }

  // 2. Query verified student registry
  const student = findStudentByEmail(email);
  if (!student) {
    return {
      success: false,
      reason: 'Student record not found in the MIT Moradabad directory. Contact academic registrar.'
    };
  }

  // 3. Constant-time secure password comparison via bcrypt
  const isMatch = await bcrypt.compare(password, student.passwordHash);
  if (!isMatch) {
    return {
      success: false,
      reason: 'Invalid email or password'
    };
  }

  // 4. Return safe student object (omitting passwordHash)
  return {
    success: true,
    student: {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      branch: student.branch,
      batchYear: student.batchYear,
      institution: 'Moradabad Institute of Technology'
    }
  };
}

module.exports = {
  OFFICIAL_DOMAIN,
  isValidInstitutionalDomain,
  findStudentByEmail,
  verifyStudentCredentials
};

