const app = {
    
const CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = [
    'https://photoslibrary.googleapis.com/$discovery/rest?version=v1'
];
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly';

const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loadAlbumButton = document.getElementById('load-album');
const albumIdInput = document.getElementById('album-id');
const photoGallery = document.getElementById('photo-gallery');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const closeLightbox = document.getElementById('close-lightbox');
const shufflePlayCheckbox = document.getElementById('shuffle-play');
const slideshowIntervalInput = document.getElementById('slideshow-interval');
const sleepStartInput = document.getElementById('sleep-start');
const sleepEndInput = document.getElementById('sleep-end');

let authInstance;
let nextPageToken = '';
let photos = [];

function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(() => {
        authInstance = gapi.auth2.getAuthInstance();
        updateSigninStatus(authInstance.isSignedIn.get());
        authInstance.isSignedIn.listen(updateSigninStatus);
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        loadAlbumButton.disabled = false;
    } else {
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        loadAlbumButton.disabled = true;
    }
}

loginButton.onclick = () => authInstance.signIn();
logoutButton.onclick = () => authInstance.signOut();
loadAlbumButton.onclick = loadAlbum;

async function loadAlbum() {
    photos = [];
    nextPageToken = '';
    photoGallery.innerHTML = '';
    await fetchPhotos(albumIdInput.value);
    renderPhotos();
}

async function fetchPhotos(albumId) {
    try {
        const response = await gapi.client.photoslibrary.mediaItems.search({
            albumId: albumId,
            pageToken: nextPageToken,
            pageSize: 20
        });
        nextPageToken = response.result.nextPageToken;
        photos = photos.concat(response.result.mediaItems);
    } catch (error) {
        console.error('Error fetching photos:', error);
    }
}

function renderPhotos() {
    photoGallery.innerHTML = '';
    photos.forEach(photo => {
        const img = document.createElement('img');
        img.src = `${photo.baseUrl}=w200-h200`;
        img.className = 'thumbnail';
        img.onclick = () => showLightbox(photo.baseUrl);
        photoGallery.appendChild(img);
    });
}

function showLightbox(url) {
    lightbox.style.display = 'block';
    lightboxImage.src = url;
}

closeLightbox.onclick = () => (lightbox.style.display = 'none');
window.onclick = (e) => {
    if (e.target === lightbox) lightbox.style.display = 'none';
};

document.addEventListener('scroll', async () => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 50 && nextPageToken) {
        await fetchPhotos(albumIdInput.value);
        renderPhotos();
    }
});

window.onload = handleClientLoad;
