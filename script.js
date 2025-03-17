const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/", 
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: "all",
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null,
    isLoading: false,
    slideshowSpeed: 3000,

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
            this.fetchPhotos();
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
            if (data.albums) {
                this.renderAlbumList(data.albums);
            }
        })
        .catch(error => console.error("Error fetching albums:", error));
    },

    fetchPhotos: function(nextPageToken = null) {
        if (!this.accessToken) return;
        
        let url = "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50";
        let options = {
            method: "GET",
            headers: { "Authorization": "Bearer " + this.accessToken }
        };

        if (this.albumId && this.albumId !== "all") {
            url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
            options.method = "POST";
            options.body = JSON.stringify({ albumId: this.albumId, pageSize: 50, pageToken: nextPageToken });
        } else if (nextPageToken) {
            url += `&pageToken=${nextPageToken}`;
        }

        fetch(url, options)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("API Error:", data.error.message);
                return;
            }
            if (data.mediaItems) {
                this.photos = this.photos.concat(data.mediaItems);
                this.currentPhotoIndex = 0;
                this.displayPhoto();
            }
            if (data.nextPageToken) {
                this.fetchPhotos(data.nextPageToken);
            }
        })
        .catch(error => console.error("Error fetching photos:", error));
    },

    displayPhoto: function() {
        if (this.photos.length === 0) {
            console.warn("No photos available to display.");
            return;
        }
        let imgElement = document.getElementById("photo-display");
        if (imgElement) {
            imgElement.src = this.photos[this.currentPhotoIndex].baseUrl;
        } else {
            console.error("Image element with id 'photo-display' not found.");
        }
    },

    startSlideshow: function() {
        if (this.photos.length === 0) {
            console.warn("No photos available for slideshow.");
            return;
        }
        clearInterval(this.slideshowInterval);
        this.slideshowInterval = setInterval(() => {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.photos.length;
            this.displayPhoto();
        }, this.slideshowSpeed);
    },

    renderAlbumList: function(albums) {
        let albumSelect = document.getElementById("album-select");
        albumSelect.innerHTML = '<option value="all">所有相片</option>';
        albums.forEach(album => {
            let option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            albumSelect.appendChild(option);
        });
    }
};

window.onload = function() {
    document.getElementById("authorize-btn").onclick = () => app.authorizeUser();
    document.getElementById("start-slideshow-btn").onclick = () => app.startSlideshow();
    app.getAccessToken();
};
