import json
import requests
from database import get_db

def get_ai_config():
    db = get_db()
    rows = db.execute("SELECT key, value FROM settings WHERE key LIKE 'ai_%'").fetchall()
    db.close()
    return {r['key']: r['value'] for r in rows}

def call_ai(prompt, config=None):
    """统一 AI 调用，支持 OpenAI/Claude/Gemini/DeepSeek"""
    if config is None:
        config = get_ai_config()

    provider = config.get('ai_provider', 'claude')
    api_key  = config.get('ai_api_key', '')
    model    = config.get('ai_model', 'claude-sonnet-4-20250514')
    base_url = config.get('ai_base_url', 'https://api.anthropic.com')

    if not api_key:
        return None

    # ── Claude ──
    if provider == 'claude':
        headers = {
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
        payload = {
            'model': model,
            'max_tokens': 1000,
            'messages': [{'role': 'user', 'content': prompt}]
        }
        r = requests.post(f"{base_url}/v1/messages", json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        return r.json()['content'][0]['text']

    # ── OpenAI / DeepSeek（兼容 OpenAI 格式）──
    elif provider in ('openai', 'deepseek'):
        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        payload = {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 1000,
        }
        url = base_url.rstrip('/') + '/chat/completions'
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        r.raise_for_status()
        return r.json()['choices'][0]['message']['content']

    # ── Gemini ──
    elif provider == 'gemini':
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {'contents': [{'parts': [{'text': prompt}]}]}
        r = requests.post(url, json=payload, timeout=30)
        r.raise_for_status()
        return r.json()['candidates'][0]['content']['parts'][0]['text']

    return None


def score_creator(creator, brand_id=None, product_id=None):
    """
    AI 评分主函数
    creator: dict，频道数据
    brand_id: 指定品牌（None = 自动匹配所有品牌）
    product_id: 指定产品
    返回: {'score': int, 'brand': str, 'reasons': [str], 'raw': str}
    """
    db = get_db()

    # 拉品牌信息
    if brand_id:
        brand = db.execute('SELECT * FROM brands WHERE id=?', (brand_id,)).fetchone()
        brands_info = [dict(brand)] if brand else []
    else:
        brands_info = [dict(b) for b in db.execute('SELECT * FROM brands').fetchall()]

    # 拉产品信息
    product_info = None
    if product_id:
        p = db.execute('SELECT p.*, b.name as brand_name FROM products p JOIN brands b ON p.brand_id=b.id WHERE p.id=?',
                       (product_id,)).fetchone()
        product_info = dict(p) if p else None

    # 拉历史合作数据
    history = db.execute('''
        SELECT cp.*, p.name as project_name, b.name as brand_name,
               ps.name as stage_name
        FROM creator_projects cp
        JOIN projects p ON cp.project_id = p.id
        JOIN brands b ON p.brand_id = b.id
        LEFT JOIN project_stages ps ON cp.stage_id = ps.id
        WHERE cp.creator_id = ?
        ORDER BY cp.created_at DESC LIMIT 10
    ''', (creator.get('channel_id', ''),)).fetchall()
    history_list = [dict(h) for h in history]

    db.close()

    # ── 构建 prompt ──────────────────────────────────────────
    brands_text = '\n'.join([
        f"- {b['name']}: 受众={b.get('target_audience','')}, "
        f"产品={b.get('description','')}, 关键词={b.get('keywords','')}"
        for b in brands_info
    ])

    product_text = ''
    if product_info:
        product_text = (f"\n目标产品: {product_info['name']} ({product_info['brand_name']})\n"
                        f"产品描述: {product_info.get('description','')}\n"
                        f"产品关键词: {product_info.get('keywords','')}")

    history_text = ''
    if history_list:
        history_text = '\n历史合作记录:\n' + '\n'.join([
            f"- {h['brand_name']} {h['project_name']}: "
            f"金额={h.get('amount',0)} {h.get('amount_currency','USD')}, "
            f"阶段={h.get('stage_name','')}, 发布日期={h.get('publish_date','')}"
            for h in history_list
        ])
    else:
        history_text = '\n（无历史合作记录，请仅依据频道数据评分）'

    creator_text = f"""
频道信息:
- 频道名: {creator.get('nickname', '')}
- 国家/地区: {creator.get('country', '')}
- 订阅量: {creator.get('subscriber_count', 0):,}
- 平均播放（近10条）: {creator.get('avg_views', 0):,}
- 近7天更新: {creator.get('update_7d', 0)} 条
- 近30天更新: {creator.get('update_30d', 0)} 条
- 近90天更新: {creator.get('update_90d', 0)} 条
- 频道描述: {str(creator.get('description', ''))[:500]}
- 类目标签: {creator.get('categories', '')}
"""

    prompt = f"""你是一个专业的网红营销分析师。请根据以下信息对这位 YouTube 创作者进行品牌合作匹配评分。

品牌库:
{brands_text}
{product_text}

创作者信息:
{creator_text}
{history_text}

请分析并输出以下 JSON 格式（只输出 JSON，不要任何其他文字）:
{{
  "score": 85,
  "best_brand": "KNKA",
  "reasons": [
    "家居内容占比高，与品牌定位高度契合",
    "频道受众以家庭用户为主",
    "近30天发布频率稳定，内容活跃",
    "互动率高于同类频道平均水平",
    "美国市场，符合目标销售区域"
  ],
  "concerns": [
    "粉丝量偏低，曝光量有限"
  ]
}}

评分规则：
- score: 0-100 整数，综合考虑内容匹配度、受众契合度、活跃度、市场覆盖
- best_brand: 最匹配的品牌名
- reasons: 3-6条推荐理由，具体且数据驱动
- concerns: 0-3条顾虑（可为空数组）
- 如有历史合作数据，优先参考实际合作表现
"""

    try:
        raw = call_ai(prompt)
        if not raw:
            return {'score': 0, 'brand': '', 'reasons': ['AI未配置'], 'concerns': [], 'raw': ''}

        # 清理 markdown 代码块
        clean = raw.strip().replace('```json', '').replace('```', '').strip()
        data = json.loads(clean)
        return {
            'score': int(data.get('score', 0)),
            'brand': data.get('best_brand', ''),
            'reasons': data.get('reasons', []),
            'concerns': data.get('concerns', []),
            'raw': raw
        }
    except Exception as e:
        return {'score': 0, 'brand': '', 'reasons': [f'评分失败: {str(e)}'], 'concerns': [], 'raw': ''}


def batch_score_creators(channel_ids, brand_id=None, product_id=None):
    """批量评分，返回 {channel_id: score_result}"""
    db = get_db()
    results = {}
    for cid in channel_ids:
        row = db.execute('SELECT * FROM creators WHERE channel_id=?', (cid,)).fetchone()
        if row:
            creator = dict(row)
            result = score_creator(creator, brand_id, product_id)
            results[cid] = result
            # 写回数据库
            reason_text = json.dumps({
                'brand': result['brand'],
                'reasons': result['reasons'],
                'concerns': result['concerns']
            }, ensure_ascii=False)
            db.execute(
                'UPDATE creators SET ai_score=?, ai_reason=? WHERE channel_id=?',
                (result['score'], reason_text, cid)
            )
    db.commit()
    db.close()
    return results
