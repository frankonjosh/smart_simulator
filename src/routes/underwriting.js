import { db } from '../store/db.js';
import { smartOK, smartError } from '../util/response.js';
import { info } from '../util/log.js';
import { pickCountry } from '../util/params.js';

export function registerUnderwriting(app) {
    // §2.1  POST /schemes  — REFERENCE PATTERN (do not modify)
    app.post('/schemes', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        if (!q.clnPolCode || !q.companyName) return reply.status(400).send(smartError('5200', 'missing fields'));
        const result = db.prepare(`
            INSERT INTO schemes (cln_pol_code, company_name, start_date, end_date, pol_type_id, policy_currency_id, country, user_id, anniv, customerid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code) DO UPDATE SET
                company_name=excluded.company_name,
                start_date=excluded.start_date,
                end_date=excluded.end_date,
                pol_type_id=excluded.pol_type_id,
                policy_currency_id=excluded.policy_currency_id,
                country=excluded.country,
                user_id=excluded.user_id,
                anniv=excluded.anniv,
                customerid=excluded.customerid,
                updated_at=datetime('now')
        `).run(
            q.clnPolCode, q.companyName, q.startDate, q.endDate,
            parseInt(q.polTypeId || '1', 10), q.policyCurrencyId, country,
            q.userId || null,
            q.anniv != null ? parseInt(q.anniv, 10) : null,
            q.customerid || null,
        );
        info('scheme defined', { clnPolCode: q.clnPolCode, userId: q.userId, anniv: q.anniv });
        return reply.send(smartOK(q.clnPolCode, result.changes));
    });

    // §2.2  POST /benefitCategories
    app.post('/benefitCategories', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO categories (cln_pol_code, cln_cat_code, cat_desc, user_id, customerid, country)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cln_cat_code) DO UPDATE SET
                cat_desc=excluded.cat_desc,
                user_id=excluded.user_id,
                customerid=excluded.customerid,
                country=excluded.country,
                updated_at=datetime('now')
        `).run(q.clnPolCode, q.clnCatCode, q.catDesc, q.userId || null, q.customerid || null, country);
        return reply.send(smartOK(q.clnCatCode, result.changes));
    });

    // §2.3  POST /benefits
    app.post('/benefits', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO benefits (
                cln_pol_code, cat_code, cln_ben_code, benefit_desc,
                policy_number, ben_type_id, sub_limit_amt, service_type,
                mem_assigned_benefit, user_id, ben_linked2tqcode, ben_typ_desc,
                customerid, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cat_code, cln_ben_code) DO UPDATE SET
                benefit_desc=excluded.benefit_desc,
                policy_number=excluded.policy_number,
                ben_type_id=excluded.ben_type_id,
                sub_limit_amt=excluded.sub_limit_amt,
                service_type=excluded.service_type,
                mem_assigned_benefit=excluded.mem_assigned_benefit,
                user_id=excluded.user_id,
                ben_linked2tqcode=excluded.ben_linked2tqcode,
                ben_typ_desc=excluded.ben_typ_desc,
                customerid=excluded.customerid,
                country=excluded.country,
                updated_at=datetime('now')
        `).run(
            q.clnPolCode, q.catCode, q.clnBenCode, q.benefitDesc,
            q.policyNumber || null,
            q.benTypeId || null,
            parseInt(q.subLimitAmt || '0', 10),
            parseInt(q.serviceType || '1', 10),
            q.memAssignedBenefit != null ? parseInt(q.memAssignedBenefit, 10) : null,
            q.userId || null,
            q.benLinked2Tqcode || null,
            q.benTypDesc || null,
            q.customerid || null,
            country,
        );
        return reply.send(smartOK(q.clnBenCode, result.changes));
    });

    // §2.3.1  POST /bulk/benefits — same shape as §2.3
    app.post('/bulk/benefits', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO benefits (
                cln_pol_code, cat_code, cln_ben_code, benefit_desc,
                policy_number, ben_type_id, sub_limit_amt, service_type,
                mem_assigned_benefit, user_id, ben_linked2tqcode, ben_typ_desc,
                customerid, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cln_pol_code, cat_code, cln_ben_code) DO UPDATE SET
                benefit_desc=excluded.benefit_desc,
                policy_number=excluded.policy_number,
                ben_type_id=excluded.ben_type_id,
                sub_limit_amt=excluded.sub_limit_amt,
                service_type=excluded.service_type,
                mem_assigned_benefit=excluded.mem_assigned_benefit,
                user_id=excluded.user_id,
                ben_linked2tqcode=excluded.ben_linked2tqcode,
                ben_typ_desc=excluded.ben_typ_desc,
                customerid=excluded.customerid,
                country=excluded.country,
                updated_at=datetime('now')
        `).run(
            q.clnPolCode, q.catCode, q.clnBenCode, q.benefitDesc,
            q.policyNumber || null,
            q.benTypeId || null,
            parseInt(q.subLimitAmt || '0', 10),
            parseInt(q.serviceType || '1', 10),
            q.memAssignedBenefit != null ? parseInt(q.memAssignedBenefit, 10) : null,
            q.userId || null,
            q.benLinked2Tqcode || null,
            q.benTypDesc || null,
            q.customerid || null,
            country,
        );
        return reply.send(smartOK(q.clnBenCode, result.changes));
    });

    // §2.4  POST /benefit/rules — JSON body; persist full rule
    app.post('/benefit/rules', async (req, reply) => {
        const q = req.query;
        const b = req.body || {};
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO benefit_rules (
                integ_scheme_code, integ_cat_code, integ_ben_code,
                is_autogrowth, autogrowth_max, autogrowth_min, autogrowth_rate, autogrowth_rate_type,
                autorep_limit, autorep_limit_type, has_reserve_parent,
                is_autogrowth2, autogrowth_json,
                is_autorep, is_threshold, reserve_action, reserve_parent_pool,
                threshold_action, threshold_rate, threshold_rate_type,
                is_waitingperiod, waiting_days, waiting_months,
                is_buffer, buffer_type, buffer_limit, buffer_action,
                is_prorated, proration_type, is_frequency, frequency_limit,
                customerid, country
            ) VALUES (
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?
            )
        `).run(
            b.integ_scheme_code || null, b.integ_cat_code || null, b.integ_ben_code || null,
            b.is_autogrowth ?? null, b.autogrowth_max ?? null, b.autogrowth_min ?? null,
            b.autogrowth_rate ?? null, b.autogrowth_rate_type ?? null,
            b.autorep_limit ?? null, b.autorep_limit_type ?? null, b.has_reserve_parent ?? null,
            b.is_autogrowth2 ?? null, b.autogrowth2_json || b.autogrowth_json || null,
            b.is_autorep ?? null, b.is_threshold ?? null, b.reserve_action ?? null,
            b.reserve_parent_pool ?? null, b.threshold_action ?? null,
            b.threshold_rate ?? null, b.threshold_rate_type ?? null,
            b.is_waitingperiod ?? null, b.waiting_days ?? null, b.waiting_months ?? null,
            b.isBuffer ?? null, b.bufferType ?? null, b.bufferLimit ?? null, b.bufferAction ?? null,
            b.isProrated ?? null, b.prorationType ?? null,
            b.isFrequency ?? null, b.frequencyLimit ?? null,
            q.customerid || null, country,
        );
        const benCode = b.integ_ben_code || null;
        return reply.send(smartOK(String(result.lastInsertRowid), result.changes));
    });

    // §2.5  POST /members — Member Card Request
    app.post('/members', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO members (
                membership_number, cln_pol_code, cln_cat_code, family_code, mem_type,
                surname, second_name, third_name, other_names,
                id_number, nhif_number, staff_number,
                scheme_start_date, scheme_end_date,
                user_id, roaming_countries, customerid,
                dob, gender, phone_number, email_address, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(membership_number) DO UPDATE SET
                cln_pol_code=excluded.cln_pol_code,
                cln_cat_code=excluded.cln_cat_code,
                family_code=excluded.family_code,
                mem_type=excluded.mem_type,
                surname=excluded.surname,
                second_name=excluded.second_name,
                third_name=excluded.third_name,
                other_names=excluded.other_names,
                id_number=excluded.id_number,
                nhif_number=excluded.nhif_number,
                staff_number=excluded.staff_number,
                scheme_start_date=excluded.scheme_start_date,
                scheme_end_date=excluded.scheme_end_date,
                user_id=excluded.user_id,
                roaming_countries=excluded.roaming_countries,
                customerid=excluded.customerid,
                dob=excluded.dob,
                gender=excluded.gender,
                phone_number=excluded.phone_number,
                email_address=excluded.email_address,
                country=excluded.country,
                updated_at=datetime('now')
        `).run(
            q.membershipNumber, q.clnPolCode, q.clnCatCode, q.familyCode, q.memType,
            q.surname, q.secondName, q.thirdName || null, q.otherNames || null,
            q.idNumber || null, q.nhifNumber || null, q.staffNumber || null,
            q.schemeStartDate || null, q.schemeEndDate || null,
            q.userID || q.userId || null,
            q.roamingCountries || null,
            q.customerid || null,
            q.dob, q.gender, q.phone_number || null, q.email_address || null, country,
        );
        info('member enrolled', { membershipNumber: q.membershipNumber });
        return reply.send(smartOK(q.membershipNumber, result.changes));
    });

    // §2.6  POST /members/cardreprints — Card Re-print Request
    app.post('/members/cardreprints', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO card_reprints (member_number, staff_number, user_id, customerid, reorder_reason, country)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            q.memberNumber, q.staffNumber || null, q.userId || null,
            q.customerid || null, q.reorderReason || null, country,
        );
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.7  POST /scheme/member/migration — JSON body array
    app.post('/scheme/member/migration', async (req, reply) => {
        const items = req.body || [];
        let changes = 0;
        for (const it of items) {
            const r = db.prepare(`
                UPDATE members
                SET cln_pol_code=?, cln_cat_code=?, updated_at=datetime('now')
                WHERE membership_number=?
            `).run(it.integSchemeCode, it.integCategoryCode, it.integMemberNumber);
            changes += r.changes;
        }
        return reply.send(smartOK(String(items.length), changes));
    });

    // §2.8  POST /schemes/renewals — Scheme Renewal Request
    app.post('/schemes/renewals', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE schemes SET
                start_date=?, end_date=?, user_id=?, customerid=?, country=?,
                updated_at=datetime('now')
            WHERE cln_pol_code=?
        `).run(q.startDate, q.endDate, q.userId || null, q.customerid || null, country, q.clnPolCode);
        return reply.send(smartOK(q.clnPolCode, result.changes));
    });

    // §2.9  POST /schemes/activation — Scheme Activation Request
    app.post('/schemes/activation', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE schemes SET
                status='active', status_reason=?, user_id=?, customerid=?, country=?,
                updated_at=datetime('now')
            WHERE cln_pol_code=?
        `).run(q.statusReason || null, q.userId || null, q.customerid || null, country, q.clnPolCode);
        return reply.send(smartOK(q.clnPolCode, result.changes));
    });

    // §2.10  POST /scheme/deactivations — Scheme De-activation Request
    app.post('/scheme/deactivations', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE schemes SET
                status='inactive', status_reason=?, user_id=?, customerid=?, country=?,
                updated_at=datetime('now')
            WHERE cln_pol_code=?
        `).run(q.statusReason || null, q.userId || null, q.customerid || null, country, q.clnPolCode);
        return reply.send(smartOK(q.clnPolCode, result.changes));
    });

    // §2.11  POST /benefit/activation — Benefit Activation Request
    app.post('/benefit/activation', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE benefits SET
                active=1, status_reason=?, updated_at=datetime('now')
            WHERE cln_pol_code=? AND cat_code=? AND cln_ben_code=?
        `).run(q.statusReason || null, q.clnPolCode, q.catCode, q.clnBenCode);
        return reply.send(smartOK(q.clnBenCode, result.changes));
    });

    // §2.12  POST /benefit/deactivation — Benefit Deactivation Request
    app.post('/benefit/deactivation', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE benefits SET
                active=0, status_reason=?, updated_at=datetime('now')
            WHERE cln_pol_code=? AND cat_code=? AND cln_ben_code=?
        `).run(q.statusReason || null, q.clnPolCode, q.catCode, q.clnBenCode);
        return reply.send(smartOK(q.clnBenCode, result.changes));
    });

    // §2.13  POST /member/renewals — Member Renewal Request
    app.post('/member/renewals', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                scheme_start_date=?, scheme_end_date=?, user_id=?, customerid=?,
                country=?, updated_at=datetime('now')
            WHERE membership_number=?
        `).run(
            q.startDate || null, q.endDate || null,
            q.userId || null, q.customerid || null,
            country, q.memberNumber,
        );
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.14  POST /members/categorychange — Member Category Change
    app.post('/members/categorychange', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                cln_cat_code=?, user_id=?, customerid=?, country=?,
                updated_at=datetime('now')
            WHERE membership_number=?
        `).run(q.newGrade, q.userId || null, q.customerid || null, country, q.memberNumber);
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.15  POST /members/activations — Member Activation Request
    app.post('/members/activations', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                status='active', status_reason=?, user_id=?, customerid=?,
                country=?, updated_at=datetime('now')
            WHERE membership_number=?
        `).run(q.statusReason || null, q.userId || null, q.customerid || null, country, q.memberNumber);
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.15.1  POST /bulk/members/activations — Bulk Member Activation
    app.post('/bulk/members/activations', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                status='active', status_reason=?, user_id=?, customerid=?,
                country=?, updated_at=datetime('now')
            WHERE membership_number=?
        `).run(q.statusReason || null, q.userId || null, q.customerid || null, country, q.memberNumber);
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.16  POST /members/deactivations — Member De-Activation Request
    app.post('/members/deactivations', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                status='inactive', status_reason=?, user_id=?, customerid=?,
                country=?, updated_at=datetime('now')
            WHERE membership_number=?
        `).run(q.statusReason || null, q.userId || null, q.customerid || null, country, q.memberNumber);
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.17  POST /members/fingerprintremoval — Fingerprint Removal Request
    app.post('/members/fingerprintremoval', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO fingerprint_removals (member_number, user_id, customerid, change_reason, country)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            q.memberNumber, q.userId || null,
            q.customerid || null, q.change_reason || null, country,
        );
        return reply.send(smartOK(q.memberNumber, result.changes));
    });

    // §2.18  POST /members/changes — Member Details Change
    app.post('/members/changes', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            UPDATE members SET
                cln_cat_code=?, family_code=?, mem_type=?,
                surname=?, second_name=?, third_name=?, other_names=?,
                id_number=?, nhif_number=?, staff_number=?,
                dob=?, gender=?, phone_number=?, email_address=?,
                user_id=?, customerid=?, country=?,
                updated_at=datetime('now')
            WHERE membership_number=?
        `).run(
            q.clnCatCode, q.familyCode, q.memType,
            q.surname, q.secondName, q.thirdName || null, q.otherName || null,
            q.idNumber || null, q.nhifNumber || null, q.staffNumber || null,
            q.dob, q.gender, q.phone_number || null, q.email_address || null,
            q.userId || null, q.customerid || null, country,
            q.membershipNumber,
        );
        return reply.send(smartOK(q.membershipNumber, result.changes));
    });

    // §2.19  POST /members/moneyaddition — Money Addition
    app.post('/members/moneyaddition', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO money_movements (
                member_number, benefit_code, smart_bill_id, returned_amount,
                return_code, return_reason, date_entered, provider_code,
                invoice_number, user_id, cln_pol_code, invoice_date,
                invoice_id, customerid, anniv, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            q.memberNumber, q.benefitCode, q.smartBillId || null,
            parseFloat(q.returnedAmount || '0'),
            q.returnCode || '16', q.returnReason || null,
            q.dateEntered || null, q.providerCode || null,
            q.invoiceNumber || null, q.userId || null,
            q.clnPolCode || null, q.invoiceDate || null,
            q.invoiceId || null, q.customerid || null,
            q.anniv != null ? parseInt(q.anniv, 10) : null,
            country,
        );
        return reply.send(smartOK(q.invoiceId, result.changes));
    });

    // §2.20  POST /members/moneyreduction — Money Reduction
    app.post('/members/moneyreduction', async (req, reply) => {
        const q = req.query;
        const country = pickCountry(q);
        const result = db.prepare(`
            INSERT INTO money_movements (
                member_number, benefit_code, smart_bill_id, returned_amount,
                return_code, return_reason, date_entered, provider_code,
                invoice_number, user_id, cln_pol_code, invoice_date,
                invoice_id, customerid, anniv, country
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            q.memberNumber, q.benefitCode, q.smartBillId || null,
            parseFloat(q.returnedAmount || '0'),
            q.returnCode || '17', q.returnReason || null,
            q.dateEntered || null, q.providerCode || null,
            q.invoiceNumber || null, q.userId || null,
            q.clnPolCode || null, q.invoiceDate || null,
            q.invoiceId || null, q.customerid || null,
            q.anniv != null ? parseInt(q.anniv, 10) : null,
            country,
        );
        return reply.send(smartOK(q.invoiceId, result.changes));
    });
}
