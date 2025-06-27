// 完整整合後的 script.js
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
  'https://www.googleapis.com/auth/photoslibrary.sharing'
].join(' ');

const app = {
  CLIENT_ID: '1004388657829-mvpott95dsl5bapu40vi2n5li7i7t7d1.apps.googleusercontent.com',
  REDIRECT_URI: window.location.origin + window.location.pathname,
  states: {
    accessToken: null,
    albumId: 'all',
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
      sleepStart: '22:00',
      sleepEnd: '07:00',
      classStart: '08:00',
      classEnd: '17:00',
      isEnabled: true,
      useHoliday: true
    }
  },

  async init() {
    this.setupEventListeners();
    await this.loadGapiClient();
    this.initClock();

    const authed = await this.checkAuth();
    if (authed) {
      this.loadSchedule();
      this.checkSchedule();
      setInterval(() => this.checkSchedule(), 60000);
      this.showApp();
    } else {
      document.getElementById('auth-container').style.display = 'flex';
    }
  },

  initClock() {
    const clock = document.getElementById('clock');
    const update = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      clock.textContent = `${hh}:${mm}`;
      clock.style.display = 'block';
    };
    update();
    setInterval(update, 60000);
  },

  async loadGapiClient() {
    return new Promise((resolve, reject) => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: ['https://photoslibrary.googleapis.com/$discovery/rest?version=v1']
          });
          resolve();
        } catch (err) {
          console.error('[gapi] init error', err);
          reject(err);
        }
      });
    });
  },

  handleAuthFlow() {
    const authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'false',
      prompt: 'consent',
      state: 'auth_redirect'
    });
    window.location.href = `${authEndpoint}?${params.toString()}`;
  },

  async checkAuth() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has('access_token')) {
      const token = hashParams.get('access_token');
      this.states.accessToken = token;
      sessionStorage.setItem('access_token', token);
      gapi.client.setToken({ access_token: token });
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }

    const storedToken = sessionStorage.getItem('access_token');
    if (storedToken) {
      this.states.accessToken = storedToken;
      gapi.client.setToken({ access_token: storedToken });
      try {
        await gapi.client.load('photoslibrary', 'v1');
        return true;
      } catch (err) {
        sessionStorage.removeItem('access_token');
        return false;
      }
    }
    return false;
  },

  handleAuthError() {
    const retry = confirm('授權已過期，是否重新登入？');
    if (retry) {
      sessionStorage.removeItem('access_token');
      this.handleAuthFlow();
    } else {
      document.getElementById('auth-container').style.display = 'flex';
      document.getElementById('app-container').style.display = 'none';
    }
  },

  showApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    this.fetchAlbums();
  },

  setupEventListeners() {
    document.getElementById('authorize-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.handleAuthFlow();
    });

    document.getElementById('clear-token-btn').addEventListener('click', () => {
      sessionStorage.clear();
      alert('已清除登入資訊，請重新登入');
      location.reload();
    });

    document.getElementById('check-token-btn').addEventListener('click', async () => {
      const token = sessionStorage.getItem('access_token');
      if (!token) return alert('⚠️ 沒有 token，請先登入');
      const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
      const data = await res.json();
      if (data.scope) {
        alert(`✅ scope:\n${data.scope}`);
        console.log('[Token Info]', data);
      } else {
        alert('❌ token 無效或已過期');
      }
    });

    document.getElementById('start-slideshow-btn').addEventListener('click', () => this.toggleSlideshow());
    document.getElementById('fullscreen-toggle-btn').addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('prev-photo').addEventListener('click', () => this.navigate(-1));
    document.getElementById('next-photo').addEventListener('click', () => this.navigate(1));
  },

  navigate(direction) {
    const total = this.states.photos.length;
    if (total === 0) return;
    this.states.currentIndex = (this.states.currentIndex + direction + total) % total;
    this.openLightbox(this.states.photos[this.states.currentIndex].id);
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  },

  saveSchedule() {
    localStorage.setItem('schedule', JSON.stringify(this.states.schedule));
  },

  loadSchedule() {
    const schedule = JSON.parse(localStorage.getItem('schedule'));
    if (schedule) {
      this.states.schedule = schedule;
    }
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
      document.getElementById('screenOverlay').style.display = 'block';
    } else {
      document.getElementById('screenOverlay').style.display = 'none';
    }
  },

  isHolidayMode(date) {
    const day = date.getDay();
    return this.states.schedule.useHoliday && (day === 0 || day === 6);
  },

  getTimeInMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  },

    async fetchAlbums() {
    try {
      const res = await fetch("https://photoslibrary.googleapis.com/v1/albums?pageSize=50", {
        headers: {
          Authorization: `Bearer ${this.states.accessToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '相簿載入失敗');
      this.renderAlbumSelect(data.albums || []);
      this.loadPhotos();
    } catch (e) {
      console.error('取得相簿錯誤:', e);
      this.handleAuthError();
    }
  },

  renderAlbumSelect(albums) {
    const select = document.getElementById('album-select');
    select.innerHTML = '<option value="all">所有相片</option>';
    albums.forEach(album => {
      const option = document.createElement('option');
      option.value = album.id;
      option.textContent = album.title;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      this.states.albumId = select.value;
      this.resetPhotoData();
      this.loadPhotos();
    });
  },

  async loadPhotos() {
    if (this.states.isFetching || !this.states.hasMorePhotos) return;
    this.states.isFetching = true;
    const container = document.getElementById('photo-container');
    document.getElementById('loading-indicator').style.display = 'block';

    try {
      const body = {
        pageSize: 100,
        pageToken: this.states.nextPageToken || undefined
      };
      if (this.states.albumId !== 'all') {
        body.albumId = this.states.albumId;
      } else {
        body.filters = { includeArchivedMedia: true };
      }
      const res = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.states.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '照片載入失敗');

      const newPhotos = data.mediaItems || [];
      this.states.photos = [...this.states.photos, ...newPhotos];
      this.states.nextPageToken = data.nextPageToken || null;
      this.states.hasMorePhotos = !!this.states.nextPageToken;
      this.renderPhotos();
    } catch (e) {
      console.error('載入相片錯誤:', e);
    } finally {
      this.states.isFetching = false;
      document.getElementById('loading-indicator').style.display = 'none';
    }
  },

  renderPhotos() {
    const container = document.getElementById('photo-container');
    container.innerHTML = '';
    this.states.photos.forEach(photo => {
      const img = document.createElement('img');
      img.className = 'photo';
      img.src = `${photo.baseUrl}=w300-h300`;
      img.dataset.src = `${photo.baseUrl}=w800-h600`;
      img.alt = '相片';
      img.addEventListener('click', () => this.openLightbox(photo.id));
      container.appendChild(img);
    });
  },

  openLightbox(photoId) {
    const index = this.states.photos.findIndex(p => p.id === photoId);
    if (index < 0) return;
    this.states.currentIndex = index;
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-image');
    img.src = `${this.states.photos[index].baseUrl}=w1920-h1080`;
    lightbox.style.display = 'flex';
  },

  closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
  },

  toggleSlideshow() {
    if (this.states.slideshowInterval) {
      this.stopSlideshow();
    } else {
      const val = parseInt(document.getElementById('slideshow-speed').value);
      const speed = (isNaN(val) || val < 1 ? 5 : val) * 1000;
      const isRandom = document.getElementById('play-mode').value === 'random';
      this.states.slideshowInterval = setInterval(() => {
        if (isRandom) {
          let next;
          do {
            next = Math.floor(Math.random() * this.states.photos.length);
          } while (next === this.states.currentIndex && this.states.photos.length > 1);
          this.states.currentIndex = next;
        } else {
          this.states.currentIndex = (this.states.currentIndex + 1) % this.states.photos.length;
        }
        this.openLightbox(this.states.photos[this.states.currentIndex].id);
      }, speed);
    }
  },

  stopSlideshow() {
    clearInterval(this.states.slideshowInterval);
    this.states.slideshowInterval = null;
  },

  resetPhotoData() {
    this.states.photos = [];
    this.states.nextPageToken = null;
    this.states.hasMorePhotos = true;
    document.getElementById('photo-container').innerHTML = '';
  }

};

document.addEventListener('DOMContentLoaded', () => app.init());
