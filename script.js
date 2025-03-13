var CLIENT_ID = "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com";
var REDIRECT_URI = "https://noharashiroi.github.io/photo-frame/";
var SCOPES = "https://www.googleapis.com/auth/photoslibrary.readonly";
var accessToken = localStorage.getItem("access_token") || null;
var albumId = localStorage.getItem("albumId") || null;
var photos = [];
var currentPhotoIndex = 0;
var slideshowInterval = null;
var slideshowSpeed = 5000; // Default slideshow speed
var nextPageToken = null;
var albums = [];
var cachedPhotos = {};  // For caching images

// **Get Access Token**
function getAccessToken() {
    var hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has("access_token")) {
        accessToken = hashParams.get("access_token");
        localStorage.setItem("access_token", accessToken); // Store Token
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (accessToken) {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "flex";
        fetchAlbums();
    } else {
        document.getElementById("auth-container").style.display = "flex";
        document.getElementById("app-container").style.display = "none";
    }
}

// **Authorize User**
function authorizeUser() {
    var authUrl = "https://accounts.google.com/o/oauth2/auth?client_id=" + CLIENT_ID +
        "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
        "&response_type=token&scope=" + SCOPES +
        "&prompt=consent";
    window.location.href = authUrl;
}

// **Fetch Album List**
function fetchAlbums() {
    if (!accessToken) {
        console.error("Missing accessToken, please authorize first");
        return;
    }
    var url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";
    fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.albums) {
            albums = data.albums;
            renderAlbumList();
        }
    })
    .catch(error => console.error("Error fetching albums:", error));
}

// **Render Album List**
function renderAlbumList() {
    var albumListContainer = document.getElementById("album-list");
    albumListContainer.innerHTML = '';

    albums.forEach(function(album) {
        var li = document.createElement("li");
        li.textContent = album.title;
        li.addEventListener("click", function() {
            albumId = album.id;
            localStorage.setItem("albumId", albumId);
            photos = [];
            nextPageToken = null;
            fetchPhotos();
        });
        albumListContainer.appendChild(li);
    });
}

// **Fetch Photos from Selected Album**
function fetchPhotos() {
    if (!accessToken) {
        console.error("Missing accessToken, please authorize first");
        return;
    }
    var url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
    var body = { pageSize: 50 };
    if (albumId) body.albumId = albumId;
    if (nextPageToken) body.pageToken = nextPageToken;

    fetch(url, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        if (data.mediaItems) {
            photos = photos.concat(data.mediaItems);
            nextPageToken = data.nextPageToken || null;
            renderPhotos();
            document.getElementById("back-to-albums-btn").style.display = "block";  // Show back button
        }
    })
    .catch(error => console.error("Error fetching photos:", error));
}

// **Render Photos**
function renderPhotos() {
    var photoContainer = document.getElementById("photo-container");
    var slideshowBtn = document.getElementById("slideshow-btn");
    if (!photoContainer) return;

    photoContainer.innerHTML = ''; // Clear container

    if (photos.length === 0) {
        photoContainer.innerHTML = 'No photos in this album';
        return;
    }

    photos.forEach(function(photo, index) {
        var img = document.createElement("img");
        if (cachedPhotos[photo.id]) {
            img.src = cachedPhotos[photo.id];  // Use cached image
        } else {
            img.src = photo.baseUrl + "=w600-h400";  // Adjust image size as needed
            cachedPhotos[photo.id] = img.src;  // Save to cache
        }
        img.alt = photo.filename || "Photo";
        img.classList.add("photo");
        img.addEventListener("click", function() {
            openLightbox(photo.baseUrl);
            slideshowBtn.style.display = "block";  // Show slideshow button
        });
        photoContainer.appendChild(img);

        // Mark the current image as active
        if (index === currentPhotoIndex) {
            img.classList.add('active');
        }
    });
}

// **Start Slideshow**
document.getElementById("slideshow-btn").addEventListener("click", function() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);  // Clear existing slideshow interval
    }
    startSlideshow();
});

// **Start Slideshow with Custom Transition**
function startSlideshow() {
    slideshowInterval = setInterval(function() {
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
        renderPhotos();
    }, slideshowSpeed);
}

// **Change Slideshow Speed**
document.getElementById("slideshow-speed").addEventListener("input", function(e) {
    slideshowSpeed = parseInt(e.target.value);
    if (slideshowInterval) {
        clearInterval(slideshowInterval);  // Clear current slideshow
        startSlideshow();  // Restart slideshow with new speed
    }
});

// **Automatic Update of Photos**
setInterval(function() {
    if (albumId) {
        fetchPhotos();  // Periodically check for new photos
    }
}, 60000);  // Check every minute

// **Page Load Initialization**
document.addEventListener("DOMContentLoaded", function () {
    var authBtn = document.getElementById("authorize-btn");
    if (authBtn) authBtn.addEventListener("click", authorizeUser);
    getAccessToken();
});
