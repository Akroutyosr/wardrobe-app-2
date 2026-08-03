# Outfit Diary

Build a cute, playful wardrobe styling app called "twinish" — a personal

closet companion that helps someone see their clothes as outfit

possibilities, not just a pile of stuff. The vibe should feel like a fun

diary/scrapbook crossed with a friendly stylist bestie — warm, encouraging,

never judgmental about what's in someone's closet. Think Duolingo's

playfulness meets a cozy Pinterest board, not a sterile e-commerce app.

VISUAL STYLE

- Soft, warm color palette: think cream/blush background, one confident

  accent color (a warm coral or a soft lavender), rounded corners

  everywhere, no harsh edges

- Friendly, slightly rounded typography for headers; clean sans-serif for

  body text

- Small delightful touches: a subtle bounce on button taps, a gentle

  confetti burst when an outfit gets saved, soft drop shadows on clothing

  cards to make them feel tactile, like little Polaroids

- Generous white space, nothing cluttered — this should feel calm to open,

  not overwhelming

SCREENS TO BUILD (use realistic mock/dummy data throughout — no real

backend needed, this is a visual prototype)

1. Home / Today screen

   - A warm greeting ("Good morning! Here's what's fresh today ☀️")

   - A hero "Today's outfit pick" card showing 3-4 clothing items laid out

     together as a mini outfit collage, with a playful one-line reason

     underneath ("Cozy but put-together — perfect for a rainy Tuesday")

   - A "shuffle" button with a little animation to get another suggestion

   - Small stats strip: "47 items in your closet · worn 12 this month"

2. My Closet screen

   - A Pinterest-style masonry grid of clothing item photos (use varied

     mock placeholder clothing images)

   - Filter chips at the top: category (tops/bottoms/shoes/outerwear/

     accessories), color, season — playful pill-shaped buttons, one

     accent color when selected

   - Tapping an item opens a detail view: bigger photo, its tags shown as

     cute little badges (color, formality, season), a "worn 8 times"

     stat, and a "outfits with this" mini row

3. Add Item flow

   - A big friendly "+" button, camera/upload icon

   - After "photo taken," show a delightful loading state ("Studying your

     fit... 👀") then reveal auto-detected tags as editable chips the

     user can tap to adjust before saving

   - A satisfying "Added to your closet!" confirmation with a little

     celebration animation

4. Outfit Ideas screen

   - Swipeable card deck (like a dating app, but for outfits) — swipe

     right to save an outfit you like, left to skip

   - Each card shows a full outfit laid out attractively with a short,

     warm caption explaining the styling logic in plain language

   - A "saved outfits" tab showing everything swiped right on, as a neat

     grid

5. "Should I Buy This?" screen (the star feature — make it feel special)

   - Camera/upload button styled distinctly, maybe with a little shopping

     bag icon and a slightly more playful/urgent visual treatment since

     it's a decision-support moment

   - After "analyzing," show a clear verdict as a big friendly badge:

     "Yes, get it! 🎉" / "Eh, you already have this 🤔" / "Maybe — here's

     why" in warm, non-judgmental language

   - Below the verdict: a "goes great with" row showing 2-3 existing

     closet items it pairs with, and if relevant a gentle note like

     "You already own something similar" with a side-by-side comparison

TONE OF ALL MICROCOPY

Warm, a little playful, never preachy about spending habits or body/style

judgments. Celebrate good choices, be gently honest about redundant ones,

never shame.

Prioritize the Home screen, My Closet, and "Should I Buy This?" screens

first — those matter most for this prototype.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a65aae68-2a49-452a-a840-f8adda671fde).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
