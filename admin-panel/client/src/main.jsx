import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './app/store';
import App from './App';
import './index.css';

// Strip trailing slash agar React Router basename konsisten ('/wso2-admin' bukan '/wso2-admin/').
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </Provider>
);
