document.addEventListener('DOMContentLoaded', function() {
    const CLIENT_ID = '1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com';
    const API_KEY = window.API_KEY;
    const DISCOVERY_DOC = 'https://photoslibrary.googleapis.com/$discovery/rest?version=v1';
    const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly';
    const authButton = document.getElementById('authorize-button');
    const signoutButton = document.getElementById('signout-button');
    const content = document.getElementById('content');
    const thumbnailContainer = document.getElementById('thumbnail-container');
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const fullscreenImage = document.getElementById('fullscreen-image');
    const albumIdInput = document.getElementById('album-id');
    const shuffleCheckbox = document.getElementById('shuffle');

    let nextPageToken = '';
    let photos = [];
    let isShuffled = false;
    let intervalId;

    authButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    shuffleCheckbox.onchange = toggleShuffle;

    function handleClientLoad() {
        gapi.load('client:auth2', initClient);
    }

    function initClient() {
        gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: [DISCOVERY_DOC],
            scope: SCOPES
        }).then(() => {
            const authInstance = gapi.auth2.getAuthInstance();
            authInstance.isSignedIn.listen(updateSigninStatus);
            updateSigninStatus(authInstance.isSignedIn.get());
        }).catch(console.error);
    }

    function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            authButton.style.display = 'none';
            signoutButton.style.display = 'block';
            content.style.display = 'block';
            loadPhotos();
        } else {
            authButton.style.display = 'block';
            signoutButton.style.display = 'none';
            content.style.display = 'none';
            thumbnailContainer.innerHTML = '';
            nextPageToken = '';
            photos = [];
        }
    }

    function handleAuthClick() {
        gapi.auth2.getAuthInstance().signIn();
    }

    function handleSignoutClick() {
        gapi.auth2.getAuthInstance().signOut();
    }

    async function loadPhotos() {
        const albumId = albumIdInput.value.trim();
        let endpoint = 'https://photoslibrary.googleapis.com/v1/mediaItems';
        if (albumId) {
            endpoint = `https://photoslibrary.googleapis.com/v1/albums/${albumId}/mediaItems`;
        }

        try {
            const response = await gapi.client.request({
                path: endpoint,
                params: { pageSize: 20, pageToken: nextPageToken }
            });
            nextPageToken = response.result.nextPageToken;
            displayThumbnails(response.result.mediaItems);
        } catch (error) {
            console.error('Error loading photos:', error);
        }
    }

    function displayThumbnails(mediaItems) {
        mediaItems.forEach(item => {
            if (item.mimeType.startsWith('image/')) {
                photos.push(item.baseUrl);
                const img = document.createElement('img');
                img.src = `${item.baseUrl}=w200-h200`;
                img.className = 'thumbnail';
                img.onclick = () => enterFullscreen(item.baseUrl);
                thumbnailContainer.appendChild(img);
            }
        });
    }

    window.onscroll = () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && nextPageToken) {
            loadPhotos();
        }
    };

    function enterFullscreen(imageUrl) {
        fullscreenOverlay.style.display = 'block';
        fullscreenImage.src = imageUrl;
        startSlideshow();
    }

    function startSlideshow() {
        if (intervalId) clearInterval(intervalId);
        let currentIndex = 0;
        if (isShuffled) {
            photos = shuffleArray([...photos]);
        }
        intervalId = setInterval(() => {
            fullscreenImage.src = photos[currentIndex];
            currentIndex = (currentIndex + 1) % photos.length;
        }, 3000);
    }

    function toggleShuffle() {
        isShuffled = shuffleCheckbox.checked;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    fullscreenOverlay.onclick = () => {
        fullscreenOverlay.style.display = 'none';
        clearInterval(intervalId);
    };

    window.handleClientLoad = handleClientLoad;

    // 讀取動態 API Key
    fetch('./apiKey.js')
        .then(response => response.text())
        .then(data => {
            eval(data); // 讀取並執行 apiKey.js 的內容，注入 API_KEY
            handleClientLoad();
        })
        .catch(err => console.error('無法載入 API Key:', err));
});
