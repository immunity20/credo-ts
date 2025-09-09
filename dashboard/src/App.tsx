import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import StatsPage from "./components/StatsPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="nav-title">IoT Device Dashboard</h1>
            <div className="nav-links">
              <Link to="/" className="nav-link">
                Dashboard
              </Link>
              <Link to="/stats" className="nav-link">
                Stats
              </Link>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stats/:hash" element={<StatsPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
