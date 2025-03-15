const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com", // 替换为你的客户端 ID
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/", // 替换为你的重定向 URI
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null, // 定时器的引用
    isPlaying: true, // 播放状态

    getAccessToken: function() {
        var hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();
            this.fetchAllPhotos();  // 在授权后预加载所有照片
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    authorizeUser: function() {
        var authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
        window.location.href = authUrl;
    },

    fetchAlbums: function() {
        if (!this.accessToken) return;
        var url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

        fetch(url, {
            method: "GET",
            headers: { "Authorization": "Bearer " + this.accessToken }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.albums) {
                this.renderAlbumList(data.albums);
            }
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
        });
    },

    renderAlbumList: function(albums) {
        var albumSelect = document.getElementById("album-select");
        albumSelect.innerHTML = '<option value="all">所有相片</option>'; // 去掉多余的选项
        albums.forEach(album => {
            var option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    },

    loadPhotos: function() {
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;

        if (this.albumId) {
            this.fetchPhotos();
        } else {
            this.fetchAllPhotos(); // 加载所有照片
        }
    },

    fetchAllPhotos: function() {
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
            pageSize: 50,
            pageToken: this.nextPageToken || ''
        };

        fetch(url, {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = [...this.photos, ...data.mediaItems];
                this.nextPageToken = data.nextPageToken;
                this.renderPhotos();
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
        });
    },

    fetchPhotos: function() {
        var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        var body = {
            albumId: this.albumId,
            pageSize: 50
        };

        fetch(url, {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = data.mediaItems;
                this.renderPhotos();
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
        });
    },

    renderPhotos: function() {
        var photoContainer = document.getElementById("photo-container");
        photoContainer.innerHTML = '';  // 清空照片容器

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
        } else {
            this.photos.forEach((photo, index) => {
                var img = document.createElement("img");
                img.src = `${photo.baseUrl}=w600-h400`;
                img.alt = "Photo";
                img.classList.add("photo");
                img.onclick = () => this.openLightbox(index);
                photoContainer.appendChild(img);
            });
        }

        photoContainer.style.display = "grid";
        document.getElementById("app-container").style.display = "flex"; // 显示相片容器
    },

    openLightbox: function(index) {
        this.currentPhotoIndex = index;
        var lightbox = document.getElementById("lightbox");
        var lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
        lightbox.style.display = "flex";
        setTimeout(() => lightbox.style.opacity = 1, 10); // 动画效果
    },

    closeLightbox: function() {
        var lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            this.currentPhotoIndex = 0; // 从第一张开始循环
            document.body.requestFullscreen(); // 进入全屏模式
            this.showCurrentPhoto();
            this.autoChangePhoto();
        }
    },

    showCurrentPhoto: function() {
        var lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
    },

    autoChangePhoto: function() {
        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            this.showCurrentPhoto();
        }, 5000); // 每5秒自动切换照片
    },

    toggleSlideshow: function() {
        if (this.isPlaying) {
            clearInterval(this.slideshowInterval); // 清除自动播放
        } else {
            this.autoChangePhoto(); // 恢复自动播放
        }
        this.isPlaying = !this.isPlaying; // 切换状态
    },

    enterFullScreen: function() {
        this.startSlideshow(); // 启动全屏播放
    },
    
    exitFullScreen: function() {
        this.closeLightbox(); // 关闭 Lightbox
    }
};

// 事件监听
document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);

document.getElementById("back-to-album-btn").onclick = () => {
    document.getElementById("photo-container").style.display = "none";
    document.getElementById("album-selection-container").style.display = "block";
};

// 关闭 Lightbox 按钮
document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);

// 全屏播放按钮
document.getElementById("fullscreen-btn").onclick = app.enterFullScreen.bind(app);

// 返回 Lightbox 显示
document.getElementById("exit-fullscreen-btn").onclick = app.exitFullScreen.bind(app);

document.addEventListener("DOMContentLoaded", () => app.getAccessToken());

// 滚动事件，用于加载更多照片
window.onscroll = function() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        app.fetchAllPhotos();
    }
};
