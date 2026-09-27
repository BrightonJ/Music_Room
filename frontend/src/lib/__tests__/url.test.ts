import { describe, expect, it } from '@jest/globals';
import { normalizeServerUrl, serverUrlFromHostUri } from '../url';

describe('normalizeServerUrl', () => {
  it('adds http:// and removes trailing slashes', () => {
    expect(normalizeServerUrl('192.168.1.42:3000')).toBe('http://192.168.1.42:3000');
    expect(normalizeServerUrl(' http://192.168.1.42:3000/ ')).toBe('http://192.168.1.42:3000');
    expect(normalizeServerUrl('HTTPS://api.example.com')).toBe('https://api.example.com');
  });

  it('rejects invalid addresses', () => {
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl('http://bad host')).toBeNull();
    expect(normalizeServerUrl('http://host:99999')).toBeNull();
    expect(normalizeServerUrl('http://host/api')).toBeNull();
    expect(normalizeServerUrl('ftp://host')).toBeNull();
  });
});

describe('serverUrlFromHostUri', () => {
  it('uses the Expo dev server host with the API port', () => {
    expect(serverUrlFromHostUri('192.168.1.42:8081')).toBe('http://192.168.1.42:3000');
    expect(serverUrlFromHostUri(undefined)).toBeNull();
  });
});
