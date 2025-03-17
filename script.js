<!-- script.js -->
const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com" 
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/", 
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
    accessToken: sessionStorage.getItem("access_token") || null,
    albumId: null,
    photos: [],
    currentPhotoIndex: 0,
    nextPageToken: null,
    slideshowInterval: null,
    isLoading: false,
    slideshowSpeed: 5000,

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
