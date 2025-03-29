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
        document.getElementById("auth-container").style.display = "flex";
        // 舊裝置強制隱藏遮罩
        if (this.states.isOldiOS) {
            document.getElementById("screenOverlay").style.display = "none";
        }
    } else {
        this.loadSchedule();
        this.checkSchedule();
        // 舊裝置降低排程檢查頻率
        setInterval(() => this.checkSchedule(), this.states.isOldiOS ? 300000 : 60000);
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
    },

    checkSchedule() {
        const isOldiPad = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                     !window.MSStream && 
                     /OS [1-9]_.* like Mac OS X/.test(navigator.userAgent);
    
    if (isOldiPad) {
        document.getElementById("screenOverlay").style.display = "none";
        return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const sleepStart = this.getTimeInMinutes(this.states.schedule.sleepStart);
    const sleepEnd = this.getTimeInMinutes(this.states.schedule.sleepEnd);
    const classStart = this.getTimeInMinutes(this.states.schedule.classStart);
    const classEnd = this.getTimeInMinutes(this.states.schedule.classEnd);
    
    // 修改判斷邏輯，確保排程未啟用時不顯示遮罩
    const shouldShowOverlay = this.states.schedule.isEnabled && 
                           ((currentTime >= sleepStart && currentTime < sleepEnd) || 
                            (currentTime >= classStart && currentTime < classEnd) ||
                            this.isHolidayMode(now));
    
    document.getElementById("screenOverlay").style.display = 
        shouldShowOverlay ? "block" : "none";
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
    // 舊裝置強制解除遮罩
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

        let lastTouchTime = 0;
        const lightbox = document.getElementById("lightbox");
        lightbox.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });

        function shouldCloseLightbox(event) {
            return !event.target.closest('.nav-button') && !event.target.closest('img');
        }

        lightbox.addEventListener("dblclick", (event) => {
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
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
        document.getElementById("lightbox-image").src = 
            this.getImageUrl(this.states.photos[this.states.currentIndex]);
        
        // 新增：記錄已播放的照片
        if (this.states.slideshowInterval) {
            this.states.playedPhotos.add(this.states.photos[this.states.currentIndex].id);
        }
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
            document.getElementById("app-container").style.display = "none";
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
