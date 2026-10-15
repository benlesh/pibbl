import { pathToFileURL } from 'node:url';

// Checks the same token exchange npm uses, without publishing or retaining tokens.
export async function checkNpmPublishingAuth({ env = process.env, request = fetch, report = line => process.stdout.write(`${line}\n`) } = {}) {
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
    throw new Error('GitHub publishing authentication requires id-token: write.');
  const secrets = [env.ACTIONS_ID_TOKEN_REQUEST_TOKEN];
  async function read(response, context) {
    const body = await response.json();
    if (!response.ok) {
      let message = typeof body.message === 'string' ? body.message : 'Request rejected';
      for (const secret of secrets) message = message.replaceAll(secret, '[redacted]');
      message = message.replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]');
      throw new Error(`${context} HTTP ${response.status}: ${message.slice(0, 1000)}`);
    }
    return body;
  }
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set('audience', 'npm:registry.npmjs.org');
  const identity = await read(await request(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    signal: AbortSignal.timeout(20000),
  }), 'GitHub identity');
  if (typeof identity.value !== 'string' || !identity.value) throw new Error('GitHub did not return an identity token.');
  secrets.push(identity.value);
  for (const name of ['@pibbl/core', '@pibbl/three', '@pibbl/text', 'pibbl']) {
    const exchange = await read(await request(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${identity.value}` },
      signal: AbortSignal.timeout(20000),
    }), `${name}: npm`);
    if (typeof exchange.token !== 'string' || !exchange.token) throw new Error(`${name}: npm did not return a publishing token.`);
    secrets.push(exchange.token);
    report(`${name}: trusted publisher token exchange accepted (no publication attempted).`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await checkNpmPublishingAuth();
