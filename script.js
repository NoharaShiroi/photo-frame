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
        preloadCount: 250, // 新增預載照片數量設定
        loadedForSlideshow: 0, // 記錄已為幻燈片加載的照片數量
        playedPhotos: new Set(), // 記錄已播放過的照片ID
        overlayTimeout: null,      // 儲存計時器ID
        overlayDisabled: false,   // 記錄遮罩是否被臨時取消
        preloadPriorities: {},      // 圖片預載優先級記錄
        viewportPhotos: [],         // 當前可見區域照片ID
        activePreload: 5,           // 同時預載的圖片數量
        highResCache: {},           // 高解析度圖片緩存
        isUserScrolling: false,     // 是否正在滾動
        lastScrollTime: 0,           // 最後滾動時間戳
        orientation: 'landscape', // 新增方向狀態   
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00",
            classStart: "08:00",
            classEnd: "17:00",
            isEnabled: true,
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
        document.getElementById("app-container").style.display = "none"; // Hide the app container initially
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
// 加載排程設定
    loadSchedule() {
        const schedule = JSON.parse(localStorage.getItem("schedule"));
        if (schedule) {
            this.states.schedule = schedule;
        }
        console.log("排程已加載:", this.states.schedule);
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

    showApp() {// When logged in, hide the auth container and show the app container
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("app-container").style.display = "block"; 
    document.getElementById("scroll-container").style.display = "block"; // Ensure scroll container is shown after login

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

    // 修改後的 screenOverlay 雙擊/觸控事件
    document.getElementById("screenOverlay").addEventListener("dblclick", () => {
        this.temporarilyDisableOverlay();
    });

    let lastOverlayTouchTime = 0;
    document.getElementById("screenOverlay").addEventListener("touchend", (e) => {
        const currentTime = new Date().getTime();
        if (currentTime - lastOverlayTouchTime < 500) {
            this.temporarilyDisableOverlay();
            e.preventDefault();
        }
        lastOverlayTouchTime = currentTime;
    });

    // 修改後的 lightbox 雙擊/觸控事件
    const lightbox = document.getElementById("lightbox");
    let lastLightboxTouchTime = 0;

    function shouldCloseLightbox(event) {
        return !event.target.closest('.nav-button') && !event.target.closest('img');
    }

    // 雙擊滑鼠關閉
    lightbox.addEventListener("dblclick", (event) => {
        if (shouldCloseLightbox(event)) {
            this.closeLightbox();
            document.getElementById("screenOverlay").style.display = "none";
        }
    });

    // 雙擊觸控關閉 (iPad Mini 2 專用)
    lightbox.addEventListener("touchend", (event) => {
        if (shouldCloseLightbox(event)) {
            const currentTime = new Date().getTime();
            const delay = this.states.isOldiOS ? 800 : 500;
            
            if (currentTime - lastLightboxTouchTime < delay) {
                this.closeLightbox();
                document.getElementById("screenOverlay").style.display = "none";
                event.preventDefault();
            }
            lastLightboxTouchTime = currentTime;
        }
    });

    // 保留原有其他事件監聽
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
            
            // 3. 設定遮罩5分鐘後自動恢復
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
    }, 
   
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
    if (!this.states.hasMorePhotos && this.states.photos.length > 0) return;
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

        if (requestId !== this.states.currentRequestId) return;

        const existingIds = new Set(this.states.photos.map(p => p.id));
        const newPhotos = data.mediaItems.filter(item => item && !existingIds.has(item.id));

        // 如果沒有新照片，標記為沒有更多照片
        if (newPhotos.length === 0 && data.nextPageToken) {
            this.states.nextPageToken = null;
            this.states.hasMorePhotos = false;
        } else {
            this.states.photos = [...this.states.photos, ...newPhotos];
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;
            
            // 新增智能預載邏輯
            this.updatePreloadPriorities();
            this.schedulePreload();
        }

        this.renderPhotos();
        
        // 自動加載策略
        if (this.states.hasMorePhotos) {
            let delay = 300; // 預設加載間隔
            
            if (this.states.photos.length >= this.states.preloadCount) {
                delay = 3000; // 預載完成後改用較慢速度加載
            }
            
            if (this.states.slideshowInterval && 
                this.states.photos.length - this.states.loadedForSlideshow < 20) {
                delay = 800; // 幻燈片播放時需要更快加載
            }
            
            setTimeout(() => this.loadPhotos(), delay);
        }
    } catch (error) {
        if (this.states.photos.length === 0) {
            console.error("照片加載失敗:", error);
            this.showMessage("加載失敗，請檢查網路連線", true);
        }
    } finally {
        if (requestId === this.states.currentRequestId) {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
        }
    }
    },

updatePreloadPriorities() {
    // 重置優先級
    this.states.preloadPriorities = {};
    
    // 當前可見區域照片高優先級
    this.states.viewportPhotos.forEach(id => {
        this.states.preloadPriorities[id] = 3; // 最高優先級
    });
    
    // 附近照片中等優先級
    const nearbyRange = 10;
    this.states.photos.forEach((photo, index) => {
        if (Math.abs(index - this.states.currentIndex) <= nearbyRange) {
            if (!this.states.preloadPriorities[photo.id] || this.states.preloadPriorities[photo.id] < 2) {
                this.states.preloadPriorities[photo.id] = 2;
            }
        }
    });
    
    // 其他照片低優先級
    this.states.photos.forEach(photo => {
        if (!this.states.preloadPriorities[photo.id]) {
            this.states.preloadPriorities[photo.id] = 1;
        }
    });
},
 schedulePreload() {
    // 如果用戶正在滾動，延遲預載
    if (this.states.isUserScrolling) {
        setTimeout(() => this.schedulePreload(), 500);
        return;
    }
    
    // 按優先級排序照片
    const photosToPreload = [...this.states.photos]
        .sort((a, b) => this.states.preloadPriorities[b.id] - this.states.preloadPriorities[a.id])
        .filter(photo => !this.states.highResCache[photo.id]);
    
    // 限制同時預載數量
    const toLoad = photosToPreload.slice(0, this.states.activePreload);
    
    toLoad.forEach(photo => {
        if (!this.states.highResCache[photo.id]) {
            this.preloadHighResImage(photo);
        }
    });
},
    
preloadHighResImage(photo) {
    const img = new Image();
    img.src = this.getImageUrl(photo, 800, 600);
    img.onload = () => {
        this.states.highResCache[photo.id] = img.src;
    };
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
    let scrollTimeout;
    const container = document.getElementById('scroll-container');
    
    container.addEventListener('scroll', () => {
        this.states.isUserScrolling = true;
        this.states.lastScrollTime = Date.now();
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            this.states.isUserScrolling = false;
            this.updateViewportPhotos();
            this.schedulePreload();
        }, 200);
    });
},

updateViewportPhotos() {
    const container = document.getElementById('photo-container');
    const photos = Array.from(container.querySelectorAll('.photo'));
    const viewportHeight = window.innerHeight;
    
    this.states.viewportPhotos = photos
        .filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.top < viewportHeight && rect.bottom > 0;
        })
        .map(img => img.dataset.id);
    
    this.updatePreloadPriorities();  
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
    const photo = this.states.photos[this.states.currentIndex];
    const lightbox = document.getElementById("lightbox");
    const image = document.getElementById("lightbox-image");
    document.getElementById("screenOverlay").style.display = "none";
    
    this.setupOrientationDetection();
    
    // 先檢查是否有緩存的高解析度圖片
    if (this.states.highResCache[photoId]) {
        image.src = this.states.highResCache[photoId];
    } else {
        // 先顯示低解析度預覽
        image.src = `${photo.baseUrl}=w300-h300`;
        
        // 後台加載高解析度圖片
        const hiResImg = new Image();
        hiResImg.src = this.getImageUrl(photo, 1920, 1080);
        hiResImg.onload = () => {
            image.src = hiResImg.src;
            this.states.highResCache[photoId] = hiResImg.src;
        };
    }

    image.onload = () => {
        const isSlideshowActive = this.states.slideshowInterval !== null;
        image.style.maxWidth = isSlideshowActive ? '99%' : '90%';
        this.adjustPhotoDisplay();
        
        lightbox.style.display = "flex";
        setTimeout(() => {
            lightbox.style.opacity = 1;
            this.states.lightboxActive = true;
            this.toggleButtonVisibility();
        }, 10);
    };
},
    setupOrientationDetection() {
        const updateOrientation = () => {
            this.states.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
            this.adjustPhotoDisplay();
        };
        
        window.addEventListener('resize', updateOrientation);
        updateOrientation(); // 初始檢測
    },

    // 調整照片顯示方式
    adjustPhotoDisplay() {
        if (!this.states.lightboxActive) return;
        
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        const isPortrait = this.states.orientation === 'portrait';
        
        if (isPortrait) {
            // 直立模式下的特殊處理
            lightbox.style.flexDirection = 'column';
            image.style.maxHeight = '45%'; // 讓兩張照片可以垂直排列
        } else {
            // 橫向模式保持原樣
            lightbox.style.flexDirection = 'row';
            image.style.maxHeight = '90%';
        }
    },
    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
    
         // 清除图片的maxWidth和maxHeight
        image.style.maxWidth = '';
        image.style.maxHeight = '';
            // 清除其他可能的样式
        image.style.position = '';
        image.style.zIndex = '';
        image.style.boxShadow = '';
        image.style.border = '';
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none";
            this.states.lightboxActive = false;
            this.toggleButtonVisibility();
        }, 300);
        this.stopSlideshow();
    },

    navigate(direction) {
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
    const lightboxImage = document.getElementById("lightbox-image");
    lightboxImage.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);
    // 确保动画在图片加载完成后应用
    lightboxImage.onload = () => {
    // 新增：应用Ken Burns Effect
    this.applyKenBurnsEffect(lightboxImage);
    };
},

    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            this.stopSlideshow();
        } else {
            // 新增：重置已播放記錄
            this.states.playedPhotos.clear();
            this.states.loadedForSlideshow = this.states.photos.length;
            
            const speed = document.getElementById("slideshow-speed").value * 1000 || 1000;
            const isRandom = document.getElementById("play-mode").value === "random";

            const getNextIndex = () => {
                // 新增：如果照片不足，嘗試加載更多
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
                        
                        // 如果嘗試次數過多，可能所有照片都已播放過，重置記錄
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
                
                // 順序播放
                return (this.states.currentIndex + 1) % this.states.photos.length;
            };

            this.states.slideshowInterval = setInterval(() => {
                this.states.currentIndex = getNextIndex(); 
                this.navigate(0); 
            }, speed);
        }
        this.toggleButtonVisibility();
    },

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.toggleButtonVisibility();
    },

applyKenBurnsEffect(image) {
    // 移除现有的动画
    image.style.animation = '';
    void image.offsetWidth; // 触发重繪以重置動畫

    // 生成随机缩放参数
    const startScale = 1;
    const endScale = 1 + Math.random() * 0.3; // 随機縮放 1~1.3 倍

    // 创建唯一动画名稱
    const animationName = `kenburns-${Date.now()}`;
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ${animationName} {
            0% {
                transform: scale(${startScale});
            }
            100% {
                transform: scale(${endScale});
            }
        }
    `;
    document.head.appendChild(style);

    // 获取当前幻灯片切換速度
    const speed = document.getElementById("slideshow-speed").value * 1000 || 1000;
    const duration = speed / 1000;

    // 应用動畫
    image.style.animation = `${animationName} ${duration}s linear forwards`;
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
            document.getElementById("app-container").style.display = "block";
        }
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
