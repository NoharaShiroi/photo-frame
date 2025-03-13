const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = localStorage.getItem("access_token") || null;
let albumId = localStorage.getItem("albumId") || null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;
let slideshowSpeed = 5000;
let nextPageToken = null;

// **更新相簿 ID**
function updateAlbumId() {
    const inputAlbumId = prompt("請輸入 Google 相簿 ID:");
    if (inputAlbumId) {
        albumId = inputAlbumId;
        localStorage.setItem("albumId", albumId);
        photos = [];
        nextPageToken = null;
        fetchPhotos();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn")?.addEventListener("click", authorizeUser);
    document.getElementById("set-album-btn")?.addEventListener("click", updateAlbumId);
    document.getElementById("lightbox-fullscreen-btn")?.addEventListener("click", enterFullscreenSlideshow);
    window.addEventListener("scroll", handleScroll);
    getAccessToken();
});

function authorizeUser() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
}

function getAccessToken() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
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
    const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    const body = { pageSize: 50 };
    if (albumId) body.albumId = albumId;
    if (nextPageToken) body.pageToken = nextPageToken;

    fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        if (data.mediaItems) {
            photos = [...photos, ...data.mediaItems];
            nextPageToken = data.nextPageToken || null;
            renderPhotos();
        }
    })
    .catch(error => console.error("Error fetching photos:", error));
}

function renderPhotos() {
    const gallery = document.getElementById("photo-gallery");
    photos.forEach((photo, index) => {
        if (!document.querySelector(`img[data-index="${index}"]`)) {
            const imgElement = document.createElement("img");
            imgElement.classList.add("photo-item");
            imgElement.src = photo.baseUrl + "=w1024-h1024";
            imgElement.setAttribute("data-index", index);
            imgElement.onclick = () => openLightbox(index);
            gallery.appendChild(imgElement);
        }
    });
}

function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        if (nextPageToken) {
            fetchPhotos();
        }
    }
}

function openLightbox(index) {
    currentPhotoIndex = index;
    document.getElementById("lightbox").style.display = "flex";
    showPhotoInLightbox(currentPhotoIndex);
}

function showPhotoInLightbox(index) {
    const lightboxImage = document.getElementById("lightbox-img");
    if (photos.length > 0 && index >= 0 && index < photos.length) {
        lightboxImage.src = photos[index].baseUrl + "=w1024-h1024";
    }
}

function closeLightbox() {
    document.getElementById("lightbox").style.display = "none";
}

function prevPhoto(event) {
    event.stopPropagation();
    if (photos.length > 0) {
        currentPhotoIndex = (currentPhotoIndex - 1 + photos.length) % photos.length;
        showPhotoInLightbox(currentPhotoIndex);
    }
}

function nextPhoto(event) {
    event.stopPropagation();
    if (photos.length > 0) {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        showPhotoInLightbox(currentPhotoIndex);
    }
}

function enterFullscreenSlideshow() {
    if (!photos.length) return;
    if (slideshowInterval) clearInterval(slideshowInterval);
    slideshowInterval = setInterval(() => {
        showPhotoInLightbox(currentPhotoIndex);
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    }, slideshowSpeed);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("prev-btn").addEventListener("click", prevPhoto);
    document.getElementById("next-btn").addEventListener("click", nextPhoto);
    document.getElementById("lightbox").addEventListener("click", closeLightbox);

    // 取得 URL 中的 access_token
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");

    if (accessToken) {
        // 存儲新的 access_token
        localStorage.setItem("access_token", accessToken);
        sessionStorage.setItem("access_token", accessToken);
        console.log("存儲的新 access_token:", accessToken);
    } else {
        // 若 access_token 不存在，可能是授權失敗，嘗試清除 Cookie 並請求授權
        console.warn("未找到 access_token，請重新授權");

        // 清除 localStorage 避免錯誤的 Token 存在
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("access_token");

        // **清除所有 Cookie，確保 Google OAuth 不會使用舊的登入狀態**
        document.cookie.split(";").forEach(cookie => {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        // **自動導向 Google 授權**
        const clientId = "你的 Google API Client ID";
        const redirectUri = "你的網站 URL";
        const scope = "https://www.googleapis.com/auth/photoslibrary.readonly";
        const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;

        window.location.href = authUrl;
    }
});
