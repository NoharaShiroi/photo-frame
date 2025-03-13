var CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
var REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
var SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
var accessToken = localStorage.getItem("access_token") || null;
var albumId = localStorage.getItem("albumId") || null;
var photos = [];
var currentPhotoIndex = 0;
var slideshowInterval = null;
var slideshowSpeed = 5000;
var nextPageToken = null;

// **更新相簿 ID**
function updateAlbumId() {
    var inputAlbumId = prompt("請輸入 Google 相簿 ID:");
    if (inputAlbumId) {
        albumId = inputAlbumId;
        localStorage.setItem("albumId", albumId);
        photos = [];
        nextPageToken = null;
        fetchPhotos();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    var authBtn = document.getElementById("authorize-btn");
    if (authBtn) authBtn.addEventListener("click", authorizeUser);

    var albumBtn = document.getElementById("set-album-btn");
    if (albumBtn) albumBtn.addEventListener("click", updateAlbumId);

    var fullscreenBtn = document.getElementById("lightbox-fullscreen-btn");
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", enterFullscreenSlideshow);

    window.addEventListener("scroll", handleScroll);
    getAccessToken();
});

function authorizeUser() {
    var authUrl = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID +
        "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
        "&response_type=token&scope=" + SCOPES +
        "&prompt=consent";
    window.location.href = authUrl;
}

function getAccessToken() {
    var hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has("access_token")) {
        accessToken = hashParams.get("access_token");
        localStorage.setItem("access_token", accessToken);
    }
    if (accessToken) {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        fetchPhotos();
    }
}

function fetchPhotos() {
    if (!accessToken) {
        console.error("缺少 accessToken，請先授權");
        return;
    }
    var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    var body = { pageSize: 50 };
    if (albumId) body.albumId = albumId;
    if (nextPageToken) body.pageToken = nextPageToken;

    fetch(url, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
        if (data.mediaItems) {
            photos = photos.concat(data.mediaItems);
            nextPageToken = data.nextPageToken || null;
            renderPhotos();
        }
    })
    .catch(function (error) { console.error("Error fetching photos:", error); });
}

function renderPhotos() {
    var gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = "";
    photos.forEach(function (photo, index) {
        var imgElement = document.createElement("img");
        imgElement.classList.add("photo-item");
        imgElement.src = photo.baseUrl + "=w1024-h1024";
        imgElement.setAttribute("data-index", index);
        imgElement.onclick = function () { openLightbox(index); };
        gallery.appendChild(imgElement);
    });
}

function enterFullscreenSlideshow() {
    var lightbox = document.getElementById("lightbox");

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (lightbox.requestFullscreen) {
            lightbox.requestFullscreen();
        } else if (lightbox.webkitRequestFullscreen) {
            lightbox.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}
