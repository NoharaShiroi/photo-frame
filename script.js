const app = {
    // 保留原始核心配置
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    
    // 強化狀態管理
    states: {
        accessToken: null,
        albumId: "all",
        photos: [],
        currentIndex: 0,
        nextPageToken: null,
        isFetching: false,
        slideshowInterval: null,
        idleTimer: 0
    },

    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        this.checkAuth();
        this.startIdleMonitor();
    },

    // 優化授權流程
    async checkAuth() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.states.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.states.accessToken);
            window.history.replaceState({}, "", window.location.pathname);
            this.showMainUI();
        } else if (this.states.accessToken) {
            this.showMainUI();
        } else {
            document.getElementById("auth-container").style.display = "flex";
        }
    },

    async showMainUI() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        await this.loadAlbums();
        this.loadPhotos();
    },

    // 強化相簿載入
    async loadAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
        } catch (error) {
            this.handleAuthError();
        }
    },

    // 分頁載入機制加強
    async loadPhotos() {
        if (this.states.isFetching) return;
        this.states.isFetching = true;
        
        document.getElementById("loading-indicator").style.display = "block";
        
        try {
            const body = {
                pageSize: 50,
                pageToken: this.states.nextPageToken,
                albumId: this.states.albumId === "all" ? undefined : this.states.albumId
            };

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.states.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            this.states.photos = [...this.states.photos, ...(data.mediaItems || [])];
            this.states.nextPageToken = data.nextPageToken || null;
            this.renderPhotos();
        } catch (error) {
            this.handleAuthError();
        } finally {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
            this.setupScrollListener();
        }
    },

    // Lightbox 功能強化
    openLightbox(photoId) {
        this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const img = document.getElementById("lightbox-image");
        
        img.src = `${this.states.photos[this.states.currentIndex].baseUrl}=w1920-h1080`;
        lightbox.style.display = "flex";
        
        // 保留控制功能
        document.getElementById("prev-photo").onclick = () => this.navigate(-1);
        document.getElementById("next-photo").onclick = () => this.navigate(1);
        document.getElementById("start-slideshow-btn").onclick = () => this.toggleSlideshow();
    },

    // 保留核心互動功能
    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            clearInterval(this.states.slideshowInterval);
            this.states.slideshowInterval = null;
        } else {
            const speed = document.getElementById("slideshow-speed").value * 1000;
            this.states.slideshowInterval = setInterval(() => {
                this.navigate(1);
            }, speed);
        }
    }
};

// 初始化
document.addEventListener("DOMContentLoaded", () => app.init());
