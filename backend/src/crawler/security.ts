import { isIP } from 'net';
import { URL } from 'url';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
}

export function isSafeUrl(rawUrl: string, allowLocalhost = false): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    const ipType = isIP(hostname);

    if (allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) return true;
    if (hostname === 'localhost' || isPrivateIpv4(hostname) || (ipType === 6 && isPrivateIpv6(hostname))) return false;
    if (hostname === '0.0.0.0' || hostname === '169.254.169.254') return false;
    return Boolean(hostname);
  } catch {
    return false;
  }
}
