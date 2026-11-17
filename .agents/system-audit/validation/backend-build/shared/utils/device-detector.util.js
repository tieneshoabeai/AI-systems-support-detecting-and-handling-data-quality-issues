"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDeviceName = detectDeviceName;
function detectDeviceName(userAgent) {
    if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
        return 'Web Client';
    }
    const ua = userAgent.trim();
    if (ua.includes('PostmanRuntime'))
        return 'Postman Desktop';
    if (ua.startsWith('curl/'))
        return 'cURL CLI';
    if (ua.includes('insomnia'))
        return 'Insomnia Client';
    let os = 'Unknown OS';
    if (/windows phone/i.test(ua)) {
        os = 'Windows Phone';
    }
    else if (/win(dows|98|me|nt|32|64)/i.test(ua)) {
        os = 'Windows';
    }
    else if (/iphone/i.test(ua)) {
        os = 'iPhone (iOS)';
    }
    else if (/ipad/i.test(ua)) {
        os = 'iPad (iPadOS)';
    }
    else if (/android/i.test(ua)) {
        os = 'Android';
    }
    else if (/macintosh|mac os x/i.test(ua)) {
        os = 'macOS';
    }
    else if (/cros/i.test(ua)) {
        os = 'Chrome OS';
    }
    else if (/linux/i.test(ua)) {
        os = 'Linux';
    }
    let browser = 'Browser';
    if (/edg([ea]|ios)?\//i.test(ua)) {
        browser = 'Edge';
    }
    else if (/opr\/|opera/i.test(ua)) {
        browser = 'Opera';
    }
    else if (/samsungbrowser/i.test(ua)) {
        browser = 'Samsung Internet';
    }
    else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
        browser = 'Chrome';
    }
    else if (/firefox|fxios/i.test(ua)) {
        browser = 'Firefox';
    }
    else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
        browser = 'Safari';
    }
    if (os === 'Unknown OS' && browser === 'Browser') {
        return 'Web Client';
    }
    return `${browser} on ${os}`;
}
//# sourceMappingURL=device-detector.util.js.map