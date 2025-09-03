"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP_HEADERS = void 0;
exports.getHeaderKey = getHeaderKey;
exports.HTTP_HEADERS = {
    COMPANY_ID: 'X-Company-ID',
    USER_ID: 'X-User-ID',
    USER_ROLE: 'X-User-Role',
    GATEWAY_SOURCE: 'X-Gateway-Source',
    GATEWAY_TIMESTAMP: 'X-Gateway-Timestamp',
    GATEWAY_REQUEST_ID: 'X-Gateway-Request-ID'
};
function getHeaderKey(headerName) {
    return headerName.toLowerCase();
}
exports.default = exports.HTTP_HEADERS;
//# sourceMappingURL=headers.js.map