import { isSafeUrl } from '../src/crawler/security';

describe('URL security', () => {
  it('rejects private and loopback addresses in production mode', () => {
    expect(isSafeUrl('http://127.0.0.1:5000')).toBe(false);
    expect(isSafeUrl('http://192.168.1.10')).toBe(false);
    expect(isSafeUrl('http://10.0.0.5')).toBe(false);
    expect(isSafeUrl('http://169.254.169.254')).toBe(false);
  });

  it('accepts public HTTPS URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('allows localhost for evaluation mode', () => {
    expect(isSafeUrl('http://localhost:8099/acme/', true)).toBe(true);
  });
});
