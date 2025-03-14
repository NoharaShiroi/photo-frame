// 全局变量封装
const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: localStorage.getItem("albumId") || null,
    photos: [],
    currentPhotoIndex: 0,
    slideshowInterval: null,

    // 获取访问令牌
    getAccessToken: function() {
        var hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // 调试输出 accessToken
        console.log("Access Token after getAccessToken: ", this.accessToken);  // 输出当前的 accessToken

        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();  // 获取相册列表
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    // 授权用户
    authorizeUser: function() {
        var authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
        window.location.href = authUrl;
    },

    // 获取相册列表
    fetchAlbums: function() {
        if (!this.accessToken) return;
        var url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";
        
        fetch(url, {
            method: "GET",
            headers: { "Authorization": "Bearer " + this.accessToken }
        })
        .then(response => response.json())
        .then(data => {
            // 调试输出相册数据
            console.log("Fetched Albums Data: ", data);  // 输出获取到的相册数据
            if (data.albums) {
                this.renderAlbumList(data.albums);
            }
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
        });
    },

    // 显示相册列表
    renderAlbumList: function(albums) {
        var albumListContainer = document.getElementById("album-list");
        albumListContainer.innerHTML = '';
        albums.forEach(album => {
            var li = document.createElement("li");
            li.textContent = album.title;
            li.onclick = () => {
                this.albumId = album.id;
                localStorage.setItem("albumId", this.albumId);
                this.fetchPhotos();
            };
            albumListContainer.appendChild(li);
        });
    },

    // 获取相册中的照片
    fetchPhotos: function() {
        // 调试输出 albumId
        console.log("Fetching photos for Album ID: ", this.albumId);  // 输出当前的 albumId

        if (!this.albumId || !this.accessToken) {
            console.error("No albumId or accessToken found.");
            return;
        }

        var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        var body = {
            albumId: this.albumId,
            pageSize: 50
            // 去掉 filters，只请求所有媒体项
        };

        fetch(url, {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("API Response Data: ", data);  // 输出完整的API响应数据
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

    // 显示照片
    renderPhotos: function() {
        var photoContainer = document.getElementById("photo-container");
        photoContainer.innerHTML = '';

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
        } else {
            this.photos.forEach(photo => {
                var img = document.createElement("img");
                img.src = `${photo.baseUrl}=w600-h400`;
                img.alt = "Photo";
                img.classList.add("photo");
                img.onclick = () => this.openLightbox(photo.baseUrl);
                photoContainer.appendChild(img);
            });
        }

        photoContainer.style.display = "grid";
        document.getElementById("app-container").style.display = "flex";
    },

    // 放大图片
    openLightbox: function(imageUrl) {
        var lightbox = document.getElementById("lightbox");
        var lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${imageUrl}=w1200-h800`;
        lightbox.style.display = "flex";
        setTimeout(() => lightbox.style.opacity = 1, 10); // 动画效果
    },

    // 关闭Lightbox
    closeLightbox: function() {
        var lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    // 启动幻灯片
    startSlideshow: function() {
        if (this.photos.length === 0) return;
        if (this.slideshowInterval) clearInterval(this.slideshowInterval);

        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            document.getElementById("lightbox-image").src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
        }, 5000);
    }
};

// 事件监听
document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
document.getElementById("back-to-album-btn").onclick = () => {
    document.getElementById("photo-container").style.display = "none";
    document.getElementById("album-selection-container").style.display = "block";
};

// 页面加载时执行
document.addEventListener("DOMContentLoaded", () => app.getAccessToken());
