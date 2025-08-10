// components/ConvertedTextDisplay.js
import React from "react";

const ConvertedTextDisplay = ({ convertedText }) => {
  return (
    <div className="converted-text-container">
      <h3>Converted Text</h3>
      <div className="text-display">
        {convertedText || "Your converted text will appear here..."}
      </div>
    </div>
  );
};

export default ConvertedTextDisplay;
