require('dotenv').config();

const bcrypt = require('bcryptjs');
const { closeDatabase, connectToDatabase, get, run } = require('../config/db');

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'MoraGuide';
    const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Admin';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Set ADMIN_EMAIL to a valid email address before creating an admin.');
    }
    if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Set ADMIN_PASSWORD to a password between 12 and 72 bytes.');
    }

    await connectToDatabase();
    if (await get('SELECT userId FROM users WHERE email = ?', [email])) {
        throw new Error('That email already exists. Use a different admin email.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await run('INSERT INTO users (firstName, lastName, email, password, role) VALUES (?, ?, ?, ?, ?)', [
        firstName,
        lastName,
        email,
        passwordHash,
        'admin'
    ]);
    console.log(`Admin account created for ${email}.`);
}

createAdmin()
    .catch(error => {
        console.error('Admin account creation failed:', error.message);
        process.exitCode = 1;
    })
    .finally(() => closeDatabase().catch(error => {
        console.error('Failed to close SQLite database:', error);
        process.exitCode = 1;
    }));
