import { db } from '../store/db.js';
import { smartOK, smartError } from '../util/response.js';
import { info } from '../util/log.js';

export function registerUnderwriting(app) {
    // POST /schemes
    app.post('/schemes', async (req, reply) => {
        const { companyName, clnPolCode, startDate, endDate, polTypeId, policyCurrencyId, country } = req.query;
        if (!clnPolCode || !companyName) return reply.status(400).send(smartError('5200', 'missing fields'));
        db.prepare(`
            INSERT INTO schemes (cln_pol_code, company_name, start_date, end_date, pol_type_id, policy_currency_id, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code) DO UPDATE SET
                company_name=excluded.company_name,
                start_date=excluded.start_date,
                end_date=excluded.end_date,
                pol_type_id=excluded.pol_type_id,
                policy_currency_id=excluded.policy_currency_id,
                country=excluded.country
        `).run(companyName, clnPolCode, startDate, endDate, parseInt(polTypeId || '1', 10), policyCurrencyId, country);
        info('scheme defined', { clnPolCode });
        return reply.send(smartOK(clnPolCode));
    });

    app.post('/schemes/renewals', async (req, reply) => {
        const { clnPolCode, startDate, endDate } = req.query;
        db.prepare(`UPDATE schemes SET start_date=?, end_date=? WHERE cln_pol_code=?`)
          .run(startDate, endDate, clnPolCode);
        return reply.send(smartOK(clnPolCode));
    });

    app.post('/schemes/activation', async (req, reply) => {
        db.prepare(`UPDATE schemes SET status='active' WHERE cln_pol_code=?`).run(req.query.clnPolCode);
        return reply.send(smartOK(req.query.clnPolCode));
    });

    app.post('/scheme/deactivations', async (req, reply) => {
        db.prepare(`UPDATE schemes SET status='inactive' WHERE cln_pol_code=?`).run(req.query.clnPolCode);
        return reply.send(smartOK(req.query.clnPolCode));
    });

    app.post('/benefitCategories', async (req, reply) => {
        const { clnPolCode, clnCatCode, catDesc, country } = req.query;
        db.prepare(`
            INSERT INTO categories (cln_pol_code, cln_cat_code, cat_desc, country)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cln_cat_code) DO UPDATE SET cat_desc=excluded.cat_desc
        `).run(clnPolCode, clnCatCode, catDesc, country);
        return reply.send(smartOK(clnCatCode));
    });

    app.post('/benefits', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO benefits (cln_pol_code, cat_code, cln_ben_code, benefit_desc, sub_limit_amt, service_type, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cat_code, cln_ben_code) DO UPDATE SET
                benefit_desc=excluded.benefit_desc,
                sub_limit_amt=excluded.sub_limit_amt,
                service_type=excluded.service_type
        `).run(q.clnPolCode, q.catCode, q.clnBenCode, q.benefitDesc, parseInt(q.subLimitAmt || '0', 10), parseInt(q.serviceType || '1', 10), q.country);
        return reply.send(smartOK(q.clnBenCode));
    });

    app.post('/bulk/benefits', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO benefits (cln_pol_code, cat_code, cln_ben_code, benefit_desc, sub_limit_amt, service_type, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cat_code, cln_ben_code) DO UPDATE SET
                benefit_desc=excluded.benefit_desc,
                sub_limit_amt=excluded.sub_limit_amt,
                service_type=excluded.service_type
        `).run(q.clnPolCode, q.catCode, q.clnBenCode, q.benefitDesc, parseInt(q.subLimitAmt || '0', 10), parseInt(q.serviceType || '1', 10), q.country);
        return reply.send(smartOK(q.clnBenCode));
    });

    // /benefit/rules — JSON body; sim just acks.
    app.post('/benefit/rules', async (_req, reply) => reply.send(smartOK()));

    app.post('/benefit/activation', async (req, reply) => {
        const { clnPolCode, catCode, clnBenCode } = req.query;
        db.prepare(`UPDATE benefits SET active=1 WHERE cln_pol_code=? AND cat_code=? AND cln_ben_code=?`)
          .run(clnPolCode, catCode, clnBenCode);
        return reply.send(smartOK(clnBenCode));
    });

    app.post('/benefit/deactivation', async (req, reply) => {
        const { clnPolCode, catCode, clnBenCode } = req.query;
        db.prepare(`UPDATE benefits SET active=0 WHERE cln_pol_code=? AND cat_code=? AND cln_ben_code=?`)
          .run(clnPolCode, catCode, clnBenCode);
        return reply.send(smartOK(clnBenCode));
    });

    app.post('/members', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO members (membership_number, cln_pol_code, cln_cat_code, family_code, mem_type, surname, second_name, dob, gender, phone_number, email_address, country)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(membership_number) DO UPDATE SET
                cln_pol_code=excluded.cln_pol_code,
                cln_cat_code=excluded.cln_cat_code,
                family_code=excluded.family_code,
                mem_type=excluded.mem_type,
                surname=excluded.surname,
                second_name=excluded.second_name,
                dob=excluded.dob,
                gender=excluded.gender,
                phone_number=excluded.phone_number,
                email_address=excluded.email_address
        `).run(q.membershipNumber, q.clnPolCode, q.clnCatCode, q.familyCode, q.memType, q.surname, q.secondName, q.dob, q.gender, q.phone_number || null, q.email_address || null, q.country);
        info('member enrolled', { membershipNumber: q.membershipNumber });
        return reply.send(smartOK(q.membershipNumber));
    });

    app.post('/members/cardreprints', async (req, reply) => reply.send(smartOK(req.query.memberNumber)));

    app.post('/scheme/member/migration', async (req, reply) => {
        const items = req.body || [];
        for (const it of items) {
            db.prepare(`UPDATE members SET cln_pol_code=?, cln_cat_code=? WHERE membership_number=?`)
              .run(it.integSchemeCode, it.integCategoryCode, it.integMemberNumber);
        }
        return reply.send(smartOK(String(items.length)));
    });

    app.post('/member/renewals', async (req, reply) => reply.send(smartOK(req.query.memberNumber)));

    app.post('/members/categorychange', async (req, reply) => {
        db.prepare(`UPDATE members SET cln_cat_code=? WHERE membership_number=?`)
          .run(req.query.newGrade, req.query.memberNumber);
        return reply.send(smartOK(req.query.memberNumber));
    });

    app.post('/members/activations', async (req, reply) => {
        db.prepare(`UPDATE members SET status='active' WHERE membership_number=?`).run(req.query.memberNumber);
        return reply.send(smartOK(req.query.memberNumber));
    });

    app.post('/bulk/members/activations', async (req, reply) => {
        db.prepare(`UPDATE members SET status='active' WHERE membership_number=?`).run(req.query.memberNumber);
        return reply.send(smartOK(req.query.memberNumber));
    });

    app.post('/members/deactivations', async (req, reply) => {
        db.prepare(`UPDATE members SET status='inactive' WHERE membership_number=?`).run(req.query.memberNumber);
        return reply.send(smartOK(req.query.memberNumber));
    });

    app.post('/members/fingerprintremoval', async (req, reply) => reply.send(smartOK(req.query.memberNumber)));

    app.post('/members/changes', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            UPDATE members SET
                cln_cat_code=?, family_code=?, mem_type=?, surname=?, second_name=?, dob=?, gender=?,
                phone_number=?, email_address=?
            WHERE membership_number=?
        `).run(q.clnCatCode, q.familyCode, q.memType, q.surname, q.secondName, q.dob, q.gender, q.phone_number || null, q.email_address || null, q.membershipNumber);
        return reply.send(smartOK(q.membershipNumber));
    });

    app.post('/members/moneyaddition', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO money_movements (member_number, benefit_code, amount, return_code, return_reason, invoice_id, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(q.memberNumber, q.benefitCode, parseFloat(q.returnedAmount || '0'), q.returnCode || '16', q.returnReason, q.invoiceId, q.country);
        return reply.send(smartOK(q.invoiceId));
    });

    app.post('/members/moneyreduction', async (req, reply) => {
        const q = req.query;
        db.prepare(`
            INSERT INTO money_movements (member_number, benefit_code, amount, return_code, return_reason, invoice_id, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(q.memberNumber, q.benefitCode, parseFloat(q.returnedAmount || '0'), q.returnCode || '17', q.returnReason, q.invoiceId, q.country);
        return reply.send(smartOK(q.invoiceId));
    });
}
