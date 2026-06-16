import os
import re

# ── 根据环境自动选择 SQLite（本地）或 PostgreSQL（Railway）──
DATABASE_URL = os.environ.get('DATABASE_URL', '')

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras
    USE_PG = True
    # Railway 新版 URL 是 postgresql://，psycopg2 需要 postgresql://
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
else:
    import sqlite3
    USE_PG = False
    _BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(_BASE_DIR, 'kol.db')


def get_db():
    if USE_PG:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


def query(conn, sql, params=()):
    """统一查询接口，屏蔽 ? vs %s 差异，返回 list of dict"""
    if USE_PG:
        sql = sql.replace('?', '%s')
        # 去掉 SQLite 特有的 -- 注释行（PG 也支持，但 CREATE TABLE 里的内联注释可能有问题）
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            try:
                return [dict(r) for r in cur.fetchall()]
            except psycopg2.ProgrammingError:
                return []
    else:
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def execute(conn, sql, params=()):
    """统一写入接口"""
    if USE_PG:
        sql = sql.replace('?', '%s')
        with conn.cursor() as cur:
            cur.execute(sql, params)
    else:
        conn.execute(sql, params)


def executemany(conn, sql, params_list):
    if USE_PG:
        sql = sql.replace('?', '%s')
        with conn.cursor() as cur:
            cur.executemany(sql, params_list)
    else:
        conn.executemany(sql, params_list)


def lastrowid(conn, sql, params=()):
    """INSERT 并返回新行 id"""
    if USE_PG:
        sql = sql.replace('?', '%s')
        sql = sql.rstrip().rstrip(';') + ' RETURNING id'
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()[0]
    else:
        cur = conn.execute(sql, params)
        return cur.lastrowid


# ── 建表 SQL（用标准 SQL，PG 和 SQLite 都兼容）─────────────
_TABLES = [
    '''CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
    )''',
    '''CREATE TABLE IF NOT EXISTS brands (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        target_audience TEXT,
        description TEXT,
        marketing_direction TEXT,
        keywords    TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        brand_id    INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        description TEXT,
        keywords    TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS categories (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
    )''',
    '''CREATE TABLE IF NOT EXISTS project_stages (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        color      TEXT DEFAULT '#6B7280'
    )''',
    '''CREATE TABLE IF NOT EXISTS statuses (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        color      TEXT DEFAULT '#6B7280'
    )''',
    '''CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        brand_id    INTEGER REFERENCES brands(id),
        product_id  INTEGER REFERENCES products(id),
        platform    TEXT DEFAULT 'YouTube',
        owner       TEXT,
        start_date  TEXT,
        end_date    TEXT,
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS creators (
        channel_id      TEXT PRIMARY KEY,
        nickname        TEXT,
        channel_url     TEXT,
        country         TEXT,
        language        TEXT,
        email           TEXT,
        contact_info    TEXT,
        address         TEXT,
        notes           TEXT,
        subscriber_count INTEGER DEFAULT 0,
        avg_views       INTEGER DEFAULT 0,
        update_7d       INTEGER DEFAULT 0,
        update_30d      INTEGER DEFAULT 0,
        update_90d      INTEGER DEFAULT 0,
        ai_score        INTEGER DEFAULT 0,
        ai_reason       TEXT,
        status_id       INTEGER REFERENCES statuses(id),
        is_archived     INTEGER DEFAULT 0,
        archive_reason  TEXT,
        archive_note    TEXT,
        freeze_until    TEXT,
        thumbnail_url   TEXT,
        raw_data        TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS creator_categories (
        creator_id  TEXT REFERENCES creators(channel_id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (creator_id, category_id)
    )''',
    '''CREATE TABLE IF NOT EXISTS creator_projects (
        id              SERIAL PRIMARY KEY,
        creator_id      TEXT NOT NULL REFERENCES creators(channel_id) ON DELETE CASCADE,
        project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        stage_id        INTEGER REFERENCES project_stages(id),
        snap_subscribers INTEGER,
        snap_avg_views   INTEGER,
        email           TEXT,
        phone           TEXT,
        address         TEXT,
        amount          REAL DEFAULT 0,
        amount_currency TEXT DEFAULT 'USD',
        paid_amount     REAL DEFAULT 0,
        paid_currency   TEXT DEFAULT 'USD',
        payment_status  TEXT DEFAULT 'Unpaid',
        contacted_date  TEXT,
        replied_date    TEXT,
        sample_date     TEXT,
        draft_date      TEXT,
        publish_date    TEXT,
        payment_date    TEXT,
        notes           TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS interaction_logs (
        id          SERIAL PRIMARY KEY,
        creator_id  TEXT NOT NULL REFERENCES creators(channel_id) ON DELETE CASCADE,
        project_id  INTEGER REFERENCES projects(id),
        action_type TEXT,
        content     TEXT,
        operator    TEXT DEFAULT 'Admin',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
    '''CREATE TABLE IF NOT EXISTS reminders (
        id          SERIAL PRIMARY KEY,
        creator_id  TEXT NOT NULL REFERENCES creators(channel_id) ON DELETE CASCADE,
        project_id  INTEGER REFERENCES projects(id),
        remind_date TEXT NOT NULL,
        content     TEXT,
        is_done     INTEGER DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''',
]

# SQLite 用 AUTOINCREMENT 语法，PG 用 SERIAL
_SQLITE_TABLES = [t.replace('SERIAL', 'INTEGER') for t in _TABLES]


def _insert_or_ignore(conn, table, columns, values_list):
    """跨数据库的 INSERT OR IGNORE"""
    cols = ', '.join(columns)
    placeholders = ', '.join(['?'] * len(columns))
    if USE_PG:
        placeholders = ', '.join(['%s'] * len(columns))
        sql = f'INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        with conn.cursor() as cur:
            for vals in values_list:
                cur.execute(sql, vals)
    else:
        sql = f'INSERT OR IGNORE INTO {table} ({cols}) VALUES ({placeholders})'
        conn.executemany(sql, values_list)


def init_db():
    conn = get_db()
    tables = _TABLES if USE_PG else _SQLITE_TABLES

    if USE_PG:
        with conn.cursor() as cur:
            for ddl in tables:
                cur.execute(ddl)
    else:
        for ddl in tables:
            conn.execute(ddl)

    # 默认数据
    stages = [
        ('New', 0, '#6B7280'), ('Contacted', 1, '#3B82F6'),
        ('Negotiating', 2, '#F59E0B'), ('Deal Confirmed', 3, '#8B5CF6'),
        ('Product Sent', 4, '#06B6D4'), ('Draft Pending', 5, '#F97316'),
        ('Draft Submitted', 6, '#EAB308'), ('Draft Revision', 7, '#EF4444'),
        ('Ready To Post', 8, '#10B981'), ('Posted', 9, '#059669'),
        ('Payment Pending', 10, '#F59E0B'), ('Completed', 11, '#16A34A'),
        ('Cancelled', 12, '#DC2626'),
    ]
    _insert_or_ignore(conn, 'project_stages', ['name', 'sort_order', 'color'], stages)

    statuses = [
        ('待开发', 0, '#6B7280'), ('已联系', 1, '#3B82F6'),
        ('洽谈中', 2, '#F59E0B'), ('已合作', 3, '#10B981'),
        ('不合作', 4, '#EF4444'),
    ]
    _insert_or_ignore(conn, 'statuses', ['name', 'sort_order', 'color'], statuses)

    cats = ['Mom', 'Family', 'Home', 'Cleaning', 'Lifestyle',
            'Pet', 'Cooking', 'DIY', 'Beauty', 'Tech']
    _insert_or_ignore(conn, 'categories', ['name', 'sort_order'],
                      [(c, i) for i, c in enumerate(cats)])

    default_brands = [
        ('KNKA', 'Families with kids and pets', 'Air purifier and home air quality products',
         'Family health, clean air lifestyle', 'Air Quality,Family,Kids,Pet,Home'),
        ('MULISOFT', 'Homeowners in humid regions', 'Dehumidifier and moisture control products',
         'Humidity control, mold prevention', 'Humidity,Basement,Mold,Allergy,Moisture'),
        ('7MAGIC', 'Beauty enthusiasts', 'Hair styling and beauty tools',
         'Beauty, hair styling, fashion', 'Beauty,Hair,Fashion,Styling,Glamour'),
    ]
    _insert_or_ignore(conn, 'brands',
                      ['name', 'target_audience', 'description', 'marketing_direction', 'keywords'],
                      default_brands)

    conn.commit()
    conn.close()
    print("✅ Database initialized")


if __name__ == '__main__':
    init_db()
