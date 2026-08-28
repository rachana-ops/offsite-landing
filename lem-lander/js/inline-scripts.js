(function () {
  function initVideoAutoplay() {
    const isInSwiper = (v) => !!v.closest('[swiper="slider"]');
    const isInThumb  = (v) => !!v.closest('.hero-gallery__thumbnail');
    const isPlyrVideo = (v) => !!v.closest('.plyr, .play_card');

    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return;

    videos.forEach((video) => {
      video.pause();

      // do NOT auto-mute Plyr videos
      if (!isPlyrVideo(video)) {
        video.muted = true; // required for mobile autoplay
      }

      video.playsInline = true;  // iOS Safari
      video.autoplay = false;    // prevent native autoplay
      video.preload = 'none';    // optional: reduces early network usage
    });

    // Ensure Plyr videos can have sound on user play
    document.addEventListener("play", (e) => {
      const v = e.target;
      if (v && v.tagName === "VIDEO" && isPlyrVideo(v)) {
        v.muted = false;
        v.volume = 1;
      }
    }, true);

    if (!('IntersectionObserver' in window)) return;

    const THRESHOLD = 0.35;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (isInSwiper(video) || isInThumb(video) || isPlyrVideo(video)) {
            if (entry.intersectionRatio < THRESHOLD) {
              video.pause();
              try { video.currentTime = 0; } catch (e) {}
            }
            return;
          }

          if (entry.intersectionRatio >= THRESHOLD) {
            const p = video.play();
            if (p && p.catch) p.catch(() => {});
          } else {
            video.pause();
            try { video.currentTime = 0; } catch (e) {}
          }
        });
      },
      { root: null, threshold: THRESHOLD }
    );

    videos.forEach((video) => observer.observe(video));

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      videos.forEach((video) => video.pause());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoAutoplay);
  } else {
    initVideoAutoplay();
  }
})();
