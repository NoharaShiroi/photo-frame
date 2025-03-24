// script.js - 保留原有功能並整合優化
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
        lightboxActive: false,
        isFullscreen: false,
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00"
        }
    },

    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        if (!this.checkAuth()) {
            document.getElementById("auth-container").style.display = "flex";
        }
        this.loadSchedule();
        this.checkSchedule();
        setInterval(() => this.checkSchedule(), 60000);
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
        document.getElementById("authorize-btn").addEventListener("click", () => this.handleAuthFlow());
        document.getElementById("album-select").addEventListener("change", e => {
            this.states.albumId = e.target.value;
            this.resetPhotoData();
            this.loadPhotos();
        });
        document.getElementById("album-input").addEventListener("input", e => {
            this.states.albumId = e.target.value || "all";
            this.resetPhotoData();
            this.loadPhotos();
        });
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());
        document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
    },

    async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            if (!response.ok) throw new Error("無法取得相簿");
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
            this.loadPhotos();
        } catch (error) {
            console.error("取得相簿失敗", error);
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
        if (!this.states.accessToken || this.states.isFetching || !this.states.hasMorePhotos) return;
        this.states.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 50,
                pageToken: this.states.nextPageToken
            };
            if (this.states.albumId !== "all") body.albumId = this.states.albumId;

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.states.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error("照片加載失敗");
            const data = await response.json();
            this.states.photos = [...this.states.photos, ...data.mediaItems];
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;
            this.renderPhotos();
        } catch (error) {
            console.error("照片加載失敗", error);
        } finally {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
        }
    },

    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.innerHTML = this.states.photos.map(photo => `<img src="${photo.baseUrl}=w300-h300" class="photo">`).join("");
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    },

    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            clearInterval(this.states.slideshowInterval);
            this.states.slideshowInterval = null;
        } else {
            this.states.slideshowInterval = setInterval(() => this.navigate(1), 5000);
        }
    },

    navigate(direction) {
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
        document.getElementById("lightbox-image").src = `${this.states.photos[this.states.currentIndex].baseUrl}=w1920-h1080`;
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());
