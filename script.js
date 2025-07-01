const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  'https://www.googleapis.com/auth/photoslibrary.sharing',
].join(' ');


const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    TOKEN_CLIENT: null,
    states: {
        accessToken: null,
        albumId: "all",
        photos: [],
        currentIndex: 0,
        nextPageToken: null,
        isFetching: false,
        slideshowInterval: null,
        observer: null,
        hasMorePhotos: true,
        currentRequestId: 0,
        lightboxActive: false,
        isFullscreen: false,
        schedule: {
            sleepStart: "22:00",
            sleepEnd: "07:00",
            classStart: "08:00",
            classEnd: "17:00",
            isEnabled: true,
            useHoliday: true,
        }
    },

    async init() {
        await this.loadGapiClient();
        this.setupEventListeners();

        const token = sessionStorage.getItem("access_token");
        if (token) {
            this.states.accessToken = token;
            gapi.client.setToken({ access_token: token });
            this.loadSchedule();
            this.checkSchedule();
            setInterval(() => this.checkSchedule(), 60000);
            this.showApp();
        } else {
            document.getElementById("auth-container").style.display = "flex";
        }
    },

    async loadGapiClient() {
        return new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ['https://photoslibrary.googleapis.com/$discovery/rest?version=v1']
                    });
                  await gapi.client.load('photoslibrary', 'v1');
                    resolve();
                } catch (err) {
                    console.error('[gapi] init error', err);
                    reject(err);
                }
            });
        });
    },

    requestAccessToken() {
        this.TOKEN_CLIENT = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: SCOPES,
            prompt: 'consent',
            callback: (response) => {
                if (response && response.access_token) {
                    console.log('[GIS] Received access token');
                    this.states.accessToken = response.access_token;
                    sessionStorage.setItem("access_token", response.access_token);
                    gapi.client.setToken({ access_token: response.access_token });
                    this.loadSchedule();
                    this.checkSchedule();
                    setInterval(() => this.checkSchedule(), 60000);
                    this.showApp();
                } else {
                    alert('未取得有效授權，請再試一次');
                }
            }
        });

        this.TOKEN_CLIENT.requestAccessToken();
    },

  handleAuthError() {
  const retry = confirm("授權已過期，是否重新登入？");
  if (retry) {
    sessionStorage.removeItem("access_token");
    this.requestAccessToken(); // ✅ 改為 GIS 登入方式
  } else {
    document.getElementById("auth-container").style.display = "flex";
    document.getElementById("app-container").style.display = "none";
  }
},

loadSchedule() {
        const schedule = JSON.parse(localStorage.getItem("schedule"));
        if (schedule) {
            this.states.schedule = schedule;
        }
    },

      saveSchedule() {
        localStorage.setItem("schedule", JSON.stringify(this.states.schedule));
    },

    checkSchedule() {
       console.log("🕒 檢查排程中，目前時間 =", new Date().toLocaleTimeString());
      this.states.schedule.isEnabled = false; // ⚠️暫時停用排程防遮罩 
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const sleepStart = this.getTimeInMinutes(this.states.schedule.sleepStart);
        const sleepEnd = this.getTimeInMinutes(this.states.schedule.sleepEnd);
        const classStart = this.getTimeInMinutes(this.states.schedule.classStart);
        const classEnd = this.getTimeInMinutes(this.states.schedule.classEnd);
        const isSleepTime = this.states.schedule.isEnabled && 
            ((currentTime >= sleepStart && currentTime < sleepEnd) || 
             (currentTime >= classStart && currentTime < classEnd));

        if (isSleepTime || this.isHolidayMode(now)) {
            this.stopSlideshow();
            document.getElementById("screenOverlay").style.display = "block";
        } else {
            document.getElementById("screenOverlay").style.display = "none";
        }
    },

    isHolidayMode(date) {
        const day = date.getDay();
        return this.states.schedule.useHoliday && !this.isWeekday(date);
    },

    isWeekday(date) {
        const day = date.getDay();
        return day !== 0 && day !== 6; // 星期日和六為假日
    },

    getTimeInMinutes(time) {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
    },

    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        this.loadSchedule();
        this.checkSchedule();
        this.fetchAlbums();
    },

    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", () => {
  app.requestAccessToken(); // ✅ 在 click 事件中呼叫 GIS 授權
});

        document.getElementById("clear-token-btn").addEventListener("click", () => {
            sessionStorage.clear();
            alert("已清除登入資訊，請重新登入");
            location.reload();
        });

        document.getElementById("check-token-btn").addEventListener("click", async () => {
            const token = sessionStorage.getItem("access_token");
            if (!token) return alert("⚠️ 沒有 token，請先登入");
            const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
            const data = await res.json();
            if (data.scope) {
                alert(`✅ scope: \n${data.scope}`);
                console.log("[Token Info]", data);
            } else {
                alert("❌ token 無效或已過期");
            }
        });
        document.getElementById("album-select").addEventListener("change", (e) => {
            this.states.albumId = e.target.value;
            this.resetPhotoData();
            this.loadPhotos();
        });

       let lastTouchTime = 0;
    const lightbox = document.getElementById("lightbox");
lightbox.addEventListener("mousedown", (event) => {
    event.preventDefault();  // 阻止聚焦，避免顯示遮罩
});
    function shouldCloseLightbox(event) {
        // 排除點擊在 Lightbox 內的控制按鈕與圖片
        return !event.target.closest('.nav-button') && !event.target.closest('img');
    }

    lightbox.addEventListener("dblclick", (event) => {
        if (shouldCloseLightbox(event)) {
            this.closeLightbox();
        }
    });

    lightbox.addEventListener("touchend", (event) => {
        if (shouldCloseLightbox(event)) {
            const currentTime = new Date().getTime();
            if (currentTime - lastTouchTime < 500) {
                this.closeLightbox();
            }
            lastTouchTime = currentTime;
        }
    });
      

    document.getElementById("prev-photo").addEventListener("click", () => this.navigate(-1));
    document.getElementById("next-photo").addEventListener("click", () => this.navigate(1));
    document.getElementById("start-slideshow-btn").addEventListener("click", () => this.toggleSlideshow());
    document.getElementById("fullscreen-toggle-btn").addEventListener("click", () => this.toggleFullscreen());

    document.getElementById("play-mode").addEventListener("change", (e) => {
        if (this.states.slideshowInterval) {
            this.toggleSlideshow();
            this.toggleSlideshow();
        }
    });

    let speedTimeout;
    document.getElementById("slideshow-speed").addEventListener("input", (e) => {
        clearTimeout(speedTimeout);
        speedTimeout = setTimeout(() => {
            if (this.states.slideshowInterval) {
                this.toggleSlideshow();
                this.toggleSlideshow();
            }
        }, 500);
    });

    document.getElementById("schedule-settings-btn").addEventListener("click", () => {
        document.getElementById("schedule-modal").style.display = "block";
    });

    document.querySelector(".close-modal").addEventListener("click", () => {
        document.getElementById("schedule-modal").style.display = "none";
    });

    document.getElementById("cancel-schedule").addEventListener("click", () => {
        document.getElementById("schedule-modal").style.display = "none";
    });

    document.getElementById("save-schedule").addEventListener("click", () => {
        this.states.schedule.sleepStart = document.getElementById("sleep-start").value;
        this.states.schedule.sleepEnd = document.getElementById("sleep-end").value;
        this.states.schedule.classStart = document.getElementById("class-start").value;
        this.states.schedule.classEnd = document.getElementById("class-end").value;
        this.states.schedule.isEnabled = document.getElementById("is-enabled").checked;
        this.states.schedule.useHoliday = document.getElementById("use-holiday").checked;
        this.saveSchedule();
        document.getElementById("schedule-modal").style.display = "none";
        this.checkSchedule();
    });

     document.getElementById("check-token-btn").addEventListener("click", async () => {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    alert("⚠️ 沒有找到 access_token，請先登入");
    return;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    const data = await res.json();
    if (data.error_description || data.error) {
      alert("❌ Token 無效或已過期，請重新登入");
      console.log("[Token Info] 錯誤：", data);
    } else {
      alert(`✅ 授權範圍：\n\n${data.scope}`);
      console.log("[Token Info] 完整資訊：", data);
    }
  } catch (err) {
    console.error("[Token Info] 無法檢查 token", err);
    alert("🚫 檢查失敗，請查看 Console");
  }
});
 
},

    async fetchAlbums() {
        const token = this.states.accessToken;
    console.log("[API] 準備使用 token 呼叫 API:", token?.substring(0, 20) + "...");

    try {
        const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error("[API] Google Photos 回應錯誤，狀態碼:", response.status);
            console.error("[API] 回應內容:", responseText);

            if (response.status === 401) {
                alert("Token 已過期，請重新登入");
                return this.requestAccessToken();
            }
            if (response.status === 403) {
                // 權限不足，強制重新授權
                alert("授權範圍不足，請重新登入並確認 Photos Library 權限");
                sessionStorage.removeItem("access_token");
                return this.requestAccessToken();
            }
            throw new Error("無法取得相簿資料");
        }

        console.log("[API] 成功取得相簿 JSON：", responseText);
                const data = await response.json();
        console.log("[API] 相簿資料 JSON 解析：", data);
        this.renderAlbumSelect(data.albums || []);
        this.loadPhotos();

    } catch (error) {
        console.error("[API] fetchAlbums 發生錯誤:", error);
        this.handleAuthError();
    }
},

    renderAlbumSelect(albums) {
        const select = document.getElementById("album-select");
        select.innerHTML = '<option value="all">所有相片</option>';
        albums.forEach(album => {
            const option = document.createElement("option");
            option.value = album.id;
            option.textContent = album.title;
            select.appendChild(option);
        });
    },

    async loadPhotos() {
        if (this.states.isFetching || !this.states.hasMorePhotos) return;

        const requestId = ++this.states.currentRequestId;
        this.states.isFetching = true;
        document.getElementById("loading-indicator").style.display = "block";

        try {
            const body = {
                pageSize: 100,
                pageToken: this.states.nextPageToken || undefined
            };

            if (this.states.albumId !== "all") {
                body.albumId = this.states.albumId;
            } else {
                body.filters = { includeArchivedMedia: true };
            }

            const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.states.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('照片加載失敗');
            const data = await response.json();

            if (requestId !== this.states.currentRequestId) return;

            const existingIds = new Set(this.states.photos.map(p => p.id));
            const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
            if (!mediaItems.length) {
             console.warn("⚠️ Google Photos API 回傳空的 mediaItems：", data);
            this.states.hasMorePhotos = false; // 🔴 強制終止滾動載入
            }

            const newPhotos = mediaItems.filter(item => item && !existingIds.has(item.id));
            this.states.photos = [...this.states.photos, ...newPhotos];
            this.states.nextPageToken = data.nextPageToken || null;
            this.states.hasMorePhotos = !!this.states.nextPageToken;

            this.renderPhotos();
        } catch (error) {
            console.error("照片加載失敗:", error);
            this.showMessage("加載失敗，請檢查網路連線");
        } finally {
            if (requestId === this.states.currentRequestId) {
                this.states.isFetching = false;
                document.getElementById("loading-indicator").style.display = "none";
                this.setupScrollObserver();
            }
        }
    },

    renderPhotos() {
        const container = document.getElementById("photo-container");
        container.style.display = "grid";
  container.innerHTML = this.states.photos.map(photo => {
    if (!photo.baseUrl) {
        console.warn("⚠️ 忽略無效相片（缺少 baseUrl）：", photo);
        return ''; // 跳過這張圖
    }
    return `
        <img class="photo" 
             src="${this.getImageUrl(photo, 150, 150)}"
             data-src="${this.getImageUrl(photo, 800, 600)}"
             alt="相片" 
             data-id="${photo.id}"
             onclick="app.openLightbox('${photo.id}')">
    `;
}).join("");
       console.log("📸 載入照片數量：", this.states.photos.length);
       console.log("📸 第 1 張：", this.states.photos[0]);
        
      if (!this.states.hasMorePhotos && this.states.photos.length > 0) {
            container.insertAdjacentHTML("beforeend", `<p class="empty-state">已無更多相片</p>`);
        }

        this.setupLazyLoad();
        this.setupScrollObserver();
    container.addEventListener('click', () => {
            if (this.states.slideshowInterval !== null) {
                this.stopSlideshow();
            }
        });
    },

    setupLazyLoad() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (!img.src.includes('w800')) {
                        img.src = img.dataset.src;
                    }
                    observer.unobserve(img);
                }
            });
        }, { 
            rootMargin: "200px 0px",
            threshold: 0.01 
        });

        document.querySelectorAll(".photo:not([data-loaded])").forEach(img => {
            observer.observe(img);
            img.setAttribute('data-loaded', 'true');
        });
    },

    setupScrollObserver() {
        if (this.states.observer) this.states.observer.disconnect();

        this.states.observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && 
                        this.states.hasMorePhotos &&
                        !this.states.isFetching) {
                        setTimeout(() => this.loadPhotos(), 300);
                    }
                });
            },
            {
                root: document.querySelector('#scroll-container'),
                rootMargin: '400px 0px',
                threshold: 0.1
            }
        );

        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        document.getElementById('photo-container').appendChild(sentinel);
        this.states.observer.observe(sentinel);
    },

    getImageUrl(photo, width = 1920, height = 1080) {
    if (!photo || !photo.baseUrl) {
        console.warn("⚠️ 無效的照片物件：", photo);
        return "";
    }

    const url = photo.baseUrl;
    const hasQuery = url.includes("?");
    const delimiter = hasQuery ? "&" : "=";

    return `${url}${delimiter}w${width}-h${height}`;
},

    openLightbox(photoId) {
        this.states.currentIndex = this.states.photos.findIndex(p => p.id === photoId);
        const lightbox = document.getElementById("lightbox");
        const image = document.getElementById("lightbox-image");
        
        image.src = this.getImageUrl(this.states.photos[this.states.currentIndex]);

        image.onload = () => {
            const isSlideshowActive = this.states.slideshowInterval !== null;
            image.style.maxWidth = isSlideshowActive ? '99%' : '90%';
            image.style.maxHeight = isSlideshowActive ? '99%' : '90%';
            lightbox.style.display = "flex";
            setTimeout(() => {
                lightbox.style.opacity = 1;
                this.states.lightboxActive = true;
                this.toggleButtonVisibility();
            }, 10);
        };
    },

    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
        lightbox.style.opacity = 0;
        setTimeout(() => {
            lightbox.style.display = "none";
            this.states.lightboxActive = false;
            this.toggleButtonVisibility();
        }, 300);
        this.stopSlideshow();
    },

    navigate(direction) {
        this.states.currentIndex = (this.states.currentIndex + direction + this.states.photos.length) % this.states.photos.length;
        document.getElementById("lightbox-image").src = 
            this.getImageUrl(this.states.photos[this.states.currentIndex]);
    },

    toggleSlideshow() {
        if (this.states.slideshowInterval) {
            this.stopSlideshow();
        } else {
            const speed = document.getElementById("slideshow-speed").value * 1000 || 1000;
            const isRandom = document.getElementById("play-mode").value === "random";

            const getNextIndex = () => {
                if (isRandom) {
                    let nextIndex;
                    do {
                        nextIndex = Math.floor(Math.random() * this.states.photos.length);
                    } while (nextIndex === this.states.currentIndex && this.states.photos.length > 1);
                    return nextIndex;
                }
                return (this.states.currentIndex + 1) % this.states.photos.length;
            };

            this.states.slideshowInterval = setInterval(() => {
                this.states.currentIndex = getNextIndex(); 
                this.navigate(0); 
            }, speed);
        }
        this.toggleButtonVisibility();
    },

    stopSlideshow() {
        clearInterval(this.states.slideshowInterval);
        this.states.slideshowInterval = null;
        this.toggleButtonVisibility();
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('全螢幕錯誤:', err);
            });
        } else {
            document.exitFullscreen();
        }
        this.toggleButtonVisibility();
    },

    toggleButtonVisibility() {
        const isSlideshowOrFullscreen = this.states.slideshowInterval !== null || this.states.isFullscreen;
        const buttons = document.querySelectorAll('.lightbox-buttons .nav-button');
        buttons.forEach(button => {
            button.style.display = isSlideshowOrFullscreen ? 'none' : 'block';
        });
    },

    resetPhotoData() {
        this.states.currentRequestId++;
        this.states.photos = [];
        this.states.nextPageToken = null;
        this.states.hasMorePhotos = true;
        document.getElementById("photo-container").innerHTML = '';
        this.setupScrollObserver();
    },

    showMessage(message) {
        const container = document.getElementById("photo-container");
        const messageElement = document.createElement("p");
        messageElement.className = "empty-state";
        messageElement.textContent = message;
        container.appendChild(messageElement);
    }
};

document.addEventListener("DOMContentLoaded", () => app.init());
