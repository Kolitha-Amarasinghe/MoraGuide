const { all, get, run } = require('../config/db');

function mapPlace(row) {
    if (!row) return null;
    return {
        id: row.placeId,
        name: row.placeName,
        category: row.category,
        description: row.description || '',
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        icon: row.icon || 'fa-location-dot'
    };
}

const Place = {
    async find() {
        const rows = await all('SELECT * FROM place ORDER BY placeName ASC');
        return rows.map(mapPlace);
    },

    async findById(id) {
        const row = await get('SELECT * FROM place WHERE placeId = ?', [id]);
        return mapPlace(row);
    },

    async create(values) {
        const { name, category, description, lat, lng, icon } = values;
        const result = await run(
            'INSERT INTO place (placeName, category, description, latitude, longitude, icon) VALUES (?, ?, ?, ?, ?, ?)',
            [name, category, description || '', lat, lng, icon || 'fa-location-dot']
        );
        return this.findById(result.id);
    },

    async findByIdAndUpdate(id, values) {
        const updates = [];
        const params = [];

        if (values.name !== undefined) { updates.push('placeName = ?'); params.push(values.name); }
        if (values.category !== undefined) { updates.push('category = ?'); params.push(values.category); }
        if (values.description !== undefined) { updates.push('description = ?'); params.push(values.description || ''); }
        if (values.lat !== undefined) { updates.push('latitude = ?'); params.push(values.lat); }
        if (values.lng !== undefined) { updates.push('longitude = ?'); params.push(values.lng); }
        if (values.icon !== undefined) { updates.push('icon = ?'); params.push(values.icon || 'fa-location-dot'); }

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        await run(`UPDATE place SET ${updates.join(', ')} WHERE placeId = ?`, params);
        return this.findById(id);
    },

    async findByIdAndDelete(id) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await run('DELETE FROM place WHERE placeId = ?', [id]);
        return existing;
    }
};

module.exports = Place;
