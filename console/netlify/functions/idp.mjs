/**
 * The mock identity provider.
 *
 * This is the part of the demo that proves the SSO story rather than
 * describing it. The OIDC flow below is the real authorization-code flow: a
 * redirect to an authorize endpoint, a login, a redirect back carrying a
 * code, a back-channel exchange of that code for tokens, and a JWT you can
 * paste into jwt.io and read. The SAML flow produces a real SAML 2.0
 * Response document with a real Assertion in it.
 *
 * What is NOT real, stated plainly because the whole point is to be
 * inspectable:
 *
 *   - The IdP has no user database of its own. It issues a token for whoever
 *     the demo says is signing in.
 *   - Tokens are signed HS256 with a key from the environment. A production
 *     IdP signs RS256 and publishes a rotating JWKS; HS256 is used here
 *     because a serverless function has no stable place to keep a private
 *     key, and a key regenerated per container would make verification fail
 *     at random. The discovery document says HS256, so it is not pretending.
 *   - The SAML Response carries a signature element whose digest is real but
 *     which is not a full XML-DSig over a canonicalised document. Doing that
 *     properly needs a signing library and a real certificate.
 *
 * Everything an integrator needs to see — the endpoints, the parameters, the
 * claim set, the assertion structure — is genuine.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.TENANT_SECRET || 'dev-only-not-a-secret'
const ISSUER_PATH = '/idp'

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const fromB64url = (s) => Buffer.from(s, 'base64url').toString('utf8')

function sign (data) {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

/** A real JWT: header.payload.signature, HS256. */
function issueJwt (claims, { expiresIn = 3600 } = {}) {
  const header = { alg: 'HS256', typ: 'JWT', kid: 'i365-demo-1' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { iat: now, nbf: now, exp: now + expiresIn, jti: randomUUID(), ...claims }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  return `${signingInput}.${sign(signingInput)}`
}

function verifyJwt (token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return { valid: false, error: 'Not three segments' }
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`))
  const given = Buffer.from(parts[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { valid: false, error: 'Signature does not verify' }
  }
  const payload = JSON.parse(fromB64url(parts[1]))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, error: 'Token has expired', payload }
  }
  return { valid: true, payload, header: JSON.parse(fromB64url(parts[0])) }
}

/* Authorization codes. A real IdP persists these; a ten-minute self-describing
   code keeps the demo stateless across serverless instances, which a shared
   in-memory map would not be. */
function issueCode (data) {
  const body = b64url(JSON.stringify({ ...data, exp: Date.now() + 600_000 }))
  return `${body}.${sign(body)}`
}

function redeemCode (code) {
  const [body, mac] = String(code || '').split('.')
  if (!body || !mac) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const data = JSON.parse(fromB64url(body))
  if (data.exp < Date.now()) return null
  return data
}

const html = (body) => new Response(body, {
  status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }
})
const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status, headers: { 'content-type': 'application/json' }
})

// ------------------------------------------------------------------ SAML
function samlResponse ({ user, email, audience, acsUrl, issuer }) {
  const id = '_' + randomUUID().replace(/-/g, '')
  const assertionId = '_' + randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()
  const notAfter = new Date(Date.now() + 5 * 60_000).toISOString()
  const digest = createHmac('sha256', SECRET).update(assertionId + email).digest('base64')

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="${id}" Version="2.0" IssueInstant="${now}"
                Destination="${acsUrl}">
  <saml:Issuer>${issuer}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion ID="${assertionId}" Version="2.0" IssueInstant="${now}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo>
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference URI="#${assertionId}">
          <ds:DigestValue>${digest}</ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>
      <!-- demo: digest is real, the enveloped XML-DSig is not -->
    </ds:Signature>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notAfter}" Recipient="${acsUrl}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${now}" NotOnOrAfter="${notAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${now}" SessionIndex="${assertionId}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="displayName"><saml:AttributeValue>${user}</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>Engineering</saml:AttributeValue>
        <saml:AttributeValue>All Staff</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`
}

// --------------------------------------------------------------- handler
export default async (req) => {
  const url = new URL(req.url)
  const origin = url.origin
  const issuer = origin + ISSUER_PATH
  const path = url.pathname.replace(/^\/idp\/?/, '')
  const q = url.searchParams

  // ---- OIDC discovery ---------------------------------------------------
  if (path === '.well-known/openid-configuration') {
    return json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      scopes_supported: ['openid', 'profile', 'email', 'groups'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      claims_supported: ['sub', 'email', 'name', 'groups', 'iss', 'aud', 'exp', 'iat'],
      // stated rather than hidden
      'x-demo-note': 'Mock IdP. HS256 because a serverless function has no stable private key store; a production IdP signs RS256 and publishes a rotating JWKS here.'
    })
  }

  if (path === 'jwks') {
    return json({
      keys: [],
      'x-demo-note': 'Empty by design: HS256 is symmetric, so there is no public key to publish. An RS256 IdP lists its signing keys here.'
    })
  }

  // ---- OIDC authorize ---------------------------------------------------
  // Renders a consent screen, then redirects back with ?code=...&state=...
  if (path === 'authorize') {
    const redirectUri = q.get('redirect_uri') || `${origin}/profile/openid`
    const state = q.get('state') || ''
    const clientId = q.get('client_id') || 'i365-console'
    const email = q.get('login_hint') || 'demo.admin@instasafe.com'

    const code = issueCode({ sub: 'u-' + b64url(email).slice(0, 10), email, clientId, redirectUri })
    const back = new URL(redirectUri)
    back.searchParams.set('code', code)
    if (state) back.searchParams.set('state', state)

    return html(`<!doctype html><html><head><meta charset="utf-8">
<title>Sign in — Demo IdP</title>
<style>
 body{font-family:Inter,-apple-system,"Segoe UI",sans-serif;background:#fafafb;color:#1f2023;
      display:grid;place-items:center;min-height:100vh;margin:0;font-size:13px}
 .c{background:#fff;border-radius:10px;box-shadow:0 10px 30px -12px rgba(0,0,0,.2);
    padding:30px;width:min(380px,92vw)}
 h1{font-size:19px;font-weight:450;letter-spacing:-.02em;margin:0 0 4px}
 p{color:#5e5f6e;margin:0 0 20px}
 dl{display:grid;grid-template-columns:96px 1fr;gap:7px 12px;margin:0 0 22px;font-size:12px}
 dt{color:#9394a1}dd{margin:0;word-break:break-all}
 .b{display:block;width:100%;padding:11px;border:0;border-radius:6px;background:#5b4fd1;
    color:#fff;font:inherit;font-weight:500;cursor:pointer;text-align:center;text-decoration:none}
 .n{margin-top:18px;font-size:11.5px;color:#9394a1;border-top:1px solid #eeeef0;padding-top:14px}
</style></head><body><div class="c">
 <h1>Demo identity provider</h1>
 <p>The console has asked this IdP to authenticate you.</p>
 <dl>
   <dt>Requested by</dt><dd>${clientId}</dd>
   <dt>Signing in as</dt><dd>${email}</dd>
   <dt>Scopes</dt><dd>${q.get('scope') || 'openid profile email'}</dd>
   <dt>Returns to</dt><dd>${redirectUri}</dd>
 </dl>
 <a class="b" href="${back.toString()}">Approve and continue</a>
 <p class="n">This is a real OIDC authorization-code redirect. Approving sends an
 authorization code back to the console, which exchanges it for a signed token
 over a back channel.</p>
</div></body></html>`)
  }

  // ---- OIDC token exchange ---------------------------------------------
  if (path === 'token' && req.method === 'POST') {
    const form = new URLSearchParams(await req.text())
    const data = redeemCode(form.get('code'))
    if (!data) return json({ error: 'invalid_grant', error_description: 'Code is unknown or expired' }, 400)

    const claims = {
      iss: issuer, aud: data.clientId, sub: data.sub,
      email: data.email, email_verified: true,
      name: data.email.split('@')[0].split('.').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      groups: ['Engineering', 'All Staff'],
      auth_time: Math.floor(Date.now() / 1000)
    }
    return json({
      access_token: issueJwt({ ...claims, scope: 'openid profile email' }),
      id_token: issueJwt(claims),
      token_type: 'Bearer',
      expires_in: 3600
    })
  }

  // ---- token introspection, so the console can show the decode ----------
  if (path === 'introspect' && req.method === 'POST') {
    const { token } = await req.json().catch(() => ({}))
    return json(verifyJwt(token))
  }

  // ---- SAML -------------------------------------------------------------
  if (path === 'saml/metadata') {
    return new Response(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${issuer}/saml/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`, { headers: { 'content-type': 'application/xml' } })
  }

  if (path === 'saml/sso') {
    const email = q.get('login_hint') || 'demo.admin@instasafe.com'
    const acsUrl = q.get('acs') || `${origin}/profile/saml`
    const audience = q.get('audience') || 'i365-console'
    const xml = samlResponse({
      user: email.split('@')[0], email, audience, acsUrl, issuer
    })
    return json({
      samlResponse: Buffer.from(xml).toString('base64'),
      xml,
      relayState: q.get('RelayState') || null
    })
  }

  return json({ error: 'not_found', path }, 404)
}

export const config = { path: '/idp/*' }
