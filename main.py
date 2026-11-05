# -*- coding: utf-8 -*-
"""
Telegram 自动组合转发 (Userbot, 基于 Telethon)

流程:
  1. 监听源频道的新消息
  2. 找到「获取链接」按钮并以你的账号点击它
     - 回调按钮: 直接 click()
     - 链接按钮: 若是 t.me/某机器人?start=参数, 自动给该机器人发 /start 参数
  3. 等链接机器人私聊发来的消息, 从中提取链接 (magnet / http)
  4. 按编号 (如 DANDY-329) 把原消息与链接配对
  5. 组合成一条, 发到你自己的频道

只改下面 CONFIG 区即可。api_id / api_hash / session 文件只留在你手机上,
不要发给任何人 (包括不要发到聊天里)。
"""

import asyncio
import datetime
import html
import json
import os
import random
import re
import shutil
import tempfile
import time
from urllib.parse import urlparse, parse_qs

from telethon import TelegramClient, events
try:
    from telethon.tl.types import MessageEntityCode, MessageEntityPre, MessageEntityTextUrl
except Exception:
    MessageEntityCode = MessageEntityPre = MessageEntityTextUrl = None

# ==================== CONFIG 只改这里 ====================
API_ID = 38542018                     # 在 my.telegram.org -> API development tools 申请, 填数字
API_HASH = "7643711fbb9a90e0d51a19c682ed5944"                  # 同上, 填字符串, 只留在本机
SOURCE = -1004327845391        # 源频道 (用户提供: 4327845391, 频道需加 -100 前缀; 脚本会自动尝试两种格式)
DEST = -1004295101955          # 你自己的频道 (用户提供: 4463499969, 同样加 -100 前缀; 脚本会自动尝试两种格式)
BUTTON_TEXT = "获取"        # 按钮文字, 包含这几个字就算命中
BOT_HINT = "@jasnaxbot"        # 链接机器人
DRY_RUN = False                 # True=测试模式: 只发到你的「收藏夹」预览, 不发频道; 确认无误改 False
WAIT_BOT_SECONDS = 120         # 等机器人回复的最长秒数
# --- 未达到领取条件时的机器人回复 ---
PUBLISH_NONLINK_REPLIES = True # True=机器人回的不是链接 (如统一的"多做任务"鼓励文字) 也照样组合发布,
                               # 格式为: 原帖 + <原文, 粉色代码格式, 不带"💬 机器人回复:"字样, 且删掉机器人那边的 🔗 编号行>;
                               # False=这类回复只等超时后通知收藏夹, 不发布
                               # 用户要求: 不设宽限期, 没有链接就是没有链接, 收到非链接回复立即发布
REUPLOAD_PROTECTED_MEDIA = True  # 源频道开了内容保护 (禁止转发) 时, 原媒体引用会被服务器拒
                               # (You can't forward messages from a protected chat), 此时改为先下载到手机
                               # 再重新上传为新文件; False=不下载重传, 保护媒体的消息只发文字
CONDITION_MARKER = "暂未达到此资源的领取条件"  # 机器人未达条件回复的识别关键字 (截图原文: ⛔ 暂未达到此资源的领取条件。请继续完成有效投稿后重试。)
REPLACE_CONDITION_WITH_SOURCE_LINK = True  # True=收到含上面关键字的回复时, 不在目标频道发鼓励文字本身,
                               # 而是发源频道对应消息的链接 (可点击, 带 ⏳ 待补全 标记), 方便日后达标后点回源帖补全;
                               # 其他非链接回复仍按代码格式原样发布
# --- 节流 (重要, 见 README「批量风险」一节) ---
# 监听本身是被动接收, 不需要延迟; 但点击和发布必须串行 + 随机间隔。
# 固定间隔最容易被识别为机器人, 所以这里改成每次随机取一个区间。
CLICK_MIN_SECONDS = 8         # 两次点击之间的最短间隔(秒): 用户要求 1-5 分钟
CLICK_MAX_SECONDS = 12        # 两次点击之间的最长间隔(秒)
                               # 平均 3 分钟/次: 200 次/天约需连续跑 10 小时, 150 条新帖约 7.5 小时,
                               # 所以手机每天至少要保持 10 小时以上在线才能跑满日限
DAILY_CLICK_LIMIT = 4000        # 每日点击软上限: 这是保守自设值, 不是 Telegram 公布的安全数,
                               # Telegram 并不公布用户账号的安全量; 到达上限后当天不再点击
# --- 全局顺序模式 (用户已选: 要全局顺序) ---
GLOBAL_ORDER = True            # True=历史全部补完之前, 一条新帖都不发布;
                               # 新帖不单独处理, 回溯按最旧->最新扫到它时自然按时间顺序处理,
                               # 追到最新那一刻才切到实时监听, 此后全局顺序成立。
                               # 前提: 目标频道必须是空的 (或新建一个空频道);
                               # 若目标频道已有新帖, 全局顺序已经破了, 删掉重建才能恢复。
                               # 注意: DRY_RUN 测试现在是安全的, _mark_done() 在测试模式
                               # 下不写 state.json, 测过的帖子正式跑时会重新处理, 不会留缺口。
                               # 但如果你以前的老版本已经在手机上跑过 DRY_RUN 测试, 那份旧
                               # state.json 里已有测试记录, 转正式前请先删一次: rm ~/state.json
                               # (目标频道仍是空的、正式还没跑过时才安全)。
BACKFILL_ENABLED = True        # 全局模式下强制开启回溯
BACKFILL_PER_RUN = 50          # 非全局模式下每启动一次最多回溯几条; 全局模式下忽略此值, 只受日限约束
BACKFILL_ORDER = "oldest"      # 全局模式下强制 "oldest"=最旧->最新;
                               # "newest"=最新->最旧, 中断时先拿到较新的, 但历史段内是倒序
BACKFILL_BLOCK_LIVE = True     # True=回溯进行时新帖先等待/不单独处理, 不插队到历史前面
                               # 相册历史本轮会跳过 (避免一组多图重复点击), 需手动处理
# 若手机要走本地代理才能连 Telegram (如 Clash/v2ray 的 socks5), 取消下一行注释并改端口:
# PROXY = ("socks5", "127.0.0.1", 10808)
PROXY = None
# =========================================================

SESSION = "tg_link_bot"
STATE_FILE = "state.json"

CODE_RE = re.compile(r"\b[A-Z]{2,10}-\d{2,5}\b")
MAGNET_RE = re.compile(r"magnet:\?xt=urn:btih:[A-Za-z0-9]+[^\s]*")
URL_RE = re.compile(r"https?://[^\s]+")

DEST_ENTITY = None     # main() 里提前解析好的目标频道实体
SOURCE_LINK_BASE = None  # main() 里根据源频道实体算出: 公开频道 https://t.me/<用户名>, 私有频道 https://t.me/c/<裸ID>
pending_by_code = {}   # code -> {"texts": [...], "files": [...], "created": ts, "clicked": bool}
pending_fifo = []      # 没有编号时按先后顺序排队的待配对项
state_lock = asyncio.Lock()


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def save_state(done):
    # 不再截断: 旧版只保留最后 2000 条, 3000 条回溯跑过 2000 条后一旦重启,
    # 最早的记录会被丢掉, 已发过的帖子会被重新处理造成重复。3000 多条
    # 全量也只有几十 KB, 全保留没有性能问题。
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(done), f)
    except Exception:
        pass


done_ids = load_state()


def _mark_done(key):
    """记一条已处理 (只在正式跑时写盘)。
    测试模式 DRY_RUN 不写 state.json: 测过的帖子只发到了收藏夹预览,
    正式跑时必须重新处理, 否则目标频道会留缺口 (全局顺序下尤其致命)。
    以前 DRY_RUN 也会写 state.json, 所以测完必须手动删文件, 现在不用了。"""
    if DRY_RUN:
        return
    done_ids.add(key)
    save_state(done_ids)


def extract_code(text):
    if not text:
        return None
    m = CODE_RE.search(text)
    return m.group(0) if m else None


def extract_link(text):
    """机器人消息里的链接。截图里 magnet 会被换行拆成两行, 先去掉空白再找。"""
    if not text:
        return None
    compact = re.sub(r"\s+", "", text)
    m = MAGNET_RE.search(compact)
    if m:
        return m.group(0)
    m = URL_RE.search(text)
    return m.group(0) if m else None


def find_button(message):
    if not message.buttons:
        return None
    for row in message.buttons:
        for btn in row:
            if BUTTON_TEXT in (btn.text or ""):
                return btn
    return None


def _is_protected_error(e):
    """判断是不是源频道内容保护导致的拒发: 服务器把原媒体引用当成转发来拦,
    报错里通常含 protected / forward / CHAT_FORWARDS_RESTRICTED。"""
    msg = str(e).lower()
    return ("protected" in msg or "chat_forwards_restricted" in msg
            or "can't forward" in msg or "can not forward" in msg)


async def _download_files(client, sources):
    """把原媒体下载到临时目录, 返回 (本地路径列表, 临时目录)。
    sources 优先是原消息对象 (download_media 对消息最稳), 其次是 message.media。
    下载失败的单项直接跳过, 不让整条消息因为一张图卡住; 全部失败返回 ([], None)。
    调用方发完后必须删掉临时目录, 否则手机存储会被几千条媒体塞满。
    """
    tmpdir = tempfile.mkdtemp(prefix="tg_media_")
    paths = []
    for i, src in enumerate(sources or []):
        try:
            result = await client.download_media(src, file=tmpdir)
            if isinstance(result, str) and os.path.isfile(result):
                paths.append(result)
            elif isinstance(result, (bytes, bytearray)):
                p = os.path.join(tmpdir, f"media_{i}")
                with open(p, "wb") as f:
                    f.write(result)
                paths.append(p)
            else:
                # 有的版本 download_media(file=目录) 不返回值, 只把文件落在目录里
                for name in sorted(os.listdir(tmpdir)):
                    p = os.path.join(tmpdir, name)
                    if os.path.isfile(p) and p not in paths:
                        paths.append(p)
        except Exception as e:
            print(f"[下载媒体失败, 跳过这一项] {e}")
            continue
    if not paths:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return [], None
    return paths, tmpdir


async def _send_combined(client, target, files, html_text, plain_text, source_messages=None, entities_combined=None):
    """发送组合消息, 尝试顺序: 实体格式 > HTML > 纯文本。
    1. 实体格式 (formatting_entities, parse_mode=None): 直接传原消息的 entities,
       能原样保留 VDD-164 的 TextUrl、#98T水印 的标签实体, 不经过 HTML 转换,
       也就不会因为 HTML 不支持某个 URL 而整条回退。
    2. HTML 格式 (text_html + parse_mode='html'): 实体发送失败时的回退,
       蓝色超链接/加粗/斜体等一般能保留。
    3. 纯文本: 前两步都失败时的最后兜底, 此时把消息开头编号改成 #编号
       (用户授权的补救), 至少让开头编号按标签变蓝; #98T 这种数字开头标签
       在纯文本下仍无法变蓝, 只能靠第 1 步保留, 所以第 1 步是关键。
    内容保护特例: 源频道开了禁止转发时, 直接发原媒体引用会被服务器拒
    (You can't forward messages from a protected chat, SendMultiMediaRequest),
    这时不再用原引用重试 (重试多少次都一样), 而是下载后重新上传为新文件;
    下载也失败时, 退而只发文字, 保证顺序不缺条、下一条能继续, 而不是无限重试。
    """
    html_text = html_text or ""
    plain_text = plain_text or ""

    async def _do_send(send_files, text, parse_mode, entities):
        if send_files:
            if entities is not None:
                await client.send_file(target, send_files, caption=text or None, parse_mode=None, formatting_entities=entities)
            elif parse_mode:
                await client.send_file(target, send_files, caption=text or None, parse_mode=parse_mode)
            else:
                await client.send_file(target, send_files, caption=text or None, parse_mode=None)
        else:
            if entities is not None:
                await client.send_message(target, text, parse_mode=None, formatting_entities=entities, link_preview=False)
            elif parse_mode:
                await client.send_message(target, text, parse_mode=parse_mode, link_preview=False)
            else:
                await client.send_message(target, text, parse_mode=None, link_preview=False)

    async def _send_with_reupload(send_files, text, parse_mode, entities):
        """带内容保护兜底的发送: 原引用被拒 -> 下载重传 -> 仅发文字。"""
        try:
            await _do_send(send_files, text, parse_mode, entities)
            return
        except Exception as e:
            if not send_files or not _is_protected_error(e):
                raise
            print(f"[源频道内容保护, 原媒体引用被拒] {e}")
            if not REUPLOAD_PROTECTED_MEDIA:
                print("[已关下载重传, 改为仅发文字]")
            else:
                sources = source_messages or send_files
                paths, tmpdir = await _download_files(client, sources)
                try:
                    if paths:
                        print(f"[下载后重新上传 {len(paths)} 个媒体]")
                        try:
                            await _do_send(paths, text, parse_mode, entities)
                        except Exception:
                            await _do_send(paths, text, None, None)
                        return
                    print("[媒体下载失败, 改为仅发文字, 媒体缺失]")
                finally:
                    if tmpdir:
                        shutil.rmtree(tmpdir, ignore_errors=True)
            # 仅发文字兜底 (纯文字不受内容保护的媒体转发限制)
            await _do_send(None, text, parse_mode, entities)

    # 1. 实体格式优先
    if entities_combined is not None:
        try:
            await _send_with_reupload(files, plain_text, None, entities_combined)
            return
        except Exception as e:
            print(f"[实体格式发送失败, 回退HTML] {e}")
    # 2. HTML
    try:
        await _send_with_reupload(files, html_text, "html", None)
        return
    except Exception as e:
        print(f"[HTML发送失败, 回退纯文本] {e}")
    # 3. 纯文本 + 开头编号改 # 的补救
    fallback_plain = _hashtag_fallback_text(plain_text)
    if files:
        await client.send_file(target, files, caption=fallback_plain or None, parse_mode=None)
    else:
        await client.send_message(target, fallback_plain, parse_mode=None, link_preview=False)


def _item_header(item):
    plain = (item["texts"][0] if item["texts"] else "").strip()
    html_text = item.get("text_html") or html.escape(plain)
    return plain, html_text


def _combined_entities(item, plain_original, bot_plain, bot_kind, bot_url=None, bot_label_len=0):
    """给组合后的纯文本构造 formatting_entities, 优先用它来保留原帖蓝色链接。
    为什么 HTML 不够: text_html 会漏掉一些客户端自动识别的实体 (如 #标签),
    而 #98T水印 这种以数字开头的标签客户端根本不会自动识别, 没了显式实体就变黑;
    VDD-164 这种 TextUrl 链接在 HTML 解析不支持某些 URL 时也会整条回退纯文本而丢掉。
    直接传原消息的 entities 就能原样保留: VDD-164 的 TextUrl、#98T水印 的标签实体
    都在原 entities 里, 不用经过 HTML 转换。
    bot 部分: 原帖在前、机器人内容在后, 偏移 = len(原帖) + 2 (中间 "\n\n"),
    长度按 Python 字符数算 (本频道内容多为中日文/ASCII, 与 UTF-16 长度一致;
    若实体发送失败, _send_combined 会回退到 HTML 再到纯文本, 不会卡住)。
    bot_kind: 'code' / 'pre' / 'texturl' / None。
    """
    if MessageEntityCode is None:
        return None
    entities = list(item.get("entities") or [])
    if not bot_plain:
        return entities or None
    offset = len(plain_original) + (2 if plain_original else 0)
    try:
        if bot_kind == "code":
            entities.append(MessageEntityCode(offset, len(bot_plain)))
        elif bot_kind == "pre":
            entities.append(MessageEntityPre(offset, len(bot_plain), ""))
        elif bot_kind == "texturl" and bot_url:
            entities.append(MessageEntityTextUrl(offset + bot_label_len, len(bot_url), bot_url))
    except Exception:
        return None
    return entities


def _hashtag_fallback_text(plain_text):
    """纯文本兜底时的最后补救 (用户授权: URL 写不进去时, 消息开头加 #)。
    仅用于 entities 和 HTML 都失败、只能发纯文本的情况: 把消息开头的编号
    VDD-164 改成 #VDD-164, 让客户端按标签自动识别成蓝色 (V 开头, 符合标签规则)。
    注意 #98T水印 这种以数字开头的标签即使加 # 也不会被客户端自动识别,
    它只能靠 entities 保留, 所以这招只补救开头编号, 不替代 entities。
    """
    if not plain_text:
        return plain_text
    m = re.match(r"^([A-Z]{2,10}-\d{2,5})(\s|$)", plain_text)
    if m:
        return "#" + plain_text
    return plain_text


def _clean_bot_text(bot_text):
    """清洗机器人回复: 只删机器人那边的 🔗 编号行, 不动原帖。
    机器人私聊常以一行 '🔗 SHKD-583' / '🔗 **DANDY-329**' 开头, 那是原帖开头
    编号的重复, 用户要求不保留; 真正的链接 (magnet/ed2k/http) 行一律保留。
    原帖开头的编号 (即使在源频道是蓝色链接) 在 header 里, 这里根本不碰它,
    它仍按原帖 text_html 格式保留。
    """
    if not bot_text:
        return ""
    cleaned = []
    for line in bot_text.strip().splitlines():
        stripped = line.strip()
        # 整行只有 🔗 + 编号 (允许 ** 包裹) 就删, 其他含链接的行保留
        if re.match(r"^🔗\s*\*?[A-Z]{2,10}-\d{2,5}\*?\s*$", stripped):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip()


async def publish(client, item, link, code):
    """组合发布: 原帖 (格式原样保留) + 机器人回复的链接 (代码格式)。
    用户要求: 链接只发 <code>链接</code> 本身, 前面那行 '🔗 编号' 不保留;
    原帖开头的编号在 header 里, 不受影响。
    """
    plain, header_html = _item_header(item)
    html_parts = [header_html] if header_html else []
    plain_parts = [plain] if plain else []
    if link:
        # 机器人回复的链接用 <code> 包起来, 在 Telegram 里显示为代码格式 (粉底代码样式)
        html_parts.append(f"<code>{html.escape(link)}</code>")
        plain_parts.append(link)
    elif code:
        html_parts.append(html.escape(code))
        plain_parts.append(code)
    combined_html = "<br><br>".join(html_parts)
    combined_plain = "\n\n".join(plain_parts)
    target = "me" if DRY_RUN else (globals().get("DEST_ENTITY") or DEST)
    bot_plain = plain_parts[1] if len(plain_parts) > 1 else None
    entities = _combined_entities(item, plain, bot_plain, "code" if link else None)
    await _send_combined(client, target, item["files"] or None, combined_html, combined_plain, item.get("source_messages"), entities)
    print(f"[已发布{' (测试->收藏夹)' if DRY_RUN else ''}] {code} -> {link}")


def build_source_link(item):
    """根据原帖消息 ID 构造源频道原帖链接。
    公开频道: https://t.me/<用户名>/<消息ID>
    私有频道: https://t.me/c/<裸ID>/<消息ID> (裸ID = 4327845391 这种, 不带 -100 前缀)
    只有订阅了该私有频道的账号点开才有效, 这正是本脚本登录账号的情况。
    """
    msg_id = item.get("source_msg_id")
    if not msg_id:
        return None
    base = globals().get("SOURCE_LINK_BASE")
    if base:
        return f"{base}/{msg_id}"
    # 兜底: 从 SOURCE 配置推导
    if isinstance(SOURCE, str) and SOURCE.startswith("@"):
        return f"https://t.me/{SOURCE[1:]}/{msg_id}"
    try:
        bare = str(SOURCE)
        if bare.startswith("-100"):
            bare = bare[4:]
        elif bare.startswith("-"):
            bare = bare.lstrip("-")
        if bare.isdigit():
            return f"https://t.me/c/{bare}/{msg_id}"
    except Exception:
        pass
    return None


async def publish_nonlink(client, item, bot_text, code):
    """未达到领取条件时的组合发布: 原帖 (格式原样保留) + 机器人回复。
    两种情况:
    1. 机器人回复含未达条件关键字 (如截图的"暂未达到此资源的领取条件"):
       不发鼓励文字本身, 改发源频道原帖链接 (可点击, 带 ⏳ 待补全 标记),
       方便日后达标后点回源帖、点「获取链接」补全真实链接。
       注意: 这里是占位, 不会自动更新; 达标后需手动点源帖链接、取链接、编辑目标频道这条。
    2. 其他非链接回复: 只发机器人原文的粉色代码块, 不带 '💬 机器人回复:' 字样,
       并且先删掉机器人那边的 🔗 编号行 (见 _clean_bot_text), 只留真正的链接/文字内容。
    """
    plain, header_html = _item_header(item)
    html_parts = [header_html] if header_html else []
    plain_parts = [plain] if plain else []
    bot_clean = _clean_bot_text(bot_text)
    source_link = None
    if REPLACE_CONDITION_WITH_SOURCE_LINK and CONDITION_MARKER in bot_clean:
        source_link = build_source_link(item)
    if source_link:
        # 源帖链接要可点击, 所以不用 <code> 包 (代码格式里的链接点不开, 还得复制粘贴);
        # 用 <a href> 明确做成蓝色可点击链接, 并加 ⏳ 待补全 标记, 方便日后在目标频道搜索待补全的帖子。
        html_parts.append(f"⏳ 待补全，源频道原帖:<br><a href=\"{html.escape(source_link)}\">{html.escape(source_link)}</a>")
        plain_parts.append(f"⏳ 待补全，源频道原帖:\n{source_link}")
        print(f"[未达条件占位] {code or ''} -> {source_link}")
    else:
        if len(bot_clean) > 1500:
            bot_clean = bot_clean[:1500] + "…"
        if bot_clean:
            html_parts.append(f"<pre>{html.escape(bot_clean)}</pre>")
            plain_parts.append(bot_clean)
    combined_html = "<br><br>".join(html_parts)
    combined_plain = "\n\n".join(plain_parts)
    target = "me" if DRY_RUN else (globals().get("DEST_ENTITY") or DEST)
    if source_link:
        bot_plain = plain_parts[1] if len(plain_parts) > 1 else None
        entities = _combined_entities(item, plain, bot_plain, "texturl", bot_url=source_link, bot_label_len=len("⏳ 待补全，源频道原帖:\n"))
    else:
        bot_plain = plain_parts[1] if len(plain_parts) > 1 else None
        entities = _combined_entities(item, plain, bot_plain, "pre" if bot_plain else None)
    await _send_combined(client, target, item["files"] or None, combined_html, combined_plain, item.get("source_messages"), entities)
    print(f"[已发布(非链接回复){' (测试->收藏夹)' if DRY_RUN else ''}] {code or ''} -> {(source_link or bot_clean[:80])}")


async def publish_timeout(client, item, code):
    """等机器人超时后的占位发布: 原帖 (格式原样保留) + 报错内容 + 源帖链接。
    以前超时只往收藏夹发一条通知, 目标频道会缺这一条, 破坏全局顺序;
    现在超时也把原帖发到目标频道, 附上报错, 再加可点击的源帖链接,
    方便日后手动点回源帖、点「获取链接」补全真实链接。
    测试模式下目标是收藏夹, 和以前通知的去向一致。
    """
    plain, header_html = _item_header(item)
    timeout_text = f"⚠️ 等机器人超时，未拿到链接 ({code})" if code else "⚠️ 等机器人超时，未拿到链接"
    source_link = build_source_link(item)
    html_parts = [header_html] if header_html else []
    plain_parts = [plain] if plain else []
    html_parts.append(f"<pre>{html.escape(timeout_text)}</pre>")
    plain_parts.append(timeout_text)
    if source_link:
        html_parts.append(f"⏳ 待补全，源频道原帖:<br><a href=\"{html.escape(source_link)}\">{html.escape(source_link)}</a>")
        plain_parts.append(f"⏳ 待补全，源频道原帖:\n{source_link}")
    combined_html = "<br><br>".join(html_parts)
    combined_plain = "\n\n".join(plain_parts)
    target = "me" if DRY_RUN else (globals().get("DEST_ENTITY") or DEST)
    entities = _combined_entities(item, plain, timeout_text, "pre")
    await _send_combined(client, target, item["files"] or None, combined_html, combined_plain, item.get("source_messages"), entities)
    print(f"[已发布(超时占位){' (测试->收藏夹)' if DRY_RUN else ''}] {code or ''} -> {source_link or timeout_text}")


async def publish_direct(client, item):
    """无按钮消息直接发布: 原帖原样 (格式保留), 不加任何机器人内容, 不点击, 不等机器人。"""
    plain, header_html = _item_header(item)
    target = "me" if DRY_RUN else (globals().get("DEST_ENTITY") or DEST)
    entities = _combined_entities(item, plain, None, None)
    await _send_combined(client, target, item["files"] or None, header_html, plain, item.get("source_messages"), entities)
    print(f"[直接发布(无按钮){' (测试->收藏夹)' if DRY_RUN else ''}] {(plain[:80])}")


async def try_click(client, message, btn):
    """返回 True 表示已触发机器人。处理回调按钮和 ?start= 链接按钮两种情况。"""
    url = getattr(btn, "url", None)
    if url:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        start_param = (qs.get("start") or [None])[0]
        path = parsed.path.strip("/").split("/")[0] if parsed.path else ""
        if start_param and path:
            await client.send_message(path, f"/start {start_param}")
            print(f"[链接按钮] 已给 @{path} 发送 /start {start_param}")
            return True
        # 普通外链按钮: 链接本身就是结果, 不需要等机器人
        return ("DIRECT", url)
    # 回调按钮
    try:
        result = await btn.click()
        if result is not None and getattr(result, "message", None):
            print(f"[回调提示] {result.message}")
            link = extract_link(result.message)
            if link:
                return ("DIRECT", link)
        return True
    except Exception as e:
        print(f"[点击失败] {e}")
        return False


async def resolve_entity(client, value):
    """把 @名/邀请链接/数字ID 解析成实体。
    频道数字ID常被报成 4327845391 这种裸ID, 实际频道标记ID是 -1004327845391,
    两种 (再加原值) 都依次尝试, 谁能解析用谁, 避免填错格式直接报错。
    前提: 你的账号已经加入该频道, 否则 Telegram 不让解析纯数字ID。
    """
    candidates = [value]
    s = str(value).strip()
    if re.fullmatch(r"\d{6,}", s):
        candidates = [int(f"-100{s}"), int(s)]
    elif re.fullmatch(r"-100\d{6,}", s):
        candidates = [int(s), int(s[4:])]
    last_err = None
    for cand in candidates:
        try:
            return await client.get_entity(cand)
        except Exception as e:
            last_err = e
    raise SystemExit(f"无法解析 {value}: {last_err} (请确认账号已加入该频道/群, 或改用 @用户名/邀请链接)")


async def main():
    if not API_ID or not API_HASH or not SOURCE or (not DEST and not DRY_RUN):
        raise SystemExit("请先在 main.py 顶部 CONFIG 区填好 API_ID / API_HASH / SOURCE / DEST (测试模式 DRY_RUN=True 时 DEST 可暂空)")

    client = TelegramClient(SESSION, API_ID, API_HASH, proxy=PROXY)
    await client.start()  # 首次运行会在 Termux 里问手机号 + 验证码 + (如有)两步验证密码
    me = await client.get_me()
    print(f"已登录: {me.first_name} (@{me.username})  测试模式={DRY_RUN}")

    source_entity = await resolve_entity(client, SOURCE)
    bot_entity = await resolve_entity(client, BOT_HINT) if BOT_HINT else None
    # 源帖链接基地址: 公开频道用用户名, 私有频道用 t.me/c/<裸ID>
    global SOURCE_LINK_BASE
    _src_username = getattr(source_entity, "username", None)
    if _src_username:
        SOURCE_LINK_BASE = f"https://t.me/{_src_username}"
    else:
        _src_id = getattr(source_entity, "id", None)
        SOURCE_LINK_BASE = f"https://t.me/c/{_src_id}" if _src_id else None
    print(f"源帖链接基地址: {SOURCE_LINK_BASE}")
    # 目标频道也提前解析 (测试模式下解析失败不拦着, 只警告)
    global DEST_ENTITY
    DEST_ENTITY = None
    if DEST:
        try:
            DEST_ENTITY = await resolve_entity(client, DEST)
        except SystemExit as e:
            if not DRY_RUN:
                raise
            print(f"[警告] 目标频道暂未解析成功 (测试模式先跳过): {e}")

    album_buffer = {}
    last_click = [0.0]
    last_publish = [0.0]  # 直接发布之间的最小间隔 (秒), 防止无按钮消息突发连发触发 FloodWait
    source_lock = asyncio.Lock()  # 点击串行排队: 上一条等到机器人回复/超时才处理下一条
    # 回溯/全局追赶是否完成: 未开启回溯且非全局模式时默认已完成, 不等待;
    # 全局模式下只有追到最新才 set, 之前新帖一律不单独处理
    backfill_done = asyncio.Event()
    if not BACKFILL_ENABLED and not GLOBAL_ORDER:
        backfill_done.set()
    # 每日点击计数 (跨重启保留, 每天自动清零)
    clicks_today = [0]
    try:
        with open("clicks.json", "r", encoding="utf-8") as f:
            _c = json.load(f)
        if _c.get("date") == time.strftime("%Y-%m-%d"):
            clicks_today[0] = int(_c.get("count", 0))
    except Exception:
        pass

    async def handle_source_message(message, extra_media=None, extra_messages=None):
        key = f"{message.chat_id}:{message.id}"
        if key in done_ids:
            return
        btn = find_button(message)

        text = message.raw_text or ""
        files = ([message.media] if message.media else []) + (extra_media or [])
        # 下载重传要用原消息对象, 而不是只有 media, 所以按 files 同样的顺序存一份
        source_messages = ([message] if message.media else []) + [
            m for m in (extra_messages or []) if getattr(m, "media", None)]
        # 原帖格式: text_html 已把原消息的蓝色超链接/加粗/斜体等实体转成 HTML,
        # 后面发布时用 parse_mode='html' 原样带上, 而不是只发纯文本 raw_text。
        try:
            text_html = message.text_html
        except Exception:
            text_html = html.escape(text)
        if not text_html:
            text_html = html.escape(text)
        item = {"texts": [text], "text_html": text_html, "files": files, "created": time.time(),
                "source_msg_id": message.id, "source_chat_id": message.chat_id,
                "source_messages": source_messages,
                # 原帖实体原样存一份, 供 formatting_entities 优先发送用;
                # text_html 会漏掉 #标签等客户端自动识别的实体, 而 entities 不会漏,
                # 这正是 VDD-164 / #98T水印 在收藏夹变黑的原因。
                "entities": list(message.entities) if getattr(message, "entities", None) else []}

        if btn is None:
            # 无按钮消息: 直接发布原帖, 不点击、不等机器人、不占每日点击上限。
            # 串行锁 (on_source / 回溯) 已保证顺序, 这里不再加 1-5 分钟点击间隔,
            # 只留 5 秒发布间隔, 防止无按钮消息突发连发触发 FloodWait。
            if not text and not files:
                _mark_done(key)
                return
            wait_pub = 5 - (time.time() - last_publish[0])
            if wait_pub > 0:
                await asyncio.sleep(wait_pub)
            try:
                await publish_direct(client, item)
                last_publish[0] = time.time()
                _mark_done(key)
            except Exception as e:
                print(f"[直接发布失败, 下次回溯会重试] {e}")
            return

        code = extract_code(text)

        # 每日软上限: 不是官方安全数, 只是自设的刹车; 到达后当天不再点击
        # 注意: 首次调用不重置 (启动时已从 clicks.json 读入当天计数), 只有跨天才清零
        _today = time.strftime("%Y-%m-%d")
        if getattr(handle_source_message, "_date", None) not in (None, _today):
            clicks_today[0] = 0
        handle_source_message._date = _today
        if clicks_today[0] >= DAILY_CLICK_LIMIT:
            print(f"[已达每日上限 {DAILY_CLICK_LIMIT}, 跳过] {code or ''}")
            return
        # 随机间隔, 不是固定 5 秒: 固定间隔本身就是机器人特征
        interval = random.uniform(CLICK_MIN_SECONDS, CLICK_MAX_SECONDS)
        wait = interval - (time.time() - last_click[0])
        if wait > 0:
            await asyncio.sleep(wait)
        clicked = await try_click(client, message, btn)
        last_click[0] = time.time()
        clicks_today[0] += 1
        try:
            with open("clicks.json", "w", encoding="utf-8") as f:
                json.dump({"date": time.strftime("%Y-%m-%d"), "count": clicks_today[0]}, f)
        except Exception:
            pass
        _mark_done(key)

        if isinstance(clicked, tuple) and clicked[0] == "DIRECT":
            await publish(client, item, clicked[1], code)
            return
        if not clicked:
            await client.send_message("me", f"⚠️ 点击按钮失败, 请手动处理:\n{text[:500]}")
            return

        # 超时计时从点击后重新算: item["created"] 是处理开始时记的, 之前已经
        # 睡了随机 1-5 分钟点击间隔, 若不重置, expire_loop 会按处理开始时间
        # 算 120 秒, 点击后几秒内就误判超时 (机器人明明回得及时)。
        # 重置后机器人有完整的 120 秒回复时间。
        item["created"] = time.time()
        item["done"] = asyncio.Event()
        async with state_lock:
            if code:
                pending_by_code[code] = item
            else:
                pending_fifo.append(item)
        print(f"[等待机器人] {code or '(无编号, 按顺序配对)'}")
        # 串行: 等这条配对完成/超时后, 串行锁才会放行下一条 (见 on_source)
        try:
            await asyncio.wait_for(item["done"].wait(), timeout=WAIT_BOT_SECONDS + 30)
        except asyncio.TimeoutError:
            pass

    @client.on(events.NewMessage(chats=source_entity))
    async def on_source(event):
        # 全局顺序: 追赶完成前新帖不单独处理, 回溯按最旧->最新扫到它时自然按顺序处理,
        # 这样不会积累几千个等待任务, 也不会让新帖跳到历史前面
        if GLOBAL_ORDER and not backfill_done.is_set():
            return
        # 非全局模式: 回溯本轮进行时新帖先等待, 避免新帖插队到未完成的历史前面
        if BACKFILL_BLOCK_LIVE and not GLOBAL_ORDER:
            await backfill_done.wait()
        msg = event.message
        # 相册(多图/多视频一组): 先攒 3 秒再一起处理, 只点一次按钮
        # 注意: 攒相册在锁外, 避免多条相册消息互相等死; 真正的点击在锁内串行
        if msg.grouped_id:
            buf = album_buffer.setdefault(msg.grouped_id, [])
            buf.append(msg)
            await asyncio.sleep(3)
            group = album_buffer.pop(msg.grouped_id, [])
            if not group:
                return
            btn_msg = next((m for m in group if find_button(m)), group[-1])
            extra = [m.media for m in group if m is not btn_msg and m.media]
            extra_msgs = [m for m in group if m is not btn_msg and m.media]
            async with source_lock:
                await handle_source_message(btn_msg, extra_media=extra, extra_messages=extra_msgs)
            return
        async with source_lock:
            await handle_source_message(msg)

    @client.on(events.NewMessage(incoming=True))
    async def on_any_dm(event):
        # 只处理私聊里链接机器人发来的消息 (带链接, 或未达领取条件时的非链接回复)
        if not event.is_private:
            return
        if bot_entity is not None and event.chat_id != bot_entity.id:
            return
        if event.sender_id == me.id:
            return
        text = event.raw_text or ""
        link = extract_link(text)
        code = extract_code(text) or extract_code(text.splitlines()[0] if text else "")
        if not link:
            # 用户要求: 不设宽限期, 没有链接就是没有链接, 收到非链接回复立即组合发布。
            if not PUBLISH_NONLINK_REPLIES or not text.strip():
                return
            async with state_lock:
                item = None
                if code and code in pending_by_code:
                    item = pending_by_code.pop(code)
                elif pending_fifo:
                    item = pending_fifo.pop(0)
                elif pending_by_code:
                    oldest = min(pending_by_code, key=lambda k: pending_by_code[k]["created"])
                    item = pending_by_code.pop(oldest)
                    code = code or oldest
            if item is None:
                print(f"[收到未配对非链接回复] {text[:120]}")
                return
            await publish_nonlink(client, item, text, code)
            last_publish[0] = time.time()
            if item.get("done") is not None:
                item["done"].set()
            return
        async with state_lock:
            item = None
            if code and code in pending_by_code:
                item = pending_by_code.pop(code)
            elif pending_fifo:
                item = pending_fifo.pop(0)
            elif pending_by_code:
                # 机器人没回编号时, 取最早的一个待配对项
                oldest = min(pending_by_code, key=lambda k: pending_by_code[k]["created"])
                item = pending_by_code.pop(oldest)
                code = code or oldest
        if item is None:
            print(f"[收到未配对链接] {code} {link}")
            return
        await publish(client, item, link, code)
        last_publish[0] = time.time()
        if item.get("done") is not None:
            item["done"].set()

    async def expire_loop():
        while True:
            await asyncio.sleep(30)
            now = time.time()
            expired = []
            async with state_lock:
                for c, it in list(pending_by_code.items()):
                    if now - it["created"] > WAIT_BOT_SECONDS:
                        expired.append((c, pending_by_code.pop(c)))
                keep = []
                for it in pending_fifo:
                    (expired.append((None, it)) if now - it["created"] > WAIT_BOT_SECONDS else keep.append(it))
                pending_fifo[:] = keep
            for c, it in expired:
                # 超时也要把原帖发到目标频道 (附报错 + 源帖链接), 不能只通知收藏夹,
                # 否则目标频道缺条、全局顺序留缺口; 发布失败才回退到收藏夹通知。
                try:
                    await publish_timeout(client, it, c)
                except Exception as e:
                    print(f"[超时占位发布失败, 回退收藏夹通知] {e}")
                    await client.send_message(
                        "me", f"⚠️ 等机器人超时, 未拿到链接 ({c or ''}):\n{(it['texts'][0] if it['texts'] else '')[:500]}")
                if it.get("done") is not None:
                    it["done"].set()

    async def backfill_pass():
        """扫一遍历史, 返回 True 表示已扫到最新 (追赶完成), False 表示因日限/批次上限中途停止。
        全局模式下顺序强制最旧->最新, 且忽略 BACKFILL_PER_RUN, 只受日限约束;
        非全局模式下每遍最多点 BACKFILL_PER_RUN 条。
        已处理的有记录, 重启/下一遍会跳过, 不会重复点。
        """
        clicked = 0
        skipped_grouped = 0
        # 跨天时刷新日计数, 否则睡到第二天后仍用昨天的计数会一直卡住;
        # 首次调用不重置 (启动时已从 clicks.json 读入当天计数)
        today_str = time.strftime("%Y-%m-%d")
        if getattr(backfill_pass, "_date", None) not in (None, today_str):
            clicks_today[0] = 0
        backfill_pass._date = today_str
        order = "oldest" if GLOBAL_ORDER else BACKFILL_ORDER
        reverse = (order == "oldest")
        reached_end = True
        async for msg in client.iter_messages(source_entity, reverse=reverse):
            if not GLOBAL_ORDER and clicked >= BACKFILL_PER_RUN:
                reached_end = False
                break
            is_direct = find_button(msg) is None
            # 每日点击上限只约束点击, 无按钮直接发布不占上限, 所以达到上限时
            # 有按钮的消息停, 无按钮的消息继续直接发 (否则无按钮历史会永远卡住)
            if not is_direct and clicks_today[0] >= DAILY_CLICK_LIMIT:
                print("[回溯] 已达每日点击上限, 停止本遍 (无按钮消息不受此限, 下一遍会继续)")
                reached_end = False
                break
            if msg.grouped_id:
                skipped_grouped += 1
                continue
            msg_key = f"{msg.chat_id}:{msg.id}"
            if msg_key in done_ids:
                continue
            before = clicks_today[0]
            async with source_lock:
                await handle_source_message(msg)
            if clicks_today[0] > before:
                clicked += 1
            elif is_direct and msg_key in done_ids:
                # 无按钮直接发布: 不增加点击计数, 但在非全局模式下计入每遍处理量,
                # 防止一遍内无限量直接发布; 全局模式下忽略 PER_RUN, 不影响
                clicked += 1
        print(f"[回溯本遍结束] 处理 {clicked} 条, 跳过相册 {skipped_grouped} 条, 扫到最新={reached_end}")
        return reached_end

    async def sleep_until_next_day():
        now = datetime.datetime.now()
        tomorrow = (now + datetime.timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        seconds = max(60, (tomorrow - now).total_seconds())
        print(f"[全局顺序] 今日上限已到, 暂停 {seconds / 3600:.1f} 小时, 明天继续回溯 (新帖仍不单独发布)")
        await asyncio.sleep(seconds)
        clicks_today[0] = 0

    asyncio.create_task(expire_loop())
    if GLOBAL_ORDER:
        print("[全局顺序模式] 历史全部补完之前不发布任何新帖; 回溯最旧->最新, 追到最新才切实时监听")
        print("[全局顺序模式] 前提: 目标频道必须是空的; 若已有新帖, 请新建空频道再跑, 否则顺序已无法恢复")
        try:
            while True:
                reached = await backfill_pass()
                if reached:
                    print("[全局顺序] 已追到最新, 从现在起新帖按实时顺序发布, 全局顺序成立")
                    break
                await sleep_until_next_day()
        finally:
            backfill_done.set()
    elif BACKFILL_ENABLED:
        print(f"[回溯模式] 先回溯最多 {BACKFILL_PER_RUN} 条历史 ({BACKFILL_ORDER}), 再转入新帖监听")
        try:
            await backfill_pass()
        finally:
            backfill_done.set()
    print("监听中... 保持 Termux 在后台, 手机插着电。Ctrl+C 停止。")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
