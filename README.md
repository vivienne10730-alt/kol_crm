# KOL CRM — 本地版

KNKA / MULISOFT / 7MAGIC 三品牌 KOL 管理系统

---

## 快速启动

### Windows
双击 `start.bat` 即可

### 手动启动
```bash
pip install -r requirements.txt
python app.py
```

浏览器打开：http://127.0.0.1:5000

---

## 局域网共享

启动后，同一 WiFi 下其他设备访问：
```
http://[你的电脑IP]:5000
```

Windows 查看本机 IP：`ipconfig` → IPv4 地址

---

## 首次配置（必做）

1. 进入 **API 设置** → 填入 YouTube Data API Key
2. 进入 **API 设置** → 填入 AI Provider 配置（Claude/OpenAI/DeepSeek 任选）
3. 进入 **品牌库** → 确认/编辑三个品牌的关键词
4. 进入 **产品库** → 新增具体产品（如 APH3000、Hair Styler）

---

## 功能模块

| 模块 | 功能 |
|------|------|
| 首页看板 | 今日跟进提醒、本周发布计划、总体统计 |
| 达人发现 | 关键词搜索 / 视频相似 / 频道相似，AI 批量评分 |
| 达人库 | 筛选、统计（花费/已发布/未发布）、批量操作 |
| 达人详情 | 合作记录、时间轴、提醒、AI 评分 |
| 项目管理 | 按品牌/项目筛选统计，多币种花费汇总 |
| 品牌库 | KNKA/MULISOFT/7MAGIC 关键词配置 |
| 产品库 | 按品牌分组，关键词用于 AI 匹配 |
| 阶段/状态 | 自定义颜色标签，完全可配置 |

---

## AI 评分逻辑

评分结合：
- 达人历史合作数据（有则优先）
- 频道内容 / 描述 / 更新频率
- 品牌库关键词匹配
- 产品库上下文
- 国家市场信号

输出：0-100 分 + 推荐原因 + 顾虑点

---

## YouTube API 申请

1. 前往 https://console.cloud.google.com
2. 新建项目 → 启用 YouTube Data API v3
3. 创建凭据 → API 密钥
4. 粘贴到系统设置

免费额度：每日 10,000 单位（搜索 100/次，详情 1/次）

---

## 数据文件

- `kol.db` — SQLite 数据库，所有数据存在这里
- 建议定期备份此文件
