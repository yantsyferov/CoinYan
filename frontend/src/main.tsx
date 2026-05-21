import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './shared/api/apollo-client';
import { App } from './app/App';

const style = document.createElement('style');
style.textContent = `* { box-sizing: border-box; } body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: #F1F5F9; } input, button, textarea, select { font-family: inherit; }`;
document.head.appendChild(style);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in the document.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
