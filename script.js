

    let authToken;
const CLIENT_ID = '1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com';
const API_KEY = 'YOUR_API_KEY';
const DISCOVERY_DOCS = [
    'https://photoslibrary.googleapis.com/$discovery/rest?version=v1'
];
const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly';

const albumIdInput = document.getElementById('album-id');
const authButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const photoContainer = document.getElementById('photo-container');
const slideshowContainer = document.getElementById('lightbox');
const closeButton = document.getElementById('close-lightbox');
const randomOrderCheckbox = document.getElementById('random-order');
const screenOverlay = document.getElementById('screenOverlay');

let photos = [];
let currentIndex = 0;
let slideshowInterval;

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
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authButton.style.display = 'none';
        signoutButton.style.display = 'block';
        loadAlbumPhotos();
    } else {
        authButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

async function loadAlbumPhotos(pageToken = '') {
    const albumId = albumIdInput.value;
    let endpoint = 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=25';
    if (albumId) endpoint = `https://photoslibrary.googleapis.com/v1/albums/${albumId}/mediaItems?pageSize=25`;
    if (pageToken) endpoint += `&pageToken=${pageToken}`;

    const response = await gapi.client.request({
        path: endpoint
    });

    const newPhotos = response.result.mediaItems || [];
    photos = photos.concat(newPhotos);
    displayPhotos(newPhotos);

    if (response.result.nextPageToken) {
        loadAlbumPhotos(response.result.nextPageToken);
    }
}

function displayPhotos(photoArray) {
    photoArray.forEach(photo => {
        const img = document.createElement('img');
        img.src = photo.baseUrl + '=w200-h200';
        img.onclick = () => startSlideshow(photos.indexOf(photo));
        photoContainer.appendChild(img);
    });
}

function startSlideshow(index) {
    currentIndex = index;
    screenOverlay.style.display = 'block';
    updateSlideshowImage();
    slideshowInterval = setInterval(nextSlide, 3000);
}

function updateSlideshowImage() {
    slideshowContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = photos[currentIndex].baseUrl + '=w2000-h2000';
    slideshowContainer.appendChild(img);
}

function nextSlide() {
    currentIndex = (currentIndex + 1) % photos.length;
    updateSlideshowImage();
}

closeButton.onclick = () => {
    screenOverlay.style.display = 'none';
    clearInterval(slideshowInterval);
};

window.onload = handleClientLoad;
