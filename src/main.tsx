import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bindIpcEvents } from './store';
import './styles.css';

bindIpcEvents();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
