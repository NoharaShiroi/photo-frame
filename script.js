const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",

    states: {
        accessToken: null,
        albumId: "all",
        photos: [],
        currentIndex: 0,
        nextPageToken: null,
        isFetching: false,
        slideshowInterval: null,
        observer: null,
        hasMorePhotos: true,
        currentRequestId: 0,
        lightboxActive: false,
        isFullscreen: false,
        preloadCount: 100, // 新增預載照片數量設定
        defaultPreloadCount: 100,       // ← 新增：平常模式預載量
        slideshowPreloadCount: 300,
        loadedForSlideshow: 0, // 記錄已為幻燈片加載的照片數量
        playedPhotos: new Set(), // 記錄已播放過的照片ID
        overlayTimeout: null,      // 儲存計時器ID
        overlayDisabled: false,   // 記錄遮罩是否被臨時取消
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00",
            classStart: "08:00",
            classEnd: "17:00",
            isEnabled: false,
            useHoliday: true,
        }
    },

    init() {
    this.states.isOldiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                     !window.MSStream && 
                     /OS [1-9]_.* like Mac OS X/.test(navigator.userAgent);

    this.states.accessToken = sessionStorage.getItem("access_token");
    this.setupEventListeners();
    
    if (!this.checkAuth()) {
        // 未授權：顯示登入介面
        document.getElementById("auth-container").style.display = "flex";
        if (this.states.isOldiOS) {
            document.getElementById("screenOverlay").style.display = "none";
        }
    } else {
        // 已授權：初始化應用程式
        this.loadSchedule();
        this.checkSchedule();
        setInterval(() => {
            console.log('執行定期排程檢查');
            this.checkSchedule();
        }, this.states.isOldiOS ? 300000 : 60000);
    }
},
    loadSchedule() {
        const schedule = JSON.parse(localStorage.getItem("schedule"));
        if (schedule) {
            this.states.schedule = schedule;
        }
    },

    saveSchedule() {
        localStorage.setItem("schedule", JSON.stringify(this.states.schedule));
        this.resetOverlayState(); // 新增這行
    },

    checkSchedule() {
        if (this.states.isOldiOS) {
        document.getElementById("screenOverlay").style.display = "none";
        return;
    }

    // 如果遮罩被臨時取消且計時器還在，則不執行後續檢查
    if (this.states.overlayDisabled && this.states.overlayTimeout) {
        return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const sleepStart = this.getTimeInMinutes(this.states.schedule.sleepStart);
    const sleepEnd = this.getTimeInMinutes(this.states.schedule.sleepEnd);
    const classStart = this.getTimeInMinutes(this.states.schedule.classStart);
    const classEnd = this.getTimeInMinutes(this.states.schedule.classEnd);
    
    // 修正跨午夜的時間比較
    const isSleepTime = sleepStart < sleepEnd 
        ? (currentTime >= sleepStart && currentTime < sleepEnd)
        : (currentTime >= sleepStart || currentTime < sleepEnd);
    
    const isClassTime = currentTime >= classStart && currentTime < classEnd;
    const isHoliday = this.isHolidayMode(now);
    
    const shouldShowOverlay = this.states.schedule.isEnabled && 
                           (isSleepTime || isClassTime || isHoliday);
    
    console.log('排程檢查結果:', {
        currentTime: `${now.getHours()}:${now.getMinutes()}`,
        isSleepTime,
        isClassTime,
        isHoliday,
        shouldShowOverlay
    });

    // 只有當不是被臨時取消時才更新顯示狀態
    if (!this.states.overlayDisabled) {
        document.getElementById("screenOverlay").style.display = 
            shouldShowOverlay ? "block" : "none";
    }
    },

    isHolidayMode(date) {
        const day = date.getDay();
        return this.states.schedule.useHoliday && !this.isWeekday(date);
    },

    isWeekday(date) {
        const day = date.getDay();
        return day !== 0 && day !== 6;
    },

    getTimeInMinutes(time) {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
    },

    handleAuthFlow() {
        const authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
        const params = {
            client_id: this.CLIENT_ID,
            redirect_uri: this.REDIRECT_URI,
            response_type: 'token',
            scope: this.SCOPES,
            include_granted_scopes: 'true',
            state: 'pass-through-value',
            prompt: 'consent'
        };
        window.location.href = authEndpoint + '?' + new URLSearchParams(params);
    },

    checkAuth() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.states.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.states.accessToken);
            window.history.replaceState({}, "", window.location.pathname);
            this.showApp();
            return true;
        }
        return false;
    },

    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        if (this.states.isOldiOS) {
        document.getElementById("screenOverlay").style.display = "none";
     }
     this.fetchAlbums();
     },

    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", (e) => {
            e.preventDefault();
            this.handleAuthFlow();
        });

        document.getElementById("album-select").addEventListener("change", (e) => {
            this.states.albumId = e.target.value;
            this.resetPhotoData();
            this.loadPhotos();
        });
        document.addEventListener("fullscreenchange", () => {
            const isFullscreenNow = !!document.fullscreenElement;
             this.states.isFullscreen = isFullscreenNow;
            this.toggleButtonVisibility();
           
            if (!isFullscreenNow) {
        // ✅ 退出全螢幕：關閉幻燈片 + 關閉 lightbox
        if (this.states.slideshowInterval) this.stopSlideshow();
        this.closeLightbox();
        }        
        });
      
        document.getElementById("screenOverlay").addEventListener("dblclick", () => {
        this.temporarilyDisableOverlay();
        });     
        let lastTouchTime = 0;
        document.getElementById("screenOverlay").addEventListener("touchend", (e) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastTouchTime < 500) {
                this.temporarilyDisableOverlay();
                e.preventDefault();
            }
            lastTouchTime = currentTime;
        });
        function shouldCloseLightbox(event) {
            return !event.target.closest('.nav-button') && !event.target.closest('img');
        }

        lightbox.addEventListener("dblclick", (event) => {
            const shouldCloseLightbox = (event) => {
        return !event.target.closest('.nav-button') && !event.target.closest('img');
    };
    
    if (shouldCloseLightbox(event)) {
        this.closeLightbox();
    }
});

        lightbox.addEventListener("touchend", (event) => {
    if (shouldCloseLightbox(event)) {
        const currentTime = new Date().getTime();
        // 舊裝置增加觸控延遲容錯
        const delay = this.states.isOldiOS ? 800 : 500;
        if (currentTime - lastTouchTime < delay) {
            this.closeLightbox();
        }
        lastTouchTime = currentTime;
    }
});

        document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
        document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
        document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());

        document.getElementById("play-mode").addEventListener("change", (e) => {
            if (this.states.slideshowInterval) {
                this.toggleSlideshow();
                this.toggleSlideshow();
            }
        });

        let speedTimeout;
        document.getElementById("slideshow-speed").addEventListener("input", (e) => {
            clearTimeout(speedTimeout);
            speedTimeout = setTimeout(() => {
                if (this.states.slideshowInterval) {
                    this.toggleSlideshow();
                    this.toggleSlideshow();
                }
            }, 500);
        });

        document.getElementById("schedule-settings-btn").addEventListener("click", () => {
            document.getElementById("schedule-modal").style.display = "block";
        });

        document.querySelector(".close-modal").addEventListener("click", () => {
            document.getElementById("schedule-modal").style.display = "none";
        });

        document.getElementById("cancel-schedule").addEventListener("click", () => {
            document.getElementById("schedule-modal").style.display = "none";
        });

        document.getElementById("save-schedule").addEventListener("click", () => {
            this.states.schedule.sleepStart = document.getElementById("sleep-start").value;
            this.states.schedule.sleepEnd = document.getElementById("sleep-end").value;
            this.states.schedule.classStart = document.getElementById("class-start").value;
            this.states.schedule.classEnd = document.getElementById("class-end").value;
            this.states.schedule.isEnabled = document.getElementById("is-enabled").checked;
            this.states.schedule.useHoliday = document.getElementById("use-holiday").checked;
            this.saveSchedule();
            document.getElementById("schedule-modal").style.display = "none";
            this.checkSchedule();
        });
    },
    temporarilyDisableOverlay() {
        if (document.getElementById("screenOverlay").style.display === "block") {
            // 1. 隱藏遮罩
            document.getElementById("screenOverlay").style.display = "none";
            this.states.overlayDisabled = true;
            
            // 2. 清除現有計時器
            if (this.states.overlayTimeout) {
                clearTimeout(this.states.overlayTimeout);
            }
            
            // 3. 設定5分鐘後自動恢復
            this.states.overlayTimeout = setTimeout(() => {
                this.states.overlayDisabled = false;
                this.states.overlayTimeout = null;
                this.checkSchedule(); // 重新檢查排程
            }, 5 * 60 * 1000); // 5分鐘
            
            // 4. 顯示提示訊息
            this.showTemporaryMessage("遮罩已暫時取消，5分鐘後自動恢復");
        }
    },

    showTemporaryMessage(message) {
        const msgElement = document.createElement("div");
        msgElement.style.position = "fixed";
        msgElement.style.bottom = "20px";
        msgElement.style.left = "50%";
        msgElement.style.transform = "translateX(-50%)";
        msgElement.style.backgroundColor = "rgba(0,0,0,0.7)";
        msgElement.style.color = "white";
        msgElement.style.padding = "10px 20px";
        msgElement.style.borderRadius = "5px";
        msgElement.style.zIndex = "10000";
        msgElement.textContent = message;
        document.body.appendChild(msgElement);
        
        setTimeout(() => {
            document.body.removeChild(msgElement);
        }, 3000);
    }, // <-- 這裡必須加上逗號
   
    resetOverlayState() {
        this.states.overlayDisabled = false;
        if (this.states.overlayTimeout) {
            clearTimeout(this.states.overlayTimeout);
            this.states.overlayTimeout = null;
        }
    }, // <-- 這裡必須加上逗號

        async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            if (!response.ok) throw new Error('無法取得相簿');
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
            this.loadPhotos();
        } catch (error) {
            this.handleAuthError();
        }
    },

    renderAlbumSelect(albums) {
        const select = document.getElementById("album-select");
        select.innerHTML = '<option value="all">所有相片</option>';
        albums.forEach(album => {
            const option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            select.appendChild(option);
        });
    },

    async loadPhotos() {
    // ✅ 安全上限控制，避免過度預載
    const MAX_PHOTOS = 300;
    if (this.states.photos.length >= MAX_PHOTOS) {
        console.log("⚠️ 已達最大圖片數，不再預載更多");
        this.states.hasMorePhotos = false;
        return;
    }

    if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
        return;
    }

    if (this.states.isFetching) return;

    const requestId = ++this.states.currentRequestId;
    this.states.isFetching = true;
    document.getElementById("loading-indicator").style.display = "block";

    try {
        const body = {
            pageSize: 100,
            pageToken: this.states.nextPageToken || undefined
        };

        if (this.states.albumId !== "all") {
            body.albumId = this.states.albumId;
        } else {
            body.filters = { includeArchivedMedia: true };
        }

        const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.states.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            if (this.states.photos.length === 0) {
                throw new Error('照片加載失敗');
            }
            return;
        }

        const data = await response.json();

        // ✅ 忽略過時請求
        if (requestId !== this.states.currentRequestId) return;

        const existingIds = new Set(this.states.photos.map(p => p.id));
        const newPhotos = data.mediaItems.filter(item => item && !existingIds.has(item.id));

        // ✅ 無新照片
        if (newPhotos.length === 0 && data.nextPageToken) {
            this.states.nextPageToken = null;
            this.states.hasMorePhotos = false;
        } else {
            this.states.photos = [...this.states.photos, ...newPhotos];
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;
        }

        // ✅ 清除超過的圖片，控制在 MAX_PHOTOS 張以內
        if (this.states.photos.length > MAX_PHOTOS) {
            const excess = this.states.photos.length - MAX_PHOTOS;
            this.states.photos.splice(0, excess);
            console.log(`🧹 清除 ${excess} 張舊圖片，保留最新 ${MAX_PHOTOS} 張`);

            // ✅ 同步清理已播放記錄
            this.states.playedPhotos = new Set(
                [...this.states.playedPhotos].filter(id =>
                    this.states.photos.some(photo => photo.id === id)
                )
            );
        }

        this.renderPhotos();

        // ✅ 如果還沒滿 300，背景自動載入下一批（非阻塞）
        if (this.states.photos.length < MAX_PHOTOS && this.states.hasMorePhotos) {
            console.log("🚀 背景預載下一批照片");
            setTimeout(() => this.loadPhotos(), 300); // ⚠️ 避免阻塞主流程
        } else {
            console.log("✅ 已加載至上限，停止載入更多");
            this.states.hasMorePhotos = false;
        }

    } catch (error) {
        console.error("照片加載錯誤:", error);
        if (this.states.photos.length === 0) {
            this.showMessage("照片加載失敗，請檢查網路", true);
        }
    } finally {
        if (requestId === this.states.currentRequestId) {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
        }
    }
},

    renderPhotos() {
       const container = document.getElementById("photo-container");
    container.style.display = "grid";
    
    // 移除現有的錯誤訊息（如果有的話）
    const existingError = container.querySelector('.error-state');
    if (existingError) {
        container.removeChild(existingError);
    }
    
    // 只渲染尚未渲染的照片
    const startIndex = container.children.length - 
                     (container.querySelector('.empty-state') ? 1 : 0);
    
    const fragment = document.createDocumentFragment();
    
    for (let i = startIndex; i < this.states.photos.length; i++) {
        const photo = this.states.photos[i];
        const img = document.createElement('img');
        img.className = 'photo';
        img.src = `${photo.baseUrl}=w150-h150`;
        img.dataset.src = `${photo.baseUrl}=w800-h600`;
        img.alt = '相片';
        img.dataset.id = photo.id;
        img.onclick = () => this.openLightbox(photo.id);
        fragment.appendChild(img);
    }

    // 移除現有的「已無更多相片」提示（如果有的話）
    const existingEmptyState = container.querySelector('.empty-state');
    if (existingEmptyState) {
        container.removeChild(existingEmptyState);
    }

    // 只在確實沒有更多照片時顯示提示
    if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = '已無更多相片';
        fragment.appendChild(emptyState);
    }

    container.appendChild(fragment);
    this.setupLazyLoad();
    
    // 更新幻燈片已加載數量
    if (this.states.slideshowInterval) {
        this.states.loadedForSlideshow = this.states.photos.length;
    }
    
    // 每次渲染後檢查是否需要設置滾動監聽
    this.setupScrollObserver();
},

    setupLazyLoad() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (!img.src.includes('w800')) {
                        img.src = img.dataset.src;
                    }
                    observer.unobserve(img);
                }
            });
        }, { 
            rootMargin: "200px 0px",
            threshold: 0.01 
        });

        document.querySelectorAll(".photo:not([data-loaded])").forEach(img => {
            observer.observe(img);
            img.setAttribute('data-loaded', 'true');
        });
    },

    setupScrollObserver() {
        if (this.states.observer) this.states.observer.disconnect();

    // 只有在預載完成後才啟用滾動加載
    if (this.states.photos.length >= this.states.preloadCount) {
        this.states.observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && 
                        this.states.hasMorePhotos &&
                        !this.states.isFetching) {
                        setTimeout(() => this.loadPhotos(), 300);
                    }
                });
            },
            {
                root: document.querySelector('#scroll-container'),
                rootMargin: '400px 0px',
                threshold: 0.1
            }
        );

        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        document.getElementById('photo-container').appendChild(sentinel);
        this.states.observer.observe(sentinel);
    }
},

    getImageUrl(photo, width = 1920, height = 1080) {
        if (!photo || !photo.baseUrl) {
            console.error("无效的照片对象:", photo);
            return "";
        }
        return `${photo.baseUrl}=w${width}-h${height}`;
    },

    openLightbox(photoId) {
        this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        
        image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);

        image.onload = () => {
            const isSlideshowActive = this.states.slideshowInterval !== null;
            image.style.maxWidth = isSlideshowActive ? '99%' : '90%';
            image.style.maxHeight = isSlideshowActive ? '99%' : '90%';
            lightbox.style.display = "flex";
            setTimeout(() => {
                lightbox.style.opacity = 1;
                this.states.lightboxActive = true;
                this.toggleButtonVisibility();
            }, 10);
        };
    },

    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none";
            this.states.lightboxActive = false;
            this.toggleButtonVisibility();
        }, 300);
        this.stopSlideshow();
    },

    navigate(direction) {
    const image = document.getElementById("lightbox-image");
    image.classList.add('fade-out');

    // ⏳ 設定圖片載入失敗的保險 timeout（避免無圖黑畫面）
    let fallbackTimeout = setTimeout(() => {
        console.warn("⚠️ 圖片載入逾時，自動略過淡入");
        image.classList.remove('fade-out');
    }, 1500); // 1.5 秒未完成就視為逾時

    setTimeout(() => {
        // ✅ 清除上一張圖片資源，幫助釋放 GPU 記憶體
        image.src = "";

        // ✅ 計算下一張 index（循環）
        this.states.currentIndex =
            (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;

        // ✅ 載入新圖片（推薦解析度 w800-h600）
        const photo = this.states.photos[this.states.currentIndex];
        image.src = this.getImageUrl(photo, 800, 600);

        image.onload = () => {
            clearTimeout(fallbackTimeout); // 成功載入，清除保險 timeout
            image.classList.remove('fade-out');

            // ✅ 幻燈片模式時紀錄已播
            if (this.states.slideshowInterval) {
                this.states.playedPhotos.add(photo.id);
            }
        };
    }, 300); // 淡出動畫結束後再切換圖片
 ,   }


   toggleSlideshow() {
    if (this.states.slideshowInterval) {
        // 停止播放時，恢復預載量
        this.stopSlideshow();
        this.stopClock();
        return;
    }
        // 重置已播放記錄
        this.states.playedPhotos.clear();
        this.states.loadedForSlideshow = this.states.photos.length;
        this.startClock(); // 啟動時鐘

        // ⚡【新增這行】: 直接打開Lightbox顯示照片！
        this.openLightbox(this.states.photos[this.states.currentIndex].id);

        const speed = document.getElementById("slideshow-speed").value * 1000 || 1000;
        const isRandom = document.getElementById("play-mode").value === "random";

        const getNextIndex = () => {
            if (this.states.photos.length - this.states.loadedForSlideshow < 10 &&
                this.states.hasMorePhotos && !this.states.isFetching) {
                this.loadPhotos();
            }

            if (isRandom) {
                let nextIndex;
                let attempts = 0;
                const maxAttempts = this.states.photos.length * 2;

                do {
                    nextIndex = Math.floor(Math.random() * this.states.photos.length);
                    attempts++;

                    if (attempts > maxAttempts) {
                        this.states.playedPhotos.clear();
                        break;
                    }
                } while (
                    (nextIndex === this.states.currentIndex && this.states.photos.length > 1) ||
                    (this.states.playedPhotos.has(this.states.photos[nextIndex].id) &&
                     this.states.playedPhotos.size < this.states.photos.length)
                );

                return nextIndex;
            }

            return (this.states.currentIndex + 1) % this.states.photos.length;
        };

        this.states.slideshowInterval = setInterval(() => {
            setTimeout(() => {
                this.states.currentIndex = getNextIndex();
                this.navigate(0);
            }, 100);
        }, speed);

        this.toggleButtonVisibility();
    },

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.states.preloadCount = this.states.defaultPreloadCount;
        this.toggleButtonVisibility();
    },

    toggleFullscreen() {
        const isOldiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                    !window.MSStream && 
                    /OS [1-9]_.* like Mac OS X/.test(navigator.userAgent);
    
    if (isOldiOS) {
        alert("您的裝置不支援全螢幕模式");
        return;
    }
    if (!document.fullscreenElement) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                this.states.isFullscreen = true;
                this.openLightbox(this.states.photos[this.states.currentIndex]?.id); // 確保進入 Lightbox
                this.toggleSlideshow(); // ✅ 啟動幻燈片
                this.toggleButtonVisibility();
            }).catch(err => console.error('全螢幕錯誤:', err));
        }
    } else {
        document.exitFullscreen?.();
        this.states.isFullscreen = false;
        this.toggleButtonVisibility();
    }
    if (!document.fullscreenElement) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.error('全螢幕錯誤:', err);
            });
        } else if (elem.webkitRequestFullscreen) { // Safari 專用
            elem.webkitRequestFullscreen();
        }
        this.states.isFullscreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // Safari 專用
            document.webkitExitFullscreen();
        }
        this.states.isFullscreen = false;
    }
    this.toggleButtonVisibility();
},

    toggleButtonVisibility() {
        const isSlideshowOrFullscreen = this.states.slideshowInterval !== null || this.states.isFullscreen;
        const buttons = document.querySelectorAll('.lightbox-buttons .nav-button');
        buttons.forEach(button => {
            button.style.display = isSlideshowOrFullscreen ? 'none' : 'block';
        });
    },

    resetPhotoData() {
        this.states.currentRequestId++;
        this.states.photos = [];
        this.states.nextPageToken = null;
        this.states.hasMorePhotos = true;
        this.states.loadedForSlideshow = 0;
        this.states.playedPhotos.clear();
        document.getElementById("photo-container").innerHTML = '';
    },

    handleAuthError() {
        const retry = confirm("授權已過期，是否重新登入？");
        if (retry) {
            sessionStorage.removeItem("access_token");
            window.location.reload();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const clockElement = document.getElementById("clock");
        if (clockElement) {
            clockElement.textContent = `${hours}:${minutes}`;
          }
    },
    
    startClock() {
          this.updateClock();
          this.clockInterval = setInterval(() => this.updateClock(), 60000); // 每分鐘更新一次
          document.getElementById("clock").style.display = "block";
     },

    stopClock() {
       clearInterval(this.clockInterval);
       document.getElementById("clock").style.display = "none";
     },
    
    showMessage(message, isError = false) {
    const container = document.getElementById("photo-container");
    // 移除現有的訊息
    const existingMessage = container.querySelector('.empty-state, .error-state');
    if (existingMessage) {
        container.removeChild(existingMessage);
    }
    const messageElement = document.createElement("p");
    messageElement.className = isError ? 'error-state' : 'empty-state';
    messageElement.textContent = message;
    container.appendChild(messageElement);
 }
    
};

document.addEventListener("DOMContentLoaded", () => app.init());
