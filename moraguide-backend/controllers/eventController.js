const { all, get, run } = require('../config/db');

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function eventValues(body, partial = false) {
    const values = {};
    for (const [field, column, maxLength] of [
        ['title', 'title', 200],
        ['description', 'description', 5000],
        ['date', 'eventDate', 10],
        ['time', 'eventTime', 5],
        ['venue', 'location', 200]
    ]) {
        if (body[field] === undefined && partial) continue;
        const value = body[field] === undefined && field === 'description' ? '' : body[field];
        if (field === 'date') {
            if (!isValidDate(value) || value < getLocalDateString()) {
                return { error: 'Event date must be today or a future date.' };
            }
        } else if (field === 'time') {
            if (typeof value !== 'string' || !timePattern.test(value)) {
                return { error: 'Enter a valid event time.' };
            }
        } else if (typeof value !== 'string' || (field !== 'description' && !value.trim()) || value.trim().length > maxLength) {
            return { error: `Enter a valid ${field}.` };
        }
        values[column] = field === 'date' || field === 'time' ? value : value.trim();
    }

    return { values };
}

async function findEvent(id) {
    return get(`
        SELECT e.eventId AS id, e.organizerId, e.title, e.description,
            e.eventDate AS date, substr(e.eventTime, 1, 5) AS time, e.location AS venue, e.image,
            e.createdAt, o.organizationName,
            (SELECT COUNT(*) FROM eventRegistration r WHERE r.eventId = e.eventId) AS registrationCount
        FROM event e
        LEFT JOIN organizer o ON o.organizerId = e.organizerId
        WHERE e.eventId = ?
    `, [id]);
}

function canManage(request, event) {
    return request.user.role === 'admin' ||
        (request.user.role === 'organizer' && event.organizerId === request.user.organizerId);
}

async function list(_request, response) {
    const events = await all(`
        SELECT e.eventId AS id, e.organizerId, e.title, e.description,
            e.eventDate AS date, substr(e.eventTime, 1, 5) AS time, e.location AS venue, e.image,
            e.createdAt, o.organizationName,
            (SELECT COUNT(*) FROM eventRegistration r WHERE r.eventId = e.eventId) AS registrationCount
        FROM event e
        LEFT JOIN organizer o ON o.organizerId = e.organizerId
        ORDER BY e.eventDate ASC, e.eventTime ASC, e.eventId ASC
    `);
    response.json({ data: events });
}

async function listMine(request, response) {
    const events = request.user.role === 'admin'
        ? await all(`
            SELECT e.eventId AS id, e.organizerId, e.title, e.description, e.eventDate AS date,
                substr(e.eventTime, 1, 5) AS time, e.location AS venue, e.image, e.createdAt,
                (SELECT COUNT(*) FROM eventRegistration r WHERE r.eventId = e.eventId) AS registrationCount
            FROM event e
            ORDER BY e.eventDate ASC, e.eventTime ASC
        `)
        : await all(`
            SELECT e.eventId AS id, e.organizerId, e.title, e.description, e.eventDate AS date,
                substr(e.eventTime, 1, 5) AS time, e.location AS venue, e.image, e.createdAt,
                (SELECT COUNT(*) FROM eventRegistration r WHERE r.eventId = e.eventId) AS registrationCount
            FROM event e
            WHERE e.organizerId = ?
            ORDER BY e.eventDate ASC, e.eventTime ASC
        `, [request.user.organizerId]);
    response.json({ data: events });
}

async function getOne(request, response) {
    const event = await findEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    response.json({ data: event });
}

async function create(request, response) {
    const { values, error } = eventValues(request.body);
    if (error) return response.status(400).json({ error });

    const result = await run(`
        INSERT INTO event (organizerId, title, description, eventDate, eventTime, location)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        request.user.organizerId,
        values.title,
        values.description,
        values.eventDate,
        values.eventTime,
        values.location
    ]);
    response.status(201).json({ data: await findEvent(result.id) });
}

async function update(request, response) {
    const event = await findEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    if (!canManage(request, event)) return response.status(403).json({ error: 'You can only manage your own events.' });

    const { values, error } = eventValues(request.body, true);
    if (error) return response.status(400).json({ error });
    const entries = Object.entries(values);
    if (entries.length === 0) return response.status(400).json({ error: 'Provide at least one event field to update.' });

    await run(`UPDATE event SET ${entries.map(([column]) => `${column} = ?`).join(', ')} WHERE eventId = ?`, [
        ...entries.map(([, value]) => value),
        request.params.id
    ]);
    response.json({ data: await findEvent(request.params.id) });
}

async function remove(request, response) {
    const event = await findEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    if (!canManage(request, event)) return response.status(403).json({ error: 'You can only manage your own events.' });
    await run('DELETE FROM event WHERE eventId = ?', [request.params.id]);
    response.status(204).end();
}

async function registerStudent(request, response) {
    const event = await findEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    if (event.date < getLocalDateString()) {
        return response.status(400).json({ error: 'Registration is closed for past events.' });
    }

    try {
        await run('INSERT INTO eventRegistration (eventId, studentId) VALUES (?, ?)', [
            request.params.id,
            request.user.studentId
        ]);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
            return response.status(409).json({ error: 'You are already registered for this event.' });
        }
        throw error;
    }
    response.status(201).json({ data: { registered: true } });
}

async function unregisterStudent(request, response) {
    await run('DELETE FROM eventRegistration WHERE eventId = ? AND studentId = ?', [
        request.params.id,
        request.user.studentId
    ]);
    response.status(204).end();
}

async function listRegistrations(request, response) {
    const registrations = await all(`
        SELECT e.eventId AS id, e.title, e.description, e.eventDate AS date, substr(e.eventTime, 1, 5) AS time,
            e.location AS venue, r.registeredAt
        FROM eventRegistration r
        JOIN event e ON e.eventId = r.eventId
        WHERE r.studentId = ?
        ORDER BY e.eventDate ASC, e.eventTime ASC
    `, [request.user.studentId]);
    response.json({ data: registrations });
}

async function listAttendees(request, response) {
    const event = await findEvent(request.params.id);
    if (!event) return response.status(404).json({ error: 'Event not found.' });
    if (!canManage(request, event)) return response.status(403).json({ error: 'You can only view attendees for your own events.' });

    const attendees = await all(`
        SELECT u.firstName, u.lastName, u.email, s.registrationNumber, r.registeredAt
        FROM eventRegistration r
        JOIN student s ON s.studentId = r.studentId
        JOIN users u ON u.userId = s.userId
        WHERE r.eventId = ?
        ORDER BY r.registeredAt ASC
    `, [request.params.id]);
    response.json({ data: attendees });
}

module.exports = {
    create,
    getOne,
    list,
    listAttendees,
    listMine,
    listRegistrations,
    registerStudent,
    remove,
    unregisterStudent,
    update
};
