import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import mockApi from './mockApi'
import ErrorBoundary from './components/ErrorBoundary'

if (!window.api) {
  window.api = mockApi;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fullPage={true}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
