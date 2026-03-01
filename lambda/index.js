const { Pool } = require('pg')
const { CognitoJwtVerifier } = require('aws-jwt-verify')
const { CognitoIdentityProviderClient,
        AdminCreateUserCommand,
        AdminSetUserPasswordCommand,
        AdminDisableUserCommand } = require('@aws-sdk/client-cognito-identity-provider')

const pool = new Pool({
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     5432,
  ssl:      { rejectUnauthorized: false },
  max:      1,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 5000,
})

// JWT verifier — cached at module level (cold-start once)
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse:   'id',
  clientId:   process.env.COGNITO_CLIENT_ID,
})

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const CORS = {
  'Access-Control-Allow-Origin':  process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-ID, Authorization',
  'Content-Type': 'application/json',
}

const ok  = (body)      => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) })
const err = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) })

// ── Helper: validate + sanitize tenant ID (a-z, 0-9, _ only; 2-50 chars) ───
function sanitizeTenantId(id) {
  return id && /^[a-z0-9_]{2,50}$/.test(id) ? id : null
}

// ── Helper: create schema + tables for a brand-new tenant ───────────────────
async function setupTenantSchema(tenantId) {
  const s = `tenant_${tenantId}`
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".land_use_cases (
      id             SERIAL PRIMARY KEY,
      case_number    VARCHAR(20)   UNIQUE NOT NULL,
      applicant      VARCHAR(200)  NOT NULL,
      address        VARCHAR(300),
      case_type      VARCHAR(50),
      status         VARCHAR(50)   NOT NULL DEFAULT 'Under Review',
      submitted_date DATE,
      parcel_id      VARCHAR(50),
      acreage        NUMERIC(10,2),
      description    TEXT,
      created_at     TIMESTAMPTZ   DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".usage_logs (
      id          SERIAL PRIMARY KEY,
      accessed_at TIMESTAMPTZ   DEFAULT NOW(),
      ip_address  VARCHAR(50),
      country     VARCHAR(100),
      region      VARCHAR(100),
      city        VARCHAR(100),
      browser     VARCHAR(50),
      os          VARCHAR(50),
      device_type VARCHAR(20),
      screen_res  VARCHAR(20),
      language    VARCHAR(20),
      timezone    VARCHAR(100)
    )
  `)
}

// ── Helper: parse User-Agent string ─────────────────────────────────────────
function parseUserAgent(ua = '') {
  const device  = /iPad/i.test(ua) ? 'Tablet'
    : /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop'
  const browser = /Edg\//.test(ua)     ? 'Edge'
    : /Chrome\//.test(ua)   ? 'Chrome'
    : /Firefox\//.test(ua)  ? 'Firefox'
    : /Safari\//.test(ua)   ? 'Safari' : 'Other'
  const os = /iPhone|iPad/.test(ua)    ? 'iOS'
    : /Android/i.test(ua)   ? 'Android'
    : /Windows/i.test(ua)   ? 'Windows'
    : /Mac OS X/i.test(ua)  ? 'macOS'
    : /Linux/i.test(ua)     ? 'Linux'  : 'Other'
  return { browser, os, device }
}

// ── Helper: generate a random password ──────────────────────────────────────
function generatePassword(tenantId) {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `CivicOS#${tenantId.slice(0, 6)}${suffix}1`
}

// ── Helper: auto-generate next case number ───────────────────────────────────
async function nextCaseNumber() {
  const year = new Date().getFullYear()
  const { rows } = await pool.query(
    `SELECT case_number FROM land_use_cases WHERE case_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`LU-${year}-%`]
  )
  if (rows.length === 0) return `LU-${year}-0001`
  const last = parseInt(rows[0].case_number.split('-')[2]) || 0
  return `LU-${year}-${String(last + 1).padStart(4, '0')}`
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod
  const path   = event.requestContext?.http?.path   || event.path || ''

  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }

  // ── JWT Authentication ─────────────────────────────────────────────────────
  let claims = null
  if (path !== '/auth/login') {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return err(401, 'Authentication required')
    try {
      claims = await verifier.verify(token)
    } catch {
      return err(401, 'Invalid or expired token')
    }
  }

  const role      = claims?.['custom:role'] || ''
  const jwtTenant = claims?.['custom:tenant_id'] || ''
  const isSuper   = role === 'super_admin'
  const isAdmin   = role === 'tenant_admin' || isSuper
  const isReadOnly = role === 'tenant_readonly'

  // Tenant resolution: super_admin can override via header
  const tenantId = isSuper
    ? sanitizeTenantId(event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-ID'] || jwtTenant)
    : sanitizeTenantId(jwtTenant)

  const isAdminPath  = path.startsWith('/admin')
  const isLoginPath  = path === '/auth/login'

  // Require tenant for land-use-cases/usage routes
  if (!isLoginPath && !isAdminPath && !tenantId)
    return err(400, 'No tenant resolved for this request')

  // RBAC: block mutations for readonly users
  if (isReadOnly && ['POST', 'PUT', 'DELETE'].includes(method) && !isAdminPath)
    return err(403, 'Read-only access: insufficient permissions')

  // Block tenant management mutations for non-super
  if (path === '/admin/tenants' && method === 'POST' && !isSuper)
    return err(403, 'Insufficient permissions')
  if (path.match(/^\/admin\/tenants\/[^/]+$/) && method === 'DELETE' && !isSuper)
    return err(403, 'Insufficient permissions')

  try {
    // Set search_path for tenant-scoped routes
    if (tenantId && !isAdminPath && !isLoginPath) {
      await pool.query(`SET search_path TO "tenant_${tenantId}", public`)
    }

    // ── POST /auth/login ───────────────────────────────────────────────────
    if (method === 'POST' && path === '/auth/login') {
      const { username, password } = JSON.parse(event.body || '{}')
      if (!username || !password) return err(400, 'Missing username or password')

      const resp = await fetch('https://cognito-idp.us-east-1.amazonaws.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: process.env.COGNITO_CLIENT_ID,
          AuthParameters: { USERNAME: username, PASSWORD: password },
        }),
      })
      const data = await resp.json()
      if (!resp.ok) return err(401, data.message || 'Invalid credentials')

      const idToken = data.AuthenticationResult.IdToken
      const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString())
      return ok({
        idToken,
        username:  payload['cognito:username'],
        role:      payload['custom:role'],
        tenantId:  payload['custom:tenant_id'] || null,
      })
    }

    // ── GET /admin/tenants ─────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/tenants') {
      const { rows } = await pool.query(`
        SELECT tenant_id, name, city, state, created_at::text
        FROM civic_admin.tenants
        ORDER BY name
      `)
      return ok(rows)
    }

    // ── POST /admin/tenants ────────────────────────────────────────────────
    if (method === 'POST' && path === '/admin/tenants') {
      const body = JSON.parse(event.body || '{}')
      const { name, city, state } = body
      const newTenantId = sanitizeTenantId(body.tenant_id)
      if (!newTenantId || !name)
        return err(400, 'Missing required fields: tenant_id, name')

      await pool.query(
        `INSERT INTO civic_admin.tenants (tenant_id, name, city, state) VALUES ($1, $2, $3, $4)`,
        [newTenantId, name, city || null, state || null]
      )
      await setupTenantSchema(newTenantId)
      return ok({ tenant_id: newTenantId })
    }

    // ── PUT /admin/tenants/{tenantId} ──────────────────────────────────────
    const adminPutMatch = path.match(/^\/admin\/tenants\/([^/]+)$/)
    if (method === 'PUT' && adminPutMatch) {
      const targetId = sanitizeTenantId(decodeURIComponent(adminPutMatch[1]))
      if (!targetId) return err(400, 'Invalid tenant ID')
      const body = JSON.parse(event.body || '{}')
      const { name, city, state } = body
      if (!name) return err(400, 'Missing required field: name')

      const result = await pool.query(
        `UPDATE civic_admin.tenants SET name=$1, city=$2, state=$3 WHERE tenant_id=$4`,
        [name, city || null, state || null, targetId]
      )
      if (result.rowCount === 0) return err(404, 'Tenant not found')
      return ok({ updated: targetId })
    }

    // ── DELETE /admin/tenants/{tenantId} ───────────────────────────────────
    const adminDelMatch = path.match(/^\/admin\/tenants\/([^/]+)$/)
    if (method === 'DELETE' && adminDelMatch) {
      const targetId = sanitizeTenantId(decodeURIComponent(adminDelMatch[1]))
      if (!targetId) return err(400, 'Invalid tenant ID')

      const result = await pool.query(
        `DELETE FROM civic_admin.tenants WHERE tenant_id=$1`, [targetId]
      )
      if (result.rowCount === 0) return err(404, 'Tenant not found')
      await pool.query(`DROP SCHEMA IF EXISTS "tenant_${targetId}" CASCADE`)
      return ok({ deleted: targetId })
    }

    // ── GET /admin/users ───────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/users') {
      if (!isAdmin) return err(403, 'Insufficient permissions')
      let query, params
      if (isSuper) {
        query  = `SELECT username, tenant_id, role, created_at::text FROM civic_admin.users ORDER BY created_at`
        params = []
      } else {
        query  = `SELECT username, tenant_id, role, created_at::text FROM civic_admin.users WHERE tenant_id=$1 ORDER BY created_at`
        params = [jwtTenant]
      }
      const { rows } = await pool.query(query, params)
      return ok(rows)
    }

    // ── POST /admin/users ──────────────────────────────────────────────────
    if (method === 'POST' && path === '/admin/users') {
      if (!isAdmin) return err(403, 'Insufficient permissions')
      const body = JSON.parse(event.body || '{}')
      const { username, role: newRole } = body
      let   newTenantId = sanitizeTenantId(body.tenant_id || '')

      const validRoles = isSuper
        ? ['super_admin', 'tenant_admin', 'tenant_readonly']
        : ['tenant_admin', 'tenant_readonly']
      if (!username || !newRole || !validRoles.includes(newRole))
        return err(400, `Missing or invalid fields. Role must be one of: ${validRoles.join(', ')}`)

      if (!isSuper) {
        newTenantId = sanitizeTenantId(jwtTenant)
      }
      if (newRole !== 'super_admin' && !newTenantId)
        return err(400, 'tenant_id is required for non-super_admin roles')

      const password = generatePassword(newTenantId || 'admin')

      await cognitoClient.send(new AdminCreateUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username:   username,
        UserAttributes: [
          { Name: 'custom:role',      Value: newRole },
          { Name: 'custom:tenant_id', Value: newTenantId || '' },
        ],
        MessageAction: 'SUPPRESS',
      }))
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username:   username,
        Password:   password,
        Permanent:  true,
      }))

      await pool.query(
        `INSERT INTO civic_admin.users (username, tenant_id, role) VALUES ($1, $2, $3)`,
        [username, newTenantId || null, newRole]
      )

      return ok({ username, password, role: newRole, tenantId: newTenantId || null })
    }

    // ── DELETE /admin/users/{username} ─────────────────────────────────────
    const userDelMatch = path.match(/^\/admin\/users\/([^/]+)$/)
    if (method === 'DELETE' && userDelMatch) {
      if (!isAdmin) return err(403, 'Insufficient permissions')
      const targetUsername = decodeURIComponent(userDelMatch[1])

      if (!isSuper) {
        const { rows } = await pool.query(
          `SELECT tenant_id FROM civic_admin.users WHERE username=$1`, [targetUsername]
        )
        if (rows.length === 0) return err(404, 'User not found')
        if (rows[0].tenant_id !== jwtTenant) return err(403, 'Cannot delete users outside your tenant')
      }

      try {
        await cognitoClient.send(new AdminDisableUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username:   targetUsername,
        }))
      } catch (e) {
        if (!e.name?.includes('UserNotFoundException')) throw e
      }

      await pool.query(`DELETE FROM civic_admin.users WHERE username=$1`, [targetUsername])
      return ok({ deleted: targetUsername })
    }

    // ── GET /land-use-cases ────────────────────────────────────────────────
    if (method === 'GET' && path === '/land-use-cases') {
      const { rows } = await pool.query(`
        SELECT id, case_number, applicant, address, case_type, status,
               submitted_date::text AS submitted_date,
               parcel_id, acreage::float AS acreage, description,
               created_at::text AS created_at
        FROM land_use_cases
        ORDER BY id ASC
      `)
      return ok(rows)
    }

    // ── POST /land-use-cases ───────────────────────────────────────────────
    if (method === 'POST' && path === '/land-use-cases') {
      const body = JSON.parse(event.body || '{}')
      const { applicant, address, case_type, status, submitted_date, parcel_id, acreage, description } = body
      if (!applicant) return err(400, 'Missing required field: applicant')

      // Use provided case_number or auto-generate
      let caseNumber = body.case_number?.trim()
      if (!caseNumber) caseNumber = await nextCaseNumber()

      await pool.query(`
        INSERT INTO land_use_cases
          (case_number, applicant, address, case_type, status, submitted_date, parcel_id, acreage, description)
        VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9)
      `, [
        caseNumber,
        applicant,
        address || null,
        case_type || 'Rezoning',
        status || 'Under Review',
        submitted_date || null,
        parcel_id || null,
        acreage ? parseFloat(acreage) : null,
        description || null,
      ])
      return ok({ case_number: caseNumber })
    }

    // ── PUT /land-use-cases/{id} ───────────────────────────────────────────
    const putMatch = path.match(/^\/land-use-cases\/(\d+)$/)
    if (method === 'PUT' && putMatch) {
      const id = parseInt(putMatch[1])
      const body = JSON.parse(event.body || '{}')
      const { applicant, address, case_type, status, submitted_date, parcel_id, acreage, description } = body
      if (!applicant) return err(400, 'Missing required field: applicant')

      const result = await pool.query(`
        UPDATE land_use_cases
        SET applicant=$1, address=$2, case_type=$3, status=$4,
            submitted_date=$5::date, parcel_id=$6, acreage=$7, description=$8,
            updated_at=NOW()
        WHERE id=$9
      `, [
        applicant,
        address || null,
        case_type || 'Rezoning',
        status || 'Under Review',
        submitted_date || null,
        parcel_id || null,
        acreage ? parseFloat(acreage) : null,
        description || null,
        id,
      ])
      if (result.rowCount === 0) return err(404, 'Case not found')
      return ok({ updated: id })
    }

    // ── DELETE /land-use-cases/{id} ────────────────────────────────────────
    const delMatch = path.match(/^\/land-use-cases\/(\d+)$/)
    if (method === 'DELETE' && delMatch) {
      const id = parseInt(delMatch[1])
      const result = await pool.query(`DELETE FROM land_use_cases WHERE id=$1`, [id])
      if (result.rowCount === 0) return err(404, 'Case not found')
      return ok({ deleted: id })
    }

    // ── POST /usage — record page view ─────────────────────────────────────
    if (method === 'POST' && path === '/usage') {
      const ip   = event.requestContext?.http?.sourceIp || null
      const body = JSON.parse(event.body || '{}')
      const { screen_res, language, timezone, user_agent } = body
      const { browser, os, device } = parseUserAgent(user_agent)

      let country = null, region = null, city = null
      const isPrivate = !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
      if (!isPrivate) {
        try {
          const geo = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`)
          if (geo.ok) {
            const g = await geo.json()
            if (g.status === 'success') { country = g.country; region = g.regionName; city = g.city }
          }
        } catch {}
      }

      await pool.query(`
        INSERT INTO usage_logs
          (ip_address, country, region, city, browser, os, device_type, screen_res, language, timezone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [ip, country, region, city, browser, os, device, screen_res||null, language||null, timezone||null])
      return ok({ logged: true })
    }

    // ── GET /usage — aggregate analytics ───────────────────────────────────
    if (method === 'GET' && path === '/usage') {
      const [daily, totals, byType, byStatus, recent] = await Promise.all([
        pool.query(`
          SELECT TO_CHAR(DATE(accessed_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM usage_logs WHERE accessed_at >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(accessed_at) ORDER BY day
        `),
        pool.query(`
          SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE accessed_at >= CURRENT_DATE)::int AS today,
            COUNT(*) FILTER (WHERE accessed_at >= NOW() - INTERVAL '7 days')::int AS this_week
          FROM usage_logs
        `),
        pool.query(`
          SELECT COALESCE(case_type,'Unknown') AS case_type, COUNT(*)::int AS count
          FROM land_use_cases GROUP BY case_type ORDER BY count DESC
        `),
        pool.query(`
          SELECT COALESCE(status,'Unknown') AS status, COUNT(*)::int AS count
          FROM land_use_cases GROUP BY status ORDER BY count DESC
        `),
        pool.query(`
          SELECT accessed_at, ip_address, country, city, browser, os, device_type
          FROM usage_logs ORDER BY accessed_at DESC LIMIT 50
        `),
      ])

      return ok({
        daily:    daily.rows,
        totals:   totals.rows[0],
        byType:   byType.rows,
        byStatus: byStatus.rows,
        recent:   recent.rows,
      })
    }

    return err(404, 'Not found')
  } catch (e) {
    console.error(e)
    return err(500, e.message)
  }
}
