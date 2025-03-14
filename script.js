const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
let accessToken = localStorage.getItem("access_token") || null;
let albumId = localStorage.getItem("albumId") || null;
let photos = [];
let currentPhotoIndex = 0;
let slideshowInterval = null;
let nextPageToken = null;

function updateAlbumId() {
    if (!accessToken) {
        alert("請先授權 Google 帳戶！");
        return;
    }
    const url = "https://photoslibrary.googleapis.com/v1/albums";
    fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        const albumList = data.albums;
        if (albumList && albumList.length > 0) {
            const albumSelect = prompt("請選擇相簿:\n" + albumList.map((album, index) => `${index + 1}. ${album.title}`).join("\n"));
            const albumIndex = parseInt(albumSelect) - 1;
            if (albumIndex >= 0 && albumIndex < albumList.length) {
                albumId = albumList[albumIndex].id;
                localStorage.setItem("albumId", albumId);
                photos = [];
                nextPageToken = null;
                fetchPhotos();
            }
        } else {
            alert("無相簿可供選擇");
        }
    })
    .catch(error => console.error("Error fetching albums:", error));
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authorize-btn")?.addEventListener("click", authorizeUser);
    document.getElementById("set-album-btn")?.addEventListener("click", updateAlbumId);
    window.addEventListener("scroll", handleScroll);
    getAccessToken();
});

function authorizeUser() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${SCOPES}&prompt=consent`;
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
    .then(response => {
        if (response.status === 401) {
            alert("未授權或授權過期，請重新授權！");
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data && data.mediaItems) {
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
        const imgElement = document.createElement("img");
        imgElement.classList.add("photo-item");
        imgElement.src = photo.baseUrl + "=w1024-h1024";
        imgElement.setAttribute("data-index", index);
        imgElement.onclick = () => openLightbox(index);
        gallery.appendChild(imgElement);
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

// Bind event for closing lightbox
document.getElementById("close-btn").addEventListener("click", closeLightbox);
document.getElementById("lightbox").addEventListener("click", (event) => {
    if (event.target === document.getElementById("lightbox")) {
        closeLightbox();
    }
});
document.getElementById("prev-btn").addEventListener("click", prevPhoto);
document.getElementById("next-btn").addEventListener("click", nextPhoto);
