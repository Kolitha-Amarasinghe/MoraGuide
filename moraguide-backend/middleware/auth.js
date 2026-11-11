const crypto = require('node:crypto');
const { get, run } = require('../config/db');

const SESSION_COOKIE = 'moraguide_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionToken(request) {
    const cookieHeader = request.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})(?:;|$)`));
    return match ? match[1] : null;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(response, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const sameSite = process.env.NODE_ENV === 'production' && process.env.FRONTEND_ORIGIN ? 'None' : 'Lax';
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`);
}

function clearSessionCookie(response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const sameSite = process.env.NODE_ENV === 'production' && process.env.FRONTEND_ORIGIN ? 'None' : 'Lax';
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`);
}

async function createSession(userId, response) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    await run('INSERT INTO user_session (sessionId, userId, expiresAt) VALUES (?, ?, ?)', [
        hashToken(token), userId, expiresAt
    ]);
    setSessionCookie(response, token);
}

async function loadSession(request, response) {
    const token = getSessionToken(request);
    if (!token) return false;

    const sessionId = hashToken(token);
    const user = await get(`
        SELECT u.userId, u.firstName, u.lastName, u.email, u.phone, u.profileImage, u.role,
            s.studentId, s.registrationNumber, s.faculty, s.department,
            o.organizerId, o.organizationName, o.designation
        FROM user_session session
        JOIN users u ON u.userId = session.userId
        LEFT JOIN student s ON s.userId = u.userId
        LEFT JOIN organizer o ON o.userId = u.userId
        WHERE session.sessionId = ? AND session.expiresAt > ?
    `, [sessionId, Date.now()]);

    if (!user) {
        clearSessionCookie(response);
        return false;
    }

    request.user = {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role,
        studentId: user.studentId,
        registrationNumber: user.registrationNumber,
        faculty: user.faculty,
        department: user.department,
        organizerId: user.organizerId,
        organizationName: user.organizationName,
        designation: user.designation
    };
    request.sessionId = sessionId;
    return true;
}

async function requireAuth(request, response, next) {
    const isAuthenticated = await loadSession(request, response);
    if (!isAuthenticated) {
        return response.status(401).json({ error: 'Please log in to continue.' });
    }
    next();
}

async function optionalAuth(request, response, next) {
    await loadSession(request, response);
    next();
}

function requireRole(...roles) {
    return (request, response, next) => {
        if (!request.user || !roles.includes(request.user.role)) {
            return response.status(403).json({ error: 'You do not have permission to perform this action.' });
        }
        next();
    };
}

module.exports = {
    clearSessionCookie,
    createSession,
    optionalAuth,
    requireAuth,
    requireRole
};
