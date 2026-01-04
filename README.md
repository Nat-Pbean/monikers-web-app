# 🃏 Monikers Mobile

A real-time, web-based implementation of the hit party game **Monikers**, designed specifically for mobile browsers. Built with a focus on seamless player syncing and a "tap-to-play" experience.

> **Note:** This project is a digital tribute to the board game "Monikers" created by Alex Hague and Justin Vickers. Please support the original creators at [monikersgame.com](https://www.monikersgame.com/).

---

## 🚀 Features

* **Real-Time Gameplay:** Powered by Socket.io for instant card draws and timer syncing.
* **Tap-to-Draw Design:** Large, mobile-friendly interface inspired by classic card game mechanics.
* **Persistent Sessions:** Uses `localStorage` so players stay on their teams even if they refresh or lose connection.
* **Role-Based Visibility:** Only the active Clue Giver sees the card; teammates and opponents see a "Guessing" or "Waiting" screen.
* **Custom Deck Drafting:** Players curate the game deck themselves at the start of each session.

---

## 🛠️ Tech Stack

* **Frontend:** React.js (Hooks, useMemo, Socket-client)
* **Backend:** Node.js, Express
* **Communication:** Socket.io (WebSockets)
* **Styling:** CSS3 (Mobile-first responsive design)
