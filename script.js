window.addEventListener('DOMContentLoaded', function() {
    // 授权按钮事件监听
    const authBtn = document.getElementById('google-auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', redirectToAuthorization);
    } else {
        console.error("授权按钮未找到！");
    }

    // 检查是否有有效的 access_token
    checkAuthorizationStatus();

    // 绑定幻灯片按钮事件
    const slideshowBtn = document.getElementById("start-slideshow-btn");
    if (slideshowBtn) {
        slideshowBtn.addEventListener("click", startSlideshow);
    } else {
        console.error("幻灯片按钮未找到！");
    }

    // 绑定关闭大图按钮事件
    const closeBtn = document.getElementById("close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeLightbox);
    }

    // 绑定上一张按钮事件
    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) {
        prevBtn.addEventListener("click", prevPhoto);
    }

    // 绑定下一张按钮事件
    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) {
        nextBtn.addEventListener("click", nextPhoto);
    }

    // 处理页面底部加载更多照片
    window.addEventListener("scroll", handleScroll);
});

// 授权跳转函数
function redirectToAuthorization() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${SCOPES}&prompt=consent`;
    window.location.href = authUrl;
}

// 检查授权状态
function checkAuthorizationStatus() {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        alert("未授權或授權過期，請重新授權");
        window.location.href = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) + "&response_type=token&scope=" + SCOPES + "&prompt=consent";
    }
}

// 启动幻灯片
let slideshowInterval;
let currentSlideIndex = 0;

function startSlideshow() {
    if (!slideshowInterval) {
        slideshowInterval = setInterval(function() {
            nextPhoto();  // 每隔一定时间自动切换图片
        }, slideshowSpeed);  // 使用你设置的幻灯片速度
    }
}

// 停止幻灯片
function stopSlideshow() {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
}

// 切换下一张图片
function nextPhoto() {
    const photos = document.querySelectorAll('.photo');  // 假设每个图片有类名为 'photo'
    currentSlideIndex = (currentSlideIndex + 1) % photos.length;
    updatePhotoDisplay(currentSlideIndex);  // 刷新图片显示
}

// 切换上一张图片
function prevPhoto() {
    const photos = document.querySelectorAll('.photo');
    currentSlideIndex = (currentSlideIndex - 1 + photos.length) % photos.length;
    updatePhotoDisplay(currentSlideIndex);  // 刷新图片显示
}

// 更新当前显示的图片
function updatePhotoDisplay(index) {
    const photos = document.querySelectorAll('.photo');
    photos.forEach((photo, i) => {
        photo.style.display = (i === index) ? 'block' : 'none';  // 只显示当前图片
    });
}

// 关闭大图显示
function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';  // 隐藏大图
    }
}

// 监听滚动事件，判断是否需要加载更多图片
function handleScroll() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
        loadMorePhotos();
    }
}

// 加载更多图片函数
function loadMorePhotos() {
    // 在这里添加你加载更多图片的逻辑
    console.log('加载更多图片...');
}
