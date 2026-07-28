// SMART's developer guide is inconsistent — different endpoints use
// `country`, `countryCode`, `countrycode`, or `country_code`. This helper
// pulls whichever the caller sent so the sim matches real-SMART tolerance
// instead of drifting to a single spelling.
export function pickCountry(q) {
    return q?.country || q?.countryCode || q?.countrycode || q?.country_code || null;
}
