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
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.albums) {
            renderAlbumList(data.albums);
        }
    })
    .catch(function(error) {
        console.error("Error fetching albums:", error);
    });
}

// **顯示相簿列表**
function renderAlbumList(albums) {
    var albumListContainer = document.getElementById("album-list");
    albumListContainer.innerHTML = '';  // 清空之前的相簿列表
    albums.forEach(function(album) {
        var li = document.createElement("li");
        li.textContent = album.title;
        li.onclick = function() {
            albumId = album.id;
            localStorage.setItem("albumId", albumId);  // 儲存相簿ID
            fetchPhotos();  // 立即取得相簿中的照片
        };
        albumListContainer.appendChild(li);
    });
}

// **獲取相簿中的照片**
function fetchPhotos() {
    if (!albumId || !accessToken) {
        console.error("No albumId or accessToken found.");
        return;  // 確保有相簿ID和Access Token
    }

    var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    
    var body = {
        albumId: albumId,  // 確保 albumId 正確傳遞
        pageSize: 50,
        filters: {
            contentFilter: {
                includedContentCategories: ["PHOTOS"]
            }
        }
    };

    fetch(url, {
        method: "POST",
        headers: { 
            "Authorization": "Bearer " + accessToken, 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify(body)
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.mediaItems) {
            photos = data.mediaItems;
            renderPhotos();
        } else {
            console.error("No mediaItems found in the response.", data);
        }
    })
    .catch(function(error) {
        console.error("Error fetching photos:", error);
    });
}

// **顯示照片**
function renderPhotos() {
    var photoContainer = document.getElementById("photo-container");
    photoContainer.innerHTML = '';  // 清空之前的照片

    if (photos.length === 0) {
        photoContainer.innerHTML = "<p>此相簿沒有照片</p>";
    } else {
        photos.forEach(function(photo) {
            var img = document.createElement("img");
            img.src = photo.baseUrl + "=w600-h400";  // 顯示圖片
            img.alt = "Photo";
            img.classList.add("photo");
            img.onclick = function() {
                openLightbox(photo.baseUrl);  // 點擊放大圖片
            };
            photoContainer.appendChild(img);
        });
    }

    // 顯示相片容器
    photoContainer.style.display = "grid";
    document.getElementById("app-container").style.display = "flex";  // 確保相片區域顯示
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
    if (photos.length === 0) return;  // 🚨 避免錯誤
    if (slideshowInterval) clearInterval(slideshowInterval);
    
    slideshowInterval = setInterval(function() {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        document.getElementById("lightbox-image").src = photos[currentPhotoIndex].baseUrl + "=w1200-h800";
    }, 5000);
}

// **監聽登入按鈕**
document.getElementById("authorize-btn").onclick = authorizeUser;

// **載入頁面時執行**
document.addEventListener("DOMContentLoaded", getAccessToken);
