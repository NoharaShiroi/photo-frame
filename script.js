document.getElementById("auth").addEventListener("click", () => {
    window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com&redirect_uri=https://noharashiroi.github.io/photo-frame/&scope=https://www.googleapis.com/auth/photoslibrary.readonly&response_type=token`;
});

async function fetchPhotos() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get("access_token");
    if (!accessToken) {
        console.log("未授權");
        return;
    }

    const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    
    const container = document.getElementById("photos");
    data.mediaItems.forEach(item => {
        const img = document.createElement("img");
        img.src = item.baseUrl;
        img.style.width = "200px";
        container.appendChild(img);
    });
}

fetchPhotos();
let nextPageToken = null; // 存下一頁的 token

async function fetchPhotos(pageToken = '') {
    const url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50${pageToken ? '&pageToken=' + pageToken : ''}`;
    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });
        const data = await response.json();

        if (data.mediaItems) {
            displayPhotos(data.mediaItems);
        }

        // 記錄下一頁 token
        nextPageToken = data.nextPageToken || null;
    } catch (error) {
        console.error('Error fetching photos:', error);
    }
}

// 監聽滾動事件，自動載入更多相片
window.onscroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && nextPageToken) {
        fetchPhotos(nextPageToken);
    }
};

// 第一次載入
fetchPhotos();
