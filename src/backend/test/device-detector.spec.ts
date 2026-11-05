import { detectDeviceName } from '../src/shared/utils/device-detector.util';

describe('Device Detector Utility (Unit Test)', () => {
  it('should detect Chrome on Linux (môi trường máy phát triển)', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(detectDeviceName(ua)).toBe('Chrome on Linux');
  });

  it('should detect Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
    expect(detectDeviceName(ua)).toBe('Edge on Windows');
  });

  it('should detect Firefox on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';
    expect(detectDeviceName(ua)).toBe('Firefox on Windows');
  });

  it('should detect Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
    expect(detectDeviceName(ua)).toBe('Safari on macOS');
  });

  it('should detect Safari on iPhone', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
    expect(detectDeviceName(ua)).toBe('Safari on iPhone (iOS)');
  });

  it('should detect Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36';
    expect(detectDeviceName(ua)).toBe('Chrome on Android');
  });

  it('should detect Postman Desktop client', () => {
    const ua = 'PostmanRuntime/7.42.0';
    expect(detectDeviceName(ua)).toBe('Postman Desktop');
  });

  it('should detect cURL CLI tool', () => {
    const ua = 'curl/8.5.0';
    expect(detectDeviceName(ua)).toBe('cURL CLI');
  });

  it('should fallback to Web Client when userAgent is missing or empty', () => {
    expect(detectDeviceName(undefined)).toBe('Web Client');
    expect(detectDeviceName('')).toBe('Web Client');
    expect(detectDeviceName('   ')).toBe('Web Client');
  });

  it('should fallback to Web Client when userAgent is unparseable dummy string', () => {
    expect(detectDeviceName('CustomBot/1.0')).toBe('Web Client');
  });
});
