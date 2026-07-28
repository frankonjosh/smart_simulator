import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { pickCountry } from '../util/params.js';

export function registerCopay(app) {
    // §1.3  POST /copay/setup — configures member copay rules.
    // Query params: country, customerid.
    // Body params:  integ_scheme_code, integ_cat_code, integ_ben_code,
    //               integ_prov_code, integ_service_code, copay_type, amount.
    app.post('/copay/setup', async (req, reply) => {
        const q = req.query;
        const b = req.body || {};
        const country = pickCountry(q);

        const result = db.prepare(`
            INSERT INTO copays (
                integ_scheme_code, integ_cat_code, integ_ben_code,
                integ_prov_code, integ_service_code, copay_type, amount,
                customerid, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(integ_scheme_code, integ_cat_code, integ_ben_code, integ_prov_code, integ_service_code)
            DO UPDATE SET
                copay_type=excluded.copay_type,
                amount=excluded.amount,
                customerid=excluded.customerid,
                country=excluded.country,
                updated_at=datetime('now')
        `).run(
            b.integ_scheme_code || null,
            b.integ_cat_code || null,
            b.integ_ben_code || null,
            b.integ_prov_code || null,
            b.integ_service_code || null,
            b.copay_type != null ? parseInt(b.copay_type, 10) : null,
            b.amount != null ? parseFloat(b.amount) : null,
            q.customerid || null,
            country,
        );
        return reply.send(smartOK(b.integ_scheme_code || 'XXXXXX', result.changes));
    });
}
