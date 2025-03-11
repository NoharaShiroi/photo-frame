document.getElementById("auth").addEventListener("click", () => {
    window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=你的CLIENT_ID&redirect_uri=https://你的GitHub帳號.github.io/photo-frame/&scope=https://www.googleapis.com/auth/photoslibrary.readonly&response_type=token`;
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
