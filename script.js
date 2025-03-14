var CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
var REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
var SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
var accessToken = sessionStorage.getItem("access_token") || null;
var albumId = localStorage.getItem("albumId") || null;
var photos = [];
var currentPhotoIndex = 0;
var slideshowInterval = null;

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
        fetchAlbums();
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

// **獲取 Google 相簿列表**
function fetchAlbums() {
    if (!accessToken) return;
    var url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

    fetch(url, {
        method: "GET",
        headers: { "Authorization": "Bearer " + accessToken }
    })
    .then(response => response.json())
    .then(data => {
        if (data.albums) {
            renderAlbumList(data.albums);
        }
    })
    .catch(error => console.error("Error fetching albums:", error));
}

// **顯示相簿列表**
function renderAlbumList(albums) {
    var albumListContainer = document.getElementById("album-list");
    albumListContainer.innerHTML = '';
    albums.forEach(album => {
        var li = document.createElement("li");
        li.textContent = album.title;
        li.onclick = () => {
            albumId = album.id;
            localStorage.setItem("albumId", albumId);
            fetchPhotos();
        };
        albumListContainer.appendChild(li);
    });
}

// **獲取相簿中的照片**
function fetchPhotos() {
    if (!accessToken) return;
    var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    var body = { albumId, pageSize: 50 };

    fetch(url, {
        method: "POST",
        headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        photos = data.mediaItems || [];
        renderPhotos();
    })
    .catch(error => console.error("Error fetching photos:", error));
}

// **顯示照片**
function renderPhotos() {
    var photoContainer = document.getElementById("photo-container");
    photoContainer.innerHTML = '';

    photos.forEach((photo, index) => {
        var img = document.createElement("img");
        img.src = photo.baseUrl + "=w600-h400";
        img.alt = "Photo";
        img.classList.add("photo");

        img.onclick = () => openLightbox(photo.baseUrl);
        photoContainer.appendChild(img);
    });
}

// **放大圖片**
function openLightbox(imageUrl) {
    document.getElementById("lightbox-image").src = imageUrl + "=w1200-h800";
    document.getElementById("lightbox").style.display = "flex";
}

// **關閉放大圖片**
document.getElementById("lightbox").onclick = function(event) {
    if (event.target === this) this.style.display = "none";
};

document.getElementById("close-lightbox").onclick = function() {
    document.getElementById("lightbox").style.display = "none";
};

// **啟動幻燈片**
function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    
    slideshowInterval = setInterval(() => {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        document.getElementById("lightbox-image").src = photos[currentPhotoIndex].baseUrl + "=w1200-h800";
    }, 5000);
}

// **監聽登入按鈕**
document.getElementById("authorize-btn").onclick = authorizeUser;

// **載入頁面時執行**
document.addEventListener("DOMContentLoaded", getAccessToken);
