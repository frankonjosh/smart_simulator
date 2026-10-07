// Corporate FT stand-in. Curis sends one instruction per batch, one line per
// voucher, keyed by the voucher number. The outcome follows the account
// number's last digit so every path can be exercised:
//   ends in 9 → failed ("Account closed")
//   ends in 8 → not known yet; the first status enquiry then answers paid
//   otherwise → paid, with an FT reference
// A line already paid, or not known yet, is never attempted again — sending it
// again returns the first answer, the way a bank refuses a duplicate.
import crypto from 'node:crypto';
import { db } from '../store/db.js';
import { info } from '../util/log.js';

const ftReference = () => 'FT' + crypto.randomInt(1_000_000_000, 9_999_999_999).toString();
const today = () => new Date().toISOString().slice(0, 10);

function decide(line) {
    const last = String(line.account_number || '').trim().slice(-1);
    if (last === '9') return { status: 'failed', reason: 'Account closed' };
    if (last === '8') return { status: 'unknown' };
    return { status: 'paid', reference: ftReference(), paid_on: today() };
}

function toOutcome(r) {
    const o = { line_ref: r.line_ref, status: r.status };
    if (r.reference) o.reference = r.reference;
    if (r.reason) o.reason = r.reason;
    if (r.paid_on) o.paid_on = r.paid_on;
    return o;
}

export function registerCorporateFT(app) {
    const find = db.prepare('SELECT * FROM ft_lines WHERE line_ref = ?');
    const save = db.prepare(`
        INSERT INTO ft_lines (line_ref, instruction_ref, amount, account_number, account_name, bank_code,
                              branch_code, status, reference, reason, paid_on)
        VALUES (@line_ref, @instruction_ref, @amount, @account_number, @account_name, @bank_code,
                @branch_code, @status, @reference, @reason, @paid_on)
        ON CONFLICT(line_ref) DO UPDATE SET
            instruction_ref = excluded.instruction_ref, amount = excluded.amount,
            account_number = excluded.account_number, account_name = excluded.account_name,
            bank_code = excluded.bank_code, branch_code = excluded.branch_code, status = excluded.status,
            reference = excluded.reference, reason = excluded.reason, paid_on = excluded.paid_on,
            attempts = ft_lines.attempts + 1, updated_at = datetime('now')`);

    app.post('/corporate-ft/instructions', async (req, reply) => {
        const body = req.body || {};
        const lines = Array.isArray(body.lines) ? body.lines : [];
        if (!body.instruction_ref || lines.length === 0) {
            return reply.code(400).send({ error: 'instruction_ref and at least one line are required' });
        }
        const out = [];
        for (const l of lines) {
            const prior = find.get(l.line_ref);
            if (prior && (prior.status === 'paid' || prior.status === 'unknown')) {
                out.push(toOutcome(prior));
                continue;
            }
            const d = decide(l);
            const row = {
                line_ref: l.line_ref, instruction_ref: body.instruction_ref, amount: Number(l.amount) || 0,
                account_number: l.account_number || '', account_name: l.account_name || '',
                bank_code: l.bank_code || '', branch_code: l.branch_code || '',
                status: d.status, reference: d.reference || '', reason: d.reason || '', paid_on: d.paid_on || '',
            };
            save.run(row);
            out.push(toOutcome(row));
        }
        info('corporate-ft instruction', { instruction_ref: body.instruction_ref, lines: out.map((o) => `${o.line_ref}=${o.status}`) });
        return { instruction_ref: body.instruction_ref, lines: out };
    });

    app.get('/corporate-ft/lines/:ref', async (req, reply) => {
        const row = find.get(req.params.ref);
        if (!row) return reply.code(404).send({ error: 'no such payment' });
        if (row.status === 'unknown') {
            row.status = 'paid';
            row.reference = ftReference();
            row.paid_on = today();
            db.prepare(`UPDATE ft_lines SET status = 'paid', reference = ?, paid_on = ?, updated_at = datetime('now')
                        WHERE line_ref = ?`).run(row.reference, row.paid_on, row.line_ref);
        }
        return toOutcome(row);
    });
}
