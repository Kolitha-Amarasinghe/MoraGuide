const { all, get, run } = require('../config/db');

function mapFaq(row) {
    if (!row) return null;
    return {
        id: row.faqId,
        question: row.question,
        answer: row.answer
    };
}

const Faq = {
    async find() {
        const rows = await all('SELECT * FROM faq ORDER BY faqId ASC');
        return rows.map(mapFaq);
    },

    async findById(id) {
        const row = await get('SELECT * FROM faq WHERE faqId = ?', [id]);
        return mapFaq(row);
    },

    async create(values) {
        const { question, answer } = values;
        const result = await run('INSERT INTO faq (question, answer) VALUES (?, ?)', [question, answer]);
        return this.findById(result.id);
    },

    async findByIdAndUpdate(id, values) {
        const updates = [];
        const params = [];

        if (values.question !== undefined) { updates.push('question = ?'); params.push(values.question); }
        if (values.answer !== undefined) { updates.push('answer = ?'); params.push(values.answer); }

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        await run(`UPDATE faq SET ${updates.join(', ')} WHERE faqId = ?`, params);
        return this.findById(id);
    },

    async findByIdAndDelete(id) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await run('DELETE FROM faq WHERE faqId = ?', [id]);
        return existing;
    }
};

module.exports = Faq;
