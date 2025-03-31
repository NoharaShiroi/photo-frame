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
        preloadCount: 500, 
        loadedForSlideshow: 0,
        playedPhotos: new Set(),
        overlayTimeout: null,
        overlayDisabled: false,
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
            if (this.states.isOldiOS) {
                document.getElementById("screenOverlay").style.display = "none";
            }
        } else {
            this.loadSchedule();
            this.checkSchedule();
            setInterval(() => {
                console.log('執行定期排程檢查');
                this.checkSchedule();
            }, this.states.isOldiOS ? 300000 : 60000);
        }
    },

    saveSchedule() {
        this.states.schedule.sleepStart = document.getElementById("sleep-start").value;
        this.states.schedule.sleepEnd = document.getElementById("sleep-end").value;
        this.states.schedule.classStart = document.getElementById("class-start").value;
        this.states.schedule.classEnd = document.getElementById("class-end").value;
        this.states.schedule.isEnabled = document.getElementById("is-enabled").checked;
        this.states.schedule.useHoliday = document.getElementById("use-holiday").checked;
        this.checkSchedule(); // 修正此處調用
        document.getElementById("schedule-modal").style.display = "none";
    },

    calculateWakeUpTime() {
        const sleepStart = document.getElementById("sleep-start").value;
        const [hours, minutes] = sleepStart.split(":").map(Number);
        const wakeUpTime = new Date();
        wakeUpTime.setHours(hours + 8);  // 加 8 小時
        wakeUpTime.setMinutes(minutes);

        let wakeUpHours = wakeUpTime.getHours();
        let wakeUpMinutes = wakeUpTime.getMinutes();

        if (wakeUpHours < hours) {
            wakeUpHours += 24; // 處理跨日情況
        }

        document.getElementById("sleep-end").value = `${String(wakeUpHours).padStart(2, '0')}:${String(wakeUpMinutes).padStart(2, '0')}`;
    },

    calculateReturnTime() {
        const classStart = document.getElementById("class-start").value;
        const [hours, minutes] = classStart.split(":").map(Number);
        const returnTime = new Date();
        returnTime.setHours(hours + 3);  // 加 3 小時
        returnTime.setMinutes(minutes);

        let returnHours = returnTime.getHours();
        let returnMinutes = returnTime.getMinutes();

        if (returnHours < hours) {
            returnHours += 24; // 處理跨日情況
        }

        document.getElementById("class-end").value = `${String(returnHours).padStart(2, '0')}:${String(returnMinutes).padStart(2, '0')}`;
    },

    checkSchedule() {
        if (this.states.isOldiOS) {
            document.getElementById("screenOverlay").style.display = "none";
            return;
        }

        if (this.states.overlayDisabled && this.states.overlayTimeout) {
            return;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const sleepStart = this.getTimeInMinutes(this.states.schedule.sleepStart);
        const sleepEnd = this.getTimeInMinutes(this.states.schedule.sleepEnd);
        const classStart = this.getTimeInMinutes(this.states.schedule.classStart);
        const classEnd = this.getTimeInMinutes(this.states.schedule.classEnd);

        const isSleepTime = sleepStart < sleepEnd 
            ? (currentTime >= sleepStart && currentTime < sleepEnd)
            : (currentTime >= sleepStart || currentTime < sleepEnd);
        
        const isClassTime = currentTime >= classStart && currentTime < classEnd;
        const isHoliday = this.isHolidayMode(now);
        
        const shouldShowOverlay = this.states.schedule.isEnabled && 
                               (isSleepTime || isClassTime || isHoliday);

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
        const authorizeButton = document.getElementById("authorize-btn");
        const albumSelect = document.getElementById("album-select");
        const screenOverlay = document.getElementById("screenOverlay");

        if (authorizeButton) {
            authorizeButton.addEventListener("click", (e) => {
                e.preventDefault();
                this.handleAuthFlow();
            });
        }

        if (albumSelect) {
            albumSelect.addEventListener("change", (e) => {
                this.states.albumId = e.target.value;
                this.resetPhotoData();
                this.loadPhotos();
            });
        }

        if (screenOverlay) {
            screenOverlay.addEventListener("dblclick", () => this.temporarilyDisableOverlay());

            let lastTouchTime = 0;
            screenOverlay.addEventListener("touchend", (e) => {
                const currentTime = new Date().getTime();
                if (currentTime - lastTouchTime < 500) {
                    this.temporarilyDisableOverlay();
                    e.preventDefault();
                }
                lastTouchTime = currentTime;
            });
        }

        document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
        document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
        document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());
    },
    
    temporarilyDisableOverlay() {
        if (document.getElementById("screenOverlay").style.display === "block") {
            document.getElementById("screenOverlay").style.display = "none";
            this.states.overlayDisabled = true;

            if (this.states.overlayTimeout) {
                clearTimeout(this.states.overlayTimeout);
            }

            this.states.overlayTimeout = setTimeout(() => {
                this.states.overlayDisabled = false;
                this.states.overlayTimeout = null;
                this.checkSchedule();
            }, 5 * 60 * 1000);
            
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
                if (this.states.photos.length === 0) {
                    throw new Error('照片加載失敗');
                }
                return;
            }

            const data = await response.json();

            if (requestId !== this.states.currentRequestId) return;

            const existingIds = new Set(this.states.photos.map(p => p.id));
            const newPhotos = data.mediaItems.filter(item => item && !existingIds.has(item.id));

            if (newPhotos.length === 0 && data.nextPageToken) {
                this.states.nextPageToken = null;
                this.states.hasMorePhotos = false;
            } else {
                this.states.photos = [...this.states.photos, ...newPhotos];
                this.states.nextPageToken = data.nextPageToken || null;
                this.states.hasMorePhotos = !!this.states.nextPageToken;
            }

            this.renderPhotos();

            if (this.states.hasMorePhotos) {
                let delay = 300;
                
                if (this.states.photos.length >= this.states.preloadCount) {
                    delay = 1000;
                }

                if (this.states.slideshowInterval && 
                    this.states.photos.length - this.states.loadedForSlideshow < 50) {
                    delay = 300;
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

    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.style.display = "grid";

        const existingError = container.querySelector('.error-state');
        if (existingError) {
            container.removeChild(existingError);
        }

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

        const existingEmptyState = container.querySelector('.empty-state');
        if (existingEmptyState) {
            container.removeChild(existingEmptyState);
        }

        if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
            const emptyState = document.createElement('p');
            emptyState.className = 'empty-state';
            emptyState.textContent = '已無更多相片';
            fragment.appendChild(emptyState);
        }

        container.appendChild(fragment);
        this.setupLazyLoad();

        if (this.states.slideshowInterval) {
            this.states.loadedForSlideshow = this.states.photos.length;
        }

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
            console.error("無效的照片對象:", photo);
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
