(function () {

    let allSources = [];
    let sources = [];
    let currentIndex = 0;

    document.querySelectorAll('.koz-like-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            console.log('Like button clicked via event listener!');
            e.stopPropagation();
            toggleLike(this);
        });
    });

    // Device detection - show only on mobile
    function isMobileDevice() {
        return (window.innerWidth <= 768) ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Function to close the video reel
    window.closeVideoReel = function () {
        const container = document.querySelector('.koz-video-reel-container');
        if (container) {
            // Pause all videos
            const videos = container.querySelectorAll('video');
            videos.forEach(video => video.pause());

            // Hide container
            container.style.visibility = 'hidden';
            container.style.height = '0';

            // Additional cleanup if needed
            const placeholder = document.querySelector('.koz-video-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }
    };

    // Cookie functions
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function setCookie(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
    }

    // Like Manager - New Improved Implementation
    const likeManager = {
        likes: {},
        pending: {},

        // Initialize like states
        init(videos) {
            videos.forEach(video => {
                const videoId = video.id.toString();
                const likedVideos = JSON.parse(getCookie('koz_liked_videos')) || [];

                this.likes[videoId] = {
                    count: video.likes || 0,
                    isLiked: likedVideos.includes(videoId)
                };
            });
        },

        // Update like state
        async toggle(videoId, element) {
            videoId = videoId.toString();

            // Prevent duplicate requests
            if (this.pending[videoId]) return;
            this.pending[videoId] = true;

            const currentState = this.likes[videoId] || { count: 0, isLiked: false };
            const newLikedState = !currentState.isLiked;
            const change = newLikedState ? 1 : -1;

            // Optimistic UI update
            this.updateUI(videoId, element, {
                count: currentState.count + change,
                isLiked: newLikedState
            });

            try {
                const response = await fetch('https://golfreich.com/wp-json/custom-api/v1/video-likes/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        video_id: parseInt(videoId),
                        change: change
                    })
                });

                if (!response.ok) throw new Error('Like update failed');

                const data = await response.json();

                // Update with server-confirmed data
                this.likes[videoId] = {
                    count: data.likes,
                    isLiked: newLikedState
                };

                // Update cookie
                this.updateCookie(videoId, newLikedState);

            } catch (error) {
                console.error('Like error:', error);
                // Revert UI on error
                this.updateUI(videoId, element, currentState);
            } finally {
                delete this.pending[videoId];
            }
        },

        updateUI(videoId, element, state) {
            this.likes[videoId] = state;

            if (element) {
                const btn = element.classList.contains('koz-like-btn') ? element : element.closest('.koz-like-btn');
                const container = element.closest('.koz-video-like-container');
                const countEl = container ? container.querySelector('.koz-like-count') : null;

                if (btn) btn.classList.toggle('active', state.isLiked);
                if (countEl) countEl.textContent = state.count;
            }
        },

        updateCookie(videoId, isLiked) {
            let likedVideos = JSON.parse(getCookie('koz_liked_videos') || '[]');

            if (isLiked && !likedVideos.includes(videoId)) {
                likedVideos.push(videoId);
            } else if (!isLiked) {
                likedVideos = likedVideos.filter(id => id !== videoId);
            }

            setCookie('koz_liked_videos', JSON.stringify(likedVideos));
        },

        getLikeState(videoId) {
            return this.likes[videoId.toString()] || { count: 0, isLiked: false };
        }
    };

    // New toggleLike function
    window.toggleLike = function (element) {

        // Stop event propagation
        event.stopPropagation();
        // Prevent double-tap zoom
        event.preventDefault();

        console.log("Like button clicked!", element);

        const videoWrapper = element.closest('.koz-video-wrapper');
        const video = videoWrapper.querySelector('.koz-video');
        const videoId = video.getAttribute('data-id');

        if (videoId) {
            likeManager.toggle(videoId, element);
        }

        // Return false to prevent any default behavior
        return false;
    };

    // Don't initialize on non-mobile devices
    if (!isMobileDevice()) {
        console.log("Video reel disabled on non-mobile device");
        return;
    }

    // Make container display block for mobile devices
    const container = document.querySelector('.koz-video-reel-container');
    if (container) {
        container.style.display = 'block';
    }

    // Create a placeholder element that will be observed instead
    const placeholder = document.createElement('div');
    placeholder.className = 'koz-video-placeholder';
    placeholder.style.cssText = 'width: 100%; height: 50px; visibility: visible;';

    // Add placeholder near the container
    if (container) {
        container.parentNode.insertBefore(placeholder, container);
    }

    // Improved Intersection Observer setup
    const observer = new IntersectionObserver(function (entries) {
        const entry = entries[0];
        if (entry.isIntersecting) {
            kozInitVideoReel();
            observer.disconnect(); // Only trigger once
        }
    }, {
        threshold: 0.1,
        rootMargin: '200px' // Start loading earlier
    });

    // Start observing the placeholder instead of the hidden container
    observer.observe(placeholder);

    // Function to initialize the video reel
    function kozInitVideoReel() {
        const container = document.querySelector('.koz-video-reel-container');
        if (!container) return;

        // Make container visible
        container.style.visibility = 'visible';
        container.style.height = '100vh';

        // Initialize the app with slight delay to allow transition
        setTimeout(initApp, 100);
    }

    // Global togglePlayPause function for onclick
    window.togglePlayPause = function (element) {
        const wrapper = element.closest('.koz-video-wrapper');
        const video = wrapper.querySelector('.koz-video');

        if (video.paused) {
            video.play().catch(e => console.log("Play failed:", e));
        } else {
            video.pause();
        }
    };

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
    }

    // Main app initialization
    function initApp() {
        // Constants
        const SPEED = 350;
        const MOVED = 33;
        const START = 10;
        const LAYER = { BACK: 1, FRONT: 2 };

        // DOM elements
        let above = document.getElementById('koz-wrapper1');
        let front = document.getElementById('koz-wrapper2');
        let below = document.getElementById('koz-wrapper3');
        let group = [above, front, below];
        let loader = document.getElementById('koz-loader');

        // State management
        let pos = {
            slide: false,
            startY: 0,
            currentY: 0,
            isScrolling: false
        };
        let tapTimer;

        // Fetch videos from API
        function fetchVideos() {
            loader.style.display = 'flex'; // Show loader while fetching

            fetch('https://golfreich.com/wp-json/custom-api/v1/videos/?description=ReelVid')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data && data.length > 0) {
                        // Format the data to match our expected structure
                        allSources = data.map(video => ({
                            id: video.id,
                            i: '', // No image placeholder since we're using video posters
                            v: video.url,
                            title: video.title,
                            caption: video.caption,
                            likes: video.likes,
                            created_at: formatDate(video.date)
                        }));

                        shuffleArray(allSources); // Randomize the order
                        likeManager.init(allSources); // Initialize like states

                        // Only load first 3 videos initially
                        sources = allSources.slice(0, 3);

                        // Initialize the app with the fetched videos
                        init();
                    } else {
                        console.error('No videos found in API response');
                        loader.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error fetching videos:', error);
                    loader.style.display = 'none';
                });
        }

        // Format date from API to more readable format
        function formatDate(dateString) {
            const date = new Date(dateString);
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        }

        // Initialize the app
        function init() {
            // Hide loader when first video loads
            const firstVideo = front.querySelector('.koz-video');
            firstVideo.addEventListener('loadeddata', () => {
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500); // Keep it visible a bit longer for better UX
            }, { once: true });

            // Initialize link handling
            initLinkHandling();

            group.forEach((wrapper) => {
                const video = wrapper.querySelector('.koz-video');
                const btn = wrapper.querySelector('.koz-play-pause-btn');

                // Touch events
                wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
                wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
                wrapper.addEventListener('touchend', handleTouchEnd);

                // Video events
                video.addEventListener('loadedmetadata', () => {
                    video.currentTime = video.duration * START / 100;
                    updateVideoTitle(wrapper);
                });

                video.addEventListener('error', () => {
                    console.error(`Video '${video.currentSrc}' failed to load`);
                });

                video.addEventListener('canplay', () => {
                    if (front === wrapper) {
                        video.play().catch(e => console.log("Autoplay prevented:", e));
                        updatePlayPauseButton(wrapper, false);
                    }
                });

                video.addEventListener('play', () => updatePlayPauseButton(wrapper, false));
                video.addEventListener('pause', () => updatePlayPauseButton(wrapper, true));

                // Click handler for play/pause button
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePlayPause(wrapper);
                });
            });

            // Mouse events for desktop
            document.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Keyboard navigation
            document.addEventListener('keydown', handleKeyDown);

            // Load initial videos
            load(front, 0);
            load(above, sources.length - 1);
            load(below, 1);
        }

        // Load video into wrapper
        function load(wrapper, idx) {
            const video = wrapper.querySelector('.koz-video');
            const source = document.createElement('source');
            source.src = sources[idx].v;
            source.type = 'video/mp4';

            // Clear existing sources
            while (video.firstChild) {
                video.removeChild(video.firstChild);
            }

            video.appendChild(source);
            video.removeAttribute('poster');
            video.setAttribute('data-idx', idx);
            video.setAttribute('data-id', sources[idx].id);
            video.load();

            // Update like button for this video
            const videoId = sources[idx].id.toString();
            const likeState = likeManager.getLikeState(videoId);
            const likeBtn = wrapper.querySelector('.koz-like-btn');
            const likeCount = wrapper.querySelector('.koz-like-count');

            if (likeBtn && likeCount) {
                likeBtn.classList.toggle('active', likeState.isLiked);
                likeCount.textContent = likeState.count;
            }

            updateVideoTitle(wrapper);
        }

        // Update video title and metadata
        function updateVideoTitle(wrapper) {
            const video = wrapper.querySelector('.koz-video');
            const titleElement = wrapper.querySelector('.koz-video-title');
            const dateElement = wrapper.querySelector('.koz-video-date');
            const captionElement = wrapper.querySelector('.koz-video-caption');

            if (titleElement && video) {
                const idx = parseInt(video.getAttribute('data-idx'));
                if (!isNaN(idx) && sources[idx]) {
                    const videoData = sources[idx];

                    titleElement.textContent = videoData.title;
                    dateElement.textContent = videoData.created_at;
                    captionElement.innerHTML = videoData.caption;

                    wrapper.querySelectorAll('.koz-video-caption a').forEach(link => {
                        link.addEventListener('click', function (e) {
                            e.stopPropagation();
                            console.log('Link clicked:', this.href);
                            //                             window.open(this.href, '_blank');
                            window.location.href = this.href;
                            return false;
                        });
                    });
                }
            }
        }


        // Touch event handlers
        function handleTouchStart(e) {
            // Don't handle touch events if we're clicking the like button
            if (e.target.closest('.koz-like-btn') || e.target.classList.contains('koz-like-btn') || e.target.tagName === 'A' || e.target.closest('a')) {
                return; // Let the click event handle it
            }

            pos.startY = e.touches[0].clientY;
            pos.currentY = pos.startY;
            pos.isScrolling = false;

            tapTimer = setTimeout(() => {
                pos.isScrolling = true;
                startSlide();
            }, 200);

            e.preventDefault();
        }

        function handleTouchMove(e) {
            if (!pos.isScrolling && Math.abs(e.touches[0].clientY - pos.startY) > 10) {
                clearTimeout(tapTimer);
                pos.isScrolling = true;
                startSlide();
            }

            if (pos.isScrolling) {
                pos.currentY = e.touches[0].clientY;
                updateSlidePosition();
                e.preventDefault();
            }
        }

        function handleTouchEnd() {
            clearTimeout(tapTimer);

            if (!pos.isScrolling) {
                togglePlayPause(front);
            } else if (pos.slide) {
                endSlide();
            }
        }

        // Mouse event handlers
        function handleMouseDown(e) {
            pos.startY = e.clientY;
            pos.currentY = pos.startY;
            pos.slide = true;

            group.forEach(wrapper => {
                wrapper.style.transition = 'none';
            });

            e.preventDefault();
        }

        function handleMouseMove(e) {
            if (pos.slide) {
                pos.currentY = e.clientY;
                updateSlidePosition();
            }
        }

        function handleMouseUp() {
            if (pos.slide) {
                endSlide();
            }
        }

        // Slide functions
        function startSlide() {
            pos.slide = true;
            pos.shift = shift(front);

            group.forEach(wrapper => {
                wrapper.style.transition = 'none';
            });
        }

        function updateSlidePosition() {
            if (!pos.slide) return;

            const move = pos.shift + pos.currentY - pos.startY;
            above.style.transform = slide(move - window.innerHeight, true);
            front.style.transform = slide(move, true);
            below.style.transform = slide(move + window.innerHeight, true);
        }

        function endSlide() {
            const DELTA = 100;
            const MID = -50;
            const distance = pos.currentY - pos.startY;
            const swapping = Math.abs(distance) > (window.innerHeight * MOVED / 100);
            const downward = distance > 0;

            group.forEach(wrapper => {
                wrapper.style.transition = `transform ${SPEED / 1000}s ease-out`;
                wrapper.style.zIndex = LAYER.BACK;
            });

            pos.slide = false;
            pos.isScrolling = false;

            if (swapping) {
                if (downward) {
                    above.style.zIndex = LAYER.FRONT;
                    above.style.transform = slide(MID);
                    front.style.transform = slide(MID + 100);
                    below.style.transform = slide(MID + 200);
                } else {
                    below.style.zIndex = LAYER.FRONT;
                    above.style.transform = slide(MID - 200);
                    front.style.transform = slide(MID - 100);
                    below.style.transform = slide(MID);
                }
            } else {
                front.style.zIndex = LAYER.FRONT;
                above.style.transform = slide(MID - 100);
                front.style.transform = slide(MID);
                below.style.transform = slide(MID + 100);
            }

            setTimeout(() => {
                group.forEach(wrapper => {
                    wrapper.style.transition = 'none';
                    wrapper.style.transform = slide(MID);
                });

                if (swapping) {
                    const other = front;

                    if (downward) {
                        front = above;
                        above = other;
                        currentIndex = (currentIndex - 1 + sources.length) % sources.length;
                    } else {
                        front = below;
                        below = other;
                        currentIndex = (currentIndex + 1) % sources.length;
                    }

                    other.querySelector('.koz-video').pause();

                    // Lazy load next videos when needed
                    if (currentIndex === sources.length - 1 && sources.length < allSources.length) {
                        loadMoreVideos();
                    }

                    reset(currentIndex);
                }
            }, SPEED + DELTA);
        }

        // Load more videos when reaching end
        function loadMoreVideos() {
            const nextIndex = sources.length;
            if (nextIndex < allSources.length) {
                sources.push(allSources[nextIndex]);
                console.log('Loaded additional video:', allSources[nextIndex].title);

                // Initialize link handling
                initLinkHandling();
            }
        }

        // Play/pause functions
        function togglePlayPause(wrapper) {
            const video = wrapper.querySelector('.koz-video');
            const overlay = wrapper.querySelector('.koz-video-overlay');

            if (video.paused) {
                video.play().catch(e => console.log("Play failed:", e));
                overlay.classList.add('koz-show-controls');
                setTimeout(() => overlay.classList.remove('koz-show-controls'), 2000);
            } else {
                video.pause();
                overlay.classList.add('koz-show-controls');
            }
        }

        function updatePlayPauseButton(wrapper, isPaused) {
            const btn = wrapper.querySelector('.koz-play-pause-btn');
            if (btn) {
                btn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            }
        }

        // Helper functions
        function shift(wrapper) {
            const matrix = window.getComputedStyle(wrapper).transform.split(',');
            return matrix.length > 5 ? parseFloat(matrix[5]) : 0;
        }

        function slide(amount, pixels = false) {
            return `translate(-50%, ${amount}${pixels ? 'px' : '%'})`;
        }

        function handleKeyDown(e) {
            const prev = e.key === 'ArrowDown';
            const next = e.key === 'ArrowUp';

            if (prev || next) {
                above.style.transform = slide(-window.innerHeight, true);
                below.style.transform = slide(+window.innerHeight, true);

                group.forEach(wrapper => {
                    wrapper.style.transition = `transform ${SPEED * 10 / 1000}s ease-out`;
                    wrapper.style.zIndex = LAYER.BACK;
                });

                setTimeout(() => {
                    const MID = -50;
                    if (prev) {
                        above.style.zIndex = LAYER.FRONT;
                        above.style.transform = slide(MID);
                        front.style.transform = slide(MID + 100);
                        below.style.transform = slide(MID + 200);
                        currentIndex = (currentIndex - 1 + sources.length) % sources.length;
                    } else {
                        below.style.zIndex = LAYER.FRONT;
                        above.style.transform = slide(MID - 200);
                        front.style.transform = slide(MID - 100);
                        below.style.transform = slide(MID);
                        currentIndex = (currentIndex + 1) % sources.length;
                    }

                    setTimeout(() => {
                        group.forEach(wrapper => {
                            wrapper.style.transition = 'none';
                            wrapper.style.transform = slide(MID);
                        });

                        const other = front;

                        if (prev) {
                            front = above;
                            above = other;
                        } else {
                            front = below;
                            below = other;
                        }

                        other.querySelector('.koz-video').pause();

                        // Lazy load more videos if needed
                        if (currentIndex === sources.length - 1 && sources.length < allSources.length) {
                            loadMoreVideos();
                        }

                        reset(currentIndex);
                    }, SPEED * 10 + 100);
                });

                e.preventDefault();
            }
        }
        function reset(idx) {
            const frontVideo = front.querySelector('.koz-video');
            frontVideo.play().catch(e => console.log("Autoplay prevented:", e));
            front.style.zIndex = LAYER.FRONT;

            const prev = idx === 0 ? sources.length - 1 : idx - 1;
            load(above, prev);

            const next = idx === sources.length - 1 ? 0 : idx + 1;
            load(below, next);

            // Initialize link handling
            initLinkHandling();
        }
        // Add this to your init function
        function initLinkHandling() {
            document.querySelectorAll('.koz-video-caption a').forEach(link => {
                link.addEventListener('click', function (e) {
                    e.stopPropagation(); // Stop event from bubbling up
                    // If you want links to open in a new tab
                    //                     window.open(this.href, '_blank');
                    // Or if you want them to open in the same window:
                    //                     window.location.href = this.href;
                    return false;
                });
            });
        }

        // Start by fetching videos from API
        fetchVideos();
    }
})();