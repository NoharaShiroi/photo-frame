var CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
var REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
var SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
var accessToken = localStorage.getItem("access_token") || null;
var albumId = localStorage.getItem("albumId") || null;
var photos = [];
var currentPhotoIndex = 0;
var slideshowInterval = null;
var slideshowSpeed = 5000;  // 預設時間為 5000 毫秒
var nextPageToken = null;
var albums = [];
var cachedPhotos = {};  // 用於緩存圖片

// **獲取 Access Token**
function getAccessToken() {
    var hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has("access_token")) {
        accessToken = hashParams.get("access_token");
        localStorage.setItem("access_token", accessToken);  // 使用 localStorage 儲存 Token
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
    if (!accessToken) {
        console.error("缺少 accessToken，請先授權");
        return;
    }
    var url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

    fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
        }
    })
    .then(function (response) { return response.json(); })
    .then(function (data) {
        if (data.albums) {
            albums = data.albums;
            renderAlbumList();
        }
    })
    .catch(function (error) { console.error("Error fetching albums:", error); });
}

// **顯示相簿列表**
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

// **獲取相簿中的照片**
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
            document.getElementById("back-to-albums-btn").style.display = "block";  // 顯示返回按鈕
        }
    })
    .catch(function (error) { console.error("Error fetching photos:", error); });
}

// **顯示照片並使用緩存**
function renderPhotos() {
    var photoContainer = document.getElementById("photo-container");
    var slideshowBtn = document.getElementById("slideshow-btn");
    if (!photoContainer) return;

    photoContainer.innerHTML = '';  // 清空容器

    if (photos.length === 0) {
        photoContainer.innerHTML = '該相簿內沒有照片';
        return;
    }

    photos.forEach(function (photo, index) {
        var img = document.createElement("img");

        if (cachedPhotos[photo.id]) {
            img.src = cachedPhotos[photo.id];  // 使用緩存圖片
        } else {
            img.src = photo.baseUrl + "=w600-h400";  // 根據需要調整圖片大小
            cachedPhotos[photo.id] = img.src;  // 儲存至緩存
        }

        img.alt = photo.filename || "Photo";
        img.classList.add("photo");

        img.addEventListener("click", function() {
            openLightbox(photo.baseUrl);
            slideshowBtn.style.display = "block";  // 顯示幻燈片按鈕
        });
        photoContainer.appendChild(img);

        // 讓幻燈片模式能夠正確顯示當前圖片
        if (index === currentPhotoIndex) {
            img.classList.add('active');  // 標註當前正在顯示的圖片
        }
    });
}

// **啟動幻燈片播放**
document.getElementById("slideshow-btn").addEventListener("click", function() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);  // 清除現有的幻燈片間隔
    }
    startSlideshow();
});

// **啟動幻燈片**
function startSlideshow() {
    slideshowInterval = setInterval(function() {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        renderPhotos();
    }, slideshowSpeed);
}

// **設置幻燈片切換間隔**
document.getElementById("slideshow-speed").addEventListener("input", function(e) {
    slideshowSpeed = parseInt(e.target.value);
    if (slideshowInterval) {
        clearInterval(slideshowInterval);  // 清除當前的幻燈片
        startSlideshow();  // 重新啟動幻燈片播放
    }
});

// **載入頁面時執行**
document.addEventListener("DOMContentLoaded", function () {
    var authBtn = document.getElementById("authorize-btn");
    if (authBtn) authBtn.addEventListener("click", authorizeUser);

    getAccessToken();
});
