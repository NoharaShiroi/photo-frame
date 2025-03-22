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
    slideshowSpeed: 5000,
    isSlideshowPlaying: false,
    idleTime: 0,
    playMode: 'sequential',
    playedIndices: [],

    init: function() {
        this.getAccessToken();
        this.setupEventListeners();
        setInterval(this.idleCheck.bind(this), 1000);
    },

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
            this.load_photos(); // 調用修正後的 loadPhotos 方法
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
            if (!response.ok) throw new Error("Network response was not ok.");
            return response.json();
        })
        .then(data => {
            if (data.albums) {
                this.renderAlbumList(data.albums);
            }
            console.log('รับข้อมูลอัลบั้มสำเร็จ。จำนวนอัลบั้ม:', data.albums ? data.albums.length : 0);
        })
        .catch(error => {
            console.error("Error fetching albums:", error);
            throw error;
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

    fetchAllPhotos: function() {
        const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
        const body = {
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
            if (!response.ok) throw new Error("Network response was not ok.");
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = [...new Map(this.photos.concat(data.mediaItems).map(item => [item.id, item])).values()];
                this.nextPageToken = data.nextPageToken;
                this.renderPhotos();
                localStorage.setItem(this.albumId || 'all', JSON.stringify({ 
                    data: this.photos, 
                    expiresAt: Date.now() + 60 * 60 * 1000 
                }));
                console.log('.Fetchสำเร็จ。จำนวนภาพ:', this.photos.length);
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
            throw error;
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
            headers: { 
                "Authorization": "Bearer " + this.accessToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok.");
            return response.json();
        })
        .then(data => {
            if (data.mediaItems) {
                this.photos = [...new Map(data.mediaItems.map(item => [item.id, item])).values()];
                this.nextPageToken = data.nextPageToken;
                this.renderPhotos();
                localStorage.setItem(this.albumId, JSON.stringify({ 
                    data: this.photos, 
                    expiresAt: Date.now() + 60 * 60 * 1000 
                }));
                console.log('.Fetchสำเร็จสำหรับアルバム「' + (this.albumId ? this.getAlbumName() : 'all') + '」。จำนวนภาพ:', this.photos.length);
            }
        })
        .catch(error => {
            console.error("Error fetching photos:", error);
            throw error;
        });
    },

    load_photos: function() { // 修正後的 loadPhotos 方法
        console.log('เริ่มโหลดภาพ...');
        const albumSelect = document.getElementById("album-select");
        this.albumId = albumSelect.value === "all" ? null : albumSelect.value;

        const cachedPhotos = localStorage.getItem(this.albumId || 'all');
        if (cachedPhotos) {
            console.log('ตรวจสอบข้อมูลที่จัดเก็บ...');
            const { data, expiresAt } = JSON.parse(cachedPhotos);
            if (Date.now() < expiresAt) {
                this.photos = data;
                this.renderPhotos();
                console.log('ใช้ข้อมูลที่จัดเก็บสำเร็จ。');
                return;
            }
            console.log('ข้อมูลที่จัดเก็บหมดอายุ。ทำการโหลดใหม่...');
        }

        if (this.albumId) {
            console.log('กำลังโหลดภาพจากอัลบั้ม ID:', this.albumId);
            this.fetchPhotos();
        } else {
            console.log('กำลังโหลดภาพทั้งหมด...');
            this.fetchAllPhotos();
        }
    },

    renderPhotos: function() {
        const photoContainer = document.getElementById("photo-container");
        photoContainer.innerHTML = '';

        if (this.photos.length === 0) {
            photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
            console.log('レンダリングしています。จำนวนภาพ: 0');
        } else {
            console.log('レンダリングしています。จำนวนภาพ:', this.photos.length);
            this.photos.forEach((photo, index) => {
                const img = document.createElement("img");
                img.src = photo.baseUrl + '?w600-h400'; // 正確なURLの組み立て
                img.alt = "Photo";
                img.classList.add("photo");
                img.onclick = () => this.openLightbox(index);
                photoContainer.appendChild(img);
                console.log('新增圖片:', photo.baseUrl + '?w600-h400');
            });
        }
    },

    openLightbox: function(index) {
        this.currentPhotoIndex = index;
        const lightbox = document.getElementById("lightbox");
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = this.photos[index].baseUrl + '?w1200-h800';
        lightbox.style.display = "flex"; 
        setTimeout(() => lightbox.style.opacity = 1, 10);

        this.toggleButtonsVisibility(true);

        document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
        document.getElementById("next-photo").onclick = () => this.changePhoto(1);
        document.getElementById("fullscreen-toggle-btn").onclick = this.toggleFullscreen.bind(this);

        clearInterval(this.slideshowInterval);
        this.setupLightboxClick();
    },

    setupLightboxClick: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.onclick = (e) => {
            if (e.target === lightbox || e.target.id === "close-lightbox") {
                this.closeLightbox();
            } else if (e.target.tagName !== "BUTTON") {
                this.toggleSlideshow();
            }
        };
    },

    closeLightbox: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none";
            this.resetSlideshow();
            this.toggleButtonsVisibility(false);
        }, 300);
    },

    toggleSlideshow: function() {
        if (this.isSlideshowPlaying) {
            this.resetSlideshow();
        } else {
            this.startSlideshow();
        }
    },

    changePhoto: function(direction) {
        this.currentPhotoIndex = (this.currentPhotoIndex + direction + this.photos.length) % this.photos.length;
        this.showCurrentPhoto();
    },

    showCurrentPhoto: function() {
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = this.photos[this.currentPhotoIndex].baseUrl + '?w1200-h800';
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            const speedInput = document.getElementById("slideshow-speed");
            this.slideshowSpeed = speedInput.value * 1000; 
            this.playMode = document.getElementById("play-mode").value;
            this.playedIndices = [];
            this.autoChangePhoto(); 
            this.isSlideshowPlaying = true; 
            this.toggleButtonsVisibility(false);
        }
    },

    resetSlideshow: function() {
        clearInterval(this.slideshowInterval);
        this.isSlideshowPlaying = false;
        this.toggleButtonsVisibility(true);
    },

    autoChangePhoto: function() {
        clearInterval(this.slideshowInterval);
        this.slideshowInterval = setInterval(() => {
            if (this.playMode === 'random') {
                this.randomPlay();
            } else {
                this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            }
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    },

    randomPlay: function() {
        if (this.playedIndices.length === this.photos.length) {
            this.playedIndices = [];
        }

        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * this.photos.length);
        } while (this.playedIndices.includes(nextIndex));
        
        this.playedIndices.push(nextIndex);
        this.currentPhotoIndex = nextIndex;
    },

    setupEventListeners: function() {
        document.getElementById("authorize-btn").onclick = this.authorizeUser.bind(this);
        document.getElementById("start-slideshow-btn").onclick = this.startSlideshow.bind(this);
        document.getElementById("back-to-album-btn").onclick = this.showAlbumSelection.bind(this);
    },

    toggleButtonsVisibility: function(visible) {
        const buttons = document.querySelectorAll('.nav-button');
        buttons.forEach(button => {
            button.style.display = visible ? 'inline-block' : 'none';
        });
        document.getElementById("start-slideshow-btn").style.display = visible ? 'inline-block' : 'none';
        document.getElementById("fullscreen-toggle-btn").style.display = visible ? 'inline-block' : 'none';
    },

    showAlbumSelection: function() {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    },

    idleCheck: function() {
        this.idleTime++;
        if (this.idleTime > 100) {
            document.getElementById("screenOverlay").style.display = "block";
        }
    },

    resetIdleTimer: function() {
        this.idleTime = 0;
        document.getElementById("screenOverlay").style.display = "none";
    },

    toggleFullscreen: function() {
        const lightbox = document.getElementById("lightbox");
        if (!document.fullscreenElement) {
            lightbox.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    },

    setupLazyLoading: function() {
        const photoContainer = document.getElementById("photo-container");
        
        photoContainer.addEventListener('scroll', (e) => {
            if (this.nextPageToken && 
                photoContainer.scrollHeight - photoContainer.scrollTop <= photoContainer.clientHeight + 100) {
                this.load_photos();
            }
        });

        const options = {
            root: photoContainer,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.nextPageToken) {
                    this.load_photos();
                }
            });
        }, options);

        observer.observe(photoContainer);
    },
};

document.addEventListener("DOMContentLoaded", () => {
    app.init();
    document.addEventListener("mousemove", app.resetIdleTimer.bind(app));
    document.addEventListener("touchstart", app.resetIdleTimer.bind(app));
});
