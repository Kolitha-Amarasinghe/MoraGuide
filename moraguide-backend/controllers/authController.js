const bcrypt = require('bcryptjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { all, get, run } = require('../config/db');
const { profileImageDirectory, profileImageUrlPrefix } = require('../config/profileImages');
const { clearSessionCookie, createSession } = require('../middleware/auth');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedProfileFields = new Set([
    'firstName', 'lastName', 'phone',
    'registrationNumber', 'faculty', 'department',
    'organizationName', 'designation'
]);

async function getUser(userId) {
    return get(`
        SELECT u.userId AS id, u.firstName, u.lastName, u.email, u.phone, u.profileImage, u.role,
            s.studentId, s.registrationNumber, s.faculty, s.department,
            o.organizerId, o.organizationName, o.designation
        FROM users u
        LEFT JOIN student s ON s.userId = u.userId
        LEFT JOIN organizer o ON o.userId = u.userId
        WHERE u.userId = ?
    `, [userId]);
}

function isNonEmptyText(value, maxLength) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

async function login(request, response) {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = request.body.password;
    if (!emailPattern.test(email) || typeof password !== 'string') {
        return response.status(400).json({ error: 'Enter a valid email address and password.' });
    }

    const row = await get('SELECT userId, password FROM users WHERE email = ?', [email]);
    if (!row || !/^\$2[aby]\$/.test(row.password) || !await bcrypt.compare(password, row.password)) {
        return response.status(401).json({ error: 'Email or password is incorrect.' });
    }

    await createSession(row.userId, response);
    response.json({ data: await getUser(row.userId) });
}

async function register(request, response) {
    const { firstName, lastName, email, password, role } = request.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!isNonEmptyText(firstName, 50) || !isNonEmptyText(lastName, 50) ||
        !emailPattern.test(normalizedEmail) || normalizedEmail.length > 100) {
        return response.status(400).json({ error: 'Enter your first name, last name, and a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return response.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes.' });
    }
    if (!['student', 'organizer'].includes(role)) {
        return response.status(400).json({ error: 'Choose a student or event organizer account.' });
    }
    if (role === 'student' && !isNonEmptyText(request.body.registrationNumber, 30)) {
        return response.status(400).json({ error: 'Student registration number is required.' });
    }
    const optionalLimits = {
        phone: 15,
        faculty: 100,
        department: 100,
        organizationName: 150,
        designation: 100
    };
    for (const [field, maxLength] of Object.entries(optionalLimits)) {
        const value = request.body[field];
        if (value !== undefined && (typeof value !== 'string' || value.trim().length > maxLength)) {
            return response.status(400).json({ error: `${field} must be ${maxLength} characters or fewer.` });
        }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let userId;
    try {
        await run('BEGIN IMMEDIATE TRANSACTION');
        const inserted = await run(
            'INSERT INTO users (firstName, lastName, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [
                firstName.trim(),
                lastName.trim(),
                normalizedEmail,
                passwordHash,
                typeof request.body.phone === 'string' ? request.body.phone.trim() || null : null,
                role
            ]
        );
        userId = inserted.id;

        if (role === 'student') {
            await run(
                'INSERT INTO student (userId, registrationNumber, faculty, department) VALUES (?, ?, ?, ?)',
                [
                    userId,
                    request.body.registrationNumber.trim(),
                    typeof request.body.faculty === 'string' ? request.body.faculty.trim() || null : null,
                    typeof request.body.department === 'string' ? request.body.department.trim() || null : null
                ]
            );
        } else {
            await run(
                'INSERT INTO organizer (userId, organizationName, designation) VALUES (?, ?, ?)',
                [
                    userId,
                    typeof request.body.organizationName === 'string' ? request.body.organizationName.trim() || null : null,
                    typeof request.body.designation === 'string' ? request.body.designation.trim() || null : null
                ]
            );
        }
        await run('COMMIT');
    } catch (error) {
        await run('ROLLBACK');
        if (error.code === 'SQLITE_CONSTRAINT' && /(?:UNIQUE|PRIMARY KEY) constraint failed/.test(error.message)) {
            return response.status(409).json({ error: 'That email or registration number is already in use.' });
        }
        throw error;
    }

    await createSession(userId, response);
    response.status(201).json({ data: await getUser(userId) });
}

async function current(request, response) {
    response.json({ data: request.user ? await getUser(request.user.id) : null });
}

async function logout(request, response) {
    await run('DELETE FROM user_session WHERE sessionId = ?', [request.sessionId]);
    clearSessionCookie(response);
    response.json({ data: { loggedOut: true } });
}

async function updateProfile(request, response) {
    const updates = Object.fromEntries(Object.entries(request.body)
        .filter(([field]) => allowedProfileFields.has(field)));
    if (Object.keys(updates).length === 0) {
        return response.status(400).json({ error: 'Provide at least one supported profile field.' });
    }

    for (const field of ['firstName', 'lastName']) {
        if (updates[field] !== undefined && !isNonEmptyText(updates[field], 50)) {
            return response.status(400).json({ error: `${field === 'firstName' ? 'First' : 'Last'} name is required and must be 50 characters or fewer.` });
        }
    }

    const userUpdates = [];
    const userParams = [];
    for (const field of ['firstName', 'lastName', 'phone']) {
        if (updates[field] !== undefined) {
            if (typeof updates[field] !== 'string') {
                return response.status(400).json({ error: `${field} must be text.` });
            }
            const value = updates[field].trim();
            const limit = field === 'phone' ? 15 : 50;
            if (value.length > limit) {
                return response.status(400).json({ error: `${field} is too long.` });
            }
            userUpdates.push(`${field} = ?`);
            userParams.push(value || null);
        }
    }

    try {
        await run('BEGIN IMMEDIATE TRANSACTION');
        if (userUpdates.length) {
            userParams.push(request.user.id);
            await run(`UPDATE users SET ${userUpdates.join(', ')} WHERE userId = ?`, userParams);
        }

        if (request.user.role === 'student') {
            const studentUpdates = [];
            const studentParams = [];
            for (const field of ['registrationNumber', 'faculty', 'department']) {
                if (updates[field] !== undefined) {
                    if (typeof updates[field] !== 'string') {
                        throw Object.assign(new Error(`${field} must be text.`), { status: 400 });
                    }
                    const value = updates[field].trim();
                    const limit = field === 'registrationNumber' ? 30 : 100;
                    if ((field === 'registrationNumber' && !value) || value.length > limit) {
                        throw Object.assign(new Error('Enter a valid student registration number or profile value.'), { status: 400 });
                    }
                    studentUpdates.push(`${field} = ?`);
                    studentParams.push(value || null);
                }
            }
            if (studentUpdates.length) {
                studentParams.push(request.user.id);
                await run(`UPDATE student SET ${studentUpdates.join(', ')} WHERE userId = ?`, studentParams);
            }
        } else if (request.user.role === 'organizer') {
            const organizerUpdates = [];
            const organizerParams = [];
            for (const field of ['organizationName', 'designation']) {
                if (updates[field] !== undefined) {
                    if (typeof updates[field] !== 'string') {
                        throw Object.assign(new Error(`${field} must be text.`), { status: 400 });
                    }
                    const value = updates[field].trim();
                    const limit = field === 'organizationName' ? 150 : 100;
                    if (value.length > limit) {
                        throw Object.assign(new Error(`${field} is too long.`), { status: 400 });
                    }
                    organizerUpdates.push(`${field} = ?`);
                    organizerParams.push(value || null);
                }
            }
            if (organizerUpdates.length) {
                organizerParams.push(request.user.id);
                await run(`UPDATE organizer SET ${organizerUpdates.join(', ')} WHERE userId = ?`, organizerParams);
            }
        }
        await run('COMMIT');
    } catch (error) {
        await run('ROLLBACK');
        if (error.status) {
            return response.status(error.status).json({ error: error.message });
        }
        if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
            return response.status(409).json({ error: 'That student registration number is already in use.' });
        }
        throw error;
    }

    response.json({ data: await getUser(request.user.id) });
}

function getImageFormat(image) {
    if (image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { contentType: 'image/png', extension: 'png' };
    }
    if (image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
        return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (image.subarray(0, 4).toString('ascii') === 'RIFF' &&
        image.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { contentType: 'image/webp', extension: 'webp' };
    }
    return null;
}

async function removeStoredProfileImage(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith(profileImageUrlPrefix)) return;
    const fileName = imageUrl.slice(profileImageUrlPrefix.length);
    if (!/^\d+-[a-f0-9-]+\.(?:png|jpg|webp)$/.test(fileName)) return;

    try {
        await fs.unlink(path.join(profileImageDirectory, fileName));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

async function uploadProfileImage(request, response) {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        return response.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image to upload.' });
    }

    const format = getImageFormat(request.body);
    const contentType = (request.get('content-type') || '').split(';')[0].toLowerCase();
    if (!format || contentType !== format.contentType) {
        return response.status(415).json({ error: 'Profile images must be valid JPEG, PNG, or WebP files.' });
    }

    const previousImage = await get('SELECT profileImage FROM users WHERE userId = ?', [request.user.id]);
    await run(`
        UPDATE users
        SET profileImage = ?, profileImageData = ?, profileImageType = ?
        WHERE userId = ?
    `, ['/api/auth/profile/image', request.body, format.contentType, request.user.id]);

    try {
        await removeStoredProfileImage(previousImage?.profileImage);
    } catch (error) {
        console.error('Unable to remove a replaced profile image:', error);
    }
    response.json({ data: await getUser(request.user.id) });
}

async function getProfileImage(request, response) {
    const image = await get(
        'SELECT profileImageData, profileImageType FROM users WHERE userId = ?',
        [request.user.id]
    );
    if (!image?.profileImageData || !['image/jpeg', 'image/png', 'image/webp'].includes(image.profileImageType)) {
        return response.status(404).json({ error: 'No profile image is stored for this account.' });
    }

    response.set({
        'Cache-Control': 'private, no-store',
        'Content-Type': image.profileImageType,
        'X-Content-Type-Options': 'nosniff'
    });
    response.send(image.profileImageData);
}

async function deleteProfileImage(request, response) {
    const currentImage = await get('SELECT profileImage FROM users WHERE userId = ?', [request.user.id]);
    await run(`
        UPDATE users
        SET profileImage = NULL, profileImageData = NULL, profileImageType = NULL
        WHERE userId = ?
    `, [request.user.id]);
    try {
        await removeStoredProfileImage(currentImage?.profileImage);
    } catch (error) {
        console.error('Unable to remove a deleted profile image:', error);
    }
    response.json({ data: await getUser(request.user.id) });
}

async function adminSummary(_request, response) {
    const [users, events, registrations] = await Promise.all([
        get('SELECT COUNT(*) AS count FROM users'),
        get('SELECT COUNT(*) AS count FROM event'),
        get('SELECT COUNT(*) AS count FROM eventRegistration')
    ]);
    response.json({ data: { users: users.count, events: events.count, registrations: registrations.count } });
}

async function adminUsers(_request, response) {
    const users = await all(`
        SELECT userId AS id, firstName, lastName, email, role, createdAt
        FROM users
        ORDER BY createdAt DESC, userId DESC
    `);
    response.json({ data: users });
}

module.exports = {
    adminSummary,
    adminUsers,
    current,
    getProfileImage,
    login,
    logout,
    register,
    uploadProfileImage,
    deleteProfileImage,
    updateProfile
};
