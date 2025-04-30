// 整合強化版 JavaScript 模組化版本
// 主物件 app 拆分為模組區

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
        preloadCount: 100,
        loadedForSlideshow: 0,
        playedPhotos: new Set(),
        overlayTimeout: null,
        overlayDisabled: false,
        clockInterval: null,
        isOldiOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && /OS [1-9]_.* like Mac OS X/.test(navigator.userAgent),
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00",
            classStart: "08:00",
            classEnd: "17:00",
            isEnabled: false,
            useHoliday: true,
        },
        randomQueue: []
    },

    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();

        if (!this.checkAuth()) {
            document.getElementById("auth-container").style.display = "flex";
            if (this.states.isOldiOS) document.getElementById("screenOverlay").style.display = "none";
        } else {
            this.loadSchedule();
            this.checkSchedule();
            setInterval(() => this.checkSchedule(), this.states.isOldiOS ? 300000 : 60000);
        }
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
        return !!this.states.accessToken;
    },

    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        if (this.states.isOldiOS) document.getElementById("screenOverlay").style.display = "none";
        this.fetchAlbums();
    },

    renderPhotos() {
        const container = document.getElementById("photo-container");
        const fragment = document.createDocumentFragment();
        const startIndex = container.children.length;
        for (let i = startIndex; i < this.states.photos.length; i++) {
            const photo = this.states.photos[i];
            const wrapper = document.createElement("div");
            wrapper.className = "photo-wrapper";

            const img = document.createElement("img");
            img.className = "photo";
            img.loading = "lazy";
            img.src = `${photo.baseUrl}=w150-h150`;
            img.dataset.src = `${photo.baseUrl}=w800-h600`;
            img.alt = photo.filename || "相片";
            img.dataset.id = photo.id;
            img.onclick = () => this.openLightbox(photo.id);

            const info = document.createElement("div");
            info.className = "photo-info";
            info.textContent = new Date(photo.mediaMetadata?.creationTime || '').toLocaleString();

            wrapper.appendChild(img);
            wrapper.appendChild(info);
            fragment.appendChild(wrapper);
        }
        container.appendChild(fragment);
    },

    prepareRandomQueue() {
        const ids = this.states.photos.map((_, i) => i);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        this.states.randomQueue = ids;
    },

    getNextIndexRandom() {
        if (this.states.randomQueue.length === 0) {
            this.prepareRandomQueue();
        }
        return this.states.randomQueue.shift();
    },

    getNextIndexSequential() {
        return (this.states.currentIndex + 1) % this.states.photos.length;
    },

    restartSlideshow() {
        this.stopSlideshow();
        this.startSlideshow();
    },

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.toggleButtonVisibility();
    },

    startSlideshow() {
        const speed = parseInt(document.getElementById("slideshow-speed").value || 5) * 1000;
        const isRandom = document.getElementById("play-mode").value === "random";

        if (isRandom) this.prepareRandomQueue();

        this.states.slideshowInterval = setInterval(() => {
            this.states.currentIndex = isRandom
                ? this.getNextIndexRandom()
                : this.getNextIndexSequential();
            this.navigate(0);
        }, speed);

        this.toggleButtonVisibility();
    },

    navigate(direction) {
        const image = document.getElementById("lightbox-image");
        image.classList.add("fade-out");
        setTimeout(() => {
            this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
            image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);
            image.onload = () => image.classList.remove("fade-out");
        }, 300);
    },

    getImageUrl(photo, width = 1920, height = 1080) {
        return `${photo.baseUrl}=w${width}-h${height}`;
    },

    openLightbox(photoId) {
        this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);
        image.onload = () => {
            image.style.maxWidth = '90%';
            image.style.maxHeight = '90%';
            lightbox.style.display = "flex";
            setTimeout(() => lightbox.style.opacity = 1, 10);
        };
    },

    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    toggleButtonVisibility() {
        const isSlideshow = !!this.states.slideshowInterval;
        document.querySelectorAll(".nav-button").forEach(btn => {
            btn.style.display = isSlideshow ? "none" : "block";
        });
    },

    showMessage(msg, isError = false) {
        const el = document.createElement("div");
        el.className = isError ? "error-message" : "info-message";
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    },

    handleAuthError() {
        sessionStorage.removeItem("access_token");
        this.states.accessToken = null;
        this.showMessage("授權已過期，請重新登入。", true);
        setTimeout(() => location.reload(), 1500);
    },

    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", () => this.handleAuthFlow());
        document.getElementById("start-slideshow-btn").addEventListener("click", () => {
            if (this.states.slideshowInterval) this.stopSlideshow();
            else this.startSlideshow();
        });
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());
        document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
        document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
    },

    toggleFullscreen() {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        this.states.isFullscreen = !this.states.isFullscreen;
        this.toggleButtonVisibility();
    },

    fetchAlbums() {
        fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
            headers: { Authorization: `Bearer ${this.states.accessToken}` }
        })
            .then(res => res.json())
            .then(data => {
                const select = document.getElementById("album-select");
                select.innerHTML = '<option value="all">所有相片</option>';
                (data.albums || []).forEach(album => {
                    const option = document.createElement("option");
                    option.value = album.id;
                    option.textContent = album.title;
                    select.appendChild(option);
                });
                this.loadPhotos();
            })
            .catch(() => this.handleAuthError());
    },

    loadPhotos() {
        if (this.states.isFetching || !this.states.hasMorePhotos) return;
        const body = {
            pageSize: 100,
            pageToken: this.states.nextPageToken || undefined
        };
        if (this.states.albumId !== "all") body.albumId = this.states.albumId;
        else body.filters = { includeArchivedMedia: true };

        this.states.isFetching = true;
        fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.states.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
            .then(res => res.json())
            .then(data => {
                const newPhotos = (data.mediaItems || []).filter(item => item && item.baseUrl);
                this.states.photos.push(...newPhotos);
                this.states.nextPageToken = data.nextPageToken || null;
                this.states.hasMorePhotos = !!this.states.nextPageToken;
                this.renderPhotos();
            })
            .catch(err => this.showMessage("載入照片失敗。", true))
            .finally(() => this.states.isFetching = false);
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());
