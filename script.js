const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com"; // ⚠️ 請替換成你的 Client ID
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let nextPageToken = null;

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
            displayPhotos(data.mediaItems);
        }
        nextPageToken = data.nextPageToken || null;
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// 顯示相片到畫面
function displayPhotos(photos) {
    const gallery = document.getElementById("photo-gallery");

    photos.forEach(photo => {
        const img = document.createElement("img");
        img.src = photo.baseUrl;
        img.classList.add("photo-item");
        img.onclick = () => openLightbox(photo.baseUrl);
        gallery.appendChild(img);
    });
}

// 監聽滾動事件，自動載入更多相片
window.onscroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && nextPageToken) {
        fetchPhotos(nextPageToken);
    }
};

// 開啟 Lightbox
function openLightbox(imageUrl) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");

    lightbox.style.display = "flex";
    lightboxImg.src = imageUrl;
}

// 關閉 Lightbox
document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").style.display = "none";
});

// 初始化時檢查 Access Token
getAccessToken();
