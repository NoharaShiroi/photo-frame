const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: null,
    albumId: "all",
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    observer: null,
    isFetching: false,

    // 初始化方法
    init() {
        this.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        this.checkAuth();  // 使用正确的方法名称
        this.setupScrollListener();
    },

    // 授权状态检查（原checkAuthStatus改名为checkAuth）
    checkAuth() {
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

    // 显示主界面
    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        this.fetchAlbums();
    },

    // 事件监听设置
    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", () => {
            window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}`;
        });

        document.getElementById("album-select").addEventListener("change", (e) => {
            this.albumId = e.target.value;
            this.photos = [];
            this.nextPageToken = null;
            this.loadPhotos();
        });

        // 新增全屏功能监听
        document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => {
            this.toggleFullscreen();
        });
    },

    // 全屏切换功能
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    },

    // 其他保持不變的方法...
    // ...（保留原有fetchAlbums, loadPhotos, renderPhotos等方法，确保每个方法结尾都有逗号）

    // 修正后的相片加载方法
    async loadPhotos() {
        if (this.isFetching) return;
        this.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 50,
                pageToken: this.nextPageToken || undefined
            };
            
            if (this.albumId !== "all") {
                body.albumId = this.albumId;
            }

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
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
            console.error("照片加载失败:", error);
            this.handleAuthError();
        } finally {
            this.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";
            this.setupScrollListener();
        }
    },

    // 错误处理
    handleAuthError() {
        sessionStorage.removeItem("access_token");
        window.location.reload();
    }
};

// 初始化应用
document.addEventListener("DOMContentLoaded", () => app.init());
