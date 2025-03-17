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
    isLoading: false, 
    slideshowSpeed: 3000, 
    currentAlbumId: null, 

    getAccessToken: function() {
        let hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.accessToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (this.accessToken) {
            document.getElementById("auth-container").style.display = "none";
            document.getElementById("app-container").style.display = "flex";
            this.fetchAlbums();
            this.fetchPhotos.bind(this)(); 
        } else {
            document.getElementById("auth-container").style.display = "flex";
            document.getElementById("app-container").style.display = "none";
        }
    },

    authorizeUser: function() {
        let authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
        window.location.href = authUrl;
    },

    fetchAlbums: function() {
        if (!this.accessToken) return;
        fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
            method: "GET",
            headers: { "Authorization": "Bearer " + this.accessToken }
        })
        .then(response => response.json())
        .then(data => {
            if (data.albums) this.renderAlbumList(data.albums);
        })
        .catch(error => console.error("Error fetching albums:", error));
    },

    fetchPhotos: function() {
        if (this.isLoading) return;
        this.isLoading = true;

        fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
            method: "POST",
            headers: { "Authorization": "Bearer " + this.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify({ pageSize: 50, pageToken: this.nextPageToken || '', albumId: this.albumId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.mediaItems) {
                this.photos.push(...data.mediaItems);
                this.nextPageToken = data.nextPageToken;
                this.renderPhotos();
            }
        })
        .catch(error => console.error("Error fetching photos:", error))
        .finally(() => this.isLoading = false);
    },

    renderPhotos: function() {
        let container = document.getElementById("photo-container");
        container.innerHTML = "";
        
        if (this.photos.length === 0) {
            container.innerHTML = "<p>此相簿沒有照片</p>";
        } else {
            this.photos.forEach((photo, index) => {
                let img = document.createElement("img");
                img.src = `${photo.baseUrl}=w600-h400`;
                img.alt = "Photo";
                img.classList.add("photo");
                img.onclick = () => this.openLightbox(index);
                container.appendChild(img);
            });
        }
    },

    startSlideshow: function() {
        if (this.photos.length > 0) {
            let speedInput = document.getElementById("slideshow-speed");
            this.slideshowSpeed = Math.max(1000, speedInput.value * 1000); 
            this.autoChangePhoto(); 
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

// 事件監聽
window.onload = function() {
    document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
    document.getElementById("start-slideshow-btn").onclick = app.startSlideshow.bind(app);
    app.getAccessToken();
};
