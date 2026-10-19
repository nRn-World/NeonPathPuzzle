## Packages
framer-motion | Complex UI transitions and modal animations
canvas-confetti | Celebration effects for level completion
@types/canvas-confetti | Types for confetti
uuid | Generating unique user IDs for guest progress tracking

## Notes
- Game uses HTML5 Canvas for performance and visual effects
- User progress is local-first (versioned localStorage) with stars, best times, daily streak, and automatic migration
- Dark neon/cyberpunk aesthetic requires specific tailwind config usage
- Touch events must be handled carefully for mobile playability
