const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let albumId = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;
let nextPageToken = null;
let isFullscreen = false;
let slideshowSpeed = 5000;
let slideshowStartTime = "08:00";
let slideshowEndTime = "22:00";

// **🔹 初始化 Google OAuth & 事件監聽**
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").addEventListener("click", authorizeUser);
    document.getElementById("fullscreen-btn").addEventListener("click", enterFullscreenSlideshow);
    document.getElementById("set-album-btn").addEventListener("click", updateAlbumId);
    document.getElementById("slideshow-speed").addEventListener("change", updateSlideshowSpeed);
    document.getElementById("slideshow-start").addEventListener("change", updateSlideshowTime);
    document.getElementById("slideshow-end").addEventListener("change", updateSlideshowTime);
    getAccessToken();
});

// **🔹 授權用戶**
function authorizeUser() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
}

// **🔹 取得 access_token**
function getAccessToken() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = hashParams.get("access_token");

    if (accessToken) {
        console.log("成功獲取 access_token:", accessToken);
        localStorage.setItem("access_token", accessToken);

        // 確保授權成功後 UI 正確切換
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";

        fetchPhotos();
    } else {
        console.warn("未找到 access_token，請確認 OAuth 設定");
    }
}

// **🔹 取得 Google Photos 相片**
async function fetchPhotos(pageToken = '') {
    let token = localStorage.getItem("access_token");
    if (!token) return;

    let url = "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50";
    if (albumId) url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
        const requestBody = albumId ? JSON.stringify({ albumId: albumId, pageSize: 50, pageToken: pageToken }) : null;
        const response = await fetch(url, {
            method: albumId ? "POST" : "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: requestBody
        });

        if (!response.ok) {
            throw new Error('API 請求失敗');
        }

        const data = await response.json();

        if (data.mediaItems) {
            photos = [...photos, ...data.mediaItems.filter(item => item.mimeType.startsWith("image"))];
            displayPhotos();
            if (!slideshowInterval) startSlideshow();
        }

        nextPageToken = data.nextPageToken || null;
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// **🔹 更新相簿 ID**
function updateAlbumId() {
    albumId = document.getElementById("album-id-input").value;
    photos = [];
    fetchPhotos();
}

// **🔹 顯示相片縮略圖**
function displayPhotos() {
    const gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = ""; // 清空 gallery

    photos.forEach((photo, index) => {
        const img = document.createElement("img");
        img.src = `${photo.baseUrl}=w200-h200`;
        img.classList.add("photo-item");
        img.setAttribute("data-id", photo.id);
        img.onclick = () => openLightbox(index);  // 修正：將 openLightbox 指向正確的位置
        gallery.appendChild(img);
    });
}

// **🔹 開始輪播**
function startSlideshow() {
    if (photos.length === 0) return;
    
    changePhoto(0); // 修正：調用 changePhoto 函式來顯示第一張照片
    slideshowInterval = setInterval(() => {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        changePhoto(currentPhotoIndex);  // 修正：調用 changePhoto 函式來輪播照片
    }, slideshowSpeed);
}

// **🔹 更新輪播速度**
function updateSlideshowSpeed() {
    slideshowSpeed = document.getElementById("slideshow-speed").value * 1000;
    startSlideshow();
}

// **🔹 更新輪播時間範圍 (開始/結束時間)**
function updateSlideshowTime() {
    slideshowStartTime = document.getElementById("slideshow-start").value;
    slideshowEndTime = document.getElementById("slideshow-end").value;
    console.log(`輪播時間已更新: ${slideshowStartTime} - ${slideshowEndTime}`);
}

// **🔹 顯示圖片**
function changePhoto(index) {
    const photoContainer = document.getElementById("photo-container");
    const img = document.createElement("img");
    img.src = `${photos[index].baseUrl}=w800-h800`; // 顯示更大的圖片
    photoContainer.innerHTML = "";  // 清空原有圖片
    photoContainer.appendChild(img);
}

// **🔹 進入全螢幕輪播模式**
function enterFullscreenSlideshow() {
    isFullscreen = true;
    document.documentElement.requestFullscreen();
    startSlideshow();
}

// **🔹 退出全螢幕模式**
document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        isFullscreen = false;
        clearInterval(slideshowInterval);
    }
});

// **🔹 開啟大圖顯示**
function openLightbox(index) {
    const lightbox = document.getElementById("lightbox");
    const img = document.createElement("img");
    img.src = `${photos[index].baseUrl}=w800-h800`;  // 顯示更大的圖片
    lightbox.innerHTML = "";  // 清空 lightbox
    lightbox.appendChild(img);
    lightbox.style.display = "block";
}

// **🔹 關閉大圖顯示**
document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").style.display = "none";
});
