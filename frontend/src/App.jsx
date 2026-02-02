import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import BankDashboard from "./pages/BankDashboard.jsx";
import CategoriesReport from "./pages/CategoriesReport.jsx";
import MerchantsReport from "./pages/MerchantsReport.jsx";
import CategoryMonthDetail from "./pages/CategoryMonthDetail.jsx";
import CategoryDetail from "./pages/CategoryDetail.jsx";
import MerchantDetail from "./pages/MerchantDetail.jsx";
import ImportDetail from "./pages/ImportDetail.jsx";
import MerchantMonthDetail from "./pages/MerchantMonthDetail.jsx";
import BankCategoriesReport from "./pages/BankCategoriesReport.jsx";
import BankActivities from "./pages/BankActivities.jsx";
import BankMonthDetail from "./pages/BankMonthDetail.jsx";
import BankImportDetail from "./pages/BankImportDetail.jsx";
import BankImportDraftReview from "./pages/BankImportDraftReview.jsx";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isBank = location.pathname.startsWith("/bank");
  const isCards = !isBank;

  return (
    <div className="app">
      <div className="background-orb orb-1" />
      <div className="background-orb orb-2" />
      <div className="background-orb orb-3" />

      <header className="top-nav">
        <div className="top-nav-row">
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
          <nav className="domain-nav">
            <div className={`nav-group ${isBank ? "active" : ""}`}>
              <button
                type="button"
                className={`nav-pill ${isBank ? "active" : ""}`}
                onClick={() => navigate("/bank")}
              >
                Bank activities
              </button>
              <div className="nav-dropdown">
                <NavLink to="/bank" end>
                  Dashboard
                </NavLink>
                <NavLink to="/bank/activities">Activities</NavLink>
                <NavLink to="/bank/categories">Categories</NavLink>
              </div>
            </div>
            <div className={`nav-group ${isCards ? "active" : ""}`}>
              <button
                type="button"
                className={`nav-pill ${isCards ? "active" : ""}`}
                onClick={() => navigate("/")}
              >
                Credit cards
              </button>
              <div className="nav-dropdown">
                <NavLink to="/" end>
                  Dashboard
                </NavLink>
                <NavLink to="/categories">Categories</NavLink>
                <NavLink to="/merchants">Merchants</NavLink>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bank" element={<BankDashboard />} />
          <Route path="/bank/activities" element={<BankActivities />} />
          <Route path="/bank/categories" element={<BankCategoriesReport />} />
          <Route path="/bank/month/:month" element={<BankMonthDetail />} />
          <Route path="/bank/imports/:importId" element={<BankImportDetail />} />
          <Route path="/bank/imports/drafts/:draftId" element={<BankImportDraftReview />} />
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
