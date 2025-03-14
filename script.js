let photos = [];
let nextPageToken = null;
let currentPhotoIndex = 0;
let slideshowInterval = null;
let slideshowSpeed = 5000;  // 默认幻灯片播放速度

// 处理滚动事件加载更多照片
function handleScroll() {
    const gallery = document.getElementById("photo-gallery");
    if (window.innerHeight + window.scrollY >= gallery.offsetHeight - 100) {
        // 如果存在下一页，继续加载更多照片
        if (nextPageToken) {
            fetchAllPhotos(nextPageToken);
        }
    }
}

// 获取照片并渲染
function fetchAllPhotos(pageToken = null) {
    const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    const body = { pageSize: 50, pageToken };
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
        if (data && data.mediaItems) {
            photos = [...photos, ...data.mediaItems];
            nextPageToken = data.nextPageToken;
            renderPhotos();
        }
    })
    .catch(error => console.error("Error fetching photos:", error));
}

// 渲染图片到页面
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

// 打开大图
function openLightbox(index) {
    currentPhotoIndex = index;
    document.getElementById("lightbox").style.display = "flex";
    showPhotoInLightbox(currentPhotoIndex);
}

// 显示放大的图片
function showPhotoInLightbox(index) {
    const lightboxImage = document.getElementById("lightbox-img");
    if (photos.length > 0 && index >= 0 && index < photos.length) {
        lightboxImage.src = photos[index].baseUrl + "=w1024-h1024";
    }
}

// 关闭大图
function closeLightbox() {
    document.getElementById("lightbox").style.display = "none";
}

// 上一张
function prevPhoto(event) {
    event.stopPropagation();
    if (photos.length > 0) {
        currentPhotoIndex = (currentPhotoIndex - 1 + photos.length) % photos.length;
        showPhotoInLightbox(currentPhotoIndex);
    }
}

// 下一张
function nextPhoto(event) {
    event.stopPropagation();
    if (photos.length > 0) {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        showPhotoInLightbox(currentPhotoIndex);
    }
}

// 启动幻灯片播放
function startSlideshow() {
    slideshowInterval = setInterval(() => {
        nextPhoto({ stopPropagation: () => {} });
    }, slideshowSpeed);
}

// 停止幻灯片播放
function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
    }
}

// 调整幻灯片播放速度
document.getElementById("slideshow-speed").addEventListener("change", () => {
    slideshowSpeed = parseInt(document.getElementById("slideshow-speed").value) * 1000;
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
    }
    startSlideshow();
});

// 处理授权过期，跳转到授权页面
function redirectToAuthorization() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${SCOPES}&prompt=consent`;
    window.location.href = authUrl;
}

// 监听滚动事件
window.addEventListener("scroll", handleScroll);

// 按钮点击事件
document.getElementById("start-slideshow-btn").addEventListener("click", startSlideshow);
document.getElementById("stop-slideshow-btn").addEventListener("click", stopSlideshow);
document.getElementById("close-btn").addEventListener("click", closeLightbox);
document.getElementById("prev-btn").addEventListener("click", prevPhoto);
document.getElementById("next-btn").addEventListener("click", nextPhoto);
