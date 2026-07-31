// SMART's developer guide is inconsistent — different endpoints use
// `country`, `countryCode`, `countrycode`, or `country_code`. This helper
// pulls whichever the caller sent so the sim matches real-SMART tolerance
// instead of drifting to a single spelling.
export function pickCountry(q) {
    return q?.country || q?.countryCode || q?.countrycode || q?.country_code || null;
}

// Real SMART carries the tenant in the URL path (/api/v2/{customerid}/...);
// some guide examples ALSO pass ?customerid=. Prefer the path param —
// that's what real SMART keys on — and fall back to the query spelling
// (either case) so hand-crafted Postman calls still tag their rows.
export function pickCustomerId(req) {
    return req?.params?.customerid || req?.query?.customerid || req?.query?.Customerid || null;
}
