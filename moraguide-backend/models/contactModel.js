const { run } = require('../config/db');

const Contact = {
    async create(values) {
        const { name, email, subject, message } = values;
        const result = await run(
            'INSERT INTO contactMessage (userName, email, subject, message) VALUES (?, ?, ?, ?)',
            [name, email, subject || '', message]
        );
        return { id: result.id };
    }
};

module.exports = Contact;
