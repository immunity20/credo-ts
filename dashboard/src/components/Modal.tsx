import React from "react";
import "./Modal.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: {
    type: string;
    data: unknown;
  } | null;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  const renderContent = () => {
    if (!content) return null;

    switch (content.type) {
      case "connection":
        return (
          <div className="modal-content-section">
            <h4>Connection Details:</h4>
            <pre className="json-display">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );

      case "verification":
        return (
          <div className="modal-content-section">
            <h4>Verification Results:</h4>
            <pre className="json-display">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );

      case "kpis":
        return (
          <div className="modal-content-section">
            <h4>KPI Submission Results:</h4>
            <pre className="json-display">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );

      case "error":
        return (
          <div className="modal-content-section error">
            <h4>Error Details:</h4>
            <pre className="json-display error">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );

      case "stats":
        return (
          <div className="modal-content-section">
            <h4>Statistics:</h4>
            <pre className="json-display">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );

      default:
        return (
          <div className="modal-content-section">
            <pre className="json-display">
              {JSON.stringify(content.data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{renderContent()}</div>
        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
