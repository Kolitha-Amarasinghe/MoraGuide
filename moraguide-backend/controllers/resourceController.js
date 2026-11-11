function createResourceController(Model, fields, { sort = { createdAt: -1 } } = {}) {
    return {
        async list(_request, response) {
            const documents = await Model.find();
            if (sort && typeof sort === 'object' && !Array.isArray(sort)) {
                const entries = Object.entries(sort);
                const sorted = [...documents].sort((a, b) => {
                    for (const [key, direction] of entries) {
                        const valueA = a[key] ?? '';
                        const valueB = b[key] ?? '';
                        const comparison = String(valueA).localeCompare(String(valueB));
                        if (comparison !== 0) {
                            return direction === 1 ? comparison : -comparison;
                        }
                    }
                    return 0;
                });
                response.json({ data: sorted });
                return;
            }
            response.json({ data: documents });
        },

        async get(request, response) {
            const document = await Model.findById(request.params.id);
            if (!document) return response.status(404).json({ error: 'Record not found.' });
            response.json({ data: document });
        },

        async create(request, response) {
            const values = Object.fromEntries(fields
                .filter(field => request.body[field] !== undefined)
                .map(field => [field, request.body[field]]));
            const document = await Model.create(values);
            response.status(201).json({ data: document });
        },

        async update(request, response) {
            const values = Object.fromEntries(fields
                .filter(field => request.body[field] !== undefined)
                .map(field => [field, request.body[field]]));
            if (Object.keys(values).length === 0) {
                return response.status(400).json({ error: 'Provide at least one supported field to update.' });
            }

            const document = await Model.findByIdAndUpdate(request.params.id, values);
            if (!document) return response.status(404).json({ error: 'Record not found.' });
            response.json({ data: document });
        },

        async remove(request, response) {
            const document = await Model.findByIdAndDelete(request.params.id);
            if (!document) return response.status(404).json({ error: 'Record not found.' });
            response.status(204).end();
        }
    };
}

module.exports = createResourceController;
