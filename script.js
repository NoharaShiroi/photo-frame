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
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                error.status = response.status;
                throw error;
            }
           
        } catch (error) {
    this.handleAuthError(error);
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
            pageSize: 50, //減少初始載入延遲和記憶體佔用
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
       
           const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
            method: "POST",
            headers: {
                "Authorization": Bearer ${this.states.accessToken},
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
           let data = null;
           if (!response.ok) {
               const error = await response.json().catch(() => ({}));
               error.status = response.status;
              throw error;
           } else {
              data = await response.json();
        }
     
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
            rootMargin: "600px 0px",
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

    getImageUrl(photo, width = 1920, height = 1080, isLowQuality = false) {
    if (!photo || !photo.baseUrl) return "";
    if (isLowQuality) {
        return `${photo.baseUrl}=w600-h400`;
    }
    return `${photo.baseUrl}=w${width}-h${height}`;
},

    openLightbox(photoId) {
        // ✅ 1. 停止其他活動（例如 slideshow）
    if (this.states.slideshowInterval) this.stopSlideshow();

    // ✅ 2. 顯示圖片
    this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
    const lightbox = document.getElementById("lightbox");
    const image = document.getElementById("lightbox-image");
    image.src = this.getImageUrl(this.states.photos[this.states.currentIndex], 1920, 1080, true);
    image.onload = () => {
    lightbox.style.display = "flex";
    setTimeout(() => {
        lightbox.style.opacity = 1;
        this.states.lightboxActive = true;
        this.toggleButtonVisibility();

        // ⚡ 補載高解析圖
        image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);
    }, 10);

        // ✅ 3. 背景自動續載照片（如還有）
        if (this.states.hasMorePhotos && !this.states.isFetching) {
            setTimeout(() => this.loadPhotos(), 500);
        }
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
    image.classList.add('fade-out'); // 先淡出舊照片

    setTimeout(() => {
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
        image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);

        image.onload = () => {
            image.classList.remove('fade-out'); // 新照片載入後淡入
             };

        // 幻燈片播放時，記錄已播放過的照片
        if (this.states.slideshowInterval) {
            this.states.playedPhotos.add(this.states.photos[this.states.currentIndex].id);
            }
        }, 300); // 延遲300ms讓舊圖慢慢消失
        
        image.onload = () => {
             image.classList.remove('fade-out');
               // ⚡播放模式時續載
             if (this.states.slideshowInterval &&
             this.states.hasMorePhotos &&
             this.states.photos.length - this.states.loadedForSlideshow < 30 &&
             !this.states.isFetching) {
             setTimeout(() => this.loadPhotos(), 500);
            }
        };
   },

   toggleSlideshow() {
    if (this.states.slideshowInterval) {
        this.stopSlideshow();
        this.stopClock();
        return;
    }

    // ✅ 播放前篩選出「已載入 baseUrl」的有效圖片
    const availablePhotos = this.states.photos.filter(p => p.baseUrl);
    if (availablePhotos.length === 0) {
        alert("尚未載入任何圖片，請稍後再啟動幻燈片");
        return;
    }

    this.states.photos = availablePhotos;
    this.states.playedPhotos.clear();
    this.states.loadedForSlideshow = this.states.photos.length;
    this.states.currentIndex = 0;  // ✅ 從第一張有效圖片開始播放
    this.startClock();
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
       
           const firstValidIndex = this.states.photos.findIndex(p => p.baseUrl);
           if (firstValidIndex === -1) {
              alert("尚未載入任何圖片，請稍後再啟動幻燈片");
                  return;
           }
           this.states.currentIndex = firstValidIndex;
           this.openLightbox(this.states.photos[this.states.currentIndex].id);

    this.states.slideshowInterval = setInterval(() => {
        setTimeout(() => {
            this.states.currentIndex = getNextIndex();
            this.navigate(0);

            // ✅ 清除緩存避免記憶體過大
            if (this.states.photos.length > 500) {
                this.cleanImageCache(300);
            }

            // ✅ 若不夠照片，背景加載避免播放中斷
            if (this.states.photos.length < this.states.preloadCount &&
                this.states.hasMorePhotos &&
                !this.states.isFetching) {
                for (let i = 0; i < 3; i++) {  // 多呼叫幾次提高速度
        setTimeout(() => this.loadPhotos(), i * 500);
                   }
                } 
         }, 100);
    }, speed);

    this.toggleButtonVisibility();
},

    cleanImageCache(limit = 300) {
    const retained = new Set([...this.states.playedPhotos]);

    const finalPhotos = this.states.photos.filter(p =>
        retained.has(p.id) || p.baseUrl // 保留已播放或已載入的
    );

    if (finalPhotos.length > limit) {
        this.states.photos = finalPhotos.slice(-limit);
        document.getElementById("photo-container").innerHTML = '';
        this.renderPhotos();
        this.setupScrollObserver();
    }
},

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.states.preloadCount = this.states.defaultPreloadCount;
        this.toggleButtonVisibility();
        if (this.states.photos.length > 0) {
        document.getElementById("photo-container").innerHTML = '';
        this.renderPhotos();
        }
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
    const request = elem.requestFullscreen || elem.webkitRequestFullscreen;
    if (request) {
        request.call(elem).then(() => {
            this.states.isFullscreen = true;
            this.openLightbox(this.states.photos[this.states.currentIndex]?.id);
            this.toggleSlideshow();
            this.toggleButtonVisibility();
        }).catch(err => console.error('全螢幕錯誤:', err));
    }
} else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    this.states.isFullscreen = false;
    this.toggleButtonVisibility();
    }    
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

    handleAuthError(error = {}) {
    console.warn("授權錯誤處理中", error);

    const is401 = error.status === 401 || error.code === 401 || (error.message || "").includes("401");
    const is403 = error.status === 403 || error.code === 403 || (error.message || "").includes("403");

    if (is401 || is403) {
        const retry = confirm("授權已過期或權限不足，是否重新登入？");
        if (retry) {
            sessionStorage.removeItem("access_token");
            window.location.reload();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    } else {
        this.showMessage("發生錯誤，請稍後再試。", true);
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
