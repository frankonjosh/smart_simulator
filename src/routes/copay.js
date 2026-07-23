import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';

export function registerCopay(app) {
    app.post('/copay/setup', async (req, reply) => {
        const b = req.body || {};
        db.prepare(`
            INSERT INTO copays (integ_scheme_code, integ_cat_code, integ_ben_code, integ_prov_code, integ_service_code, copay_type, amount, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(b.integ_scheme_code, b.integ_cat_code, b.integ_ben_code, b.integ_prov_code, b.integ_service_code, b.copay_type, b.amount, req.query.country);
        return reply.send(smartOK());
    });
}
