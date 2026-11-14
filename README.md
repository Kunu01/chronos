# CraveBook 🍳 — Everyday Culinary & Comfort Recipes

![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)

> A modern, responsive recipe catalog and meal planning web application designed for home chefs and everyday cooks. Discover over 500+ chef-curated regional recipes, comfort classics, and artisan culinary creations with real-time ingredient filtering and interactive cook-along mode.

---

## ✨ Features

- **📖 Chef-Curated Collections**  
  Browse extensive culinary categories including *North Indian Curries*, *Tandoori & Chaat*, *Dum Biryanis & Breads*, *South Indian Tiffin Classics*, *Indo-Chinese*, and *Artisan Desserts*.

- **🔍 Smart Search & Ingredient Filtering**  
  Quickly filter recipes by title, cuisine, preparation time, category, or specific pantry ingredients with instant debounced search.

- **⏱️ Detailed Cook-Along View**  
  Each recipe includes exact preparation and cooking times, per-serving caloric estimates, difficulty ratings, and step-by-step culinary instructions.

- **✅ Interactive Ingredient Checklist**  
  Mark off ingredients directly on screen as you prep your mise en place to stay organized in the kitchen.

- **🔖 Recipe Bookmarking**  
  Save your favorite recipes with one click to easily access your personalized weeknight dinner lineup.

- **📱 Mobile-First Responsive Design**  
  Crafted with clean typography, high-definition photography, and smooth micro-interactions tailored for phones, tablets, and desktop workstations.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React Icons, Framer Motion
- **Backend API:** Node.js, Express, RESTful Recipe Endpoints
- **Styling:** Modern Clean Editorial / Modernist Kitchen Aesthetic
- **Deployment Ready:** Vercel (Client) & Render (API Service)

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/CraveBook.git
   cd CraveBook
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   ```

3. **Install backend dependencies:**
   ```bash
   cd ../server
   npm install
   ```

### Running in Development

1. **Start the API server:**
   ```bash
   cd server
   npm run dev
   ```
   *The recipe API will start on `http://localhost:5000`.*

2. **Start the Vite frontend development server:**
   ```bash
   cd client
   npm run dev
   ```
   *The application will open on `http://localhost:5173`.*

---

## 📁 Project Structure

```text
CraveBook/
├── client/                     # Vite React Frontend
│   ├── public/                 # Static assets & icons
│   ├── src/
│   │   ├── components/decoy/   # CraveBook recipe grid, cards & modal views
│   │   ├── contexts/           # Theme & application state providers
│   │   ├── utils/              # API fetcher & media helpers
│   │   ├── App.jsx             # Root layout & routing
│   │   └── main.jsx            # Application entry point
│   ├── index.html              # HTML shell & font definitions
│   ├── vite.config.js          # Vite build & proxy configuration
│   └── package.json
│
├── server/                     # Express REST API Server
│   ├── controllers/            # Recipe search & query controllers
│   ├── routes/                 # Express API route declarations
│   ├── services/               # Culinary data store & helpers
│   ├── server.js               # Entry point & middleware setup
│   └── package.json
│
└── README.md
```

---

## 🍽️ Available Recipe Categories

| Category | Description | Featured Signature Dish |
| :--- | :--- | :--- |
| **Indian Curries & Dal** | Slow-simmered rich gravies & lentils | Paneer Butter Masala |
| **Tandoori & Chaat** | Charred appetisers & tangy street chaat | Paneer Tikka Angara |
| **Biryani & Breads** | Fragrant basmati rice & clay-oven flatbreads | Awadhi Dum Biryani |
| **South Indian** | Fermented crêpes, idlis & spiced sambar | Crispy Masala Dosa |
| **Indo-Chinese** | Sizzling wok noodles & crisp appetisers | Veg Manchurian Gravy |
| **Desserts & Drinks** | Traditional sweets, kulfi & spiced chai | Masala Cutting Chai |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Crafted with passion for home cooks and culinary enthusiasts worldwide. 🍲
</p>
