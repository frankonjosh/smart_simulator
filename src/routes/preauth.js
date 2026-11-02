import { db } from '../store/db.js';
import { smartOK } from '../util/response.js';
import { info } from '../util/log.js';
import { pickCountry, pickCustomerId } from '../util/params.js';

export function registerPreauth(app) {
    // Guide §4.1 (October 2026)  GET /new/preauth/fetch — new pre-auth requests.
    // Customer and country come as headers (customerid, countrycode); no paging.
    // Response: { responseType: "SUCCESS", payLoad: [ ...requests ], successful: true }.
    // Each request is the seeded payload as-is (guide shape: preauthId, memberNumber, lineItems, ...).
    app.get('/new/preauth/fetch', async (req, reply) => {
        const country = pickCountry(req.headers) || pickCountry(req.query) || 'KE';
        const cust    = pickCustomerId(req) || '';

        // Tenant isolation: a preauth seeded for CUST-A is only served to
        // CUST-A. Empty customerid = tenant-agnostic (pre-isolation seeds).
        const rows = db.prepare(`
            SELECT preauth_id, payload FROM seeded_preauths
            WHERE status = 'ready' AND country = ? AND (customerid = ? OR customerid = '')
            ORDER BY preauth_id ASC
        `).all(country, cust);

        const preauths = rows.map((r) => JSON.parse(r.payload));
        info('preauth fetched', { count: preauths.length, customerid: cust, country });
        return reply.send({
            responseType: 'SUCCESS', generatedId: null, generatedCode: null,
            payLoad: preauths,
            exception: null, exceptionClass: null, message: null, errorCode: null,
            warningCode: null, messageTracker: null, successful: true,
        });
    });

    // Guide §4.2  POST /preauth/process — the payer's decision on a pre-auth.
    // Query: customerid, country. Body: { requestType, comments, preauthId, userId,
    // processModel: [ { requestId, preauthId, visitId, approvalAmount, isApprove, isReject, userId, comments } ] }
    // Response is wrapped in "body", like the markback.
    app.post('/preauth/process', async (req, reply) => {
        const b = req.body || {};
        const country = pickCountry(req.query) || 'KE';
        const ok = b.preauthId != null && ['APPROVAL', 'DECLINE', 'PARTIAL'].includes(b.requestType)
            && Array.isArray(b.processModel);
        if (ok) {
            db.prepare(`
                INSERT INTO preauth_decisions (preauth_id, request_type, body, customerid, country)
                VALUES (?, ?, ?, ?, ?)
            `).run(parseInt(b.preauthId, 10), b.requestType, JSON.stringify(b), pickCustomerId(req), country);
        }
        info('preauth decision', { preauthId: b.preauthId, requestType: b.requestType, lines: (b.processModel || []).length });
        return reply.send({
            headers: {},
            body: {
                responseType: ok ? 'SUCCESS' : 'ERROR', generatedId: null, generatedCode: null,
                payLoad: ok ? 'Preauth processed' : null,
                exception: null, exceptionClass: null,
                message: ok ? null : 'preauthId, requestType (APPROVAL, DECLINE or PARTIAL) and processModel are required',
                errorCode: null, warningCode: null, messageTracker: null,
            },
            statusCodeValue: 200, statusCode: 'OK',
        });
    });

    // Guide §4.5  POST /preauth/markback — pick-status ack (mark fetched preauths as picked/failed).
    // Customer and country come as headers (customerid, country).
    // Body: { pick_status: integer, id: integer, pick_comment: string }
    // Response: { headers: {}, body: { responseType: "SUCCESS", ... }, statusCodeValue: 200, statusCode: "OK" }
    app.post('/preauth/markback', async (req, reply) => {
        const b = req.body || {};
        const { pick_status, id, pick_comment } = b;
        const country = pickCountry(req.headers) || pickCountry(req.query) || 'KE';

        const newStatus = pick_status === 1 ? 'picked' : (pick_status === 2 ? 'failed' : 'ready');

        // Update the seeded_preauths lifecycle state.
        const updated = db.prepare(`UPDATE seeded_preauths SET status=?, picked_at=datetime('now') WHERE preauth_id=?`)
          .run(newStatus, id);

        // Persist the ack audit record including pick_comment.
        db.prepare(`
            INSERT INTO preauth_markbacks (preauth_id, pick_status, pick_comment, customerid, country)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            id != null ? parseInt(id, 10) : null,
            pick_status != null ? parseInt(pick_status, 10) : null,
            pick_comment || null,
            pickCustomerId(req),
            country,
        );

        info('preauth markback', { id, newStatus, pick_comment });
        const ok = updated.changes > 0;
        return reply.send({
            headers: {},
            body: {
                responseType: ok ? 'SUCCESS' : 'ERROR', generatedId: null, generatedCode: null,
                payLoad: ok ? 'Preauth marked back' : null,
                exception: null, exceptionClass: null,
                message: ok ? null : `No preauth with id ${id}`,
                errorCode: null, warningCode: null, messageTracker: null,
            },
            statusCodeValue: 200, statusCode: 'OK',
        });
    });
}
