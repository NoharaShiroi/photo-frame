const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com", 
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/", 
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null, 
    isPlaying: false, 
    slideshowSpeed: 5000, // 默认速度（毫秒）

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
            this.fetchAllPhotos(); 
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
        albumSelect.innerHTML = '<option value="all">所有相片</option>'; 
        albums.forEach(album => {
            var option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    },

    loadPhotos: function() {
    // 增加调试输出
    console.log("Loading photos...");
    
    const albumSelect = document.getElementById("album-select");
    this.albumId = albumSelect.value === "all" ? null : albumSelect.value;

    // 增加调试输出
    console.log("Selected albumId:", this.albumId);

    if (this.albumId) {
        this.fetchPhotos();
    } else {
        this.(); 
    }
},


    fetchAllPhotos: function() {
    const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    const body = {
        pageSize: 50,
        pageToken: this.nextPageToken || ''
    };

    console.log("Fetching all photos...");

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
        console.log("All photos fetched successfully:", data);
        if (data.mediaItems) {
            // 将新获取的照片追加到数组中
            this.photos = [...this.photos, ...data.mediaItems];
            // 更新 nextPageToken
            this.nextPageToken = data.nextPageToken;

            // 检查是否还有更多照片，如果有，则继续请求
            if (this.nextPageToken) {
                this.fetchAllPhotos();  // 继续获取剩余的照片
            } else {
                this.renderPhotos();  // 所有照片都获取完毕后渲染
            }
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

    // 增加调试输出
    console.log("Fetching photos for albumId:", this.albumId);

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
        // 增加调试输出，查看获取到的数据
        console.log("Photos fetched successfully:", data);
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
    photoContainer.innerHTML = '';  

    // 增加调试输出
    console.log("Rendering photos... Total photos:", this.photos.length);

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
    document.getElementById("app-container").style.display = "flex"; 
},


    openLightbox: function(index) {
        this.currentPhotoIndex = index;
        var lightbox = document.getElementById("lightbox");
        var lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
        lightbox.style.display = "flex"; 
        setTimeout(() => lightbox.style.opacity = 1, 10);

        // 绑定上下一张的按钮事件
        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);

        // 停止轮播
        clearInterval(this.slideshowInterval); // 确保在打开 Lightbox 时不运行轮播
    },

    closeLightbox: function() {
        var lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    changePhoto: function(direction) {
        this.currentPhotoIndex += direction;
        if (this.currentPhotoIndex < 0) {
            this.currentPhotoIndex = this.photos.length - 1; // 循环到最后一张
        } else if (this.currentPhotoIndex >= this.photos.length) {
            this.currentPhotoIndex = 0; // 循环到第一张
        }
        this.showCurrentPhoto(); // 更新显示的照片
    },

    showCurrentPhoto: function() {
        var lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            // 获取用户设置的轮播速度
            const speedInput = document.getElementById("slideshow-speed");
            this.slideshowSpeed = speedInput.value * 1000; // 转换为毫秒
            this.autoChangePhoto(); 
        }
    },

    autoChangePhoto: function() {
        clearInterval(this.slideshowInterval); // 清除现有的轮播
        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    }
};

// 当 DOM 内容加载完成后，添加事件监听
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    document.getElementById("start-slideshow-btn").onclick = app.startSlideshow.bind(app);

    // 处理相册返回
    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    app.getAccessToken();

    // 绑定 Lightbox 点击事件关闭
    document.getElementById("lightbox").addEventListener("click", function(event) {
        if (event.target === this) {
            app.closeLightbox();
        }
    });

    window.onscroll = function() {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
            app.fetchAllPhotos();
        }
    };
});
