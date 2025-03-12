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
    let params = new URLSearchParams(window.location.search);
    
    // 檢查 URL 是否有 access_token
    if (params.has("access_token")) {
        accessToken = params.get("access_token");
        localStorage.setItem("access_token", accessToken);

        // 移除 access_token 參數，避免每次刷新都攜帶
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        accessToken = localStorage.getItem("access_token");
    }

    if (accessToken) {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        fetchPhotos();
    } else {
        console.warn("未找到 access_token，請確認 OAuth 設定");
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
    const tokenDisplay = document.getElementById("token-display");
    const storedToken = localStorage.getItem("access_token");
    
    if (storedToken) {
        tokenDisplay.textContent = "Access Token: " + storedToken;
    } else {
        tokenDisplay.textContent = "未找到 access_token，請先授權登入";
    }
});
