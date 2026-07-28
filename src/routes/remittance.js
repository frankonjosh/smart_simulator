import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { pickCountry } from '../util/params.js';

export function registerRemittance(app) {
    // §1.4  POST /edi/open/batch
    // Params: country_code, integ_prov_code, integ_batch_code, integ_user_name, integ_app_code
    app.post('/edi/open/batch', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO batches (integ_batch_code, integ_prov_code, integ_app_code, integ_user_name, status, country)
            VALUES (?, ?, ?, ?, 'open', ?)
            ON CONFLICT(integ_batch_code) DO UPDATE SET
                integ_prov_code=excluded.integ_prov_code,
                integ_app_code=excluded.integ_app_code,
                integ_user_name=excluded.integ_user_name,
                status='open',
                country=excluded.country,
                updated_at=datetime('now')
        `).run(q.integ_batch_code, q.integ_prov_code, q.integ_app_code, q.integ_user_name || null, country);
        return reply.send(smartOK(q.integ_batch_code, result.changes));
    });

    // §1.4  POST /edi/close/batch
    // Params: country_code, integ_batch_code, integ_app_code
    app.post('/edi/close/batch', async (req, reply) => {
        const q = req.query;
        const result = db.prepare(`
            UPDATE batches SET status='closed', updated_at=datetime('now')
            WHERE integ_batch_code=?
        `).run(q.integ_batch_code);
        return reply.send(smartOK(q.integ_batch_code, result.changes));
    });

    // §1.4  POST /edi/batch/invoice/add
    // Params: Country, isOverrideBatch, integProvCode, Customerid, invNo,
    //         rejectedAmt, Comment, is_integ, integ_batch_code
    app.post('/edi/batch/invoice/add', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO batch_invoices (
                integ_batch_code, inv_no, integ_prov_code, customerid,
                is_override_batch, is_integ, rejected_amt, comment
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(integ_batch_code, inv_no) DO UPDATE SET
                integ_prov_code=excluded.integ_prov_code,
                customerid=excluded.customerid,
                is_override_batch=excluded.is_override_batch,
                is_integ=excluded.is_integ,
                rejected_amt=excluded.rejected_amt,
                comment=excluded.comment,
                updated_at=datetime('now')
        `).run(
            q.integ_batch_code,
            q.invNo,
            q.integProvCode || null,
            q.Customerid || q.customerid || null,
            q.isOverrideBatch != null ? (q.isOverrideBatch === 'true' ? 1 : 0) : null,
            q.is_integ != null ? parseInt(q.is_integ, 10) : null,
            parseFloat(q.rejectedAmt || '0'),
            q.Comment || q.comment || null,
        );
        return reply.send(smartOK(q.invNo, result.changes));
    });

    // §2.3 Invoice Status  GET /edi/batch/invoice/add — returns invoice status
    // The guide §2.3 documents this as a GET on the same path as invoice/add.
    // It shares the same query params (isOverrideBatch, custId, integProvCode,
    // invNo, rejectedAmt, comment) but performs a status lookup rather than write.
    app.get('/edi/batch/invoice/add', async (req, reply) => {
        const q = req.query;
        const row = db.prepare(`
            SELECT * FROM batch_invoices WHERE inv_no=?
        `).get(q.invNo || q.Invoice_Number);
        if (!row) {
            return reply.send(smartOK(q.invNo || '', 0));
        }
        return reply.send(smartOK(row.inv_no, 1));
    });

    // §1.4  POST /edi/batch/invoice/tracking
    // Query: country_code, integ_app_code
    // Body (array of tracking objects):
    //   integ_invoice_status, payer_invoice_status, integ_prov_code, invoice_number
    app.post('/edi/batch/invoice/tracking', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const items = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
        let changes = 0;
        const stmt = db.prepare(`
            INSERT INTO batch_invoice_tracking (
                country_code, integ_app_code,
                integ_invoice_status, payer_invoice_status, integ_prov_code, invoice_number
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
            const r = stmt.run(
                country,
                q.integ_app_code || null,
                item.integ_invoice_status != null ? parseInt(item.integ_invoice_status, 10) : null,
                item.payer_invoice_status || null,
                item.integ_prov_code || null,
                item.invoice_number || null,
            );
            changes += r.changes;
        }
        // If body was a single object (not array), also handle that gracefully (already done above).
        return reply.send(smartOK(q.integ_app_code || 'XXXXXX', changes));
    });

    // §1.4  POST /edi/batch/pay
    // Query: country_code, integ_app_code
    // Body: { integBatchPayment: [ { integ_batch_code, close_batch, integ_payment_date,
    //          payment_mode, payment_reference, amount, integ_bank_code,
    //          integ_bank_name, integ_bank_account_code, integ_prov_code } ] }
    app.post('/edi/batch/pay', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const list = (req.body || {}).integBatchPayment || [];
        let changes = 0;

        const payStmt = db.prepare(`
            INSERT INTO batch_payments (
                integ_batch_code, close_batch, integ_payment_date,
                payment_mode, payment_reference, amount,
                integ_bank_code, integ_bank_name, integ_bank_account_code,
                integ_prov_code, country, integ_app_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of list) {
            const r = payStmt.run(
                p.integ_batch_code || null,
                p.close_batch != null ? parseInt(p.close_batch, 10) : null,
                p.integ_payment_date || null,
                p.payment_mode || null,
                p.payment_reference || null,
                p.amount != null ? parseFloat(p.amount) : null,
                p.integ_bank_code || null,
                p.integ_bank_name || null,
                p.integ_bank_account_code || null,
                p.integ_prov_code || null,
                country,
                q.integ_app_code || null,
            );
            changes += r.changes;

            if (p.close_batch) {
                db.prepare(`UPDATE batches SET status='paid', updated_at=datetime('now') WHERE integ_batch_code=?`).run(p.integ_batch_code);
            }
        }
        return reply.send(smartOK(q.integ_app_code || 'XXXXXX', changes));
    });
}
