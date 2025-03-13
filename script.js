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

// **取得 Access Token**
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
        fetchPhotos();
    } else {
        document.getElementById("auth-container").style.display = "flex";
        document.getElementById("app-container").style.display = "none";
    }
}

// **授權 Google 帳戶**
function authorizeUser() {
    var authUrl = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID +
        "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
        "&response_type=token&scope=" + SCOPES +
        "&prompt=consent";
    window.location.href = authUrl;
}

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

// **獲取 Google 相簿照片**
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

// **滾動事件處理，確保滾動到底時載入更多照片**
function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        if (nextPageToken) {
            fetchPhotos();
        }
    }
}

// **載入頁面時執行**
document.addEventListener("DOMContentLoaded", function () {
    var authBtn = document.getElementById("authorize-btn");
    if (authBtn) authBtn.addEventListener("click", authorizeUser);

    var albumBtn = document.getElementById("set-album-btn");
    if (albumBtn) albumBtn.addEventListener("click", updateAlbumId);

    window.addEventListener("scroll", handleScroll);
    getAccessToken();
});
