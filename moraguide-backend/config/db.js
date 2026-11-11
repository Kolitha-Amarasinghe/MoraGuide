const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@tursodatabase/serverless/compat');

const defaultDatabasePath = path.resolve(__dirname, '..', '..', 'Moraguide.sqlite');
let database;
let tursoClient;
let databaseReady = false;
let databaseReadyPromise;

function isTursoConfigured() {
    return Boolean(process.env.TURSO_DATABASE_URL);
}

function getDatabasePath() {
    const configuredPath = process.env.DATABASE_PATH || process.env.SQLITE_DB_PATH;
    if (!configuredPath) return defaultDatabasePath;
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '..', configuredPath);
}

function getTursoClient() {
    if (!tursoClient) {
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!authToken) {
            throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set.');
        }
        tursoClient = createClient({ url, authToken });
    }
    return tursoClient;
}

function getDatabase() {
    if (isTursoConfigured()) {
        throw new Error('The native SQLite connection is unavailable when Turso is configured.');
    }
    if (!database) {
        const databasePath = getDatabasePath();
        const sqlite3 = require('sqlite3').verbose();
        fs.mkdirSync(path.dirname(databasePath), { recursive: true });
        database = new sqlite3.Database(databasePath);
    }
    return database;
}

function mapRemoteRow(row, columns) {
    const record = {};
    columns.forEach((column, index) => {
        const value = row[index];
        record[column] = value instanceof Uint8Array && !Buffer.isBuffer(value)
            ? Buffer.from(value)
            : value;
    });
    return record;
}

function createRemoteOperations(connection) {
    return {
        async run(sql, params = []) {
            const result = await connection.execute({ sql, args: params });
            return {
                id: result.lastInsertRowid === undefined ? undefined : Number(result.lastInsertRowid),
                changes: result.rowsAffected
            };
        },
        async all(sql, params = []) {
            const result = await connection.execute({ sql, args: params });
            return result.rows.map(row => mapRemoteRow(row, result.columns));
        },
        async get(sql, params = []) {
            const result = await connection.execute({ sql, args: params });
            return result.rows.length ? mapRemoteRow(result.rows[0], result.columns) : undefined;
        }
    };
}

function run(sql, params = []) {
    if (isTursoConfigured()) {
        return createRemoteOperations(getTursoClient()).run(sql, params);
    }
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
    if (isTursoConfigured()) {
        return createRemoteOperations(getTursoClient()).all(sql, params);
    }
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
    if (isTursoConfigured()) {
        return createRemoteOperations(getTursoClient()).get(sql, params);
    }
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

async function withTransaction(callback) {
    if (isTursoConfigured()) {
        const transaction = await getTursoClient().transaction('write');
        try {
            const result = await callback(createRemoteOperations(transaction));
            await transaction.commit();
            return result;
        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                error.rollbackError = rollbackError;
            }
            throw error;
        }
    }

    await run('BEGIN IMMEDIATE TRANSACTION');
    try {
        const result = await callback({ run, all, get });
        await run('COMMIT');
        return result;
    } catch (error) {
        try {
            await run('ROLLBACK');
        } catch (rollbackError) {
            error.rollbackError = rollbackError;
        }
        throw error;
    }
}

async function closeDatabase() {
    databaseReady = false;
    databaseReadyPromise = undefined;

    if (tursoClient) {
        tursoClient.close();
        tursoClient = undefined;
    }
    if (!database) {
        return;
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

async function initializeDatabase() {
    if (process.env.VERCEL && !isTursoConfigured()) {
        throw new Error('TURSO_DATABASE_URL must be configured on Vercel; serverless filesystem storage is not persistent.');
    }

    if (isTursoConfigured()) {
        const client = getTursoClient();
        await client.executeMultiple(`
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
        `);
    } else {
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
    }

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
        await withTransaction(async ({ run: transactionRun }) => {
            await transactionRun('ALTER TABLE event RENAME TO event_legacy');
            await transactionRun(`
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
            await transactionRun(`
                INSERT INTO event (eventId, title, description, eventDate, eventTime, location, createdAt)
                SELECT eventId, eventTitle, eventDescription, eventDate, eventTime, location, createdAt
                FROM event_legacy
            `);
            await transactionRun('DROP TABLE event_legacy');
        });
    }

    const relationshipTables = `
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
        `;
    if (isTursoConfigured()) {
        await getTursoClient().executeMultiple(relationshipTables);
    } else {
        await new Promise((resolve, reject) => {
            getDatabase().exec(relationshipTables, error => error ? reject(error) : resolve());
        });
    }

    databaseReady = true;
    console.log(isTursoConfigured()
        ? 'Connected to Turso database.'
        : `Using SQLite database: ${getDatabasePath()}`);
}

function connectToDatabase() {
    if (!databaseReadyPromise) {
        databaseReadyPromise = initializeDatabase().catch(error => {
            databaseReady = false;
            databaseReadyPromise = undefined;
            throw error;
        });
    }
    return databaseReadyPromise;
}

function isDatabaseReady() {
    return databaseReady;
}

module.exports = {
    connectToDatabase,
    closeDatabase,
    getDatabase,
    getDatabasePath,
    isDatabaseReady,
    run,
    all,
    get,
    withTransaction
};
