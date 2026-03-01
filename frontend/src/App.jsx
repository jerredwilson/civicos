import { useState, useEffect } from 'react'
import Logo from './Logo'

const BASE_URL   = 'https://idmbxz1s4i.execute-api.us-east-1.amazonaws.com'
const LOGIN_URL  = `${BASE_URL}/auth/login`
const ADMIN_URL  = `${BASE_URL}/admin/tenants`
const USERS_URL  = `${BASE_URL}/admin/users`
const CASES_URL  = `${BASE_URL}/land-use-cases`
const USAGE_URL  = `${BASE_URL}/usage`

const CASE_TYPES = ['Rezoning', 'Variance', 'Special Use', 'Plat', 'Site Plan']
const STATUSES   = ['Under Review', 'Approved', 'Denied', 'Withdrawn', 'Pending Hearing']

const ROWS_PER_PAGE = 15

const emptyForm = () => ({
  case_number: '', applicant: '', address: '', case_type: 'Rezoning',
  status: 'Under Review', submitted_date: '', parcel_id: '', acreage: '', description: '',
})

const formatDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

// ── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid username or password'); return }
      onLogin(data)
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <Logo size={44} text light={false} textSize="2rem" />
        </div>
        <p className="login-subtitle">City Operations Suite</p>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              className="login-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required autoFocus autoComplete="username"
            />
          </div>
          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Tenant Selector ──────────────────────────────────────────────────────────
function TenantSelector({ authHeaders, onSelect, onLogout }) {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(ADMIN_URL, { headers: authHeaders })
      .then(r => r.json()).then(setTenants).finally(() => setLoading(false))
  }, [])

  return (
    <div className="tenant-selector-screen">
      <div className="tenant-selector-card">
        <Logo size={44} text={false} />
        <h2 className="tenant-selector-title">CivicOS</h2>
        <p className="tenant-selector-sub">Select a city to continue</p>
        {loading
          ? <div className="tenant-spinner">Loading cities…</div>
          : <div className="tenant-grid">
              {tenants.map(t => (
                <button key={t.tenant_id} className="tenant-tile" onClick={() => onSelect(t)}>
                  <span className="tenant-tile-icon">🏛</span>
                  <span className="tenant-tile-name">{t.name}</span>
                  {t.city && <span className="tenant-tile-sub">{t.city}, {t.state}</span>}
                </button>
              ))}
            </div>
        }
        <button className="btn-link" onClick={onLogout} style={{ marginTop: 20 }}>Sign out</button>
      </div>
    </div>
  )
}

// ── Land Use Case Form Modal ──────────────────────────────────────────────────
function CaseModal({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || emptyForm())
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial?.id ? 'Edit Case' : 'New Land Use Case'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Case Number</label>
              <input value={form.case_number} onChange={e => set('case_number', e.target.value)}
                placeholder="Auto-generated if blank" />
            </div>
            <div className="form-group">
              <label>Submitted Date</label>
              <input type="date" value={form.submitted_date} onChange={e => set('submitted_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Applicant *</label>
            <input value={form.applicant} onChange={e => set('applicant', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Address / Location</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Case Type</label>
              <select value={form.case_type} onChange={e => set('case_type', e.target.value)}>
                {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Parcel ID</label>
              <input value={form.parcel_id} onChange={e => set('parcel_id', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Acreage</label>
              <input type="number" step="0.01" value={form.acreage} onChange={e => set('acreage', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={saving || !form.applicant}>
            {saving ? 'Saving…' : 'Save Case'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Land Use Cases Page ───────────────────────────────────────────────────────
function LandUseCasesPage({ authHeaders, isReadOnly }) {
  const [cases, setCases]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editCase, setEditCase]  = useState(null)
  const [saving, setSaving]      = useState(false)
  const [search, setSearch]      = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage]          = useState(1)
  const [detail, setDetail]      = useState(null)

  const loadCases = () => {
    setLoading(true)
    fetch(CASES_URL, { headers: authHeaders })
      .then(r => r.json()).then(setCases).finally(() => setLoading(false))
  }
  useEffect(loadCases, [authHeaders['Authorization']])

  const filtered = cases.filter(c => {
    const q = search.toLowerCase()
    const matchText = !q || c.case_number?.toLowerCase().includes(q)
      || c.applicant?.toLowerCase().includes(q)
      || c.address?.toLowerCase().includes(q)
    const matchType   = !filterType   || c.case_type === filterType
    const matchStatus = !filterStatus || c.status    === filterStatus
    return matchText && matchType && matchStatus
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const paginated  = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const openNew  = () => { setEditCase(null); setShowModal(true) }
  const openEdit = (c)  => { setEditCase(c);  setShowModal(true) }

  const handleSave = async (form) => {
    setSaving(true)
    try {
      const isEdit = !!editCase?.id
      const url    = isEdit ? `${CASES_URL}/${editCase.id}` : CASES_URL
      const res = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: authHeaders,
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Save failed'); return }
      setShowModal(false); loadCases()
    } finally { setSaving(false) }
  }

  const handleDelete = async (c) => {
    if (!confirm(`Delete case ${c.case_number}?`)) return
    await fetch(`${CASES_URL}/${c.id}`, { method: 'DELETE', headers: authHeaders })
    loadCases()
  }

  const typeColor = {
    'Rezoning':    '#3b82f6', 'Variance': '#8b5cf6', 'Special Use': '#f59e0b',
    'Plat':        '#10b981', 'Site Plan': '#06b6d4',
  }
  const statusColor = {
    'Under Review': '#f59e0b', 'Approved': '#10b981', 'Denied': '#ef4444',
    'Withdrawn':    '#94a3b8', 'Pending Hearing': '#6366f1',
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Land &amp; Use Planning</h1>
          <p className="page-subtitle">Land use case management and tracking</p>
        </div>
        {!isReadOnly && (
          <button className="btn-primary" onClick={openNew}>+ New Case</button>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search by case #, applicant, or address…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select className="filter-select" value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="filter-select" value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="filter-count">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading
          ? <div className="loading-msg">Loading cases…</div>
          : filtered.length === 0
            ? <div className="empty-msg">No land use cases found.</div>
            : <table className="data-table">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Applicant</th>
                    <th>Address</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="col-date">Submitted</th>
                    <th className="col-acreage">Acreage</th>
                    {!isReadOnly && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(c => (
                    <tr key={c.id} className="table-row" onClick={() => setDetail(c)}>
                      <td className="mono">{c.case_number}</td>
                      <td>{c.applicant}</td>
                      <td className="text-muted">{c.address || '—'}</td>
                      <td>
                        <span className="badge" style={{ background: typeColor[c.case_type] + '22', color: typeColor[c.case_type] }}>
                          {c.case_type}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: statusColor[c.status] + '22', color: statusColor[c.status] }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="col-date">{formatDate(c.submitted_date)}</td>
                      <td className="col-acreage">{c.acreage ? `${c.acreage} ac` : '—'}</td>
                      {!isReadOnly && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-icon" onClick={() => openEdit(c)} title="Edit">✎</button>
                            <button className="btn-icon danger" onClick={() => handleDelete(c)} title="Delete">✕</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
        </div>
      )}

      {/* Detail modal (view only) */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Case Details — {detail.case_number}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-row"><span className="detail-label">Applicant</span><span>{detail.applicant}</span></div>
                <div className="detail-row"><span className="detail-label">Address</span><span>{detail.address || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Case Type</span>
                  <span className="badge" style={{ background: typeColor[detail.case_type] + '22', color: typeColor[detail.case_type] }}>{detail.case_type}</span>
                </div>
                <div className="detail-row"><span className="detail-label">Status</span>
                  <span className="badge" style={{ background: statusColor[detail.status] + '22', color: statusColor[detail.status] }}>{detail.status}</span>
                </div>
                <div className="detail-row"><span className="detail-label">Submitted</span><span>{formatDate(detail.submitted_date)}</span></div>
                <div className="detail-row"><span className="detail-label">Parcel ID</span><span>{detail.parcel_id || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Acreage</span><span>{detail.acreage ? `${detail.acreage} ac` : '—'}</span></div>
                {detail.description && (
                  <div className="detail-row full"><span className="detail-label">Description</span><span>{detail.description}</span></div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {!isReadOnly && <button className="btn-secondary" onClick={() => { setDetail(null); openEdit(detail) }}>Edit</button>}
              <button className="btn-primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <CaseModal
          initial={editCase}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </div>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
function DashboardPage({ currentTenant }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{currentTenant?.name || 'City Operations Suite'}</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon">🏛</div>
          <div className="stat-label">CivicOS</div>
          <div className="stat-value" style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>
            City Operations Suite
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Land &amp; Use Planning</div>
          <div className="stat-sub">Active module</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏗</div>
          <div className="stat-label">9 More Modules</div>
          <div className="stat-sub">Coming soon</div>
        </div>
      </div>
    </div>
  )
}

// ── Department Stub Page ──────────────────────────────────────────────────────
function DeptStubPage({ label, icon }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{label}</h1>
          <p className="page-subtitle">City department module</p>
        </div>
      </div>
      <div className="dept-stub">
        <div className="dept-stub-icon">{icon}</div>
        <h2 className="dept-stub-title">{label}</h2>
        <p className="dept-stub-text">This module is under development and will be available in a future release.</p>
      </div>
    </div>
  )
}

// ── Users Page ────────────────────────────────────────────────────────────────
function UsersPage({ authHeaders, isSuper, jwtTenant }) {
  const [users, setUsers]       = useState([])
  const [tenants, setTenants]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [newUser, setNewUser]   = useState({ username: '', role: 'tenant_admin', tenant_id: '' })
  const [created, setCreated]   = useState(null)

  const loadUsers = () => {
    setLoading(true)
    fetch(USERS_URL, { headers: authHeaders })
      .then(r => r.json()).then(setUsers).finally(() => setLoading(false))
  }
  useEffect(loadUsers, [])
  useEffect(() => {
    if (isSuper) {
      fetch(ADMIN_URL, { headers: authHeaders }).then(r => r.json()).then(setTenants)
    }
  }, [isSuper])

  const handleCreate = async () => {
    if (!newUser.username) { alert('Username is required'); return }
    setSaving(true)
    try {
      const body = { ...newUser }
      if (!isSuper) body.tenant_id = jwtTenant
      const res = await fetch(USERS_URL, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to create user'); return }
      setCreated(data); setShowForm(false)
      setNewUser({ username: '', role: 'tenant_admin', tenant_id: '' })
      loadUsers()
    } finally { setSaving(false) }
  }

  const handleDelete = async (username) => {
    if (!confirm(`Delete user "${username}"?`)) return
    await fetch(`${USERS_URL}/${encodeURIComponent(username)}`, { method: 'DELETE', headers: authHeaders })
    loadUsers()
  }

  const roleLabel = { super_admin: 'Super Admin', tenant_admin: 'City Admin', tenant_readonly: 'Read Only' }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage user accounts and access</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New User</button>
      </div>

      {created && (
        <div className="alert-success">
          <strong>User created:</strong> {created.username} — Temporary password: <code>{created.password}</code>
          <button className="alert-close" onClick={() => setCreated(null)}>✕</button>
        </div>
      )}

      <div className="table-container">
        {loading
          ? <div className="loading-msg">Loading users…</div>
          : <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  {isSuper && <th>City</th>}
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username}>
                    <td className="mono">{u.username}</td>
                    <td><span className="role-badge">{roleLabel[u.role] || u.role}</span></td>
                    {isSuper && <td className="text-muted">{u.tenant_id || '—'}</td>}
                    <td className="text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="btn-icon danger" onClick={() => handleDelete(u.username)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New User</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Username *</label>
                <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                  {isSuper && <option value="super_admin">Super Admin</option>}
                  <option value="tenant_admin">City Admin</option>
                  <option value="tenant_readonly">Read Only</option>
                </select>
              </div>
              {isSuper && (
                <div className="form-group">
                  <label>City</label>
                  <select value={newUser.tenant_id} onChange={e => setNewUser(u => ({ ...u, tenant_id: e.target.value }))}>
                    <option value="">— None (super admin) —</option>
                    {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                A generated password will be shown once after creation.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !newUser.username}>
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Admin Page (Tenant Management) ────────────────────────────────────────────
function AdminPage({ authHeaders }) {
  const [tenants, setTenants]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ tenant_id: '', name: '', city: '', state: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const load = () => {
    setLoading(true)
    fetch(ADMIN_URL, { headers: authHeaders }).then(r => r.json()).then(setTenants).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleCreate = async () => {
    const res = await fetch(ADMIN_URL, { method: 'POST', headers: authHeaders, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Failed'); return }
    setShowForm(false); setForm({ tenant_id: '', name: '', city: '', state: '' }); load()
  }

  const handleDelete = async (id) => {
    if (!confirm(`Delete city "${id}" and ALL its data?`)) return
    await fetch(`${ADMIN_URL}/${id}`, { method: 'DELETE', headers: authHeaders })
    load()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin — Cities</h1>
          <p className="page-subtitle">Manage city tenants</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New City</button>
      </div>
      <div className="table-container">
        {loading ? <div className="loading-msg">Loading…</div> : (
          <table className="data-table">
            <thead><tr><th>Tenant ID</th><th>Name</th><th>City</th><th>State</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.tenant_id}>
                  <td className="mono">{t.tenant_id}</td>
                  <td>{t.name}</td>
                  <td>{t.city || '—'}</td>
                  <td>{t.state || '—'}</td>
                  <td className="text-muted">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                  <td><button className="btn-icon danger" onClick={() => handleDelete(t.tenant_id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New City</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>Tenant ID (lowercase, underscores)</label>
                <input value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)} placeholder="e.g. frisco_tx" /></div>
              <div className="form-group"><label>Display Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. City of Frisco" /></div>
              <div className="form-row">
                <div className="form-group"><label>City</label>
                  <input value={form.city} onChange={e => set('city', e.target.value)} /></div>
                <div className="form-group"><label>State</label>
                  <input value={form.state} onChange={e => set('state', e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !form.tenant_id || !form.name}>
                {saving ? 'Creating…' : 'Create City'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Usage Page ────────────────────────────────────────────────────────────────
function UsagePage({ authHeaders }) {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Log this page view
    fetch(USAGE_URL, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        user_agent: navigator.userAgent,
        screen_res: `${screen.width}x${screen.height}`,
        language:   navigator.language,
        timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }).catch(() => {})

    fetch(USAGE_URL, { headers: authHeaders })
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-content"><div className="loading-msg">Loading usage data…</div></div>
  if (!data)   return <div className="page-content"><div className="loading-msg">No data available.</div></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usage Analytics</h1>
          <p className="page-subtitle">Session activity and case statistics</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value">{data.totals?.total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">{data.totals?.today ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Week</div>
          <div className="stat-value">{data.totals?.this_week ?? 0}</div>
        </div>
      </div>

      {/* Cases by type */}
      {data.byType?.length > 0 && (
        <div className="usage-section">
          <h3 className="section-title">Cases by Type</h3>
          <div className="usage-table-wrap">
            <table className="data-table">
              <thead><tr><th>Type</th><th>Count</th></tr></thead>
              <tbody>{data.byType.map(r => (
                <tr key={r.case_type}><td>{r.case_type}</td><td>{r.count}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cases by status */}
      {data.byStatus?.length > 0 && (
        <div className="usage-section">
          <h3 className="section-title">Cases by Status</h3>
          <div className="usage-table-wrap">
            <table className="data-table">
              <thead><tr><th>Status</th><th>Count</th></tr></thead>
              <tbody>{data.byStatus.map(r => (
                <tr key={r.status}><td>{r.status}</td><td>{r.count}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {data.recent?.length > 0 && (
        <div className="usage-section">
          <h3 className="section-title">Recent Sessions</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Location</th><th>Browser</th><th>OS</th><th>Device</th></tr></thead>
              <tbody>{data.recent.map((r, i) => (
                <tr key={i}>
                  <td className="text-muted">{new Date(r.accessed_at).toLocaleString()}</td>
                  <td>{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>{r.browser || '—'}</td>
                  <td>{r.os || '—'}</td>
                  <td>{r.device_type || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nav Items ─────────────────────────────────────────────────────────────────
const NAV_DEPARTMENTS = [
  { label: 'Dashboard',                          icon: '⊞' },
  { label: 'Land & Use Planning',                icon: '📋' },
  { label: 'Permit & Inspections',               icon: '🔍' },
  { label: 'Public Works & Infrastructure',      icon: '🔧' },
  { label: 'Finance & Budget',                   icon: '💰' },
  { label: 'Public Safety',                      icon: '🛡' },
  { label: 'Community & Human Services',         icon: '🤝' },
  { label: 'Economic Development',               icon: '📈' },
  { label: 'Utilities & Env Services',           icon: '♻' },
  { label: 'Council & Legislative Support',      icon: '⚖' },
  { label: 'Constituent & Legislative Services', icon: '📣' },
]

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // Auth state (persisted to sessionStorage)
  const [authSession, setAuthSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('civicos_auth')) } catch { return null }
  })

  // Current tenant (persisted to localStorage)
  const [currentTenant, setCurrentTenant] = useState(() => {
    try { return JSON.parse(localStorage.getItem('civicos_tenant')) } catch { return null }
  })

  const [activePage, setActivePage]   = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 640)

  const isSuper    = authSession?.role === 'super_admin'
  const isAdmin    = authSession?.role === 'tenant_admin' || isSuper
  const isReadOnly = authSession?.role === 'tenant_readonly'

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(authSession ? { 'Authorization': `Bearer ${authSession.idToken}` } : {}),
    ...(currentTenant && isSuper ? { 'X-Tenant-ID': currentTenant.tenant_id } : {}),
  }

  // Auto-select tenant for non-super users after login
  useEffect(() => {
    if (!authSession || isSuper || currentTenant) return
    fetch(ADMIN_URL, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.idToken}` } })
      .then(r => r.json())
      .then(tenants => {
        const match = tenants.find(t => t.tenant_id === authSession.tenantId)
        if (match) selectTenant(match)
      })
      .catch(() => {})
  }, [authSession?.username])

  function handleLogin(session) {
    sessionStorage.setItem('civicos_auth', JSON.stringify(session))
    setAuthSession(session)
    // clear cached tenant if session changed
    const cached = JSON.parse(localStorage.getItem('civicos_tenant') || 'null')
    if (cached && session.role !== 'super_admin' && cached.tenant_id !== session.tenantId) {
      localStorage.removeItem('civicos_tenant')
      setCurrentTenant(null)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('civicos_auth')
    localStorage.removeItem('civicos_tenant')
    setAuthSession(null)
    setCurrentTenant(null)
  }

  function selectTenant(t) {
    localStorage.setItem('civicos_tenant', JSON.stringify(t))
    setCurrentTenant(t)
  }

  // ── Render gates ──
  if (!authSession) return <LoginPage onLogin={handleLogin} />

  if (!currentTenant) {
    if (isSuper) {
      return (
        <TenantSelector
          authHeaders={authHeaders}
          onSelect={selectTenant}
          onLogout={handleLogout}
        />
      )
    }
    // non-super: show spinner while auto-selecting
    return (
      <div className="login-screen">
        <div style={{ color: '#1e3a8a', fontSize: 16 }}>Loading your city…</div>
      </div>
    )
  }

  // ── Build nav ──
  const navItems = [
    ...NAV_DEPARTMENTS,
    ...(isAdmin ? [{ label: 'Users', icon: '👤' }] : []),
    ...(isSuper ? [{ label: 'Admin', icon: '⚙' }] : []),
    { label: 'Usage', icon: '📊' },
  ]

  // ── Active page render ──
  function renderPage() {
    if (activePage === 'Dashboard')           return <DashboardPage currentTenant={currentTenant} />
    if (activePage === 'Land & Use Planning') return <LandUseCasesPage authHeaders={authHeaders} isReadOnly={isReadOnly} />
    if (activePage === 'Users')               return <UsersPage authHeaders={authHeaders} isSuper={isSuper} jwtTenant={authSession.tenantId} />
    if (activePage === 'Admin')               return <AdminPage authHeaders={authHeaders} />
    if (activePage === 'Usage')               return <UsagePage authHeaders={authHeaders} />
    // All other departments → stub
    const dept = NAV_DEPARTMENTS.find(n => n.label === activePage)
    return <DeptStubPage label={activePage} icon={dept?.icon || '🏛'} />
  }

  return (
    <div className={`shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Mobile sidebar backdrop */}
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Logo size={26} text={sidebarOpen} light textSize="1rem" />
          </div>
          <button className="collapse-btn" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        <nav className="nav">
          {navItems.map(item => (
            <div
              key={item.label}
              className={`nav-item ${activePage === item.label ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.label)
                if (window.innerWidth <= 640) setSidebarOpen(false)
              }}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </div>
          ))}
        </nav>

        {isSuper && (
          <div className="sidebar-footer">
            {sidebarOpen && (
              <button className="btn-switch" onClick={() => {
                setCurrentTenant(null)
                localStorage.removeItem('civicos_tenant')
                if (window.innerWidth <= 640) setSidebarOpen(false)
              }}>
                ⇄ Switch City
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle navigation">
            ☰
          </button>
          <div className="topbar-left">
            <span className="topbar-city">{currentTenant.name}</span>
            {currentTenant.city && (
              <span className="topbar-sub">{currentTenant.city}, {currentTenant.state}</span>
            )}
          </div>
          <div className="topbar-right">
            <div className="avatar">{authSession.username.slice(0, 2).toUpperCase()}</div>
            <span className="topbar-username">{authSession.username}</span>
            {isReadOnly && <span className="badge badge-readonly">Read Only</span>}
            <button className="btn-logout" onClick={handleLogout} title="Sign out">→</button>
          </div>
        </header>

        {/* Page */}
        <main className="content">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
