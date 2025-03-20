const app = {
    // Google API相关配置
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,

    // 数据储存
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null,
    slideshowSpeed: 3000,
    isSlideshowPlaying: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepModeActive: false,

    getAccessToken: function() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();
            this.loadPhotos();
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    authorizeUser: function() {
        const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
        window.location.href = authUrl;
    },

    fetchAlbums: function() {
        if (!this.accessToken) return;
        const url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

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
            } else {
                console.error("No albums found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
        });
    },

    renderAlbumList: function(albums) {
        const albumSelect = document.getElementById("album-select");
        albumSelect.innerHTML = '<option value="all">所有相片</option>'; 
        albums.forEach(album => {
            const option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    },

    loadPhotos: function() {
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;

        // 清空目前显示的照片
        this.photos = [];
        this.nextPageToken = null;
        const photoContainer = document.getElementById("photo-container");
        photoContainer.innerHTML = ''; // 清空照片显示区

        // 使用缓存加载照片
        this.loadPhotosFromCache();
        
        if (this.albumId) {
            this.fetchPhotos();
        } else {
            this.fetchAllPhotos(); 
        }
    },

    loadPhotosFromCache: function() {
        const cachedPhotos = JSON.parse(localStorage.getItem(`photos_${this.albumId}`)) || [];
        if (cachedPhotos.length > 0) {
            this.photos = cachedPhotos;
            this.renderPhotos();
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
                // 增加处理数据更新的逻辑
                this.photos = [...new Map(this.photos.concat(data.mediaItems).map(item => [item.id, item])).values()];
                this.nextPageToken = data.nextPageToken;

                // 写入缓存
                localStorage.setItem(`photos_${this.albumId}`, JSON.stringify(this.photos));
                
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
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
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
                // 处理重复项逻辑
                this.photos = [...new Map(this.photos.concat(data.mediaItems).map(item => [item.id, item])).values()];
                this.renderPhotos();

                // 写入缓存
                localStorage.setItem(`photos_${this.albumId}`, JSON.stringify(this.photos));
            } else {
                console.error("No mediaItems found in the response.");
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
        });
    },

    renderPhotos: function() {
        const photoContainer = document.getElementById("photo-container");
        photoContainer.innerHTML = '';  

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
        } else {
            this.photos.forEach((photo, index) => {
                const img = document.createElement("img");
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
        const lightbox = document.getElementById("lightbox");
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
        lightbox.style.display = "flex"; 
        setTimeout(() => lightbox.style.opacity = 1, 10);

        // 绑定上下两张的按钮事件
        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);

        clearInterval(this.slideshowInterval); 

        this.setupLightboxClick();
    },

    setupLightboxClick: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        let clickTimeout; 

        lightboxImage.onclick = (event) => {
            event.stopPropagation(); 
            clearTimeout(clickTimeout); 

            clickTimeout = setTimeout(() => {
                if (this.isSlideshowPlaying) {
                    this.pauseSlideshow(); 
                } else {
                    this.resumeSlideshow(); 
                }
            }, 250); 

            lightboxImage.ondblclick = () => {
                clearTimeout(clickTimeout); 
                this.closeLightbox(); 
                this.pauseSlideshow(); 
            };
        };
    },

    closeLightbox: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => lightbox.style.display = "none", 300);
    },

    changePhoto: function(direction) {
        this.currentPhotoIndex += direction;
        if (this.currentPhotoIndex < 0) {
            this.currentPhotoIndex = this.photos.length - 1; 
        } else if (this.currentPhotoIndex >= this.photos.length) {
            this.currentPhotoIndex = 0; 
        }
        this.showCurrentPhoto(); 
    },

    showCurrentPhoto: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            const speedInput = document.getElementById("slideshow-speed");
            let playOrder = document.getElementById("play-order").value;
            this.slideshowSpeed = speedInput.value * 1000; 
            this.autoChangePhoto(playOrder); 
            this.isSlideshowPlaying = true; 

            document.body.classList.add('slideshow-active');
        }
    },

    pauseSlideshow: function() {
        clearInterval(this.slideshowInterval); 
        this.isSlideshowPlaying = false; 
        document.body.classList.remove('slideshow-active');
    },

    resumeSlideshow: function() {
        const playOrder = document.getElementById("play-order").value;
        this.autoChangePhoto(playOrder); 
        this.isSlideshowPlaying = true; 
    },

    autoChangePhoto: function(playOrder) {
        clearInterval(this.slideshowInterval);
        this.slideshowInterval = setInterval(() => {
            if (playOrder === "random") {
                this.currentPhotoIndex = Math.floor(Math.random() * this.photos.length);
            } else {
                this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            }
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    },

    setSleepMode: function() {
        const startTime = document.getElementById("sleep-time-start").value;
        const endTime = document.getElementById("sleep-time-end").value;

        if (startTime && endTime) {
            this.sleepStartTime = startTime;
            this.sleepEndTime = endTime;

            alert('休眠时间已设定，从 ' + this.sleepStartTime + ' 至 ' + this.sleepEndTime);
            this.checkSleepMode();
            setInterval(() => this.checkSleepMode(), 60000); 
        } else {
            alert('请设置完整的休眠时间');
        }
    },

    checkSleepMode: function() {
        const now = new Date();
        const startHour = parseInt(this.sleepStartTime.split(':')[0], 10);
        const startMinute = parseInt(this.sleepStartTime.split(':')[1], 10);
        const endHour = parseInt(this.sleepEndTime.split(':')[0], 10);
        const endMinute = parseInt(this.sleepEndTime.split(':')[1], 10);

        const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
        const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);

        if (endTime < startTime) { // 处理跨天情况
            endTime.setDate(endTime.getDate() + 1);
            if (now < endTime && now >= startTime) {
                this.activateSleepMode();
                return;
            }
        }

        if (now >= startTime && now < endTime) {
            this.activateSleepMode();
        } else {
            this.deactivateSleepMode();
        }
    },

    activateSleepMode: function() {
        if (!this.sleepModeActive) {
            this.sleepModeActive = true;
            this.pauseSlideshow();
            document.getElementById("photo-container").style.display = "none"; 
            document.body.style.filter = "brightness(20%)"; 
            console.log('进入休眠模式');
        }
    },

    deactivateSleepMode: function() {
        if (this.sleepModeActive) {
            this.sleepModeActive = false;
            document.body.style.filter = "brightness(100%)"; 
            document.getElementById("photo-container").style.display = "grid"; 
            console.log('退出休眠模式');
        }
    },

    // 新增的错误处理
    handleErrors: function(response) {
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response;
    }
};

// 当 DOM 内容加载完成后，添加事件监听
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    
    // 处理相册返回
    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    app.getAccessToken();

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

    document.getElementById("set-sleep-btn").onclick = app.setSleepMode.bind(app);
    document.getElementById("activate-btn").onclick = function() {
        app.sleepModeActive = !app.sleepModeActive; 
        if (app.sleepModeActive) {
            app.activateSleepMode();
        } else {
            app.deactivateSleepMode();
        }
    };
});
