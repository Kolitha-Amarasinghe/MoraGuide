require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectToDatabase, closeDatabase, isDatabaseReady } = require('./config/db');
const { profileImageDirectory } = require('./config/profileImages');

const app = express();
const port = Number(process.env.PORT) || 3000;
const defaultFrontendOrigins = process.env.NODE_ENV === 'production'
    ? ['https://mora-guide-ut2w.vercel.app']
    : ['http://localhost:5173', 'https://mora-guide-ut2w.vercel.app'];
const allowedFrontendOrigins = new Set(
    (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(','))
        .split(',').map(origin => origin.trim()).filter(Boolean)
);

app.disable('x-powered-by');
const frontendDist = path.resolve(__dirname, '..', 'moraguide-frontend', 'dist');
const frontendEntry = path.join(frontendDist, 'index.html');

app.use(cors({
    origin: [...allowedFrontendOrigins],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use((request, response, next) => {
    const origin = request.get('Origin');
    if (origin && !allowedFrontendOrigins.has(origin)) {
        return response.status(403).json({ error: 'This origin is not allowed.' });
    }
    next();
});

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'https://routing.openstreetmap.de'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));
app.use(express.json({ limit: '10kb' }));
app.use('/api', (request, response, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method) &&
        !(request.method === 'PUT' && request.path === '/auth/profile/image') &&
        (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))) {
        return response.status(400).json({ error: 'Request body must be a JSON object.' });
    }
    next();
});
let databaseInitialization;
app.use((request, response, next) => {
    if (!databaseInitialization) {
        databaseInitialization = connectToDatabase().catch(error => {
            databaseInitialization = undefined;
            throw error;
        });
    }
    databaseInitialization.then(() => next()).catch(next);
});

app.use(express.static(frontendDist, { index: false }));
app.use('/uploads/profile-images', express.static(profileImageDirectory, {
    index: false,
    immutable: true,
    maxAge: '1y'
}));

app.get('/', (_request, response, next) => {
    if (!fs.existsSync(frontendEntry)) {
        return response.json({ service: 'MoraGuide API', health: '/api/health' });
    }
    response.sendFile(frontendEntry, error => {
        if (error) next(new Error('React frontend build not found. Run `npm run build` from the project root.', { cause: error }));
    });
});

app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', database: isDatabaseReady() ? 'connected' : 'disconnected' });
});

app.use('/api/places', require('./routes/placeRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/faqs', require('./routes/faqRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'API endpoint not found.' });
});

app.get('/{*path}', (_request, response, next) => {
    if (!fs.existsSync(frontendEntry)) {
        return response.status(404).json({ error: 'API endpoint not found.' });
    }
    response.sendFile(frontendEntry, error => {
        if (error) next(new Error('React frontend build not found. Run `npm run build` from the project root.', { cause: error }));
    });
});

app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return response.status(400).json({ error: 'Request body must contain valid JSON.' });
    }
    if (error.type === 'entity.too.large') {
        return response.status(413).json({ error: 'Request body is too large.' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'StrictModeError') {
        const message = error.name === 'ValidationError'
            ? Object.values(error.errors).map(item => item.message).join(' ')
            : 'Invalid record ID or field value.';
        return response.status(400).json({ error: message });
    }

    console.error('Request failed:', error);
    response.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.get('/api/debug-db', async (req, res) => {
  try {
    const { all } = require('./config/db');
    const rows = await all('SELECT * FROM place');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

let server;

async function start() {
    await connectToDatabase();
    server = app.listen(port, () => {
        console.log(`MoraGuide server listening at http://localhost:${port}`);
    });
}

async function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`);
    if (server) {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
    await closeDatabase();
    process.exit(0);
}

module.exports = app;

if (require.main === module) {
    process.on('SIGINT', () => shutdown('SIGINT').catch(error => {
        console.error('Shutdown failed:', error);
        process.exit(1);
    }));
    process.on('SIGTERM', () => shutdown('SIGTERM').catch(error => {
        console.error('Shutdown failed:', error);
        process.exit(1);
    }));

    start().catch(error => {
        console.error('Server startup failed:', error);
        process.exitCode = 1;
    });
}
