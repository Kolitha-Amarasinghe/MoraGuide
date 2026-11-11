const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const defaultDatabasePath = path.resolve(__dirname, '..', '..', 'Moraguide.sqlite');
let database;

function getDatabasePath() {
    const configuredPath = process.env.DATABASE_PATH || process.env.SQLITE_DB_PATH;
    if (!configuredPath) return defaultDatabasePath;
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '..', configuredPath);
}

function getDatabase() {
    if (!database) {
        const databasePath = getDatabasePath();
        fs.mkdirSync(path.dirname(databasePath), { recursive: true });
        database = new sqlite3.Database(databasePath);
    }
    return database;
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(rows);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDatabase().get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(row);
        });
    });
}

function closeDatabase() {
    if (!database) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        database.close(error => {
            if (error) {
                reject(error);
                return;
            }
            database = null;
            resolve();
        });
    });
}

async function connectToDatabase() {
    const databasePath = getDatabasePath();
    const db = getDatabase();

    await new Promise((resolve, reject) => {
        db.exec(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                userId INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password TEXT NOT NULL,
                phone TEXT,
                role TEXT NOT NULL CHECK (role IN ('student', 'organizer', 'admin')),
                profileImage TEXT,
                profileImageData BLOB,
                profileImageType TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS student (
                studentId INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL UNIQUE,
                registrationNumber TEXT UNIQUE NOT NULL,
                faculty TEXT,
                department TEXT,
                FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS organizer (
                organizerId INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL UNIQUE,
                organizationName TEXT,
                designation TEXT,
                FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS place (
                placeId INTEGER PRIMARY KEY AUTOINCREMENT,
                placeName TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                icon TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS faq (
                faqId INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contactMessage (
                messageId INTEGER PRIMARY KEY AUTOINCREMENT,
                userName TEXT,
                email TEXT,
                subject TEXT,
                message TEXT NOT NULL,
                submittedAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notification (
                notificationId INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_session (
                sessionId TEXT PRIMARY KEY,
                userId INTEGER NOT NULL,
                expiresAt INTEGER NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
            );
        `, error => error ? reject(error) : resolve());
    });

    const userColumns = await all('PRAGMA table_info(users)');
    if (!userColumns.some(column => column.name === 'profileImageData')) {
        await run('ALTER TABLE users ADD COLUMN profileImageData BLOB');
    }
    if (!userColumns.some(column => column.name === 'profileImageType')) {
        await run('ALTER TABLE users ADD COLUMN profileImageType TEXT');
    }

    const eventTable = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event'");
    const eventColumns = eventTable ? await all('PRAGMA table_info(event)') : [];
    const hasCurrentEventSchema = eventColumns.some(column => column.name === 'title');

    if (!eventTable) {
        await run(`
            CREATE TABLE event (
                eventId INTEGER PRIMARY KEY AUTOINCREMENT,
                organizerId INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                eventDate TEXT NOT NULL,
                eventTime TEXT,
                location TEXT,
                image TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organizerId) REFERENCES organizer(organizerId) ON DELETE CASCADE
            )
        `);
    } else if (!hasCurrentEventSchema) {
        await run('BEGIN IMMEDIATE TRANSACTION');
        try {
            await run('ALTER TABLE event RENAME TO event_legacy');
            await run(`
                CREATE TABLE event (
                    eventId INTEGER PRIMARY KEY AUTOINCREMENT,
                    organizerId INTEGER,
                    title TEXT NOT NULL,
                    description TEXT,
                    eventDate TEXT NOT NULL,
                    eventTime TEXT,
                    location TEXT,
                    image TEXT,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (organizerId) REFERENCES organizer(organizerId) ON DELETE CASCADE
                )
            `);
            await run(`
                INSERT INTO event (eventId, title, description, eventDate, eventTime, location, createdAt)
                SELECT eventId, eventTitle, eventDescription, eventDate, eventTime, location, createdAt
                FROM event_legacy
            `);
            await run('DROP TABLE event_legacy');
            await run('COMMIT');
        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }
    }

    await new Promise((resolve, reject) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS eventRegistration (
                registrationId INTEGER PRIMARY KEY AUTOINCREMENT,
                eventId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                registeredAt TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (eventId, studentId),
                FOREIGN KEY (eventId) REFERENCES event(eventId) ON DELETE CASCADE,
                FOREIGN KEY (studentId) REFERENCES student(studentId) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS favoritePlace (
                favoriteId INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER NOT NULL,
                placeId INTEGER NOT NULL,
                UNIQUE (studentId, placeId),
                FOREIGN KEY (studentId) REFERENCES student(studentId) ON DELETE CASCADE,
                FOREIGN KEY (placeId) REFERENCES place(placeId) ON DELETE CASCADE
            );
        `, error => error ? reject(error) : resolve());
    });

    console.log(`Using SQLite database: ${databasePath}`);
}

function isDatabaseReady() {
    return Boolean(database);
}

module.exports = {
    connectToDatabase,
    closeDatabase,
    getDatabase,
    getDatabasePath,
    isDatabaseReady,
    run,
    all,
    get
};
