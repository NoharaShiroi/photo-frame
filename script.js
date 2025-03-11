const CLIENT_ID = "你的_CLIENT_ID"; // ⚠️ 替換成你的 Client ID
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;

// **🔹 初始化 Google OAuth**
document.getElementById("authorize-btn").addEventListener("click", () => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=https://你的GitHub帳號.github.io/photo-frame/&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
});

// **🔹 取得 URL 參數中的 access_token**
function getAccessToken() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = hashParams.get("access_token");

    if (accessToken) {
        localStorage.setItem("access_token", accessToken);
        document.getElementById("authorize-btn").style.display = "none";
        fetchPhotos();
    } else {
        console.error("無法獲取 access_token，請確認 OAuth 設定");
    }
}

// **🔹 從 Google Photos API 獲取相片**
async function fetchPhotos(pageToken = '') {
    let url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        });
        const data = await response.json();

        if (data.mediaItems) {
            photos = data.mediaItems.filter(item => item.mimeType.startsWith("image"));
            shufflePhotos();
            displayPhotos();
            startSlideshow();
        }
    } catch (error) {
        console.error("Error fetching photos:", error);
    }
}

// **🔹 打亂相片順序 (隨機播放)**
function shufflePhotos() {
    for (let i = photos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [photos[i], photos[j]] = [photos[j], photos[i]];
    }
}

// **🔹 自動輪播相片**
function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);

    if (photos.length > 0) {
        changePhoto(0);
        slideshowInterval = setInterval(() => {
            currentPhotoIndex = (currentPho
