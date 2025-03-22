const app = {
    // 配置參數
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    
    // 狀態管理
    states: {
        accessToken: null,
        albumId: "all",
        photos: [],
        currentIndex: 0,
        nextPageToken: null,
        isFetching: false,
        slideshowInterval: null,
        observer: null,
        hasMorePhotos: true // 新增：標記是否還有更多照片
    },

    // 初始化
    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        this.checkAuth();
        this.setupIdleMonitor();
    },

    // 授權檢查
    checkAuth() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.states.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.states.accessToken);
            window.history.replaceState({}, "", window.location.pathname);
            this.showApp();
        } else if (this.states.accessToken) {
            this.showApp();
        } else {
            document.getElementById("auth-container").style.display = "flex";
        }
    },

    // 顯示主界面
    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        this.fetchAlbums();
    },

    // 事件監聽
    setupEventListeners() {
        // 授權按鈕
        document.getElementById("authorize-btn").addEventListener("click", () => {
            const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}`;
            window.location.href = authUrl;
        });

        // 相簿選擇
        document.getElementById("album-select").addEventListener("change", (e) => {
            this.states.albumId = e.target.value;
            this.resetPhotoData();
            this.loadPhotos();
        });

        // Lightbox控制
        document.getElementById("close-lightbox").addEventListener("click", () => this.closeLightbox());
        document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
        document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
        document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());
    },

    // 獲取相簿列表
    async fetchAlbums() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
            this.loadPhotos();
        } catch (error) {
            this.handleAuthError();
        }
    },

    // 渲染相簿選單
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

    // 載入照片
    async loadPhotos() {
        if (this.states.isFetching || !this.states.hasMorePhotos) return;
        this.states.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 100,  // 每次加載 100 張照片
                pageToken: this.states.nextPageToken || undefined
            };

            if (this.states.albumId !== "all") {
                body.albumId = this.states.albumId;
            } else {
                body.filters = { includeArchivedMedia: true }; // 包含所有媒體
            }

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.states.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);

            // 合併照片並去重
            const newPhotos = data.mediaItems.filter(
                item => !this.states.photos.some(p => p.id === item.id)
            );
            this.states.photos = [...this.states.photos, ...newPhotos];
            this.states.nextPageToken = data.nextPageToken || null;

            // 檢查是否還有更多照片
            this.states.hasMorePhotos = !!this.states.nextPageToken;

            this.renderPhotos();
        } catch (error) {
            console.error("照片加載失敗:", error);
            this.showMessage("加載失敗，請稍後重試");
        } finally {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
            this.setupScrollObserver();
        }
    },

    // 渲染照片
    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.style.display = "grid";
        container.innerHTML = this.states.photos.map(photo => `
            <img class="photo" 
                 src="${photo.baseUrl}=w300-h300" 
                 data-src="${photo.baseUrl}=w800-h600"
                 alt="相片" 
                 data-id="${photo.id}"
                 onclick="app.openLightbox('${photo.id}')">
        `).join("");

        // 如果沒有更多照片，顯示提示
        if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
            container.insertAdjacentHTML("beforeend", `<p class="empty-state">已無更多相片</p>`);
        }

        this.setupLazyLoad();
        this.setupScrollObserver();
    },

    // 延遲加載
    setupLazyLoad() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src + "-no"; // 先加載低分辨率
                    setTimeout(() => {
                        img.src = img.dataset.src; // 加載高清版本
                    }, 300);
                    observer.unobserve(img);
                }
            });
        }, { 
            rootMargin: "200px 0px",
            threshold: 0.01 
        });

        document.querySelectorAll(".photo").forEach(img => {
            if (!img.src.includes("baseUrl")) observer.observe(img);
        });
    },

    // 增強滾動監聽
    setupScrollObserver() {
        if (this.states.observer) this.states.observer.disconnect();
        
        this.states.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && 
                        this.states.nextPageToken && 
                        !this.states.isFetching &&
                        this.states.hasMorePhotos
                    ) {
                        this.loadPhotos();
                    }
                });
            },
            {
                root: null,
                rootMargin: "200px",
                threshold: 0.01
            }
        );

        const lastPhoto = document.querySelector(".photo:last-child");
        if (lastPhoto) {
            this.states.observer.observe(lastPhoto);
        }
    },

    // 顯示提示訊息
    showMessage(message) {
        const container = document.getElementById("photo-container");
        const messageElement = document.createElement("p");
        messageElement.className = "empty-state";
        messageElement.textContent = message;
        container.appendChild(messageElement);
    },

    // Lightbox控制
    openLightbox(photoId) {
        this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        
        image.src = `${this.states.photos[this.states.currentIndex].baseUrl}=w1920-h1080`;
        lightbox.style.display = "flex";
        setTimeout(() => lightbox.style.opacity = 1, 10);
    },

    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
        this.stopSlideshow();
    },

    navigate(direction) {
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
        document.getElementById("lightbox-image").src = 
            `${this.states.photos[this.states.currentIndex].baseUrl}=w1920-h1080`;
    },

    // 幻燈片控制
    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            this.stopSlideshow();
        } else {
            const speed = document.getElementById("slideshow-speed").value * 1000;
            this.states.slideshowInterval = setInterval(() => {
                this.navigate(1);
            }, speed);
        }
    },

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
    },

    // 全螢幕控制
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    },

    // 閒置監控
    setupIdleMonitor() {
        let idleTime = 0;
        const resetTimer = () => {
            idleTime = 0;
            document.getElementById("screenOverlay").style.display = "none";
        };
        
        setInterval(() => {
            idleTime++;
            if (idleTime > 300) {
                document.getElementById("screenOverlay").style.display = "block";
            }
        }, 1000);

        document.addEventListener("mousemove", resetTimer);
        document.addEventListener("touchstart", resetTimer);
        document.addEventListener("keydown", resetTimer);
    },

    // 重置資料
    resetPhotoData() {
        this.states.photos = [];
        this.states.nextPageToken = null;
        this.states.hasMorePhotos = true; // 重置為可加載狀態
        document.getElementById("photo-container").innerHTML = "";
    },

    // 錯誤處理
    handleAuthError() {
        const retry = confirm("授權已過期，是否重新登入？");
        if (retry) {
            sessionStorage.removeItem("access_token");
            window.location.reload();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    }
};

// API請求重試邏輯
app.fetchWithRetry = async function(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};

// 初始化
document.addEventListener("DOMContentLoaded", () => app.init());
