// Master Data Live GitHub Synchronization Engine
(function() {
    const GITHUB_MASTER_URLS = [
        'https://raw.githubusercontent.com/meralmohamed121022-cyber/updatedmaster/refs/heads/main/UPDATED%20MASTER%201.json',
        'https://raw.githubusercontent.com/meralmohamed121022-cyber/updatedmaster/refs/heads/main/UPDATED%20MASTER%202.json',
        'https://raw.githubusercontent.com/meralmohamed121022-cyber/updatedmaster/refs/heads/main/UPDATED%20MASTER%203.json'
    ];

    window.GITHUB_MASTER_URLS = GITHUB_MASTER_URLS;

    function openMasterDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(null);
            try {
                const req = indexedDB.open('MonoMasterDB', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('masterStore')) {
                        db.createObjectStore('masterStore', { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = () => resolve(null);
            } catch (err) {
                resolve(null);
            }
        });
    }

    async function saveMasterToIndexedDB(items) {
        try {
            const db = await openMasterDB();
            if (!db) return;
            const tx = db.transaction('masterStore', 'readwrite');
            const store = tx.objectStore('masterStore');
            store.put({ id: 'allItems', data: items, updatedAt: Date.now() });
        } catch (e) {
            console.warn('IndexedDB save error:', e);
        }
    }

    async function loadMasterFromIndexedDB() {
        try {
            const db = await openMasterDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction('masterStore', 'readonly');
                const store = tx.objectStore('masterStore');
                const req = store.get('allItems');
                req.onsuccess = (e) => {
                    if (e.target.result && e.target.result.data && e.target.result.data.length > 0) {
                        resolve(e.target.result.data);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    async function fetchMasterPart(url) {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} on ${url}`);
        const text = await resp.text();
        const startIdx = text.indexOf('[');
        if (startIdx === -1) throw new Error(`No JSON array found in ${url}`);
        const clean = text.substring(startIdx);
        return JSON.parse(clean);
    }

    window.syncMasterFromGit = async function(btnEl) {
        const originalText = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '⏳ جاري الاتصال بـ GitHub...';
        }

        try {
            // Build OTC map from existing allItems
            const otcMap = {};
            if (window.allItems && Array.isArray(window.allItems)) {
                window.allItems.forEach(i => {
                    const code = String(i.Code);
                    const otc = i['Otc List'];
                    if (otc && otc !== 'N/A') otcMap[code] = otc;
                });
            }

            let allFetched = [];
            for (let i = 0; i < GITHUB_MASTER_URLS.length; i++) {
                if (btnEl) btnEl.innerHTML = `⏳ جاري تحميل ملف ${i + 1} من 3 من GitHub...`;
                const part = await fetchMasterPart(GITHUB_MASTER_URLS[i]);
                part.forEach(item => {
                    const code = String(item.Code);
                    if (otcMap[code]) item['Otc List'] = otcMap[code];
                    else item['Otc List'] = item['Otc List'] || 'N/A';
                    if (!item['Sales Price (VAT)']) item['Sales Price (VAT)'] = item['Unit Price'];
                });
                allFetched = allFetched.concat(part);
            }

            window.allItems = allFetched;
            window.productsDB = allFetched;

            await saveMasterToIndexedDB(allFetched);
            localStorage.setItem('master_last_git_sync', new Date().toLocaleString('ar-SA'));

            if (btnEl) {
                btnEl.innerHTML = `✅ تم تحديث ${allFetched.length.toLocaleString()} صنف من GitHub!`;
                btnEl.style.background = '#15803d';
                setTimeout(() => {
                    btnEl.disabled = false;
                    btnEl.innerHTML = originalText;
                    btnEl.style.background = '';
                }, 3500);
            }

            const badge = document.getElementById('masterGitStatusBadge');
            if (badge) {
                badge.innerText = `الماستر: ${allFetched.length.toLocaleString()} صنف (محدث من GitHub)`;
                badge.style.display = 'inline-block';
            }

            // Refresh UI in alt.html if modal is open
            if (typeof window.renderAltsTable === 'function' && window.currentAltCode) {
                window.showAlternatives(window.currentAltCode, window.currentAltType);
            }

            return { success: true, count: allFetched.length };
        } catch (err) {
            console.error('Master git sync error:', err);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '❌ فشل التحديث (راجع الاتصال)';
                setTimeout(() => { btnEl.innerHTML = originalText; }, 3000);
            }
            alert('حدث خطأ أثناء تحميل داتا الماستر من GitHub:\n' + err.message);
            return { success: false, error: err };
        }
    };

    // Auto-load from IndexedDB on startup if available
    window.initMasterFromCache = async function() {
        const cached = await loadMasterFromIndexedDB();
        if (cached && cached.length > 0) {
            window.allItems = cached;
            window.productsDB = cached;
            const badge = document.getElementById('masterGitStatusBadge');
            if (badge) {
                badge.innerText = `الماستر: ${cached.length.toLocaleString()} صنف (محفوظ من GitHub)`;
                badge.style.display = 'inline-block';
            }
            if (typeof window.renderAltsTable === 'function' && window.currentAltCode) {
                window.showAlternatives(window.currentAltCode, window.currentAltType);
            }
        }
    };

    // Run cache initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initMasterFromCache);
    } else {
        window.initMasterFromCache();
    }
})();

