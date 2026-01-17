import { NavLink, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import CategoriesReport from "./pages/CategoriesReport.jsx";
import MerchantsReport from "./pages/MerchantsReport.jsx";
import CategoryMonthDetail from "./pages/CategoryMonthDetail.jsx";
import CategoryDetail from "./pages/CategoryDetail.jsx";
import MerchantDetail from "./pages/MerchantDetail.jsx";
import ImportDetail from "./pages/ImportDetail.jsx";
import MerchantMonthDetail from "./pages/MerchantMonthDetail.jsx";

export default function App() {
  return (
    <div className="app">
      <div className="background-orb orb-1" />
      <div className="background-orb orb-2" />
      <div className="background-orb orb-3" />

      <header className="top-nav">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="img">
              <defs>
                <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8a4b" />
                  <stop offset="100%" stopColor="#7b61ff" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="26" fill="url(#logoGradient)" />
              <circle
                cx="32"
                cy="32"
                r="18"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="2"
              />
              <text
                x="32"
                y="32"
                textAnchor="middle"
                dominantBaseline="middle"
                dy="2"
                fontFamily="Space Grotesk, sans-serif"
                fontSize="26"
                fill="#fff"
              >
                ₪
              </text>
            </svg>
          </div>
          <p className="eyebrow">Tazrim</p>
        </div>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <NavLink to="/merchants">Merchants</NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/categories" element={<CategoriesReport />} />
          <Route path="/categories/month/:month" element={<CategoryMonthDetail />} />
          <Route path="/categories/:categoryId" element={<CategoryDetail />} />
          <Route path="/merchants" element={<MerchantsReport />} />
          <Route path="/merchants/:merchantId" element={<MerchantDetail />} />
          <Route path="/merchants/month/:month" element={<MerchantMonthDetail />} />
          <Route path="/imports/:importId" element={<ImportDetail />} />
        </Routes>
      </main>
    </div>
  );
}
