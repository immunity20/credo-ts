import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./StatsPage.css";

interface KPIData {
  hash: string;
  totalBaseLine: string;
  totalSavings: string;
}

interface EventData {
  date: string;
  hash: string;
  baseline: string;
  savings: string;
  user: string;
  blockNumber: number;
  transactionHash: string;
}

interface StatsData {
  kpiData: KPIData | null;
  events: EventData[];
  loading: boolean;
  error: string | null;
}

const StatsPage: React.FC = () => {
  const { hash: urlHash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const [hashInput, setHashInput] = useState(urlHash || "");
  const [stats, setStats] = useState<StatsData>({
    kpiData: null,
    events: [],
    loading: false,
    error: null,
  });

  // Fetch stats data
  const fetchStats = async (targetHash: string) => {
    if (!targetHash.trim()) {
      setStats((prev) => ({ ...prev, error: "Please enter a hash" }));
      return;
    }

    setStats((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch KPI data
      console.log("omgomg");
      const kpiResponse = await axios.get(
        `https://verifier.yanis.gr/api/blockchain/get-kpi/${targetHash}`
      );
      setTimeout(() => null, 3000);
      // Fetch events for this hash
      const eventsResponse = await axios.get(
        `https://verifier.yanis.gr/api/blockchain/events/${targetHash}?blocks=1000`
      );

      setStats({
        kpiData: kpiResponse.data.success
          ? {
              hash: kpiResponse.data.hash,
              totalBaseLine: kpiResponse.data.totalBaseLine,
              totalSavings: kpiResponse.data.totalSavings,
            }
          : null,
        events: eventsResponse.data.success ? eventsResponse.data.events : [],
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats((prev) => ({
        ...prev,
        loading: false,
        error:
          "Failed to fetch statistics. Please check the hash and try again.",
      }));
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hashInput.trim()) {
      navigate(`/stats/${hashInput.trim()}`);
      fetchStats(hashInput.trim());
    }
  };

  // Fetch data when URL hash changes
  useEffect(() => {
    if (urlHash) {
      setHashInput(urlHash);
      fetchStats(urlHash);
    }
  }, [urlHash]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Calculate total from events
  const calculateTotals = () => {
    const totalBaseLine = stats.events.reduce(
      (sum, event) => sum + parseInt(event.baseline || "0"),
      0
    );
    const totalSavings = stats.events.reduce(
      (sum, event) => sum + parseInt(event.savings || "0"),
      0
    );
    return { totalBaseLine, totalSavings };
  };

  const eventTotals = calculateTotals();
  console.log(stats.events);
  return (
    <div className="stats-page">
      <div className="stats-container">
        <h1 className="stats-title">Device Statistics</h1>

        {/* Hash Input Form */}
        <div className="search-section">
          <form onSubmit={handleSubmit} className="search-form">
            <input
              type="text"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              placeholder="Enter device hash (e.g., e5deed82bd37ab1285dcf61852ede4f5260314fb9407537ac6bcf218a90f4d26)"
              className="search-input"
            />
            <button
              type="submit"
              disabled={stats.loading}
              className="search-button"
            >
              {stats.loading ? "Loading..." : "Get Stats"}
            </button>
          </form>
        </div>

        {/* Error Display */}
        {stats.error && <div className="error-message">{stats.error}</div>}

        {/* Loading State */}
        {stats.loading && (
          <div className="loading-message">Loading statistics...</div>
        )}

        {/* Results */}
        {!stats.loading &&
          !stats.error &&
          (stats.kpiData || stats.events.length > 0) && (
            <div className="results-section">
              {/* KPI Summary */}
              <a
                style={{ fontSize: "24px", fontWeight: 700 }}
                href="https://sepolia.etherscan.io/address/0xf868d9130ea1a1b9ca0b406411b4d6f646ddcd89"
                target="_new"
              >
                Smart contract
              </a>
              <div className="kpi-summary">
                <h2>KPI Summary</h2>
                <div className="summary-cards">
                  <div className="summary-card">
                    <h3>Smart Contract Totals</h3>
                    {stats.kpiData ? (
                      <>
                        <p>
                          <strong>Total Baseline:</strong>{" "}
                          {stats.kpiData.totalBaseLine}
                        </p>
                        <p>
                          <strong>Total Savings:</strong>{" "}
                          {stats.kpiData.totalSavings}
                        </p>
                        <p>
                          <strong>Hash:</strong> {stats.kpiData.hash}
                        </p>
                      </>
                    ) : (
                      <p>No KPI data found for this hash</p>
                    )}
                  </div>

                  <div className="summary-card">
                    <h3>Events Summary</h3>
                    <p>
                      <strong>Total Events:</strong> {stats.events.length}
                    </p>
                    <p>
                      <strong>Events Baseline Sum:</strong>{" "}
                      {eventTotals.totalBaseLine}
                    </p>
                    <p>
                      <strong>Events Savings Sum:</strong>{" "}
                      {eventTotals.totalSavings}
                    </p>
                  </div>
                </div>
              </div>

              {/* Events Table */}
              {stats.events.length > 0 && (
                <div className="events-section">
                  <h2>Transaction History</h2>
                  <div className="table-container">
                    <table className="events-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Hash</th>
                          <th>Baseline</th>
                          <th>Savings</th>
                          <th>Block</th>
                          <th>Transaction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.events.map((event, index) => (
                          <tr key={index} style={{ color: "black" }}>
                            <td>{formatDate(event.date)}</td>
                            <td className="hash-cell" title={event.hash}>
                              {event.hash.length > 20
                                ? `${event.hash.substring(0, 20)}...`
                                : event.hash}
                            </td>
                            <td>{event.baseline}</td>
                            <td>{event.savings}</td>
                            <td>{event.blockNumber}</td>
                            <td
                              className="tx-cell"
                              title={event.transactionHash}
                            >
                              <a
                                href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link"
                              >
                                {event.transactionHash.substring(0, 10)}...
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* No Results */}
        {!stats.loading &&
          !stats.error &&
          !stats.kpiData &&
          stats.events.length === 0 &&
          hashInput && (
            <div className="no-results">
              <p>No data found for hash: {hashInput}</p>
              <p>
                Please check the hash and try again, or ensure KPIs have been
                submitted for this device.
              </p>
            </div>
          )}
      </div>
    </div>
  );
};

export default StatsPage;
