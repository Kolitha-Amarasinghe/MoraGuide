const { all, get, run } = require('../config/db');

function mapEvent(row) {
    if (!row) return null;
    return {
        id: row.eventId,
        title: row.eventTitle,
        description: row.eventDescription || '',
        date: row.eventDate,
        time: row.eventTime || '09:00',
        venue: row.location || ''
    };
}

const Event = {
    async find() {
        const rows = await all('SELECT * FROM event ORDER BY eventDate ASC, eventTime ASC');
        return rows.map(mapEvent);
    },

    async findById(id) {
        const row = await get('SELECT * FROM event WHERE eventId = ?', [id]);
        return mapEvent(row);
    },

    async create(values) {
        const { title, description, date, time, venue } = values;
        const result = await run(
            'INSERT INTO event (eventTitle, eventDescription, eventDate, eventTime, location) VALUES (?, ?, ?, ?, ?)',
            [title, description || '', date, time || '09:00', venue || '']
        );
        return this.findById(result.id);
    },

    async findByIdAndUpdate(id, values) {
        const updates = [];
        const params = [];

        if (values.title !== undefined) { updates.push('eventTitle = ?'); params.push(values.title); }
        if (values.description !== undefined) { updates.push('eventDescription = ?'); params.push(values.description || ''); }
        if (values.date !== undefined) { updates.push('eventDate = ?'); params.push(values.date); }
        if (values.time !== undefined) { updates.push('eventTime = ?'); params.push(values.time || '09:00'); }
        if (values.venue !== undefined) { updates.push('location = ?'); params.push(values.venue || ''); }

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        await run(`UPDATE event SET ${updates.join(', ')} WHERE eventId = ?`, params);
        return this.findById(id);
    },

    async findByIdAndDelete(id) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await run('DELETE FROM event WHERE eventId = ?', [id]);
        return existing;
    }
};

module.exports = Event;
