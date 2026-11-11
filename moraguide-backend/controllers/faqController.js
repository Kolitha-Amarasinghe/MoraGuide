const Faq = require('../models/faqModel');
const createResourceController = require('./resourceController');

module.exports = createResourceController(Faq, ['question', 'answer'], {
    sort: { createdAt: 1 }
});
