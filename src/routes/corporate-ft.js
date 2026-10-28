// KCB Corporate FT stand-in, shaped like KCB's "Buni" Corporate FT API v2 and
// mounted under /kcb so Curis points at http://localhost:6021/kcb:
//   POST /kcb/token?grant_type=client_credentials   Basic consumer key:secret
//   POST /kcb/ft/v2/1.0.0/api/corporate             multipart: payload + requestSignature
// The payload's action picks DISBURSEMENT, TRXSTATUS or ACCOUNTVALIDATION.
//
// A disbursement is only "received" when sent; its result is read by
// TRXSTATUS. The beneficiary account's last digit picks the result so every
// path can be exercised:
//   ends in 9 → FAILED ("Invalid beneficiary account")
//   ends in 8 → PENDING until the second status check, then SUCCESS
//   otherwise → SUCCESS, once 3 seconds have passed since it was received
// A repeated retrievalRefNumber is refused, as KCB does.
import crypto from 'node:crypto';
import { db } from '../store/db.js';
import { info, warn } from '../util/log.js';

const CONSUMER_KEY = process.env.KCB_CONSUMER_KEY || 'sim-key';
const CONSUMER_SECRET = process.env.KCB_CONSUMER_SECRET || 'sim-secret';
const SIGNING_KEY = process.env.KCB_SIGNING_KEY || 'sim-signing-key';
const SIGNATURE_MODE = process.env.KCB_SIGNATURE_MODE || 'append';
const SIGNATURE_ENCODING = process.env.KCB_SIGNATURE_ENCODING || 'hex';
const LIMIT = Number(process.env.KCB_LIMIT || 5_000_000);
const SETTLE_MS = 3000;

const tokens = new Map(); // token → expiry (ms)

const ftReference = () => 'FT' + crypto.randomInt(10_000, 99_999) + crypto.randomBytes(3).toString('hex').toUpperCase();

function sign(...fields) {
    const raw = fields.map((f) => (f === undefined || f === null ? '' : String(f))).join('');
    if (SIGNATURE_MODE === 'hmac') {
        return crypto.createHmac('sha512', SIGNING_KEY).update(raw).digest(SIGNATURE_ENCODING);
    }
    const salted = SIGNATURE_MODE === 'prepend' ? SIGNING_KEY + raw : raw + SIGNING_KEY;
    return crypto.createHash('sha512').update(salted).digest(SIGNATURE_ENCODING);
}

const refused = (description) => ({
    statusCode: '1', statusMessage: 'Error', statusDescription: `Validation failed: ${description}`, merchantID: null,
});

const fault = { fault: { code: 900901, message: 'Invalid Credentials', description: 'Invalid Credentials. Make sure you have provided the correct security credentials' } };

function decide(account) {
    const last = String(account || '').trim().slice(-1);
    if (last === '9') return { outcome: 'FAILED', message: 'Invalid beneficiary account' };
    if (last === '8') return { outcome: 'PENDING', message: 'Pending' };
    return { outcome: 'SUCCESS', message: 'Processed Successfully' };
}

export function registerCorporateFT(app) {
    const find = db.prepare('SELECT * FROM kcb_payments WHERE rrn = ?');
    const insert = db.prepare(`
        INSERT INTO kcb_payments (rrn, request_id, merchant_id, company_code, transaction_type, debit_account, amount,
                                  currency, beneficiary_account, beneficiary_bank_code, beneficiary_name, narration,
                                  outcome, message, created_at)
        VALUES (@rrn, @request_id, @merchant_id, @company_code, @transaction_type, @debit_account, @amount,
                @currency, @beneficiary_account, @beneficiary_bank_code, @beneficiary_name, @narration,
                @outcome, @message, @created_at)`);
    const checked = db.prepare('UPDATE kcb_payments SET status_checks = status_checks + 1 WHERE rrn = ?');
    const settle = db.prepare('UPDATE kcb_payments SET outcome = ?, message = ?, ft_reference = ? WHERE rrn = ?');

    function disburse(p) {
        const required = ['requestId', 'retrievalRefNumber', 'companyCode', 'transactionType', 'primaryAccountNumber',
            'amount', 'amountCurrency', 'beneficiaryAccount', 'beneficiaryBankCode', 'beneficiaryName', 'narration'];
        if (required.some((k) => !String(p[k] ?? '').trim()) || String(p.retrievalRefNumber).length > 16 ||
            String(p.beneficiaryName).length > 35 || String(p.narration).length > 35 || !(Number(p.amount) > 0)) {
            return refused('Invalid crucial param');
        }
        if (find.get(p.retrievalRefNumber)) {
            return { ...refused('Retrieval RefNumber already exist'), retrievalRefNumber: p.retrievalRefNumber };
        }
        if (Number(p.amount) > LIMIT) {
            return { ...refused('Transaction failed due to limit rule'), retrievalRefNumber: p.retrievalRefNumber };
        }
        const d = decide(p.beneficiaryAccount);
        const merchantId = `${p.transactionType}${Date.now()}${p.retrievalRefNumber}`;
        insert.run({
            rrn: p.retrievalRefNumber, request_id: p.requestId, merchant_id: merchantId, company_code: p.companyCode,
            transaction_type: p.transactionType, debit_account: p.primaryAccountNumber, amount: Number(p.amount),
            currency: p.amountCurrency, beneficiary_account: p.beneficiaryAccount,
            beneficiary_bank_code: p.beneficiaryBankCode, beneficiary_name: p.beneficiaryName, narration: p.narration,
            outcome: d.outcome, message: d.message, created_at: new Date().toISOString(),
        });
        info('kcb disbursement received', { rrn: p.retrievalRefNumber, type: p.transactionType, will_be: d.outcome });
        return {
            statusCode: '0', statusMessage: 'Success', statusDescription: 'Request received for processing',
            merchantID: merchantId, retrievalRefNumber: p.retrievalRefNumber,
        };
    }

    function status(p) {
        const row = find.get(p.retrievalRefNumber);
        if (!row) return refused('Transaction not found');
        checked.run(row.rrn);
        let current = row.outcome;
        if (row.outcome === 'SUCCESS' && Date.now() - Date.parse(row.created_at) < SETTLE_MS) {
            current = 'PENDING';
        }
        if (row.outcome === 'PENDING' && row.status_checks + 1 >= 2) {
            current = 'SUCCESS';
            settle.run('SUCCESS', 'Processed Successfully', '', row.rrn);
            row.message = 'Processed Successfully';
        }
        let ref = row.ft_reference;
        if (current === 'SUCCESS' && !ref) {
            ref = ftReference();
            settle.run('SUCCESS', row.message, ref, row.rrn);
        }
        const out = {
            companyCode: row.company_code, debitAccountNumber: row.debit_account, debitAmount: row.amount,
            creditAccountNumber: row.beneficiary_account, createdOn: row.created_at.replace('Z', '+00:00'),
            statusMessage: current === 'PENDING' ? 'Pending' : row.message, transactionType: row.transaction_type,
            merchantId: row.merchant_id, beneficiaryName: row.beneficiary_name, retrievalRefNumber: row.rrn,
            amountCurrency: row.currency, status: current,
        };
        if (current === 'SUCCESS') out.ftReference = ref;
        return out;
    }

    function validate(p) {
        const acct = String(p.primaryAccountNumber || '').trim();
        if (!acct || !String(p.beneficiaryBankCode || '').trim()) return refused('Invalid crucial param');
        return {
            responsePayload: {
                accountInfo: {
                    localCurrency: 'KES',
                    accountStatus: acct.endsWith('9') ? 'CLOSED' : 'OPEN',
                    accountName: `SIM ACCOUNT ${acct.slice(-4)}`,
                },
            },
        };
    }

    app.register(async (scoped) => {
        // KCB takes multipart forms; read them with the platform's own parser.
        scoped.addContentTypeParser('multipart/form-data', { parseAs: 'buffer' }, async (req, body) => {
            const form = await new Response(body, { headers: { 'content-type': req.headers['content-type'] } }).formData();
            const out = {};
            for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : '[file]';
            return out;
        });

        scoped.post('/token', async (req, reply) => {
            const [scheme, encoded] = String(req.headers.authorization || '').split(' ');
            const [key, secret] = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':') : [];
            if (req.query.grant_type !== 'client_credentials' || key !== CONSUMER_KEY || secret !== CONSUMER_SECRET) {
                return reply.code(401).send({ error: 'invalid_client', error_description: 'A valid OAuth client could not be found for client_id' });
            }
            const token = crypto.randomBytes(24).toString('base64url');
            tokens.set(token, Date.now() + 3600 * 1000);
            return { access_token: token, token_type: 'Bearer', expires_in: 3600 };
        });

        scoped.post('/ft/v2/1.0.0/api/corporate', async (req, reply) => {
            const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
            if (!tokens.has(token) || tokens.get(token) < Date.now()) {
                return reply.code(401).send(fault);
            }
            let p;
            try {
                p = JSON.parse(req.body?.payload ?? '');
            } catch {
                return refused('Invalid crucial param');
            }
            const signed = p.action === 'DISBURSEMENT'
                ? sign(p.requestId, p.primaryAccountNumber, p.beneficiaryAccount, p.amount)
                : sign(p.requestId, p.primaryAccountNumber);
            if (req.body?.requestSignature !== signed) {
                warn('kcb signature mismatch', { action: p.action, rrn: p.retrievalRefNumber });
                return refused('Invalid request signature');
            }
            switch (p.action) {
                case 'DISBURSEMENT':
                    return disburse(p);
                case 'TRXSTATUS':
                    return status(p);
                case 'ACCOUNTVALIDATION':
                    return validate(p);
                default:
                    return refused('Invalid crucial param');
            }
        });
    }, { prefix: '/kcb' });
}
