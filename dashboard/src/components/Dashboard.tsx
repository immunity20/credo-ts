import React, { useState } from "react";
import axios from "axios";
import Modal from "./Modal";
import "./Dashboard.css";

interface ModalData {
  title: string;
  content: any;
  isOpen: boolean;
}

const Dashboard: React.FC = () => {
  const [macAddress, setMacAddress] = useState("");
  const [baseLine, setBaseLine] = useState("");
  const [savings, setSavings] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalData>({
    title: "",
    content: null,
    isOpen: false,
  });

  // Generate hash from MAC address
  const generateHash = (mac: string) => {
    return mac ? `domx_ot_${mac}` : "";
  };

  // Close modal
  const closeModal = () => {
    setModal({ title: "", content: null, isOpen: false });
  };

  // Request CV function
  const requestCV = async () => {
    if (!macAddress.trim()) {
      alert("Please enter a MAC address");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create connection invitation
      const invitationResponse = await axios.post(
        "https://holder.yanis.gr/credentials/connect-and-request",
        { mac: macAddress, deviceId: `domx_ot_${macAddress}` }
      );

      if (invitationResponse) {
        setModal({
          title: "Verifiable Credential Retrieved",
          content: {
            type: "cv",
            data: invitationResponse,
          },
          isOpen: true,
        });
      }
    } catch (error: any) {
      console.error("Error requesting CV:", error);
      setModal({
        title: "Error",
        content: {
          type: "error",
          data: {
            message: "Failed to create connection invitation",
            error: error.response?.data || error.message,
          },
        },
        isOpen: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Verify device function
  const verifyDevice = async () => {
    if (!macAddress.trim()) {
      alert("Please enter a MAC address");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create connection invitation
      const invitationResponse = await axios.post(
        "https://holder.yanis.gr/verifier/connect-and-prove"
      );

      if (invitationResponse.data.success) {
        setModal({
          title: "Device Verification",
          content: {
            type: "verification",
            data: {
              connection: invitationResponse.data,
              proof: invitationResponse.data,
            },
          },
          isOpen: true,
        });
      }
    } catch (error: any) {
      console.error("Error verifying device:", error);
      setModal({
        title: "Error",
        content: {
          type: "error",
          data: {
            message: "Failed to verify device",
            error: error.response?.data || error.message,
          },
        },
        isOpen: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Set KPIs function
  const setKPIs = async () => {
    if (!macAddress.trim() || !baseLine.trim() || !savings.trim()) {
      alert("Please fill in all fields");
      return;
    }

    const hash = generateHash(macAddress);

    setLoading(true);
    try {
      const response = await axios.post(
        "https://holder.yanis.gr/verifier/submit-kpis-auto",
        {
          hash,
          baseLine: parseInt(baseLine),
          savings: parseInt(savings),
        }
      );

      setModal({
        title: "KPIs Submitted Successfully",
        content: {
          type: "kpis",
          data: response.data,
        },
        isOpen: true,
      });

      // Clear form after successful submission
      setBaseLine("");
      setSavings("");
    } catch (error: any) {
      console.error("Error setting KPIs:", error);
      setModal({
        title: "Error",
        content: {
          type: "error",
          data: {
            message: "Failed to set KPIs",
            error: error.response?.data || error.message,
          },
        },
        isOpen: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-container">
        <h1 className="dashboard-title">IoT Device Management</h1>

        {/* MAC Address Section */}
        <div className="form-section">
          <h2>Device Information</h2>
          <div className="form-group">
            <label htmlFor="macAddress">MAC Address:</label>
            <div className="mac-input-group">
              <input
                type="text"
                id="macAddress"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="e.g., 00:11:22:33:44:55"
                className="form-input"
              />
              <input
                type="text"
                value={generateHash(macAddress)}
                disabled
                className="form-input hash-display"
                placeholder="Generated hash will appear here"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-section">
          <h2>Device Actions</h2>
          <div className="button-group">
            <button
              onClick={requestCV}
              disabled={loading || !macAddress.trim()}
              className="action-button primary"
            >
              {loading ? "Processing..." : "Request CV"}
            </button>

            <button
              onClick={verifyDevice}
              disabled={loading || !macAddress.trim()}
              className="action-button secondary"
            >
              {loading ? "Processing..." : "Verify Device"}
            </button>
          </div>
        </div>

        {/* KPIs Section */}
        <div className="form-section">
          <h2>Set KPIs</h2>
          <div className="kpi-form">
            <div className="form-group">
              <label htmlFor="baseLine">Baseline:</label>
              <input
                type="number"
                id="baseLine"
                value={baseLine}
                onChange={(e) => setBaseLine(e.target.value)}
                placeholder="Enter baseline value"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="savings">Savings:</label>
              <input
                type="number"
                id="savings"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
                placeholder="Enter savings value"
                className="form-input"
              />
            </div>

            <button
              onClick={setKPIs}
              disabled={
                loading ||
                !macAddress.trim() ||
                !baseLine.trim() ||
                !savings.trim()
              }
              className="action-button success"
            >
              {loading ? "Submitting..." : "Set KPIs"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        content={modal.content}
      />
    </div>
  );
};

export default Dashboard;
