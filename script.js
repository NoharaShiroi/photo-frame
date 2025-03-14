const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
const SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";

window.addEventListener('DOMContentLoaded', function() {
    const authBtn = document.getElementById('google-auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', redirectToAuthorization);
    } else {
        console.error("授权按钮未找到！");
    }

    checkAuthorizationStatus();

    const slideshowBtn = document.getElementById("start-slideshow-btn");
    if (slideshowBtn) {
        slideshowBtn.addEventListener("click", startSlideshow);
    } else {
        console.error("幻灯片按钮未找到！");
    }

    const closeBtn = document.getElementById("close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeLightbox);
    }

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) {
        prevBtn.addEventListener("click", prevPhoto);
    }

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) {
        nextBtn.addEventListener("click", nextPhoto);
    }

    window.addEventListener("scroll", handleScroll);
});

function redirectToAuthorization() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${SCOPES}&prompt=consent`;
    window.location.href = authUrl;
}

function checkAuthorizationStatus() {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        alert("未授權或授權過期，請重新授權");
        window.location.href = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) + "&response_type=token&scope=" + SCOPES + "&prompt=consent";
    }
}

let slideshowInterval;
let currentSlideIndex = 0;

function startSlideshow() {
    if (!slideshowInterval) {
        slideshowInterval = setInterval(function() {
            nextPhoto();
        }, slideshowSpeed * 1000);
    }
}

function stopSlideshow() {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
}

function nextPhoto() {
    const photos = document.querySelectorAll('.photo');
    currentSlideIndex = (currentSlideIndex + 1) % photos.length;
    updatePhotoDisplay(currentSlideIndex);
}

function prevPhoto() {
    const photos = document.querySelectorAll('.photo');
    currentSlideIndex = (currentSlideIndex - 1 + photos.length) % photos.length;
    updatePhotoDisplay(currentSlideIndex);
}

function updatePhotoDisplay(index) {
    const photos = document.querySelectorAll('.photo');
    photos.forEach((photo, i) => {
        photo.style.display = (i === index) ? 'block' : 'none';
    });
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
    }
}

function handleScroll() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
        loadMorePhotos();
    }
}

function loadMorePhotos() {
    console.log('加载更多图片...');
}
