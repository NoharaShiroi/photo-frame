const app = {
    CLIENT_ID: "1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com",
    REDIRECT_URI: "https://noharashiroi.github.io/photo-frame/",
    SCOPES: "https://www.googleapis.com/auth/photoslibrary.readonly",

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
            isEnabled: false,
            useHoliday: false,
         },
        loadedCount: 0, // 新增变量来追踪已加载的照片数量
        slideshowPhotoIds: [] // 新增用于追踪幻灯片中显示的照片 ID
         },
      
    init() {
        this.states.accessToken = sessionStorage.getItem("access_token");
        this.setupEventListeners();
        if (!this.checkAuth()) {
            document.getElementById("auth-container").style.display = "flex";
        } else {
            this.loadSchedule();
            this.checkSchedule();
            this.loadPhotos(); // 初始加载照片
            setInterval(() => this.checkSchedule(), 60000);
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

    handleAuthFlow() {
        const authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
        const params = {
            client_id: this.CLIENT_ID,
            redirect_uri: this.REDIRECT_URI,
            response_type: 'token',
            scope: this.SCOPES,
            include_granted_scopes: 'true',
            state: 'pass-through-value',
            prompt: 'consent'
        };
        window.location.href = authEndpoint + '?' + new URLSearchParams(params);
    },

    checkAuth() {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.has("access_token")) {
            this.states.accessToken = hashParams.get("access_token");
            sessionStorage.setItem("access_token", this.states.accessToken);
            window.history.replaceState({}, "", window.location.pathname);
            this.showApp();
            return true;
        }
        return false;
    },

    showApp() {
        document.getElementById("auth-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";
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
const lightbox = document.getElementById("lightbox");
lightbox.addEventListener("dblclick", (event) => {
    if (shouldCloseLightbox(event)) {
        this.closeLightbox(); // 调用关闭lightbox函数
    }
});

// Prevents clicking on the image from interfering with the double click logic
lightbox.addEventListener("mousedown", (event) => {
    event.preventDefault();  // 阻止默认行为避免显示遮罩
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
        try {
            const response = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
                headers: { "Authorization": `Bearer ${this.states.accessToken}` }
            });
            if (!response.ok) throw new Error('無法取得相簿');
            const data = await response.json();
            this.renderAlbumSelect(data.albums || []);
            this.loadPhotos();
        } catch (error) {
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
            pageSize: 100, // 每次加载 100 张照片
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
        this.states.loadedCount += newPhotos.length; // 更新已加载数量

        this.renderPhotos();

        // 如果幻灯片开始播放，并且当前选中的相册照片未加载完，自动加载更多
        if (this.states.slideshowInterval && (this.states.loadedCount < 100 || this.states.hasMorePhotos)) {
            this.checkForMorePhotos();
        }
    } catch (error) {
        console.error("照片加載失敗:", error);
        this.showMessage("加載失敗，請檢查網路連線");
    } finally {
        if (requestId === this.states.currentRequestId) {
            this.states.isFetching = false;
            document.getElementById("loading-indicator").style.display = "none";

            // 停止自动加载时的清理操作
            if (!this.states.hasMorePhotos) {
                this.stopAutoLoad(); // 停止自动加载
            }
        }
    }
},

checkForMorePhotos() {
        // 检查是否需要加载更多照片
    if (this.states.loadedCount < 99999999 && this.states.hasMorePhotos) { // 少于 99999999 张且有更多照片自动加载
        this.loadPhotos();
    }
},

stopAutoLoad() {
    // 在所有照片加载完成时停止调用 loadPhotos
    clearTimeout(this.autoLoadTimeout); // 清理任何已设定的超时
    this.autoLoadTimeout = null; // 重置超时
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

        // 加载完全部照片后，启动循环播放模式
        if (!this.states.hasMorePhotos && this.states.photos.length > 0 && this.states.slideshowInterval === null) {
            this.toggleSlideshow();
        }
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
            this.states.lightboxActive = true; // 设置为active状态
            this.toggleButtonVisibility();
        }, 10);
    };
},

    closeLightbox() {
        const lightbox = document.getElementById("lightbox");
    lightbox.style.opacity = 0;
    setTimeout(() => {
        lightbox.style.display = "none"; // 隐藏lightbox
        this.states.lightboxActive = false; // 设置为非active状态
        this.toggleButtonVisibility();
        this.stopSlideshow(); // 确保停止幻灯片播放
    }, 300);
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
                let nextIndex;
                if (isRandom) {
                    do {
                        nextIndex = Math.floor(Math.random() * this.states.photos.length);
                    } while (this.states.slideshowPhotoIds.includes(this.states.photos[nextIndex].id)); // 确保不重复
                    this.states.slideshowPhotoIds.push(this.states.photos[nextIndex].id);
                    if (this.states.slideshowPhotoIds.length >= this.states.photos.length) {
                        this.states.slideshowPhotoIds = []; // 如果所有图片都已经播放过，重置
                    }
                } else {
                    nextIndex = (this.states.currentIndex + 1) % this.states.photos.length;
                }
                return nextIndex;
            };

            this.states.slideshowInterval = setInterval(() => {
                this.states.currentIndex = getNextIndex(); 
                this.navigate(0);
                this.checkForMorePhotos(); // 检查并加载更多
            }, speed);
        }
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
            window.location.reload();
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
