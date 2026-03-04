// Run: node migrate.js
// Requires env vars: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
// Or set them inline below for one-time use

const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'meridian-db.copiq8c0qa90.us-east-1.rds.amazonaws.com',
  database: process.env.DB_NAME     || 'meridiandb',
  user:     process.env.DB_USER     || 'meridian',
  password: process.env.DB_PASSWORD || 'Meridian#2026!',
  port:     5432,
  ssl:      { rejectUnauthorized: false },
})

async function run() {
  console.log('Connecting to RDS...')

  // civic_admin schema + tables
  await pool.query(`CREATE SCHEMA IF NOT EXISTS civic_admin`)
  console.log('Created schema: civic_admin')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS civic_admin.tenants (
      tenant_id   VARCHAR(50) PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      city        VARCHAR(100),
      state       VARCHAR(50),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    INSERT INTO civic_admin.tenants (tenant_id, name, city, state) VALUES
      ('mckinney_tx', 'City of McKinney', 'McKinney', 'TX'),
      ('prosper_tx',  'Town of Prosper',  'Prosper',  'TX')
    ON CONFLICT (tenant_id) DO NOTHING
  `)
  console.log('Seeded civic_admin.tenants')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS civic_admin.users (
      id          SERIAL PRIMARY KEY,
      username    VARCHAR(100) UNIQUE NOT NULL,
      tenant_id   VARCHAR(50),
      role        VARCHAR(20) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    INSERT INTO civic_admin.users (username, tenant_id, role) VALUES
      ('superadmin',           NULL,          'super_admin'),
      ('McKinneyCityManager',  'mckinney_tx', 'tenant_admin'),
      ('ProsperCityManager',   'prosper_tx',  'tenant_admin'),
      ('MckinneyReadOnly',     'mckinney_tx', 'tenant_readonly'),
      ('ProsperReadOnly',      'prosper_tx',  'tenant_readonly')
    ON CONFLICT (username) DO NOTHING
  `)
  console.log('Seeded civic_admin.users')

  // Tenant schemas
  for (const tid of ['mckinney_tx', 'prosper_tx']) {
    const s = `tenant_${tid}`
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
        accessed_at TIMESTAMPTZ DEFAULT NOW(),
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
    console.log(`Created schema + tables: ${s}`)
  }

  // Seed McKinney land use cases
  await pool.query(`
    INSERT INTO tenant_mckinney_tx.land_use_cases
      (case_number, applicant, address, case_type, status, submitted_date, parcel_id, acreage, description)
    VALUES
      ('LU-2025-0001','Westridge Developers LLC','1400 N Tennessee St','Rezoning','Approved','2025-01-10','R-1204-0',12.50,'Rezone from SF-12 to PD for mixed-use development'),
      ('LU-2025-0002','McKinney ISD','4100 Alma Rd','Site Plan','Under Review','2025-02-03','R-2201-5',8.75,'New elementary school site plan review'),
      ('LU-2025-0003','Horizon Commercial Group','201 S Central Expy','Variance','Pending Hearing','2025-03-15','C-0342-1',2.10,'Variance for reduced parking setback in C-1 zone')
    ON CONFLICT (case_number) DO NOTHING
  `)
  console.log('Seeded tenant_mckinney_tx.land_use_cases')

  // Seed Prosper land use cases
  await pool.query(`
    INSERT INTO tenant_prosper_tx.land_use_cases
      (case_number, applicant, address, case_type, status, submitted_date, parcel_id, acreage, description)
    VALUES
      ('LU-2025-0001','Prosper Land Co.','380 N Preston Rd','Plat','Approved','2025-01-22','P-0010-3',45.00,'Final plat for Prairie Lakes Phase 4 residential subdivision'),
      ('LU-2025-0002','Gates Commercial','1801 N Dallas Pkwy','Special Use','Under Review','2025-02-18','C-0021-8',3.20,'Special use permit for drive-through restaurant in PD district')
    ON CONFLICT (case_number) DO NOTHING
  `)
  console.log('Seeded tenant_prosper_tx.land_use_cases')

  console.log('\nMigration complete.')
  await pool.end()
}

run().catch(e => { console.error(e); process.exit(1) })
