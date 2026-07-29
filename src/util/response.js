// SMART's canonical success shape. Every endpoint returns this on success.
// `updatedRows` reflects the actual number of rows affected by the write
// so callers can distinguish create vs. no-op vs. cascade-update.
export function smartOK(id = 'XXXXXX', updatedRows = 0) {
    return {
        statusCode: '2000',
        successful: true,
        errorCode: 0,
        statusCodeType: 'SUCCESSFUL',
        statusCodeMsg: 'successful',
        objectCode: null,
        updated_rows: updatedRows,
        error_type: '',
        id,
    };
}

// Benefit-rules envelope. Per guide §2.4, /benefit/rules returns a
// different shape than the standard smartOK — statusCode is "200"
// (not "2000"), statusCodeMsg / statusCodeType / errorCode / updated_rows
// are null, and `status_msg` carries a descriptive queued message.
export function benefitRuleOK(id, statusMsg) {
    return {
        status_msg: statusMsg,
        statusCodeMsg: null,
        statusCodeType: null,
        objectCode: null,
        updated_rows: null,
        error_type: '',
        errorCode: null,
        successful: true,
        statusCode: '200',
        id: String(id),
    };
}

export function smartError(code = '5200', msg = 'invalid') {
    return {
        statusCode: code,
        successful: false,
        errorCode: 1,
        statusCodeType: 'FAILED',
        statusCodeMsg: msg,
        objectCode: null,
        updated_rows: 0,
        error_type: '',
        id: null,
    };
}
