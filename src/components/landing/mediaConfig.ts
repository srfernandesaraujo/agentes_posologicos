/**
 * Central flag registry for optional media files in `public/media/`.
 * Flip a flag to `true` after adding the corresponding file so browsers
 * never make wasted network requests for media assets not yet uploaded.
 */
export const LANDING_MEDIA = {
  heroAmbient: true, // public/media/hero-ambient.mp4
  briefingDemo: true, // public/media/briefing-demo.mp3
  founderStory: false, // public/media/founder-story.mp4
  showreel: false, // public/media/showreel.mp4
  bentoClips: {
    "osce-live": false, // public/media/clip-osce.mp4
    "dose-calc": false, // public/media/clip-dose.mp4
    "voice-briefing": false, // public/media/clip-briefing.mp4
    "classroom-cert": false, // public/media/clip-rooms.mp4
  } as Record<string, boolean>,
} as const;
