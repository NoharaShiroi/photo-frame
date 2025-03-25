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
            sleepEnd: "06:59",
            classStart: "08:00",
            classEnd: "17:00"
        }
    },

    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        if (!this.checkAuth()) {
            document.getElementById("auth-container").style.display = "flex";
        }
        this.setupIdleMonitor();
        this.loadSchedule();
        this.checkSchedule();
        setInterval(() => this.checkSchedule(), 60000);
    },

    async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            if (!response.ok) throw new Error("相簿載入失敗");
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
            await this.loadPhotos();
        } catch (error) {
            console.error("相簿載入錯誤:", error);
            this.handleAuthError();
        }
    },

    async loadPhotos() {
        if (this.states.isFetching || !this.states.hasMorePhotos) return;

        const requestId = ++this.states.currentRequestId;
        this.states.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 100,
                pageToken: this.states.nextPageToken || undefined
            };

            if (this.states.albumId !== "all") body.albumId = this.states.albumId;
            else body.filters = { includeArchivedMedia: true };

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.states.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error("照片載入失敗");
            const data = await response.json();
            if (requestId !== this.states.currentRequestId) return;

            const newPhotos = data.mediaItems || [];
            this.states.photos.push(...newPhotos);
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;

            this.cachePhotos();
            this.renderPhotos();
        } catch (error) {
            console.error("照片載入錯誤:", error);
            this.showMessage("載入失敗，請檢查網路連線");
        } finally {
            if (requestId === this.states.currentRequestId) {
                this.states.isFetching = false;
                document.getElementById("loading-indicator").style.display = "none";
            }
        }
    },

    cachePhotos() {
        if (this.states.photos.length > 0) {
            localStorage.setItem("cachedPhotos", JSON.stringify(this.states.photos));
        }
    },

    loadCachedPhotos() {
        const cached = localStorage.getItem("cachedPhotos");
        if (cached) {
            this.states.photos = JSON.parse(cached);
            this.renderPhotos();
        }
    },

    cancelScheduleOverlay() {
        document.getElementById("screenOverlay").style.display = "none";
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());
