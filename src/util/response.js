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
