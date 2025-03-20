script>
        const app = {
            CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
            REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
            SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",
            accessToken: sessionStorage.getItem("access_token") || null,
            refresh_token: sessionStorage.getItem("refresh_token") || null,
            albums: [],
            albumId: null,
            photos: [],
            currentPhotoIndex: 0,
            nextPageToken: null,
            slideshowInterval: null,
            slideshowSpeed: 3000,
            isSlideshowPlaying: false,
            sleepStartTime: null,
            sleepEndTime: null,
            sleepModeActive: false,
            cacheEnabled: true,
            cacheExpiration: 86400000, // 24hrs in ms

            getAccessToken: function() {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                if (hashParams.has("access_token")) {
                    this.accessToken = hashParams.get("access_token");
                    console.log("Access token obtained:", this.accessToken);
                    if (hashParams.has("refresh_token")) {
                        this.refresh_token = hashParams.get("refresh_token");
                        sessionStorage.setItem("refresh_token", this.refresh_token);
                    }
                    sessionStorage.setItem("access_token", this.accessToken);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                this.updateUI();
            },

            updateUI: function() {
                if (this.accessToken) {
                    document.getElementById("auth-container").style.display = "none";
                    document.getElementById("app-container").style.display = "flex";
                    this.fetchAlbums().then(() => {
                        this.loadPhotos();
                    });
                } else {
                    document.getElementById("auth-container").style.display = "flex";
                    document.getElementById("app-container").style.display = "none";
                }
            },

            authorizeUser: function() {
                window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&response_type=token&scope=${this.SCOPES}&prompt=consent`;
            },

            fetchAlbums: function() {
                return new Promise((resolve, reject) => {
                    if (!this.accessToken) return reject("No access token.");

                    const url = "https://photoslibrary.googleapis.com/v1/albums?pageSize=50";

                    fetch(url, {
                        method: "GET",
                        headers: { 
                            "Authorization": "Bearer " + this.accessToken 
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Network response was not ok: " + response.statusText);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Fetched albums data:", data);
                        if (data.albums) {
                            this.albums = data.albums;
                            this.renderAlbumList();
                            resolve();
                        } else {
                            console.error("No albums found in the response.");
                            reject("No albums found.");
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching albums:", error);
                        this.handleFetchError(error);
                        reject(error);
                    });
                });
            },

            renderAlbumList: function() {
                const albumSelect = document.getElementById("album-select");
                albumSelect.innerHTML = '<option value="all">所有相片</option>';
                this.albums.forEach(album => {
                    const option = document.createElement("option");
                    option.value = album.id;
                    option.textContent = album.title;
                    albumSelect.appendChild(option);
                });
            },

            loadPhotos: function() {
                const albumSelect = document.getElementById("album-select");
                this.albumId = albumSelect.value === "all" ? null : albumSelect.value;
                this.loadCachedPhotos();

                if (this.photos.length === 0) {
                    this.fetchPhotos();
                } else {
                    this.renderPhotos(); // 如果有缓存照片则直接渲染
                }
            },

            fetchPhotos: function(retriesLeft = 3) {
                const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
                const body = {
                    pageSize: 50,
                    pageToken: this.nextPageToken || ''
                };

                if (this.albumId !== null) {
                    body.albumId = this.albumId;
                }

                console.log("Requesting photos with body:", body);
                const loadingIndicator = document.getElementById('global-loading');
                loadingIndicator.style.display = 'block';

                fetch(url, {
                    method: "POST",
                    headers: { 
                        "Authorization": "Bearer " + this.accessToken, 
                        "Content-Type": "application/json" 
                    },
                    body: JSON.stringify(body)
                })
                .then(response => {
                    loadingIndicator.style.display = 'none';
                    if (!response.ok) {
                        throw new Error("Network response was not ok: " + response.statusText);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('fetchPhotos data:', data);
                    if (data.mediaItems) {
                        this.photos = this.photos.concat(data.mediaItems.map(item => ({
                            id: item.id,
                            baseUrl: item.baseUrl,
                            filename: item.filename
                        })));
                        this.nextPageToken = data.nextPageToken;
                        this.cachePhotos();
                        this.renderPhotos();
                    } else {
                        console.error("No mediaItems found in the response.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching photos:", error);
                    if (retriesLeft > 1) {
                        const waitTime = Math.min(10000, 1000 * retriesLeft);
                        setTimeout(() => this.fetchPhotos(retriesLeft - 1), waitTime);
                    } else {
                        console.error('Failed to fetch photos after all retries.');
                    }
                });
            },

            loadCachedPhotos: function() {
                if (!this.cacheEnabled) return;

                const albumId = this.albumId === null ? 'all' : this.albumId;
                const cachedData = localStorage.getItem(`photos-${albumId}`);

                if (cachedData) {
                    try {
                        const data = JSON.parse(cachedData);
                        const currentTime = Date.now();
                        if (currentTime - data.cacheTime <= this.cacheExpiration) {
                            this.photos = data.items || [];
                            this.nextPageToken = data.nextPageToken || null;
                        } else {
                            console.warn('缓存已过期，重新加载照片');
                        }
                    } catch (error) {
                        console.error('Error loading cached photos:', error);
                        this.cacheEnabled = false;
                    }
                }
            },

            cachePhotos: function() {
                if (!this.cacheEnabled) return;

                const albumId = this.albumId === null ? 'all' : this.albumId;
                const cacheData = {
                    items: this.photos,
                    nextPageToken: this.nextPageToken,
                    cacheTime: Date.now()
                };

                localStorage.setItem(`photos-${albumId}`, JSON.stringify(cacheData));
            },

            renderPhotos: function() {
                const photoContainer = document.getElementById("photo-container");
                const thumbnailList = document.querySelector('.thumbnail-list');

                photoContainer.innerHTML = '';
                thumbnailList.innerHTML = '';

                if (this.photos.length === 0) {
                    photoContainer.innerHTML = "<p>此相簿目前沒有照片</p>";
                    thumbnailList.innerHTML = "<p>無Thumbnail可顯示</p>";
                    return;
                }

                this.photos.forEach((photo, index) => {
                    const img = document.createElement("img");
                    img.src = `${photo.baseUrl}=w600-h400&v=3`;
                    img.alt = "Photo" + (index + 1);
                    img.classList.add("photo");
                    img.onclick = () => this.openLightbox(index);

                    const wrapper = document.createElement("div");
                    wrapper.className = "thumbnail";
                    wrapper.innerHTML = `
                        <img src="${photo.baseUrl}=w60-h40&v=3" alt="Thumbnail${index + 1}" class="thumbnail">
                        <div class="loading" style="display: none;">載入中...</div>
                    `;

                    const thumbnailImg = wrapper.querySelector('.thumbnail');
                    const thumbnailLoading = wrapper.querySelector('.loading');

                    thumbnailImg.onload = () => {
                        thumbnailLoading.style.display = 'none';
                    };

                    thumbnailImg.onerror = (e) => {
                        console.error(`Thumbnail failed to load from URL: ${thumbnailImg.src}`, e);
                        thumbnailLoading.style.display = 'none';
                        wrapper.innerHTML = '<div class="error">圖片加載失敗</div>';
                    };

                    thumbnailList.appendChild(wrapper);

                    img.onload = () => {
                        if (this.isSlideshowPlaying) {
                            this.resumeSlideshow();
                        }
                    };

                    img.onerror = (e) => {
                        console.error(`Photo failed to load from URL: ${img.src}`, e);
                        img.remove();
                    };

                    photoContainer.appendChild(img);
                });
            },

            openLightbox: function(index) {
                const lightbox = document.getElementById("lightbox");
                const lightboxImage = document.getElementById("lightbox-image");
                lightboxImage.src = `${this.photos[index].baseUrl}=w1200-h800`;
                lightbox.style.display = "flex";
                setTimeout(() => lightbox.style.opacity = 1, 10);
                this.currentPhotoIndex = index;
                document.getElementById("prev-photo").onclick = () => this.changePhoto(-1);
                document.getElementById("next-photo").onclick = () => this.changePhoto(1);
            },

            changePhoto: function(direction) {
                this.currentPhotoIndex += direction;
                if (this.currentPhotoIndex < 0) {
                    this.currentPhotoIndex = this.photos.length - 1;
                } else if (this.currentPhotoIndex >= this.photos.length) {
                    this.currentPhotoIndex = 0;
                }
                this.showCurrentPhoto();
            },

            showCurrentPhoto: function() {
                const lightboxImage = document.getElementById("lightbox-image");
                lightboxImage.src = `${this.photos[this.currentPhotoIndex].baseUrl}=w1200-h800`;
            },

            setSleepMode: function() {
                const startTime = document.getElementById("sleep-time-start").value;
                const endTime = document.getElementById("sleep-time-end").value;

                if (startTime && endTime) {
                    this.sleepStartTime = startTime;
                    this.sleepEndTime = endTime;
                    const result = this.isTimeWithinRange(new Date());
                    if (result) {
                        alert('休眠時間設定成功');
                        this.checkSleepMode();
                        setInterval(() => this.checkSleepMode(), 60000); // 每分鐘檢查一次
                    } else {
                        alert('設定的休眠時間不交叉，請檢查');
                    }
                } else {
                    alert('請設定完整的休眠時間');
                }
            },

            checkSleepMode: function() {
                const now = new Date();
                let result = this.isTimeWithinRange(now);

                if (result && 
                    new Date(now.getFullYear(), now.getMonth(), 
                             now.getDate(), 
                             this.sleepStartTime.split(':')[0], 
                             this.sleepStartTime.split(':')[1]) <= now) {
                    this.activateSleepMode();
                } else {
                    this.deactivateSleepMode();
                }
            },

            isTimeWithinRange: function(date) {
                const startSplit = this.sleepStartTime.split(':');
                const endSplit = this.sleepEndTime.split(':');
                
                const startHour = parseInt(startSplit[0], 10);
                const startMinute = parseInt(startSplit[1], 10);
                const endHour = parseInt(endSplit[0], 10);
                const endMinute = parseInt(endSplit[1], 10);

                const timeStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute);
                let timeEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute);

                if (startHour > endHour || (startHour === endHour && startMinute > endMinute)) {
                    timeEnd.setDate(timeEnd.getDate() + 1);
                }

                const currentTime = date.getTime();
                return currentTime >= timeStart.getTime() && currentTime < timeEnd.getTime();
            },

            activateSleepMode: function() {
                if (!this.sleepModeActive) {
                    this.sleepModeActive = true;
                    this.pauseSlideshow();
                    document.getElementById("photo-container").style.display = "none";
                    document.body.style.filter = "brightness(20%)";
                    document.body.classList.add('sleep-mode');
                }
            },

            deactivateSleepMode: function() {
                if (this.sleepModeActive) {
                    this.sleepModeActive = false;
                    document.body.style.filter = "brightness(100%)";
                    document.getElementById("photo-container").style.display = "grid";
                    document.body.classList.remove('sleep-mode');
                }
            },

            handleFetchError: function(error) {
                console.error("Fetch error:", error);
                if (error.message.includes('unauthorized') || error.message.includes('invalid_grant')) {
                    console.error('授權已過期，需重新授權');
                    this.accessToken = null;
                    this.refresh_token = null;
                    sessionStorage.removeItem('access_token');
                    sessionStorage.removeItem('refresh_token');
                }
            },

            init: function() {
                this.getAccessToken();
                this.initCache();
                this.initToken_refresh();
            },

            initCache: function() {
                if (this.cacheEnabled) {
                    try {
                        const albums = JSON.parse(localStorage.getItem('albums'));
                        const photos = JSON.parse(localStorage.getItem('photos'));

                        if (albums && Array.isArray(albums)) {
                            this.albums = albums;
                        }
                        if (photos && Array.isArray(photos)) {
                            this.photos = photos; 
                        }
                    } catch (error) {
                        console.error('Error parsing cached data:', error);
                        localStorage.removeItem('albums');
                        localStorage.removeItem('photos');
                    }
                }
            },

            refreshToken: function() {
                if (!this.refresh_token) return;
                const url = `https://www.googleapis.com/oauth2/v4/token?client_id=${this.CLIENT_ID}&client_secret=your_client_secret&refresh_token=${this.refresh_token}&grant_type=refresh_token`;
                
                fetch(url, {
                    method: 'POST'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to refresh token');
                    }
                    return response.json();
                })
                .then(data => {
                    sessionStorage.setItem('access_token', data.access_token);
                    this.accessToken = data.access_token;
                    console.log('Token refreshed successfully');
                })
                .catch(error => {
                    console.error('Token refresh failed:', error);
                    this.accessToken = null;
                    this.refresh_token = null;
                    sessionStorage.removeItem('access_token');
                    sessionStorage.removeItem('refresh_token');
                });
            },

            initToken_refresh: function() {
                const token = sessionStorage.getItem('access_token');
                const refresh_token = sessionStorage.getItem('refresh_token');

                if (token && refresh_token) {
                    setTimeout(() => {
                        this.refreshToken();
                    }, 3600000); // 到期前1小時
                }
            }
        };

        window.addEventListener('load', () => {
            app.init();
        });

        document.addEventListener("DOMContentLoaded", () => {
            document.getElementById("authorize-btn").onclick = app.authorizeUser.bind(app);
            document.getElementById("close-lightbox").onclick = app.closeLightbox.bind(app);
            
            document.getElementById("back-to-album-btn").onclick = () => {
                document.getElementById("photo-container").style.display = "none";
                document.getElementById("album-selection-container").style.display = "block";
            };

            document.getElementById("set-sleep-btn").onclick = app.setSleepMode.bind(app);
            document.getElementById("activate-btn").onclick = () => {
                app.sleepModeActive = !app.sleepModeActive;
                if (app.sleepModeActive) {
                    app.activateSleepMode();
                } else {
                    app.deactivateSleepMode();
                }
            };

            document.getElementById("start-slideshow-btn").addEventListener("click", function() {
                if (!app.isSlideshowPlaying) {
                    app.startSlideshow();
                    this.textContent = "停止幻燈片";
                } else {
                    app.pauseSlideshow();
                    this.textContent = "開始幻燈片";
                }
            });

            // 触控显示按钮
            let lastActiveTime = 0;
            document.addEventListener('touchstart', function() {
                if (app.isSlideshowPlaying) {
                    const buttons = document.querySelectorAll('.nav-button');
                    buttons.forEach(button => button.style.display = 'flex');
                    lastActiveTime = new Date().getTime();
                }
            }, { passive: true });

            document.addEventListener('touchend', function() {
                lastActiveTime = new Date().getTime();
            });

            document.addEventListener('mousemove', function() {
                lastActiveTime = new Date().getTime();
            });

            document.addEventListener('mouseleave', function() {
                const currentTime = new Date().getTime();
                if (currentTime - lastActiveTime > 3000 && app.isSlideshowPlaying) {
                    const buttons = document.querySelectorAll('.nav-button');
                    buttons.forEach(button => button.style.display = 'none');
                }
            });
        });
