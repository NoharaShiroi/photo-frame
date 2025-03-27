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
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00",
            classStart: "08:00",
            classEnd: "17:00",
            isEnabled: true,
            useHoliday: true,
        },
        isPaused: false,
        idleTimeout: null,
        displayedPhotos: new Set(), // 用于记录已显示的照片
    },

    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        
        if (!this.checkAuth()) {
            document.getElementById("auth-container").style.display = "flex";
        } else {
            this.loadSchedule();
            this.checkSchedule();
            setInterval(() => this.checkSchedule(), 60000);
            this.loadPhotos();
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
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const sleepStart = this.getTimeInMinutes(this.states.schedule.sleepStart);
        const sleepEnd = this.getTimeInMinutes(this.states.schedule.sleepEnd);
        const classStart = this.getTimeInMinutes(this.states.schedule.classStart);
        const classEnd = this.getTimeInMinutes(this.states.schedule.classEnd);
        const isSleepTime = this.states.schedule.isEnabled && 
                            ((currentTime >= sleepStart && currentTime < sleepEnd) || 
                             (currentTime >= classStart && currentTime < classEnd));

        if (isSleepTime || this.isHolidayMode(now)) {
            this.pauseSlideshow();
            document.getElementById("screenOverlay").style.display = "block";
            this.states.isPaused = true;
        } else {
            document.getElementById("screenOverlay").style.display = "none";
            this.states.isPaused = false;
            this.resetIdleTimer();
        }
    },

    resetIdleTimer() {
        if (this.states.idleTimeout) {
            clearTimeout(this.states.idleTimeout);
        }
        
        this.states.idleTimeout = setTimeout(() => {
            if (this.states.isPaused) {
                document.getElementById("screenOverlay").style.display = "block";
            }
        }, 5 * 60 * 1000);
    },

    isHolidayMode(date) {
        return this.states.schedule.useHoliday && !this.isWeekday(date);
    },

    isWeekday(date) {
        const day = date.getDay();
        return day !== 0 && day !== 6; // 星期日和六为假日
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
        window.location.href = `${authEndpoint}?${new URLSearchParams(params)}`;
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

        let lastClickTime = 0;
        const lightbox = document.getElementById("lightbox");

        document.getElementById("screenOverlay").addEventListener("click", (event) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastClickTime <= 500) {
                if (this.states.isPaused) {
                    document.getElementById("screenOverlay").style.display = "none";
                    this.states.isPaused = false;
                    this.resetIdleTimer();
                }
                lastClickTime = 0;
            } else {
                lastClickTime = currentTime; 
            }
        });

        document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
        document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
        document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());

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
    },

    async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            if (!response.ok) throw new Error('无效的相簿请求');
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
        if (this.states.isFetching || !this.states.hasMorePhotos) return;

        const requestId = ++this.states.currentRequestId;
        this.states.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 30, // 修改为每次加载30张
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

            if (!response.ok) throw new Error('照片加载失败');
            const data = await response.json();

            if (requestId !== this.states.currentRequestId) return;

            const existingIds = new Set(this.states.photos.map(p => p.id));
            const newPhotos = data.mediaItems.filter(item => item && !existingIds.has(item.id));

            this.states.photos = [...this.states.photos, ...newPhotos];
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;

            this.renderPhotos();
        } catch (error) {
            console.error("照片加载失败:", error);
            this.showMessage("加载失败，请检查网络连接");
        } finally {
            if (requestId === this.states.currentRequestId) {
                this.states.isFetching = false;
                document.getElementById("loading-indicator").style.display = "none";
                this.setupScrollObserver();
            }
        }
    },

    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.style.display = "grid";
        container.innerHTML = this.states.photos.map(photo => `
            <img class="photo" 
                 src="${photo.baseUrl}=w150-h150"
                 data-src="${photo.baseUrl}=w800-h600"
                 alt="照片" 
                 data-id="${photo.id}">
        `).join("");

        this.setupLazyLoad();
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
    },

    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            this.stopSlideshow();
        } else {
            const speed = document.getElementById("slideshow-speed").value * 1000 || 1000;
            const isRandom = document.getElementById("play-mode").value === "random";

            const getNextIndex = () => {
                let nextIndex;
                if (isRandom) {
                    do {
                        nextIndex = Math.floor(Math.random() * this.states.photos.length);
                    } while (this.states.displayedPhotos.has(nextIndex) && this.states.photos.length > 1);
                } else {
                    nextIndex = (this.states.currentIndex + 1) % this.states.photos.length;
                }

                // 标记已显示的照片
                this.states.displayedPhotos.add(nextIndex);
                return nextIndex;
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

    pauseSlideshow() {
        if (this.states.slideshowInterval) {
            this.stopSlideshow();
            this.states.isPaused = true;
        }
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('全螢幕錯誤:', err);
            });
        } else {
            document.exitFullscreen();
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
        this.states.displayedPhotos.clear(); // 清空已显示照片的集合
        document.getElementById("photo-container").innerHTML = '';
        this.setupScrollObserver();
    },

    getImageUrl(photo, width = 1920, height = 1080) {
        if (!photo || !photo.baseUrl) {
            console.error("无效的照片对象:", photo);
            return "";
        }
        return `${photo.baseUrl}=w${width}-h${height}`;
    },

    handleAuthError() {
        const retry = confirm("授权已过期，是否重新登入？");
        if (retry) {
            sessionStorage.removeItem("access_token");
            window.location.reload();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    showMessage(message) {
        const container = document.getElementById("photo-container");
        const messageElement = document.createElement("p");
        messageElement.className = "empty-state";
        messageElement.textContent = message;
        container.appendChild(messageElement);
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());
