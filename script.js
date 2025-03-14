var CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
var REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
var SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
var accessToken = sessionStorage.getItem("access_token") || null;
var albumId = localStorage.getItem("albumId") || null;
var photos = [];
var currentPhotoIndex = 0;
var slideshowInterval = null;
var slideshowSpeed = 5000;
var nextPageToken = null;
var albums = [];
var cachedPhotos = {};

// 取得 Access Token
function getAccessToken() {
    var hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has("access_token")) {
        accessToken = hashParams.get("access_token");
        sessionStorage.setItem("access_token", accessToken);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (accessToken) {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        fetchAlbums();
    } else {
        document.getElementById("auth-container").style.display = "flex";
        document.getElementById("app-container").style.display = "none";
    }
}

// 關閉 Lightbox 功能
function closeLightbox() {
    document.getElementById("lightbox").style.display = "none";
}
document.getElementById("close-lightbox").addEventListener("click", closeLightbox);
document.getElementById("lightbox").addEventListener("click", closeLightbox);

// 顯示相簿列表
function renderAlbumList() {
    var albumListContainer = document.getElementById("album-list");
    albumListContainer.innerHTML = '';
    albums.forEach(function (album) {
        var li = document.createElement("li");
        li.textContent = album.title;
        li.addEventListener("click", function() {
            albumId = album.id;
            localStorage.setItem("albumId", albumId);
            photos = [];
            nextPageToken = null;
            fetchPhotos();
        });
        albumListContainer.appendChild(li);
    });
}

// 啟動幻燈片播放
function startSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
    }
    slideshowSpeed = parseInt(document.getElementById("slideshow-speed-lightbox").value) * 1000 || 5000;
    slideshowInterval = setInterval(function() {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        document.getElementById("lightbox-image").src = photos[currentPhotoIndex].baseUrl + "=w1200-h800";
    }, slideshowSpeed);
}
document.getElementById("slideshow-start-btn-lightbox").addEventListener("click", startSlideshow);

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("authorize-btn").addEventListener("click", function() {
        var authUrl = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID +
            "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
            "&response_type=token&scope=" + SCOPES +
            "&prompt=consent";
        window.location.href = authUrl;
    });
    getAccessToken();
});
