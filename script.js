const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = localStorage.getItem("access_token") || null;
let albumId = null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;
let nextPageToken = null;
let slideshowSpeed = 5000;
let slideshowStartTime = "08:00";
let slideshowEndTime = "22:00";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn").addEventListener("click", authorizeUser);
    document.getElementById("fullscreen-btn").addEventListener("click", enterFullscreenSlideshow);
    document.getElementById("set-album-btn").addEventListener("click", updateAlbumId);
    document.getElementById("slideshow-speed").addEventListener("change", updateSlideshowSpeed);
    document.getElementById("slideshow-start").addEventListener("change", updateSlideshowTime);
    document.getElementById("slideshow-end").addEventListener("change", updateSlideshowTime);
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
    const body = albumId ? { "albumId": albumId } : {};

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
            renderPhotos(photos);
        } else {
            console.error("獲取相片失敗", data);
        }
    })
    .catch(error => console.error("Error fetching photos:", error));
}

function renderPhotos(photos) {
    const gallery = document.getElementById("photo-gallery");
    gallery.innerHTML = '';
    photos.forEach((photo, index) => {
        const imgElement = document.createElement("img");
        imgElement.classList.add("photo-item");
        imgElement.src = photo.baseUrl + "=w100-h100";
        imgElement.onclick = () => openLightbox(index);
        gallery.appendChild(imgElement);
    });
}

function openLightbox(index) {
    currentPhotoIndex = index;
    const lightbox = document.getElementById("lightbox");
    lightbox.style.display = "flex";
    showPhotoInLightbox(currentPhotoIndex);
}

function showPhotoInLightbox(index) {
    const lightboxImage = document.getElementById("lightbox-img");
    lightboxImage.src = photos[index].baseUrl + "=w1024-h1024";
}

function closeLightbox() {
    document.getElementById("lightbox").style.display = "none";
}

function enterFullscreenSlideshow() {
    if (!photos.length) {
        console.warn("無照片可播放");
        return;
    }
    if (slideshowInterval) clearInterval(slideshowInterval);
    slideshowInterval = setInterval(() => {
        showPhotoInLightbox(currentPhotoIndex);
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    }, slideshowSpeed);
}

function updateSlideshowSpeed(event) {
    slideshowSpeed = parseInt(event.target.value, 10) || 5000;
}

function updateSlideshowTime(event) {
    if (event.target.id === "slideshow-start") {
        slideshowStartTime = event.target.value;
    }
    if (event.target.id === "slideshow-end") {
        slideshowEndTime = event.target.value;
    }
}
