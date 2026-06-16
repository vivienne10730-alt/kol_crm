import re
import json
import time
import random
import requests
from database import get_db

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

def get_yt_key():
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key='yt_api_key'").fetchone()
    db.close()
    return row['value'] if row else None

def get_ai_config():
    db = get_db()
    rows = db.execute("SELECT key, value FROM settings WHERE key LIKE 'ai_%'").fetchall()
    db.close()
    return {r['key']: r['value'] for r in rows}

# ── 邮箱提取 ─────────────────────────────────────────────────
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')

def extract_email(text):
    if not text:
        return None
    # 排除常见非个人邮箱
    skip = ['example.com', 'youtube.com', 'google.com']
    matches = EMAIL_RE.findall(text)
    for m in matches:
        if not any(s in m for s in skip):
            return m
    return None

# ── 频道详情 ─────────────────────────────────────────────────
def fetch_channel_detail(channel_id, api_key):
    url = f"{YOUTUBE_API_BASE}/channels"
    params = {
        'part': 'snippet,statistics,brandingSettings,contentDetails',
        'id': channel_id,
        'key': api_key
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    items = r.json().get('items', [])
    if not items:
        return None
    item = items[0]
    snippet = item.get('snippet', {})
    stats = item.get('statistics', {})
    branding = item.get('brandingSettings', {}).get('channel', {})

    desc = snippet.get('description', '')
    email = extract_email(desc) or extract_email(branding.get('description', ''))

    return {
        'channel_id': channel_id,
        'nickname': snippet.get('title', ''),
        'channel_url': f"https://www.youtube.com/channel/{channel_id}",
        'country': snippet.get('country', ''),
        'thumbnail_url': snippet.get('thumbnails', {}).get('default', {}).get('url', ''),
        'subscriber_count': int(stats.get('subscriberCount', 0)),
        'view_count': int(stats.get('viewCount', 0)),
        'video_count': int(stats.get('videoCount', 0)),
        'email': email,
        'description': desc,
    }

# ── 最近视频 & 平均播放（最近10条均值）────────────────────────
def fetch_recent_videos(channel_id, api_key, max_results=30):
    """拉最近视频列表，返回 video_id 列表"""
    # 先拿 uploads playlist id
    url = f"{YOUTUBE_API_BASE}/channels"
    params = {'part': 'contentDetails', 'id': channel_id, 'key': api_key}
    r = requests.get(url, params=params, timeout=10).json()
    items = r.get('items', [])
    if not items:
        return []
    playlist_id = items[0]['contentDetails']['relatedPlaylists']['uploads']

    # 拉 playlist items
    url2 = f"{YOUTUBE_API_BASE}/playlistItems"
    params2 = {'part': 'contentDetails,snippet', 'playlistId': playlist_id,
               'maxResults': max_results, 'key': api_key}
    r2 = requests.get(url2, params=params2, timeout=10).json()
    return [(item['contentDetails']['videoId'],
             item['snippet'].get('publishedAt', ''))
            for item in r2.get('items', [])]

def fetch_video_stats(video_ids, api_key):
    """批量拉视频播放量"""
    if not video_ids:
        return {}
    url = f"{YOUTUBE_API_BASE}/videos"
    params = {'part': 'statistics', 'id': ','.join(video_ids[:50]), 'key': api_key}
    r = requests.get(url, params=params, timeout=10).json()
    return {item['id']: int(item['statistics'].get('viewCount', 0))
            for item in r.get('items', [])}

def compute_channel_stats(channel_id, api_key):
    """计算平均播放（最近10条）和更新频率（7/30/90天）"""
    from datetime import datetime, timezone
    videos = fetch_recent_videos(channel_id, api_key, max_results=30)
    if not videos:
        return {'avg_views': 0, 'update_7d': 0, 'update_30d': 0, 'update_90d': 0}

    now = datetime.now(timezone.utc)
    update_7d = update_30d = update_90d = 0
    for _, pub in videos:
        try:
            dt = datetime.fromisoformat(pub.replace('Z', '+00:00'))
            days = (now - dt).days
            if days <= 7:  update_7d += 1
            if days <= 30: update_30d += 1
            if days <= 90: update_90d += 1
        except:
            pass

    # 平均播放：最近10条
    recent_10_ids = [vid for vid, _ in videos[:10]]
    stats = fetch_video_stats(recent_10_ids, api_key)
    views = list(stats.values())
    avg_views = int(sum(views) / len(views)) if views else 0

    return {
        'avg_views': avg_views,
        'update_7d': update_7d,
        'update_30d': update_30d,
        'update_90d': update_90d,
        'video_ids_for_related': [vid for vid, _ in videos[:5]]  # 用于相似推荐
    }

# ── 关键词搜索达人 ────────────────────────────────────────────
def search_channels_by_keyword(keyword, api_key, max_results=20):
    url = f"{YOUTUBE_API_BASE}/search"
    params = {
        'part': 'snippet',
        'q': keyword,
        'type': 'channel',
        'maxResults': max_results,
        'key': api_key
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    items = r.json().get('items', [])
    channel_ids = [item['snippet']['channelId'] for item in items]
    return channel_ids

# ── 视频相似达人（标签+类目二次搜索）────────────────────────
def get_related_channels_from_video(video_url, api_key):
    """从视频URL提取相关频道（relatedVideos已废弃，改用标签二次搜索）"""
    video_id = extract_video_id(video_url)
    if not video_id:
        return []

    # 拿视频的标签和类目
    url = f"{YOUTUBE_API_BASE}/videos"
    params = {'part': 'snippet', 'id': video_id, 'key': api_key}
    r = requests.get(url, params=params, timeout=10).json()
    items = r.get('items', [])
    if not items:
        return []

    snippet = items[0]['snippet']
    tags = snippet.get('tags', [])[:5]
    category_id = snippet.get('categoryId', '')
    title_words = snippet.get('title', '').split()[:4]

    # 用标签做二次搜索，收集频道
    channel_ids = set()
    queries = tags[:3] + [' '.join(title_words)]
    for q in queries:
        if not q:
            continue
        try:
            ids = search_channels_by_keyword(q, api_key, max_results=10)
            channel_ids.update(ids)
            time.sleep(0.3)
        except:
            pass

    # 排除原视频的频道
    original_channel = items[0]['snippet'].get('channelId', '')
    channel_ids.discard(original_channel)
    return list(channel_ids)[:20]

# ── 频道相似达人 ──────────────────────────────────────────────
def get_related_channels_from_channel(channel_url, api_key):
    channel_id = extract_channel_id(channel_url)
    if not channel_id:
        return []
    stats = compute_channel_stats(channel_id, api_key)
    video_ids = stats.get('video_ids_for_related', [])

    channel_ids = set()
    for vid in video_ids[:3]:
        fake_url = f"https://www.youtube.com/watch?v={vid}"
        ids = get_related_channels_from_video(fake_url, api_key)
        channel_ids.update(ids)
        time.sleep(0.5)

    channel_ids.discard(channel_id)
    return list(channel_ids)[:20]

# ── URL 解析工具 ──────────────────────────────────────────────
def extract_video_id(url):
    patterns = [
        r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:embed/)([a-zA-Z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None

def extract_channel_id(url):
    """支持 /channel/UC... 和 /@handle 两种格式"""
    m = re.search(r'/channel/(UC[a-zA-Z0-9_-]+)', url)
    if m:
        return m.group(1)
    # handle 格式需要再查一次 API
    m2 = re.search(r'/@([a-zA-Z0-9_.-]+)', url)
    if m2:
        return resolve_handle_to_id(m2.group(1))
    return None

def resolve_handle_to_id(handle):
    api_key = get_yt_key()
    if not api_key:
        return None
    url = f"{YOUTUBE_API_BASE}/channels"
    params = {'part': 'id', 'forHandle': handle, 'key': api_key}
    try:
        r = requests.get(url, params=params, timeout=10).json()
        items = r.get('items', [])
        return items[0]['id'] if items else None
    except:
        return None

# ── 批量获取频道完整数据 ──────────────────────────────────────
def enrich_channel(channel_id, api_key):
    """完整拉取一个频道的所有数据，用于入库"""
    detail = fetch_channel_detail(channel_id, api_key)
    if not detail:
        return None
    time.sleep(0.2)
    stats = compute_channel_stats(channel_id, api_key)
    detail.update(stats)
    return detail
