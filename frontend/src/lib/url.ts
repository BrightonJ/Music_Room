// Pure helpers (unit tested)

// Accepts "192.168.1.42:3000", "http://host:3000/", "https://api.example.com"...
// Returns "http(s)://host[:port]" or null. React Native's URL class is incomplete,
// hence the regular expression.
export function normalizeServerUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  const match = /^(https?):\/\/([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(?::(\d{1,5}))?\/*$/i.exec(value);
  if (!match) return null;
  const [, scheme, host, port] = match;
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null;
  return `${scheme.toLowerCase()}://${host}${port ? `:${port}` : ''}`;
}

// "192.168.1.42:8081" (Expo dev server) -> "http://192.168.1.42:3000"
export function serverUrlFromHostUri(hostUri: string | null | undefined, port = 3000): string | null {
  if (!hostUri) return null;
  const host = hostUri.split('/')[0].split(':')[0];
  return host ? `http://${host}:${port}` : null;
}
