const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    observer: null,
    isFetching: false,

    init() {
        this.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupScrollListener();
    },

    checkAuthStatus() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showApp();
        } else if (this.accessToken) {
            this.showApp();
        } else {
            document.getElementById("auth-container").style.display = "flex";
        }
    },

    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        this.fetchAlbums();
    },

    async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.accessToken}` }
            });
            const data = await response.json();
            this.renderAlbums(data.albums || []);
            this.loadPhotos();
        } catch (error) {
            console.error("取得相簿失敗:", error);
            this.handleAuthError();
        }
    },

    renderAlbums(albums) {
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
        if (this.isFetching) return;
        this.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
            const body = {
                pageSize: 50,
                pageToken: this.nextPageToken || undefined,
                albumId: this.albumId === "all" ? undefined : this.albumId
            };

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            this.nextPageToken = data.nextPageToken || null;
            this.photos = [...this.photos, ...(data.mediaItems || [])];
            this.renderPhotos();
        } catch (error) {
            console.error("載入照片失敗:", error);
            this.handleAuthError();
        } finally {
            this.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
        }
    },

    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.innerHTML = this.photos.map(photo => `
            <img class="photo" 
                 src="${photo.baseUrl}=w300-h300" 
                 data-src="${photo.baseUrl}=w600-h400"
                 alt="相片" 
                 onclick="app.openLightbox('${photo.id}')">
        `).join("");

        this.setupLazyLoad();
        this.setupScrollListener();
    },

    setupLazyLoad() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    observer.unobserve(img);
                }
            });
        }, { rootMargin: "100px" });

        document.querySelectorAll(".photo").forEach(img => observer.observe(img));
    },

    setupScrollListener() {
        if (this.observer) this.observer.disconnect();
        
        this.observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && this.nextPageToken) {
                this.loadPhotos();
            }
        }, { threshold: 0.1 });

        const lastPhoto = document.querySelector(".photo:last-child");
        if (lastPhoto) this.observer.observe(lastPhoto);
    },

    openLightbox(photoId) {
        this.currentPhotoIndex = this.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        
        image.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1920-h1080`;
        lightbox.classList.add("active");
        
        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);
        document.getElementById("close-lightbox").onclick = () => lightbox.classList.remove("active");
    },

    changePhoto(direction) {
        this.currentPhotoIndex = (this.currentPhotoIndex + direction + this.photos.length) % this.photos.length;
        document.getElementById("lightbox-image").src = 
            `${this.photos[this.currentPhotoIndex].baseUrl}=w1920-h1080`;
    },

    handleAuthError() {
        sessionStorage.removeItem("access_token");
        window.location.reload();
    },

    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", () => {
            window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}`;
        });

        document.getElementById("album-select").addEventListener("change", () => {
            this.albumId = document.getElementById("album-select").value;
            this.photos = [];
            this.nextPageToken = null;
            this.loadPhotos();
        });
    }
};

// 初始化應用
document.addEventListener("DOMContentLoaded", () => app.init());
