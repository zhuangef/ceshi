// ==UserScript==
// @name         色花堂增强
// @namespace    https://www.sehuatang.net
// @version      4.9.0
// @description  98堂(原色花堂)官方脚本 高级搜索 快速复制 快速评分 划词搜索 图片预览 帖子页直接快速收藏 + 收藏夹帖子列表图片预览 橙金风UI + 板块筛选功能 + 收藏夹整理
// @author       98堂
// @match        *://*.sehuatang.net/*
// @match        *://*.sehuatang.org/*
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @license      GPL-4.0 License
// ==/UserScript==

(async function () {
    "use strict";

    // #region 全局变量
    let activeTooltips = 0;
    let toastQueue = [];
    let isToastShowing = false;

    const DEFAULT_TID_OPTIONS = [
        { value: 95, label: "综合区" },
        { value: 166, label: "AI区" },
        { value: 141, label: "原创区" },
        { value: 142, label: "转帖区" },
        { value: 96, label: "投诉区" },
        { value: 97, label: "出售区" },
        { value: 143, label: "悬赏区" },
        { value: 2, label: "国产原创" },
        { value: 36, label: "亚洲无码" },
        { value: 37, label: "亚洲有码" },
        { value: 103, label: "中文字幕" },
        { value: 107, label: "三级写真" },
        { value: 160, label: "VR视频区" },
        { value: 104, label: "素人有码" },
        { value: 38, label: "欧美无码" },
        { value: 151, label: "4K原版" },
        { value: 152, label: "韩国主播" },
        { value: 39, label: "动漫原创" },
        { value: 154, label: "文学区原创人生" },
        { value: 135, label: "文学区乱伦人妻" },
        { value: 137, label: "文学区青春校园" },
        { value: 138, label: "文学区武侠玄幻" },
        { value: 136, label: "文学区激情都市" },
        { value: 139, label: "文学区TXT下载" },
        { value: 145, label: "原档自提字幕区" },
        { value: 146, label: "原档自译字幕区" },
        { value: 121, label: "原档字幕分享区" },
        { value: 159, label: "原档新作区" },
        { value: 41, label: "在线国产自拍" },
        { value: 109, label: "在线中文字幕" },
        { value: 42, label: "在线日韩无码" },
        { value: 43, label: "在线日韩有码" },
        { value: 44, label: "在线欧美风情" },
        { value: 45, label: "在线卡通动漫" },
        { value: 46, label: "在线剧情三级" },
        { value: 155, label: "图区原创自拍" },
        { value: 125, label: "图区转帖自拍" },
        { value: 50, label: "图区华人街拍" },
        { value: 48, label: "图区亚洲性爱" },
        { value: 49, label: "图区欧美性爱" },
        { value: 117, label: "图区卡通动漫" },
        { value: 165, label: "图区套图下载" },
    ];

    var SEARCH_BOARD_GROUPS = [
        { label: "📁 综合区", fids: [95, 166] },
        { label: "📝 原创与转贴", fids: [141, 142, 96, 97, 143] },
        { label: "🎬 亚洲无码", fids: [36] },
        { label: "🎬 亚洲有码", fids: [37] },
        { label: "📺 中文字幕", fids: [103] },
        { label: "📷 三级写真&VR", fids: [107, 160] },
        { label: "👤 素人&欧美", fids: [104, 38] },
        { label: "🎥 4K原版&韩国", fids: [151, 152] },
        { label: "🎨 动漫原创", fids: [39] },
        { label: "🌐 在线区", fids: [41, 109, 42, 43, 44, 45, 46] },
        { label: "🖼️ 图区", fids: [155, 125, 50, 48, 49, 117, 165] },
        { label: "📚 文学区", fids: [154, 135, 137, 136, 139] },
        { label: "📄 原档字幕", fids: [145, 146, 121, 159] },
    ];
    var SEARCH_BOARD_NAMES = {};
    var SEARCH_FORMHASH = "";

    const baseURL = `https://${window.location.host}`;
    // #endregion

    // #region Toast 通知系统
    function showToast(message, type = 'info', duration = 3000) {
        toastQueue.push({ message, type, duration });
        processToastQueue();
    }

    function processToastQueue() {
        if (isToastShowing || toastQueue.length === 0) return;
        isToastShowing = true;
        const { message, type, duration } = toastQueue.shift();

        const toast = document.createElement('div');
        toast.className = 'bgsh-toast';
        toast.setAttribute('data-type', type);

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="bgsh-toast-icon">${iconMap[type] || 'ℹ️'}</span>
            <span class="bgsh-toast-message">${message}</span>
            <span class="bgsh-toast-progress"></span>
        `;

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                isToastShowing = false;
                processToastQueue();
            }, 400);
        }, duration);
    }

    function showTooltip(message) {
        showToast(message, 'info', 2500);
    }
    // #endregion

    // #region 深色模式
    function isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function getTheme() {
        return GM_getValue('bgsh_theme', 'auto');
    }

    function setTheme(theme) {
        GM_setValue('bgsh_theme', theme);
        applyTheme(theme);
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark' || (theme === 'auto' && isDarkMode());
        document.documentElement.setAttribute('data-bgsh-theme', isDark ? 'dark' : 'light');
    }
    // #endregion

    // #region 获取用户设置
    function getSettings() {
        const getJSONValue = (key, defaultValue) => {
            const value = GM_getValue(key, defaultValue);
            try {
                return JSON.parse(value);
            } catch {
                return JSON.parse(defaultValue);
            }
        };

        return {
            logoText: GM_getValue("logoText", "永久地址 WWW.98T.LA"),
            tipsText: GM_getValue("tipsText", "九八堂提醒你"),
            imageSize: GM_getValue("imageSize", "50px"),
            imageUrl: GM_getValue("imageUrl", "/static/image/common/logo.png"),
            blockMedals: GM_getValue("blockMedals", 0),
            resizeMedals: GM_getValue("resizeMedals", 0),
            replaceMedals: GM_getValue("replaceMedals", 0),
            displayBlockedTips: GM_getValue("displayBlockedTips", true),
            autoPagination: GM_getValue("autoPagination", true),
            showImageButton: GM_getValue("showImageButton", "hide"),
            lastCheckedUpdate: GM_getValue("lastCheckedUpdate", 0),
            enableTitleStyle: GM_getValue("enableTitleStyle", true),
            titleStyleSize: GM_getValue("titleStyleSize", 20),
            titleStyleWeight: GM_getValue("titleStyleWeight", 700),
            blockedUsers: GM_getValue("blockedUsers", []),
            showAvatar: GM_getValue("showAvatar", true),
            maxGradeThread: GM_getValue("maxGradeThread", 10),
            defaultSwipeToSearch: GM_getValue("defaultSwipeToSearch", true),
            displayThreadImages: GM_getValue("displayThreadImages", false),
            threadPreviewCount: Math.max(1, Math.min(12, parseInt(GM_getValue("threadPreviewCount", 3), 10) || 3)),
            visitedThreadColor: GM_getValue("visitedThreadColor", "#999999"),
            displayThreadBuyInfo: GM_getValue("displayThreadBuyInfo", true),
            isShowWatermarkMessage: GM_getValue("isShowWatermarkMessage", true),
            showDown: GM_getValue("showDown", true),
            showCopyCode: GM_getValue("showCopyCode", true),
            showFastPost: GM_getValue("showFastPost", true),
            showFastReply: GM_getValue("showFastReply", true),
            showQuickGrade: GM_getValue("showQuickGrade", true),
            showQuickStar: GM_getValue("showQuickStar", true),
            showClickDouble: GM_getValue("showClickDouble", true),
            showViewRatings: GM_getValue("showViewRatings", true),
            showPayLog: GM_getValue("showPayLog", true),
            showFastCopy: GM_getValue("showFastCopy", true),
            blockingResolved: GM_getValue("blockingResolved", true),
            isOnlyShowMoney: GM_getValue("isOnlyShowMoney", false),
            blockingIndex: GM_getValue("blockingIndex", false),
            menuButtonIsVisible: GM_getValue("menuButtonIsVisible", true),
            // 搜索设置
            searchCacheEnabled: GM_getValue("searchCacheEnabled", true),
            searchAutoComplete: GM_getValue("searchAutoComplete", true),
            searchResultCount: GM_getValue("searchResultCount", 50),
            searchSort: GM_getValue("searchSort", "relevance"),
            // 筛选状态
            boardFilterGroup: GM_getValue("bgsh_filter_group", "all"),
            boardFilterIndividual: GM_getValue("bgsh_filter_individual", "[]"),
            boardFilterCollapsed: GM_getValue("bgsh_filter_collapsed", false),
            typeFilterTypes: GM_getValue("bgsh_typeFilter_types", "[]"),
            typeFilterCollapsed: GM_getValue("bgsh_typeFilter_collapsed", false),
        };
    }
    // #endregion

    // #region 统一样式表 (保持长方形按钮 + 板块筛选)
    function addStyles() {
        const style = document.createElement("style");
        style.innerHTML = `
            /* ===== 全局设计 Token ===== */
            :root {
                --bgsh-primary: #f7971e;
                --bgsh-primary-light: #ffd200;
                --bgsh-primary-gradient: linear-gradient(135deg, var(--bgsh-primary), var(--bgsh-primary-light));
                --bgsh-radius: 16px;
                --bgsh-radius-sm: 10px;
                --bgsh-shadow: 0 12px 48px rgba(200, 120, 50, 0.2);
                --bgsh-shadow-hover: 0 8px 30px rgba(247, 151, 30, 0.4);
                --bgsh-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                --bgsh-bg-light: rgba(255, 248, 235, 0.92);
                --bgsh-bg-dark: rgba(40, 30, 20, 0.92);
                --bgsh-text-light: #4a2e1b;
                --bgsh-text-dark: #f0e0c0;
                --bgsh-border-light: rgba(255, 200, 150, 0.3);
                --bgsh-border-dark: rgba(255, 200, 150, 0.1);
                --bgsh-backdrop: blur(24px);
            }

            /* ----- Toast 通知 ----- */
            .bgsh-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-120px);
                background: var(--bgsh-bg-light);
                backdrop-filter: var(--bgsh-backdrop);
                -webkit-backdrop-filter: var(--bgsh-backdrop);
                border-radius: var(--bgsh-radius);
                padding: 14px 28px;
                box-shadow: var(--bgsh-shadow);
                z-index: 100000;
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 15px;
                font-weight: 500;
                color: var(--bgsh-text-light);
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                max-width: 90vw;
                border: 1px solid var(--bgsh-border-light);
                pointer-events: none;
                font-family: var(--bgsh-font);
            }
            .bgsh-toast.show { transform: translateX(-50%) translateY(0); }
            .bgsh-toast[data-type="success"] { border-color: rgba(247, 151, 30, 0.5); }
            .bgsh-toast[data-type="error"] { border-color: rgba(255, 80, 50, 0.5); }
            .bgsh-toast[data-type="warning"] { border-color: rgba(255, 200, 0, 0.5); }
            .bgsh-toast-icon { font-size: 20px; flex-shrink: 0; }
            .bgsh-toast-message { flex: 1; word-break: break-word; }
            .bgsh-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: var(--bgsh-primary-gradient);
                border-radius: 0 0 var(--bgsh-radius) var(--bgsh-radius);
                animation: bgshToastProgress 3s linear forwards;
            }
            @keyframes bgshToastProgress {
                from { width: 100%; }
                to { width: 0%; }
            }
            [data-bgsh-theme="dark"] .bgsh-toast {
                background: var(--bgsh-bg-dark);
                color: var(--bgsh-text-dark);
                border-color: var(--bgsh-border-dark);
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
            }

            /* ----- 原有按钮风格 (长方形) ----- */
            .bgsh-customBtn, .bgsh-searchBtn, .bgsh-quickTopicadminToPostBtn,
            .bgsh-quickReplyToPostBtn, .bgsh-QuickMiscReportBtn,
            .bgsh-quickReportadToPostBtn, .bgsh-quickGradeToPostBtn,
            .bgsh-openAllUrlBtn, .bgsh-fastPMButtonBtn,
            .bgsh-quickReplyEditToPostBtn, .bgsh-setAnswerToPostBtn {
                padding: 8px 15px;
                margin-bottom: 8px;
                margin-right: 8px;
                width: 100%;
                border: none;
                outline: none;
                white-space: pre-line;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 500;
                color: #3d2a1a;
                cursor: pointer;
                background: linear-gradient(135deg, #f7971e, #ffd200);
                box-shadow: 0 4px 15px rgba(247, 151, 30, 0.3);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .bgsh-customBtn:hover, .bgsh-searchBtn:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 8px 30px rgba(247, 151, 30, 0.4);
            }
            .bgsh-customBtn:active, .bgsh-searchBtn:active {
                transform: scale(0.96);
            }
            .bgsh-quickTopicadminToPostBtn, .bgsh-quickReplyToPostBtn,
            .bgsh-quickReplyEditToPostBtn, .bgsh-setAnswerToPostBtn {
                width: auto;
                float: right;
                background: linear-gradient(135deg, #f093fb, #f5576c);
                box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
                color: #fff;
            }
            .bgsh-quickGradeToPostBtn, .bgsh-QuickMiscReportBtn,
            .bgsh-quickReportadToPostBtn {
                width: auto;
                float: left;
                background: linear-gradient(135deg, #4facfe, #00f2fe);
                box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
                color: #fff;
            }
            .bgsh-fastPMButtonBtn {
                width: auto;
                float: left;
                background: linear-gradient(135deg, #a18cd1, #fbc2eb);
                box-shadow: 0 4px 15px rgba(161, 140, 209, 0.3);
                color: #fff;
            }
            .bgsh-openAllUrlBtn {
                width: 100px;
                font-size: 16px;
                padding: 0;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                box-shadow: 0 4px 15px rgba(238, 90, 36, 0.3);
                color: #fff;
            }
            .bgsh-searchBtn {
                max-width: 400px;
                background: linear-gradient(135deg, #f7971e, #ffd200);
                color: #3d2a1a;
            }

            /* ----- 浮动工具栏 (长方形按钮) ----- */
            .bgsh-toolbar {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                position: fixed;
                top: 50%;
                right: 12px;
                z-index: 1000;
                transform: translateY(-50%);
                max-height: 80vh;
                overflow-y: auto;
                padding: 4px 0;
            }
            .bgsh-toolbar .bgsh-customBtn,
            .bgsh-toolbar .bgsh-quickReplyToPostBtn,
            .bgsh-toolbar .bgsh-quickGradeToPostBtn {
                box-sizing: border-box;
                width: auto;
                min-width: 44px;
                height: 34px;
                padding: 6px 12px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                background: linear-gradient(135deg, #f7971e, #ffd200);
                color: #3d2a1a;
                transition: all 0.3s ease;
                margin: 0;
                float: none;
                display: flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
            }
            .bgsh-toolbar .bgsh-customBtn:hover,
            .bgsh-toolbar .bgsh-quickReplyToPostBtn:hover,
            .bgsh-toolbar .bgsh-quickGradeToPostBtn:hover {
                transform: translateY(-2px);
                box-shadow: var(--bgsh-shadow-hover);
            }
            .bgsh-toolbar .bgsh-customBtn:active,
            .bgsh-toolbar .bgsh-quickReplyToPostBtn:active,
            .bgsh-toolbar .bgsh-quickGradeToPostBtn:active {
                transform: scale(0.96);
            }
            .bgsh-toolbar::-webkit-scrollbar { width: 3px; }
            .bgsh-toolbar::-webkit-scrollbar-thumb {
                background: var(--bgsh-primary);
                border-radius: 3px;
            }

            /* ----- 通用对话框 (搜索 & 设置) ----- */
            .bgsh-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: bgshFadeIn 0.3s ease-out;
            }
            @keyframes bgshFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .bgsh-dialog {
                background: var(--bgsh-bg-light);
                height: 700px;
                max-height: 88vh;
                backdrop-filter: var(--bgsh-backdrop);
                -webkit-backdrop-filter: var(--bgsh-backdrop);
                border-radius: var(--bgsh-radius);
                width: 820px;
                max-width: 94vw;
                max-height: 88vh;
                box-shadow: 0 32px 80px rgba(0,0,0,0.25);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                animation: bgshSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid var(--bgsh-border-light);
                font-family: var(--bgsh-font);
            }
            [data-bgsh-theme="dark"] .bgsh-dialog {
                background: var(--bgsh-bg-dark);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            @keyframes bgshSlideUp {
                from { opacity: 0; transform: scale(0.92) translateY(30px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .bgsh-dialog-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 24px;
                border-bottom: 1px solid rgba(0,0,0,0.06);
                background: rgba(255,248,235,0.2);
                flex-shrink: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-header {
                border-color: var(--bgsh-border-dark);
                background: rgba(255,248,235,0.05);
            }
            .bgsh-dialog-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--bgsh-text-light);
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-title {
                color: var(--bgsh-text-dark);
            }
            .bgsh-dialog-title .badge {
                font-size: 11px;
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                padding: 2px 12px;
                border-radius: 12px;
                font-weight: 500;
            }
            .bgsh-dialog-close {
                font-size: 24px;
                color: #999;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 8px;
                border: none;
                background: none;
                transition: all 0.2s;
            }
            .bgsh-dialog-close:hover {
                background: rgba(0,0,0,0.06);
                color: #333;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-close:hover {
                background: rgba(255,255,255,0.06);
                color: #ccc;
            }
            .bgsh-dialog-body {
                padding: 20px 24px;
                overflow-y: auto;
                flex: 1;
            }
            .bgsh-dialog-body::-webkit-scrollbar { width: 5px; }
            .bgsh-dialog-body::-webkit-scrollbar-thumb {
                background: rgba(247,151,30,0.3);
                border-radius: 10px;
            }
            .bgsh-dialog-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 24px;
                border-top: 1px solid rgba(0,0,0,0.06);
                background: rgba(255,248,235,0.2);
                flex-shrink: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-dialog-footer {
                border-color: var(--bgsh-border-dark);
                background: rgba(255,248,235,0.05);
            }

            /* ----- 搜索对话框特有 (升级版) ----- */
            .bgsh-search-input-group {
                display: flex;
                gap: 10px;
                margin-bottom: 6px;
                position: relative;
            }
            .bgsh-search-input {
                flex: 1;
                height: 46px;
                padding: 0 18px;
                border: 2px solid rgba(0,0,0,0.08);
                border-radius: var(--bgsh-radius-sm);
                font-size: 15px;
                outline: none;
                transition: all 0.25s ease;
                background: rgba(255,255,255,0.5);
                backdrop-filter: blur(4px);
                color: var(--bgsh-text-light);
            }
            [data-bgsh-theme="dark"] .bgsh-search-input {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            .bgsh-search-input:focus {
                border-color: var(--bgsh-primary);
                box-shadow: 0 0 0 4px rgba(247,151,30,0.12);
                background: rgba(255,255,255,0.8);
            }
            .bgsh-search-hint {
                font-size: 12px;
                color: #aaa;
                margin: 4px 0 12px 0;
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-search-hint kbd {
                background: rgba(0,0,0,0.06);
                padding: 1px 8px;
                border-radius: 4px;
                font-size: 11px;
                color: #666;
                border: 1px solid rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-search-hint kbd {
                background: rgba(255,255,255,0.06);
                color: #aaa;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 12px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.03);
                border-radius: var(--bgsh-radius-sm);
                margin-bottom: 12px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-filters {
                background: rgba(255,255,255,0.03);
            }
            .bgsh-filter-label {
                font-size: 12px;
                font-weight: 600;
                color: #999;
                display: flex;
                align-items: center;
                margin-right: 4px;
            }
            .bgsh-search-filters label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 13px;
                color: #555;
                cursor: pointer;
                padding: 2px 10px;
                border-radius: 8px;
                background: rgba(255,255,255,0.5);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
            }
            [data-bgsh-theme="dark"] .bgsh-search-filters label {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-search-filters label:hover {
                background: rgba(247,151,30,0.08);
                border-color: var(--bgsh-primary);
            }
            .bgsh-search-filters input[type="radio"],
            .bgsh-search-filters input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                margin: 0;
            }
            /* 搜索历史 */
            .bgsh-search-history {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 8px 0 4px 0;
                border-top: 1px solid rgba(0,0,0,0.04);
                margin-top: 8px;
            }
            .bgsh-search-history .history-tag {
                background: rgba(247,151,30,0.12);
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 12px;
                color: var(--bgsh-primary);
                cursor: pointer;
                transition: all 0.15s;
                border: 1px solid rgba(247,151,30,0.15);
            }
            .bgsh-search-history .history-tag:hover {
                background: rgba(247,151,30,0.25);
                transform: scale(1.05);
            }
            .bgsh-search-history .history-clear {
                font-size: 11px;
                color: #999;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 8px;
                background: rgba(0,0,0,0.04);
                border: none;
            }
            .bgsh-search-history .history-clear:hover {
                background: rgba(255,0,0,0.08);
                color: #ff6b6b;
            }

            .bgsh-search-boards {
                border-top: 1px solid rgba(0,0,0,0.06);
                padding-top: 14px;
                margin-top: 6px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-boards {
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-boards-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
            }
            .bgsh-search-boards-header span {
                font-size: 13px;
                font-weight: 600;
                color: #666;
            }
            [data-bgsh-theme="dark"] .bgsh-search-boards-header span {
                color: #ccc;
            }
            .bgsh-search-boards-header .count {
                font-size: 12px;
                color: #999;
                font-weight: 400;
            }
            .bgsh-search-boards-header .bgsh-btn {
                padding: 2px 14px;
                font-size: 12px;
            }
            .bgsh-search-board-groups {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 260px;
                overflow-y: auto;
            }
            .bgsh-search-board-groups::-webkit-scrollbar { width: 4px; }
            .bgsh-search-board-groups::-webkit-scrollbar-thumb {
                background: rgba(247,151,30,0.3);
                border-radius: 4px;
            }
            .bgsh-search-board-group {
                background: rgba(0,0,0,0.02);
                border-radius: var(--bgsh-radius-sm);
                padding: 6px 10px;
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-group {
                background: rgba(255,255,255,0.02);
            }
            .bgsh-search-board-group-title {
                font-size: 11px;
                font-weight: 700;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
                padding-bottom: 3px;
                border-bottom: 1px dashed rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-group-title {
                color: #666;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-search-board-items {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-search-board-items label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #555;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 6px;
                background: rgba(255,255,255,0.5);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
            }
            [data-bgsh-theme="dark"] .bgsh-search-board-items label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-search-board-items label:hover {
                background: rgba(247,151,30,0.08);
            }
            .bgsh-search-board-items label.checked {
                background: rgba(247,151,30,0.15);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }
            .bgsh-search-board-items input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 13px;
                height: 13px;
                margin: 0;
            }
            .bgsh-board-star {
                margin-left: 2px;
                color: #bbb;
                font-size: 13px;
                line-height: 1;
                cursor: pointer;
                user-select: none;
            }
            .bgsh-board-star:hover,
            .bgsh-board-star.active {
                color: #f5a623;
                transform: scale(1.12);
            }
            .bgsh-search-board-group.common {
                background: linear-gradient(135deg, rgba(247,151,30,0.12), rgba(255,210,90,0.08));
                border: 1px solid rgba(247,151,30,0.22);
            }
            .bgsh-search-board-group.common .bgsh-search-board-group-title {
                color: var(--bgsh-primary);
            }

            /* ----- 设置面板 (升级版) ----- */
            .bgsh-settings-tabs {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 12px 0;
                background: rgba(0,0,0,0.02);
                border-right: 1px solid rgba(0,0,0,0.06);
                flex-shrink: 0;
                width: 120px;
            }
            [data-bgsh-theme="dark"] .bgsh-settings-tabs {
                background: rgba(255,255,255,0.02);
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-tab-btn {
                padding: 10px 16px;
                border: none;
                background: transparent;
                text-align: left;
                font-size: 13px;
                font-weight: 500;
                color: #888;
                cursor: pointer;
                transition: all 0.2s;
                border-radius: 0 10px 10px 0;
                position: relative;
            }
            .bgsh-tab-btn:hover {
                background: rgba(247,151,30,0.06);
                color: #555;
            }
            [data-bgsh-theme="dark"] .bgsh-tab-btn:hover {
                background: rgba(247,151,30,0.1);
                color: #ccc;
            }
            .bgsh-tab-btn.active {
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                box-shadow: 0 4px 20px rgba(247,151,30,0.3);
            }
            .bgsh-tab-btn.active::before {
                content: "";
                position: absolute;
                left: 0;
                top: 20%;
                height: 60%;
                width: 3px;
                background: #3d2a1a;
                border-radius: 0 3px 3px 0;
            }
            .bgsh-settings-content {
                flex: 1;
                padding: 16px 20px;
                overflow-y: auto;
                background: rgba(255,255,255,0.05);
            }
            [data-bgsh-theme="dark"] .bgsh-settings-content {
                background: rgba(255,255,255,0.02);
            }
            .bgsh-tab-panel {
                display: none;
                animation: bgshFadeContent 0.25s ease-out;
            }
            .bgsh-tab-panel.active { display: block; }
            @keyframes bgshFadeContent {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .bgsh-setting-group {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            .bgsh-setting-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .bgsh-setting-item > label:not(.bgsh-switch-label) {
                font-size: 12px;
                font-weight: 600;
                color: #555;
            }
            [data-bgsh-theme="dark"] .bgsh-setting-item > label:not(.bgsh-switch-label) {
                color: #ccc;
            }
            .bgsh-setting-item input[type="text"],
            .bgsh-setting-item input[type="number"],
            .bgsh-setting-item textarea {
                padding: 8px 14px;
                border: 2px solid rgba(0,0,0,0.06);
                border-radius: var(--bgsh-radius-sm);
                font-size: 13px;
                color: var(--bgsh-text-light);
                background: rgba(255,255,255,0.5);
                backdrop-filter: blur(4px);
                transition: all 0.25s ease;
                outline: none;
                font-family: var(--bgsh-font);
            }
            .bgsh-setting-item textarea {
                resize: vertical;
                min-height: 80px;
                line-height: 1.6;
            }
            [data-bgsh-theme="dark"] .bgsh-setting-item input,
            [data-bgsh-theme="dark"] .bgsh-setting-item textarea {
                background: rgba(255,255,255,0.05);
                border-color: var(--bgsh-border-dark);
                color: var(--bgsh-text-dark);
            }
            .bgsh-setting-item input:focus,
            .bgsh-setting-item textarea:focus {
                border-color: var(--bgsh-primary);
                box-shadow: 0 0 0 4px rgba(247,151,30,0.1);
                background: rgba(255,255,255,0.8);
            }
            .bgsh-hint {
                font-size: 11px;
                color: #aaa;
                margin-top: 2px;
            }
            [data-bgsh-theme="dark"] .bgsh-hint { color: #666; }
            .bgsh-switch-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px 16px;
            }

            /* ----- 显示设置：整体两列布局 ----- */
            /* 将“显示”页的各个设置项统一放入两列网格，
               顺序为：左1/右1、左2/右2……，更紧凑且与设置截图一致。 */
            #tab-display.active {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                column-gap: 24px;
                row-gap: 2px;
                align-content: start;
            }

            /* 解除分组容器对网格布局的阻隔，让每个设置项直接参与两列排版 */
            #tab-display .bgsh-setting-group {
                display: contents;
            }

            #tab-display .bgsh-setting-item {
                min-width: 0;
                margin-bottom: 10px;
            }

            /* 最下面的开关区域横跨两列，内部仍保持两列 */
            #tab-display .bgsh-switch-grid {
                grid-column: 1 / -1;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                column-gap: 24px;
                row-gap: 10px;
                margin-top: 2px;
            }

            #tab-display .bgsh-switch-label {
                width: 100%;
                justify-content: flex-start;
            }
            .bgsh-switch-label {
                display: inline-flex;
                align-items: center;
                cursor: pointer;
                font-size: 13px;
                font-weight: 400;
                color: #555;
                gap: 10px;
                user-select: none;
                padding: 6px 0;
                min-height: 32px;
                flex-shrink: 0;
                flex-wrap: nowrap;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-label {
                color: #ccc;
            }
            .bgsh-switch-label input {
                display: none;
            }
            .bgsh-switch-slider {
                position: relative;
                width: 42px;
                min-width: 42px;
                height: 24px;
                background: rgba(0,0,0,0.15);
                border-radius: 12px;
                transition: all 0.3s ease;
                flex-shrink: 0;
                display: inline-block;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-slider {
                background: rgba(255,255,255,0.1);
            }
            .bgsh-switch-slider::after {
                content: "";
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                background: #fff;
                border-radius: 50%;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            .bgsh-switch-label input:checked + .bgsh-switch-slider {
                background: var(--bgsh-primary-gradient);
            }
            .bgsh-switch-label input:checked + .bgsh-switch-slider::after {
                left: 20px;
            }
            .bgsh-switch-text {
                font-weight: 400;
                font-size: 13px;
                color: #555;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
                min-width: 0;
            }
            [data-bgsh-theme="dark"] .bgsh-switch-text { color: #ccc; }
            .bgsh-radio-group {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 2px;
            }
            .bgsh-radio-label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #555;
                cursor: pointer;
                padding: 4px 12px;
                border-radius: 8px;
                background: rgba(255,255,255,0.5);
                transition: all 0.15s;
                border: 1px solid rgba(0,0,0,0.04);
            }
            [data-bgsh-theme="dark"] .bgsh-radio-label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #ccc;
            }
            .bgsh-radio-label:hover {
                background: rgba(247,151,30,0.06);
            }
            .bgsh-radio-label input[type="radio"] {
                accent-color: var(--bgsh-primary);
                width: 14px;
                height: 14px;
                margin: 0;
                flex-shrink: 0;
            }
            .bgsh-radio-label:has(input:checked) {
                background: rgba(247,151,30,0.12);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }

            /* ----- 图片预览遮罩 ----- */
            .bgsh-image-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.85);
                backdrop-filter: blur(20px);
                z-index: 99998;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: zoom-out;
                animation: bgshFadeIn 0.3s ease-out;
            }
            .bgsh-image-overlay img {
                max-width: 92vw;
                max-height: 92vh;
                border-radius: 12px;
                box-shadow: 0 32px 80px rgba(0,0,0,0.5);
                animation: bgshZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            /* ----- 紧凑型主题预览图 ----- */
            .bgsh-pt {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                justify-content: flex-start !important;
                min-width: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: hidden !important;
                clear: both !important;
                float: none !important;
                box-sizing: border-box !important;
                gap: 4px !important;
                line-height: 0 !important;
                margin-top: 4px !important;
            }
            .bgsh-pt > img {
                display: block !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
                width: auto !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: var(--bgsh-preview-max-height, 180px) !important;
                margin: 0 !important;
                padding: 0 !important;
                object-fit: contain !important;
                vertical-align: middle !important;
            }
            .bgsh-favorite-preview {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: hidden !important;
                gap: 4px !important;
            }
            .bgsh-favorite-preview > img {
                width: auto !important;
                height: auto !important;
                max-width: 160px !important;
                max-height: 120px !important;
                min-width: 0 !important;
                object-fit: contain !important;
                flex: 1 1 0 !important;
                cursor: zoom-in !important;
            }
            /* 图片过多时自动压缩，保持单行完整显示 */
            .bgsh-favorite-preview > img:first-child:nth-last-child(n+2),
            .bgsh-favorite-preview > img:first-child:nth-last-child(n+2) ~ img {
                max-width: calc((100% - 20px) / 6) !important;
            }
            .bgsh-my-post-preview-row > td,
            .bgsh-favorite-preview-row > td {
                padding: 2px 8px 8px 28px !important;
                border-top: 0 !important;
                box-sizing: border-box !important;
            }
            .bgsh-favorite-preview-row.bgsh-favorite-preview-li-row {
                display: block !important;
                padding: 0 10px 10px 10px !important;
                margin: -4px 0 0 0 !important;
                border-bottom: 1px solid #e8e8e8 !important;
                background: #fff !important;
                box-sizing: border-box !important;
            }
            .bgsh-my-post-preview-host,
            .bgsh-favorite-preview-host {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }
            @keyframes bgshZoomIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }

            /* ----- 水印特效 ----- */
            .bgsh-watermark-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
            }
            .bgsh-watermark-text {
                position: absolute;
                text-align: center;
                font-size: 30px;
                color: rgba(255,0,0,0.15);
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: bgshWatermarkFloat 20s infinite alternate ease-in-out;
            }
            @keyframes bgshWatermarkFloat {
                0% { transform: rotate(-2deg) scale(1); }
                100% { transform: rotate(2deg) scale(1.05); }
            }
            .bgsh-watermark-text .icon {
                width: 30px;
                height: 30px;
                fill: rgba(255,0,0,0.15);
                margin: 0 5px;
            }

            /* ----- 板块筛选栏 (新增) ----- */
            .bgsh-board-filter {
                background: var(--bgsh-bg-light);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-radius: var(--bgsh-radius);
                border: 1px solid var(--bgsh-border-light);
                box-shadow: var(--bgsh-shadow);
                margin: 10px auto 18px auto;
                max-width: 960px;
                overflow: hidden;
                font-family: var(--bgsh-font);
                transition: all 0.3s ease;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter {
                background: var(--bgsh-bg-dark);
                border-color: var(--bgsh-border-dark);
                box-shadow: 0 12px 48px rgba(0,0,0,0.5);
            }
            .bgsh-board-filter-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 16px;
                background: var(--bgsh-primary-gradient);
                color: #3d2a1a;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                user-select: none;
            }
            .bgsh-board-filter-header span { display: flex; align-items: center; gap: 6px; }
            .bgsh-board-filter-toggle {
                font-size: 11px;
                opacity: 0.7;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .bgsh-board-filter-toggle:hover { opacity: 1; }
            .bgsh-board-filter-body {
                padding: 8px 12px;
                transition: max-height 0.3s ease, opacity 0.3s ease;
                max-height: 800px;
                overflow: hidden;
                opacity: 1;
            }
            .bgsh-board-filter-body.collapsed {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
            }
            .bgsh-board-filter-section {
                margin-bottom: 6px;
            }
            .bgsh-board-filter-section-title {
                font-size: 11px;
                font-weight: 700;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
                padding-bottom: 2px;
                border-bottom: 1px dashed rgba(0,0,0,0.06);
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-section-title {
                color: #666;
                border-color: var(--bgsh-border-dark);
            }
            .bgsh-board-filter-groups {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 8px;
                margin-bottom: 8px;
            }
            .bgsh-board-filter-btn {
                padding: 5px 14px;
                border: 2px solid rgba(247,151,30,0.2);
                border-radius: 20px;
                background: rgba(255,255,255,0.5);
                color: #666;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
                font-family: var(--bgsh-font);
                white-space: nowrap;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-btn {
                background: rgba(255,255,255,0.05);
                border-color: rgba(247,151,30,0.15);
                color: #aaa;
            }
            .bgsh-board-filter-btn:hover {
                background: rgba(247,151,30,0.1);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-text-light);
                transform: translateY(-1px);
            }
            .bgsh-board-filter-btn.active {
                background: var(--bgsh-primary-gradient);
                border-color: var(--bgsh-primary);
                color: #3d2a1a;
                box-shadow: 0 2px 12px rgba(247,151,30,0.3);
            }
            .bgsh-board-filter-btn.small {
                padding: 3px 10px;
                font-size: 11px;
            }
            .bgsh-board-filter-items {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .bgsh-board-filter-items label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: #666;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 6px;
                background: rgba(255,255,255,0.3);
                border: 1px solid rgba(0,0,0,0.04);
                transition: all 0.15s;
                user-select: none;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-items label {
                background: rgba(255,255,255,0.03);
                border-color: var(--bgsh-border-dark);
                color: #bbb;
            }
            .bgsh-board-filter-items label:hover {
                background: rgba(247,151,30,0.08);
            }
            .bgsh-board-filter-items label.checked {
                background: rgba(247,151,30,0.15);
                border-color: var(--bgsh-primary);
                color: var(--bgsh-primary);
            }
            .bgsh-board-filter-items input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 12px;
                height: 12px;
                margin: 0;
            }
            .bgsh-board-filter-count {
                font-size: 11px;
                color: #aaa;
                padding: 4px 0 0 4px;
            }
            [data-bgsh-theme="dark"] .bgsh-board-filter-count { color: #666; }



            /* ----- 搜索结果页右侧板块实时筛选栏 ----- */
            .bgsh-search-result-filter {
                position: fixed;
                top: 25px;
                right: 75px;
                width: min(480px, calc(100vw - 50px));
                max-width: calc(100vw - 36px);
                max-height: none;
                z-index: 99998;
                display: grid;
                grid-template-columns: 140px minmax(100px, 1fr) minmax(100px, 1fr);
                gap: 8px 14px;
                padding: 12px;
                border-radius: 18px;
                border: 10px solid transparent;
                background: transparent;
                box-shadow: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                font-family: var(--bgsh-font);
                box-sizing: border-box;
            }
            [data-bgsh-theme="dark"] .bgsh-search-result-filter {
                background: transparent;
                border-color: transparent;
                box-shadow: none;
            }
            .bgsh-search-result-filter-header {
                grid-column: 1 / -1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-size: 13px;
                font-weight: 700;
                color: var(--bgsh-text-light);
                cursor: move;
                user-select: none;
            }
            [data-bgsh-theme="dark"] .bgsh-search-result-filter-header { color: var(--bgsh-text-dark); }
            .bgsh-search-result-filter-actions {
                grid-column: 2 / -1;
                grid-row: 2;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .bgsh-search-result-filter-actions button,
            .bgsh-search-result-filter-collapse {
                border: 0;
                border-radius: 12px;
                padding: 4px 8px;
                background: rgba(255,255,255,0.28);
                color: #9a5a05;
                font-size: 11px;
                cursor: pointer;
            }
            .bgsh-search-result-filter-actions button:hover,
            .bgsh-search-result-filter-collapse:hover { background: rgba(247,151,30,0.18); }
            .bgsh-search-result-filter-actions button.bgsh-action-active {
                background: var(--bgsh-primary);
                color: #fff;
                border-color: var(--bgsh-primary);
            }

            /* ----- 搜索结果页自定义文字筛选 ----- */
            .bgsh-search-custom-filters {
                grid-column: 1;
                grid-row: 2 / span 3;
                display: flex;
                flex-direction: column;
                gap: 7px;
                padding: 4px 0 2px;
            }
            .bgsh-search-custom-filter-row {
                display: flex;
                align-items: flex-start;
                flex-direction: column;
                gap: 6px;
                min-width: 0;
            }
            .bgsh-search-custom-filter-row + .bgsh-search-custom-filter-hint {
                width: 100%;
                box-sizing: border-box;
                text-align: left;
            }
            .bgsh-search-custom-filter-switch {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                user-select: none;
                font-size: 12px;
                font-weight: 700;
                color: #666;
                white-space: nowrap;
            }
            .bgsh-search-custom-filter-switch input[type="checkbox"] {
                width: 16px;
                height: 16px;
                margin: 0;
                accent-color: var(--bgsh-primary);
                cursor: pointer;
            }
            .bgsh-search-result-filter-collapse {
                transition: all .2s ease;
                background: var(--bgsh-primary);
                border-color: var(--bgsh-primary);
                color: #fff;
                min-width: 70px;
                padding-left: 12px;
                padding-right: 12px;
            }
            .bgsh-search-result-filter.collapsed .bgsh-search-result-filter-collapse {
                background: var(--bgsh-primary);
                border-color: var(--bgsh-primary);
                color: #fff;
            }
            .bgsh-search-custom-filter-label {
                flex: 0 0 68px;
                font-size: 12px;
                font-weight: 700;
                color: #666;
                white-space: nowrap;
            }
            .bgsh-search-custom-filter-input {
                width: 100%;
                min-width: 0;
                height: 30px;
                box-sizing: border-box;
                border: 1px solid rgba(247,151,30,0.28);
                border-radius: 8px;
                padding: 4px 8px;
                background: rgba(255,255,255,0.72);
                color: #555;
                outline: none;
                font-size: 12px;
            }
            .bgsh-search-custom-filter-input:focus {
                border-color: var(--bgsh-primary);
                box-shadow: 0 0 0 2px rgba(247,151,30,0.12);
            }
            .bgsh-search-custom-filter-input::placeholder { color: #aaa; }
            [data-bgsh-theme="dark"] .bgsh-search-custom-filter-label { color: #bbb; }
            [data-bgsh-theme="dark"] .bgsh-search-custom-filter-input {
                background: rgba(35,35,35,0.72);
                color: #ddd;
                border-color: rgba(247,151,30,0.35);
            }
            .bgsh-search-custom-filter-hint {
                padding-left: 74px;
                color: #aaa;
                font-size: 10px;
                line-height: 1.2;
            }
            .bgsh-search-result-filter.collapsed .bgsh-search-custom-filters { display: none; }

            .bgsh-search-result-filter-body {
                grid-column: 2 / -1;
                grid-row: 3;
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 7px 12px;
                overflow: visible;
                padding-right: 4px;
            }
            .bgsh-search-result-filter.collapsed .bgsh-search-result-filter-body,
            .bgsh-search-result-filter.collapsed .bgsh-search-result-filter-actions,
            .bgsh-search-result-filter.collapsed .bgsh-search-result-filter-count { white-space: nowrap;
                 display: none; }
            .bgsh-search-result-filter.collapsed { width: auto; max-height: none; }
            .bgsh-search-result-filter-item {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                color: #666;
                font-size: 12px;
                line-height: 1.35;
                cursor: pointer;
                user-select: none;
            }
            [data-bgsh-theme="dark"] .bgsh-search-result-filter-item { color: #bbb; }
            .bgsh-search-result-filter-item input {
                width: 16px;
                height: 16px;
                margin: 0;
                accent-color: var(--bgsh-primary);
                flex: 0 0 auto;
            }
            .bgsh-search-result-filter-label {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .bgsh-search-result-filter-count { white-space: nowrap;
                
                color: #999;
                font-size: 11px;
                line-height: 1.4;
            }
            @media (max-width: 980px) {
                .bgsh-search-result-filter {
                    position: static;
                    width: auto;
                    max-height: none;
                    margin: 8px 12px 12px auto;
                }
            }

            /* ----- 板块列表行 ----- */
            .bgsh-board-filter-rows {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 4px 0;
            }
            .bgsh-board-filter-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 6px;
                border-radius: 6px;
                transition: background 0.15s;
            }
            .bgsh-board-filter-row:hover {
                background: rgba(247,151,30,0.06);
            }
            .bgsh-board-filter-cb {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                user-select: none;
                min-width: 100px;
                flex-shrink: 0;
            }
            .bgsh-board-filter-cb input[type="checkbox"] {
                accent-color: var(--bgsh-primary);
                width: 13px;
                height: 13px;
                margin: 0;
                cursor: pointer;
            }
            .bgsh-board-link {
                color: #4a2e1b;
                text-decoration: none;
                font-size: 13px;
                font-weight: 500;
                transition: color 0.15s;
                white-space: nowrap;
            }
            .bgsh-board-link:hover {
                color: #f7971e;
                text-decoration: underline;
            }
            [data-bgsh-theme="dark"] .bgsh-board-link {
                color: #f0e0c0;
            }
            [data-bgsh-theme="dark"] .bgsh-board-link:hover {
                color: #ffd200;
            }
            .bgsh-board-types {
                display: flex;
                align-items: center;
                gap: 3px;
                flex-wrap: wrap;
            }

            /* ----- 响应式优化 ----- */
            @media (max-width: 640px) {
                .bgsh-dialog { max-width: 98vw; max-height: 95vh; }
                .bgsh-dialog-body { padding: 16px; }
                .bgsh-settings-tabs {
                    flex-direction: row;
                    width: 100%;
                    padding: 6px 10px;
                    border-right: none;
                    border-bottom: 1px solid rgba(0,0,0,0.06);
                    overflow-x: auto;
                    gap: 2px;
                }
                .bgsh-tab-btn {
                    padding: 6px 14px;
                    border-radius: var(--bgsh-radius-sm);
                    font-size: 12px;
                    white-space: nowrap;
                }
                .bgsh-tab-btn.active::before { display: none; }
                .bgsh-switch-grid { grid-template-columns: 1fr; gap: 2px; }
                #tab-display.active {
                    grid-template-columns: 1fr;
                    column-gap: 0;
                }
                #tab-display .bgsh-switch-grid {
                    grid-template-columns: 1fr;
                }
                .bgsh-switch-label { padding: 4px 0; min-height: 28px; }
                .bgsh-switch-text { font-size: 12px; }
                .bgsh-toolbar {
                    right: 6px;
                    gap: 4px;
                }
                .bgsh-toolbar .bgsh-customBtn {
                    min-width: 36px;
                    padding: 4px 8px;
                    font-size: 11px;
                }
                .bgsh-search-input-group { flex-wrap: wrap; }
                .bgsh-search-input { height: 40px; font-size: 14px; }
                .bgsh-search-go { height: 40px; padding: 0 20px; }
                .bgsh-board-filter { margin: 6px 8px; border-radius: var(--bgsh-radius-sm); }
                .bgsh-board-filter-header { padding: 8px 12px; font-size: 13px; }
                .bgsh-board-filter-body { padding: 6px 8px; }
                .bgsh-board-filter-btn { padding: 4px 10px; font-size: 11px; }
                .bgsh-board-filter-btn.small { padding: 2px 7px; font-size: 10px; }
                .bgsh-board-filter-items label { font-size: 10px; padding: 1px 6px; }
            }
        
            /* ----- 已读/未读帖子区别 ----- */
            a.s.xst:visited {
                opacity: 1 !important;
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
            a.s.xst:visited * {
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
            a.xst:visited,
            .searchresult a[href*="thread-"]:visited,
            .searchresult a[href*="tid="]:visited {
                opacity: 1 !important;
                color: var(--bgsh-visited-thread-color, #999999) !important;
            }
`;
        document.head.appendChild(style);
    }

    function applyVisitedThreadColor(settings) {
        var color = settings && /^#[0-9a-f]{6}$/i.test(settings.visitedThreadColor)
        ? settings.visitedThreadColor
        : "#999999";
        document.documentElement.style.setProperty("--bgsh-visited-thread-color", color);
    }
    // #endregion

    // #region 按钮工厂 (保持长方形)
    function createButtonContainer() {
        const container = document.createElement("div");
        container.className = "bgsh-toolbar";
        return container;
    }

    const createButton = (id, text, clickFunction, className = "bgsh-customBtn") => {
        const button = document.createElement("button");
        button.id = id;
        button.innerText = text;
        button.className = className;
        button.addEventListener("click", clickFunction);
        return button;
    };
    // #endregion

    // #region 辅助函数
    function getCheckedRadioValue(name) {
        const radios = document.getElementsByName(name);
        for (let i = 0; i < radios.length; i++) {
            if (radios[i].checked) {
                return parseInt(radios[i].value);
            }
        }
        return null;
    }

    function getFormHash() {
        const element = document.querySelector('input[name="formhash"]');
        return element ? element.value : null;
    }

    function getUserId() {
        const userLink = document.querySelector(".vwmy a");
        if (userLink) {
            const match = userLink.href.match(/uid=(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    function getTableIdFromElement(element) {
        if (element) {
            let parentTable = element.closest("table");
            if (parentTable && parentTable.id.startsWith("pid")) {
                return parentTable.id.replace("pid", "");
            }
        }
        return null;
    }

    function getFidFromElement() {
        let element = document.querySelector("#newspecial");
        if (!element) return null;
        let hrefValue = element.getAttribute("onclick");
        if (!hrefValue) return null;
        let match = /fid=(\d+)/.exec(hrefValue);
        return match ? match[1] : null;
    }

    function extractTid(url) {
        let tid = null;
        const threadMatch = url.match(/thread-(\d+)-\d+-\d+\.html/);
        if (threadMatch && threadMatch.length > 1) {
            tid = threadMatch[1];
        } else {
            const queryMatch = url.match(/tid=(\d+)/);
            if (queryMatch && queryMatch.length > 1) {
                tid = queryMatch[1];
            }
        }
        return tid;
    }

    function getQueryParams(url) {
        const queryParams = {};
        if (url.includes("?")) {
            const queryPattern = /[?&]([^=&]+)=([^&]*)/g;
            let match;
            while ((match = queryPattern.exec(url)) !== null) {
                queryParams[match[1]] = decodeURIComponent(match[2]);
            }
        } else {
            const pathPattern = /forum-(\d+)-(\d+)\.html$/;
            const pathMatch = pathPattern.exec(url);
            if (pathMatch && pathMatch.length === 3) {
                queryParams.fid = pathMatch[1];
                queryParams.page = pathMatch[2];
            }
        }
        return queryParams;
    }

    async function copyToClipboard(text, onSuccess, onError) {
        try {
            await navigator.clipboard.writeText(text);
            if (onSuccess) onSuccess();
        } catch (err) {
            if (onError) onError(err);
            console.error("无法将文本复制到剪贴板", err);
        }
    }

    function getBoardName(fid) {
        if (SEARCH_BOARD_NAMES[String(fid)]) return SEARCH_BOARD_NAMES[String(fid)];
        for (var i = 0; i < DEFAULT_TID_OPTIONS.length; i++) {
            if (DEFAULT_TID_OPTIONS[i].value === parseInt(fid)) return DEFAULT_TID_OPTIONS[i].label;
        }
        return "fid=" + fid;
    }
    // #endregion

    // #region 收藏夹辅助函数
    const BGSH = (function() {
        const initialized = new Set();
        const listeners = new Set();
        return {
            debug: false,
            initialized,
            listeners,
            cleanup() { listeners.forEach(fn => { try { fn(); } catch(e) {} }); listeners.clear(); initialized.clear(); }
        };
    })();

    function debugLog(...args) { if (BGSH.debug) console.log("[98T]", ...args); }
    function errorLog(...args) { console.error("[98T]", ...args); }

    function safeCall(fn, fallback = undefined) {
        try { return typeof fn === "function" ? fn() : fallback; }
        catch (error) { errorLog(error); return fallback; }
    }

    function safeURL(value, fallback = "") {
        if (!value) return fallback;
        try {
            const url = new URL(String(value), location.href);
            if (!["http:", "https:"].includes(url.protocol)) return fallback;
            return url.href;
        } catch { return fallback; }
    }

    function normalizeURL(value) { return safeURL(value, ""); }

    function getJSONValue(key, fallback) {
        try {
            const value = GM_getValue(key, fallback);
            if (value === null || value === undefined) return fallback;
            if (typeof value !== "string") return value;
            const parsed = JSON.parse(value);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch { return fallback; }
    }

    function setJSONValue(key, value) { GM_setValue(key, value); }

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => safeCall(() => fn.apply(this, args)), wait || 200);
        };
    }

    function qs(selector, root) {
        try { return (root || document).querySelector(selector); }
        catch { return null; }
    }

    function qsa(selector, root) {
        try { return Array.from((root || document).querySelectorAll(selector)); }
        catch { return []; }
    }

    function createElement(tagName, options) {
        const element = document.createElement(tagName);
        if (!options) return element;
        if (options.className) element.className = options.className;
        if (options.id) element.id = options.id;
        if (options.text !== undefined) element.textContent = String(options.text);
        if (options.title) element.title = String(options.title);
        if (options.attrs && typeof options.attrs === "object") {
            for (const [key, value] of Object.entries(options.attrs)) {
                if (value !== null && value !== undefined) element.setAttribute(key, String(value));
            }
        }
        if (options.styles && typeof options.styles === "object") Object.assign(element.style, options.styles);
        if (typeof options.onClick === "function") element.addEventListener("click", options.onClick);
        return element;
    }

    function clearElement(element) {
        if (!element) return;
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    async function fetchWithTimeout(input, options, timeout) {
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, timeout || 10000);
        try {
            const response = await fetch(input, { credentials: "include", ...(options || {}), signal: controller.signal });
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response;
        } finally { clearTimeout(timer); }
    }

    async function fetchText(input, options, timeout) {
        const response = await fetchWithTimeout(input, options, timeout);
        return response.text();
    }

    function isPageType(type) {
        const url = location.href;
        const pageMatchers = {
            post: /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/i,
            search: /search\.php/i,
            forum: /forum\.php\?mod=forumdisplay|\/forum-\d+-\d+\.html/i,
            space: /home\.php\?.*mod=space/i,
            newThread: /forum\.php\?mod=post&action=newthread/i
        };
        return Boolean(pageMatchers[type]?.test(url));
    }

    function addSafeEventListener(target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== "function") return;
        target.addEventListener(eventName, function(event) {
            try {
                const result = handler(event);
                if (result && typeof result.catch === "function") {
                    result.catch(function(error) { errorLog(error); showToast("操作失败，请稍后重试", "error"); });
                }
            } catch (error) { errorLog(error); showToast("操作失败，请稍后重试", "error"); }
        }, options);
    }
    // #endregion

    // #region 勋章操作 (保持原样)
    function manipulateMedals(settings) {
        const excludeNumbers = [17, 29, 31, 32, 33, 34, 35, 36, 37, 38, 110, 111, 112, 113, 114, 116, 117];
        const targetMedalNumbers = Array.from({ length: 122 }, (_, i) => i + 14)
        .filter((num) => !excludeNumbers.includes(num))
        .map((num) => `medal${num}`);

        document.querySelectorAll(".md_ctrl img").forEach((img) => {
            const imgSrc = img.src;
            const targetMatch = targetMedalNumbers.some((target) => imgSrc.includes(target));

            const shouldApply = (setting) => setting === 1 || (setting === 2 && targetMatch);

            if (shouldApply(settings.blockMedals)) {
                img.style.display = "none";
            } else {
                img.style.display = "";
            }

            if (shouldApply(settings.resizeMedals)) {
                img.style.width = settings.imageSize;
            } else {
                img.style.width = "auto";
            }

            if (shouldApply(settings.replaceMedals)) {
                img.src = settings.imageUrl;
                img.style.width = "50px";
            }
        });
    }
    // #endregion

    // #region 帖子标题样式 (保持原样)
    function stylePosts(settings) {
        const style = document.createElement("style");
        style.id = "customTitleStyle";
        style.textContent = `
            .s.xst {
                font-size: ${settings.titleStyleSize}px;
                font-weight: ${settings.titleStyleWeight};
                font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei New', 'STHeiti Light', sans-serif;
            }
        `;
        document.head.appendChild(style);

        var images = document.querySelectorAll('img[alt="heatlevel"]');
        images.forEach((image) => {
            var parent = image.parentNode;
            var link = parent.querySelector("a.s.xst");
            var uniqueId = "t98theatleveldisplay";

            if (link) {
                const existingSpan = link.parentNode.querySelector("#" + uniqueId);
                if (!existingSpan) {
                    var span = document.createElement("span");
                    span.textContent = ` [${image.getAttribute("title")}]`;
                    span.style.color = "red";
                    span.style.fontWeight = "bold";
                    span.style.fontSize = `${settings.titleStyleSize}px`;
                    span.id = uniqueId;
                    link.parentNode.insertBefore(span, link.nextSibling);
                }
            }
        });
    }

    function undoStylePosts() {
        const styleElement = document.getElementById("customTitleStyle");
        if (styleElement) styleElement.remove();
    }
    // #endregion

    // #region 用户屏蔽 (保持原样)
    function blockContentByUsers(settings) {
        const { blockedUsers, displayBlockedTips } = settings;
        blockedUsers.forEach((userID) => {
            const actions = [
                {
                    xpath: `//table//tr[1]/td[2]//cite/a[text()="${userID}"]/ancestor::tbody[1]`,
                    message: `<tr><td class='icn'><img src='static/image/common/folder_common.gif' /></td>
                        <th class='common'><b>已屏蔽主题 <font color=grey></th>
                        <td class='by'><cite><font color=grey>${userID}</font></cite></td>
                        <td class='num'></td><td class='by'></td></tr>`
                },
                {
                    xpath: `//ul/li[p[3]/span[2]/a[text()='${userID}']]`,
                    message: `<li class="pbw"><p><span>已屏蔽"${userID}"</span></p></li>`
                }
            ];

            actions.forEach(action => {
                const elements = document.evaluate(action.xpath, document, null,
                                                   XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < elements.snapshotLength; i++) {
                    if (displayBlockedTips) {
                        elements.snapshotItem(i).innerHTML = action.message;
                    } else {
                        elements.snapshotItem(i).style.display = "none";
                    }
                }
            });
        });
    }
    // #endregion

    // #region 水印特效 (保持原样)
    function showWatermarkMessage() {
        var settings = getSettings();
        if (!settings.isShowWatermarkMessage) return;

        const watermarkWrapper = document.createElement("div");
        watermarkWrapper.className = "bgsh-watermark-wrapper";

        const positions = [];
        const maxAttempts = 10;

        const kissIcon = `<svg class="icon" viewBox="0 0 1489 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M1445.997803 542.822364c-28.845516 31.637018-113.986313 125.61757-171.677346 201.918612-70.252789 93.050052-107.007559 171.677345-165.163841 215.41087A249.374138 249.374138 0 0 1 935.153019 1023.891131a303.343168 303.343168 0 0 1-160.976589-46.525025 139.575077 139.575077 0 0 0-46.525026-6.513504 121.430317 121.430317 0 0 0-46.525026 5.117753 298.690666 298.690666 0 0 1-160.511339 46.525026 253.096141 253.096141 0 0 1-174.003597-63.274035C291.246662 915.022571 254.491891 837.791028 186.100103 744.740976 126.54807 667.044183 40.942023 573.063631 12.096507 541.426614c-6.048253-6.513504-12.096507-7.909254-12.096507-13.027008s12.096507-13.027007 12.096507-13.027007a487.11702 487.11702 0 0 0 85.606047-6.513503c21.401512-6.513504 211.688868-133.992074 211.688868-133.992075l150.741083-119.104066a143.76233 143.76233 0 0 1 68.391788-15.818509c41.872523 0 200.522861 100.028806 200.522862 100.028806S887.697493 241.340197 930.500517 241.340197a147.949582 147.949582 0 0 1 68.857038 15.353259l149.810583 119.569316s189.822105 127.013321 211.688868 133.992075a482.464518 482.464518 0 0 0 85.140797 6.513504s12.561757 7.909254 12.561757 13.027007-6.048253 6.513504-12.561757 13.027007zM1483.217823 136.658889a110.264311 110.264311 0 0 1-9.305005 21.401512 121.895568 121.895568 0 0 1-11.166006 15.818509L1315.72773 326.015744l-147.484331-150.741084a100.494056 100.494056 0 0 1-12.561757-17.67951 96.772054 96.772054 0 0 1-8.839755-17.679509 157.254587 157.254587 0 0 1-6.048254-41.872524 93.050052 93.050052 0 0 1 100.959306-93.050051 110.264311 110.264311 0 0 1 73.044291 46.525026A110.264311 110.264311 0 0 1 1387.84152 0.340563 93.050052 93.050052 0 0 1 1488.800827 95.716866a154.928336 154.928336 0 0 1-5.583004 40.942023z" fill="rgba(255,0,0,0.15)"></path>
            <path d="M729.047155 553.52312a739.28266 739.28266 0 0 0-87.001799 0 1777.255987 1777.255987 0 0 0-226.576875 58.621533c0 7.444004 13.492257 17.67951 113.055812 26.984515a1599.530388 1599.530388 0 0 0 200.522862 4.187252 1460.885811 1460.885811 0 0 0 201.453362-2.791501c99.563555-9.770255 113.521063-19.540511 113.521063-26.984515a1759.576477 1759.576477 0 0 0-227.042126-59.086783c-26.054014-2.791502-87.932299-0.930501-87.932299-0.930501z" fill="rgba(242,195,48,0.15)"></path>
        </svg>`;

        for (let i = 0; i < 20; i++) {
            const watermarkText = document.createElement("div");
            watermarkText.className = "bgsh-watermark-text";
            watermarkText.innerHTML = `${kissIcon}${settings.logoText}${kissIcon}`;

            let attempts = 0;
            let overlap = false;

            do {
                overlap = false;
                const x = Math.random() * window.innerWidth * 0.8;
                const y = Math.random() * window.innerHeight * 0.8;

                for (let pos of positions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 400) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    watermarkText.style.left = `${x}px`;
                    watermarkText.style.top = `${y}px`;
                    positions.push({ x, y });
                }
                attempts++;
            } while (overlap && attempts < maxAttempts);

            if (attempts < maxAttempts) {
                watermarkWrapper.appendChild(watermarkText);
            }
        }

        document.body.appendChild(watermarkWrapper);
        setTimeout(() => watermarkWrapper.remove(), 500);
    }
    // #endregion

    // #region 快速收藏（仅保留帖子详情页，直接使用网站原生收藏）

    let currentUid = null;
    let favKeys = null;
    let favCache = {};

    function getUid() {
        const cachedUid = GM_getValue("bgsh_uid", null);
        let uid = null;
        if (typeof window.discuz_uid !== "undefined" && window.discuz_uid && String(window.discuz_uid) !== "0") {
            uid = String(window.discuz_uid);
            if (uid !== cachedUid) GM_setValue("bgsh_uid", uid);
            return uid;
        }
        const userLink = qs(".vwmy a") || qs(".userinfo a[href*='uid=']") || qs("#um a[href*='uid=']") || qs("a[href*='space-uid-']");
        if (userLink) {
            try {
                const url = new URL(userLink.href, location.href);
                uid = url.searchParams.get("uid");
            } catch {
                const match = userLink.href.match(/[?&]uid=(\d+)/);
                uid = match ? match[1] : null;
            }
            if (!uid) { const m = userLink.href.match(/space-uid-(\d+)/); uid = m ? m[1] : null; }
            if (uid) { GM_setValue("bgsh_uid", uid); return uid; }
        }
        const urlUid = new URL(location.href).searchParams.get("uid");
        if (urlUid) { GM_setValue("bgsh_uid", urlUid); return urlUid; }
        return cachedUid ? String(cachedUid) : null;
    }

    function initFavoriteStorage() {
        currentUid = getUid();
        if (!currentUid) return false;
        favKeys = { favs: "bgsh_favs_" + currentUid };
        loadFavoriteData();
        return true;
    }

    function loadFavoriteData() {
        if (!favKeys) return;
        var data = getJSONValue(favKeys.favs, {});
        favCache = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    }

    function saveFavoriteData() {
        if (!favKeys) return;
        setJSONValue(favKeys.favs, favCache);
    }

    function getFavoriteTid(data) {
        if (!data) return "";
        return String(data.tid || extractTid(data.url) || "");
    }

    function getFavoriteEntries() {
        return Object.keys(favCache)
            .filter(function(k) { return favCache[k] && typeof favCache[k] === "object"; })
            .map(function(k) { return [k, favCache[k]]; });
    }

    async function executeDeleteRequest(favid) {
        var formhash = getFormHash();
        if (!favid || !formhash) { showToast("缺少取消收藏参数", "error"); return false; }
        var params = new URLSearchParams({ mod: "spacecp", ac: "favorite", op: "delete", favid: String(favid), type: "all", inajax: "1" });
        var body = new URLSearchParams({ deletesubmit: "true", formhash: formhash, handlekey: "a_delete_" + favid });
        try {
            var text = await fetchText("/home.php?" + params.toString(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }, body: body.toString() }, 10000);
            return text.includes("操作成功") || text.includes("删除成功");
        } catch (error) { errorLog("取消收藏失败:", error); return false; }
    }

    function extractFavoriteId(text) {
        if (!text) return "";
        var patterns = [/\['favid'\]\s*:\s*['\"]?(\d+)/i, /favid[=\s"':]+(\d+)/i, /favorite_(\d+)/i];
        for (var i = 0; i < patterns.length; i++) {
            var match = String(text).match(patterns[i]);
            if (match) return match[1];
        }
        return "";
    }

    async function requestFavorite(requestURL, tid, title) {
        var source = safeURL(requestURL, "");
        if (!source) { showToast("收藏链接无效", "error"); return false; }
        try {
            var separator = source.includes("?") ? "&" : "?";
            var text = await fetchText(source + separator + "infloat=yes&handlekey=k_favorite&inajax=1", {}, 10000);
            if (text.includes("已收藏") || text.includes("抱歉，您已收藏")) {
                showToast("抱歉，您已收藏，请勿重复收藏", "warning");
                return false;
            }
            if (!text.includes("成功") && !text.includes("收藏成功")) {
                showToast("收藏失败，服务器返回异常", "error");
                return false;
            }
            var favid = extractFavoriteId(text);
            if (favid) {
                favCache[favid] = {
                    tid: String(tid || ""),
                    title: title || qs("#thread_subject")?.textContent?.trim() || document.title || "无标题",
                    url: normalizeURL("/forum.php?mod=viewthread&tid=" + encodeURIComponent(tid))
                };
                saveFavoriteData();
            }
            showToast("信息收藏成功", "success");
            return true;
        } catch (error) {
            errorLog("收藏请求失败:", error);
            showToast("网络请求异常，收藏失败", "error");
            return false;
        }
    }

    async function star(onSuccess) {
        var tid = extractTid(location.href);
        var formhash = getFormHash();
        if (!tid || !formhash) { showToast("无法获取收藏参数", "error"); return; }
        var params = new URLSearchParams({ mod: "spacecp", ac: "favorite", type: "thread", id: tid, formhash: formhash });
        var success = await requestFavorite("/home.php?" + params.toString(), tid, qs("#thread_subject")?.textContent?.trim() || document.title || "");
        if (success && typeof onSuccess === "function") onSuccess();
    }

    function getCurrentThreadFavorite() {
        var tid = extractTid(location.href);
        if (!tid) return null;
        var entries = getFavoriteEntries();
        for (var i = 0; i < entries.length; i++) {
            if (getFavoriteTid(entries[i][1]) === String(tid)) return entries[i];
        }
        return null;
    }

    function removeThreadFavoriteUI() {
        qsa("#bgshThreadUnfavorite, #bgshThreadFavoriteFloat").forEach(function(el) { el.remove(); });
    }

    function renderThreadFavoriteState() {
        var favoriteButton = qs("#k_favorite");
        if (!favKeys) return;
        loadFavoriteData();
        removeThreadFavoriteUI();
        var current = getCurrentThreadFavorite();
        if (favoriteButton) favoriteButton.style.display = "none";
        var toolbarButton = qs("#quickStarButton");
        if (!toolbarButton) return;
        if (current) {
            toolbarButton.textContent = "⭐ 已收藏";
            toolbarButton.title = "取消收藏";
            toolbarButton.dataset.favorited = "1";
        } else {
            toolbarButton.textContent = "☆ 收藏主题";
            toolbarButton.title = "点击直接收藏当前主题";
            toolbarButton.dataset.favorited = "0";
        }
    }

    function initThreadFavorite() {
        if (!favKeys || !isPageType("post") || !qs("#k_favorite")) return;
        loadFavoriteData();
        renderThreadFavoriteState();
        if (typeof GM_addValueChangeListener === "function" && !BGSH.initialized.has("threadFavoriteListener")) {
            BGSH.initialized.add("threadFavoriteListener");
            var listenerID = GM_addValueChangeListener(favKeys.favs, function(key, oldValue, newValue, remote) {
                if (!remote) return;
                favCache = newValue && typeof newValue === "object" ? newValue : {};
                renderThreadFavoriteState();
            });
            BGSH.listeners.add(function() { if (typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(listenerID); });
        }
    }

    function initFavorites() {
        if (!initFavoriteStorage()) return;
        if (isPageType("post")) initThreadFavorite();
    }
    // #endregion

    // #region 帖子评分 (保持原样)
    async function getRateInfo(pid, tid, timestamp) {
        const infoDefaults = { state: false, max: 0, left: 0, formHash: "", referer: "", handleKey: "", error: "" };

        try {
            const url = `/forum.php?mod=misc&action=rate&tid=${tid}&pid=${pid}&infloat=yes&handlekey=rate&t=${timestamp}&inajax=1&ajaxtarget=fwin_content_rate`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch rate info");

            const text = await response.text();
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            const maxElement = doc.querySelector("#scoreoption8 li");
            if (!maxElement) {
                return { ...infoDefaults, error: "评分不足啦!" };
            }

            const max = parseInt(maxElement.textContent.replace("+", ""), 10);
            const left = parseInt(doc.querySelector(".dt.mbm td:last-child").textContent, 10);
            const formHash = doc.querySelector('input[name="formhash"]').value;
            const referer = doc.querySelector('input[name="referer"]').value;
            const handleKey = doc.querySelector('input[name="handlekey"]').value;

            return { state: true, max: Math.min(max, left), left, formHash, referer, handleKey, error: "" };
        } catch (error) {
            showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }

    async function gradeManual(tid, pid) {
        showWindow("rate", "forum.php?mod=misc&action=rate&tid=" + tid + "&pid=" + pid, "get", -1);
        return false;
    }

    async function grade(pid) {
        showWatermarkMessage();
        const tid = extractTid(window.location.href);
        const timestamp = new Date().getTime();
        const rateInfo = await getRateInfo(pid, tid, timestamp);

        if (!rateInfo.state) {
            showToast("❌ " + rateInfo.error, "error");
            return;
        }

        var settings = getSettings();
        var maxGradeThread = settings.maxGradeThread;
        rateInfo.max = parseInt(rateInfo.max) < parseInt(maxGradeThread) ? rateInfo.max : maxGradeThread;

        const rateUrl = "/forum.php?mod=misc&action=rate&ratesubmit=yes&infloat=yes&inajax=1";
        const data = new URLSearchParams();
        data.append("formhash", rateInfo.formHash);
        data.append("tid", tid);
        data.append("pid", pid);
        data.append("referer", rateInfo.referer);
        data.append("handlekey", rateInfo.handleKey);
        data.append("score8", "1");
        data.append("reason", settings.logoText);
        data.append("sendreasonpm", "on");

        const request = new Request(rateUrl, {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data,
        });

        try {
            const responseText = await fetch(request).then((r) => r.text());
            if (responseText.includes("感谢您的参与，现在将转入评分前页面")) {
                showToast("✅ +1 评分成功，并通知了楼主!", "success");
            } else {
                showToast("❌ 评分失败", "error");
                console.error(responseText);
            }
        } catch (error) {
            showToast("❌ 评分请求失败", "error");
            console.error(error);
        }
    }
    // #endregion

    // #region 一键二连 (保持原样)
    function gradeAndStar() {
        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);
        grade(pid);
        star();
    }
    // #endregion

    // #region 获取购买记录 (保持原样)
    async function getViewpayments(tid) {
        const infoDefaults = { state: false, dataRowCount: 0, error: "" };

        try {
            const url = `/forum.php?mod=misc&action=viewpayments&tid=${tid}&infloat=yes&handlekey=pay&inajax=1&ajaxtarget=fwin_content_pay`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch Viewpayments info");

            const text = await response.text();
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            if (htmlContent.includes("目前没有用户购买此主题")) {
                return { state: true, dataRowCount: 0, error: "" };
            }

            var table = doc.querySelector("table.list");
            if (!table) {
                return { state: true, dataRowCount: 0, error: "" };
            }
            var rows = table.querySelectorAll("tr");
            var dataRowCount = rows.length - 1;
            return { state: true, dataRowCount: dataRowCount, error: "" };
        } catch (error) {
            showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }
    // #endregion

    // #region 帖子置顶 (保持原样)
    async function getTopicadmin(fid, tid, pid) {
        const infoDefaults = { state: false, action: "", formhash: "", page: "", handlekey: "", error: "" };

        try {
            const formhash = getFormHash();
            const url = `/forum.php?mod=topicadmin&action=stickreply&fid=${fid}&tid=${tid}&handlekey=mods&infloat=yes&nopost=yes&inajax=1`;
            const data = new URLSearchParams();
            data.append("formhash", formhash);
            data.append("optgroup", "");
            data.append("operation", "");
            data.append("listextra", "");
            data.append("page", 1);
            data.append("topiclist[]", pid);

            const request = new Request(url, {
                method: "post",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: data,
            });

            const text = await fetch(request).then((r) => r.text());
            const xml = new DOMParser().parseFromString(text, "text/xml");
            const htmlContent = xml.querySelector("root").textContent;
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");

            if (htmlContent.includes("alert_error")) {
                const alertErrorElement = doc.querySelector(".alert_error");
                const scriptElements = alertErrorElement.querySelectorAll("script");
                scriptElements.forEach((script) => script.remove());
                const errorMessage = alertErrorElement.textContent.trim();
                return { ...infoDefaults, error: errorMessage };
            }

            const element = doc.querySelector("#topicadminform");
            if (!element) {
                return { ...infoDefaults, error: "提取置顶信息失败拉!" };
            }

            const action = element.getAttribute("action").replace(/amp;/g, "") + "&inajax=1";
            const newformhash = element.querySelector('input[name="formhash"]').value;
            const page = element.querySelector('input[name="page"]').value;
            const handlekey = element.querySelector('input[name="handlekey"]').value;

            return { state: true, action, formhash: newformhash, page, handlekey, error: "" };
        } catch (error) {
            showToast("❌ " + error.message, "error");
            return infoDefaults;
        }
    }

    async function topicadmin(pid, stickreply) {
        showWatermarkMessage();
        const tid = extractTid(window.location.href);
        let fid = getFidFromElement();

        if (!fid) {
            showToast("❌ 获取板块ID失败", "error");
            return;
        }

        const topicadminInfo = await getTopicadmin(fid, tid, pid);
        if (!topicadminInfo.state) {
            showToast("❌ " + topicadminInfo.error, "error");
            return;
        }

        const settings = getSettings();
        const topicadminUrl = `/${topicadminInfo.action}`;
        const data = new URLSearchParams();
        data.append("formhash", topicadminInfo.formhash);
        data.append("fid", fid);
        data.append("tid", tid);
        data.append("topiclist[]", pid);
        data.append("page", topicadminInfo.page);
        data.append("handlekey", topicadminInfo.handlekey);
        data.append("stickreply", stickreply);
        data.append("reason", settings.logoText);
        data.append("sendreasonpm", "on");

        const request = new Request(topicadminUrl, {
            method: "post",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data,
        });

        try {
            const responseText = await fetch(request).then((r) => r.text());
            if (responseText.includes("操作成功 ")) {
                showToast(stickreply == "1" ? "✅ 置顶成功!" : "✅ 取消置顶成功!", "success");
            } else {
                showToast("❌ 置顶失败", "error");
                console.error(responseText);
            }
        } catch (error) {
            showToast("❌ 置顶请求失败", "error");
            console.error(error);
        }
    }
    // #endregion

    // #region 帖子内容页功能 (保持原样)
    function createFastCopyButton() {
        return createButton("fastCopyButton", "📋 复制帖子", function () {
            var content = document.querySelector(".t_f");
            var secondContent = document.querySelectorAll(".t_f")[1];
            var resultHtml = "";
            if (content) {
                resultHtml += processContent(content);
            }
            if (secondContent && secondContent.querySelectorAll("img").length > 3) {
                resultHtml += processContent(secondContent);
            }
            if (resultHtml !== "") {
                copyToClipboard(resultHtml, () => showToast("✅ 内容已复制!", "success"));
            } else {
                showToast("❌ 复制失败: 没有找到相应内容", "error");
            }
        });
    }

    function processContent(content) {
        var html = content.innerHTML;
        var cleanedHtml = removeElementsByClass(html, ["pstatus", "tip_4"],
                                                ["font", "div", "ignore_js_op", "br", "ol", "li", "strong", "a", "i", "table", "tbody", "tr", "td", "blockquote"],
                                                ["em"]);
        cleanedHtml = removeNbspAndNewlines(cleanedHtml);
        cleanedHtml = removeElementsByIdPrefix(cleanedHtml, "attach_");
        return cleanedHtml;
    }

    function removeNbspAndNewlines(htmlString) {
        var stringWithoutNbsp = htmlString.replace(/&nbsp;/g, "");
        stringWithoutNbsp = stringWithoutNbsp.replace(/&amp;/g, "");
        stringWithoutNbsp = stringWithoutNbsp.replace(/\n+/g, "\n");
        stringWithoutNbsp = stringWithoutNbsp.replace(/\\t98t/g, "\n");
        return stringWithoutNbsp;
    }

    function removeElementsByClass(htmlString, classList, tagsToRemove, tagsToAllRemove) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlString, "text/html");

        classList.forEach(function (className) {
            var elements = doc.querySelectorAll("." + className);
            elements.forEach(function (element) {
                element.parentNode.removeChild(element);
            });
        });

        tagsToRemove.forEach(function (tagName) {
            var elements = doc.querySelectorAll(tagName);
            elements.forEach(function (element) {
                while (element.firstChild) {
                    element.parentNode.insertBefore(element.firstChild, element);
                }
                element.parentNode.removeChild(element);
            });
        });

        tagsToAllRemove.forEach(function (tagName) {
            var elements = doc.querySelectorAll(tagName);
            elements.forEach(function (element) {
                element.parentNode.removeChild(element);
            });
        });

        var imgElements = doc.querySelectorAll("img");
        imgElements.forEach(function (img) {
            var fileAttr = img.getAttribute("file");
            if (fileAttr) {
                var fileText = (fileAttr.includes("static/image") ? "" : fileAttr) + "\\t98t";
                var textNode = document.createTextNode(fileText);
                img.parentNode.replaceChild(textNode, img);
            } else {
                var srcAttr = img.getAttribute("src");
                if (srcAttr) {
                    var srcText = (srcAttr.includes("static/image") ? "" : srcAttr) + "\\t98t";
                    var textNode1 = document.createTextNode(srcText);
                    img.parentNode.replaceChild(textNode1, img);
                }
            }
        });

        return doc.body.innerHTML;
    }

    function removeElementsByIdPrefix(html, idPrefix) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const elements = doc.querySelectorAll(`[id^="${idPrefix}"]`);
        elements.forEach((element) => element.remove());
        return doc.body.innerHTML;
    }

    function createFastReplyButton() {
        return createButton("fastReplyButton", "📝 快速回复", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("reply", `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}`);
        }, "bgsh-quickReplyToPostBtn");
    }

    function createFastPMButton(pid, touid) {
        return createButton("fastPMButton", "💬 快速私信", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("sendpm",
                       `home.php?mod=spacecp&ac=pm&op=showmsg&handlekey=showmsg_${touid}&touid=${touid}&pmid=0&daterange=2&pid=${pid}&tid=${tid}`);
        }, "bgsh-fastPMButtonBtn");
    }

    function createViewRatingsButton(pid) {
        return createButton("viewRatingsButton", "⭐ 查看评分", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("viewratings", `forum.php?mod=misc&action=viewratings&tid=${tid}&pid=${pid}`);
        });
    }

    function createPayLogButton(pid) {
        return createButton("payLogButton", "💰 购买记录", function () {
            let fid = getFidFromElement();
            const tid = extractTid(window.location.href);
            showWindow("pay", `forum.php?mod=misc&action=viewpayments&tid=${tid}&pid=${pid}`);
        });
    }

    function createDownButton() {
        return createButton("downButton", "📥 下载附件", function () {
            if (document.getElementById("customModal")) return;

            const spans = document.querySelectorAll('span[id*="attach_"]');
            const lockedDivs = Array.from(document.querySelectorAll("div.locked"))
            .filter((div) => div.textContent.includes("购买"));
            const dls = Array.from(document.querySelectorAll("dl.tattl"))
            .filter((dl) => dl.querySelector("p.attnm"));

            const elements = [...spans, ...dls, ...lockedDivs];

            if (elements.length === 0) {
                showToast("ℹ️ 没有找到任何附件", "info");
                return;
            }

            const result = elements.map((el) => el.outerHTML).join("<br>");

            const modal = document.createElement("div");
            modal.id = "customModal";
            modal.style.cssText = `
                position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
                background: rgba(255,248,235,0.92); backdrop-filter: blur(20px);
                padding: 24px; border-radius: 16px;
                box-shadow: 0 32px 80px rgba(0,0,0,0.25);
                width: 80%; max-width: 600px; max-height: 80vh; overflow-y: auto;
                z-index: 100;
                border: 1px solid rgba(255,200,150,0.3);
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 20px;">${result}</div>
                <button id="closeModal" style="padding: 8px 20px; background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">关闭</button>
            `;

            document.body.appendChild(modal);
            document.getElementById("closeModal").addEventListener("click", () => modal.remove());
        });
    }

    function createCopyCodeButton() {
        return createButton("copyCodeButton", "📋 复制代码", function () {
            let allBlockCodes = document.querySelectorAll(".blockcode");
            let allTexts = [];
            allBlockCodes.forEach((blockCode) => {
                let liElements = blockCode.querySelectorAll("li");
                liElements.forEach((li) => allTexts.push(li.textContent));
            });
            let combinedText = allTexts.join("\n");
            copyToClipboard(combinedText, () => showToast("✅ 代码已复制!", "success"));
        });
    }

    function createQuickGradeButton(tid, pid) {
        return createButton("quickGradeButton", "⭐ 一键评分", () => gradeManual(tid, pid), "bgsh-quickGradeToPostBtn");
    }

    function createQuickStarButton() {
        var button = createButton("quickStarButton", "☆ 收藏主题", async function() {
            var current = getCurrentThreadFavorite();
            if (!current) {
                star(renderThreadFavoriteState);
                return;
            }
            var favid = current[0];
            if (!/^\d+$/.test(String(favid))) {
                showToast("该收藏缺少服务器编号，请在收藏夹页面取消", "warning");
                return;
            }
            button.disabled = true;
            button.textContent = "⏳ 取消中";
            if (await executeDeleteRequest(favid)) {
                delete favCache[favid];
                saveFavoriteData();
                showToast("已取消收藏", "success");
            } else {
                showToast("取消收藏失败", "error");
            }
            button.disabled = false;
            renderThreadFavoriteState();
        });
        setTimeout(renderThreadFavoriteState, 0);
        return button;
    }

    function createOneClickDoubleButton() {
        return createButton("oneClickDoubleButton", "✨ 一键二连", gradeAndStar);
    }

    function createQuickTopicadminToPostButton(post, stickreply) {
        var text = stickreply === "1" ? "📌 快速置顶" : "↗️ 取消置顶";
        return createButton("quickTopicadminToPost", text, () => {
            let pid = getTableIdFromElement(post);
            if (pid) topicadmin(pid, stickreply);
            else showToast("❌ 未找到置顶元素", "error");
        }, "bgsh-quickTopicadminToPostBtn");
    }

    function createQuickReplyEditToPostButton(post) {
        return createButton("quickReplyEditToPost", "✏️ 编辑回复", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                window.location.href = `forum.php?mod=post&action=edit&fid=${fid}&tid=${tid}&pid=${pid}`;
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-quickReplyEditToPostBtn");
    }

    function createQuickReplyToPostButton(post) {
        return createButton("quickReplyToPost", "💬 快速回复", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                showWindow("reply", `forum.php?mod=post&action=reply&fid=${fid}&tid=${tid}&repquote=${pid}`);
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-quickReplyToPostBtn");
    }

    function createSetAnswerToPostButton(post) {
        return createButton("setAnswerToPost", "✅ 最佳答案", () => {
            let pid = getTableIdFromElement(post);
            if (pid) setanswer(pid, "");
            else showToast("❌ 未找到最佳答案", "error");
        }, "bgsh-setAnswerToPostBtn");
    }

    function createQuickReportadToPostButton(post) {
        return createButton("quickReportadToPost", "🚫 广告举报", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                const tid = extractTid(window.location.href);
                showWindow("reportad", `plugin.php?id=pc_reportad&tid=${tid}&pid=${pid}`);
            } else {
                showToast("❌ 未找到举报元素", "error");
            }
        }, "bgsh-quickReportadToPostBtn");
    }

    function createQuickSupportToPostButton(post) {
        const replyAddElement = post.querySelector("a.replyadd");
        if (replyAddElement) {
            return createButton("quickSupportToPost", "👍 快速支持", async () => {
                let pid = getTableIdFromElement(post);
                if (pid) {
                    let fid = getFidFromElement();
                    const tid = extractTid(window.location.href);
                    const formHash = document.querySelector('input[name="formhash"]').value;
                    const url = `forum.php?mod=misc&action=postreview&do=support&tid=${tid}&pid=${pid}&hash=${formHash}`;
                    let response = await fetch(url);
                    let text = await response.text();
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(text, "text/html");
                    var nfl = doc.querySelector(".nfl");
                    let content = nfl.textContent.replace(/[\r\n]/g, "").split(" ")[0];
                    showToast(content, "info");
                } else {
                    showToast("❌ 未找到支持元素", "error");
                }
            }, "bgsh-QuickMiscReportBtn");
        }
        return null;
    }

    function createQuickMiscReportToPostButton(post) {
        return createButton("quickMiscReport", "🚨 快速举报", () => {
            let pid = getTableIdFromElement(post);
            if (pid) {
                let fid = getFidFromElement();
                const tid = extractTid(window.location.href);
                showWindow(`miscreport${pid}`, `misc.php?mod=report&rtype=post&rid=${pid}&tid=${tid}&fid=${fid}`);
            } else {
                showToast("❌ 未找到回复元素", "error");
            }
        }, "bgsh-QuickMiscReportBtn");
    }

    function addQuickActionToPostButton() {
        const postContainers = document.querySelectorAll(".po.hin");

        postContainers.forEach((postContainer) => {
            const existingButton = postContainer.parentNode.querySelector("#quickTopicadminToPost");
            if (existingButton) return;

            let parentTbody = postContainer.closest("tbody");
            var stickreply = parentTbody && parentTbody.querySelector('img[src="static/image/common/settop.png"]') ? "0" : "1";

            const quickTopicadminToPostButton = createQuickTopicadminToPostButton(postContainer, stickreply);
            const replyToPostButton = createQuickReplyToPostButton(postContainer);
            const quickSupportToPostButton = createQuickSupportToPostButton(postContainer);
            const quickMiscReportToPostButton = createQuickMiscReportToPostButton(postContainer);
            const quickReportadToPostButton = createQuickReportadToPostButton(postContainer);
            const setAnswerToPostButton = createSetAnswerToPostButton(postContainer);

            postContainer.appendChild(replyToPostButton);
            postContainer.appendChild(quickTopicadminToPostButton);
            postContainer.appendChild(quickMiscReportToPostButton);
            postContainer.appendChild(quickReportadToPostButton);
            if (quickSupportToPostButton) postContainer.appendChild(quickSupportToPostButton);

            const found = postContainer.querySelector(".editp");
            if (found) {
                const quickReplyEditToPostButton = createQuickReplyEditToPostButton(postContainer);
                postContainer.appendChild(quickReplyEditToPostButton);
            }
            if (postContainer && postContainer.innerHTML.includes("setanswer(")) {
                postContainer.appendChild(setAnswerToPostButton);
            }
        });
    }

    function showAvatarEvent() {
        const avatars = document.querySelectorAll(".avatar");
        const isPostPage = () => /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(window.location.href);
        if (!isPostPage()) return;

        var settings = getSettings();
        avatars.forEach((avatar) => {
            avatar.style.display = settings.showAvatar ? "block" : "none";
        });
    }

    async function replacePMonPost() {
        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);

        document.querySelectorAll('[class*="pm2"]').forEach((element) => {
            const anchor = element.querySelector("a");
            if (anchor) {
                const href = anchor.getAttribute("href");
                const urlParams = new URLSearchParams(href);
                const touid = urlParams.get("touid");

                if (touid) {
                    const newButton = createFastPMButton(pid, touid);
                    if (element.nextSibling) {
                        element.parentNode.insertBefore(newButton, element.nextSibling);
                    } else {
                        element.parentNode.appendChild(newButton);
                    }
                }
            }
            element.remove();
        });
    }

    function appendTitleFromHotImage() {
        const regex = /static\/image\/common\/hot_\d+\.gif/;
        const images = Array.from(document.querySelectorAll("img")).filter((img) => regex.test(img.src));

        images.forEach((image) => {
            const titleContent = image.title;
            const threadSubjectSpans = document.querySelectorAll("#thread_subject");
            threadSubjectSpans.forEach((threadSubjectSpan) => {
                const uniqueId = `hotTitle-appendTitleFromHotImage`;
                if (!threadSubjectSpan.parentNode.querySelector(`#${uniqueId}`)) {
                    const newSpan = document.createElement("span");
                    newSpan.id = uniqueId;
                    newSpan.textContent = ` [${titleContent}]`;
                    newSpan.style.color = "red";
                    threadSubjectSpan.parentNode.insertBefore(newSpan, threadSubjectSpan.nextSibling);
                }
            });
        });
    }

    async function appendBuyNumber() {
        const divPt = document.getElementById("pt");
        if (!divPt) return;

        const forumTexts = ["fid=166", "fid=97", "forum-166", "forum-97"];
        let found = false;
        const textContent = divPt.innerHTML;
        forumTexts.forEach((text) => { if (textContent.includes(text)) found = true; });

        if (found) {
            var href = window.location.href;
            var tid = extractTid(href);
            if (tid) {
                var buyInfo = await getViewpayments(tid);
                if (buyInfo.state) {
                    var dataRowCount = buyInfo.dataRowCount;
                    const threadSubjectSpans = document.querySelectorAll("#thread_subject");
                    threadSubjectSpans.forEach((threadSubjectSpan) => {
                        const uniqueId = `buynum-appendBuyNumber`;
                        if (!threadSubjectSpan.parentNode.querySelector(`#${uniqueId}`)) {
                            const newSpan = document.createElement("span");
                            newSpan.id = uniqueId;
                            newSpan.textContent = `  [购买${dataRowCount}次]`;
                            newSpan.style.color = "red";
                            threadSubjectSpan.parentNode.insertBefore(newSpan, threadSubjectSpan.nextSibling);
                        }
                    });
                }
            }
        }
    }

    function removeFastReply() {
        document.querySelectorAll("#f_pst").forEach((element) => element.remove());
    }

    function handlePostPage(settings, buttonContainer) {
        const toggleImages = (action) => {
            const images = document.querySelectorAll("img.zoom");
            images.forEach((img) => img.style.display = action === "hide" ? "none" : "");
        };

        toggleImages(settings.showImageButton);
        const initialButtonText = settings.showImageButton === "show" ? "🙈 隐藏图片" : "👀 显示图片";

        const toggleButton = createButton("toggleImageDisplay", initialButtonText, function () {
            if (toggleButton.innerText === "👀 显示图片") {
                toggleImages("show");
                toggleButton.innerText = "🙈 隐藏图片";
                GM_setValue("showImageButton", "show");
            } else {
                toggleImages("hide");
                toggleButton.innerText = "👀 显示图片";
                GM_setValue("showImageButton", "hide");
            }
        });
        buttonContainer.appendChild(toggleButton);

        if (settings.showDown) buttonContainer.appendChild(createDownButton());

        let codeBlocks = document.querySelectorAll(".blockcode");
        if (codeBlocks.length > 0 && settings.showCopyCode) {
            buttonContainer.appendChild(createCopyCodeButton());
        }

        let firstPobClElement = document.querySelector(".po.hin");
        let pid = getTableIdFromElement(firstPobClElement);
        const userid = getUserId();

        if (userid) {
            if (settings.showFastPost) buttonContainer.appendChild(createFastPostButton());
            if (settings.showFastReply) buttonContainer.appendChild(createFastReplyButton());
            if (settings.showQuickGrade) {
                const tid = extractTid(window.location.href);
                buttonContainer.appendChild(createQuickGradeButton(tid, pid));
            }
            if (settings.showQuickStar) buttonContainer.appendChild(createQuickStarButton());
            if (settings.showClickDouble) buttonContainer.appendChild(createOneClickDoubleButton());
            addQuickActionToPostButton();
        }

        if (settings.showViewRatings) buttonContainer.appendChild(createViewRatingsButton(pid));
        if (settings.showPayLog) buttonContainer.appendChild(createPayLogButton(pid));
        if (settings.showFastCopy) buttonContainer.appendChild(createFastCopyButton());

        if (settings.defaultSwipeToSearch) {
            document.addEventListener("mouseup", selectSearch);
        }

        initInfiniteScroll("isPostPage");
        showAvatarEvent();
        replacePMonPost();
        removeFastReply();
        appendTitleFromHotImage();
        appendBuyNumber();
    }
    // #endregion

    // #region 帖子列表页功能 (保持原样)
    function createFastPostButton() {
        return createButton("fastPostButton", "✏️ 快速发帖", function () {
            let fid = getFidFromElement();
            showWindow("newthread", `forum.php?mod=post&action=newthread&fid=${fid}`);
        });
    }

    function removeFastPost() {
        document.querySelectorAll("#f_pst").forEach((element) => element.remove());
    }

    function createDateInput(id, defaultValue = new Date().toISOString().split("T")[0]) {
        const input = document.createElement("input");
        input.type = "date";
        input.id = id;
        input.value = defaultValue;
        input.className = "bgsh-dateInput";
        input.style.cssText = "padding: 6px 10px; border: 2px solid rgba(0,0,0,0.06); border-radius: 8px; font-size: 13px; background: rgba(255,248,235,0.5); backdrop-filter: blur(4px); color: #4a2e1b;";
        return input;
    }

    function addDateRangeSelectorAndButton(targetElementOrId) {
        const refElement = typeof targetElementOrId === "string" ? document.getElementById(targetElementOrId) : targetElementOrId;
        if (!refElement) return;

        const startDateInput = createDateInput("startDateSelector");
        const endDateInput = createDateInput("endDateSelector");

        const openButton = createButton("openAllUrlButton", "📂 批量打开", () => filterAndOpenThreadsByDate(),
                                        "bgsh-openAllUrlBtn");

        refElement.after(openButton);
        refElement.after(endDateInput);
        refElement.after(document.createTextNode("到"));
        refElement.after(startDateInput);
    }

    function filterAndOpenThreadsByDate() {
        const startDateValue = document.getElementById("startDateSelector").value;
        const endDateValue = document.getElementById("endDateSelector").value;
        const startDate = new Date(startDateValue);
        const endDate = new Date(endDateValue);

        const posts = document.querySelectorAll("#threadlisttableid tbody tr");

        posts.forEach((post) => {
            const spanSpanElement = post.querySelector("td.by em span span");
            const spanElement = post.querySelector("td.by em span");
            let postDateStr = "";
            if (spanSpanElement) {
                postDateStr = spanSpanElement.getAttribute("title");
            } else if (spanElement) {
                postDateStr = spanElement.textContent;
            }

            if (postDateStr) {
                const postDate = new Date(postDateStr);
                if (postDate >= startDate && postDate <= endDate) {
                    const linkElement = post.querySelector(".s.xst");
                    if (linkElement) window.open(linkElement.href, "_blank");
                }
            }
        });
    }

    function cleanupDuplicateThreadPreviews() {
        const checkedParents = new Set();
        document.querySelectorAll('.bgsh-pt').forEach(function(box) {
            const parent = box.parentElement;
            if (!parent || checkedParents.has(parent)) return;
            checkedParents.add(parent);
            const boxes = Array.from(parent.children).filter(function(child) {
                return child.classList && child.classList.contains('bgsh-pt');
            });
            boxes.slice(1).forEach(function(duplicate) { duplicate.remove(); });
        });
    }

    function getThreadPreviewState() {
        return window.__98t_preview_state || (window.__98t_preview_state = {});
    }

    function getPreviewColumnCount(imageCount) {
        var count = Math.max(1, parseInt(imageCount, 10) || 1);
        if (count === 4) return 2;
        return Math.min(3, count);
    }

    function applyThreadPreviewLayout(box) {
        if (!box) return;
        var imageCount = box.querySelectorAll(":scope > img").length;
        if (!imageCount) return;
        var columns = getPreviewColumnCount(imageCount);
        var size = getPreviewSize();
        box.dataset.bgshPreviewCount = String(imageCount);
        box.dataset.bgshPreviewColumns = String(columns);
        box.style.display = "grid";
        var totalGap = Math.max(0, columns - 1) * 4;
        var responsiveSize = "min(var(--bgsh-preview-size, " + size + "px), calc((100% - " + totalGap + "px) / " + columns + "))";
        box.style.gridTemplateColumns = "repeat(" + columns + ", minmax(0, " + responsiveSize + "))";
        box.style.gridAutoFlow = "row";
        box.style.justifyContent = "start";
        box.style.alignItems = "start";
    }

    async function displayThreadImages(settings) {
        if (!settings.displayThreadImages) return;
        cleanupDuplicateThreadPreviews();
        const cache = getThreadPreviewState();
        const wantedPreviewCount = Math.max(1, Math.min(12, parseInt(settings.threadPreviewCount, 10) || 3));

        // Find thread rows
        const rows = [];
        const thMap = new Map();

        document.querySelectorAll('#threadlisttableid > tbody[id^="normalthread_"], .tl > tbody[id^="normalthread_"]').forEach(tbody => {
            const link = tbody.querySelector('a.xst, a[href*="thread-"]');
            const tid = (tbody.id || '').replace('normalthread_', '') || (link?.href || '').match(/thread-(\d+)/i)?.[1] || '';
            const titleCell = tbody.querySelector('th.new, th.common, th');
            if (tid && link && titleCell) {
                rows.push({ tbody, link, tid, titleCell });
                thMap.set(tid, titleCell);
            }
        });

        // Fallback: find .s.xst links directly
        if (!rows.length) {
            document.querySelectorAll('.s.xst').forEach(link => {
                const tid = (link.href || '').match(/thread-(\d+)/i)?.[1] || (link.href || '').match(/tid=(\d+)/)?.[1];
                const titleCell = link.closest('th') || link.parentElement?.closest('th');
                const tbody = link.closest('tbody');
                if (tid && titleCell && tbody) {
                    rows.push({ tbody, link, tid, titleCell });
                    thMap.set(tid, titleCell);
                }
            });
        }

        if (!rows.length) return;

        // Insert preview as a full-width row (spans title/author/reply/view/last post columns)
        function insertFullWidthPreview(tbody, box) {
            if (!tbody || !box) return;
            const old = tbody.querySelector('.bgsh-full-preview-row');
            if (old) old.remove();
            const tr = document.createElement('tr');
            tr.className = 'bgsh-full-preview-row';
            const td = document.createElement('td');
            const cols = Array.from(tbody.querySelectorAll('tr:first-child > th, tr:first-child > td')).reduce((n, c) => {
                return n + (parseInt(c.getAttribute('colspan'), 10) || 1);
            }, 0);
            td.colSpan = Math.max(4, cols || 4);
            td.style.padding = '4px 8px';
            td.appendChild(box);
            tr.appendChild(td);
            const firstRow = tbody.querySelector('tr');
            if (firstRow) firstRow.insertAdjacentElement('afterend', tr);
            else tbody.appendChild(tr);
        }

        // Load from GM cache
        let gmc = {};
        try { gmc = JSON.parse(GM_getValue('bgsh_preview_cache', '{}')); } catch(e) {}
        for (const k in gmc) { if (Date.now() - (gmc[k].ts||0) > 86400000) delete gmc[k]; }

        const toFetch = [];
        rows.forEach(({ tid, link, titleCell }) => {
            if (cache[tid] === 'loading' || cache[tid] === 'rendered') return;
            if (titleCell.querySelector('.bgsh-pt')) {
                cache[tid] = 'rendered';
                return;
            }

            if (gmc[tid] && gmc[tid].imgs && gmc[tid].imgs.length &&
                ((gmc[tid].limit || 3) >= wantedPreviewCount || gmc[tid].imgs.length >= wantedPreviewCount)) {
                const box = document.createElement('div');
                box.className = 'bgsh-pt';
                box.dataset.bgshPreviewTid = tid;
                box.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:flex-start;';
                gmc[tid].imgs.slice(0, wantedPreviewCount).forEach(u => { const img = mkThumb(u); if (img) box.appendChild(img); });
                applyThreadPreviewLayout(box);
                insertFullWidthPreview(rows.find(r => r.titleCell === titleCell)?.tbody, box);
                cache[tid] = 'rendered';
            } else if (!gmc[tid] || (gmc[tid].limit || 3) < wantedPreviewCount) {
                cache[tid] = 'loading';
                toFetch.push({ tid, href: link.href, titleCell });
            } else {
                cache[tid] = 'rendered';
            }
        });

        if (!toFetch.length) return;

        for (let i = 0; i < toFetch.length; i += 8) {
            await Promise.all(toFetch.slice(i, i + 8).map(async ({ tid, href, titleCell }) => {
                try {
                    const r = await fetch(href, { signal: AbortSignal.timeout(5000) });
                    const html = await r.text();
                    if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) {
                        delete cache[tid];
                        return;
                    }
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const post = doc.querySelector('.t_f, [id^="postmessage_"], .pcb, .message');
                    const imgs = [];
                    if (post) {
                        post.querySelectorAll('img').forEach(el => {
                            const u = el.getAttribute('file') || el.getAttribute('zoomfile') || el.getAttribute('src') || '';
                            if (u && !u.includes('static') && !u.includes('avatar') && !u.includes('smiley') && /.(jpe?g|png|gif|webp)/i.test(u)) {
                                const abs = new URL(u, location.href).href;
                                if (!imgs.includes(abs)) imgs.push(abs);
                            }
                        });
                    }
                    const result = imgs.slice(0, wantedPreviewCount);
                    gmc[tid] = { imgs: result, ts: Date.now(), limit: wantedPreviewCount };
                    GM_setValue('bgsh_preview_cache', JSON.stringify(gmc));
                    if (result.length && !titleCell.querySelector('.bgsh-pt')) {
                        const box = document.createElement('div');
                        box.className = 'bgsh-pt';
                        box.dataset.bgshPreviewTid = tid;
                        box.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;align-items:flex-start;';
                        result.forEach(u => box.appendChild(mkThumb(u)));
                        applyThreadPreviewLayout(box);
                        insertFullWidthPreview(rows.find(r => r.titleCell === titleCell)?.tbody, box);
                    }
                    cache[tid] = 'rendered';
                } catch(e) {
                    delete cache[tid];
                }
            }));
        }

        function mkThumb(url) {
            const ps = getPreviewSize();
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy';
            img.style.cssText = 'display:block;width:auto;max-width:min(100%,' + ps + 'px);height:auto;max-height:' + ps + 'px;border-radius:4px;cursor:pointer;object-fit:contain;border:1px solid rgba(0,0,0,.08);margin:0;box-sizing:border-box;';
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                const ov = document.createElement('div');
                ov.className = 'bgsh-image-overlay';
                const ci = document.createElement('img');
                ci.src = url;
                ov.appendChild(ci);
                ov.addEventListener('click', () => ov.remove());
                document.body.appendChild(ov);
            });
            return img;
        }
    }

    async function displayThreadBuyInfo(settings) {
        if (!settings.displayThreadBuyInfo) return;

        var links = document.querySelectorAll("a.s.xst");
        links.forEach(async function (link) {
            var href = link.href;
            var tid = extractTid(href);

            if (tid) {
                var buyInfo = await getViewpayments(tid);
                if (buyInfo.state) {
                    var dataRowCount = buyInfo.dataRowCount;
                    const existingSpan = link.parentNode.querySelector("#t98tbuyinfouniqueSpanId");
                    if (!existingSpan) {
                        const span = document.createElement("span");
                        span.id = "t98tbuyinfouniqueSpanId";
                        span.style.cssText = "font-size: larger; font-weight: bold; color: red;";
                        span.textContent = ` [购买${dataRowCount}次]`;
                        if (settings.enableTitleStyle) {
                            span.style.fontSize = `${settings.titleStyleSize}px`;
                        }
                        link.parentNode.insertBefore(span, link.nextSibling);
                    }
                }
            }
        });
    }

    async function displayThreadBuyInfoOther(settings) {
        if (!settings.displayThreadBuyInfo) return;

        var thElements = document.querySelectorAll("th");
        thElements.forEach(async (th) => {
            var aElement = th.querySelector("a");
            if (aElement) {
                var nextTd = th.nextElementSibling;
                if (nextTd && nextTd.tagName === "TD") {
                    var tdLink = nextTd.querySelector("a");
                    if (tdLink && /fid=166|fid=97|forum-166|forum-97/.test(tdLink.href)) {
                        var href = aElement.href;
                        var tid = extractTid(href);
                        if (tid) {
                            var buyInfo = await getViewpayments(tid);
                            if (buyInfo.state) {
                                var dataRowCount = buyInfo.dataRowCount;
                                const existingSpan = aElement.parentNode.querySelector("#t98tbuyinfouniqueSpanId");
                                if (!existingSpan) {
                                    const span = document.createElement("span");
                                    span.id = "t98tbuyinfouniqueSpanId";
                                    span.style.cssText = "font-size: larger; font-weight: bold; color: red;";
                                    span.textContent = ` [购买${dataRowCount}次]`;
                                    aElement.parentNode.insertBefore(span, aElement.nextSibling);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async function displayAdvanThreadImages(settings) {
        if (!settings.displayThreadImages) return;
        cleanupDuplicateThreadPreviews();
        const cache = getThreadPreviewState();
        const wantedPreviewCount = Math.max(1, Math.min(12, parseInt(settings.threadPreviewCount, 10) || 3));
        let retries = 0;
        const maxRetries = 3;
        const previewPageURL = new URL(location.href);
        const isMyPostsPreviewPage =
              (previewPageURL.pathname.toLowerCase().endsWith("/home.php") &&
               previewPageURL.searchParams.get("do") === "thread") ||
              (previewPageURL.searchParams.get("mod") === "guide" &&
               previewPageURL.searchParams.get("view") === "my");
        const isFavoriteListPreviewPage =
              (previewPageURL.pathname.toLowerCase().endsWith("/home.php") &&
               previewPageURL.searchParams.get("mod") === "space" &&
               previewPageURL.searchParams.get("do") === "favorite") ||
              (previewPageURL.pathname.toLowerCase().endsWith("/home.php") &&
               previewPageURL.searchParams.get("mod") === "spacecp" &&
               previewPageURL.searchParams.get("ac") === "favorite") ||
              !!document.querySelector('[id^="favorite_"], .favorite-list, #favorite, .favorite');
        const isSpecialTablePreviewPage = isMyPostsPreviewPage || isFavoriteListPreviewPage;

        function resolveAdvancedPreviewParent(el, tid) {
            if (isSpecialTablePreviewPage) {
                if (isFavoriteListPreviewPage) {
                    var listItem = el.closest("li");
                    if (listItem && listItem.parentNode) {
                        var existingLiHost = listItem.parentNode.querySelector(
                            '[data-bgsh-preview-host-tid="' + tid + '"]'
                        );
                        if (existingLiHost) return existingLiHost;

                        var liPreviewRow = document.createElement("div");
                        liPreviewRow.className = "bgsh-favorite-preview-row bgsh-favorite-preview-li-row";
                        liPreviewRow.dataset.bgshPreviewRowTid = tid;
                        var liHost = document.createElement("div");
                        liHost.className = "bgsh-favorite-preview-host";
                        liHost.dataset.bgshPreviewHostTid = tid;
                        liPreviewRow.appendChild(liHost);
                        listItem.insertAdjacentElement("afterend", liPreviewRow);
                        return liHost;
                    }
                }

                var tableRow = el.closest("tr");
                if (tableRow && tableRow.parentNode) {
                    var existingHost = tableRow.parentNode.querySelector(
                        '[data-bgsh-preview-host-tid="' + tid + '"]'
                    );
                    if (existingHost) return existingHost;

                    var previewRow = document.createElement("tr");
                    previewRow.className = isFavoriteListPreviewPage ? "bgsh-favorite-preview-row" : "bgsh-my-post-preview-row";
                    previewRow.dataset.bgshPreviewRowTid = tid;
                    var previewCell = document.createElement("td");
                    var totalColumns = Array.from(tableRow.children).reduce(function(total, cell) {
                        return total + (parseInt(cell.getAttribute("colspan"), 10) || 1);
                    }, 0);
                    previewCell.colSpan = Math.max(1, totalColumns);
                    var host = document.createElement("div");
                    host.className = isFavoriteListPreviewPage ? "bgsh-favorite-preview-host" : "bgsh-my-post-preview-host";
                    host.dataset.bgshPreviewHostTid = tid;
                    previewCell.appendChild(host);
                    previewRow.appendChild(previewCell);
                    tableRow.insertAdjacentElement("afterend", previewRow);
                    return host;
                }
            }
            return el.closest('.pbw') ||
                el.closest('li') ||
                el.closest('th') ||
                el.closest('td') ||
                el.closest('.thread-item, .thread, .content') ||
                el.parentElement;
        }

        function removeEmptyMyPostsPreview(parent) {
            if (!isSpecialTablePreviewPage || !parent || parent.querySelector('.bgsh-pt')) return;
            var row = parent.closest(".bgsh-my-post-preview-row, .bgsh-favorite-preview-row");
            if (row) row.remove();
        }

        // Helper: extract TID from any URL format
        function getTid(href) {
            if (!href) return '';
            const m = href.match(/thread-(\d+)/i) || href.match(/tid=(\d+)/);
            return m ? m[1] : '';
        }

        async function tryLoad() {
            // Find ALL thread-related links: both thread-xxx and ?tid=xxx formats
            const links = new Map();

            document.querySelectorAll('a[href*="thread-"], a[href*="tid="], a[href*="viewthread"]').forEach(a => {
                const tid = getTid(a.href);
                if (!tid || links.has(tid)) return;
                const text = (a.textContent || '').trim();
                if (!text || text.length < 3) return;
                links.set(tid, { href: a.href, el: a });
            });

            if (!links.size) {
                if (retries < maxRetries) {
                    retries++;
                    await new Promise(r => setTimeout(r, 1000));
                    return tryLoad();
                }
                return;
            }

            // GM cache
            let gmc = {};
            try { gmc = JSON.parse(GM_getValue('bgsh_preview_cache', '{}')); } catch(e) {}
            for (const k in gmc) { if (Date.now() - (gmc[k].ts||0) > 86400000) delete gmc[k]; }

            const toFetch = [];
            links.forEach(({ href, el }, tid) => {
                // Find parent for preview insertion
                if (cache[tid] === 'loading' || cache[tid] === 'rendered') return;
                let parent = resolveAdvancedPreviewParent(el, tid);
                if (!parent) return;
                if (parent.querySelector('.bgsh-pt')) {
                    cache[tid] = 'rendered';
                    return;
                }

                if (gmc[tid] && gmc[tid].imgs && gmc[tid].imgs.length &&
                    ((gmc[tid].limit || 3) >= wantedPreviewCount || gmc[tid].imgs.length >= wantedPreviewCount)) {
                    var box = document.createElement('div');
                    box.className = 'bgsh-pt';
                    box.dataset.bgshPreviewTid = tid;
                    box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:flex-start;justify-content:flex-start;width:100%;clear:both;box-sizing:border-box;';
                    gmc[tid].imgs.slice(0, wantedPreviewCount).forEach(function(u) { var img = mkThumb(u); if (img) box.appendChild(img); });
                    applyThreadPreviewLayout(box);
                    parent.appendChild(box);
                    cache[tid] = 'rendered';
                } else if (!gmc[tid] || (gmc[tid].limit || 3) < wantedPreviewCount) {
                    cache[tid] = 'loading';
                    toFetch.push({ tid, href, parent });
                } else {
                    cache[tid] = 'rendered';
                    removeEmptyMyPostsPreview(parent);
                }
            });

            if (!toFetch.length) return;

            for (let i = 0; i < toFetch.length; i += 6) {
                await Promise.all(toFetch.slice(i, i + 6).map(async ({ tid, href, parent }) => {
                    try {
                        const r = await fetch(href, { signal: AbortSignal.timeout(5000) });
                        const html = await r.text();
                        if (/过于?频繁|间隔.*秒|请稍后/i.test(html)) {
                            delete cache[tid];
                            removeEmptyMyPostsPreview(parent);
                            return;
                        }
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const post = doc.querySelector('.t_f, [id^="postmessage_"], .pcb, .message');
                        if (!post) {
                            delete cache[tid];
                            removeEmptyMyPostsPreview(parent);
                            return;
                        }
                        const imgs = [];
                        post.querySelectorAll('img').forEach(el => {
                            const u = el.getAttribute('file') || el.getAttribute('zoomfile') || el.getAttribute('src') || '';
                            if (u && !u.includes('static') && !u.includes('avatar') && !u.includes('smiley') && /.(jpe?g|png|gif|webp)/i.test(u)) {
                                const abs = new URL(u, location.href).href;
                                if (!imgs.includes(abs)) imgs.push(abs);
                            }
                        });
                        const result = imgs.slice(0, wantedPreviewCount);
                        gmc[tid] = { imgs: result, ts: Date.now(), limit: wantedPreviewCount };
                        GM_setValue('bgsh_preview_cache', JSON.stringify(gmc));
                        if (result.length && !parent.querySelector('.bgsh-pt')) {
                            var box = document.createElement('div');
                            box.className = 'bgsh-pt';
                            box.dataset.bgshPreviewTid = tid;
                            box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:flex-start;justify-content:flex-start;width:100%;clear:both;box-sizing:border-box;';
                            result.forEach(function(u) { box.appendChild(mkThumb(u)); });
                            applyThreadPreviewLayout(box);
                            parent.appendChild(box);
                        } else if (!result.length) {
                            removeEmptyMyPostsPreview(parent);
                        }
                        cache[tid] = 'rendered';
                    } catch(e) {
                        delete cache[tid];
                        removeEmptyMyPostsPreview(parent);
                    }
                }));
            }

            function mkThumb(url) {
                var ps = getPreviewSize();
                var img = document.createElement('img');
                img.src = url;
                img.loading = 'lazy';
                img.style.cssText = 'display:block;width:auto;max-width:min(100%,' + ps + 'px);height:auto;max-height:' + ps + 'px;border-radius:8px;cursor:pointer;object-fit:contain;border:1px solid #eaeaea;box-sizing:border-box;';
                img.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var ov = document.createElement('div');
                    ov.className = 'bgsh-image-overlay';
                    var ci = document.createElement('img');
                    ci.src = url;
                    ov.appendChild(ci);
                    ov.addEventListener('click', function() { ov.remove(); });
                    document.body.appendChild(ov);
                });
                return img;
            }
        }

        await tryLoad();

        // MutationObserver for dynamically loaded results
        if (!window.__bgshSearchObserver) {
            window.__bgshSearchObserver = new MutationObserver(() => {
                const existing = document.querySelectorAll('.bgsh-pt').length;
                const newLinks = document.querySelectorAll('a[href*="thread-"], a[href*="tid="], a[href*="viewthread"]').length;
                if (newLinks > existing + 3) tryLoad();
            });
            const root = document.querySelector('.searchresult, #threadlist, .tl, .bm_c, .mainbox, #favorite, .favorite-list, .favorite') || document.body;
            window.__bgshSearchObserver.observe(root, { childList: true, subtree: true });
        }
    }

    async function blockingResolvedAction(settings) {
        if (settings.blockingResolved) {
            const tbodies = document.querySelectorAll("tbody");
            tbodies.forEach((tbody) => {
                if (tbody.textContent.includes("[已解决]")) {
                    tbody.remove();
                }
            });
        }
    }

    async function isOnlyShowMoneyAction(settings) {
        if (!settings.isOnlyShowMoney) return;

        const tbodies = document.querySelectorAll("tbody");
        const keywords = ["E卡", "e卡", "话费"];
        const excludedSelectors = ["#scbar_txt", "#scbar_btn", "#scbar_type"];

        tbodies.forEach((tbody) => {
            const isExcluded = excludedSelectors.some((selector) => tbody.querySelector(selector));
            if (isExcluded) return;

            const containsKeyword = keywords.some((keyword) => tbody.textContent.includes(keyword));
            if (!containsKeyword) tbody.remove();
        });
    }

    async function handleForumDisplayPage(settings, buttonContainer) {
        if (settings.enableTitleStyle) stylePosts(settings);

        removeFastPost();
        const currentURL = window.location.href;
        const queryParams = getQueryParams(currentURL);
        const fid = queryParams.fid;

        if (fid == 143 || fid == "143") {
            blockingResolvedAction(settings);
            isOnlyShowMoneyAction(settings);

            const blockingResolvedText = settings.blockingResolved == true ? "✅ 显示解决" : "🚫 屏蔽解决";
            const blockingResolvedButton = createButton("blockingResolvedBtn", blockingResolvedText, function () {
                if (blockingResolvedButton.innerText === "✅ 显示解决") {
                    blockingResolvedButton.innerText = "🚫 屏蔽解决";
                    GM_setValue("blockingResolved", false);
                    location.reload();
                } else {
                    blockingResolvedButton.innerText = "✅ 显示解决";
                    GM_setValue("blockingResolved", true);
                    location.reload();
                }
            });
            buttonContainer.appendChild(blockingResolvedButton);

            const isOnlyShowMoneyText = settings.isOnlyShowMoney == true ? "📋 显示全部" : "💵 只看现金";
            const isOnlyShowMoneyButton = createButton("isOnlyShowMoneyBtn", isOnlyShowMoneyText, function () {
                if (isOnlyShowMoneyButton.innerText === "📋 显示全部") {
                    isOnlyShowMoneyButton.innerText = "💵 只看现金";
                    GM_setValue("isOnlyShowMoney", false);
                    location.reload();
                } else {
                    isOnlyShowMoneyButton.innerText = "📋 显示全部";
                    GM_setValue("isOnlyShowMoney", true);
                    location.reload();
                }
            });
            buttonContainer.appendChild(isOnlyShowMoneyButton);
        }

        if (fid == 166 || fid == "166" || fid == 97 || fid == "97") {
            await displayThreadBuyInfo(settings);
        }

        const userid = getUserId();
        if (userid && settings.showFastPost) {
            buttonContainer.appendChild(createFastPostButton());
        }

        // Sort button
        buttonContainer.appendChild(createSortButton());
        preserveNativePaginationSort();

        const targetElement = document.querySelector(".xs1.xw0.i");
        setTimeout(() => displayThreadImages(settings), 350);
        addDateRangeSelectorAndButton(targetElement);
        initInfiniteScroll("isForumDisplayPage");
    }

    function createSortButton() {
        const currentURL = window.location.href;
        let currentOrder = 'lastpost';
        const om = currentURL.match(/orderby=(\w+)/);
        if (om) currentOrder = om[1];

        const labels = { lastpost: '🕐 按回复时间', dateline: '📅 按发布时间' };
        const nextOrder = currentOrder === 'lastpost' ? 'dateline' : 'lastpost';

        const btn = createButton('sortTimeBtn', labels[currentOrder] || '🕐 按回复时间', function() {
            const url = new URL(window.location.href);
            url.searchParams.set('orderby', nextOrder);
            url.searchParams.set('ascdesc', 'desc');
            window.location.href = url.toString();
        });
        return btn;
    }

    function preserveNativePaginationSort() {
        var current;
        try {
            current = new URL(window.location.href);
        } catch (error) {
            return;
        }
        var orderby = current.searchParams.get("orderby");
        if (orderby !== "dateline" && orderby !== "lastpost") return;

        var inheritedParams = [
            "orderby", "ascdesc", "filter", "dateline", "specialtype",
            "typeid", "digest", "recommend"
        ];
        var rewriteLink = function(link) {
            if (!link || !link.getAttribute("href") || /^javascript:/i.test(link.getAttribute("href"))) return;
            try {
                var target = new URL(link.getAttribute("href"), location.href);
                inheritedParams.forEach(function(name) {
                    var value = current.searchParams.get(name);
                    if (value !== null) target.searchParams.set(name, value);
                });
                link.href = target.href;
            } catch (error) {}
        };

        document.querySelectorAll(".pg a[href], .pgs a[href]").forEach(rewriteLink);

        if (document.documentElement.dataset.bgshNativeSortGuard === "1") return;
        document.documentElement.dataset.bgshNativeSortGuard = "1";
        document.addEventListener("click", function(event) {
            var link = event.target.closest && event.target.closest(".pg a[href], .pgs a[href]");
            if (link) rewriteLink(link);
        }, true);
    }

    function addPageNumbers() {
        const sourceElement = document.querySelector(".pgs.cl.mbm");
        const targetElement = document.querySelector(".slst.mtw");

        if (!sourceElement) {
            console.error("源元素未找到！");
            return;
        }
        if (!targetElement) {
            console.error("目标元素未找到！");
            return;
        }

        const parentElement = targetElement.parentElement;
        if (!parentElement) return;

        const clonedElement = sourceElement.cloneNode(true);
        parentElement.insertBefore(clonedElement, targetElement);
    }

    function replaceImageSrc() {
        window.addEventListener("load", function () {
            document.querySelectorAll('img[src="static/image/common/logo_sc_s.png"]').forEach(function (img) {
                img.src = "static/image/common/logo.png";
            });
        });
    }
    // #endregion

    // #region 搜索功能 (4.7 - 全站板块分类、常用板块与原生搜索)
    function escapeSearchHtml(value) {
        return String(value).replace(/[&<>"']/g, function(char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function cleanBoardName(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .replace(/[（(]\s*\d+\s*[)）]\s*$/, "")
            .trim();
    }

    function extractBoardFid(href) {
        if (!href) return null;
        var match = String(href).match(/[?&]fid=(\d+)|\/forum-(\d+)-\d+\.html|forum-(\d+)-\d+\.html/i);
        var value = match && (match[1] || match[2] || match[3]);
        return value ? parseInt(value, 10) : null;
    }

    function getBoardLinkGroupName(link) {
        var section = link.closest("[id^='category_'], .bm.fl, .fl.bm, .bm");
        if (!section) return "网站其他板块";
        var heading = section.querySelector(".bm_h h2, .bm_h h1, .fl_tb h2, .xs2 a, .xw1");
        var text = cleanBoardName(heading && heading.textContent);
        return text && text.length < 40 ? text : "网站其他板块";
    }

    function readSearchBoardJson(key, fallback) {
        try {
            var value = JSON.parse(GM_getValue(key, JSON.stringify(fallback)));
            return value && typeof value === "object" ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getAllRecognizedBoardFids() {
        var all = new Set();
        SEARCH_BOARD_GROUPS.forEach(function(group) {
            (group.fids || []).forEach(function(fid) {
                fid = parseInt(fid, 10);
                if (fid) all.add(fid);
            });
        });
        return all;
    }

    function getManualCommonBoards() {
        return readSearchBoardJson("bgshCommonBoardsV47", []).map(function(fid) {
            return parseInt(fid, 10);
        }).filter(Boolean);
    }

    function getCommonBoardFids(limit) {
        var available = getAllRecognizedBoardFids();
        var manual = getManualCommonBoards();
        var usage = readSearchBoardJson("bgshBoardUsageV47", {});
        var result = [];
        manual.forEach(function(fid) {
            if (available.has(fid) && result.indexOf(fid) === -1) result.push(fid);
        });
        Object.keys(usage).map(function(fid) {
            return { fid: parseInt(fid, 10), count: Number(usage[fid]) || 0 };
        }).filter(function(item) {
            return item.fid && available.has(item.fid) && result.indexOf(item.fid) === -1;
        }).sort(function(a, b) {
            return b.count - a.count;
        }).forEach(function(item) {
            if (item.count > 0 && result.length < limit) result.push(item.fid);
        });
        return result.slice(0, limit);
    }

    function recordCommonBoardUsage(fids) {
        var usage = readSearchBoardJson("bgshBoardUsageV47", {});
        Array.from(new Set(fids.map(String))).forEach(function(fid) {
            usage[fid] = (Number(usage[fid]) || 0) + 1;
        });
        GM_setValue("bgshBoardUsageV47", JSON.stringify(usage));
    }

    function parseWebsiteSearchBoards(doc) {
        var hashInput = doc.querySelector('input[name="formhash"]');
        if (hashInput && hashInput.value) SEARCH_FORMHASH = hashInput.value;
        var groupMap = new Map();

        function addBoard(groupName, fid, name) {
            if (!Number.isFinite(fid) || fid <= 0) return;
            var cleanName = cleanBoardName(name);
            if (!cleanName || /^\d+$/.test(cleanName)) cleanName = "fid=" + fid;
            SEARCH_BOARD_NAMES[String(fid)] = cleanName;
            var label = "📂 " + cleanBoardName(groupName || "网站其他板块");
            if (!groupMap.has(label)) groupMap.set(label, []);
            var list = groupMap.get(label);
            if (list.indexOf(fid) === -1) list.push(fid);
        }

        doc.querySelectorAll('select[name="srchfid[]"], select[name="srchfid"]').forEach(function(select) {
            Array.from(select.querySelectorAll("option")).forEach(function(option) {
                if (!/^\d+$/.test(option.value) || option.disabled) return;
                var parent = option.parentElement;
                var groupName = parent && parent.tagName === "OPTGROUP"
                ? parent.getAttribute("label")
                : "搜索板块";
                addBoard(groupName, parseInt(option.value, 10), option.textContent);
            });
        });

        doc.querySelectorAll(
            'a[href*="mod=forumdisplay"][href*="fid="], ' +
            'a[href*="forum-"][href$=".html"], a[href*="forum-"]'
        ).forEach(function(link) {
            var fid = extractBoardFid(link.getAttribute("href") || link.href);
            if (!fid) return;
            addBoard(getBoardLinkGroupName(link), fid, link.textContent);
        });

        return Array.from(groupMap.entries()).map(function(entry) {
            return { label: entry[0], fids: entry[1] };
        }).filter(function(group) { return group.fids.length > 0; });
    }

    function mergeSearchBoardGroups(groupSets) {
        var seen = new Set();
        var merged = [];
        var mergedByLabel = new Map();
        groupSets.forEach(function(groups) {
            (groups || []).forEach(function(group) {
                var label = cleanBoardName(group.label || "📂 网站其他板块");
                var target = mergedByLabel.get(label);
                if (!target) {
                    target = { label: label, fids: [] };
                    mergedByLabel.set(label, target);
                    merged.push(target);
                }
                (group.fids || []).forEach(function(rawFid) {
                    var fid = parseInt(rawFid, 10);
                    if (!fid || seen.has(fid)) return;
                    seen.add(fid);
                    target.fids.push(fid);
                });
            });
        });
        return merged.filter(function(group) { return group.fids.length > 0; });
    }

    function splitWebsiteBoardGroups(groups) {
        var result = { classified: [], generic: [] };
        (groups || []).forEach(function(group) {
            var label = cleanBoardName(group.label || "").replace(/^[^\p{L}\p{N}]+/u, "");
            if (/^(搜索板块|网站其他板块|其他板块)$/.test(label)) result.generic.push(group);
            else result.classified.push(group);
        });
        return result;
    }

    async function fetchBoardDocument(path) {
        var response = await fetch(baseURL + path, {
            credentials: "include",
            cache: "no-store"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        var html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
    }

    async function syncSearchBoards() {
        var cachedGroups = [];
        var cachedTime = 0;
        try {
            var cached = JSON.parse(GM_getValue("bgshSearchBoardsV474", "null"));
            if (cached && cached.groups && cached.groups.length) {
                cachedGroups = cached.groups;
                cachedTime = Number(cached.time) || 0;
                Object.assign(SEARCH_BOARD_NAMES, cached.names || {});
            }
        } catch (error) {}

        var localGroups = parseWebsiteSearchBoards(document);
        var localParts = splitWebsiteBoardGroups(localGroups);
        var cacheIsFresh = cachedGroups.length && Date.now() - cachedTime < 6 * 60 * 60 * 1000;
        if (cacheIsFresh) {
            var cachedMerged = mergeSearchBoardGroups([
                cachedGroups,
                localParts.classified,
                SEARCH_BOARD_GROUPS,
                localParts.generic
            ]);
            if (cachedMerged.length) SEARCH_BOARD_GROUPS = cachedMerged;
            return;
        }

        var searchGroups = [];
        var indexGroups = [];

        try {
            var searchDoc = await fetchBoardDocument("/search.php?mod=forum");
            searchGroups = parseWebsiteSearchBoards(searchDoc);
        } catch (error) {
            console.warn("[98T Search] 读取搜索板块列表失败", error);
        }

        try {
            var indexDoc = await fetchBoardDocument("/forum.php");
            indexGroups = parseWebsiteSearchBoards(indexDoc);
        } catch (error) {
            console.warn("[98T Search] 读取论坛首页板块列表失败", error);
        }

        var indexParts = splitWebsiteBoardGroups(indexGroups);
        var searchParts = splitWebsiteBoardGroups(searchGroups);
        var merged = mergeSearchBoardGroups([
            indexParts.classified,
            searchParts.classified,
            localParts.classified,
            SEARCH_BOARD_GROUPS,
            indexParts.generic,
            searchParts.generic,
            localParts.generic,
            cachedGroups
        ]);
        if (merged.length) SEARCH_BOARD_GROUPS = merged;

        GM_setValue("bgshSearchBoardsV474", JSON.stringify({
            time: Date.now(),
            groups: SEARCH_BOARD_GROUPS,
            names: SEARCH_BOARD_NAMES,
            count: SEARCH_BOARD_GROUPS.reduce(function(total, group) {
                return total + group.fids.length;
            }, 0)
        }));
    }

    function submitWebsiteSearch(query, type, timeVal, sortVal, selectedFids) {
        var form = document.createElement("form");
        form.method = "post";
        form.action = baseURL + "/search.php?mod=forum";
        form.style.display = "none";

        var fields = {
            formhash: getFormHash() || SEARCH_FORMHASH || "",
            srchtxt: query,
            searchsubmit: "yes"
        };
        // “网站默认”不附加高级搜索字段，行为与网站顶部普通搜索完全一致。
        if (type === "thread") fields.srchtype = "title";
        if (type === "forum") fields.srchtype = "fulltext";
        // Discuz 普通搜索分支可能忽略 srchfid[]。勾选板块后强制进入
        // 高级标题搜索分支，确保服务器实际应用板块条件。
        if (selectedFids.length && type === "native") fields.srchtype = "title";
        if (timeVal !== "0") fields.srchfrom = timeVal;
        if (sortVal !== "native") fields.orderby = sortVal;

        Object.keys(fields).forEach(function(name) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = fields[name];
            form.appendChild(input);
        });
        selectedFids.forEach(function(fid) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = "srchfid[]";
            input.value = fid;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    }



    // 搜索缓存清理（每天自动清理一次过期缓存）
    function cleanSearchCache() {
        const keys = GM_listValues ? GM_listValues() : [];
        const now = Date.now();
        let cleaned = 0;
        keys.forEach(key => {
            if (key.startsWith('bgsh_cache_') && key.endsWith('_time')) {
                const time = GM_getValue(key, 0);
                if (now - time > 86400000) { // 24小时过期
                    const cacheKey = key.replace('_time', '');
                    GM_deleteValue(cacheKey);
                    GM_deleteValue(key);
                    cleaned++;
                }
            }
        });
        if (cleaned > 0) {
            console.log('[98T] 清理了 ' + cleaned + ' 条搜索缓存');
        }
    }

    // 定期清理缓存
    setInterval(cleanSearchCache, 3600000); // 每小时检查一次

    function filterSearchResults() {
        if (!window.location.href.match(/search\.php.*(?:searchid|srchtxt|mod=forum)/)) return;
        if (document.getElementById('bgsh-search-result-filter')) return;

        function getSearchResultItems() {
            var items = document.querySelectorAll(
                'ul.searchresult > li, .forumcontrol + table tr, #threadlist tr, ' +
                'div.threadlist > table > tbody > tr, .tl .bm_c li'
            );
            if (items.length === 0) {
                items = document.querySelectorAll('li.pbw, .threadlist tr, table.threadlist tr, [id^="thread_"]');
            }
            return Array.from(items).filter(function(item) {
                if (item.tagName === 'TR' && item.querySelector('th')) {
                    var headerText = item.textContent.trim();
                    if (headerText.indexOf('标题') >= 0 || headerText.indexOf('作者') >= 0) return false;
                }
                return !!item.textContent.trim();
            });
        }

        function findItemFid(item) {
            var forumLink = item.querySelector(
                'a[href*="fid="], a[href*="forum-"], a[href*="mod=forumdisplay"]'
            );
            if (!forumLink) {
                forumLink = item.querySelector('[class*="board"], [class*="forum"], .xg2 a[href*="forum"]');
            }
            if (forumLink && forumLink.href) {
                var match = forumLink.href.match(/[?&]fid=(\d+)|forum-(\d+)-/);
                if (match) return String(match[1] || match[2]);
            }

            var text = item.textContent || '';
            for (var i = 0; i < DEFAULT_TID_OPTIONS.length; i++) {
                var fid = String(DEFAULT_TID_OPTIONS[i].value);
                var name = getBoardName(fid);
                if (name && text.indexOf(name) >= 0) return fid;
            }
            return '';
        }

        function findItemAuthor(item) {
            // Discuz 搜索结果常见作者节点：.by / .authi / uid 链接。
            // 优先使用明确的用户链接，避免把板块链接误判成作者。
            var nodes = item.querySelectorAll(
                '.by a[href*="uid="], .by a[href*="space-"], ' +
                '.authi a[href*="uid="], .authi a[href*="space-"], ' +
                'a[href*="uid="], a[href*="space-"]'
            );
            for (var i = 0; i < nodes.length; i++) {
                var text = (nodes[i].textContent || '').trim();
                if (text && text !== '作者' && text.length < 80) return text;
            }

            // 某些搜索结果使用纯文本作者区域。
            var authorNode = item.querySelector('.by, .authi, .author');
            if (authorNode) {
                var authorText = (authorNode.textContent || '').trim();
                authorText = authorText.replace(/^(作者|发布者|楼主)\s*[:：]?\s*/i, '').trim();
                if (authorText) {
                    authorText = authorText.split(/\s+/)[0];
                    if (authorText.length < 80) return authorText;
                }
            }
            return '';
        }

        function collectBoardOptions(items) {
            items.forEach(function(item) {
                item.dataset.bgshSearchResultFid = findItemFid(item);
                item.dataset.bgshSearchResultAuthor = findItemAuthor(item);
            });
            return DEFAULT_TID_OPTIONS.map(function(opt) {
                return { fid: String(opt.value), label: opt.label };
            });
        }

        function getStoredSelected(availableFids) {
            var raw = GM_getValue('bgsh_search_result_filter_all_fids', null);
            if (raw === null || raw === undefined || raw === '') return availableFids.slice();
            var selected;
            try {
                selected = JSON.parse(raw);
            } catch (e) { selected = availableFids.slice(); }
            if (!Array.isArray(selected)) selected = availableFids.slice();
            return selected.map(String).filter(function(fid) { return availableFids.indexOf(fid) >= 0; });
        }

        function splitCustomFilter(value) {
            return String(value || '')
                .split(/[,，、;\n\r]+/)
                .map(function(v) { return v.trim(); })
                .filter(Boolean);
        }

        function getStoredTextFilter(key) {
            return String(GM_getValue(key, '') || '');
        }

        function saveTextFilter(key, value) {
            GM_setValue(key, String(value || '').trim());
        }

        var items = getSearchResultItems();
        var options = collectBoardOptions(items);
        if (items.length === 0 || options.length === 0) return;

        var availableFids = options.map(function(opt) { return opt.fid; });
        var selectedFids = getStoredSelected(availableFids);

        var panel = document.createElement('div');
        panel.id = 'bgsh-search-result-filter';
        panel.className = 'bgsh-search-result-filter';
        if (GM_getValue('bgsh_search_result_filter_collapsed', false)) panel.classList.add('collapsed');
        panel.innerHTML =
            '<div class="bgsh-search-result-filter-header">' +
            '<span></span>' +
            '' +
            '</div>' +
            '<div class="bgsh-search-custom-filters">' +
                '<div class="bgsh-search-custom-filter-row">' +
                    '<label class="bgsh-search-custom-filter-switch"><input type="checkbox" id="bgshEnableExcludeKeywords">' +
                    '<span>排除关键字/作者</span></label>' +
                    '<input type="text" class="bgsh-search-custom-filter-input" id="bgshSearchExcludeKeywords" ' +
                        'placeholder="逗号分隔输入多选">' +
                '</div>' +
                '<div class="bgsh-search-custom-filter-row">' +
                    '<label class="bgsh-search-custom-filter-switch"><input type="checkbox" id="bgshEnableOnlyAuthors">' +
                    '<span>只看关键字/作者</span></label>' +
                    '<input type="text" class="bgsh-search-custom-filter-input" id="bgshSearchOnlyAuthors" ' +
                        'placeholder="逗号分隔输入多选">' +
                '</div>' +
                '<div class="bgsh-search-result-filter-count"></div>' +
                '</div>' +
            '<div class="bgsh-search-result-filter-actions">' +
            '<button type="button" data-action="all">全选</button>' +
            '<button type="button" data-action="none">全不选</button>' +
            '<button type="button" data-action="invert">反选</button>' +
            '</div>' +
            '<div class="bgsh-search-result-filter-body">' +
            options.map(function(opt) {
                return '<label class="bgsh-search-result-filter-item" title="' + opt.label.replace(/"/g, '&quot;') + '">' +
                    '<input type="checkbox" value="' + opt.fid + '">' +
                    '<span class="bgsh-search-result-filter-label">' + opt.label + '</span>' +
                    '</label>';
            }).join('') +
            '</div>';
        document.body.appendChild(panel);

        var checkboxes = Array.from(panel.querySelectorAll('.bgsh-search-result-filter-item input[type="checkbox"]'));
        checkboxes.forEach(function(cb) { cb.checked = selectedFids.indexOf(cb.value) >= 0; });

        var excludeInput = panel.querySelector('#bgshSearchExcludeKeywords');
        var authorInput = panel.querySelector('#bgshSearchOnlyAuthors');
        var excludeToggle = panel.querySelector('#bgshEnableExcludeKeywords');
        var authorToggle = panel.querySelector('#bgshEnableOnlyAuthors');
        excludeInput.value = getStoredTextFilter('bgsh_search_result_exclude_keywords');
        authorInput.value = getStoredTextFilter('bgsh_search_result_only_authors');
        excludeToggle.checked = GM_getValue('bgsh_enable_exclude_keywords', false);
        authorToggle.checked = GM_getValue('bgsh_enable_only_authors', false);

        // 输入内容后隐藏占位提示，清空后恢复
        [excludeInput, authorInput].forEach(function(input) {
            input.addEventListener('input', function() {
                input.dataset.hasValue = input.value.trim() ? '1' : '0';
            });
        });

        function applyDynamicFilter() {
            items = getSearchResultItems();
            collectBoardOptions(items);

            var checked = checkboxes.filter(function(cb) { return cb.checked; }).map(function(cb) { return cb.value; });
            GM_setValue('bgsh_search_result_filter_all_fids', JSON.stringify(checked));

            var excludeKeywords = excludeToggle.checked ? splitCustomFilter(excludeInput.value).map(function(v) {
                return v.toLocaleLowerCase();
            }) : [];
            var onlyAuthors = authorToggle.checked ? splitCustomFilter(authorInput.value).map(function(v) {
                return v.toLocaleLowerCase();
            }) : [];

            var visible = 0;
            // 固定统计搜索结果页浏览器实际获取到的全部帖子数量。
            // 后续显示/隐藏筛选只改变显示状态，不影响板块计数。
            var boardTotalCounts = {};
            items.forEach(function(item) {
                var totalFid = item.dataset.bgshSearchResultFid || findItemFid(item);
                if (totalFid) {
                    boardTotalCounts[totalFid] = (boardTotalCounts[totalFid] || 0) + 1;
                }
            });

            var boardVisibleCounts = {};
            items.forEach(function(item) {
                var fid = item.dataset.bgshSearchResultFid || findItemFid(item);
                var author = item.dataset.bgshSearchResultAuthor || findItemAuthor(item);
                var itemText = (item.textContent || '').trim().toLocaleLowerCase();
                var authorText = String(author || '').trim().toLocaleLowerCase();

                // 排除关键字：命中任意一个关键词即隐藏。
                var excluded = excludeKeywords.some(function(keyword) {
                    return keyword && itemText.indexOf(keyword) >= 0;
                });

                // 只看关键字/作者：标题、内容、作者支持部分匹配；填写多个词时满足任意一个即可。
                var authorMatched = onlyAuthors.length === 0 || onlyAuthors.some(function(name) {
                    return itemText.indexOf(name) >= 0 || authorText.indexOf(name) >= 0;
                });

                var boardMatched = !fid || checked.indexOf(fid) >= 0;
                var show = boardMatched && !excluded && authorMatched;

                item.style.display = show ? '' : 'none';
                item.dataset.bgshBoardFiltered = show ? '0' : '1';
                item.dataset.bgshTextFiltered = (excluded || !authorMatched) ? '1' : '0';

                if (show) {
                    visible++;
                    if (fid) boardVisibleCounts[fid] = (boardVisibleCounts[fid] || 0) + 1;
                }
            });

            // 在板块名称后显示当前组合筛选下的实时数量。
            options.forEach(function(opt) {
                var labelNode = panel.querySelector(
                    '.bgsh-search-result-filter-item input[value="' + opt.fid + '"] + .bgsh-search-result-filter-label'
                );
                if (labelNode) {
                    labelNode.textContent = opt.label + ' (' + (boardTotalCounts[opt.fid] || 0) + ')';
                }
            });

            var countEl = panel.querySelector('.bgsh-search-result-filter-count');
            if (countEl) {
                countEl.innerText =
                    '' + visible + '/' + items.length + '条结果 ' + checked.length + '/' + options.length + '个板块';
            }
        }

        window.bgshRefreshSearchBoardCount = applyDynamicFilter;

        function debounceTextFilter() {
            clearTimeout(window._98tSearchTextFilterTimer);
            window._98tSearchTextFilterTimer = setTimeout(function() {
                saveTextFilter('bgsh_search_result_exclude_keywords', excludeInput.value);
                saveTextFilter('bgsh_search_result_only_authors', authorInput.value);
                applyDynamicFilter();
            }, 180);
        }

        excludeInput.addEventListener('input', debounceTextFilter);
        authorInput.addEventListener('input', debounceTextFilter);
        excludeToggle.addEventListener('change', function() {
            GM_setValue('bgsh_enable_exclude_keywords', excludeToggle.checked);
            applyDynamicFilter();
        });
        authorToggle.addEventListener('change', function() {
            GM_setValue('bgsh_enable_only_authors', authorToggle.checked);
            applyDynamicFilter();
        });
        excludeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTextFilter('bgsh_search_result_exclude_keywords', excludeInput.value);
                applyDynamicFilter();
                excludeInput.blur();
            }
        });
        authorInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTextFilter('bgsh_search_result_only_authors', authorInput.value);
                applyDynamicFilter();
                authorInput.blur();
            }
        });

        panel.addEventListener('change', function(e) {
            if (e.target.matches('input[type="checkbox"]')) applyDynamicFilter();
        });
        panel.addEventListener('click', function(e) {
            var actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                var action = actionBtn.dataset.action;
                panel.querySelectorAll('[data-action]').forEach(function(btn){
                    btn.classList.remove('bgsh-action-active');
                });
                actionBtn.classList.add('bgsh-action-active');
                setTimeout(function(){
                    actionBtn.classList.remove('bgsh-action-active');
                }, 500);
                // 全选/全不选/反选仅作用于板块复选框，不改变关键字和作者筛选开关
                checkboxes.forEach(function(cb) {
                    if (action === 'all') cb.checked = true;
                    else if (action === 'none') cb.checked = false;
                    else if (action === 'invert') cb.checked = !cb.checked;
                });
                applyDynamicFilter();
                return;
            }
            var collapseBtn = e.target.closest('.bgsh-search-result-filter-collapse');
            if (collapseBtn) {
                var collapsed = panel.classList.toggle('collapsed');
                collapseBtn.textContent = collapsed ? '展开' : '收起';
                GM_setValue('bgsh_search_result_filter_collapsed', collapsed);
            }
        });

        var observer = new MutationObserver(function(mutations) {
            var hasRelevantChanges = mutations.some(function(m) {
                return m.type === 'childList' && m.addedNodes.length > 0;
            });
            if (hasRelevantChanges) {
                clearTimeout(window._98tFilterTimer);
                window._98tFilterTimer = setTimeout(applyDynamicFilter, 200);
            }
        });
        observer.observe(document.querySelector('.searchresult, #threadlist, .tl, .bm_c, .mainbox') || document.body, { childList: true, subtree: true });
        applyDynamicFilter();
    }
    // #endregion

    // #region 划词搜索 (保持原样)
    function selectSearch(e) {
        const LEFT_MOUSE_BUTTON = 0;
        const MIN_TEXT_LENGTH = 2;
        const forbiddenTags = ["INPUT", "TEXTAREA"];

        if (e.button !== LEFT_MOUSE_BUTTON) return;
        if (forbiddenTags.includes(document.activeElement.tagName.toUpperCase())) return;

        const selectedText = window.getSelection().toString().trim();

        if (selectedText.length < MIN_TEXT_LENGTH) {
            removeSearchMenu();
            return;
        }

        if (!document.querySelector(".bgsh-sav-menu")) {
            const searchPopup = createSearchPopup(selectedText);
            displaySearchPopup(e.pageX, e.pageY, searchPopup);
        }
    }

    function removeSearchMenu() {
        const searchMenu = document.querySelector(".bgsh-sav-menu");
        if (searchMenu) searchMenu.remove();
    }

    function displaySearchPopup(x, y, element) {
        const rect = element.getBoundingClientRect();
        Object.assign(element.style, {
            left: `${Math.max(10, x - rect.width / 2)}px`,
            top: `${Math.min(y + 10, window.innerHeight - rect.height - 10)}px`,
            position: "fixed",
            zIndex: "100000",
        });
        document.body.appendChild(element);
    }

    function createSearchPopup(selectedText) {
        const button = document.createElement("button");
        button.classList.add("bgsh-sav-menu", "bgsh-searchBtn");
        button.setAttribute("type", "button");

        const innerDiv = document.createElement("div");
        innerDiv.classList.add("savlink", "savsehuatang");
        innerDiv.setAttribute("data-avid", selectedText);
        innerDiv.textContent = `🔍 搜索: ${selectedText}`;
        button.appendChild(innerDiv);

        button.addEventListener("click", handleSearchPopupClick);
        return button;
    }

    function handleSearchPopupClick(e) {
        const target = e.target;
        if (target.classList.contains("savsehuatang")) {
            target.classList.remove("savsehuatang");
            searchSehuatang(target.dataset.avid);
        }
        removeSearchMenu();
    }

    function searchSehuatang(query) {
        const formhash = getFormHash();
        const openSearch = () => window.open(`${baseURL}/search.php`, "_blank");

        if (!formhash) {
            copyToClipboard(query).then(openSearch);
            return;
        }

        const formDataString = `formhash=${encodeURIComponent(formhash)}&srchtxt=${encodeURIComponent(query)}&searchsubmit=yes`;

        GM_xmlhttpRequest({
            method: "POST",
            url: `${baseURL}/search.php?mod=forum`,
            data: formDataString,
            redirect: "manual",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: baseURL,
                Referer: baseURL,
            },
            onload: function(response) {
                if (response.status === 301 || response.status === 302) {
                    var headers = response.responseHeaders.split("\n");
                    var locationHeader = headers.find((header) => header.toLowerCase().startsWith("location:"));
                    if (locationHeader) {
                        var location = locationHeader.split(":")[1].trim();
                        window.open(`${baseURL}/${location}`, "_blank");
                    }
                } else {
                    if (response.finalUrl && response.finalUrl.includes("searchmd5")) {
                        showToast("⚠️ 划词搜索需要 Tampermonkey BETA 版本", "warning");
                        return;
                    }
                    var htmlString = response.responseText;
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(htmlString, "text/html");
                    var messagetextElement = doc.getElementById("messagetext");
                    if (messagetextElement) {
                        var firstPElement = messagetextElement.querySelector("p");
                        if (firstPElement) {
                            showToast(firstPElement.textContent, "warning");
                            return;
                        }
                    }
                }
            },
            onerror: function(error) {
                console.error("GM_xmlhttpRequest error:", error);
                showToast("❌ 搜索请求失败", "error");
            },
        });
    }
    // #endregion

    // #region 无缝翻页 (4.1.1 - 防重复加载与内容去重)
    function initInfiniteScroll(pageName) {
        let isLoading = false;
        let noMoreData = false;
        let pendingLoadTimer = null;
        let mutationCheckTimer = null;
        let nextPageUrl = "";
        let loadedPageCount = 1;
        let pageObserver = null;
        const requestedUrls = new Set();
        const appendedItemKeys = new Set();
        const settings = getSettings();

        const isSearchPage = pageName === "isSearchPage" || /search\.php/.test(window.location.href);

        if (!settings.autoPagination) {
            preserveNativePaginationSort();
            console.log("[98T] 自动翻页已关闭");
            return;
        }

        // 同一页面只允许初始化一个滚动监听器，避免多个实例同时翻页。
        if (document.documentElement.dataset.bgshInfiniteScroll === "1") {
            console.log("[98T] 无限滚动已初始化，跳过重复启动");
            return;
        }
        document.documentElement.dataset.bgshInfiniteScroll = "1";

        const loadSentinel = document.createElement("div");
        loadSentinel.id = "bgshInfiniteScrollSentinel";
        loadSentinel.style.cssText = "clear:both;text-align:center;padding:0;margin:0;height:1px;min-height:1px;opacity:0;pointer-events:none;";
        const loadMoreButton = document.createElement("button");
        loadMoreButton.type = "button";
        loadMoreButton.className = "bgsh-customBtn";
        loadMoreButton.style.cssText = "display:none !important;";
        loadMoreButton.textContent = "继续加载下一页";
        loadSentinel.appendChild(loadMoreButton);
        document.body.appendChild(loadSentinel);

        // 底部加载提示已隐藏，仅保留无缝翻页触发逻辑。
        function setLoadState(text, disabled) {
            loadMoreButton.textContent = "";
            loadMoreButton.disabled = !!disabled;
        }

        function normalizePageUrl(href) {
            if (!href || /^javascript:/i.test(href)) return "";
            try {
                return new URL(href, location.href).href;
            } catch (error) {
                return "";
            }
        }

        function getPageNumber(url) {
            try {
                const parsed = new URL(url, location.href);
                const queryPage = parseInt(parsed.searchParams.get("page") || "1", 10);
                if (queryPage > 0) return queryPage;
                const pathMatch = parsed.pathname.match(/-(\d+)\.html$/);
                return pathMatch ? parseInt(pathMatch[1], 10) : 1;
            } catch (error) {
                return 1;
            }
        }

        function findNextPageUrl(root) {
            const explicit = root.querySelector(".pg .nxt, a.nxt, a[rel='next']");
            if (explicit) {
                const explicitUrl = normalizePageUrl(explicit.getAttribute("href"));
                if (explicitUrl && !requestedUrls.has(explicitUrl)) return explicitUrl;
            }

            // 后段分页没有“下一页”按钮时，从数字页码中选择最近的未访问页。
            const currentPage = Math.max(
                getPageNumber(location.href),
                ...Array.from(requestedUrls).map(getPageNumber)
            );
            const candidates = Array.from(root.querySelectorAll(".pg a[href]"))
            .map(function(link) { return normalizePageUrl(link.getAttribute("href")); })
            .filter(function(url) {
                return url && !requestedUrls.has(url) && getPageNumber(url) > currentPage;
            })
            .sort(function(a, b) { return getPageNumber(a) - getPageNumber(b); });
            return candidates[0] || "";
        }

        function getNextLink() {
            if (nextPageUrl && !requestedUrls.has(nextPageUrl)) return nextPageUrl;
            return findNextPageUrl(document);
        }

        function preserveCurrentSort(urlValue) {
            if (!urlValue) return "";
            if (isSearchPage) return urlValue;
            try {
                const target = new URL(urlValue, location.href);
                const current = new URL(location.href);
                // 排序字段必须覆盖下一页链接中可能存在的网站默认值，
                // 不能只在参数缺失时补充，否则会混用 dateline/lastpost。
                target.searchParams.set(
                    "orderby",
                    current.searchParams.get("orderby") || "lastpost"
                );
                target.searchParams.set(
                    "ascdesc",
                    current.searchParams.get("ascdesc") || "desc"
                );
                [
                    "filter", "dateline", "specialtype", "typeid", "digest", "recommend"
                ].forEach(function(name) {
                    const value = current.searchParams.get(name);
                    if (value !== null) {
                        target.searchParams.set(name, value);
                    }
                });
                return target.href;
            } catch (error) {
                return urlValue;
            }
        }

        function getItemKey(item) {
            if (!item || item.nodeType !== 1) return "";

            const identified = item.matches('[id^="normalthread_"], [id^="stickthread_"], [id^="thread_"], [id^="post_"], [id^="favorite_"]')
            ? item
            : item.querySelector('[id^="normalthread_"], [id^="stickthread_"], [id^="thread_"], [id^="post_"], [id^="favorite_"]');
            if (identified && identified.id) return "id:" + identified.id;

            const link = item.querySelector('a[href*="thread-"], a[href*="tid="], a[href*="pid="]');
            if (link) {
                const href = link.getAttribute("href") || "";
                const match = href.match(/thread-(\d+)|[?&]tid=(\d+)|[?&]pid=(\d+)/);
                if (match) return "topic:" + (match[1] || match[2] || match[3]);
            }
            return "";
        }

        function insertPageDivider(container, pageNumber) {
            if (!isSearchPage || !container) return;
            const divider = document.createElement("div");
            divider.className = "bgsh-page-divider";
            divider.style.cssText = "clear:both;text-align:center;margin:28px 0;padding:10px;background:#c00000;border:none;border-radius:8px;color:#fff;font-size:15px;font-weight:bold;letter-spacing:1px;";
            /* 已删除页间分隔线 */
        }

        function rememberExistingItems(container) {
            if (!container) return;
            Array.from(container.children).forEach(function(item) {
                const key = getItemKey(item);
                if (key) appendedItemKeys.add(key);
            });
        }

        function getContentContainer() {
            if (isSearchPage) {
                let container = document.querySelector("ul.searchresult");
                if (container && container.children.length > 0) return container;

                container = document.querySelector(".searchresult");
                if (container && container.children.length > 0) return container;

                const tl = document.querySelector(".tl, .bm_c");
                if (tl) {
                    const newContainer = document.createElement("ul");
                    newContainer.className = "searchresult";

                    const items = tl.querySelectorAll("li.pbw, li.pbo, li");
                    if (items.length > 0) {
                        items.forEach(item => {
                            newContainer.appendChild(item.cloneNode(true));
                            item.remove();
                        });
                        tl.parentNode.insertBefore(newContainer, tl);
                        tl.remove();
                        return newContainer;
                    }
                }

                const mainArea = document.querySelector(".bm, .main, #wrap");
                if (mainArea) {
                    const newContainer = document.createElement("ul");
                    newContainer.className = "searchresult";
                    mainArea.appendChild(newContainer);
                    return newContainer;
                }
                return null;
            } else {
                // 板块页必须追加到主题表格，而不是追加整个 #threadlist 外层。
                if (pageName === "isForumDisplayPage") {
                    return document.querySelector("#threadlisttableid") ||
                        document.querySelector("#threadlist table[id*='threadlist']") ||
                        document.querySelector("#threadlist .tl table") ||
                        document.querySelector("#threadlist table");
                }
                let selector = "#threadlist";
                if (pageName === "isPostPage") selector = "#postlist";
                if (pageName === "isSpacePage" || pageName === "isMySpacePage") selector = "#delform, #threadlist";
                if (pageName === "isShowdarkroomPage") selector = "#darkroomtable";
                return document.querySelector(selector);
            }
        }

        function extractNewContent(html) {
            const div = document.createElement("div");
            div.innerHTML = html;

            if (isSearchPage) {
                let items = [];

                let lis = div.querySelectorAll("li.pbw");
                if (lis.length > 0) {
                    lis.forEach(el => items.push(el));
                }

                if (items.length === 0) {
                    lis = div.querySelectorAll("li.pbo");
                    lis.forEach(el => items.push(el));
                }

                if (items.length === 0) {
                    const ul = div.querySelector("ul.searchresult");
                    if (ul) {
                        lis = ul.querySelectorAll("li");
                        lis.forEach(el => items.push(el));
                    }
                }

                if (items.length === 0) {
                    const result = div.querySelector(".searchresult");
                    if (result) {
                        const children = result.children;
                        for (let i = 0; i < children.length; i++) {
                            items.push(children[i]);
                        }
                    }
                }

                if (items.length === 0) {
                    const container = div.querySelector(".tl, .bm_c");
                    if (container) {
                        lis = container.querySelectorAll("li.pbw, li.pbo, li");
                        lis.forEach(el => {
                            const text = el.textContent.trim();
                            if (text.indexOf('标题') >= 0 && text.indexOf('作者') >= 0) return;
                            if (text.indexOf('回复') >= 0 && text.indexOf('查看') >= 0) return;
                            items.push(el);
                        });
                    }
                }

                if (items.length > 0) {
                    const wrapper = document.createElement("div");
                    wrapper.className = "searchresult-items";
                    items.forEach(item => {
                        wrapper.appendChild(item.cloneNode(true));
                    });
                    return wrapper;
                }
                return null;
            } else {
                if (pageName === "isForumDisplayPage") {
                    var sourceTable = div.querySelector("#threadlisttableid") ||
                        div.querySelector("#threadlist table[id*='threadlist']") ||
                        div.querySelector("#threadlist .tl table") ||
                        div.querySelector("#threadlist table");
                    var threadBodies = div.querySelectorAll(
                        "#threadlisttableid > tbody[id^='normalthread_'], " +
                        "#threadlisttableid > tbody[id^='stickthread_'], " +
                        "#threadlist tbody[id^='normalthread_'], " +
                        "#threadlist tbody[id^='stickthread_']"
                    );
                    if (threadBodies.length) {
                        var bodyWrapper = document.createElement("div");
                        threadBodies.forEach(function(tbody) {
                            bodyWrapper.appendChild(tbody.cloneNode(true));
                        });
                        return bodyWrapper;
                    }
                    return sourceTable;
                }
                let selector = "#threadlist";
                if (pageName === "isPostPage") selector = "#postlist";
                if (pageName === "isSpacePage" || pageName === "isMySpacePage") selector = "#delform, #threadlist";
                if (pageName === "isShowdarkroomPage") selector = "#darkroomtable";
                return div.querySelector(selector);
            }
        }

        function appendContent(container, newContent) {
            if (!container || !newContent) return false;

            rememberExistingItems(container);
            const children = Array.from(newContent.children);
            if (children.length === 0) return false;

            let addedCount = 0;
            for (let i = 0; i < children.length; i++) {
                const key = getItemKey(children[i]);
                if (key && appendedItemKeys.has(key)) {
                    console.log("[98T] 跳过重复内容:", key);
                    continue;
                }
                const clone = children[i].cloneNode(true);
                if (clone.tagName === 'TR' && clone.querySelector('th')) {
                    continue;
                }
                container.appendChild(clone);
                if (key) appendedItemKeys.add(key);
                addedCount++;
            }

            return addedCount > 0;
        }

        function parseForumDate(value) {
            var text = String(value || "").trim();
            if (!text) return NaN;
            var now = new Date();
            var relative = text.match(/(\d+)\s*(秒|分钟|小时|天)前/);
            if (relative) {
                var unitMs = relative[2] === "秒" ? 1000 :
                relative[2] === "分钟" ? 60000 :
                relative[2] === "小时" ? 3600000 : 86400000;
                return Date.now() - parseInt(relative[1], 10) * unitMs;
            }
            if (/刚刚/.test(text)) return Date.now();
            var clock = text.match(/(今天|昨天|前天)\s*(\d{1,2}):(\d{2})/);
            if (clock) {
                var offset = clock[1] === "今天" ? 0 : clock[1] === "昨天" ? 1 : 2;
                return new Date(
                    now.getFullYear(), now.getMonth(), now.getDate() - offset,
                    parseInt(clock[2], 10), parseInt(clock[3], 10), 0
                ).getTime();
            }
            var normalized = text
            .replace(/[年\/]/g, "-")
            .replace(/月/g, "-")
            .replace(/日/g, " ")
            .replace(/\./g, "-")
            .replace(/\s+/g, " ")
            .trim();
            var timestamp = Date.parse(normalized);
            return Number.isFinite(timestamp) ? timestamp : NaN;
        }

        function getThreadSortTime(tbody, orderby) {
            var cells = tbody.querySelectorAll("td.by");
            if (!cells.length) return NaN;
            var cell = orderby === "dateline" ? cells[0] : cells[cells.length - 1];
            var dateNode = cell.querySelector("span[title], time[datetime], em span, em, time");
            if (!dateNode) return NaN;
            var value = dateNode.getAttribute("title") ||
                dateNode.getAttribute("datetime") ||
                dateNode.textContent;
            return parseForumDate(value);
        }

        function enforceForumThreadOrder(container) {
            if (pageName !== "isForumDisplayPage" || !container) return;
            var currentURL = new URL(location.href);
            var orderby = currentURL.searchParams.get("orderby") || "lastpost";
            if (orderby !== "dateline" && orderby !== "lastpost") return;
            var direction = currentURL.searchParams.get("ascdesc") === "asc" ? 1 : -1;
            var rows = Array.from(container.children).filter(function(child) {
                return child.id && child.id.indexOf("normalthread_") === 0;
            });
            if (rows.length < 2) return;

            var decorated = rows.map(function(row, index) {
                return { row: row, index: index, time: getThreadSortTime(row, orderby) };
            });
            var validCount = decorated.filter(function(item) {
                return Number.isFinite(item.time);
            }).length;
            if (validCount < 2) return;

            decorated.sort(function(a, b) {
                var aValid = Number.isFinite(a.time);
                var bValid = Number.isFinite(b.time);
                if (aValid && bValid && a.time !== b.time) {
                    return direction * (a.time - b.time);
                }
                if (aValid !== bValid) return aValid ? -1 : 1;
                return a.index - b.index;
            });

            // 使用占位符只交换普通主题行，广告、分隔行和置顶主题保持原位。
            var placeholders = rows.map(function(row) {
                var marker = document.createComment("bgsh-thread-order");
                container.insertBefore(marker, row);
                row.remove();
                return marker;
            });
            decorated.forEach(function(item, index) {
                placeholders[index].replaceWith(item.row);
            });
        }

        // 搜索页分页保护：无缝翻页时，服务器返回的 HTML 可能没有 .pg，
        // 或 DOM 更新导致原分页节点被移除。保存首次出现的分页并在需要时恢复。
        let searchPaginationBackup = null;

        function backupSearchPagination() {
            if (!isSearchPage || searchPaginationBackup) return;
            const nodes = Array.from(document.querySelectorAll(".pgs"));
            if (!nodes.length) return;
            searchPaginationBackup = nodes.map(function(node) {
                return { className: node.className, html: node.innerHTML };
            });
        }

        function ensureSearchPagination() {
            if (!isSearchPage) return;
            backupSearchPagination();
            if (!searchPaginationBackup || !searchPaginationBackup.length) return;

            let existing = Array.from(document.querySelectorAll(".pgs"));

            // 搜索页固定两个分页位置：顶部一个，结果列表底部一个。
            // 不再整体恢复两个节点，否则 Discuz 搜索页容易把两个分页都插到顶部。
            if (existing.length > 2) {
                existing.slice(2).forEach(function(node){ node.remove(); });
                existing = Array.from(document.querySelectorAll(".pgs"));
            }

            const topAnchor = document.querySelector(".slst.mtw") || document.querySelector(".searchresult");
            const threadBox = document.querySelector("#threadlist") || document.querySelector(".tl") || document.querySelector(".searchresult");

            if (existing.length === 0 && topAnchor && topAnchor.parentNode) {
                const wrapper = document.createElement("div");
                wrapper.className = searchPaginationBackup[0].className || "pgs";
                wrapper.innerHTML = searchPaginationBackup[0].html;
                topAnchor.parentNode.insertBefore(wrapper, topAnchor);
                existing.push(wrapper);
            }

            // 第二个分页不存在时重新创建，但插入到结果列表之后，而不是顶部。
            if (existing.length < 2 && threadBox && threadBox.parentNode) {
                const saved = searchPaginationBackup[1] || searchPaginationBackup[0];
                const wrapper = document.createElement("div");
                wrapper.className = saved.className || "pgs";
                wrapper.innerHTML = saved.html;
                threadBox.parentNode.insertBefore(wrapper, threadBox.nextSibling);
                existing = Array.from(document.querySelectorAll(".pgs"));
            }

            // 强制纠正位置：第一个跟随顶部锚点，第二个跟随结果列表底部。
            existing = Array.from(document.querySelectorAll(".pgs"));
            if (existing.length >= 2 && topAnchor && topAnchor.parentNode) {
                if (existing[0].previousElementSibling !== topAnchor.previousElementSibling) {
                    topAnchor.parentNode.insertBefore(existing[0], topAnchor);
                }
                if (threadBox && threadBox.parentNode) {
                    threadBox.parentNode.insertBefore(existing[1], threadBox.nextSibling);
                }
            }

            existing = Array.from(document.querySelectorAll(".pgs"));
            if (existing.length && !existing[0].querySelector(".pg a[href]")) {
                existing[0].innerHTML = searchPaginationBackup[0].html;
            }
        }

        function updateSearchPaginationLinks() {
            if (!isSearchPage) return;
            ensureSearchPagination();
            document.querySelectorAll(".pg a[href], .pgs a[href]").forEach(function(link) {
                if (!link || !link.getAttribute("href")) return;
                const href = normalizePageUrl(link.getAttribute("href"));
                if (href) link.href = href;
            });
        }

        function updatePagination(newHtml) {
            backupSearchPagination();
            const div = document.createElement("div");
            div.innerHTML = newHtml;

            // 先从新页面提取下一页地址，但不要直接用新页面的 .pg 替换当前分页。
            // 搜索页的 Discuz 模板在无缝请求后，返回的分页结构有时为空/不完整；
            // 如果直接 currentPg.innerHTML = source.innerHTML，会把原本可见的分页按钮清空。
            const foundNextPageUrl = findNextPageUrl(div);
            // 每次都同步下一页地址；最后一页没有 next 时必须清空旧地址，
            // 防止继续拿上一轮缓存的地址重复加载。
            nextPageUrl = foundNextPageUrl || "";

            if (!isSearchPage) {
                const newPgs = div.querySelectorAll(".pg");
                if (!newPgs.length) return;

                const currentPgs = document.querySelectorAll(".pg");
                currentPgs.forEach(function(currentPg, index) {
                    const source = newPgs[Math.min(index, newPgs.length - 1)];
                    if (source && source.innerHTML.trim()) {
                        currentPg.innerHTML = source.innerHTML;
                    }
                });
                return;
            }

            // 搜索页：保留原分页 DOM，只同步“有内容”的分页。
            // 这样顶部克隆的分页（.pgs.cl.mbm）和原生分页都不会因为加载下一页而消失。
            const currentPgs = document.querySelectorAll(".pg");
            const newPgs = div.querySelectorAll(".pg");
            if (!currentPgs.length || !newPgs.length) return;

            currentPgs.forEach(function(currentPg, index) {
                const source = newPgs[Math.min(index, newPgs.length - 1)];
                if (!source) return;

                const sourceHtml = source.innerHTML.trim();
                const sourceLinks = source.querySelectorAll("a[href]");

                // 只有新分页确实包含链接时才替换；空 .pg 直接忽略。
                if (sourceHtml && sourceLinks.length > 0) {
                    currentPg.innerHTML = sourceHtml;
                }
            });

            // 重新修正搜索页分页链接，避免无缝翻页后点击分页又回到旧排序/旧查询。
            updateSearchPaginationLinks();
        }

        let lastPageLoadTime = 0;
        async function loadNextPage() {
            // 仅搜索结果页限制翻页间隔4秒，其他页面保持原有无间隔翻页
            const pageInterval = isSearchPage ? 4000 : 0;
            if (pageInterval > 0) {
                const now = Date.now();
                const waitTime = pageInterval - (now - lastPageLoadTime);
                if (waitTime > 0) {
                    if (!pendingLoadTimer) {
                        pendingLoadTimer = setTimeout(function() {
                            pendingLoadTimer = null;
                            loadNextPage();
                        }, waitTime);
                    }
                    return;
                }
                if (pendingLoadTimer) {
                    clearTimeout(pendingLoadTimer);
                    pendingLoadTimer = null;
                }
            }

            const url = preserveCurrentSort(getNextLink());
            if (!url || noMoreData) {
                if (!noMoreData) {
                    noMoreData = true;
                }
                setLoadState("", true);
                if (pageObserver) pageObserver.disconnect();
                return;
            }

            if (isLoading || requestedUrls.has(url)) return;
            isLoading = true;
            lastPageLoadTime = Date.now();
            let skipEmptyPage = false;
            requestedUrls.add(url);
            setLoadState("", true);
            console.log("[98T] 加载下一页:", url);

            try {
                const response = await fetch(url, { credentials: "include" });
                if (!response.ok) throw new Error("HTTP " + response.status);
                const html = await response.text();

                // 成功请求到这一页后就计数，不再依赖“是否追加了新内容”。
                // 最后一页可能因为去重/置顶等原因没有新增条目，但它仍然是实际加载过的分页。
                loadedPageCount++;

                updatePagination(html);
                if (isSearchPage) {
                    ensureSearchPagination();
                    updateSearchPaginationLinks();
                }

                const newContent = extractNewContent(html);
                if (!newContent || newContent.children.length === 0) {
                    // 不设置固定空页上限：只要网站仍提供未访问的下一页就继续。
                    if (nextPageUrl && !requestedUrls.has(nextPageUrl)) {
                        console.log("[98T] 当前页无可追加内容，自动尝试下一页");
                        skipEmptyPage = true;
                    } else {
                        console.log("[98T] 没有新内容");
                        noMoreData = true;
                        setLoadState("", true);
                    }
                    return;
                }

                let container = getContentContainer();
                if (!container) {
                    console.log("[98T] 找不到容器，创建新容器");
                    container = document.createElement("ul");
                    container.className = "searchresult";
                    const mainArea = document.querySelector(".bm, .main, #wrap");
                    if (mainArea) {
                        mainArea.appendChild(container);
                    } else {
                        document.body.appendChild(container);
                    }
                }

                insertPageDivider(container, loadedPageCount + 1);
                const added = appendContent(container, newContent);
                if (added) {
                    console.log("[98T] 追加了", newContent.children.length, "个项目");
                    // 网站各页使用同一排序参数后，严格按返回顺序追加。
                    // 不再进行客户端日期解析和重排，避免相对时间解析造成错序。
//                     setLoadState("继续加载第 " + (loadedPageCount + 1) + " 页", false);
                    const newSettings = getSettings();
                    await processPageContentBasedOnSettings(pageName, newSettings);
                    blockContentByUsers(newSettings);
                    // 无缝翻页追加内容后刷新板块筛选统计
                    if (typeof window.bgshRefreshSearchBoardCount === 'function') {
                        setTimeout(window.bgshRefreshSearchBoardCount, 100);
                    }
                } else {
                    // 置顶帖或重复帖可能占满一页，不能因此提前结束整个搜索。
                    if (nextPageUrl && !requestedUrls.has(nextPageUrl)) {
                        console.log("[98T] 当前页内容均已存在，自动跳到下一页");
                        skipEmptyPage = true;
                    } else {
                        console.log("[98T] 没有可追加的新内容");
                        noMoreData = true;
                        setLoadState("", true);
                    }
                }

            } catch (error) {
                requestedUrls.delete(url);
                console.error("[98T] 加载失败:", error);
                setLoadState("", false);
            } finally {
                isLoading = false;
                if (skipEmptyPage && !noMoreData) {
                    setTimeout(loadNextPage, 4000);
                } else {
                    checkAndLoad();
                }
            }
        }

        function checkAndLoad() {
            if (noMoreData || isLoading) return;

            const bodyHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            const windowHeight = window.innerHeight;
            const scrollPosition = windowHeight + window.scrollY;

            if (bodyHeight <= windowHeight + 200 || scrollPosition >= bodyHeight - 900) {
                if (pendingLoadTimer) return;
                pendingLoadTimer = setTimeout(function() {
                    pendingLoadTimer = null;
                    loadNextPage();
                }, 4000);
            }
        }

        async function processPageContentBasedOnSettings(pageName, settings) {
            if (pageName == "isSearchPage" || /search\.php/.test(window.location.href)) {
                displayAdvanThreadImages(settings);
                filterSearchResults();
            } else if (pageName == "isForumDisplayPage") {
                if (settings.enableTitleStyle) stylePosts(settings);
                const currentURL = window.location.href;
                const queryParams = getQueryParams(currentURL);
                const fid = queryParams.fid;
                if (fid == 143 || fid == "143") {
                    blockingResolvedAction(settings);
                    isOnlyShowMoneyAction(settings);
                }
                if (fid == 166 || fid == "166" || fid == 97 || fid == "97") {
                    await displayThreadBuyInfo(settings);
                }
                displayThreadImages(settings);
            } else if (pageName == "isPostPage") {
                replacePMonPost();
                appendTitleFromHotImage();
                appendBuyNumber();
                showAvatarEvent();
                const userid = getUserId();
                if (userid) addQuickActionToPostButton();
                manipulateMedals(settings);
            } else if (pageName == "isMySpacePage" || pageName == "isSpacePage") {
                displayThreadBuyInfoOther(settings);
            }
        }

        // 搜索页改为无限滚动：到底部后等待3秒，再加载下一页并无缝追加。
        // 保留分页请求逻辑，降低连续翻页触发论坛限制的概率。
        if (isSearchPage) {
            backupSearchPagination();
            updateSearchPaginationLinks();
            loadMoreButton.textContent = "";
            console.log("[98T] 搜索页启用无缝无限滚动");
        }

        loadMoreButton.addEventListener("click", loadNextPage);

        // 以页面底部哨兵为主触发器，避免仅依赖 body 高度导致第三页后失效。
        if ("IntersectionObserver" in window) {
            pageObserver = new IntersectionObserver(function(entries) {
                if (entries.some(function(entry) { return entry.isIntersecting; })) {
                    loadNextPage();
                }
            }, { root: null, rootMargin: "900px 0px", threshold: 0 });
            pageObserver.observe(loadSentinel);
        }

        // 旧浏览器或特殊页面结构下的滚动回退。
        window.addEventListener("scroll", () => {
            if (noMoreData || isLoading) return;

            const scrollPosition = window.innerHeight + window.scrollY;
            const bodyHeight = document.body.offsetHeight;

            if (scrollPosition >= bodyHeight - 400) {
                if (pendingLoadTimer) return;
                pendingLoadTimer = setTimeout(function() {
                    pendingLoadTimer = null;
                    loadNextPage();
                }, 3000);
            }
        });

        setTimeout(checkAndLoad, 2000);

        const observer = new MutationObserver(() => {
            clearTimeout(mutationCheckTimer);
            mutationCheckTimer = setTimeout(function() {
                if (isSearchPage) {
                    ensureSearchPagination();
                    updateSearchPaginationLinks();
                }
                checkAndLoad();
            }, 180);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        console.log("[98T] 无限滚动已启动, 页面:", pageName);
    }
    // #endregion

    // #region 搜索页面处理 (保持原样)
    function handleSearchPage(settings) {
        replaceImageSrc();
        addPageNumbers();
        displayAdvanThreadImages(settings);

        setTimeout(() => {
            initInfiniteScroll("isSearchPage");
        }, 1500);
    }
    // #endregion

    // #region 板块筛选功能
    function getBoardFilterGroup() {
        return GM_getValue('bgsh_filter_group', 'all');
    }
    function setBoardFilterGroup(val) {
        GM_setValue('bgsh_filter_group', val);
    }

    function getBoardFilterIndividual() {
        try {
            return JSON.parse(GM_getValue('bgsh_filter_individual', '[]'));
        } catch { return []; }
    }
    function setBoardFilterIndividual(fids) {
        GM_setValue('bgsh_filter_individual', JSON.stringify(fids));
    }

    function getBoardFilterCollapsed() {
        return GM_getValue('bgsh_filter_collapsed', false);
    }
    function setBoardFilterCollapsed(val) {
        GM_setValue('bgsh_filter_collapsed', val);
    }

    function buildFidMap() {
        const map = {};
        DEFAULT_TID_OPTIONS.forEach(function (opt) {
            map[opt.value] = opt.label;
        });
        return map;
    }

    function applyBoardFilter(mode, param, boardInfos) {
        let visibleFids = new Set();

        if (mode === 'all') {
            boardInfos.forEach(function (info) {
                info.element.style.display = '';
            });
            return;
        }

        if (mode === 'group') {
            const group = SEARCH_BOARD_GROUPS.find(function (g) { return g.label === param; });
            if (group) {
                group.fids.forEach(function (f) { visibleFids.add(f); });
            }
        } else if (mode === 'individual') {
            if (Array.isArray(param)) {
                param.forEach(function (f) { visibleFids.add(f); });
            }
        }

        let visibleCount = 0;
        boardInfos.forEach(function (info) {
            if (visibleFids.size === 0 || visibleFids.has(info.fid)) {
                info.element.style.display = '';
                visibleCount++;
            } else {
                info.element.style.display = 'none';
            }
        });

        const countEl = document.querySelector('.bgsh-board-filter-count');
        if (countEl) {
            countEl.textContent = '(显示 ' + visibleCount + '/' + boardInfos.length + ' 个板块)';
        }
    }

    function getCurrentFid() {
        const m = window.location.pathname.match(/forum-(\d+)-/);
        return m ? parseInt(m[1], 10) : null;
    }

    function initBoardFilter() {
        var boardElements = document.querySelectorAll('[id^="forum_"]');

        if (boardElements.length === 0) {
            boardElements = document.querySelectorAll('.fl_tb[id^="category_"] [id^="forum_"], .fl_tb table[id^="forum_"], .fl_tb tbody[id^="forum_"], .bm_c [id^="forum_"]');
        }

        if (boardElements.length === 0) {
            const cats = document.querySelectorAll('.fl_tb, .fl[class]');
            if (cats.length > 0) {
                if (!window._bgshFilterRetried) {
                    window._bgshFilterRetried = true;
                    setTimeout(initBoardFilter, 2000);
                }
                return;
            }
            return;
        }

        const fidMap = buildFidMap();
        var boardInfos = [];

        var processedIds = {};
        boardElements.forEach(function (el) {
            var m = el.id.match(/forum_(\d+)/);
            if (m) {
                var fid = parseInt(m[1], 10);
                if (processedIds[fid]) return;
                processedIds[fid] = true;

                var container = el.closest('.fl_tb, .fl, .bm, .bm_c, table') || el;
                if (container && container !== el) {
                } else {
                    var parentTable = el.closest('table');
                    if (parentTable) container = parentTable;
                }
                var fltb = container.closest('.fl_tb');
                if (fltb) container = fltb;

                boardInfos.push({ fid: fid, element: container });
            }
        });
        if (boardInfos.length === 0) return;

        const isCollapsed = getBoardFilterCollapsed();
        const filterBar = document.createElement('div');
        filterBar.className = 'bgsh-board-filter';
        filterBar.id = 'bgsh-board-filter';

        function buildGroupsHTML() {
            var html = '<div class="bgsh-board-filter-section">';
            html += '<div class="bgsh-board-filter-section-title">按分组筛选</div>';
            html += '<div class="bgsh-board-filter-groups">';
            html += '<button class="bgsh-board-filter-btn" data-mode="all" data-param="">🌐 全部</button>';
            SEARCH_BOARD_GROUPS.forEach(function (g) {
                html += '<button class="bgsh-board-filter-btn" data-mode="group" data-param="' + g.label.replace(/"/g, '&quot;') + '">' + g.label + '</button>';
            });
            html += '</div></div>';
            return html;
        }

        function buildIndividualHTML() {
            var html = '<div class="bgsh-board-filter-section">';
            html += '<div class="bgsh-board-filter-section-title">📂 板块列表 — 点击板块名进入, 勾选后筛选首页</div>';
            html += '<div class="bgsh-board-filter-rows">';
            SEARCH_BOARD_GROUPS.forEach(function (group) {
                group.fids.forEach(function (fid) {
                    var label = fidMap[fid] || ('fid=' + fid);
                    var boardUrl = '/forum-' + fid + '-1.html';
                    html += '<div class="bgsh-board-filter-row" data-fid="' + fid + '">';
                    html += '<label class="bgsh-board-filter-cb">';
                    html += '<input type="checkbox" value="' + fid + '">';
                    html += '<a href="' + boardUrl + '" class="bgsh-board-link" target="_self">' + label + '</a>';
                    html += '</label>';
                    html += '<span class="bgsh-board-types">';
                    html += '<a href="' + boardUrl + '" class="bgsh-type-pill">全部</a>';
                    html += '</span>';
                    html += '</div>';
                });
            });
            html += '</div></div>';
            return html;
        }

        filterBar.innerHTML =
            '<div class="bgsh-board-filter-header">' +
            '<span>📋 板块筛选</span>' +
            '<span class="bgsh-board-filter-toggle">' + (isCollapsed ? '展开 ▼' : '收起 ▲') + '</span>' +
            '</div>' +
            '<div class="bgsh-board-filter-body' + (isCollapsed ? ' collapsed' : '') + '">' +
            buildGroupsHTML() +
            buildIndividualHTML() +
            '<div class="bgsh-board-filter-count">(共 ' + boardInfos.length + ' 个板块)</div>' +
            '</div>';

        const contentArea = document.querySelector('#wp, .wp, #ct, .ct, #mainarea, .mainbox, #content');
        if (contentArea) {
            contentArea.insertBefore(filterBar, contentArea.firstChild);
        } else {
            document.body.insertBefore(filterBar, document.body.firstChild);
        }

        const header = filterBar.querySelector('.bgsh-board-filter-header');
        const body = filterBar.querySelector('.bgsh-board-filter-body');
        const toggle = filterBar.querySelector('.bgsh-board-filter-toggle');
        header.addEventListener('click', function (e) {
            if (e.target.closest('.bgsh-board-filter-btn') || e.target.closest('label')) return;
            const nowCollapsed = body.classList.toggle('collapsed');
            toggle.textContent = nowCollapsed ? '展开 ▼' : '收起 ▲';
            setBoardFilterCollapsed(nowCollapsed);
        });

        const groupButtons = filterBar.querySelectorAll('.bgsh-board-filter-btn');
        groupButtons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                groupButtons.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');

                const allCheckboxes = filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]');
                allCheckboxes.forEach(function (cb) { cb.checked = false; });

                const mode = this.dataset.mode;
                const param = this.dataset.param;
                if (mode === 'all') {
                    setBoardFilterGroup('all');
                    setBoardFilterIndividual([]);
                    applyBoardFilter('all', null, boardInfos);
                } else if (mode === 'group') {
                    setBoardFilterGroup(param);
                    setBoardFilterIndividual([]);
                    applyBoardFilter('group', param, boardInfos);
                }
            });
        });

        const boardCheckboxes = filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]');
        boardCheckboxes.forEach(function (cb) {
            cb.addEventListener('change', function (e) {
                e.stopPropagation();
                const checkedFids = [];
                filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]').forEach(function (c) {
                    if (c.checked) checkedFids.push(parseInt(c.value, 10));
                });
                groupButtons.forEach(function (b) { b.classList.remove('active'); });
                if (checkedFids.length === 0) {
                    setBoardFilterGroup('all');
                    setBoardFilterIndividual([]);
                    const allBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="all"]');
                    if (allBtn) allBtn.classList.add('active');
                    applyBoardFilter('all', null, boardInfos);
                } else {
                    setBoardFilterGroup('');
                    setBoardFilterIndividual(checkedFids);
                    applyBoardFilter('individual', checkedFids, boardInfos);
                }
            });
        });

        const savedIndividual = getBoardFilterIndividual();
        if (savedIndividual && savedIndividual.length > 0) {
            filterBar.querySelectorAll('.bgsh-board-filter-row input[type="checkbox"]').forEach(function (cb) {
                const fid = parseInt(cb.value, 10);
                if (savedIndividual.indexOf(fid) !== -1) {
                    cb.checked = true;
                }
            });
            groupButtons.forEach(function (b) { b.classList.remove('active'); });
            applyBoardFilter('individual', savedIndividual, boardInfos);
            return;
        }

        const savedGroup = getBoardFilterGroup();
        if (savedGroup && savedGroup !== 'all') {
            const savedBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="group"][data-param="' + savedGroup.replace(/"/g, '&quot;') + '"]');
            if (savedBtn) {
                savedBtn.click();
                return;
            }
        }

        const allBtn = filterBar.querySelector('.bgsh-board-filter-btn[data-mode="all"]');
        if (allBtn) allBtn.classList.add('active');
    }
    // #endregion



    // #region 其他功能 (保持原样)
    function removeIndex() {
        window.addEventListener("load", function() {
            const diyChart = document.querySelector("#diy_chart");
            if (diyChart) diyChart.remove();
        });
    }

    function PostContent() {
        if (!window.location.href.includes("forum.php?mod=post&action=newthread")) return;

        const link = document.createElement("a");
        link.href = "/forum.php?mod=redirect&goto=findpost&ptid=1708826&pid=16039784";
        link.textContent = "📖 发帖须知";
        link.target = "_blank";
        link.style.cssText = "margin-right: 8px; color: #f7971e; text-decoration: none; font-weight: 500;";

        const organizeButton = document.createElement("li");
        organizeButton.className = "a";
        organizeButton.innerHTML = '<button id="organizeBtn" type="button" style="padding: 4px 12px; border: none; border-radius: 6px; background: linear-gradient(135deg, #f7971e, #ffd200); color: #3d2a1a; cursor: pointer;">📋 整理</button>';

        const shareButton = document.createElement("li");
        shareButton.className = "a";
        shareButton.innerHTML = '<button id="shareBtn" type="button" style="padding: 4px 12px; border: none; border-radius: 6px; background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; cursor: pointer;">🔄 自转</button>';

        const ulElement = document.querySelector(".tb.cl.mbw");
        if (ulElement) {
            const li = document.createElement("li");
            li.className = "a";
            li.appendChild(link);
            ulElement.appendChild(li);
            ulElement.appendChild(organizeButton);
            ulElement.appendChild(shareButton);
        }

        var ttttype = "";
        const modalContent = `
            <div id="organizeModal" style="display:none; position:fixed; z-index:1000; left:50%; top:50%; transform:translate(-50%, -50%); background:rgba(255,248,235,0.92); backdrop-filter:blur(20px); padding:24px; border-radius:16px; box-shadow:0 32px 80px rgba(0,0,0,0.25); border:1px solid rgba(255,200,150,0.3); max-width:92vw; max-height:90vh; overflow-y:auto;">
                <div style="display:grid; gap:12px;">
                    <div><strong>【资源名称】：</strong><input type="text" id="resourceName" style="width:100%; padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div><strong>【资源类型】：</strong>
                        <label><input type="radio" name="resourceType" value="影片"/>影片</label>
                        <label><input type="radio" name="resourceType" value="视频" checked/>视频</label>
                        <label><input type="radio" name="resourceType" value="动漫"/>动漫</label>
                        <label><input type="radio" name="resourceType" value="套图"/>套图</label>
                        <label><input type="radio" name="resourceType" value="游戏"/>游戏</label>
                    </div>
                    <div><strong>【是否有码】：</strong>
                        <label><input type="radio" name="censorship" value="有码"/>有码</label>
                        <label><input type="radio" name="censorship" value="无码" checked/>无码</label>
                    </div>
                    <div><strong>【是否水印】：</strong>
                        <label><input type="radio" name="watermark" value="有水印"/>有水印</label>
                        <label><input type="radio" name="watermark" value="无水印" checked/>无水印</label>
                    </div>
                    <div><strong>【字幕】：</strong>
                        <label><input type="radio" name="subtitle" value="中文字幕"/>中文字幕</label>
                        <label><input type="radio" name="subtitle" value="日文字幕"/>日文字幕</label>
                        <label><input type="radio" name="subtitle" value="英文字幕"/>英文字幕</label>
                        <label><input type="radio" name="subtitle" value="无字幕" checked/>无字幕</label>
                    </div>
                    <div><strong>【资源大小】：</strong>
                        <input type="text" id="resourceSize" placeholder="大小" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/>
                        <label><input type="radio" name="sizeUnit" value="M" checked/>M</label>
                        <label><input type="radio" name="sizeUnit" value="G"/>G</label>
                        <label><input type="radio" name="sizeUnit" value="T"/>T</label>
                    </div>
                    <div><strong>【下载类型】：</strong>
                        <label><input type="radio" name="downType" value="115ED2K" checked/>115ED2K</label>
                        <label><input type="radio" name="downType" value="BT/磁链"/>BT/磁链</label>
                        <label><input type="radio" name="downType" value="ED2K"/>ED2K</label>
                        <label><input type="radio" name="downType" value="夸克网盘"/>夸克网盘</label>
                        <label><input type="radio" name="downType" value="百度网盘"/>百度网盘</label>
                        <label><input type="radio" name="downType" value="PikPak网盘"/>PikPak网盘</label>
                        <label><input type="radio" name="downType" value="其它网盘"/>其它网盘</label>
                    </div>
                    <div>视频数量: <input type="text" id="videoCount" placeholder="视频数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div>图片数量: <input type="text" id="imageCount" placeholder="图片数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div>配额数量: <input type="text" id="quota" placeholder="配额数量" style="padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <div><strong>【资源预览】：</strong></div>
                    <div><strong>【资源链接】：</strong><input type="text" id="resourceLink" style="width:100%; padding:6px 12px; border:2px solid rgba(0,0,0,0.06); border-radius:8px; background:rgba(255,255,255,0.5);"/></div>
                    <button id="insetBtn" type="button" style="padding:8px 20px; border:none; border-radius:8px; background:linear-gradient(135deg,#f7971e,#ffd200); color:#3d2a1a; cursor:pointer; font-weight:500;">✅ 插入</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML("beforeend", modalContent);

        document.getElementById("organizeBtn").addEventListener("click", function() {
            document.getElementById("organizeModal").style.display = "block";
            ttttype = "整理";
        });
        document.getElementById("shareBtn").addEventListener("click", function() {
            document.getElementById("organizeModal").style.display = "block";
            ttttype = "自转";
        });

        document.getElementById("insetBtn").addEventListener("click", function() {
            const resourceName = document.getElementById("resourceName").value;
            const resourceType = document.querySelector('input[name="resourceType"]:checked')?.value;
            const censorship = document.querySelector('input[name="censorship"]:checked')?.value;
            const watermark = document.querySelector('input[name="watermark"]:checked')?.value;
            const subtitle = document.querySelector('input[name="subtitle"]:checked')?.value;
            const resourceLink = document.getElementById("resourceLink").value;
            const downType = document.querySelector('input[name="downType"]:checked')?.value;
            const resourceSize = document.getElementById("resourceSize").value;
            const sizeUnit = document.querySelector('input[name="sizeUnit"]:checked').value;
            const videoCount = document.getElementById("videoCount").value;
            const imageCount = document.getElementById("imageCount").value;
            const quota = document.getElementById("quota").value;

            let resourceSizeStr = resourceSize ? `${resourceSize}${sizeUnit}` : "";
            let videoCountStr = videoCount ? `${videoCount}V` : "";
            let imageCountStr = imageCount ? `${imageCount}P` : "";
            let quotaStr = quota ? `${quota}配额` : "";

            const content = `
                【资源名称】：${resourceName}<br>
                【资源类型】：${resourceType}<br>
                【是否有码】：${censorship} @ ${watermark} @ ${subtitle}<br>
                【资源大小】：${resourceSizeStr}/${videoCountStr}/${imageCountStr}/${quotaStr}<br>
                【资源预览】：<br>
                【资源链接】：<div class="blockcode"><blockquote>${resourceLink}</blockquote></div><br>
            `;

            const iframe = document.querySelector(".area iframe");
            if (iframe && iframe.contentDocument) {
                const body = iframe.contentDocument.body;
                if (body && body.isContentEditable) {
                    body.innerHTML = content;
                }
            }

            const title = `【${ttttype}】【${downType}】${resourceName}【${resourceSizeStr}/${videoCountStr}/${imageCountStr}/${quotaStr}】`;
            const subjectInput = document.getElementById("subject");
            if (subjectInput) subjectInput.value = title;

            var selectElement = document.getElementById("typeid");
            if (selectElement) selectElement.setAttribute("selecti", "8");

            var aElement = document.querySelector(".ftid a#typeid_ctrl");
            if (aElement) {
                aElement.textContent = "情色分享";
                aElement.setAttribute("initialized", "true");
            }

            document.getElementById("organizeModal").style.display = "none";
            showToast("✅ 帖子内容已整理", "success");
        });
    }

function createMenuButton(settings) {
    const menuButton = document.createElement("button");
    menuButton.title = settings.menuButtonIsVisible ? "隐藏工具栏" : "显示工具栏";

    const eyeOpenSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;

        const eyeCloseSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;

        const buttonColor = settings.menuButtonIsVisible ? "#f7971e" : "#ff6b6b";

        menuButton.innerHTML = settings.menuButtonIsVisible ? eyeOpenSVG : eyeCloseSVG;

        Object.assign(menuButton.style, {
            position: "fixed",
            zIndex: "1001",
            cursor: "pointer",
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: buttonColor,
            color: "white",
            border: "none",
            boxShadow: "0 4px 20px rgba(247,151,30,0.3)",
            transition: "all 0.3s ease",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: "1",
            outline: "none",
            right: "12px",
        });

        menuButton.addEventListener('mouseenter', () => {
            menuButton.style.transform = 'scale(1.1)';
            menuButton.style.boxShadow = '0 6px 30px rgba(247,151,30,0.5)';
        });
        menuButton.addEventListener('mouseleave', () => {
            menuButton.style.transform = 'scale(1)';
            menuButton.style.boxShadow = '0 4px 20px rgba(247,151,30,0.3)';
        });

        return menuButton;
    }

function toggleContainer(menuButton, container) {
    const settings = getSettings();
    let isVisible = settings.menuButtonIsVisible;

    const eyeOpenSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;

        const eyeCloseSVG = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;

        menuButton.addEventListener("click", () => {
            if (isVisible) {
                container.style.display = "none";
                menuButton.innerHTML = eyeCloseSVG;
                menuButton.title = "显示工具栏";
                menuButton.style.backgroundColor = "#ff6b6b";
                menuButton.style.boxShadow = '0 4px 20px rgba(255,107,107,0.3)';
                isVisible = false;
            } else {
                container.style.display = "flex";
                menuButton.innerHTML = eyeOpenSVG;
                menuButton.title = "隐藏工具栏";
                menuButton.style.backgroundColor = "#f7971e";
                menuButton.style.boxShadow = '0 4px 20px rgba(247,151,30,0.3)';
                isVisible = true;
            }
            GM_setValue("menuButtonIsVisible", isVisible);
        });
    }

function setMenuButtonPosition(menuButton, container) {
    if (!document.body.contains(menuButton)) {
        document.body.appendChild(menuButton);
    }

    requestAnimationFrame(() => {
        let containerRect = container.getBoundingClientRect();

        if (containerRect.top === 0 && containerRect.bottom === 0) {
            menuButton.style.top = '80px';
            menuButton.style.right = '12px';
            return;
        }

        const buttonHeight = menuButton.offsetHeight || 44;
        const gap = 16;
        let topPos = containerRect.top - buttonHeight - gap;

        if (topPos < 10) {
            topPos = containerRect.top + 10;
        }

        if (topPos + buttonHeight > window.innerHeight - 10) {
            topPos = window.innerHeight - buttonHeight - 10;
        }

        menuButton.style.top = topPos + 'px';
        menuButton.style.right = '12px';
    });
}


function createSearchFilterButton(buttonContainer) {
    if (!window.location.href.includes("search.php")) return;
    var btn = createButton("bgshSearchFilterBtn", "🔍 搜索筛选", function() {
        var panel = document.getElementById("bgsh-search-result-filter");
        if (!panel) {
            if (typeof initSearchResultFilter === "function") {
                initSearchResultFilter();
                panel = document.getElementById("bgsh-search-result-filter");
            }
        }
        if (panel) {
            var collapsed = panel.classList.toggle("collapsed");
            GM_setValue("bgsh_search_result_filter_collapsed", collapsed);
            panel.style.display = collapsed ? "none" : "";
        }
    });
    buttonContainer.insertBefore(btn, buttonContainer.firstChild);
}

function createt98tButton(buttonContainer) {
    var t98tButton = createButton("t98tButton", "⚙️ 功能设置", () => createSettingsUI(getSettings()));
    buttonContainer.appendChild(t98tButton);
}
// #endregion

// #region 更新检查 (保持原样)
async function checkForUpdates() {
    const currentVersion = GM.info.script.version;
    const updateURL = "https://sleazyfork.org/zh-CN/scripts/512445-%E4%B9%9D%E5%85%AB%E5%A0%82%E6%B0%B8%E4%B9%85%E7%BD%91%E5%9D%80www-98t-la/code";

    try {
        let response = await fetch(updateURL);
        let data = await response.text();
        const matchVersion = data.match(/@version\s+([\d.]+)/);

        if (matchVersion && matchVersion[1] && parseFloat(matchVersion[1]) > parseFloat(currentVersion)) {
            showUpdateDialog();
        }
        GM_setValue("lastCheckedUpdate", Date.now());
    } catch (error) {
        console.error("检查更新时出错:", error);
    }
}

function showUpdateDialog() {
    const dialogHTML = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); backdrop-filter:blur(12px); z-index:99999; display:flex; justify-content:center; align-items:center;">
                <div style="background:rgba(255,248,235,0.92); backdrop-filter:blur(20px); padding:28px 36px; border-radius:20px; text-align:center; border:1px solid rgba(255,200,150,0.3); box-shadow:0 32px 80px rgba(0,0,0,0.25); max-width:400px;">
                    <div style="font-size:48px; margin-bottom:12px;">🎉</div>
                    <p style="font-size:16px; font-weight:600; color:#4a2e1b; margin-bottom:8px;">有新版本可用！</p>
                    <p style="font-size:13px; color:#666; margin-bottom:20px;">九八堂脚本已更新，请点击下方按钮更新</p>
                    <a href="https://sleazyfork.org/zh-CN/scripts/512445-%E4%B9%9D%E5%85%AB%E5%A0%82%E6%B0%B8%E4%B9%85%E7%BD%91%E5%9D%80www-98t-la" target="_blank" style="display:inline-block; padding:10px 32px; background:linear-gradient(135deg,#f7971e,#ffd200); color:#3d2a1a; border-radius:10px; text-decoration:none; font-weight:500; margin-bottom:12px;">🔄 立即更新</button>
                    <br>
                    <button onclick="this.closest('div[style]').parentElement.remove();" style="padding:6px 20px; border:none; background:rgba(0,0,0,0.06); border-radius:8px; cursor:pointer; color:#666; font-size:13px;">关闭</button>
                </div>
            </div>`;

        const tempDiv = document.createElement("div");
        tempDiv.className = "updateDialog";
        tempDiv.innerHTML = dialogHTML;
        document.body.appendChild(tempDiv);
    }
// #endregion

// #region 设置界面 (升级版)
function generateSettingsHTML(settings) {
    return `
            <div class="bgsh-dialog-overlay" id="settingsUIContainer">
                <div class="bgsh-dialog" id="bgshSettingsDrag">
                    <div class="bgsh-dialog-header" id="bgshSettingsDragHandle">
                        <div class="bgsh-dialog-title">
                            ⚙️ 功能设置 <span class="badge">v4.4</span>
                        </div>
                        <button class="bgsh-dialog-close" id="closeButton">&times;</button>
                    </div>
                    <div style="display:flex;flex:1;overflow:hidden;">
                        <div class="bgsh-settings-tabs">
                            <button class="bgsh-tab-btn active" data-tab="tab-general">📋 通用</button>
                            <button class="bgsh-tab-btn" data-tab="tab-display">🎨 显示</button>
                            <button class="bgsh-tab-btn" data-tab="tab-features">🔧 功能</button>
                            <button class="bgsh-tab-btn" data-tab="tab-search">🔍 搜索</button>
                            <button class="bgsh-tab-btn" data-tab="tab-block">🚫 屏蔽</button>
                        </div>
                        <div class="bgsh-settings-content">
                            <!-- 通用 -->
                            <div class="bgsh-tab-panel active" id="tab-general">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="tipsTextInput">💬 提示文字</label>
                                        <input type="text" id="tipsTextInput" value="${settings.tipsText}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="logoTextInput">✨ 评分/特效文字</label>
                                        <input type="text" id="logoTextInput" value="${settings.logoText}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="maxGradeThread">⭐ 主贴评分最大值</label>
                                        <input type="number" id="maxGradeThread" value="${settings.maxGradeThread}" min="1" max="100">
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="autoPaginationCheckbox" ${settings.autoPagination?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">自动翻页</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="defaultSwipeToSearchCheckbox" ${settings.defaultSwipeToSearch?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">划词搜索</span></label>
                                    </div>
                                </div>
                            </div>
                            <!-- 显示 -->
                            <div class="bgsh-tab-panel" id="tab-display">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="imageSizeInput">🏅 勋章尺寸</label>
                                        <input type="text" id="imageSizeInput" value="${settings.imageSize}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="imageUrlInput">🖼️ 替换勋章图片链接</label>
                                        <input type="text" id="imageUrlInput" value="${settings.imageUrl}">
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🎖️ 勋章隐藏</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="0" ${settings.blockMedals===0?'checked':''}> 不隐藏</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="1" ${settings.blockMedals===1?'checked':''}> 隐藏所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="blockMedals" value="2" ${settings.blockMedals===2?'checked':''}> 隐藏女优勋章</label>
                                        </div>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label>📐 修改勋章尺寸</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="0" ${settings.resizeMedals===0?'checked':''}> 不修改</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="1" ${settings.resizeMedals===1?'checked':''}> 修改所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="resizeMedals" value="2" ${settings.resizeMedals===2?'checked':''}> 修改女优勋章</label>
                                        </div>
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label>🔄 替换勋章</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="0" ${settings.replaceMedals===0?'checked':''}> 不替换</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="1" ${settings.replaceMedals===1?'checked':''}> 替换所有</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="replaceMedals" value="2" ${settings.replaceMedals===2?'checked':''}> 替换女优勋章</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="titleStyleSizeInput">📏 标题字体大小</label>
                                        <input type="text" id="titleStyleSizeInput" value="${settings.titleStyleSize}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="titleStyleWeightInput">💪 标题字体粗细</label>
                                        <input type="text" id="titleStyleWeightInput" value="${settings.titleStyleWeight}">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="threadPreviewCountInput">🖼️ 每个主题预览图数量1-12</label>
                                        <input type="number" id="threadPreviewCountInput" value="${settings.threadPreviewCount}" min="1" max="12">
                                    </div>
                                    <div class="bgsh-setting-item">
                                        <label for="visitedThreadColorInput">🎨 已查看主题颜色</label>
                                        <input type="color" id="visitedThreadColorInput" value="${settings.visitedThreadColor}">
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="enableTitleStyleCheckbox" ${settings.enableTitleStyle?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">启用帖子标题样式</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showAvatarCheckbox" ${settings.showAvatar?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">显示用户头像</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="displayThreadImagesCheckbox" ${settings.displayThreadImages?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">图片预览</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="displayThreadBuyInfoCheckbox" ${settings.displayThreadBuyInfo?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">显示购买次数</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="isShowWatermarkMessageCheckbox" ${settings.isShowWatermarkMessage?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">点击特效</span></label>
                                    </div>
                                </div>
                            </div>
                            <!-- 功能 -->
                            <div class="bgsh-tab-panel" id="tab-features">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showDownCheckbox" ${settings.showDown?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">下载附件</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showCopyCodeCheckbox" ${settings.showCopyCode?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">复制代码</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastPostCheckbox" ${settings.showFastPost?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速发帖</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastReplyCheckbox" ${settings.showFastReply?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速回复</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showQuickGradeCheckbox" ${settings.showQuickGrade?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">一键评分</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showQuickStarCheckbox" ${settings.showQuickStar?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">快速收藏</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showClickDoubleCheckbox" ${settings.showClickDouble?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">一键二连</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showViewRatingsCheckbox" ${settings.showViewRatings?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">查看评分</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showPayLogCheckbox" ${settings.showPayLog?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">购买记录</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="showFastCopyCheckbox" ${settings.showFastCopy?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">复制帖子</span></label>
                                        <label class="bgsh-switch-label"><input type="checkbox" id="blockingIndexCheckbox" ${settings.blockingIndex?'checked':''}><span class="bgsh-switch-slider"></span><span class="bgsh-switch-text">屏蔽首页热门</span></label>
                                    </div>
                                </div>
                            </div>
                            <!-- 搜索 -->
                            <div class="bgsh-tab-panel" id="tab-search">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-switch-grid">
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="searchCacheEnabled" ${settings.searchCacheEnabled?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">⚡ 搜索缓存</span>
                                        </label>
                                        <label class="bgsh-switch-label">
                                            <input type="checkbox" id="searchAutoComplete" ${settings.searchAutoComplete?'checked':''}>
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">📝 自动补全</span>
                                        </label>
                                        <label class="bgsh-switch-label">
                                            <span class="bgsh-switch-slider"></span>
                                            <span class="bgsh-switch-text">⌨️ 快捷键 (Ctrl+Shift+F)</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label>🔢 默认排序方式</label>
                                        <div class="bgsh-radio-group">
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="relevance" ${settings.searchSort==="relevance"?"checked":""}> 相关度</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="dateline" ${settings.searchSort==="dateline"?"checked":""}> 发布时间</label>
                                            <label class="bgsh-radio-label"><input type="radio" name="settingsSearchSort" value="lastpost" ${settings.searchSort==="lastpost"?"checked":""}> 回复时间</label>
                                        </div>
                                        <span class="bgsh-hint">设置搜索时的默认排序方式</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="searchHistoryCount">📊 保存历史数量</label>
                                        <input type="number" id="searchHistoryCount" value="20" min="5" max="50">
                                        <span class="bgsh-hint">保存的搜索历史条目数</span>
                                    </div>
                                </div>
                                <div class="bgsh-setting-group">
                                    <button class="bgsh-customBtn" id="clearSearchCache" style="width:auto;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;">🗑️ 清空搜索缓存</button>
                                    <button class="bgsh-customBtn" id="clearSearchHistory" style="width:auto;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:#fff;">🗑️ 清空搜索历史</button>
                                </div>
                            </div>
                            <!-- 屏蔽 -->
                            <div class="bgsh-tab-panel" id="tab-block">
                                <div class="bgsh-setting-group">
                                    <div class="bgsh-setting-item">
                                        <label for="blockedUsersList">🚫 黑名单用户名（每行一个）</label>
                                        <textarea id="blockedUsersList" rows="4">${settings.blockedUsers.join("\n")}</textarea>
                                        <span class="bgsh-hint">输入需要屏蔽的用户名，每行一个</span>
                                    </div>
                                    <label class="bgsh-switch-label">
                                        <input type="checkbox" id="displayBlockedTipsCheckbox" ${settings.displayBlockedTips?'checked':''}>
                                        <span class="bgsh-switch-slider"></span>
                                        <span class="bgsh-switch-text">显示屏蔽提示</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bgsh-dialog-footer">
                        <button class="bgsh-customBtn" id="resetButton" style="width:auto;background:rgba(255,255,255,0.5);color:#666;">🔄 重置默认</button>
                        <button class="bgsh-customBtn" id="saveButton" style="width:auto;">💾 保存设置</button>
                    </div>
                </div>
            </div>
        `;
    }

function createSettingsUI(settings) {
    const existingContainer = document.getElementById("settingsUIContainer");
    if (existingContainer) {
        existingContainer.remove();
    }

    applyTheme(getTheme());

    const containerHTML = generateSettingsHTML(settings);
    const container = document.createElement("div");
    container.id = "settingsUIContainer";
    container.innerHTML = containerHTML;
    document.body.appendChild(container);

    const dialog = document.getElementById("bgshSettingsDrag");
    const handle = document.getElementById("bgshSettingsDragHandle");
    if (dialog && handle) {
        makeDraggable(dialog, handle);
    }

    const saveButton = document.getElementById("saveButton");
    const closeButton = document.getElementById("closeButton");
    const resetButton = document.getElementById("resetButton");

    const clearCacheBtn = document.getElementById("clearSearchCache");
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener("click", function() {
            const keys = GM_listValues ? GM_listValues() : [];
            let count = 0;
            keys.forEach(key => {
                if (key.startsWith('bgsh_cache_')) {
                    GM_deleteValue(key);
                    count++;
                }
            });
            showToast("🗑️ 已清空 " + count + " 条搜索缓存", "success");
        });
    }

    const clearHistoryBtn = document.getElementById("clearSearchHistory");
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", function() {
            GM_setValue('bgshSearchHistory', JSON.stringify([]));
            showToast("🗑️ 搜索历史已清空", "success");
        });
    }

    saveButton.addEventListener("click", function() {
        saveSettings(settings);
        container.style.display = "none";
        showToast("✅ 设置已保存", "success");
    });

    closeButton.addEventListener("click", () => container.style.display = "none");

    resetButton.addEventListener("click", function() {
        if (confirm("确定要重置所有设置为默认值吗？")) {
            resetSettings();
            container.style.display = "none";
            showToast("🔄 已重置为默认值", "warning");
            setTimeout(() => location.reload(), 500);
        }
    });

    const tabBtns = container.querySelectorAll(".bgsh-tab-btn");
    const tabPanels = container.querySelectorAll(".bgsh-tab-panel");

    tabBtns.forEach((btn) => {
        btn.addEventListener("click", function() {
            tabBtns.forEach((b) => b.classList.remove("active"));
            tabPanels.forEach((p) => p.classList.remove("active"));
            this.classList.add("active");
            const targetId = this.dataset.tab;
            document.getElementById(targetId).classList.add("active");
        });
    });

    container.addEventListener("click", function(e) {
        if (e.target === this) {
            this.style.display = "none";
        }
    });

    const escHandler = (e) => {
        if (e.key === 'Escape' && container.style.display !== 'none') {
            container.style.display = 'none';
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function makeDraggable(container, handle) {
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = container.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origX = rect.left;
        origY = rect.top;
        container.style.transition = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.style.left = (origX + dx) + 'px';
        container.style.top = (origY + dy) + 'px';
        container.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.style.transition = '';
            document.body.style.userSelect = '';
        }
    });
}

function resetSettings() {
    const defaults = {
        logoText: "永久地址 WWW.98T.LA",
        tipsText: "九八堂提醒你",
        imageSize: "50px",
        imageUrl: "/static/image/common/logo.png",
        blockMedals: 0,
        resizeMedals: 0,
        replaceMedals: 0,
        displayBlockedTips: true,
        autoPagination: true,
        showImageButton: "hide",
        enableTitleStyle: true,
        titleStyleSize: 20,
        titleStyleWeight: 700,
        blockedUsers: [],
        showAvatar: true,
        maxGradeThread: 10,
        defaultSwipeToSearch: true,
        displayThreadImages: false,
        threadPreviewCount: 3,
        visitedThreadColor: "#999999",
        displayThreadBuyInfo: true,
        isShowWatermarkMessage: true,
        showDown: true,
        showCopyCode: true,
        showFastPost: true,
        showFastReply: true,
        showQuickGrade: true,
        showQuickStar: true,
        showClickDouble: true,
        showViewRatings: true,
        showPayLog: true,
        showFastCopy: true,
        blockingResolved: true,
        isOnlyShowMoney: false,
        blockingIndex: false,
        menuButtonIsVisible: true,
        searchCacheEnabled: true,
        searchAutoComplete: true,
        searchResultCount: 50,
        searchHotKeys: true,
    };

    for (let key in defaults) {
        GM_setValue(key, defaults[key]);
    }
}

function saveSettings(settings) {
    const oldSettings = getSettings();

    settings.imageSize = document.getElementById("imageSizeInput").value;
    settings.logoText = document.getElementById("logoTextInput").value;
    settings.titleStyleSize = document.getElementById("titleStyleSizeInput").value;
    settings.titleStyleWeight = document.getElementById("titleStyleWeightInput").value;
    settings.threadPreviewCount = Math.max(1, Math.min(12, parseInt(document.getElementById("threadPreviewCountInput").value, 10) || 3));
    settings.visitedThreadColor = document.getElementById("visitedThreadColorInput").value || "#999999";
    settings.tipsText = document.getElementById("tipsTextInput").value;
    settings.showDown = document.getElementById("showDownCheckbox").checked;
    settings.showCopyCode = document.getElementById("showCopyCodeCheckbox").checked;
    settings.showFastPost = document.getElementById("showFastPostCheckbox").checked;
    settings.showFastReply = document.getElementById("showFastReplyCheckbox").checked;
    settings.showQuickGrade = document.getElementById("showQuickGradeCheckbox").checked;
    settings.showQuickStar = document.getElementById("showQuickStarCheckbox").checked;
    settings.showClickDouble = document.getElementById("showClickDoubleCheckbox").checked;
    settings.showViewRatings = document.getElementById("showViewRatingsCheckbox").checked;
    settings.showPayLog = document.getElementById("showPayLogCheckbox").checked;
    settings.showFastCopy = document.getElementById("showFastCopyCheckbox").checked;
    settings.blockingIndex = document.getElementById("blockingIndexCheckbox").checked;
    settings.imageUrl = document.getElementById("imageUrlInput").value;
    settings.displayBlockedTips = document.getElementById("displayBlockedTipsCheckbox").checked;
    settings.blockedUsers = document.getElementById("blockedUsersList").value.split("\n")
        .map(name => name.trim()).filter(user => user.trim() !== "");
    settings.enableTitleStyle = document.getElementById("enableTitleStyleCheckbox").checked;
    settings.autoPagination = document.getElementById("autoPaginationCheckbox").checked;
    settings.blockMedals = getCheckedRadioValue("blockMedals");
    settings.resizeMedals = getCheckedRadioValue("resizeMedals");
    settings.replaceMedals = getCheckedRadioValue("replaceMedals");
    settings.showAvatar = document.getElementById("showAvatarCheckbox").checked;
    settings.displayThreadImages = document.getElementById("displayThreadImagesCheckbox").checked;
    settings.displayThreadBuyInfo = document.getElementById("displayThreadBuyInfoCheckbox").checked;
    settings.isShowWatermarkMessage = document.getElementById("isShowWatermarkMessageCheckbox").checked;
    settings.maxGradeThread = document.getElementById("maxGradeThread").value;
    settings.defaultSwipeToSearch = document.getElementById("defaultSwipeToSearchCheckbox").checked;

    settings.searchCacheEnabled = document.getElementById("searchCacheEnabled").checked;
    settings.searchAutoComplete = document.getElementById("searchAutoComplete").checked;
    settings.searchSort = document.querySelector('input[name="settingsSearchSort"]:checked')?.value || 'relevance';

    const settingsToSave = {
        imageSize: settings.imageSize,
        logoText: settings.logoText,
        tipsText: settings.tipsText,
        imageUrl: settings.imageUrl,
        blockMedals: settings.blockMedals,
        resizeMedals: settings.resizeMedals,
        replaceMedals: settings.replaceMedals,
        displayBlockedTips: settings.displayBlockedTips,
        blockedUsers: settings.blockedUsers,
        enableTitleStyle: settings.enableTitleStyle,
        titleStyleSize: settings.titleStyleSize,
        titleStyleWeight: settings.titleStyleWeight,
        autoPagination: settings.autoPagination,
        showAvatar: settings.showAvatar,
        maxGradeThread: settings.maxGradeThread,
        defaultSwipeToSearch: settings.defaultSwipeToSearch,
        displayThreadImages: settings.displayThreadImages,
        threadPreviewCount: settings.threadPreviewCount,
        visitedThreadColor: settings.visitedThreadColor,
        displayThreadBuyInfo: settings.displayThreadBuyInfo,
        isShowWatermarkMessage: settings.isShowWatermarkMessage,
        showDown: settings.showDown,
        showCopyCode: settings.showCopyCode,
        showFastPost: settings.showFastPost,
        showFastReply: settings.showFastReply,
        showQuickGrade: settings.showQuickGrade,
        showQuickStar: settings.showQuickStar,
        showClickDouble: settings.showClickDouble,
        showViewRatings: settings.showViewRatings,
        showPayLog: settings.showPayLog,
        showFastCopy: settings.showFastCopy,
        blockingIndex: settings.blockingIndex,
        searchCacheEnabled: settings.searchCacheEnabled,
        searchAutoComplete: settings.searchAutoComplete,
        searchSort: settings.searchSort,
    };

    for (let key in settingsToSave) {
        GM_setValue(key, settingsToSave[key]);
    }

    manipulateMedals(settings);
    applyVisitedThreadColor(settings);
    if (settings.enableTitleStyle) {
        stylePosts(settings);
    } else {
        undoStylePosts();
    }
    showAvatarEvent();

    if (oldSettings.blockingIndex !== settings.blockingIndex ||
        oldSettings.showFastCopy !== settings.showFastCopy ||
        oldSettings.showViewRatings !== settings.showViewRatings ||
        oldSettings.showPayLog !== settings.showPayLog ||
        oldSettings.showClickDouble !== settings.showClickDouble ||
        oldSettings.showQuickStar !== settings.showQuickStar ||
        oldSettings.showQuickGrade !== settings.showQuickGrade ||
        oldSettings.showFastReply !== settings.showFastReply ||
        oldSettings.showFastPost !== settings.showFastPost ||
        oldSettings.showCopyCode !== settings.showCopyCode ||
        oldSettings.showDown !== settings.showDown ||
        oldSettings.displayBlockedTips !== settings.displayBlockedTips ||
        oldSettings.displayThreadImages !== settings.displayThreadImages ||
        oldSettings.threadPreviewCount !== settings.threadPreviewCount ||
        oldSettings.displayThreadBuyInfo !== settings.displayThreadBuyInfo ||
        oldSettings.autoPagination !== settings.autoPagination ||
        oldSettings.blockedUsers.toString() !== settings.blockedUsers.toString() ||
        oldSettings.defaultSwipeToSearch !== settings.defaultSwipeToSearch ||
        oldSettings.searchCacheEnabled !== settings.searchCacheEnabled ||

        oldSettings.searchSort !== settings.searchSort ||
        settings.replaceMedals === 0 ||
        settings.replaceMedals === 2) {
        location.reload();
    }
}
// #endregion

// #region 主程序
function setupImageZoom() {
    document.addEventListener('click', (e) => {
        const img = e.target.closest('img.zoom, img[file]');
        if (!img) return;

        const src = img.getAttribute('file') || img.src;
        if (!src) return;

        if (document.querySelector('.bgsh-image-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'bgsh-image-overlay';
        const clonedImg = document.createElement('img');
        clonedImg.src = src;
        overlay.appendChild(clonedImg);

        overlay.addEventListener('click', () => {
            overlay.remove();
        });

        document.body.appendChild(overlay);
    });
}

async function baseFunction(settings) {
    if (settings.blockingIndex) removeIndex();

    manipulateMedals(settings);
    addStyles();
    applyTheme(getTheme());
    applyVisitedThreadColor(settings);
    initFavorites();
    applyPreviewSize(getPreviewSize());

    setupImageZoom();

    const buttonContainer = createButtonContainer();
    createSearchFilterButton(buttonContainer);
    buttonContainer.style.display = settings.menuButtonIsVisible ? "flex" : "none";

    // 预览大小调节
    try {
        var pvSize = getPreviewSize();
        var pvBtn = document.createElement("button");
        pvBtn.id = "bgshPreviewSizeBtn";
        pvBtn.className = "bgsh-customBtn";
        pvBtn.textContent = "\uD83D\uDDBC\uFE0F \u6700\u5927" + pvSize + "px";
        pvBtn.title = "\u8BBE\u7F6E\u9884\u89C8\u56FE\u6700\u5927\u5BBD\u9AD8\uFF0C\u6309\u539F\u56FE\u6BD4\u4F8B\u663E\u793A\uFF0C\u5355\u51FB\u5207\u6362\uFF0C\u53CC\u51FB\u8F93\u5165\uFF0C\u6EDA\u8F6E\u5FAE\u8C03";
        var previewClickTimer = null;
        pvBtn.addEventListener("click", function(e) {
            if (e.detail > 1) return;
            clearTimeout(previewClickTimer);
            previewClickTimer = setTimeout(function() {
                var sizes = [100, 120, 140, 160, 180, 200, 250, 300];
                var cur = getPreviewSize();
                var idx = sizes.indexOf(cur);
                var next = (idx >= 0) ? sizes[(idx + 1) % sizes.length] : 160;
                setPreviewSize(next);
            }, 220);
        });
        pvBtn.addEventListener("dblclick", function() {
            clearTimeout(previewClickTimer);
            var pvinput = prompt("\u8F93\u5165\u9884\u89C8\u56FE\u6700\u5927\u5BBD\u9AD8(px)\uFF0C80~400\uFF0C\u6309\u539F\u56FE\u6BD4\u4F8B\u663E\u793A:", getPreviewSize());
            if (pvinput !== null) {
                var pvval = parseInt(pvinput, 10);
                if (!isNaN(pvval) && pvval >= 80 && pvval <= 400) {
                    setPreviewSize(pvval);
                } else {
                    showToast("\u8BF7\u8F93\u5165 80~400 \u4E4B\u95F4\u7684\u6570\u5B57", "warning", 2000);
                }
            }
        });
        pvBtn.addEventListener("wheel", function(e) {
            e.preventDefault();
            var cur = getPreviewSize();
            var step = e.deltaY > 0 ? -10 : 10;
            var next = Math.max(80, Math.min(400, cur + step));
            setPreviewSize(next);
        });
        buttonContainer.appendChild(pvBtn);
    } catch(e) {}

    await delegatePageHandlers(settings, buttonContainer);
    blockContentByUsers(settings);

    if (/search\.php/.test(window.location.href)) {
        setTimeout(() => displayAdvanThreadImages(settings), 500);
    }

    document.body.appendChild(buttonContainer);
    initSehuatangReplySummary(buttonContainer);
    PostContent();
    createt98tButton(buttonContainer);

    const menuButton = createMenuButton(settings);
    setMenuButtonPosition(menuButton, buttonContainer);
    toggleContainer(menuButton, buttonContainer);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getTheme() === 'auto') applyTheme('auto');
    });

    cleanSearchCache();

    // 初始化板块筛选
    var isBoardPage = isBoardListPage();
    var isForumIndex = !isBoardPage && document.querySelectorAll('[id^="forum_"], .fl_tb').length > 0;

    if (isForumIndex) {
        setTimeout(function () { initBoardFilter(); }, 400);
    }
}

function isBoardListPage() {
    if (/forum-(\d+)-/.test(window.location.pathname)) return true;
    var url = window.location.href;
    if (/[?&]mod=forumdisplay(&|#|$)/.test(url)) return true;
    if (document.querySelector('#threadlist, .threadlist')) return true;
    return false;
}


    // #region 收藏夹整理（合并自“色花堂收藏整理”，以增强脚本为主）
    function initFavoriteOrganizer() {
        if (window.__bgshFavoriteOrganizerInitialized) return window.__bgshFavoriteOrganizerPromise || Promise.resolve();
        window.__bgshFavoriteOrganizerInitialized = true;
        window.__bgshFavoriteOrganizerPromise = new Promise((resolve) => {

            // 1. 判断当前页面类型：黑名单机制，排查 forum 与 article
            function bgshFavoriteOrganizerIsTargetTypePage() {
                const urlParams = new URLSearchParams(window.location.search);
                const type = urlParams.get('type');
                return !(type === 'forum' || type === 'article');
            }

            if (!bgshFavoriteOrganizerIsTargetTypePage()) {
                console.log('[Discuz全量收藏分类] 当前是版块/文章收藏页面，脚本跳过执行。');
                resolve();
                return;
            }

            console.log('[色花堂增强收藏整理] 已合并启动，使用 20 线程解析收藏详情...');

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
            function bgshFavoriteOrganizerGetCache() {
                try {
                    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
                } catch (e) {
                    return {};
                }
            }
            function bgshFavoriteOrganizerSetCache(cacheObj) {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
                } catch (e) {}
            }
            function bgshFavoriteOrganizerClearCache() {
                try {
                    localStorage.removeItem(CACHE_KEY);
                } catch (e) {}
            }

            // 哈希函数：根据版块名称生成固定的渐变色索引
            function bgshFavoriteOrganizerGetGradientForForum(forumName) {
                let hash = 0;
                for (let i = 0; i < forumName.length; i++) {
                    hash = forumName.charCodeAt(i) + ((hash << 5) - hash);
                }
                const index = Math.abs(hash) % PASTEL_GRADIENTS.length;
                return PASTEL_GRADIENTS[index];
            }

            // 轮询等待 DOM 加载
            let organizerStarted = false;
            const timer = setInterval(() => {
                const favUl = document.querySelector('#favorite_ul, .tbmu + ul, #ct ul, .ptm ul');
                if (favUl) {
                    organizerStarted = true;
                    clearInterval(timer);
                    initAllPagesProcess(favUl).finally(resolve);
                }
            }, 500);

            setTimeout(() => {
                clearInterval(timer);
                if (!organizerStarted) resolve();
            }, 10000);

            async function initAllPagesProcess(favContainer) {
                const cacheMap = bgshFavoriteOrganizerGetCache();

                // 状态提示条
                const statusMsg = document.createElement('div');
                statusMsg.id = 'fav_parse_status';
                statusMsg.style.cssText = 'padding: 10px 15px; background: #e6f7ff; border: 1px solid #91d5ff; margin-bottom: 12px; color: #1890ff; font-size: 13px; border-radius: 4px; line-height: 1.6;';
                statusMsg.innerHTML = '🔍 正在分析收藏夹数据...';

                const mainContainer = document.querySelector('#ct .mn, .bm, #ct') || document.body;
                mainContainer.insertBefore(statusMsg, mainContainer.firstChild);

                // 获取总页数
                const { totalPages, baseUrl } = bgshFavoriteOrganizerParsePaginationInfo();

                // 严格按原生收藏时间顺序抓取所有 LI 节点
                const rawThreads = await bgshFavoriteOrganizerFetchAllPagesThreads(totalPages, baseUrl, favContainer);

                // 清空列表并生成表头
                favContainer.innerHTML = '';
                bgshFavoriteOrganizerRenderListHeader(favContainer);

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
                    statusMsg.innerHTML = `📦 发现 <b>${unchachedThreads.length}</b> 个新帖子，正在 20 线程解析元数据...`;
                }

                let completed = 0;
                const totalUncached = unchachedThreads.length;
                const detailFetchConcurrency = 20;

                // 收藏夹帖子详情采用 20 线程抓取，所有详情完成后再继续触发图片预览。
                const metaResults = [];
                let nextThreadIndex = 0;
                async function bgshFavoriteOrganizerFetchThreadMeta(index) {
                    const thread = rawThreads[index];
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
                    metaResults[index] = meta;
                }

                async function bgshFavoriteOrganizerDetailWorker() {
                    while (nextThreadIndex < rawThreads.length) {
                        const index = nextThreadIndex++;
                        await bgshFavoriteOrganizerFetchThreadMeta(index);
                    }
                }

                const workerCount = Math.min(detailFetchConcurrency, Math.max(1, rawThreads.length));
                await Promise.all(Array.from({ length: workerCount }, () => bgshFavoriteOrganizerDetailWorker()));

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
                    bgshFavoriteOrganizerRebuildListItem(thread.liNode, linkNode, forumName, meta);

                    forumData[forumName].push({
                        liNode: thread.liNode,
                        linkNode: linkNode,
                        rawTitle: rawTitle,
                        url: thread.url
                    });

                    favContainer.appendChild(thread.liNode);
                });

                // 保存更新后的缓存
                bgshFavoriteOrganizerSetCache(cacheMap);

                if (totalUncached > 0) {
                    statusMsg.style.background = '#f6ffed';
                    statusMsg.style.borderColor = '#b7eb8f';
                    statusMsg.style.color = '#52c41a';
                    statusMsg.innerHTML = `✅ 元数据解析完成并已写入缓存！`;
                    setTimeout(() => statusMsg.remove(), 2500);
                }

                // 渲染侧栏
                bgshFavoriteOrganizerRenderLeftMenu();
            }

            // 渲染紧凑版表头（列宽与内容完全精准对齐）
            function bgshFavoriteOrganizerRenderListHeader(container) {
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
            function bgshFavoriteOrganizerRebuildListItem(liNode, linkNode, forumName, meta) {
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
                    ${bgshFavoriteOrganizerGetGradientForForum(forumName)}
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
            function bgshFavoriteOrganizerParsePaginationInfo() {
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
            async function bgshFavoriteOrganizerFetchAllPagesThreads(totalPages, baseUrl, currentContainer) {
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
            function bgshFavoriteOrganizerGetSortIndex(forumName) {
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
            function bgshFavoriteOrganizerRenderLeftMenu() {
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
                        bgshFavoriteOrganizerClearCache();
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
                    bgshFavoriteOrganizerApplyCombinedFilter();
                });

                // “全部显示”选项
                const showAllLi = document.createElement('li');
                showAllLi.className = 'dynamic-forum-item a';
                showAllLi.innerHTML = `<a href="javascript:void(0);">全部显示 <span id="count_ALL" style="color:#000;font-size:11px;">(${bgshFavoriteOrganizerGetTotalCount()})</span></a>`;

                showAllLi.onclick = () => {
                    bgshFavoriteOrganizerSetActiveItem(leftSideUl, showAllLi);
                    currentFilterForum = 'ALL';
                    bgshFavoriteOrganizerApplyCombinedFilter();
                };
                leftSideUl.appendChild(showAllLi);

                // 排序
                const sortedForumNames = Object.keys(forumData).sort((a, b) => {
                    return bgshFavoriteOrganizerGetSortIndex(a) - bgshFavoriteOrganizerGetSortIndex(b);
                });

                // 渲染版块列表
                sortedForumNames.forEach(forumName => {
                    const count = forumData[forumName].length;
                    const safeId = 'count_' + encodeURIComponent(forumName).replace(/%/g, '_');
                    const li = document.createElement('li');
                    li.className = 'dynamic-forum-item';
                    li.innerHTML = `<a href="javascript:void(0);">${forumName} <span id="${safeId}" style="color:#000;font-size:11px;">(${count})</span></a>`;

                    li.onclick = () => {
                        bgshFavoriteOrganizerSetActiveItem(leftSideUl, li);
                        currentFilterForum = forumName;
                        bgshFavoriteOrganizerApplyCombinedFilter();
                    };

                    leftSideUl.appendChild(li);
                });
            }

            function bgshFavoriteOrganizerSetActiveItem(container, targetLi) {
                const items = container.querySelectorAll('.dynamic-forum-item');
                items.forEach(item => item.classList.remove('a'));
                targetLi.classList.add('a');
            }

            function bgshFavoriteOrganizerEscapeRegExp(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            function bgshFavoriteOrganizerApplyCombinedFilter() {
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
                        const previewRow = item.liNode.nextElementSibling;
                        if (previewRow && previewRow.classList && previewRow.classList.contains('bgsh-favorite-preview-li-row')) {
                            previewRow.style.display = (matchForum && matchSearch) ? 'block' : 'none';
                        }

                        if (item.linkNode) {
                            if (currentSearchKey) {
                                const regex = new RegExp(`(${bgshFavoriteOrganizerEscapeRegExp(currentSearchKey)})`, 'gi');
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

            function bgshFavoriteOrganizerGetTotalCount() {
                return Object.values(forumData).reduce((sum, arr) => sum + arr.length, 0);
            }
        });
        return window.__bgshFavoriteOrganizerPromise;
    }
    // #endregion

async function delegatePageHandlers(settings, buttonContainer) {
    const isPostPage = () => /forum\.php\?mod=viewthread|\/thread-\d+-\d+-\d+\.html/.test(window.location.href);
    const isSearchPage = () => /search\.php/.test(window.location.href);
    const isForumDisplayPage = () => /forum\.php\?mod=forumdisplay|\/forum-\d+-\d+\.html/.test(window.location.href);
    const isSpacePage = () => /home\.php\?mod=space(.*&&uid=\d+)?.*&do=thread&view=me(.*&from=space)?.*&(type=(reply|thread))?/.test(window.location.href);
    const isMySpacePage = () => /(forum|home)\.php\?mod=(guide|space|misc)&(view=(hot|digest|new|newthread|sofa|my)|action=showdarkroom)(&type=(thread|reply|postcomment))?/.test(window.location.href);
    const isFavoriteListPage = () =>
        /home\.php\?[^#]*mod=space&[^#]*do=favorite/i.test(window.location.href) ||
        /home\.php\?[^#]*mod=spacecp&[^#]*ac=favorite/i.test(window.location.href) ||
        !!document.querySelector('[id^="favorite_"], .favorite-list, #favorite, .favorite');

    if (isPostPage()) {
        handlePostPage(settings, buttonContainer);
    } else if (isSearchPage()) {
        filterSearchResults();
        handleSearchPage(settings);
    } else if (isForumDisplayPage()) {
        await handleForumDisplayPage(settings, buttonContainer);
    } else if (isFavoriteListPage()) {
        await initFavoriteOrganizer();
        // 收藏夹列表沿用其他帖子列表的图片预览开关、每帖预览数量和预览图尺寸设置。
        await displayAdvanThreadImages(settings);
    } else if (isSpacePage()) {
        displayThreadBuyInfoOther(settings);
        initInfiniteScroll("isSpacePage");
        setTimeout(function() { displayAdvanThreadImages(settings); }, 500);
    } else if (isMySpacePage()) {
        displayThreadBuyInfoOther(settings);
        initInfiniteScroll("isMySpacePage");
        setTimeout(function() { displayAdvanThreadImages(settings); }, 500);
    }
}



// ===== 预览图片大小调节 =====
function getPreviewSize() { return parseInt(GM_getValue('bgsh_previewSize', 180), 10) || 180; }
function normalizePreviewSize(val) {
    return Math.max(80, Math.min(400, parseInt(val, 10) || 180));
}
function applyPreviewSize(val) {
    val = normalizePreviewSize(val);
    document.documentElement.style.setProperty('--bgsh-preview-size', val + 'px');
    document.documentElement.style.setProperty('--bgsh-preview-max-height', val + 'px');
    var button = document.getElementById('bgshPreviewSizeBtn');
    if (button) button.textContent = '🖼️ 最大' + val + 'px';
}
function setPreviewSize(val) {
    val = normalizePreviewSize(val);
    GM_setValue('bgsh_previewSize', val);
    applyPreviewSize(val);
}

if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener('bgsh_previewSize', function(name, oldValue, newValue) {
        applyPreviewSize(newValue);
    });
}


// 色花堂回帖汇总模块
function initSehuatangReplySummary(buttonContainer){

window.requestIdleCallback=window.requestIdleCallback||function(cb){return setTimeout(()=>cb({timeRemaining:()=>0}),10)};
window.cancelIdleCallback=window.cancelIdleCallback||clearTimeout;

const MAX_REPLY_LENGTH=500; // 超过500字的楼层不显示
let replies=[],loaded=new Set(),totalPages=1,ownerName='',onlyOwner=false,keyword='',excludeDuplicates=false;
let renderTimer=null,renderChunkSize=300;

GM_addStyle(`
#dzReplyBtn{z-index:999999}
#dzReplyBox{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:69.5%;height:82%;background:#fff;z-index:999998;border:2px solid #f90;display:none;overflow:auto;padding:0px}
#dzTopBar button,#dzTopBar input{margin-right:8px;padding:6px 12px;box-sizing:border-box;vertical-align:middle;border:1px solid #ccc}
#dzTopBar{position:sticky;top:0;background:#fff;z-index:10;padding:8px;border-bottom:1px solid #ddd}
#dzReplyBox table{border-collapse:collapse;width:auto;max-width:none;table-layout:auto}#dzReplyBox td,#dzReplyBox th{border:1px solid #ddd;padding:6px;white-space:nowrap;width:auto}#dzReplyBox td:nth-child(3),#dzReplyBox th:nth-child(3){white-space:normal;min-width:300px}
`);

if (!/forum\.php\?mod=viewthread/.test(window.location.href)) return;

let b=createButton('dzReplyBtn','📋 回帖汇总',()=>{box.style.display=box.style.display==='block'?'none':'block';if(!replies.length)load(location.href)});
b.className='bgsh-customBtn';
let previewButton=document.getElementById('bgshPreviewSizeBtn');
if(previewButton && previewButton.parentNode===buttonContainer){
    buttonContainer.insertBefore(b, previewButton);
}else{
    buttonContainer.insertBefore(b, buttonContainer.firstChild);
}

let box=document.createElement('div');
box.id='dzReplyBox';
box.innerHTML='<div id="dzTopBar"><button id="all">加载全部回帖</button><span id="dzInfo">已加载0/0页，共0条回帖</span><br><button id="dup">排除重复回帖</button><button id="owner">只看楼主</button><input id="kw" placeholder="输入关键词筛选"></div><table><thead><tr><th>楼层#时间</th><th>用户</th><th>回帖内容</th></tr></thead><tbody id="body"></tbody></table>';
document.body.appendChild(box);

all.onclick=async()=>{
 replies=[];loaded.clear();
 let pages=[];for(let i=1;i<=totalPages;i++)pages.push(i);
 let idx=0;
 async function worker(){
  while(idx<pages.length){
   let p=pages[idx++];
   await load(url(p),false);
   info();
  }
 }
 await Promise.all([worker(),worker(),worker(),worker(),worker()]);
 replies.sort((a,b)=>(parseInt(a.floor)||0)-(parseInt(b.floor)||0));
 render();info();
};

owner.onclick=function(){onlyOwner=!onlyOwner;this.textContent=onlyOwner?'显示全部':'只看楼主';render()};
dup.onclick=function(){excludeDuplicates=!excludeDuplicates;this.textContent=excludeDuplicates?'恢复全部回帖':'排除重复回帖';render()};
kw.oninput=()=>{keyword=kw.value.trim();render()};

function url(p){let u=new URL(location.href),tid=u.searchParams.get('tid');return tid?location.origin+'/forum.php?mod=viewthread&tid='+tid+'&page='+p:location.href}

async function load(u,refresh=true){if(loaded.has(u))return;loaded.add(u);let t=await fetch(u,{credentials:'include'}).then(r=>r.text());let d=new DOMParser().parseFromString(t,'text/html');pages(d);parse(d);if(refresh){render();info()}}

function pages(d){let a=[1];d.querySelectorAll('a').forEach(x=>{let m=(x.href||'').match(/[?&]page=(\d+)/);if(m)a.push(+m[1])});totalPages=Math.max(...a)}

function parse(d){
if(!ownerName){let x=d.querySelector("div[id^='post_'] .authi a.xw1");if(x)ownerName=x.textContent.trim()}
d.querySelectorAll("div[id^='post_']").forEach(p=>{
let id=p.id.replace('post_',''),f=p.querySelector('#postnum'+id);if(!f)return;
let floor=f.textContent.trim();if(floor==='楼主')return;
let c=p.querySelector('td.t_f');if(!c)return;
let authorPoston=p.querySelector('#authorposton'+id);
let timeEl=authorPoston&&authorPoston.querySelector('span[title]');
let time=timeEl&&timeEl.getAttribute('title');
if(!time){
  time=((authorPoston||{}).textContent||'').replace('发表于','').replace(/\\u00a0/g,' ').trim();
}
let user=(p.querySelector('.authi a.xw1')||{}).textContent||'未知';
let formatted=extractContent(c);
let item={key:id+formatted.content+formatted.quote,floor,user:user.trim(),content:formatted.content,time:time||'未知'};
if(!replies.some(x=>x.key==item.key))replies.push(item);
})}

function extractContent(node){
 let clone=node.cloneNode(true),quote='',quoteAuthor='';
 // Discuz 常见引用结构：blockquote / .quote / .quote_box。
 let q=clone.querySelector('blockquote, .quote, .quote_box');
 if(q){
  let qt=q.cloneNode(true);
  // 优先从引用中的“发表于/回复于”行提取引用作者。
  let authorEl=qt.querySelector('.authi a.xw1, a.xw1, .xw1');
  if(authorEl) quoteAuthor=authorEl.textContent.trim();
  let qText=qt.textContent.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  // 去掉“XXX 发表于 2026-07-28 11:27”之类的引用头。
  qText=qText.replace(/^.*?(?:发表于|回复于)\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*/,'').trim();
  if(!quoteAuthor){
   let m=qt.textContent.replace(/\u00a0/g,' ').match(/^\s*([^\s]+)\s+(?:发表于|回复于)\s+\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
   if(m) quoteAuthor=m[1].trim();
  }
  // 如果没有识别到作者，则保留引用内容但不伪造作者。
  if(quoteAuthor && qText) quote='【'+quoteAuthor+' '+qText+'】';
  else if(qText) quote='【'+qText+'】';
  q.remove();
 }
 let content=clone.textContent.replace(/\u00a0/g,' ').replace(/[ \t\r\n]+/g,' ').trim();
 // 清理 Discuz 编辑提示等可能混入正文的内容。
 content=content.replace(/^本帖最后由[^\n]*编辑\s*/,'').trim();
 return {content:quote+content,quote:quote};
}

function render(batch=false){
 if(renderTimer) cancelIdleCallback(renderTimer);
 body.innerHTML='';

 let list=replies
  .filter(r=>r.content.length<=MAX_REPLY_LENGTH)
  .filter(r=>(!onlyOwner||r.user.includes(ownerName)||r.content.includes(ownerName))&&(!keyword||r.user.includes(keyword)||r.content.includes(keyword)));

 let seen=new Set();
 if(excludeDuplicates){
   list=list.filter(r=>{
    let key=r.content.replace(/\s+/g,' ').trim();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
   });
 }

 dzInfo.textContent='已加载 '+Math.min(loaded.size,totalPages)+'/'+totalPages+' 页，共 '+list.length+' 条回帖';

 let index=0;
 function append(){
   let frag=document.createDocumentFragment();
   let end=Math.min(index+renderChunkSize,list.length);
   for(;index<end;index++){
     let r=list[index];
     let tr=document.createElement('tr');
     tr.innerHTML='<td>'+e(r.floor)+e(r.time)+'</td><td>'+e(r.user)+'</td><td>'+e(r.content)+'</td>';
     frag.appendChild(tr);
   }
   body.appendChild(frag);

   if(index<list.length){
     renderTimer=requestIdleCallback(append,{timeout:200});
   }
 }
 append();
}

function info(){dzInfo.textContent='已加载 '+Math.min(loaded.size,totalPages)+'/'+totalPages+' 页，共 '+replies.length+' 条回帖'}
function e(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
}


async function main() {
    if (document.title.indexOf("色花堂") == -1 && document.title.indexOf("98堂") == -1) {
        return;
    }

    // 4.5.1 已移除自动签到与签到提醒，清理旧版遗留设置。
    GM_deleteValue("qiandaoTip");

    const settings = getSettings();

    const lastCheckedUpdate = settings.lastCheckedUpdate;
    const oneDayInMillis = 24 * 60 * 60 * 1000;
    if (Date.now() - lastCheckedUpdate > oneDayInMillis) {
        checkForUpdates();
    }

    await baseFunction(settings);
}

GM_registerMenuCommand("⚙️ 九八堂设置", () => {
    createSettingsUI(getSettings());
});

GM_registerMenuCommand("🌓 切换主题", () => {
    const current = getTheme();
    const themes = ['auto', 'light', 'dark'];
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    setTheme(next);
    showToast(`🌓 主题已切换: ${next === 'auto' ? '跟随系统' : next}`, 'success');
});

await main();
// #endregion
})();
