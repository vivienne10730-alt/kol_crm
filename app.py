import json
import re
import threading
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, Response
import csv, io

from database import get_db, init_db, query, execute, executemany, lastrowid, USE_PG
from utils.youtube import (
    get_yt_key, enrich_channel, search_channels_by_keyword,
    get_related_channels_from_video, get_related_channels_from_channel,
    extract_channel_id
)
from utils.ai_score import score_creator, batch_score_creators

app = Flask(__name__)
app.secret_key = 'kol-crm-secret-2024'

# ══════════════════════════════════════════════════════════════
# 首页 / 看板
# ══════════════════════════════════════════════════════════════
@app.route('/')
def index():
    db = get_db()
    today = date.today().isoformat()

    # 今日待跟进
    reminders_today = query(db, '''
        SELECT r.*, c.nickname, c.channel_id
        FROM reminders r JOIN creators c ON r.creator_id=c.channel_id
        WHERE r.remind_date <= ? AND r.is_done=0
        ORDER BY r.remind_date
    ''', (today,))

    # 本周将发布
    from datetime import timedelta
    week_end = (date.today() + timedelta(days=7)).isoformat()
    publishing_soon = query(db, '''
        SELECT cp.*, c.nickname, c.thumbnail_url, p.name as project_name,
               b.name as brand_name
        FROM creator_projects cp
        JOIN creators c ON cp.creator_id=c.channel_id
        JOIN projects p ON cp.project_id=p.id
        JOIN brands b ON p.brand_id=b.id
        WHERE cp.publish_date BETWEEN ? AND ? AND cp.publish_date IS NOT NULL
        ORDER BY cp.publish_date
    ''', (today, week_end))

    # 总体统计
    stats_rows = query(db, '''
        SELECT
            COUNT(DISTINCT c.channel_id) as total_creators,
            COUNT(DISTINCT cp.id) as total_collabs,
            SUM(CASE WHEN ps.name='Posted' OR ps.name='Completed' THEN 1 ELSE 0 END) as posted,
            SUM(CASE WHEN ps.name NOT IN ('Posted','Completed','Cancelled') THEN 1 ELSE 0 END) as pending,
            SUM(cp.amount) as total_spend,
            SUM(cp.paid_amount) as total_paid
        FROM creators c
        LEFT JOIN creator_projects cp ON c.channel_id=cp.creator_id
        LEFT JOIN project_stages ps ON cp.stage_id=ps.id
        WHERE c.is_archived=0
    ''')
    stats = stats_rows[0] if stats_rows else {}

    db.close()
    return render_template('index.html',
        reminders=reminders_today,
        publishing_soon=publishing_soon,
        stats=stats)

# ══════════════════════════════════════════════════════════════
# 设置
# ══════════════════════════════════════════════════════════════
@app.route('/settings', methods=['GET', 'POST'])
def settings():
    db = get_db()
    if request.method == 'POST':
        data = request.form
        keys = ['yt_api_key', 'ai_provider', 'ai_base_url', 'ai_api_key', 'ai_model']
        for k in keys:
            v = data.get(k, '').strip()
            execute(db, 'INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', (k, v))
        db.commit()
        flash('设置已保存', 'success')
        return redirect(url_for('settings'))

    rows = query(db, 'SELECT key, value FROM settings')
    cfg = {r['key']: r['value'] for r in rows}
    db.close()
    return render_template('settings.html', cfg=cfg)

# ══════════════════════════════════════════════════════════════
# 品牌库
# ══════════════════════════════════════════════════════════════
@app.route('/brands')
def brands():
    db = get_db()
    brands = [dict(r) for r in query(db, 'SELECT * FROM brands ORDER BY id')]
    db.close()
    return render_template('brands.html', brands=brands)

@app.route('/brands/save', methods=['POST'])
def brand_save():
    db = get_db()
    d = request.form
    bid = d.get('id')
    if bid:
        query(db, '''UPDATE brands SET name=?,target_audience=?,description=?,
            marketing_direction=?,keywords=? WHERE id=?''',
            (d['name'], d.get('target_audience'), d.get('description'),
             d.get('marketing_direction'), d.get('keywords'), bid))
    else:
        execute(db, '''INSERT INTO brands (name,target_audience,description,marketing_direction,keywords)
            VALUES (?,?,?,?,?)''',
            (d['name'], d.get('target_audience'), d.get('description'),
             d.get('marketing_direction'), d.get('keywords')))
    db.commit()
    db.close()
    return redirect(url_for('brands'))

@app.route('/brands/delete/<int:bid>', methods=['POST'])
def brand_delete(bid):
    db = get_db()
    execute(db, 'DELETE FROM brands WHERE id=?', (bid,))
    db.commit()
    db.close()
    return redirect(url_for('brands'))

# ══════════════════════════════════════════════════════════════
# 产品库
# ══════════════════════════════════════════════════════════════
@app.route('/products')
def products():
    db = get_db()
    products = [dict(r) for r in query(db, '''
        SELECT p.*, b.name as brand_name FROM products p
        JOIN brands b ON p.brand_id=b.id ORDER BY b.name, p.name
    ''')]
    brands = [dict(r) for r in query(db, 'SELECT * FROM brands ORDER BY name')]
    db.close()
    return render_template('products.html', products=products, brands=brands)

@app.route('/products/save', methods=['POST'])
def product_save():
    db = get_db()
    d = request.form
    pid = d.get('id')
    if pid:
        query(db, '''UPDATE products SET brand_id=?,name=?,description=?,keywords=?
            WHERE id=?''', (d['brand_id'], d['name'], d.get('description'), d.get('keywords'), pid))
    else:
        execute(db, '''INSERT INTO products (brand_id,name,description,keywords)
            VALUES (?,?,?,?)''', (d['brand_id'], d['name'], d.get('description'), d.get('keywords')))
    db.commit()
    db.close()
    return redirect(url_for('products'))

@app.route('/products/delete/<int:pid>', methods=['POST'])
def product_delete(pid):
    db = get_db()
    execute(db, 'DELETE FROM products WHERE id=?', (pid,))
    db.commit()
    db.close()
    return redirect(url_for('products'))

# ══════════════════════════════════════════════════════════════
# 项目管理
# ══════════════════════════════════════════════════════════════
@app.route('/projects')
def projects():
    db = get_db()
    projects = [dict(r) for r in query(db, '''
        SELECT pj.*, b.name as brand_name, pr.name as product_name
        FROM projects pj
        LEFT JOIN brands b ON pj.brand_id=b.id
        LEFT JOIN products pr ON pj.product_id=pr.id
        ORDER BY pj.created_at DESC
    ''')]
    brands = [dict(r) for r in query(db, 'SELECT * FROM brands')]
    products = [dict(r) for r in query(db, 'SELECT p.*, b.name as brand_name FROM products p JOIN brands b ON p.brand_id=b.id')]
    db.close()
    return render_template('projects.html', projects=projects, brands=brands, products=products)

@app.route('/projects/save', methods=['POST'])
def project_save():
    db = get_db()
    d = request.form
    pid = d.get('id')
    fields = (d['name'], d.get('brand_id') or None, d.get('product_id') or None,
              d.get('platform', 'YouTube'), d.get('owner'), d.get('start_date'),
              d.get('end_date'), d.get('notes'))
    if pid:
        query(db, '''UPDATE projects SET name=?,brand_id=?,product_id=?,platform=?,
            owner=?,start_date=?,end_date=?,notes=? WHERE id=?''', fields + (pid,))
    else:
        execute(db, '''INSERT INTO projects (name,brand_id,product_id,platform,owner,start_date,end_date,notes)
            VALUES (?,?,?,?,?,?,?,?)''', fields)
    db.commit()
    db.close()
    return redirect(url_for('projects'))

@app.route('/projects/delete/<int:pid>', methods=['POST'])
def project_delete(pid):
    db = get_db()
    execute(db, 'DELETE FROM projects WHERE id=?', (pid,))
    db.commit()
    db.close()
    return redirect(url_for('projects'))

# ══════════════════════════════════════════════════════════════
# 达人发现
# ══════════════════════════════════════════════════════════════
@app.route('/discover')
def discover():
    db = get_db()
    brands = query(db, 'SELECT * FROM brands ORDER BY name')
    products = query(db, 'SELECT p.*, b.name as brand_name FROM products p JOIN brands b ON p.brand_id=b.id')
    projects = query(db, '''SELECT pj.*, b.name as brand_name FROM projects pj
        LEFT JOIN brands b ON pj.brand_id=b.id ORDER BY pj.created_at DESC''')
    db.close()
    return render_template('discover.html', brands=brands, products=products, projects=projects)

@app.route('/api/search', methods=['POST'])
def api_search():
    """达人搜索 API（异步，前端 fetch 调用）"""
    data = request.json
    mode = data.get('mode', 'keyword')
    api_key = get_yt_key()
    if not api_key:
        return jsonify({'error': 'YouTube API Key 未配置'}), 400

    channel_ids = []
    try:
        if mode == 'keyword':
            keywords = [k.strip() for k in data.get('keywords', '').split('\n') if k.strip()]
            for kw in keywords[:5]:
                ids = search_channels_by_keyword(kw, api_key, max_results=10)
                channel_ids.extend(ids)
        elif mode == 'video':
            url = data.get('url', '')
            channel_ids = get_related_channels_from_video(url, api_key)
        elif mode == 'channel':
            url = data.get('url', '')
            channel_ids = get_related_channels_from_channel(url, api_key)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # 去重
    seen = set()
    unique_ids = [x for x in channel_ids if not (x in seen or seen.add(x))]

    # 查重：检查数据库现有状态
    db = get_db()
    existing = {}
    for cid in unique_ids:
        _rows = query(db, '''SELECT c.channel_id, c.nickname, c.is_archived,
            c.archive_reason, s.name as status_name
            FROM creators c LEFT JOIN statuses s ON c.status_id=s.id
            WHERE c.channel_id=?''', (cid,))
        row = _rows[0] if _rows else None
        if row:
            existing[cid] = dict(row)
    db.close()

    # 拉新达人数据
    results = []
    for cid in unique_ids[:30]:
        if cid in existing:
            ex = existing[cid]
            results.append({
                'channel_id': cid,
                'exists': True,
                'is_archived': ex['is_archived'],
                'archive_reason': ex['archive_reason'],
                'status': ex['status_name'],
                'nickname': ex['nickname'],
            })
        else:
            try:
                detail = enrich_channel(cid, api_key)
                if detail:
                    detail['exists'] = False
                    results.append(detail)
            except:
                pass

    return jsonify({'results': results, 'total': len(results)})

@app.route('/api/creator/detail/<channel_id>')
def api_creator_detail(channel_id):
    """拉单个频道详情"""
    api_key = get_yt_key()
    if not api_key:
        return jsonify({'error': 'No API key'}), 400
    detail = enrich_channel(channel_id, api_key)
    return jsonify(detail or {})

# ══════════════════════════════════════════════════════════════
# 达人库
# ══════════════════════════════════════════════════════════════
@app.route('/creators')
def creators():
    db = get_db()
    # 筛选参数
    q = request.args.get('q', '')
    country = request.args.get('country', '')
    status_id = request.args.get('status_id', '')
    min_subs = request.args.get('min_subs', '')
    max_subs = request.args.get('max_subs', '')
    min_views = request.args.get('min_views', '')
    has_email = request.args.get('has_email', '')
    min_score = request.args.get('min_score', '')
    show_archived = request.args.get('archived', '0')

    sql = '''SELECT c.*, s.name as status_name, s.color as status_color
             FROM creators c LEFT JOIN statuses s ON c.status_id=s.id
             WHERE c.is_archived=?'''
    params = [1 if show_archived == '1' else 0]

    if q:
        sql += ' AND (c.nickname LIKE ? OR c.email LIKE ? OR c.channel_id LIKE ?)'
        params += [f'%{q}%', f'%{q}%', f'%{q}%']
    if country:
        sql += ' AND c.country=?'; params.append(country)
    if status_id:
        sql += ' AND c.status_id=?'; params.append(status_id)
    if min_subs:
        sql += ' AND c.subscriber_count>=?'; params.append(int(min_subs))
    if max_subs:
        sql += ' AND c.subscriber_count<=?'; params.append(int(max_subs))
    if min_views:
        sql += ' AND c.avg_views>=?'; params.append(int(min_views))
    if has_email == '1':
        sql += ' AND c.email IS NOT NULL AND c.email!=""'
    if min_score:
        sql += ' AND c.ai_score>=?'; params.append(int(min_score))

    sql += ' ORDER BY c.ai_score DESC, c.subscriber_count DESC'
    creators_list = query(db, sql, params)

    # 筛选后统计
    stats = _compute_filtered_stats(db, [c['channel_id'] for c in creators_list])

    statuses = query(db, 'SELECT * FROM statuses ORDER BY sort_order')
    countries = query(db, 'SELECT DISTINCT country FROM creators WHERE country!="" ORDER BY country')
    projects = query(db, '''SELECT pj.*, b.name as brand_name FROM projects pj
        LEFT JOIN brands b ON pj.brand_id=b.id ORDER BY pj.created_at DESC''')
    categories = query(db, 'SELECT * FROM categories ORDER BY sort_order')
    db.close()

    return render_template('creators.html',
        creators=creators_list, stats=stats, statuses=statuses,
        countries=countries, projects=projects, categories=categories,
        filters=request.args, show_archived=show_archived)

def _compute_filtered_stats(db, channel_ids):
    if not channel_ids:
        return {'total_spend': 0, 'posted': 0, 'pending': 0, 'total_paid': 0}
    placeholders = ','.join('?' * len(channel_ids))
    rows = query(db, f'''
        SELECT
            SUM(cp.amount) as total_spend,
            SUM(cp.paid_amount) as total_paid,
            SUM(CASE WHEN ps.name IN ('Posted','Completed') THEN 1 ELSE 0 END) as posted,
            SUM(CASE WHEN ps.name NOT IN ('Posted','Completed','Cancelled') THEN 1 ELSE 0 END) as pending
        FROM creator_projects cp
        JOIN project_stages ps ON cp.stage_id=ps.id
        WHERE cp.creator_id IN ({placeholders})
    ''', channel_ids)
    return rows[0] if rows else {}

@app.route('/api/creators/import', methods=['POST'])
def import_creators():
    """批量加入达人库"""
    data = request.json
    creators_data = data.get('creators', [])
    db = get_db()
    added = 0
    for c in creators_data:
        cid = c.get('channel_id')
        if not cid:
            continue
        existing = (query(db, 'SELECT channel_id FROM creators WHERE channel_id=?', (cid,)) + [None])[0]
        if not existing:
            execute(db, '''INSERT OR IGNORE INTO creators
                (channel_id,nickname,channel_url,country,thumbnail_url,
                 subscriber_count,avg_views,update_7d,update_30d,update_90d,email)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                (cid, c.get('nickname'), c.get('channel_url'), c.get('country'),
                 c.get('thumbnail_url'), c.get('subscriber_count', 0),
                 c.get('avg_views', 0), c.get('update_7d', 0),
                 c.get('update_30d', 0), c.get('update_90d', 0), c.get('email')))
            added += 1
    db.commit()
    db.close()
    return jsonify({'added': added})

@app.route('/api/creators/add_to_project', methods=['POST'])
def add_to_project():
    data = request.json
    channel_ids = data.get('channel_ids', [])
    project_id = data.get('project_id')
    db = get_db()

    # 拿第一个阶段
    first_stage = (query(db, 'SELECT id FROM project_stages ORDER BY sort_order LIMIT 1') + [None])[0]
    stage_id = first_stage['id'] if first_stage else None

    added = 0
    for cid in channel_ids:
        existing = (query(db, 
            'SELECT id FROM creator_projects WHERE creator_id=? AND project_id=?',
            (cid, project_id)) + [None])[0]
        if not existing:
            execute(db, '''INSERT INTO creator_projects (creator_id, project_id, stage_id)
                VALUES (?,?,?)''', (cid, project_id, stage_id))
            added += 1
    db.commit()
    db.close()
    return jsonify({'added': added})

@app.route('/creator/<channel_id>')
def creator_detail(channel_id):
    db = get_db()
    creator = (query(db, '''SELECT c.*, s.name as status_name
        FROM creators c LEFT JOIN statuses s ON c.status_id=s.id
        WHERE c.channel_id=?''', (channel_id,)) + [None])[0]
    if not creator:
        flash('达人不存在', 'error')
        return redirect(url_for('creators'))

    collabs = query(db, '''
        SELECT cp.*, p.name as project_name, b.name as brand_name,
               pr.name as product_name, ps.name as stage_name, ps.color as stage_color
        FROM creator_projects cp
        JOIN projects p ON cp.project_id=p.id
        JOIN brands b ON p.brand_id=b.id
        LEFT JOIN products pr ON p.product_id=pr.id
        LEFT JOIN project_stages ps ON cp.stage_id=ps.id
        WHERE cp.creator_id=?
        ORDER BY cp.created_at DESC
    ''', (channel_id,))

    logs = [dict(r) for r in query(db, '''
        SELECT il.*, p.name as project_name FROM interaction_logs il
        LEFT JOIN projects p ON il.project_id=p.id
        WHERE il.creator_id=? ORDER BY il.created_at DESC
    ''', (channel_id,))]

    reminders = [dict(r) for r in query(db, '''
        SELECT r.*, p.name as project_name FROM reminders r
        LEFT JOIN projects p ON r.project_id=p.id
        WHERE r.creator_id=? AND r.is_done=0 ORDER BY r.remind_date
    ''', (channel_id,))]

    categories = query(db, 'SELECT * FROM categories ORDER BY sort_order')
    creator_cats = query(db, 
        'SELECT category_id FROM creator_categories WHERE creator_id=?', (channel_id,))
    cat_ids = {r['category_id'] for r in creator_cats}

    statuses = query(db, 'SELECT * FROM statuses ORDER BY sort_order')
    projects = query(db, '''SELECT pj.*, b.name as brand_name FROM projects pj
        LEFT JOIN brands b ON pj.brand_id=b.id''')
    stages = query(db, 'SELECT * FROM project_stages ORDER BY sort_order')

    # 解析 AI 原因
    ai_data = {}
    if creator['ai_reason']:
        try:
            ai_data = json.loads(creator['ai_reason'])
        except:
            pass

    db.close()
    return render_template('creator_detail.html',
        creator=creator, collabs=collabs, logs=logs, reminders=reminders,
        categories=categories, cat_ids=cat_ids, statuses=statuses,
        projects=projects, stages=stages, ai_data=ai_data)

@app.route('/creator/<channel_id>/update', methods=['POST'])
def creator_update(channel_id):
    db = get_db()
    d = request.form
    query(db, '''UPDATE creators SET nickname=?,country=?,language=?,email=?,
        contact_info=?,address=?,notes=?,status_id=?,updated_at=CURRENT_TIMESTAMP
        WHERE channel_id=?''',
        (d.get('nickname'), d.get('country'), d.get('language'), d.get('email'),
         d.get('contact_info'), d.get('address'), d.get('notes'),
         d.get('status_id') or None, channel_id))

    # 更新类目
    execute(db, 'DELETE FROM creator_categories WHERE creator_id=?', (channel_id,))
    for cat_id in request.form.getlist('categories'):
        execute(db, 'INSERT OR IGNORE INTO creator_categories (creator_id,category_id) VALUES (?,?)',
                   (channel_id, cat_id))
    db.commit()
    db.close()
    flash('达人信息已更新', 'success')
    return redirect(url_for('creator_detail', channel_id=channel_id))

@app.route('/creator/<channel_id>/archive', methods=['POST'])
def creator_archive(channel_id):
    db = get_db()
    reason = request.form.get('reason', 'Not Suitable')
    note = request.form.get('note', '')
    execute(db, '''UPDATE creators SET is_archived=1, archive_reason=?, archive_note=?
        WHERE channel_id=?''', (reason, note, channel_id))
    db.commit()
    db.close()
    flash(f'已归档：{reason}', 'info')
    return redirect(url_for('creators'))

# ══════════════════════════════════════════════════════════════
# 合作记录
# ══════════════════════════════════════════════════════════════
@app.route('/collab/save', methods=['POST'])
def collab_save():
    db = get_db()
    d = request.form
    cp_id = d.get('id')
    fields = (
        d.get('stage_id') or None, d.get('email'), d.get('phone'), d.get('address'),
        d.get('amount', 0) or 0, d.get('amount_currency', 'USD'),
        d.get('paid_amount', 0) or 0, d.get('paid_currency', 'USD'),
        d.get('payment_status', 'Unpaid'),
        d.get('contacted_date'), d.get('replied_date'), d.get('sample_date'),
        d.get('draft_date'), d.get('publish_date'), d.get('payment_date'), d.get('notes')
    )
    if cp_id:
        execute(db, '''UPDATE creator_projects SET
            stage_id=?,email=?,phone=?,address=?,
            amount=?,amount_currency=?,paid_amount=?,paid_currency=?,payment_status=?,
            contacted_date=?,replied_date=?,sample_date=?,draft_date=?,
            publish_date=?,payment_date=?,notes=?,updated_at=CURRENT_TIMESTAMP
            WHERE id=?''', fields + (cp_id,))
    else:
        execute(db, '''INSERT INTO creator_projects
            (stage_id,email,phone,address,amount,amount_currency,paid_amount,paid_currency,
             payment_status,contacted_date,replied_date,sample_date,draft_date,
             publish_date,payment_date,notes,creator_id,project_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            fields + (d['creator_id'], d['project_id']))
    db.commit()
    db.close()
    return redirect(url_for('creator_detail', channel_id=d['creator_id']))

# ══════════════════════════════════════════════════════════════
# 提醒
# ══════════════════════════════════════════════════════════════
@app.route('/reminder/save', methods=['POST'])
def reminder_save():
    db = get_db()
    d = request.form
    execute(db, '''INSERT INTO reminders (creator_id,project_id,remind_date,content)
        VALUES (?,?,?,?)''',
        (d['creator_id'], d.get('project_id') or None, d['remind_date'], d.get('content')))
    db.commit()
    db.close()
    return redirect(url_for('creator_detail', channel_id=d['creator_id']))

@app.route('/reminder/<int:rid>/done', methods=['POST'])
def reminder_done(rid):
    db = get_db()
    execute(db, 'UPDATE reminders SET is_done=1 WHERE id=?', (rid,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ══════════════════════════════════════════════════════════════
# Interaction Log
# ══════════════════════════════════════════════════════════════
@app.route('/log/save', methods=['POST'])
def log_save():
    db = get_db()
    d = request.form
    execute(db, '''INSERT INTO interaction_logs (creator_id,project_id,action_type,content)
        VALUES (?,?,?,?)''',
        (d['creator_id'], d.get('project_id') or None,
         d.get('action_type', 'Note'), d.get('content')))
    db.commit()
    db.close()
    return redirect(url_for('creator_detail', channel_id=d['creator_id']))

# ══════════════════════════════════════════════════════════════
# AI 评分接口
# ══════════════════════════════════════════════════════════════
@app.route('/api/score/<channel_id>', methods=['POST'])
def api_score(channel_id):
    db = get_db()
    creator = (query(db, 'SELECT * FROM creators WHERE channel_id=?', (channel_id,)) + [None])[0]
    db.close()
    if not creator:
        return jsonify({'error': '达人不存在'}), 404
    data = request.json or {}
    result = score_creator(dict(creator), data.get('brand_id'), data.get('product_id'))
    # 写回
    db = get_db()
    reason_text = json.dumps({'brand': result['brand'], 'reasons': result['reasons'],
                              'concerns': result['concerns']}, ensure_ascii=False)
    execute(db, 'UPDATE creators SET ai_score=?,ai_reason=? WHERE channel_id=?',
               (result['score'], reason_text, channel_id))
    db.commit()
    db.close()
    return jsonify(result)

@app.route('/api/score/batch', methods=['POST'])
def api_score_batch():
    data = request.json
    channel_ids = data.get('channel_ids', [])
    brand_id = data.get('brand_id')
    product_id = data.get('product_id')

    def run():
        batch_score_creators(channel_ids, brand_id, product_id)

    t = threading.Thread(target=run)
    t.daemon = True
    t.start()
    return jsonify({'status': 'started', 'count': len(channel_ids)})

# ══════════════════════════════════════════════════════════════
# 数据统计
# ══════════════════════════════════════════════════════════════
@app.route('/api/stats')
def api_stats():
    db = get_db()
    brand_id = request.args.get('brand_id')
    project_id = request.args.get('project_id')

    sql = '''
        SELECT
            COUNT(DISTINCT cp.creator_id) as creator_count,
            COUNT(cp.id) as collab_count,
            SUM(cp.amount) as total_spend,
            SUM(cp.paid_amount) as total_paid,
            SUM(cp.amount - cp.paid_amount) as unpaid,
            SUM(CASE WHEN ps.name IN ('Posted','Completed') THEN 1 ELSE 0 END) as posted,
            SUM(CASE WHEN ps.name NOT IN ('Posted','Completed','Cancelled') AND ps.name IS NOT NULL THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN ps.name='Cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM creator_projects cp
        JOIN projects p ON cp.project_id=p.id
        LEFT JOIN project_stages ps ON cp.stage_id=ps.id
        WHERE 1=1
    '''
    params = []
    if brand_id:
        sql += ' AND p.brand_id=?'; params.append(brand_id)
    if project_id:
        sql += ' AND cp.project_id=?'; params.append(project_id)

    row = (query(db, sql, params) + [None])[0]

    # 按币种分组
    currency_sql = '''
        SELECT amount_currency, SUM(amount) as total
        FROM creator_projects cp JOIN projects p ON cp.project_id=p.id
        WHERE 1=1
    '''
    c_params = []
    if brand_id:
        currency_sql += ' AND p.brand_id=?'; c_params.append(brand_id)
    if project_id:
        currency_sql += ' AND cp.project_id=?'; c_params.append(project_id)
    currency_sql += ' GROUP BY amount_currency'
    by_currency = query(db, currency_sql, c_params)

    db.close()
    return jsonify({
        **dict(row),
        'by_currency': [dict(r) for r in by_currency]
    })

# ══════════════════════════════════════════════════════════════
# API: 配置类表管理
# ══════════════════════════════════════════════════════════════
@app.route('/api/stages', methods=['GET', 'POST'])
def api_stages():
    db = get_db()
    if request.method == 'POST':
        d = request.json
        if d.get('id'):
            query(db, 'UPDATE project_stages SET name=?,color=? WHERE id=?',
                       (d['name'], d.get('color', '#6B7280'), d['id']))
        else:
            execute(db, 'INSERT INTO project_stages (name,color,sort_order) VALUES (?,?,?)',
                       (d['name'], d.get('color', '#6B7280'),
                        (query(db, 'SELECT COUNT(*) FROM project_stages') + [{}])[0].get('count(*)', query(db, 'SELECT COUNT(*) FROM project_stages')[0].get('count', 0))))
        db.commit()
        db.close()
        return jsonify({'ok': True})
    stages = query(db, 'SELECT * FROM project_stages ORDER BY sort_order')
    db.close()
    return jsonify(stages)

@app.route('/api/stages/<int:sid>', methods=['DELETE'])
def api_stage_delete(sid):
    db = get_db()
    query(db, 'DELETE FROM project_stages WHERE id=?', (sid,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/api/statuses', methods=['GET', 'POST'])
def api_statuses():
    db = get_db()
    if request.method == 'POST':
        d = request.json
        if d.get('id'):
            execute(db, 'UPDATE statuses SET name=?,color=? WHERE id=?',
                       (d['name'], d.get('color', '#6B7280'), d['id']))
        else:
            execute(db, 'INSERT INTO statuses (name,color,sort_order) VALUES (?,?,?)',
                       (d['name'], d.get('color', '#6B7280'),
                        (query(db, 'SELECT COUNT(*) FROM statuses') + [{}])[0].get('count(*)', query(db, 'SELECT COUNT(*) FROM statuses')[0].get('count', 0))))
        db.commit()
        db.close()
        return jsonify({'ok': True})
    rows = query(db, 'SELECT * FROM statuses ORDER BY sort_order')
    db.close()
    return jsonify(rows)

@app.route('/api/statuses/<int:sid>', methods=['DELETE'])
def api_status_delete(sid):
    db = get_db()
    query(db, 'DELETE FROM statuses WHERE id=?', (sid,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/api/categories', methods=['GET', 'POST'])
def api_categories():
    db = get_db()
    if request.method == 'POST':
        d = request.json
        execute(db, 'INSERT OR IGNORE INTO categories (name,sort_order) VALUES (?,?)',
                   (d['name'], (query(db, 'SELECT COUNT(*) FROM categories') + [{}])[0].get('count(*)', query(db, 'SELECT COUNT(*) FROM categories')[0].get('count', 0))))
        db.commit()
        db.close()
        return jsonify({'ok': True})
    rows = [dict(r) for r in query(db, 'SELECT * FROM categories ORDER BY sort_order')]
    db.close()
    return jsonify(rows)

@app.route('/api/categories/<int:cid>', methods=['DELETE'])
def api_category_delete(cid):
    db = get_db()
    query(db, 'DELETE FROM categories WHERE id=?', (cid,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@app.route('/config')
def config():
    db = get_db()
    stages = query(db, 'SELECT * FROM project_stages ORDER BY sort_order')
    statuses = query(db, 'SELECT * FROM statuses ORDER BY sort_order')
    categories = query(db, 'SELECT * FROM categories ORDER BY sort_order')
    db.close()
    return render_template('config.html', stages=stages, statuses=statuses, categories=categories)

if __name__ == '__main__':
    init_db()
    # 0.0.0.0 支持局域网访问
    app.run(host='0.0.0.0', port=5000, debug=True)


@app.route("/react")
def react_app():
    return render_template("react_app.html")
