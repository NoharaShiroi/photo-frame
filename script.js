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
    slideshowSpeed: 3000,
    isSlideshowPlaying: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepModeActive: false,
    cacheEnabled: true,
    cacheExpiration: 86400000, // 24hrs in ms

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
        window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
    },

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
            this.albums = data.albums; // ** 新增：保存albums數據到app.albums屬性
            this.(data.albums); // 或 this.(this.albums);
        } else {
            console.error("No albums found in the response.");
        }
    })
    .catch(error => {
        console.error("Error fetching albums:", error);
    });
},

    renderAlbumList: function() {
    const albumSelect = document.getElementById("album-select");
    albumSelect.innerHTML = '<option value="all">所有相片</option>';
    this.albums.forEach(album => {
        const option = document.createElement("option");
        option.value = album.id;
        option.textContent = album.title;
        albumSelect.appendChild(option);
    });
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
            // 将albums数据保存到app.albums属性
            this.albums = data.albums;
            this.renderAlbumList(data.albums); // 或者使用this.albums
        } else {
            console.error("No albums found in the response.");
        }
    })
    .catch(error => {
        console.error("Error fetching albums:", error);
    });
},

    loadPhotos: function() {
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;
        this.loadCachedPhotos();
    },

    fetchPhotos: function() {
    if (this.cacheEnabled && this.isCached(this.albumId)) {
        this.photos = JSON.parse(localStorage.getItem(`photos-${this.albumId}`));
        return;
    }

    const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    const body = {
        albumId: this.albumId,
        pageSize: 50,
        pageToken: this.nextPageToken || ''
    };

    fetch(url, {
        method: "POST",
        headers: { 
            "Authorization": "Bearer " + this.accessToken, 
            "Content-Type": "application/json" 
        },
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
            this.photos = [...new Map(data.mediaItems.map(item => [item.id, item])).values()];
            this.nextPageToken = data.nextPageToken;
            this.cachePhotos();
            this.renderPhotos();
        } else {
            console.error("No mediaItems found in the response.");
        }
    })
    .catch(error => {
        console.error("Error fetching photos:", error);
        this.handleError(error, 3); // ** 修正：傳遞retriesLeft
    });
},

    loadCachedPhotos: function() {
        if (this.cacheEnabled) {
            const cachedPhotos = JSON.parse(localStorage.getItem(`photos-${this.albumId}`));
            if (cachedPhotos) {
                this.photos = cachedPhotos;
                this.renderPhotos();
            }
        }
    },

    cachePhotos: function() {
        if (this.cacheEnabled) {
            localStorage.setItem(`photos-${this.albumId}`, JSON.stringify(this.photos));
            localStorage.setItem(`photos-token-${this.albumId}`, this.nextPageToken);
        }
    },

    isCached: function(albumId) {
    return localStorage.getItem(`photos-${albumId}`) !== null;
},

    renderPhotos: function() {
        const photoContainer = document.getElementById("photo-container");
        if (!photoContainer) {
            console.error('Photo container not found.');
            return; 
        }

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

                // 縮圖列表 scroll loading
                const thumbnail = document.createElement("div");
                thumbnail.className = "thumbnail";
                thumbnail.innerHTML = `<img src="${photo.baseUrl}=w60-h40" alt="Thumbnail">`;
                thumbnail.onclick = () => this.openLightbox(index);
                document.querySelector('.thumbnail-list').appendChild(thumbnail);
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

        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);

        clearInterval(this.slideshowInterval); 
        this.setupLightboxClick();
    },

    setupLightboxClick: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        let clickTimeout;
        
        lightboxImage.onreadystatechange = () => {
            if (lightboxImage.readyState === 'complete') {
                lightboxImage.style.cursor = "pointer";
            }
        };

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
                this.pauseSlideshow(); // 退出幻灯片模式
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

            const result = this.isTimeWithinRange(new Date());
            if (result) {
                alert('休眠时间已設定');
            } else {
                alert('休眠時間設定不符合，請檢查');
            }
            this.checkSleepMode();
            setInterval(() => this.checkSleepMode(), 60000); // 每分鐘檢查一次
        } else {
            alert('請設定完整休眠時間');
        }
    },

    checkSleepMode: function() {
        const now = new Date();
        let result = this.isTimeWithinRange(now);

        if (result && now >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
            this.sleepStartTime.split(':')[0], this.sleepStartTime.split(':')[1])) {
            this.activateSleepMode();
        } else {
            this.deactivateSleepMode();
        }
    },

    isTimeWithinRange: function(date) {
        const startHour = parseInt(this.sleepStartTime.split(':')[0], 10);
        const startMinute = parseInt(this.sleepStartTime.split(':')[1], 10);
        const endHour = parseInt(this.sleepEndTime.split(':')[0], 10);
        const endMinute = parseInt(this.sleepEndTime.split(':')[1], 10);

        const timeStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
            startHour, startMinute);
        const timeEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
            endHour, endMinute);

        if (startHour > endHour || (startHour === endHour && startMinute > endMinute)) {
            const tomorrow = new Date(date);
            tomorrow.setDate(tomorrow.getDate() + 1);
            timeEnd.setDate(tomorrow.getDate());
        }

        const now = new Date();
        return now >= timeStart && now < timeEnd;
    },

    activateSleepMode: function() {
        if (!this.sleepModeActive) {
            this.sleepModeActive = true;
            this.pauseSlideshow();
            document.getElementById("photo-container").style.display = "none";
            document.body.style.filter = "brightness(20%)";
            document.body.classList.add('sleep-mode');
            this.toggleFullscreen(true);
        }
    },

    deactivateSleepMode: function() {
        if (this.sleepModeActive) {
            this.sleepModeActive = false;
            document.body.style.filter = "brightness(100%)";
            document.getElementById("photo-container").style.display = "grid";
            document.body.classList.remove('sleep-mode');
            this.toggleFullscreen(false);
        }
    },

    toggleFullscreen: function(enabled) {
        if (enabled) {
            document.body.requestFullscreen();
        } else {
            if (document.fullscreenElement === document.body) {
                document.exitFullscreen();
            }
        }
    },

    // 攝影模式切換
    togglePhotoMode: function() {
        const photoContainer = document.getElementById("photo-container");
        const albumSelection = document.getElementById("album-selection-container");
        photoContainer.style.display = photoContainer.style.display === 'grid' ? 'none' : 'grid';
        albumSelection.style.display = albumSelection.style.display === 'block' ? 'none' : 'block';
    },

    // 快取處理
    initCache: function() {
    if (this.cacheEnabled) {
        // 初始化albums數據
        this.albums = JSON.parse(localStorage.getItem('albums')) || [];
        // 初始化photos數據
        this.photos = JSON.parse(localStorage.getItem('photos')) || [];
        
        // 檢查數據 validity
        if (!this.albums || !Array.isArray(this.albums)) {
            console.error("Cached albums data is invalid or not found. Clearing cache...");
            localStorage.removeItem('albums');
            localStorage.removeItem('photos');
        }
        if (!this.photos || !Array.isArray(this.photos)) {
            console.error("Cached photos data is invalid or not found. Clearing cache...");
            localStorage.removeItem('photos');
        }
    }
},
    // 處理錯誤
    handleError: function(error, retriesLeft = 3) {
    console.error("Error:", error);
    if (retriesLeft > 1) {
        setTimeout(() => {
            app.fetchPhotos(retriesLeft - 1);
        }, 1000);
    }
},

    // 自動刷新 OAuth Token
    initToken_refresh: function() {
        const token = sessionStorage.getItem('access_token');
        const refresh_token = sessionStorage.getItem('refresh_token');

        if (token && refresh_token) {
            setTimeout(() => {
                app.refreshToken();
            }, 3600000); // 到期前1小時
        }
    },

    efreshToken: function() {
        const url = `https://www.googleapis.com/oauth2/v4/token?client_id=${app.CLIENT_ID}&client_secret=your_client_secret&refresh_token=${sessionStorage.getItem('refresh_token')}&grant_type=refresh_token`;
        
        fetch(url, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to refresh token');
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem('access_token', data.access_token);
            app.accessToken = data.access_token;
            app.initToken_refresh();
        })
        .catch(error => {
            console.error('Token refresh failed:', error);
        });
    }
};

// 異步_initialize
window.addEventListener('load', () => {
    app.getAccessToken();
    app.initCache();
    app.initToken_refresh();

    // 縮圖列表 scroll loading 初始化
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                app.fetchPhotos();
            }
        });
    });

    const target = document.querySelector('.thumbnail-list');
    if (target) {
        observer.observe(target);
    }
});

// 事件監聽器
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    
    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    document.getElementById("set-sleep-btn").onclick = app.setSleepMode.bind(app);
    document.getElementById("activate-btn").onclick = () => {
        app.sleepModeActive = !app.sleepModeActive;
        if (app.sleepModeActive) {
            app.activateSleepMode();
        } else {
            app.deactivateSleepMode();
        }
    };

    // 全螢幕模式切換
    document.getElementById("start-slideshow-btn").addEventListener("click", function() {
        if (!app.isSlideshowPlaying) {
            app.startSlideshow();
            this.textContent = "停止幻燈片";
        } else {
            app.pauseSlideshow();
            this.textContent = "開始幻燈片";
        }
    });

    // 觸控顯示按鈕
    let lastActiveTime = 0;
    document.addEventListener('touchstart', function() {
        if (app.isSlideshowPlaying) {
            const buttons = document.querySelectorAll('.nav-button');
            buttons.forEach(button => button.style.display = 'flex');
            lastActiveTime = new Date().getTime();
        }
    }, { passive: true });

    document.addEventListener('touchend', function() {
        lastActiveTime = new Date().getTime();
    });

    document.addEventListener('mousemove', function() {
        lastActiveTime = new Date().getTime();
    });

    document.addEventListener('mouseleave', function() {
        const currentTime = new Date().getTime();
        if (currentTime - lastActiveTime > 3000 && app.isSlideshowPlaying) {
            const buttons = document.querySelectorAll('.nav-button');
            buttons.forEach(button => button.style.display = 'none');
        }
    });
});
