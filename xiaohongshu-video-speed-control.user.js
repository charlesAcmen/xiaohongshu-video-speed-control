// ==UserScript==
// @name         小红书视频倍速扩展
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  为小红书网页版视频播放器添加 3x、5x、10x、16x 倍速选项，支持自定义倍速
// @author       You
// @match        https://www.xiaohongshu.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 额外的倍速选项
    const extraSpeeds = [3, 5, 10, 16];
    const STORAGE_KEY = 'xiaohongshu_custom_speeds';

    // 获取存储的自定义倍速
    function getCustomSpeeds() {
        try {
            const stored = GM_getValue(STORAGE_KEY, '[]');
            return JSON.parse(stored);
        } catch (e) {
            console.error('小红书倍速扩展：读取自定义倍速失败', e);
            return [];
        }
    }

    // 保存自定义倍速
    function saveCustomSpeeds(speeds) {
        try {
            GM_setValue(STORAGE_KEY, JSON.stringify(speeds));
        } catch (e) {
            console.error('小红书倍速扩展：保存自定义倍速失败', e);
        }
    }

    // 验证倍速值是否合法（<=16且是0.1的倍数）
    function isValidSpeed(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (num <= 0 || num > 16) return false;
        // 检查是否是0.1的倍数
        return Math.round(num * 10) / 10 === num;
    }

    // 等待播放器加载
    function waitForPlayer(callback) {
        const checkInterval = setInterval(() => {
            const playbackRate = document.querySelector('.xgplayer-playbackrate');
            if (playbackRate) {
                clearInterval(checkInterval);
                callback();
            }
        }, 500);

        // 30秒超时
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 30000);
    }

    // 注入额外的倍速选项
    function injectExtraSpeeds() {
        document.querySelectorAll('.xgplayer-playbackrate').forEach(playbackRateEl => {
            const ul = playbackRateEl.querySelector('ul');
            if (!ul) return;

            // 检查是否已经注入过（通过检查是否有自定义输入容器）
            if (ul.querySelector('.custom-speed-input-container')) return;

            // 获取现有的倍速选项
            const existingLis = Array.from(ul.querySelectorAll('li'));
            const existingSpeeds = existingLis.map(li => parseFloat(li.getAttribute('cname'))).filter(s => !isNaN(s));

            // 清空列表（保留样式）
            ul.innerHTML = '';

            // 合并所有倍速：默认 + 额外 + 自定义
            const customSpeeds = getCustomSpeeds();
            const allSpeeds = [...new Set([...existingSpeeds, ...extraSpeeds, ...customSpeeds])];

            // 排序：从大到小
            allSpeeds.sort((a, b) => b - a);

            // 获取第一个li元素作为模板（如果存在）
            const templateLi = existingLis[0];

            // 注入倍速选项
            allSpeeds.forEach(speed => {
                const newLi = templateLi ? templateLi.cloneNode(true) : document.createElement('li');
                newLi.setAttribute('cname', speed);
                newLi.textContent = speed + 'x';
                newLi.classList.remove('selected');
                ul.appendChild(newLi);
            });

            // 添加自定义倍速输入容器
            const customInputContainer = document.createElement('li');
            customInputContainer.className = 'custom-speed-input-container';
            customInputContainer.style.cssText = `
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                height: 40px;
            `;

            // + 号显示
            const plusIcon = document.createElement('span');
            plusIcon.textContent = '+';
            plusIcon.className = 'custom-speed-plus-icon';
            plusIcon.style.cssText = `
                position: absolute;
                font-size: 14px;
                color: hsla(0,0%,100%,.8);
                transition: opacity 0.2s;
                z-index: 1;
            `;

            // 输入框（默认隐藏，与+号重叠）
            const inputField = document.createElement('input');
            inputField.type = 'number';
            inputField.className = 'custom-speed-input';
            inputField.style.cssText = `
                position: absolute;
                width: 50px;
                padding: 4px 8px;
                font-size: 14px;
                background: transparent;
                border: none;
                color: white;
                opacity: 0;
                outline: none;
                z-index: 2;
                transition: opacity 0.2s;
            `;

            customInputContainer.appendChild(plusIcon);
            customInputContainer.appendChild(inputField);
            // 插入到列表顶部
            ul.insertBefore(customInputContainer, ul.firstChild);

            // 鼠标悬停事件
            customInputContainer.addEventListener('mouseenter', () => {
                plusIcon.style.opacity = '0';
                inputField.style.opacity = '1';
                inputField.focus();
            });

            customInputContainer.addEventListener('mouseleave', () => {
                if (!inputField.value) {
                    plusIcon.style.opacity = '1';
                    inputField.style.opacity = '0';
                }
            });

            // 输入框回车事件
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const value = parseFloat(inputField.value);
                    if (isValidSpeed(value)) {
                        // 保存自定义倍速
                        const currentCustomSpeeds = getCustomSpeeds();
                        if (!currentCustomSpeeds.includes(value)) {
                            currentCustomSpeeds.push(value);
                            saveCustomSpeeds(currentCustomSpeeds);
                            console.log('小红书倍速扩展：已添加自定义倍速', value + 'x');
                        }

                        // 重新注入倍速选项
                        injectExtraSpeeds();
                    } else {
                        alert('请输入有效的倍速值（0.1-16之间，且是0.1的倍数）');
                        inputField.value = '';
                    }
                } else if (e.key === 'Escape') {
                    inputField.value = '';
                    plusIcon.style.opacity = '1';
                    inputField.style.opacity = '0';
                }
            });

            console.log('小红书倍速扩展：已注入倍速选项，包含自定义输入功能');
        });
    }

    // 监听倍速选项点击事件
    function setupSpeedClickHandlers() {
        // 使用事件委托监听整个文档
        document.addEventListener('click', function(event) {
            // 检查点击的是否是倍速按钮（用于在打开菜单时注入选项）
            const playbackRateBtn = event.target.closest('.xgplayer-playbackrate');
            if (playbackRateBtn) {
                // 每次打开倍速菜单时都尝试注入额外选项
                setTimeout(() => {
                    injectExtraSpeeds();
                }, 50);
            }

            // 检查点击的是否是倍速选项
            const li = event.target.closest('li');
            if (!li) return;

            const playbackRateEl = li.closest('.xgplayer-playbackrate');
            if (!playbackRateEl) return;

            const speed = parseFloat(li.getAttribute('cname'));
            if (isNaN(speed)) return;

            // 查找视频元素
            const playerContainer = playbackRateEl.closest('.xgplayer');
            if (!playerContainer) return;

            const video = playerContainer.querySelector('video');
            if (!video) return;

            // 设置视频播放速度
            video.playbackRate = speed;

            // 更新选中状态
            const allLis = playbackRateEl.querySelectorAll('ul li');
            allLis.forEach(l => l.classList.remove('selected'));
            li.classList.add('selected');

            console.log('小红书倍速扩展：设置播放速度为', speed + 'x');
        }, true);
    }

    // 监听DOM变化，处理动态加载的视频
    function observeVideoChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            // 检查是否添加了新的播放器
                            if (node.classList && node.classList.contains('xgplayer')) {
                                const playbackRate = node.querySelector('.xgplayer-playbackrate');
                                if (playbackRate) {
                                    setTimeout(() => {
                                        injectExtraSpeeds();
                                    }, 100);
                                }
                            }
                            // 检查子节点中是否包含播放器
                            const nestedPlayer = node.querySelector && node.querySelector('.xgplayer');
                            if (nestedPlayer) {
                                const playbackRate = nestedPlayer.querySelector('.xgplayer-playbackrate');
                                if (playbackRate) {
                                    setTimeout(() => {
                                        injectExtraSpeeds();
                                    }, 100);
                                }
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 监听URL变化（SPA导航）
    function observeUrlChanges() {
        let lastUrl = location.href;
        new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('小红书倍速扩展：检测到URL变化，重新注入倍速选项');
                // URL变化后延迟注入，等待DOM更新
                setTimeout(() => {
                    injectExtraSpeeds();
                }, 500);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // 定期检查倍速选项（作为备用方案）
    function startPeriodicCheck() {
        setInterval(() => {
            injectExtraSpeeds();
        }, 2000);
    }

    // 初始化
    function init() {
        console.log('小红书倍速扩展：脚本已加载');
        
        // 设置点击事件处理器
        setupSpeedClickHandlers();
        
        // 监听DOM变化
        observeVideoChanges();
        
        // 监听URL变化（SPA导航）
        observeUrlChanges();
        
        // 启动定期检查（作为备用方案）
        startPeriodicCheck();
        
        // 等待初始播放器加载
        waitForPlayer(() => {
            injectExtraSpeeds();
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
