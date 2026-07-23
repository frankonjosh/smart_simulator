import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';

export function registerRemittance(app) {
    app.post('/edi/open/batch', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO batches (integ_batch_code, integ_prov_code, integ_app_code, status, country)
            VALUES (?, ?, ?, 'open', ?)
        `).run(q.integ_batch_code, q.integ_prov_code, q.integ_app_code, q.country_code);
        return reply.send(smartOK(q.integ_batch_code));
    });

    app.post('/edi/close/batch', async (req, reply) => {
        db.prepare(`UPDATE batches SET status='closed' WHERE integ_batch_code=?`).run(req.query.integ_batch_code);
        return reply.send(smartOK(req.query.integ_batch_code));
    });

    app.post('/edi/batch/invoice/add', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO batch_invoices (integ_batch_code, inv_no, rejected_amt, comment)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(integ_batch_code, inv_no) DO UPDATE SET rejected_amt=excluded.rejected_amt, comment=excluded.comment
        `).run(q.integ_batch_code, q.invNo, parseFloat(q.rejectedAmt || '0'), q.Comment);
        return reply.send(smartOK(q.invNo));
    });

    app.post('/edi/batch/invoice/tracking', async (_req, reply) => reply.send(smartOK()));

    app.post('/edi/batch/pay', async (req, reply) => {
        const list = (req.body || {}).integBatchPayment || [];
        for (const p of list) {
            if (p.close_batch) {
                db.prepare(`UPDATE batches SET status='paid' WHERE integ_batch_code=?`).run(p.integ_batch_code);
            }
        }
        return reply.send(smartOK());
    });
}
