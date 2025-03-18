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

        this.photos = [];
        this.nextPageToken = null;

        if (this.albumId) {
            this.fetchPhotos();
        } else {
            this.fetchAllPhotos(); 
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
                this.photos = [...new Map(this.photos.concat(data.mediaItems).map(item => [item.id, item])).values()];
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
                this.photos = [...new Map(data.mediaItems.map(item => [item.id, item])).values()];
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
            });
        }

        photoContainer.style.display = "grid";
        document.getElementById("app-container").style.display = "flex"; 
        photoContainer.style.display = "grid"; 
    },

    openLightbox: function(index) {
        this.currentPhotoIndex = index;
        const lightbox = document.getElementById("lightbox");
        const lightboxImage = document.getElementById("lightbox-image");
        lightboxImage.src = `${this.photos[index].baseUrl}=w1024-h768`;
        lightbox.style.display = "flex"; 
        setTimeout(() => lightbox.style.opacity = 1, 10);
    
        clearInterval(this.slideshowInterval);

        // 點擊空白處關閉 Lightbox
        lightbox.onclick = (event) => {
            if (event.target === lightbox || event.target.id === "close-lightbox") {
                this.closeLightbox();
            }
        };

        // 隱藏滾動
        document.body.style.overflow = "hidden";
    },

    closeLightbox: function() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none"; // 隱藏 Lightbox
            document.body.style.overflow = "auto"; // 恢復滾動
        }, 300);
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
        lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1024-h768`;

        // 預加載下一張圖片
        if (this.photos[this.currentPhotoIndex + 1]) {
            const nextImage = new Image();
            nextImage.src = `${this.photos[this.currentPhotoIndex + 1].baseUrl}=w1024-h768`;
        }
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            const speedInput = document.getElementById("slideshow-speed");
            this.slideshowSpeed = speedInput.value * 1000; 
            this.autoChangePhoto(); 
            this.isSlideshowPlaying = true; 
        }
    },

    autoChangePhoto: function() {
        clearInterval(this.slideshowInterval); 
        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            this.showCurrentPhoto();
        }, this.slideshowSpeed);
    },

};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
    document.getElementById("start-slideshow-btn").onclick = app.startSlideshow.bind(app);

    document.getElementById("back-to-album-btn").onclick = () => {
        document.getElementById("photo-container").style.display = "none";
        document.getElementById("album-selection-container").style.display = "block";
    };

    app.getAccessToken();

    window.onscroll = function() {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
            app.fetchAllPhotos();
        }
    };
});
