const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.sharing'
].join(' ');

const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES,
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

 // 1. 改為 async init，並先載入 gapi client
async init() {
  await this.loadGapiClient();

  // 優先從 sessionStorage 或 hash 取 token
  this.states.accessToken = sessionStorage.getItem("access_token");
  this.setupEventListeners();
  const ok = await this.checkAuth();
  if (!ok) {
  document.getElementById("auth-container").style.display = "flex";
} else {
  const grantedScopes = gapi.auth2.getAuthInstance().currentUser.get().getGrantedScopes();
  if (!grantedScopes.includes('https://www.googleapis.com/auth/photoslibrary.readonly')) {
    alert('目前授權範圍不足，請重新登入以取得完整權限');
    sessionStorage.removeItem("access_token");
    return this.handleAuthFlow();
  }

  this.loadSchedule();
  this.checkSchedule();
  setInterval(() => this.checkSchedule(), 60000);
  }
},

   // 2. 新增 method：載入並初始化 gapi client
   async loadGapiClient() {
     return new Promise((resolve, reject) => {
       // 載入 client library
       gapi.load('client', async () => {
         try {
           // 初始化 client，告訴它要用哪個 API
           await gapi.client.init({
             discoveryDocs: [
              'https://photoslibrary.googleapis.com/$discovery/rest?version=v1'
             ]
           });
           await gapi.auth2.init({
  client_id: this.CLIENT_ID
});
           resolve();
         } catch (err) {
           console.error('[gapi] init 錯誤', err);
           reject(err);
         }
       });
     });
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

async handleAuthFlow() {
  // 1. 清除舊 token
  sessionStorage.removeItem("access_token");
  this.states.accessToken = null;

  // 2. 組成 OAuth2 授權 URL
  const authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = new URLSearchParams({
    client_id: this.CLIENT_ID,
    redirect_uri: this.REDIRECT_URI,
    response_type: "token",
    scope: this.SCOPES,
    include_granted_scopes: "true", // 不延續舊授權
    prompt: "consent",               // 每次都跳出勾選視窗
    state: "pass-through-value"
  });

  console.log("[OAuth] 導向 Google 取得新 token，scope =", this.SCOPES);
  window.location.href = `${authEndpoint}?${params.toString()}`;
},

async checkAuth() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  if (hashParams.has("access_token")) {
    const token = hashParams.get("access_token");
    console.log("獲得新 Token:", token);  // 日誌獲得的新Token
    this.states.accessToken = token;
    sessionStorage.setItem("access_token", token);

    // 一定要讓 gapi.client 帶上這個 token，才能用 gapi.client.* 系列呼叫 API
    gapi.client.setToken({ access_token: token });

    // 清掉 URL hash，避免重複處理
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }

  const storedToken = sessionStorage.getItem("access_token");
  console.log("使用儲存的 Token:", storedToken);
  if (storedToken) {
    this.states.accessToken = storedToken;
    gapi.client.setToken({ access_token: storedToken });

    try {
      await gapi.client.load("photoslibrary", "v1");
      return true;
    } catch (err) {
      sessionStorage.removeItem("access_token");
      return false;
    }
  }

  // 沒 token → 開始 OAuth 流程
  this.handleAuthFlow();
  return false;
},
    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
        this.loadSchedule();
        this.checkSchedule();
        this.fetchAlbums();
    },

    setupEventListeners() {
        document.getElementById("authorize-btn").addEventListener("click", (e) => {
            e.preventDefault();
            this.handleAuthFlow();
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
                // Token 真正過期
                return this.handleAuthFlow();
            }
            if (response.status === 403) {
                // 權限不足，強制重新授權
                alert("授權範圍不足，請重新登入並確認 Photos Library 權限");
                sessionStorage.removeItem("access_token");
                return this.handleAuthFlow();
            }
            throw new Error("無法取得相簿資料");
        }

        console.log("[API] 成功取得相簿 JSON：", responseText);
        const data = JSON.parse(responseText);
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
            const newPhotos = data.mediaItems.filter(item => item && !existingIds.has(item.id));

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
        container.innerHTML = this.states.photos.map(photo => `
            <img class="photo" 
                 src="${photo.baseUrl}=w150-h150"
                 data-src="${photo.baseUrl}=w800-h600"
                 alt="相片" 
                 data-id="${photo.id}"
                 onclick="app.openLightbox('${photo.id}')">
        `).join("");

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
            console.error("无效的照片对象:", photo);
            return "";
        }
        return `${photo.baseUrl}=w${width}-h${height}`;
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

handleAuthError() {
  const retry = confirm("授權已過期，是否重新登入？");
  if (retry) {
    sessionStorage.removeItem("access_token");
    this.handleAuthFlow();
  } else {
    document.getElementById("auth-container").style.display = "flex";
    document.getElementById("app-container").style.display = "none";
  }
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

