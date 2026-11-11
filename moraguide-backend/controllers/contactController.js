const Contact = require('../models/contactModel');

async function create(request, response) {
    const { name, email, subject, message } = request.body;
    const contact = await Contact.create({ name, email, subject, message });
    response.status(201).json({
        message: 'Your message has been received.',
        data: { id: contact.id }
    });
}

module.exports = { create };
