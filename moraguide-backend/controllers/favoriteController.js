const { all, get, run } = require('../config/db');

async function list(request, response) {
    const places = await all(`
        SELECT p.placeId AS id, p.placeName AS name, p.category, p.description,
            p.latitude AS lat, p.longitude AS lng, p.icon
        FROM favoritePlace f
        JOIN place p ON p.placeId = f.placeId
        WHERE f.studentId = ?
        ORDER BY p.placeName ASC
    `, [request.user.studentId]);
    response.json({ data: places });
}

async function add(request, response) {
    const place = await get('SELECT placeId FROM place WHERE placeId = ?', [request.params.id]);
    if (!place) return response.status(404).json({ error: 'Place not found.' });

    try {
        await run('INSERT INTO favoritePlace (studentId, placeId) VALUES (?, ?)', [
            request.user.studentId,
            request.params.id
        ]);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
            return response.status(409).json({ error: 'This place is already in your favorites.' });
        }
        throw error;
    }
    response.status(201).json({ data: { favorite: true } });
}

async function remove(request, response) {
    await run('DELETE FROM favoritePlace WHERE studentId = ? AND placeId = ?', [
        request.user.studentId,
        request.params.id
    ]);
    response.status(204).end();
}

module.exports = { add, list, remove };
