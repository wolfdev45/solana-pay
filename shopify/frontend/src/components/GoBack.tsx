import React, { FC } from 'react';

export const GoBack: FC = () => {
  return (
    <div className="d-flex go-back p-3">
      <div className="flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M16.8449 7.61527H3.94192L9.57901 1.97818C10.0295 1.52768 10.0295 0.788384 9.57901 0.337879C9.12851 -0.112626 8.40077 -0.112626 7.95026 0.337879L0.337879 7.95026C-0.112626 8.40077 -0.112626 9.12851 0.337879 9.57901L7.95026 17.1914C8.40077 17.6419 9.12851 17.6419 9.57901 17.1914C10.0295 16.7409 10.0295 16.0132 9.57901 15.5627L3.94192 9.92556H16.8449C17.4802 9.92556 18 9.40574 18 8.77042C18 8.13509 17.4802 7.61527 16.8449 7.61527Z" fill="black" />
        </svg>
      </div>
      <div className="flex-grow-1 ps-3">
        Go back
      </div>
    </div>
  )
};

