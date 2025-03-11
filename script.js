const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com"; // ⚠️ 請替換成你的 Client ID
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let nextPageToken = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;

// 初始化 Google OAuth 授權
document.getElementById("authorize-btn").addEventListener("click", () => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=https://noharashiroi.github.io/photo-frame/&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
});

// 取得 URL 參數中的 access_token
function getAccessToken() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = hashParams.get("access_token");

    if (accessToken) {
        document.getElementById("authorize-btn").style.display = "none";
        fetchPhotos();
    } else {
        console.error("無法獲取 access_token，請確認 OAuth 設定");
    }
}

// 從 Google Photos API 獲取相片
async function fetchPhotos(pageToken = '') {
    let url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();

        if (data.mediaItems) {
            photos = [...photos, ...data.mediaItems]; // 存入全域變數
            displayPhotos();
            startSlideshow(); // 🚀 確保獲取相片後啟動輪播
        }
        nextPageToken = data.nextPageToken || null;
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// **🚀 自動輪播相片**
function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval); // 確保不會有多個計時器

    if (photos.length > 0) {
        changePhoto(0); // 顯示第一張
        slideshowInterval = setInterval(() => {
            currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
            changePhoto(currentPhotoIndex);
        }, 5000); // ⏳ 每 5 秒切換一次
    }
}

// **🔄 切換相片**
function changePhoto(index) {
    const img = document.getElementById("main-photo");
    img.src = photos[index].baseUrl;
}

// **顯示所有相片 (縮略圖)**
function displayPhotos() {
    const gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = ""; // 清空內容

    photos.forEach((photo, index) => {
        const img = document.createElement("img");
        img.src = photo.baseUrl;
        img.classList.add("photo-item");
        img.onclick = () => {
            openLightbox(index);
            clearInterval(slideshowInterval); // 🛑 停止輪播，避免影響預覽
        };
        gallery.appendChild(img);
    });
}
document.addEventListener("DOMContentLoaded", async () => {
    const photoContainer = document.getElementById("photo-container");
    let photos = [];
    let currentPhotoIndex = 0;

    async function fetchPhotos() {
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100", {
                headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` }
            });
            const data = await response.json();
            if (data.mediaItems) {
                photos = data.mediaItems.filter(item => item.mimeType.startsWith("image"));
                shufflePhotos();
                showPhoto();
            }
        } catch (error) {
            console.error("Error fetching photos:", error);
        }
    }

    function shufflePhotos() {
        for (let i = photos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [photos[i], photos[j]] = [photos[j], photos[i]];
        }
    }

    function showPhoto() {
        if (photos.length === 0) return;
        photoContainer.style.backgroundImage = `url(${photos[currentPhotoIndex].baseUrl})`;
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    }

    setInterval(showPhoto, 5000);

    if (!localStorage.getItem("access_token")) {
        window.location.href = "authorize.html"; // 需設置 Google OAuth 授權頁面
    } else {
        fetchPhotos();
    }
});

// **點擊相片放大 (Lightbox)**
function openLightbox(index) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");

    lightbox.style.display = "flex";
    lightboxImg.src = photos[index].baseUrl;
}

// **關閉 Lightbox 並重新啟動輪播**
document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").style.display = "none";
    startSlideshow(); // 📢 重新啟動輪播
});

// **初始化時檢查 Access Token**
getAccessToken();
