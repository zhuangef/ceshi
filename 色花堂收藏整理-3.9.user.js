// ==UserScript==
// @name         色花堂收藏整理
// @namespace    http://tampermonkey.net/
// @version      3.9
// @description  全入口兼容 + 搜索高亮 + 侧边栏动态计数联动 + 清除缓存刷新 + 莫兰迪 Tag + 精准收藏时间排序 + 极速加载 + 右侧列紧凑右移
// @author       You
// @match        *://*/*mod=space*do=favorite*
// @match        *://*/*do=favorite*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 1. 判断当前页面类型：黑名单机制，排查 forum 与 article
    function isTargetTypePage() {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        return !(type === 'forum' || type === 'article');
    }

    if (!isTargetTypePage()) {
        console.log('[Discuz全量收藏分类] 当前是版块/文章收藏页面，脚本跳过执行。');
        return;
    }

    console.log('[Discuz全量收藏分类] 3.9 紧凑右移版启动中...');

    // 2. 自定义固定排序序列
    const SORT_ORDER = [
        "综合讨论区", "AI专区", "网友原创区", "转帖交流区", "投诉建议区", "资源出售区", "悬赏区",
        "国产原创", "亚洲无码原创", "亚洲有码原创", "高清中文字幕", "三级写真", "VR视频区",
        "素人有码系列", "欧美无码", "4K原版", "韩国主播", "动漫原创", "原创小说",
        "乱伦人妻", "青春校园", "武侠玄幻", "激情都市",
        "TXT小说下载", "自提字幕区", "自译字幕区", "字幕分享区",
        "新作区", "国产自拍", "中文字幕", "日韩无码", "日韩有码",
        "欧美风情", "卡通动漫", "剧情三级", "原创自拍", "转帖自拍",
        "华人街拍", "亚洲性爱", "欧美性爱", "卡通动漫", "套图下载"
    ];

    // 莫兰迪高雅低饱和色系 (16 种独特色彩)
    const PASTEL_GRADIENTS = [
        'background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1;',
        'background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;',
        'background: #feefea; color: #9a3412; border: 1px solid #ffedd5;',
        'background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;',
        'background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;',
        'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;',
        'background: #f5f3ff; color: #5b21b6; border: 1px solid #ddd6fe;',
        'background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff;',
        'background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3;',
        'background: #fefce8; color: #854d0e; border: 1px solid #fef08a;',
        'background: #fdf4ff; color: #86198f; border: 1px solid #f5d0fe;',
        'background: #f0fdfa; color: #115e59; border: 1px solid #99f6e4;',
        'background: #f8fafc; color: #1e293b; border: 1px solid #e2e8f0;',
        'background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa;',
        'background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe;',
        'background: #dcfce7; color: #14532d; border: 1px solid #86efac;'
    ];

    let forumData = {};
    let currentFilterForum = 'ALL';
    let currentSearchKey = '';

    // 本地缓存管理 (升级为 v9)
    const CACHE_KEY = 'discuz_fav_forum_cache_v9';
    function getCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }
    function setCache(cacheObj) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
        } catch (e) {}
    }
    function clearCache() {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {}
    }

    // 哈希函数：根据版块名称生成固定的渐变色索引
    function getGradientForForum(forumName) {
        let hash = 0;
        for (let i = 0; i < forumName.length; i++) {
            hash = forumName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % PASTEL_GRADIENTS.length;
        return PASTEL_GRADIENTS[index];
    }

    // 轮询等待 DOM 加载
    const timer = setInterval(() => {
        const favUl = document.querySelector('#favorite_ul, .tbmu + ul, #ct ul, .ptm ul');
        if (favUl) {
            clearInterval(timer);
            initAllPagesProcess(favUl);
        }
    }, 500);

    setTimeout(() => clearInterval(timer), 10000);

    async function initAllPagesProcess(favContainer) {
        const cacheMap = getCache();

        // 状态提示条
        const statusMsg = document.createElement('div');
        statusMsg.id = 'fav_parse_status';
        statusMsg.style.cssText = 'padding: 10px 15px; background: #e6f7ff; border: 1px solid #91d5ff; margin-bottom: 12px; color: #1890ff; font-size: 13px; border-radius: 4px; line-height: 1.6;';
        statusMsg.innerHTML = '🔍 正在分析收藏夹数据...';

        const mainContainer = document.querySelector('#ct .mn, .bm, #ct') || document.body;
        mainContainer.insertBefore(statusMsg, mainContainer.firstChild);

        // 获取总页数
        const { totalPages, baseUrl } = parsePaginationInfo();

        // 严格按原生收藏时间顺序抓取所有 LI 节点
        const rawThreads = await fetchAllPagesThreads(totalPages, baseUrl, favContainer);

        // 清空列表并生成表头
        favContainer.innerHTML = '';
        renderListHeader(favContainer);

        // 隐藏原版分页条
        document.querySelectorAll('.pg, .pgs').forEach(el => el.style.display = 'none');

        // 计算需要远程抓取的“未缓存”帖子
        const unchachedThreads = rawThreads.filter(t => !cacheMap[t.url]);

        if (unchachedThreads.length === 0) {
            statusMsg.style.background = '#f6ffed';
            statusMsg.style.borderColor = '#b7eb8f';
            statusMsg.style.color = '#52c41a';
            statusMsg.innerHTML = `⚡ <b>已从本地缓存秒级加载 ${rawThreads.length} 个收藏数据！</b>`;
            setTimeout(() => statusMsg.remove(), 2500);
        } else {
            statusMsg.innerHTML = `📦 发现 <b>${unchachedThreads.length}</b> 个新帖子，正在并发解析元数据...`;
        }

        let completed = 0;
        const totalUncached = unchachedThreads.length;

        // 并发抓取解析，严格保持原始收藏顺序
        const metaResults = await Promise.all(rawThreads.map(async (thread) => {
            let meta = cacheMap[thread.url];

            if (!meta) {
                meta = {
                    forumName: '未知版块',
                    author: '-',
                    authorDate: '-',
                    replies: '-',
                    views: '-'
                };

                try {
                    const res = await fetch(thread.url, { credentials: 'include' });
                    const html = await res.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // 1. 解析版块名称
                    const forumNav = doc.querySelector('#pt .z a[href*="forum-"], #pt .z a[href*="mod=forumdisplay"], .nv a[href*="forum"]');
                    if (forumNav) {
                        meta.forumName = forumNav.innerText.replace(/[<>]/g, '').trim();
                    } else {
                        const altForum = doc.querySelector('.ts a, #thread_subject');
                        if (altForum) meta.forumName = altForum.innerText.trim();
                    }

                    // 2. 解析作者与发表时间
                    const authorNode = doc.querySelector('.authi a.xw1, .authi a[href*="space"], .postauthor a');
                    if (authorNode) meta.author = authorNode.innerText.trim();

                    const timeNode = doc.querySelector('.authi em[id*="authorposton"], .authi em');
                    if (timeNode) {
                        meta.authorDate = timeNode.innerText.replace(/发表于\s*/, '').trim();
                    }

                    // 3. 解析查看数与回复数
                    const numEls = doc.querySelectorAll('.xg1 .xi1, .hm .xi1, .pnm .xi1');
                    if (numEls.length >= 2) {
                        meta.views = numEls[0].innerText.trim();   // 查看数
                        meta.replies = numEls[1].innerText.trim(); // 回复数
                    } else if (numEls.length === 1) {
                        meta.views = numEls[0].innerText.trim();
                    }

                    // 写入缓存
                    cacheMap[thread.url] = meta;
                } catch (err) {
                } finally {
                    completed++;
                    if (totalUncached > 0) {
                        statusMsg.innerHTML = `⏳ 正在解析新版块与详情数据: <b>${completed} / ${totalUncached}</b>`;
                    }
                }
            }
            return meta;
        }));

        // 按原始收藏顺序填充 DOM
        rawThreads.forEach((thread, index) => {
            const meta = metaResults[index];
            const forumName = meta.forumName;

            if (!forumData[forumName]) {
                forumData[forumName] = [];
            }

            const linkNode = thread.liNode.querySelector('a[href*="thread-"], a[href*="mod=viewthread"]');
            const rawTitle = linkNode ? linkNode.innerText.trim() : '';

            // 重构单个条目 DOM
            rebuildListItem(thread.liNode, linkNode, forumName, meta);

            forumData[forumName].push({
                liNode: thread.liNode,
                linkNode: linkNode,
                rawTitle: rawTitle,
                url: thread.url
            });

            favContainer.appendChild(thread.liNode);
        });

        // 保存更新后的缓存
        setCache(cacheMap);

        if (totalUncached > 0) {
            statusMsg.style.background = '#f6ffed';
            statusMsg.style.borderColor = '#b7eb8f';
            statusMsg.style.color = '#52c41a';
            statusMsg.innerHTML = `✅ 元数据解析完成并已写入缓存！`;
            setTimeout(() => statusMsg.remove(), 2500);
        }

        // 渲染侧栏
        renderLeftMenu();
    }

    // 渲染紧凑版表头（列宽与内容完全精准对齐）
    function renderListHeader(container) {
        const headerLi = document.createElement('li');
        headerLi.className = 'fav-list-header';
        headerLi.style.cssText = `
            display: flex !important;
            align-items: center !important;
            padding: 8px 10px !important;
            background: #f2f2f2 !important;
            border-bottom: 2px solid #cdcdcd !important;
            font-size: 12px !important;
            color: #666 !important;
            font-weight: bold !important;
            margin-bottom: 5px !important;
            box-sizing: border-box !important;
        `;
        headerLi.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-left: 5px; text-align: left;">帖子标题</div>
            <div style="width: 110px; flex-shrink: 0; text-align: left;">作者 / 发帖时间</div>
            <div style="width: 70px; flex-shrink: 0; text-align: left;">回复 / 查看</div>
            <div style="width: 40px; flex-shrink: 0; text-align: right;">操作</div>
        `;
        container.appendChild(headerLi);
    }

    // 重构单个 LI 节点布局 (紧凑右移，标题拉宽)
    function rebuildListItem(liNode, linkNode, forumName, meta) {
        liNode.style.cssText = `
            display: flex !important;
            align-items: center !important;
            padding: 10px !important;
            border-bottom: 1px solid #e8e8e8 !important;
            font-size: 12px !important;
            background: #fff;
            box-sizing: border-box !important;
        `;

        // 提取原有的“删除”按钮
        const extraOps = liNode.querySelector('.y, .xg1, input[type="checkbox"], a[href*="op=delete"]');

        // 左侧标题区（弹性自适应最大化）
        const leftBox = document.createElement('div');
        leftBox.style.cssText = 'flex: 1; display: flex; align-items: flex-start; margin-right: 15px; min-width: 0; text-align: left;';

        const tag = document.createElement('span');
        tag.style.cssText = `
            ${getGradientForForum(forumName)}
            padding: 1px 6px;
            font-size: 11px;
            border-radius: 3px;
            margin-right: 8px;
            flex-shrink: 0;
            margin-top: 2px;
            line-height: 1.4;
        `;
        tag.innerText = forumName;

        leftBox.appendChild(tag);
        if (linkNode) {
            linkNode.style.cssText = 'color: #333; text-decoration: none; word-break: break-all; word-wrap: break-word; white-space: normal; line-height: 1.5; font-size: 13px; text-align: left;';
            leftBox.appendChild(linkNode);
        }

        // 作者列（紧凑 110px，右移对齐表头）
        const authorCol = document.createElement('div');
        authorCol.style.cssText = 'width: 110px; flex-shrink: 0; text-align: left; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #888;';
        authorCol.innerHTML = `
            <div style="color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${meta.author}</div>
            <div style="color: #999; font-size: 10px;">${meta.authorDate}</div>
        `;

        // 回复/查看列（紧凑 70px，右移对齐表头）
        const statCol = document.createElement('div');
        statCol.style.cssText = 'width: 70px; flex-shrink: 0; text-align: left; line-height: 1.4; font-size: 11px; color: #888;';
        statCol.innerHTML = `
            <div style="color: #333;">${meta.replies}</div>
            <div style="color: #999; font-size: 10px;">${meta.views}</div>
        `;

        // 操作列（40px 居右对齐）
        const opCol = document.createElement('div');
        opCol.style.cssText = 'width: 40px; flex-shrink: 0; text-align: right; font-size: 11px;';
        if (extraOps) {
            extraOps.style.float = 'none';
            extraOps.style.display = 'inline-block';
            opCol.appendChild(extraOps);
        }

        liNode.innerHTML = '';
        liNode.appendChild(leftBox);
        liNode.appendChild(authorCol);
        liNode.appendChild(statCol);
        liNode.appendChild(opCol);
    }

    // 分页信息解析
    function parsePaginationInfo() {
        let maxPage = 1;
        let baseUrl = window.location.href;

        const pgContainer = document.querySelector('.pg, .pgs');
        if (pgContainer) {
            const fullText = pgContainer.innerText;
            const matchSlash = fullText.match(/\/\s*(\d+)\s*页/);
            if (matchSlash) {
                maxPage = Math.max(maxPage, parseInt(matchSlash[1]));
            }

            const pageLinks = pgContainer.querySelectorAll('a[href*="page="], a, label input');
            pageLinks.forEach(el => {
                if (el.href) {
                    const matchHref = el.href.match(/page=(\d+)/);
                    if (matchHref) maxPage = Math.max(maxPage, parseInt(matchHref[1]));
                }
                const txt = el.innerText || el.value || '';
                if (/^\d+$/.test(txt.trim())) {
                    maxPage = Math.max(maxPage, parseInt(txt.trim()));
                }
            });
        }

        baseUrl = baseUrl.replace(/([&?])page=\d+&?/, '$1').replace(/&$/, '');
        if (!baseUrl.includes('?')) baseUrl += '?';

        return { totalPages: maxPage, baseUrl };
    }

    // 抓取所有页数据
    async function fetchAllPagesThreads(totalPages, baseUrl, currentContainer) {
        const pageMap = {};
        const curPageMatch = window.location.href.match(/page=(\d+)/);
        const currentPageNum = curPageMatch ? parseInt(curPageMatch[1]) : 1;

        const currentPageItems = currentContainer.querySelectorAll('li');
        const curPageResults = [];
        currentPageItems.forEach(li => {
            const link = li.querySelector('a[href*="thread-"], a[href*="mod=viewthread"]');
            if (link) curPageResults.push({ liNode: li, url: link.href });
        });
        pageMap[currentPageNum] = curPageResults;

        if (totalPages > 1) {
            const pagePromises = [];
            for (let p = 1; p <= totalPages; p++) {
                if (p === currentPageNum) continue;

                const pageUrl = `${baseUrl}&page=${p}`;
                const promise = fetch(pageUrl, { credentials: 'include' })
                    .then(res => res.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const items = doc.querySelectorAll('#favorite_ul li, .tbmu + ul li, #ct ul li');

                        let pageResults = [];
                        items.forEach(li => {
                            const link = li.querySelector('a[href*="thread-"], a[href*="mod=viewthread"]');
                            if (link) pageResults.push({ liNode: li, url: link.href });
                        });
                        return { page: p, results: pageResults };
                    })
                    .catch(() => ({ page: p, results: [] }));

                pagePromises.push(promise);
            }

            const responses = await Promise.all(pagePromises);
            responses.forEach(item => {
                pageMap[item.page] = item.results;
            });
        }

        let sortedResults = [];
        for (let p = 1; p <= totalPages; p++) {
            if (pageMap[p]) sortedResults = sortedResults.concat(pageMap[p]);
        }
        return sortedResults;
    }

    // 排序权重计算
    function getSortIndex(forumName) {
        const exactIndex = SORT_ORDER.indexOf(forumName);
        if (exactIndex !== -1) return exactIndex;

        for (let i = 0; i < SORT_ORDER.length; i++) {
            const target = SORT_ORDER[i];
            const coreKey = target.replace(/区$/, '');
            if (forumName.includes(coreKey) || coreKey.includes(forumName.replace(/区$/, ''))) {
                return i;
            }
        }
        return 999;
    }

    // 渲染侧边栏
    function renderLeftMenu() {
        let leftSideUl = document.querySelector('#left_menu, .appl ul, .side_m ul, #ct .appl ul, .tbn ul');

        if (!leftSideUl) {
            const appl = document.querySelector('.appl, #ct .appl');
            if (appl) {
                leftSideUl = document.createElement('ul');
                appl.appendChild(leftSideUl);
            } else {
                return;
            }
        }

        leftSideUl.querySelectorAll('li').forEach(li => li.classList.remove('a'));

        const oldDynamicNodes = leftSideUl.querySelectorAll('.dynamic-forum-item');
        oldDynamicNodes.forEach(node => node.remove());

        // 标题 + 🔄 刷新缓存按钮
        const titleLi = document.createElement('li');
        titleLi.className = 'dynamic-forum-item';
        titleLi.style.cssText = 'padding: 1px 1px 1px 1px; font-size: 18px; font-weight: bold; color: #333; border-top: 1px solid #eee; margin-top: 1px; display: flex; justify-content: flex-start; align-items: center;';
        titleLi.innerHTML = `
        <span style="font-size: 16px;"></span>
            <a href="javascript:void(0);" id="btn_clear_fav_cache" title="清空本地缓存并重新刷新解析" style="font-size: 16px; text-decoration: none; color: #333; font-weight: bold;">版块刷新🔄</a>
        `;
        leftSideUl.appendChild(titleLi);

        // 绑定刷新按钮事件
        const btnClear = titleLi.querySelector('#btn_clear_fav_cache');
        btnClear.onclick = (e) => {
            e.stopPropagation();
            if (confirm('确认清空版块分类及详情缓存并重新抓取解析吗？')) {
                clearCache();
                window.location.reload();
            }
        };

        // 🔍 搜索框
        const searchLi = document.createElement('li');
        searchLi.className = 'dynamic-forum-item';
        searchLi.style.cssText = 'padding: 7px 1px 1px 1px;';
        searchLi.innerHTML = `
            <input type="text" id="fav_title_search" placeholder="🔎 搜标题关键词"
                style="width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; outline: none; background: #fff;" />
        `;
        leftSideUl.appendChild(searchLi);

        const searchInput = searchLi.querySelector('#fav_title_search');
        searchInput.addEventListener('input', (e) => {
            currentSearchKey = e.target.value.trim();
            applyCombinedFilter();
        });

        // “全部显示”选项
        const showAllLi = document.createElement('li');
        showAllLi.className = 'dynamic-forum-item a';
        showAllLi.innerHTML = `<a href="javascript:void(0);">全部显示 <span id="count_ALL" style="color:#000;font-size:11px;">(${getTotalCount()})</span></a>`;

        showAllLi.onclick = () => {
            setActiveItem(leftSideUl, showAllLi);
            currentFilterForum = 'ALL';
            applyCombinedFilter();
        };
        leftSideUl.appendChild(showAllLi);

        // 排序
        const sortedForumNames = Object.keys(forumData).sort((a, b) => {
            return getSortIndex(a) - getSortIndex(b);
        });

        // 渲染版块列表
        sortedForumNames.forEach(forumName => {
            const count = forumData[forumName].length;
            const safeId = 'count_' + encodeURIComponent(forumName).replace(/%/g, '_');
            const li = document.createElement('li');
            li.className = 'dynamic-forum-item';
            li.innerHTML = `<a href="javascript:void(0);">${forumName} <span id="${safeId}" style="color:#000;font-size:11px;">(${count})</span></a>`;

            li.onclick = () => {
                setActiveItem(leftSideUl, li);
                currentFilterForum = forumName;
                applyCombinedFilter();
            };

            leftSideUl.appendChild(li);
        });
    }

    function setActiveItem(container, targetLi) {
        const items = container.querySelectorAll('.dynamic-forum-item');
        items.forEach(item => item.classList.remove('a'));
        targetLi.classList.add('a');
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function applyCombinedFilter() {
        const counts = {};
        let totalMatched = 0;
        const searchLower = currentSearchKey.toLowerCase();

        Object.keys(forumData).forEach(forumName => {
            counts[forumName] = 0;

            forumData[forumName].forEach(item => {
                const titleLower = item.rawTitle.toLowerCase();
                const matchSearch = (!currentSearchKey || titleLower.includes(searchLower));
                const matchForum = (currentFilterForum === 'ALL' || forumName === currentFilterForum);

                if (matchSearch) {
                    counts[forumName]++;
                    totalMatched++;
                }

                if (matchForum && matchSearch) {
                    item.liNode.style.display = 'flex';
                } else {
                    item.liNode.style.display = 'none';
                }

                if (item.linkNode) {
                    if (currentSearchKey) {
                        const regex = new RegExp(`(${escapeRegExp(currentSearchKey)})`, 'gi');
                        item.linkNode.innerHTML = item.rawTitle.replace(regex, '<mark style="background:#ff0;color:#c00;padding:0 2px;border-radius:2px;font-weight:bold;">$1</mark>');
                    } else {
                        item.linkNode.innerHTML = item.rawTitle;
                    }
                }
            });
        });

        const allSpan = document.querySelector('#count_ALL');
        if (allSpan) {
            allSpan.innerText = `(${totalMatched})`;
        }

        Object.keys(counts).forEach(forumName => {
            const safeId = 'count_' + encodeURIComponent(forumName).replace(/%/g, '_');
            const span = document.querySelector(`#${safeId}`);
            if (span) {
                span.innerText = `(${counts[forumName]})`;
            }
        });
    }

    function getTotalCount() {
        return Object.values(forumData).reduce((sum, arr) => sum + arr.length, 0);
    }
})();
