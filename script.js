if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (handler) {
        return setTimeout(() => {
            handler({ timeRemaining: () => 50, didTimeout: true });
        }, 1);
    };
}

if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id) {
        clearTimeout(id);
    };
}
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
        preloadCount: 500, // 新增預載照片數量設定
        loadedForSlideshow: 0, // 記錄已為幻燈片加載的照片數量
        playedPhotos: new Set(), // 記錄已播放過的照片ID
        overlayTimeout: null,      // 儲存計時器ID
        overlayDisabled: false,   // 記錄遮罩是否被臨時取消
        autoCollageEnabled: false, // 預設關閉
        currentOrientation: 'portrait', // 預設
        tileMode: false, // 是否啟用雙圖拼貼
        currentTileGroup: [], // 當前播放的兩張圖片
        
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
    this.setupOrientationDetection();
       
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
        
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement) {
            this.states.isFullscreen = false;
            if (this.states.slideshowInterval) {
            this.toggleSlideshow(); // 離開全螢幕 ➔ 停止幻燈片
                }
            this.toggleButtonVisibility();
             }
        });

        document.addEventListener("webkitfullscreenchange", () => {
            if (!document.webkitFullscreenElement) {
            this.states.isFullscreen = false;
            if (this.states.slideshowInterval) {
            this.toggleSlideshow(); // 離開全螢幕 ➔ 停止幻燈片
                 }
            this.toggleButtonVisibility();
              }
        });

        document.getElementById("toggle-tile-mode").addEventListener("click", () => {
        this.states.tileMode = !this.states.tileMode;
        if (this.states.lightboxActive) {
        this.openLightbox(this.states.photos[this.states.currentIndex].id);
             }
            alert(`雙拼貼模式 ${this.states.tileMode ? '已開啟' : '已關閉'}`);
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
            // 只在第一次失敗時顯示錯誤訊息
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
        }

        this.renderPhotos();

        // 自動加載策略：
        // 1. 如果還沒達到預載數量，繼續快速加載
        // 2. 如果已達預載數量，改用較慢速度繼續加載剩餘照片
        // 3. 如果正在幻燈片播放，確保有足夠緩衝照片
        if (this.states.hasMorePhotos) {
            let delay = 300; // 預設加載間隔
            
            if (this.states.photos.length >= this.states.preloadCount) {
                delay = 1000; // 預載完成後改用較慢速度加載
            }
            
            if (this.states.slideshowInterval && 
                this.states.photos.length - this.states.loadedForSlideshow < 50) {
                delay = 300; // 幻燈片播放時需要更快加載
            }
            
            setTimeout(() => this.loadPhotos(), delay);
        }
    } catch (error) {
        // 只在第一次失敗時顯示錯誤訊息
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
    
    setupOrientationDetection() {
    this.states.autoTileEnabled = true; // 預設啟用，讓使用者可以開關
    window.addEventListener('orientationchange', () => this.adjustLightboxLayout());
    window.addEventListener('resize', () => this.adjustLightboxLayout());
},

adjustLightboxLayout() {
    if (!this.states.lightboxActive) return;// 只在Lightbox打開時才調整

    const lightbox = document.getElementById('lightbox');
    const images = lightbox.querySelectorAll('img');

    const { innerWidth: width, innerHeight: height } = window;
    const isLandscape = width > height;

    if (this.states.tileMode && images.length === 2) {
        if (isLandscape) {
            // 橫向 ➔ 直向拼貼（上下）
            images[0].style.width = '90%';
            images[0].style.height = '45%';
            images[1].style.width = '90%';
            images[1].style.height = '45%';
            images[0].style.objectFit = images[1].style.objectFit = 'contain';
            lightbox.style.flexDirection = 'column';
        } else {
            // 直向 ➔ 橫向拼貼（左右）
            images[0].style.width = '45%';
            images[0].style.height = '90%';
            images[1].style.width = '45%';
            images[1].style.height = '90%';
            images[0].style.objectFit = images[1].style.objectFit = 'contain';
            lightbox.style.flexDirection = 'row';
        }
    } else if (images.length === 1) {
        // 單張顯示（正常情況）
        images[0].style.maxWidth = isLandscape ? '95%' : '98%';
        images[0].style.maxHeight = isLandscape ? '95%' : '98%';
        lightbox.style.flexDirection = 'row';
    }
},

    applyCollageMode() {
    const lightbox = document.getElementById("lightbox");
    const image = document.getElementById("lightbox-image");

    if (!lightbox || !image) return;

    if (this.states.currentOrientation === 'portrait') {
        // 直向時，橫向拚貼
        image.style.objectFit = "cover"; 
        image.style.width = "90%";
        image.style.height = "auto";
    } else {
        // 橫向時，直向拚貼
        image.style.objectFit = "cover";
        image.style.width = "auto";
        image.style.height = "90%";
    }
},

    toggleCollageMode() {
    this.states.autoCollageEnabled = !this.states.autoCollageEnabled;
    const btn = document.getElementById("toggle-collage-mode");
    btn.textContent = `自動拼貼模式：${this.states.autoCollageEnabled ? '開' : '關'}`;

    if (this.states.autoCollageEnabled) {
        this.applyCollageMode();
    } else {
        // 關閉後恢復原本比例
        const image = document.getElementById("lightbox-image");
        if (image) {
            image.style.objectFit = "contain";
            image.style.maxWidth = "98%";
            image.style.maxHeight = "98%";
            image.style.width = "auto";
            image.style.height = "auto";
        }
    }
},

    animateTransition(oldImages, newImages) {
    const lightbox = document.getElementById("lightbox");

    oldImages.forEach(img => {
        img.style.opacity = 0;
    });

    setTimeout(() => {
        // 清空舊圖片
        lightbox.innerHTML = '';

        // 加入新圖片
        newImages.forEach(img => {
            img.style.opacity = 0;
            lightbox.appendChild(img);
        });

        // 小延遲啟動 fade-in
        requestAnimationFrame(() => {
            newImages.forEach(img => {
                img.style.opacity = 1;
            });
        });

        this.adjustLightboxLayout(); // 保持橫向直向適應
    }, 500); // 跟fade-out速度同步
},

    async renderPhotos() {
    const container = document.getElementById("photo-container");
    container.style.display = "grid";

    // 移除舊訊息
    container.querySelectorAll('.error-state, .empty-state').forEach(el => el.remove());

    const existingIds = new Set(Array.from(container.querySelectorAll('.photo')).map(img => img.dataset.id));
    const photosToAdd = this.states.photos.filter(photo => !existingIds.has(photo.id));

    const batchSize = 20; // 每批新增20張
    let index = 0;

    const addBatch = (deadline) => {
        while ((deadline.timeRemaining() > 0 || deadline.didTimeout) && index < photosToAdd.length) {
            const photo = photosToAdd[index];
            const img = document.createElement('img');
            img.className = 'photo';
            img.src = `${photo.baseUrl}=w150-h150`;
            img.dataset.src = `${photo.baseUrl}=w800-h600`;
            img.alt = '相片';
            img.dataset.id = photo.id;
            img.addEventListener('click', () => this.openLightbox(photo.id));
            container.appendChild(img);

            existingIds.add(photo.id);
            index++;
        }

        if (index < photosToAdd.length) {
            requestIdleCallback(addBatch);
        } else {
            this.setupLazyLoad();
            this.setupScrollObserver();
            if (this.states.slideshowInterval) {
                this.states.loadedForSlideshow = this.states.photos.length;
            }
        }
    };

    requestIdleCallback(addBatch);

    // 如果確定已無更多照片，顯示「已無更多相片」
    if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = '已無更多相片';
        container.appendChild(emptyState);
    }
},

setupLazyLoad() {
    if (this.lazyObserver) {
        this.lazyObserver.disconnect(); // 保險，先清除舊的 observer
    }

    this.lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (!img.src.includes('w800')) {
                    img.src = img.dataset.src;
                }
                this.lazyObserver.unobserve(img);
            }
        });
    }, { 
        rootMargin: "300px 0px", // 提早預載，但不會太早，效能好一點
        threshold: 0.1
    });

    const images = Array.from(document.querySelectorAll(".photo:not([data-loaded])"));
    const batchSize = 20;
    let index = 0;

    const observeBatch = () => {
        for (let i = 0; i < batchSize && index < images.length; i++, index++) {
            this.lazyObserver.observe(images[index]);
            images[index].setAttribute('data-loaded', 'true');
        }

        if (index < images.length) {
            requestIdleCallback(observeBatch); // 等瀏覽器空閒再 observe 下一批
        }
    };

    observeBatch();
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

    getImageUrl(photo, width = 1024, height = 768) {
        if (!photo || !photo.baseUrl) {
            console.error("无效的照片对象:", photo);
            return "";
        }
        return `${photo.baseUrl}=w${width}-h${height}`;
    },

    openLightbox(photoId) {
    this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);

    const lightbox = document.getElementById("lightbox");
    lightbox.innerHTML = ''; // 清除舊內容

    const createImage = (photo) => {
        const img = new Image();
        img.src = this.getImageUrl(photo);
        img.style.borderRadius = '8px';
        img.style.objectFit = 'contain';
        img.style.transition = 'opacity 1.2s ease-in-out';
        img.style.opacity = 0;
        img.onload = () => {
            img.style.opacity = 1;
            this.adjustLightboxLayout(); // 加載完後自適應
        };
        return img;
    };

    if (this.states.tileMode) {
        // 進行雙圖片拼貼
        const nextIndex = (this.states.currentIndex + 1) % this.states.photos.length;
        this.states.currentTileGroup = [
            this.states.photos[this.states.currentIndex],
            this.states.photos[nextIndex]
        ];
        const img1 = createImage(this.states.currentTileGroup[0]);
        const img2 = createImage(this.states.currentTileGroup[1]);
        lightbox.appendChild(img1);
        lightbox.appendChild(img2);
    } else {
        // 單圖
        const img = createImage(this.states.photos[this.states.currentIndex]);
        lightbox.appendChild(img);
    }

    lightbox.style.display = "flex";
    lightbox.style.opacity = 0;
    setTimeout(() => {
        lightbox.style.opacity = 1;
        this.states.lightboxActive = true;
        this.toggleButtonVisibility();
    }, 10);
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
    const lightbox = document.getElementById("lightbox");

    // 取得舊的全部img
    const oldImages = Array.from(lightbox.querySelectorAll('img'));

    const totalPhotos = this.states.photos.length;
    if (this.states.tileMode) {
        // 雙圖模式，每次移動兩張
        this.states.currentIndex = (this.states.currentIndex + (2 * direction) + totalPhotos) % totalPhotos;
    } else {
        this.states.currentIndex = (this.states.currentIndex + direction + totalPhotos) % totalPhotos;
    }

    // 預先建立新的img們
    const newImages = [];

    if (this.states.tileMode) {
        const nextPhoto1 = this.states.photos[this.states.currentIndex];
        const nextPhoto2 = this.states.photos[(this.states.currentIndex + 1) % totalPhotos];

        [nextPhoto1, nextPhoto2].forEach(photo => {
            const img = new Image();
            img.src = this.getImageUrl(photo);
            img.style.opacity = 0;
            img.style.transition = 'opacity 1.2s ease-in-out';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'contain';
            newImages.push(img);
        });
    } else {
        const nextPhoto = this.states.photos[this.states.currentIndex];
        const img = new Image();
        img.src = this.getImageUrl(nextPhoto);
        img.style.opacity = 0;
        img.style.transition = 'opacity 1.2s ease-in-out';
        img.style.borderRadius = '8px';
        img.style.objectFit = 'contain';
        newImages.push(img);
    }

    // 等新的圖片都載入
    let loadedCount = 0;
    newImages.forEach(img => {
        img.onload = () => {
            loadedCount++;
            if (loadedCount === newImages.length) {
                // 所有新圖載入完成後再做動畫
                this.animateTransition(oldImages, newImages);
            }
        };
    });
},

   toggleSlideshow() {
    if (this.states.slideshowInterval) {
        this.stopSlideshow();
        this.stopClock();  // 停止時鐘
    } else {
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
    }
},

    animateTransition(oldImages, newImages) {
    const lightbox = document.getElementById("lightbox");

    oldImages.forEach(img => {
        img.style.opacity = 0;
    });

    setTimeout(() => {
        // 清空舊圖片
        lightbox.innerHTML = '';

        // 加入新圖片
        newImages.forEach(img => {
            img.style.opacity = 0;
            lightbox.appendChild(img);
        });

        // 小延遲啟動 fade-in
        requestAnimationFrame(() => {
            newImages.forEach(img => {
                img.style.opacity = 1;
            });
        });

        this.adjustLightboxLayout(); // 保持橫向直向適應
    }, 500); // 跟fade-out速度同步
},

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.toggleButtonVisibility();
    },

    toggleFullscreen() {
    const elem = document.documentElement;
    const isOldiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                     !window.MSStream && 
                     /OS [1-9]_.* like Mac OS X/.test(navigator.userAgent);

    if (isOldiOS) {
        alert("您的裝置不支援全螢幕模式");
        return;
    }

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // 進入全螢幕
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { // Safari
            elem.webkitRequestFullscreen();
        }
        this.states.isFullscreen = true;

        this.openLightbox(this.states.photos[this.states.currentIndex].id); // 開啟lightbox
        if (!this.states.slideshowInterval) {
            this.toggleSlideshow(); // 啟動幻燈片
        }
        this.toggleButtonVisibility();
    } else {
        // 退出全螢幕
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // Safari
            document.webkitExitFullscreen();
        }
        // 離開全螢幕的後續動作由 fullscreenchange 事件負責
    }
}
,

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
