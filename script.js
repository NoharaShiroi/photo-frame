const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;

// **🔹 初始化 Google OAuth**
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").addEventListener("click", authorizeUser);
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
        localStorage.setItem("access_token", accessToken);
        document.getElementById("authorize-btn").style.display = "none";
        fetchPhotos();
    } else {
        console.warn("未找到 access_token，請先授權 Google Photos");
    }
}

// **🔹 取得 Google Photos 相片**
async function fetchPhotos(pageToken = '') {
    let token = localStorage.getItem("access_token");
    if (!token) return console.error("未找到 access_token");

    let url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.mediaItems) {
            photos = data.mediaItems.filter(item => item.mimeType.startsWith("image"));
            shufflePhotos();
            displayPhotos();
            startSlideshow();
        } else {
            console.error("未獲取到相片數據");
        }
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// **🔹 打亂相片順序**
function shufflePhotos() {
    for (let i = photos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
    }
}

// **🔹 開始輪播**
function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    if (photos.length === 0) return console.warn("沒有可顯示的相片");

    changePhoto(0);
    slideshowInterval = setInterval(() => {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        changePhoto(currentPhotoIndex);
    }, 5000);
}

// **🔹 切換相片**
function changePhoto(index) {
    document.getElementById("main-photo").src = photos[index].baseUrl;
}

// **🔹 顯示相片縮略圖**
function displayPhotos() {
    const gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = "";

    photos.forEach((photo, index) => {
        const img = document.createElement("img");
        img.src = `${photo.baseUrl}=w200-h200`;
        img.classList.add("photo-item");
        img.onclick = () => openLightbox(index);
        gallery.appendChild(img);
    });
}

// **🔹 放大相片**
function openLightbox(index) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");

    lightbox.style.display = "flex";
    lightboxImg.src = photos[index].baseUrl;
    clearInterval(slideshowInterval);
}

// **🔹 點擊關閉 Lightbox**
document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").style.display = "none";
    startSlideshow();
});
